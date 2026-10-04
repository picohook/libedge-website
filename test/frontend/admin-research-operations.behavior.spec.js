import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const rootDir = path.resolve('.');
let server;
let baseURL;

test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const filePath = path.join(rootDir, url.pathname === '/' ? 'admin.html' : url.pathname.replace(/^\//, ''));
    try {
      const body = await readFile(filePath);
      const contentType = filePath.endsWith('.html') ? 'text/html; charset=utf-8' : filePath.endsWith('.css') ? 'text/css; charset=utf-8' : filePath.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/plain';
      res.writeHead(200, { 'content-type': contentType });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${server.address().port}`;
});

test.afterAll(async () => {
  await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
});

test('Research operations center renders outcome, pipeline and account controls in a real browser', async ({ page }) => {
  await page.route('**/api/user/profile', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, role: 'super_admin', full_name: 'Test Super Admin', email: 'admin@example.test' }) });
  });
  await page.route('**/api/admin/research/usage?**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      window_days: 30,
      summary: { requests: 2, successes: 1, verified_rate: 0.5, valid_empty: 1, valid_empty_rate: 0.5, failures: 0, failure_rate: 0, avg_latency_ms: 1200, input_tokens: 100, output_tokens: 20, llm_cost_usd: 0.012345, discovery_cost_usd: 0.001234, outcome_count_consistent: true, stage_latency_ms: {} },
      outcomes: [], users: [], institutions: []
    }) });
  });
  await page.goto(`${baseURL}/admin.html`);
  await expect(page.locator('#authGate')).toBeVisible();
  const research = page.locator('#tab-research');
  await research.evaluate((el) => el.classList.remove('hidden'));

  await expect(research.getByText('Research Operasyon Merkezi')).toBeVisible();
  await expect(research.getByText('Verified yanıt', { exact: true })).toBeVisible();
  await expect(research.getByText('Geçerli boş / bulgu yok')).toBeVisible();
  await expect(research.getByText('Kurum Bazlı Kullanım')).toBeVisible();
  await expect(research.getByText('Kişi Bazlı Kullanım')).toBeVisible();
  await expect(research.getByText('Usage & Cost')).toBeVisible();
  await expect(research.getByText('Pipeline Funnel & Latency')).toBeVisible();
  await expect(research.locator('#researchUsageExactCost')).toBeVisible();
  await research.locator('#researchUsageDays').selectOption('7');
  await expect(research.locator('#researchUsageExactCost')).toHaveText('$0.013579');
  await expect(research.locator('#researchUsageUsersPanel')).toBeHidden();
  await research.locator('#researchUsageUsersTab').click();
  await expect(research.locator('#researchUsageUsersPanel')).toBeVisible();
  await expect(research.locator('#researchUsageInstitutionsPanel')).toBeHidden();
  await expect(research.locator('#researchCheckerPauseBtn')).toBeVisible();
  await expect(research.locator('#researchCheckerResumeBtn')).toBeVisible();
  await expect(research.locator('#researchCheckerResumeBtn')).toBeDisabled();
  await expect(research.locator('#researchCheckerInfrastructureState')).toHaveText('Unknown');
  await expect(research.locator('#researchOpsAlert')).toHaveAttribute('role', 'status');
  await expect(research.getByText('Assistant Request Havuzu', { exact: true })).toBeVisible();
  await expect(research.getByText('Gelişmiş kurum / B2C override')).toBeVisible();
  await expect(research.locator('#researchUsageScopeId')).toBeHidden();
  await expect(research.locator('#researchUsageScopePauseBtn')).toBeHidden();
  await expect(research.locator('#researchUsageScopeOverrideDailyLimitInput')).toBeHidden();
  await expect(research.locator('#researchUsageScopeSaveBtn')).toHaveText('Varsayılanı kaydet');
  const retrievalPanel = page.locator('section[aria-label="Research diagnostics"] #researchRetrievalExperimentPanel');
  await expect(retrievalPanel).toHaveCount(1);
  await expect(retrievalPanel).not.toHaveAttribute('open', '');
  await expect(research.locator('#researchRetrievalMode')).toBeHidden();
  await expect(research.locator('#researchVerificationBreadth')).toBeVisible();
  await expect(research.locator('#researchDiagnosticsShowZero')).not.toBeChecked();

  await page.route('**/api/admin/system-health', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      status: 'healthy', environment: 'staging',
      research_telemetry: { snapshot: { date_utc: '2026-10-04', metrics: {
        assistant_outcome_ok: 4,
        assistant_verified_claims_total: 11,
        assistant_unique_supporting_sources_total: 10,
        assistant_single_source_verified_answers: 1,
      } } },
      support_check: {
        status: 'ok', paused: false, pause_reason: null,
        daily_invocations_used: 0, daily_invocation_limit: 100, daily_invocation_limit_source: 'env',
        infrastructure: { state: 'available', stale: false, published_at: new Date().toISOString(), instance_type: 'ml.m5.large', instance_count: 1 },
      },
    }) });
  });
  await research.locator('#researchObservabilityRefreshBtn').click();
  await expect(research.locator('#researchObservabilityLastRefresh')).toContainText(/^son yenileme: \d{2}:\d{2}$/);
  await expect(research.locator('#researchBreadthVerified')).toHaveText('4 yanıt · 11 claim');
  await expect(research.locator('#researchBreadthSourcesPerAnswer')).toHaveText('2,50');
  await expect(research.locator('#researchBreadthSingleSource')).toHaveText('1 · %25,0');

  const institutionHeaders = await research.locator('#researchUsageInstitutions').locator('xpath=ancestor::table/thead').innerText();
  expect(institutionHeaders).toContain('Verified');
  expect(institutionHeaders).toContain('Boş');
  expect(institutionHeaders).toContain('Hata');
  expect(institutionHeaders).toContain('Research seat');
  expect(institutionHeaders).toContain('Bugünkü ortak havuz');

  const userHeaders = await research.locator('#researchUsageUsers').locator('xpath=ancestor::table/thead').innerText();
  expect(userHeaders).toContain('Kişi');
  expect(userHeaders).toContain('Kurum / scope');
  expect(userHeaders).toContain('Verified');
  expect(userHeaders).toContain('Boş');
  expect(userHeaders).toContain('Hata');


  await page.route('**/api/admin/system-health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'healthy',
        environment: 'staging',
        research_telemetry: { snapshot: { date_utc: '2026-10-04', metrics: {} } },
        support_check: {
          status: 'ok',
          paused: true,
          pause_reason: 'OPERATIONALLY_PAUSED',
          daily_invocations_used: 0,
          daily_invocation_limit: 100,
          daily_invocation_limit_source: 'env',
          infrastructure: {
            state: 'available',
            stale: false,
            published_at: new Date().toISOString(),
            instance_type: 'ml.m5.large',
            instance_count: 1,
          },
        },
      }),
    });
  });
  await research.locator('#researchObservabilityRefreshBtn').click();
  await expect(research.locator('#researchCheckerInfrastructureState')).toHaveText('Available');
  await expect(research.locator('#researchCheckerState')).toHaveText('Paused');
  await expect(research.locator('#researchCheckerResumeBtn')).toBeEnabled();
  await expect(research.locator('#researchCheckerInfrastructureDetail')).toContainText('Paused by operator');

  await page.route('**/api/admin/system-health', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      status: 'healthy', environment: 'staging',
      research_telemetry: { snapshot: { date_utc: '2026-10-04', metrics: {} } },
      support_check: {
        status: 'ok', paused: false, pause_reason: null,
        daily_invocations_used: 0, daily_invocation_limit: 100, daily_invocation_limit_source: 'env',
        infrastructure: { state: 'available', stale: false, published_at: new Date().toISOString(), instance_type: 'ml.m5.large', instance_count: 1 },
      },
    }) });
  });
  await research.locator('#researchObservabilityRefreshBtn').click();
  await expect(research.locator('#researchCheckerInfrastructureState')).toHaveText('Available');
  await expect(research.locator('#researchCheckerState')).toHaveText('Running');
  await expect(research.locator('#researchCheckerResumeBtn')).toBeDisabled();
  await page.route('**/api/admin/system-health', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      status: 'healthy', environment: 'staging',
      research_telemetry: { snapshot: { date_utc: '2026-10-04', metrics: {} } },
      support_check: {
        status: 'ok', paused: false, pause_reason: null,
        daily_invocations_used: 0, daily_invocation_limit: 100, daily_invocation_limit_source: 'env',
        infrastructure: { state: 'unavailable', stale: false, published_at: new Date().toISOString(), instance_type: null, instance_count: null },
      },
    }) });
  });
  await research.locator('#researchObservabilityRefreshBtn').click();
  await expect(research.locator('#researchCheckerInfrastructureState')).toHaveText('Unavailable');
  await expect(research.locator('#researchCheckerState')).toHaveText('Running · etkisiz');
  await expect(research.locator('#researchCheckerFreshness')).toBeHidden();
  await expect(research.locator('#researchCheckerResumeBtn')).toBeDisabled();

  await page.route('**/api/admin/system-health', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      status: 'healthy', environment: 'staging',
      research_telemetry: { snapshot: { date_utc: '2026-10-04', metrics: {} } },
      support_check: {
        status: 'ok', paused: false, pause_reason: null,
        daily_invocations_used: 0, daily_invocation_limit: 100, daily_invocation_limit_source: 'env',
        infrastructure: { state: 'unknown', stale: false, published_at: null, instance_type: null, instance_count: null },
      },
    }) });
  });
  await research.locator('#researchObservabilityRefreshBtn').click();
  await expect(research.locator('#researchCheckerInfrastructureState')).toHaveText('Unknown');
  await expect(research.locator('#researchCheckerState')).toHaveText('Running · etkisiz');
  await expect(research.locator('#researchCheckerResumeBtn')).toBeDisabled();

  await page.route('**/api/admin/system-health', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      status: 'healthy', environment: 'staging',
      research_telemetry: { snapshot: { date_utc: '2026-10-04', metrics: {
        assistant_outcome_ok: 0,
        assistant_verified_claims_total: 0,
        assistant_unique_supporting_sources_total: 0,
        assistant_single_source_verified_answers: 0,
      } } },
      support_check: {
        status: 'ok', paused: false, pause_reason: null,
        daily_invocations_used: 0, daily_invocation_limit: 100, daily_invocation_limit_source: 'env',
        infrastructure: { state: 'unknown', stale: false, published_at: null, instance_type: null, instance_count: null },
      },
    }) });
  });
  await research.locator('#researchObservabilityRefreshBtn').click();
  await expect(research.locator('#researchBreadthSourcesPerAnswer')).toHaveText('—');
  await expect(research.locator('#researchBreadthSingleSource')).toHaveText('0 · —');
  await expect(research.locator('#researchGroundingRows')).toContainText('Bu görünümde sıfırdan farklı kayıt yok.');
  await research.locator('#researchDiagnosticsShowZero').check();
  await expect(research.locator('#researchGroundingRows')).toContainText('Claim metni eksik');
  await expect(research.locator('#researchGroundingRows')).toContainText('0');
  await expect(research.locator('#researchCheckerFreshness')).toBeHidden();
  await page.route('**/api/admin/system-health', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      status: 'healthy', environment: 'staging',
      research_telemetry: { snapshot: { date_utc: '2026-10-04', metrics: {} } },
      support_check: {
        status: 'ok', paused: false, pause_reason: null,
        daily_invocations_used: 0, daily_invocation_limit: 100, daily_invocation_limit_source: 'env',
        infrastructure: { state: 'unknown', stale: true, published_at: null, instance_type: null, instance_count: null },
      },
    }) });
  });
  await research.locator('#researchObservabilityRefreshBtn').click();
  await expect(research.locator('#researchCheckerFreshness')).toBeVisible();

  await expect(research.locator('#researchVerificationBreadth')).not.toContainText('NaN');

});
