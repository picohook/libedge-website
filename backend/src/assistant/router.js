import { Hono } from 'hono';
import { requireAuth } from '../auth/middleware.js';
import { checkProtectedRateLimit } from '../auth/rate-limit.js';
import { orchestrateResearchAnswer } from '../research/assistant-orchestrator.js';
import { createBedrockModelAdapter } from './bedrock-model-adapter.js';
import { recordAssistantOutcome } from './telemetry.js';
import { createSupportCheck } from './support-check-client.js';
import { preflightSupportCheckInvocation } from './support-check-invocation-budget.js';
import { supportCheckRuntimePause } from './support-check-runtime-pause.js';
import { reserveAssistantUsageScopeRequest } from './usage-scope-quota.js';
import { requireResearchAccess } from '../research/entitlement.js';
import { recordResearchUsageEvent } from '../research/usage-events.js';
import { positiveInt } from '../research/discover.js';
import { deleteAssistantHistory, getAssistantHistory, listAssistantHistory, saveAssistantHistory } from './history-storage.js';

const app = new Hono();
const DEFAULT_ASSISTANT_USER_LIMIT = 10;
const DEFAULT_ASSISTANT_USER_WINDOW_SECONDS = 300;

async function recordOperationalOutcome(env, user, { code, durationMs, errorClass, diagnosticReason, groundingDiagnostic, stageTimings, usage, costs } = {}) {
  await Promise.all([
    recordAssistantOutcome(env, { code, durationMs, errorClass, diagnosticReason, groundingDiagnostic, stageTimings }),
    recordResearchUsageEvent(env, {
      userId: user?.user_id,
      institutionId: user?.institution_id,
      operation: 'assistant_ask',
      outcomeCode: code,
      latencyMs: durationMs,
      inputTokens: usage?.input_tokens,
      outputTokens: usage?.output_tokens,
      stageTimings,
      llmCostUsd: costs?.llm_cost_usd,
      discoveryCostUsd: costs?.discovery_cost_usd
    })
  ]);
}

function normalizeQuery(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function providerGateFromEnv(env) {
  return {
    status: env?.RESEARCH_ASSISTANT_PROVIDER_GATE_STATUS === 'PASS' ? 'PASS' : 'UNVERIFIED'
  };
}

app.post('/api/assistant/ask', async (c) => {
  const startedAt = Date.now();
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Geçerli bir araştırma sorgusu gerekli', code: 'ASSISTANT_QUERY_INVALID' }, 400);
  }

  const query = normalizeQuery(body?.query);
  if (query.length < 2 || query.length > 300) {
    return c.json({ error: 'Geçerli bir araştırma sorgusu gerekli', code: 'ASSISTANT_QUERY_INVALID' }, 400);
  }

  const access = await requireResearchAccess(c.env, auth.user);
  if (!access.ok) {
    await recordOperationalOutcome(c.env, auth.user, { code: access.code, durationMs: Date.now() - startedAt });
    return c.json({ ok: false, error: access.error, code: access.code, claims: [], evidence: [] }, access.status);
  }

  const identifier = auth.user?.user_id || auth.user?.sub || auth.user?.email || 'authenticated';
  const limit = positiveInt(c.env.RESEARCH_ASSISTANT_USER_RATE_LIMIT, DEFAULT_ASSISTANT_USER_LIMIT, 100);
  const windowSeconds = positiveInt(c.env.RESEARCH_ASSISTANT_USER_RATE_WINDOW_SECONDS, DEFAULT_ASSISTANT_USER_WINDOW_SECONDS, 3600);
  const quota = await checkProtectedRateLimit(c, 'assistant-ask', identifier, limit, windowSeconds);
  if (quota.isLimited) {
    await recordOperationalOutcome(c.env, auth.user, { code: 'ASSISTANT_RATE_LIMITED', durationMs: Date.now() - startedAt });
    return c.json({ ok: false, error: 'Assistant kullanım limiti aşıldı', code: 'ASSISTANT_RATE_LIMITED', claims: [], evidence: [] }, 429);
  }

  const usageScopeQuota = await reserveAssistantUsageScopeRequest(c.env, auth.user);
  if (!usageScopeQuota.allowed) {
    await recordOperationalOutcome(c.env, auth.user, { code: usageScopeQuota.reason, durationMs: Date.now() - startedAt });
    const exhausted = usageScopeQuota.reason === 'ASSISTANT_USAGE_SCOPE_QUOTA_EXHAUSTED';
    return c.json({
      ok: false,
      error: exhausted ? 'Assistant günlük ortak kullanım havuzu doldu' : 'Assistant kullanım kotası şu anda kullanılamıyor',
      code: usageScopeQuota.reason,
      claims: [],
      evidence: []
    }, exhausted ? 429 : 503);
  }

  const runtimePause = await supportCheckRuntimePause(c.env);
  if (!runtimePause.paused) {
    const budget = await preflightSupportCheckInvocation(c.env);
    if (!budget.allowed) {
      await recordOperationalOutcome(c.env, auth.user, { code: budget.reason, durationMs: Date.now() - startedAt });
      return c.json({ ok: false, error: 'Assistant doğrulama bütçesi şu anda kullanılamıyor', code: budget.reason, claims: [], evidence: [] }, 503);
    }
  }

  const providerGate = providerGateFromEnv(c.env);
  const modelAdapter = providerGate.status === 'PASS'
    ? createBedrockModelAdapter(c.env)
    : null;

  const supportCheck = runtimePause.paused ? null : createSupportCheck(c.env);

  const result = await orchestrateResearchAnswer({
    query,
    env: c.env,
    providerGate,
    modelAdapter,
    supportCheck
  });

  await recordOperationalOutcome(c.env, auth.user, { code: result?.code, durationMs: Date.now() - startedAt, errorClass: result?.diagnostic_error_class, diagnosticReason: result?.diagnostic_reason, groundingDiagnostic: result?.diagnostic_grounding, stageTimings: result?.diagnostic_timings, usage: result?.diagnostic_usage, costs: result?.diagnostic_costs });
  if (result?.code === 'OK') {
    await saveAssistantHistory(c.env, auth.user?.user_id, query, result);
  }
  if (result && 'diagnostic_error_class' in result) delete result.diagnostic_error_class;
  if (result && 'diagnostic_reason' in result) delete result.diagnostic_reason;
  if (result && 'diagnostic_grounding' in result) delete result.diagnostic_grounding;
  if (result && 'diagnostic_usage' in result) delete result.diagnostic_usage;
  if (result && 'diagnostic_timings' in result) delete result.diagnostic_timings;
  if (result && 'diagnostic_costs' in result) delete result.diagnostic_costs;
  return c.json(result, 200);
});

app.get('/api/assistant/history', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  return c.json({ items: await listAssistantHistory(c.env, auth.user?.user_id) }, 200);
});

app.get('/api/assistant/history/:id', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  try {
    const item = await getAssistantHistory(c.env, auth.user?.user_id, c.req.param('id'));
    return item ? c.json(item, 200) : c.json({ error: 'Kayıt bulunamadı', code: 'ASSISTANT_HISTORY_NOT_FOUND' }, 404);
  } catch (error) {
    console.warn('assistant history read failed', error);
    return c.json({ error: 'Geçmiş kaydı okunamadı', code: 'ASSISTANT_HISTORY_UNAVAILABLE' }, 503);
  }
});

app.delete('/api/assistant/history/:id', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  const deleted = await deleteAssistantHistory(c.env, auth.user?.user_id, c.req.param('id'));
  return deleted
    ? c.json({ ok: true }, 200)
    : c.json({ error: 'Kayıt bulunamadı', code: 'ASSISTANT_HISTORY_NOT_FOUND' }, 404);
});

export function handleAssistantRequest(request, env, ctx) {
  return app.fetch(request, env, ctx);
}

export { app as assistantApp };
