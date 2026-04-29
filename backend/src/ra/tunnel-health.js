import { ensureRemoteAccessSchema } from './schema.js';

export async function runTunnelHeartbeat(env, { limit = 25 } = {}) {
  if (!env?.DB) return { checked: 0 };
  await ensureRemoteAccessSchema(env.DB);

  const rows = await env.DB.prepare(
    `SELECT institution_id, egress_endpoint
       FROM institution_ra_settings
      WHERE enabled = 1
        AND egress_endpoint IS NOT NULL
        AND TRIM(egress_endpoint) != ''
      ORDER BY COALESCE(tunnel_last_seen, 0) ASC
      LIMIT ?`
  ).bind(limit).all();

  const now = Math.floor(Date.now() / 1000);
  let checked = 0;
  let okCount = 0;

  for (const row of rows.results || []) {
    const institutionId = Number(row.institution_id);
    if (!institutionId) continue;

    const health = await checkEgressHealth(row.egress_endpoint, { timeoutMs: 5000 });
    checked += 1;
    if (health.ok) okCount += 1;

    await env.DB.prepare(
      `UPDATE institution_ra_settings
          SET tunnel_status = ?,
              tunnel_last_seen = CASE WHEN ? = 1 THEN ? ELSE tunnel_last_seen END,
              updated_at = ?
        WHERE institution_id = ?`
    ).bind(
      health.ok ? 'ok' : 'error',
      health.ok ? 1 : 0,
      now,
      now,
      institutionId
    ).run();
  }

  return { checked, ok: okCount, error: checked - okCount };
}

export async function checkEgressHealth(endpoint, { timeoutMs = 8000, fetchImpl = fetch } = {}) {
  const healthUrl = `${String(endpoint || '').replace(/\/$/, '')}/health`;
  const start = Date.now();
  let status = 0;
  let body = '';
  let error = null;

  try {
    const init = { method: 'GET', redirect: 'manual' };
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      init.signal = AbortSignal.timeout(timeoutMs);
    }
    const resp = await fetchImpl(healthUrl, init);
    status = resp.status;
    body = (await resp.text()).slice(0, 256);
  } catch (err) {
    error = String(err && err.message ? err.message : err);
  }

  return {
    ok: status === 200 && !error,
    status,
    latency_ms: Date.now() - start,
    body,
    error,
    tested_url: healthUrl,
  };
}
