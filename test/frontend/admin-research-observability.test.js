import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('Research admin observability', () => {
  const health = fs.readFileSync('backend/src/system-health.js', 'utf8');
  const admin = fs.readFileSync('admin.html', 'utf8');

  it('reports content-free checker pause and daily budget state to superadmins', () => {
    expect(health).toContain('SUPPORT_CHECK_PAUSE_KEY');
    expect(health).toContain('supportCheckInvocationKey()');
    expect(health).toContain('daily_invocations_used');
    expect(health).toContain('daily_invocation_limit');
    expect(health).toContain('support_check: supportCheck');
  });

  it('renders checker state without adding a mutation control', () => {
    expect(admin).toContain('async function loadSystemHealth()');
    expect(admin).toContain('/api/admin/system-health');
    expect(admin).toContain('Checker: duraklatıldı');
    expect(admin).toContain('daily_invocations_used');
    expect(admin).not.toContain('/api/admin/support-check/pause');
  });

  it('provides a superadmin-only content-free Research observability tab', () => {
    expect(admin).toContain('data-tab="research" id="researchTab"');
    expect(admin).toContain('id="tab-research"');
    expect(admin).toContain("hide('researchTab')");
    expect(admin).toContain("tab === 'research'");
    expect(admin).toContain('loadResearchObservability()');
    expect(admin).toContain('research_telemetry');
    expect(admin).toContain('assistant_outcome_ok');
    expect(admin).toContain('assistant_grounding_rejection_support_check_failed_timeout');
    expect(admin).toContain('Salt okunur, content-free görünüm');
  });

  it('keeps Research observability content-free and avoids account/content identifiers', () => {
    const start = admin.indexOf('<!-- Research Tab:');
    const end = admin.indexOf('<!-- Users Tab -->', start);
    const researchMarkup = admin.slice(start, end);
    expect(researchMarkup).not.toContain('data-admin-action=');
    expect(researchMarkup).not.toContain('query');
    expect(researchMarkup).not.toContain('user_id');
    expect(researchMarkup).not.toContain('institution_id');
    expect(researchMarkup).not.toContain('evidence_pack_id');
  });
  it('adds explicit audited checker pause/resume controls without exposing content', () => {
    expect(admin).toContain('id="researchCheckerPauseBtn"');
    expect(admin).toContain('id="researchCheckerResumeBtn"');
    expect(admin).toContain("setResearchCheckerState('pause')");
    expect(admin).toContain("setResearchCheckerState('resume')");
    expect(admin).toContain("window.confirm('Fresh-Checker resume edilsin mi?");
    expect(admin).toContain('/api/admin/research/support-check-state');
  });
  it('adds an admin-editable daily checker limit without exposing content', () => {
    expect(admin).toContain('id="researchCheckerDailyLimitInput"');
    expect(admin).toContain('id="researchCheckerDailyLimitSaveBtn"');
    expect(admin).toContain('setResearchCheckerDailyLimit()');
    expect(admin).toContain('/api/admin/research/support-check-limit');
    expect(admin).toContain('daily_invocation_limit_source');
  });


  it('exposes shared Assistant request-pool controls separately from checker limits', () => {
    expect(admin).toContain('id="researchUsageScopeType"');
    expect(admin).toContain('id="researchUsageScopeId"');
    expect(admin).toContain('id="researchUsageScopeDailyLimitInput"');
    expect(admin).toContain('/api/admin/research/assistant-usage-limit');
    expect(admin).toContain('loadResearchUsageScopeLimit()');
    expect(admin).toContain('setResearchUsageScopeLimit()');
  });

  it('exposes usage-scope pause and resume separately from quota and checker controls', () => {
    expect(admin).toContain('id="researchUsageScopePauseBtn"');
    expect(admin).toContain('id="researchUsageScopeResumeBtn"');
    expect(admin).toContain('/api/admin/research/assistant-usage-state');
    expect(admin).toContain("setResearchUsageScopeState('pause')");
    expect(admin).toContain("setResearchUsageScopeState('resume')");
  });

  it('shows institution daily shared-pool usage separately from period request aggregates', () => {
    expect(admin).toContain('Bugünkü ortak havuz');
    expect(admin).toContain('B2C kullanıcı scope');
    expect(admin).toContain('scope.used_today');
    expect(admin).toContain('scope.daily_limit');
    expect(admin).toContain('scope.percent_used_today');
    expect(admin).toContain('scope.state');
  });
});
