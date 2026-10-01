import { decryptAssistantHistory, encryptAssistantHistory } from './history-crypto.js';

export const ASSISTANT_HISTORY_RETENTION_DAYS = 90;

function positiveId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function saveAssistantHistory(env, userId, query, result) {
  const uid = positiveId(userId);
  if (!uid || !env?.DB || result?.code !== 'OK') return false;
  const secret = env.ASSISTANT_HISTORY_ENCRYPTION_SECRET;
  if (!secret) {
    console.warn('assistant history disabled: encryption secret missing');
    return false;
  }
  try {
    const [queryCiphertext, resultCiphertext] = await Promise.all([
      encryptAssistantHistory(query, secret),
      encryptAssistantHistory(JSON.stringify(result), secret)
    ]);
    await env.DB.prepare(`
      INSERT INTO assistant_saved_queries
        (user_id, query_ciphertext, result_ciphertext, outcome_code, visibility, expires_at)
      VALUES (?, ?, ?, 'OK', 'private', datetime('now', '+90 days'))
    `).bind(uid, queryCiphertext, resultCiphertext).run();
    return true;
  } catch (error) {
    console.warn('assistant history write failed', error);
    return false;
  }
}

export async function listAssistantHistory(env, userId) {
  const uid = positiveId(userId);
  if (!uid || !env?.DB || !env.ASSISTANT_HISTORY_ENCRYPTION_SECRET) return [];
  const rows = await env.DB.prepare(`
    SELECT id, query_ciphertext, outcome_code, created_at, expires_at
      FROM assistant_saved_queries
     WHERE user_id = ? AND visibility = 'private' AND expires_at > datetime('now')
     ORDER BY created_at DESC LIMIT 50
  `).bind(uid).all();
  const items = [];
  for (const row of rows?.results || []) {
    try {
      items.push({
        id: row.id,
        query: await decryptAssistantHistory(row.query_ciphertext, env.ASSISTANT_HISTORY_ENCRYPTION_SECRET),
        outcome_code: row.outcome_code,
        created_at: row.created_at,
        expires_at: row.expires_at
      });
    } catch (error) {
      console.warn('assistant history row decrypt failed', error);
    }
  }
  return items;
}

export async function getAssistantHistory(env, userId, id) {
  const uid = positiveId(userId);
  const historyId = positiveId(id);
  if (!uid || !historyId || !env?.DB || !env.ASSISTANT_HISTORY_ENCRYPTION_SECRET) return null;
  const row = await env.DB.prepare(`
    SELECT id, query_ciphertext, result_ciphertext, outcome_code, created_at, expires_at
      FROM assistant_saved_queries
     WHERE id = ? AND user_id = ? AND visibility = 'private' AND expires_at > datetime('now')
     LIMIT 1
  `).bind(historyId, uid).first();
  if (!row) return null;
  return {
    id: row.id,
    query: await decryptAssistantHistory(row.query_ciphertext, env.ASSISTANT_HISTORY_ENCRYPTION_SECRET),
    result: JSON.parse(await decryptAssistantHistory(row.result_ciphertext, env.ASSISTANT_HISTORY_ENCRYPTION_SECRET)),
    outcome_code: row.outcome_code,
    created_at: row.created_at,
    expires_at: row.expires_at
  };
}

export async function deleteAssistantHistory(env, userId, id) {
  const uid = positiveId(userId);
  const historyId = positiveId(id);
  if (!uid || !historyId || !env?.DB) return false;
  const result = await env.DB.prepare(
    'DELETE FROM assistant_saved_queries WHERE id = ? AND user_id = ?'
  ).bind(historyId, uid).run();
  return Number(result?.meta?.changes || 0) > 0;
}

export async function pruneAssistantHistory(env) {
  if (!env?.DB) return false;
  try {
    await env.DB.prepare(
      "DELETE FROM assistant_saved_queries WHERE expires_at <= datetime('now')"
    ).run();
    return true;
  } catch (error) {
    console.warn('assistant history prune failed', error);
    return false;
  }
}
