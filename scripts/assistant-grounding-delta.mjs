import fs from 'node:fs';

function rows(path) {
  const parsed = JSON.parse(fs.readFileSync(path, 'utf8'));
  const result = Array.isArray(parsed) ? parsed[0] : parsed;
  return result?.results || [];
}

const [beforePath, afterPath] = process.argv.slice(2);
if (!beforePath || !afterPath) throw new Error('GROUNDING_SNAPSHOT_PATHS_REQUIRED');

const before = new Map(rows(beforePath).map((row) => [row.metric, Number(row.value) || 0]));
const after = new Map(rows(afterPath).map((row) => [row.metric, Number(row.value) || 0]));
const metrics = new Set([...before.keys(), ...after.keys()]);
const deltaFor = (metric) => (after.get(metric) || 0) - (before.get(metric) || 0);
const positiveDelta = [...metrics]
  .map((metric) => ({ metric, delta: deltaFor(metric) }))
  .filter((row) => row.delta > 0);

const groundingDelta = positiveDelta.filter((row) => row.metric.startsWith('assistant_grounding_rejection_'));
const timingDelta = positiveDelta.filter((row) =>
  row.metric === 'assistant_requests' ||
  /^assistant_(duration|discover|evidence_pack|model|grounding)_ms_total$/.test(row.metric)
);
const requests = Math.max(0, deltaFor('assistant_requests'));
const averagePerRequestMs = {};
if (requests > 0) {
  for (const [metric, label] of [
    ['assistant_duration_ms_total', 'duration_ms'],
    ['assistant_discover_ms_total', 'discover_ms'],
    ['assistant_evidence_pack_ms_total', 'evidence_pack_ms'],
    ['assistant_model_ms_total', 'model_ms'],
    ['assistant_grounding_ms_total', 'grounding_ms']
  ]) {
    const delta = Math.max(0, deltaFor(metric));
    if (delta > 0) averagePerRequestMs[label] = Math.round((delta / requests) * 10) / 10;
  }
}

console.log(JSON.stringify({
  grounding_rejection_delta: groundingDelta,
  assistant_timing_delta: timingDelta,
  assistant_timing_average_per_request_ms: averagePerRequestMs
}));
