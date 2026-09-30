import { Hono } from 'hono';
import { requireAuth } from '../auth/middleware.js';
import { orchestrateResearchAnswer } from '../research/assistant-orchestrator.js';
import { createBedrockModelAdapter } from './bedrock-model-adapter.js';
import { recordAssistantOutcome } from './telemetry.js';
import { createSupportCheck } from './support-check-client.js';
import { supportCheckRuntimePause } from './support-check-runtime-pause.js';
import { requireResearchAccess } from '../research/entitlement.js';

const app = new Hono();

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
  if (!access.ok) return c.json({ ok: false, error: access.error, code: access.code, claims: [], evidence: [] }, access.status);

  const providerGate = providerGateFromEnv(c.env);
  const modelAdapter = providerGate.status === 'PASS'
    ? createBedrockModelAdapter(c.env)
    : null;

  const runtimePause = await supportCheckRuntimePause(c.env);
  const supportCheck = runtimePause.paused ? null : createSupportCheck(c.env);

  const result = await orchestrateResearchAnswer({
    query,
    env: c.env,
    providerGate,
    modelAdapter,
    supportCheck
  });

  recordAssistantOutcome(c.env, { code: result?.code, durationMs: Date.now() - startedAt, errorClass: result?.diagnostic_error_class, diagnosticReason: result?.diagnostic_reason });
  if (result && 'diagnostic_error_class' in result) delete result.diagnostic_error_class;
  if (result && 'diagnostic_reason' in result) delete result.diagnostic_reason;
  return c.json(result, 200);
});

export function handleAssistantRequest(request, env, ctx) {
  return app.fetch(request, env, ctx);
}

export { app as assistantApp };
