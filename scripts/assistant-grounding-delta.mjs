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
const delta = [...after]
  .map(([metric, value]) => ({ metric, delta: value - (before.get(metric) || 0) }))
  .filter((row) => row.delta > 0);

console.log(JSON.stringify({ grounding_rejection_delta: delta }));
