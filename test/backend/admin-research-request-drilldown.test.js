import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const backend = fs.readFileSync('backend/src/index.js', 'utf8');
const usage = fs.readFileSync('backend/src/research/usage-events.js', 'utf8');
const admin = fs.readFileSync('admin.html', 'utf8');

describe('content-free per-user request drilldown', () => {
  it('keeps shared usage retention at 90 days while drilldown is bounded to 30 days', () => {
    expect(usage).toContain('const RETENTION_DAYS = 90');
    expect(usage).toContain("DELETE FROM research_usage_events WHERE created_at < datetime('now', '-${RETENTION_DAYS} days')");
    expect(backend).toContain("daysRaw >= 1 && daysRaw <= 30");
  });

  it('keeps the endpoint superadmin-only and response allowlisted', () => {
    expect(backend).toContain("app.get('/api/admin/research/usage/requests'");
    expect(backend).toContain("auth.user.role !== 'super_admin'");
    const start = backend.indexOf("app.get('/api/admin/research/usage/requests'");
    const end = backend.indexOf('// ====================== ADMIN ENDPOINT', start);
    const route = backend.slice(start, end);
    for (const forbidden of ['query_text', 'answer_text', 'claim_text', 'evidence_text', 'prompt_text', 'payload', 'provider_error']) {
      expect(route).not.toContain(forbidden);
    }
    expect(route).toContain('request_id');
    expect(route).toContain('severity');
    expect(route).toContain('stage_latency_ms');
    expect(route).toContain('retrieval_mode');
    expect(route).toContain('candidate_depth');
    expect(route).toContain('abstract_bearing_count');
    expect(route).toContain('metadata_only_count');
  });

  it('renders deterministic severity colors and a per-user drilldown control', () => {
    expect(admin).toContain('data-research-request-user');
    expect(admin).toContain('toggleResearchRequestDrilldown');
    expect(admin).toContain("green: 'bg-emerald-100 text-emerald-800'");
    expect(admin).toContain("amber: 'bg-amber-100 text-amber-800'");
    expect(admin).toContain("red: 'bg-red-100 text-red-800'");
    expect(admin).toContain("grey: 'bg-gray-200 text-gray-700'");
    expect(admin).toContain('90 gün retention • request detayları en fazla 30 gün');
    expect(admin).toContain('<th>Retrieval</th>');
    expect(admin).toContain('<th>Evidence depth</th>');
    expect(admin).toContain("request.retrieval?.mode");
    expect(admin).toContain("request.retrieval?.candidate_depth");
  });
});
