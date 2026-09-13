import { Hono } from 'hono';
import { requireAuth } from '../auth/middleware.js';
import { orchestrateResearchAnswer } from '../research/assistant-orchestrator.js';

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

  const result = await orchestrateResearchAnswer({
    query,
    env: c.env,
    providerGate: providerGateFromEnv(c.env)
    // Intentionally no modelAdapter. A future provider integration requires a
    // separate, reviewed change after the Provider Privacy Gate reaches PASS.
  });

  return c.json(result, 200);
});

export function handleAssistantRequest(request, env, ctx) {
  return app.fetch(request, env, ctx);
}

export { app as assistantApp };
