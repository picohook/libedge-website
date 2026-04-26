/**
 * workers/proxy/src/egress-client.js
 *
 * Proxy Worker → ra-egress agent HMAC imzalı çağrı.
 * §10.4 Worker → Agent kontratına uyar.
 *
 * Agent endpoint: POST {egress_endpoint}/proxy
 * Headers:
 *   X-RA-Target-URL   gerçek publisher URL'i
 *   X-RA-Method       GET/POST/...
 *   X-RA-Timestamp    unix seconds
 *   X-RA-Signature    hex HMAC-SHA256(secret, `${method}|${url}|${ts}|${bodyhash}`)
 *   (diğer header'lar — Cookie, User-Agent, Accept — pass-through)
 */

import { hmacSha256, sha256, decryptCredential } from '../../../backend/src/ra/crypto.js';

const RETRYABLE_STATUS_CODES = new Set([502, 503, 504]);

/**
 * @param {any} env Worker env
 * @param {string} institutionId
 * @param {URL | string} targetUrl publisher origin URL
 * @param {RequestInit & { body?: BodyInit | null }} init
 * @returns {Promise<Response>} upstream response (streaming)
 */
export async function egressFetch(env, institutionId, targetUrl, init = {}) {
  const settings = await loadInstitutionRaSettings(env.DB, institutionId);
  if (!settings || !settings.enabled) {
    throw new Error(`egress not configured for institution ${institutionId}`);
  }
  if (!settings.egress_endpoint) {
    throw new Error('egress_endpoint missing');
  }

  // Secret resolution priority:
  //   1. D1 egress_secret_enc (AES-GCM encrypted, per-institution) — production
  //   2. RA_EGRESS_DEFAULT_SECRET env var (plaintext, single-tenant/staging fallback)
  let secret;
  if (settings.egress_secret_enc && env.RA_CREDS_MASTER_KEY) {
    secret = await decryptCredential(settings.egress_secret_enc, env.RA_CREDS_MASTER_KEY);
  } else if (env.RA_EGRESS_DEFAULT_SECRET) {
    secret = env.RA_EGRESS_DEFAULT_SECRET;
  } else {
    throw new Error('no egress secret configured (set egress_secret_enc in D1 or RA_EGRESS_DEFAULT_SECRET)');
  }

  const method = (init.method || 'GET').toUpperCase();
  const urlStr = typeof targetUrl === 'string' ? targetUrl : targetUrl.toString();
  const ts = Math.floor(Date.now() / 1000);

  // Body hash (stream'lenebilir body için biraz dikkat — init.body bir Uint8Array
  // veya string olduğunda tek passta hash'liyoruz. ReadableStream ise egress
  // agent tarafında boundary olur — POC'de büyük body beklemiyoruz)
  let bodyBytes = null;
  if (init.body != null) {
    if (typeof init.body === 'string') {
      bodyBytes = new TextEncoder().encode(init.body);
    } else if (init.body instanceof ArrayBuffer) {
      bodyBytes = new Uint8Array(init.body);
    } else if (init.body instanceof Uint8Array) {
      bodyBytes = init.body;
    } else {
      // ReadableStream veya FormData — POC'de desteksiz, toArray yapalım
      const resp = new Response(init.body);
      bodyBytes = new Uint8Array(await resp.arrayBuffer());
    }
  }
  const bodyHash = bodyBytes && bodyBytes.byteLength ? await sha256(bodyBytes) : '';

  const sig = await hmacSha256(
    secret,
    `${method}|${urlStr}|${ts}|${bodyHash}`
  );

  const agentUrl = `${settings.egress_endpoint.replace(/\/$/, '')}/proxy`;

  const headers = new Headers(init.headers || undefined);
  headers.set('X-RA-Target-URL', urlStr);
  headers.set('X-RA-Method', method);
  headers.set('X-RA-Timestamp', String(ts));
  headers.set('X-RA-Signature', sig);

  const maxAttempts = isRetryableMethod(method) ? 2 : 1;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const resp = await fetch(agentUrl, {
        method: 'POST',
        headers,
        body: bodyBytes,
        // Timeout'u Cloudflare Workers zaten 30s CPU ile sınırlar; fetch()
        // network timeout'u ayrıca yok — önemliyse AbortController ile sar.
      });

      if (
        attempt < maxAttempts &&
        RETRYABLE_STATUS_CODES.has(resp.status)
      ) {
        await sleep(150 * attempt);
        continue;
      }

      return resp;
    } catch (err) {
      lastError = err;
      if (attempt >= maxAttempts) throw err;
      await sleep(150 * attempt);
    }
  }

  throw lastError || new Error('egress fetch failed');
}

async function loadInstitutionRaSettings(db, institutionId) {
  return await db
    .prepare(
      `SELECT egress_endpoint, egress_secret_enc, enabled, tunnel_status
       FROM institution_ra_settings WHERE institution_id = ?`
    )
    .bind(institutionId)
    .first();
}

function isRetryableMethod(method) {
  return method === 'GET' || method === 'HEAD';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
