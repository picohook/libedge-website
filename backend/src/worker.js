import worker from './index.js';
import { purgePrivacyR2Queue } from './privacy/r2-purge.js';
import { handleSystemHealthRequest } from './system-health.js';
import { handleResearchRequest } from './research/router.js';
export { OpenAlexSemanticPacer } from './research/semantic-pacer.js';

// Research metadata may be cached server-side in KV using hashed, user-independent
// keys to reduce provider cost. Authenticated HTTP responses are intentionally
// private/no-store so browsers and intermediary caches do not retain user requests.
function privateNoStore(response) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/admin/system-health' && request.method === 'GET') {
      return handleSystemHealthRequest(request, env);
    }
    if (url.pathname === '/api/research/search' && request.method === 'GET') {
      return privateNoStore(await handleResearchRequest(request, env, ctx));
    }
    return worker.fetch(request, env, ctx);
  },
  request: worker.request,
  scheduled(event, env, ctx) {
    if (typeof worker.scheduled === 'function') {
      worker.scheduled(event, env, ctx);
    }
    ctx.waitUntil(purgePrivacyR2Queue(env));
  },
};