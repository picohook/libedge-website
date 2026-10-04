import { Hono } from 'hono';
import { requireAuth } from '../auth/middleware.js';
import { checkProtectedRateLimit } from '../auth/rate-limit.js';
import { orchestrateResearchAnswer } from '../research/assistant-orchestrator.js';
import { createBedrockModelAdapter } from './bedrock-model-adapter.js';
import { recordAssistantOutcome } from './telemetry.js';
import { createSupportCheck } from './support-check-client.js';
import { preflightSupportCheckInvocation } from './support-check-invocation-budget.js';
import { supportCheckRuntimePause } from './support-check-runtime-pause.js';
import { reserveAssistantUsageScopeRequest, resolveAssistantUsageScope } from './usage-scope-quota.js';
import { assistantUsageScopeState } from './usage-scope-state.js';
import { requireResearchAccess } from '../research/entitlement.js';
import { recordResearchUsageEvent } from '../research/usage-events.js';
import { positiveInt } from '../research/discover.js';
import { deleteAssistantHistory, getAssistantHistory, listAssistantHistory, sanitizeAssistantHistoryResult, saveAssistantHistory } from './history-storage.js';

const app = new Hono();
const DEFAULT_ASSISTANT_USER_LIMIT = 10;
const DEFAULT_ASSISTANT_USER_WINDOW_SECONDS = 300;

async function recordOperationalOutcome(env, user, { code, durationMs, errorClass, diagnosticReason, groundingDiagnostic, retrievalDiagnostic, stageTimings, usage, costs } = {}) {
  await Promise.all([
    recordAssistantOutcome(env, { code, durationMs, errorClass, diagnosticReason, groundingDiagnostic, retrievalDiagnostic, stageTimings }),
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
      discoveryCostUsd: costs?.discovery_cost_usd,
      retrievalDiagnostic
    })
  ]);
}

function normalizeQuery(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function safeCount(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : 0;
}

const PUBLIC_GROUNDING_REJECTION_CODES = new Set([
  'CLAIM_TEXT_REQUIRED',
  'EVIDENCE_ID_REQUIRED',
  'EVIDENCE_ID_UNKNOWN',
  'SUPPORT_CHECK_REQUIRED',
  'SUPPORT_CHECK_BUDGET_TRUNCATED',
  'CLAIM_UNSUPPORTED',
  'SUPPORT_CHECK_FAILED',
  'CLAIM_UNSUPPORTED_SUPPORT',
  'CLAIM_UNSUPPORTED_NOT_SUPPORTED',
  'CLAIM_UNSUPPORTED_UNSUPPORTED',
  'SUPPORT_CHECK_FAILED_TIMEOUT',
  'SUPPORT_CHECK_FAILED_BUDGET',
  'SUPPORT_CHECK_FAILED_LANGUAGE',
  'SUPPORT_CHECK_FAILED_LANGUAGE_CLAIM',
  'SUPPORT_CHECK_FAILED_LANGUAGE_EVIDENCE',
  'SUPPORT_CHECK_FAILED_LANGUAGE_CLAIM',
  'SUPPORT_CHECK_FAILED_LANGUAGE_EVIDENCE',
  'SUPPORT_CHECK_FAILED_PIN_OR_RESPONSE',
  'SUPPORT_CHECK_FAILED_TRANSPORT_OR_OTHER'
]);

function publicGroundingRejectionCounts(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const counts = {};
  for (const [code, amount] of Object.entries(value)) {
    if (!PUBLIC_GROUNDING_REJECTION_CODES.has(code)) continue;
    const count = Number(amount);
    if (Number.isSafeInteger(count) && count > 0) counts[code] = count;
  }
  return counts;
}

export function publicResearchSummary(result = {}) {
  const retrieval = result?.diagnostic_retrieval || {};
  const grounding = result?.diagnostic_grounding || {};
  return {
    literature: {
      retrieved_count: safeCount(retrieval.retrieved_count),
      authorized_relevant_count: safeCount(retrieval.authorized_relevant_count),
      abstract_bearing_count: safeCount(retrieval.abstract_bearing_count),
      metadata_only_count: safeCount(retrieval.metadata_only_count)
    },
    verification: {
      checked_count: safeCount(grounding.checked_count),
      verified_count: Array.isArray(result?.claims) ? result.claims.length : 0,
      truncated_count: safeCount(grounding.truncated_count),
      rejection_counts: publicGroundingRejectionCounts(grounding.rejection_counts)
    }
  };
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

  const usageScope = resolveAssistantUsageScope(auth.user, access.entitlementSource);
  const usageScopeState = await assistantUsageScopeState(c.env, usageScope);
  if (!usageScopeState.active) {
    await recordOperationalOutcome(c.env, auth.user, { code: usageScopeState.reason, durationMs: Date.now() - startedAt });
    const paused = usageScopeState.reason === 'ASSISTANT_USAGE_SCOPE_PAUSED';
    return c.json({
      ok: false,
      error: paused ? 'Assistant bu hesap için geçici olarak duraklatıldı' : 'Assistant kullanım durumu şu anda doğrulanamıyor',
      code: usageScopeState.reason,
      claims: [],
      evidence: []
    }, paused ? 403 : 503);
  }

  const usageScopeQuota = await reserveAssistantUsageScopeRequest(c.env, auth.user, access.entitlementSource);
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

  await recordOperationalOutcome(c.env, auth.user, { code: result?.code, durationMs: Date.now() - startedAt, errorClass: result?.diagnostic_error_class, diagnosticReason: result?.diagnostic_reason, groundingDiagnostic: result?.diagnostic_grounding, retrievalDiagnostic: result?.diagnostic_retrieval, stageTimings: result?.diagnostic_timings, usage: result?.diagnostic_usage, costs: result?.diagnostic_costs });
  result.research_summary = publicResearchSummary(result);
  if (result?.code === 'OK') {
    await saveAssistantHistory(c.env, auth.user?.user_id, query, result);
  }
  return c.json(sanitizeAssistantHistoryResult(result), 200);
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
