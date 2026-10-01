import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const usage = fs.readFileSync('backend/src/research/usage-events.js', 'utf8');
const router = fs.readFileSync('backend/src/assistant/router.js', 'utf8');
const backend = fs.readFileSync('backend/src/index.js', 'utf8');
const admin = fs.readFileSync('admin.html', 'utf8');
const migration = fs.readFileSync('migrations/0055_research_usage_stage_timings.sql', 'utf8');

describe('Assistant admin funnel and stage-latency contract', () => {
  it('persists only content-free numeric stage timings', () => {
    for (const column of ['discover_ms','evidence_pack_ms','model_ms','grounding_ms']) {
      expect(migration).toContain(column);
      expect(usage).toContain(column);
    }
    expect(router).toContain('stageTimings');
    expect(migration).not.toMatch(/query|answer|claim|evidence_text|prompt|payload/i);
  });

  it('aggregates nullable stage averages in the existing superadmin usage API', () => {
    expect(backend).toContain('AVG(e.discover_ms)');
    expect(backend).toContain('AVG(e.evidence_pack_ms)');
    expect(backend).toContain('AVG(e.model_ms)');
    expect(backend).toContain('AVG(e.grounding_ms)');
    expect(backend).toContain('stage_latency_ms');
  });

  it('renders a bounded funnel and stage-latency view without content fields', () => {
    expect(admin).toContain('Assistant Funnel');
    expect(admin).toContain('Stage Latency');
    expect(admin).toContain('researchUsageFunnel(data.outcomes, summary.requests)');
    expect(admin).toContain('researchStageLatencyRows(summary.stage_latency_ms)');
  });
});
