const MIN_START_INTERVAL_MS = 1500;
const GLOBAL_PACER_NAME = 'openalex-semantic-global';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

export class OpenAlexSemanticPacer {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.tail = Promise.resolve();
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/gate') {
      return json({ error: 'NOT_FOUND' }, 404);
    }

    const task = this.tail.then(async () => {
      const now = Date.now();
      const stored = Number(await this.ctx.storage.get('last_start_ms'));
      const lastStartMs = Number.isFinite(stored) ? stored : 0;
      const waitMs = Math.max(0, MIN_START_INTERVAL_MS - (now - lastStartMs));
      if (waitMs > 0) await sleep(waitMs);
      const grantedAtMs = Date.now();
      await this.ctx.storage.put('last_start_ms', grantedAtMs);
      return { grantedAtMs, waitMs };
    });

    this.tail = task.catch(() => {});

    try {
      return json(await task);
    } catch {
      return json({ error: 'SEMANTIC_PACING_GATE_FAILED' }, 503);
    }
  }
}

export async function acquireSemanticPacing(env) {
  if (!env.OPENALEX_SEMANTIC_PACER) {
    const error = new Error('OPENALEX_SEMANTIC_PACING_UNAVAILABLE');
    error.code = 'OPENALEX_SEMANTIC_PACING_UNAVAILABLE';
    throw error;
  }

  try {
    const id = env.OPENALEX_SEMANTIC_PACER.idFromName(GLOBAL_PACER_NAME);
    const stub = env.OPENALEX_SEMANTIC_PACER.get(id);
    const response = await stub.fetch('https://semantic-pacer/gate', { method: 'POST' });
    if (!response.ok) throw new Error('gate rejected');
    const payload = await response.json();
    if (!Number.isFinite(Number(payload?.grantedAtMs))) throw new Error('invalid gate response');
    return {
      grantedAtMs: Number(payload.grantedAtMs),
      waitMs: Number.isFinite(Number(payload?.waitMs)) ? Number(payload.waitMs) : 0
    };
  } catch {
    const error = new Error('OPENALEX_SEMANTIC_PACING_UNAVAILABLE');
    error.code = 'OPENALEX_SEMANTIC_PACING_UNAVAILABLE';
    throw error;
  }
}
