import worker from './index.js';
import { purgePrivacyR2Queue } from './privacy/r2-purge.js';

export default {
  fetch: worker.fetch,
  request: worker.request,
  scheduled(event, env, ctx) {
    if (typeof worker.scheduled === 'function') {
      worker.scheduled(event, env, ctx);
    }
    ctx.waitUntil(purgePrivacyR2Queue(env));
  },
};
