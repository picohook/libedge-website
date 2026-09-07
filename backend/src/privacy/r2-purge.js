const PRIVACY_PURGE_PREFIXES = ['ticket-attachments/'];
const PRIVACY_PURGE_BATCH_SIZE = 25;

function derivePrivacyPurgeKey(rawValue) {
  const raw = String(rawValue || '').trim();
  if (!raw) return null;

  let key = raw;
  const marker = '/api/files/';
  const markerIndex = raw.indexOf(marker);
  if (markerIndex >= 0) key = raw.slice(markerIndex + marker.length);

  try {
    key = decodeURIComponent(key);
  } catch (_) {
    // Keep the original key if it is not URI encoded.
  }

  if (!PRIVACY_PURGE_PREFIXES.some((prefix) => key.startsWith(prefix))) return null;
  return key;
}

export async function purgePrivacyR2Queue(env) {
  if (!env?.DB || !env?.FILES_BUCKET) return;

  let rows;
  try {
    const result = await env.DB.prepare(`
      SELECT id, object_url
      FROM privacy_r2_purge_queue
      WHERE purged_at IS NULL
      ORDER BY requested_at ASC, id ASC
      LIMIT ?
    `).bind(PRIVACY_PURGE_BATCH_SIZE).all();
    rows = result.results || [];
  } catch (err) {
    // Migration 0047 may not be applied yet. Keep cron harmless until it is.
    const message = String(err?.message || err || '');
    if (message.toLowerCase().includes('no such table')) return;
    console.error('privacy R2 purge queue read failed', message);
    return;
  }

  for (const row of rows) {
    const key = derivePrivacyPurgeKey(row.object_url);
    if (!key) {
      await env.DB.prepare(`
        UPDATE privacy_r2_purge_queue
        SET last_error = ?
        WHERE id = ? AND purged_at IS NULL
      `).bind('Rejected unmanaged R2 key', row.id).run().catch(() => {});
      continue;
    }

    try {
      await env.FILES_BUCKET.delete(key);
      await env.DB.prepare(`
        UPDATE privacy_r2_purge_queue
        SET purged_at = CURRENT_TIMESTAMP, last_error = NULL
        WHERE id = ?
      `).bind(row.id).run();
    } catch (err) {
      const message = String(err?.message || err || 'R2 purge failed').slice(0, 500);
      console.error('privacy R2 purge failed', key, message);
      await env.DB.prepare(`
        UPDATE privacy_r2_purge_queue
        SET last_error = ?
        WHERE id = ? AND purged_at IS NULL
      `).bind(message, row.id).run().catch(() => {});
    }
  }
}

export { derivePrivacyPurgeKey };
