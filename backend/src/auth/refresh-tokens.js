import { sign } from 'hono/jwt';
import { generateSecureTokenHex, hashTokenValue } from './security.js';
import { isStrictRateLimitEnv } from './rate-limit.js';

export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export async function ensureRefreshTokensSchema(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      issued_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at INTEGER,
      revoked_at INTEGER,
      replaced_by_hash TEXT,
      ip TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_active
    ON refresh_tokens(user_id, revoked_at, used_at, expires_at)
  `);
}

export async function createRefreshToken(c, db, userId, secret) {
  if (!isStrictRateLimitEnv(c.env)) {
    await ensureRefreshTokensSchema(db);
  }
  const now = Math.floor(Date.now() / 1000);
  const jti = generateSecureTokenHex(24);
  const tokenHash = await hashTokenValue(jti);
  const payload = {
    user_id: userId,
    type: 'refresh',
    jti,
    iat: now,
    exp: now + REFRESH_TOKEN_TTL_SECONDS
  };
  const token = await sign(payload, secret);
  await db.prepare(`
    INSERT INTO refresh_tokens (user_id, token_hash, issued_at, expires_at, ip, user_agent)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    userId,
    tokenHash,
    now,
    payload.exp,
    extractClientIp(c),
    String(c.req.header('user-agent') || '').slice(0, 500)
  ).run();
  return { token, payload, tokenHash };
}

export async function createLoginRefreshToken(c, db, userId, secret) {
  try {
    return await createRefreshToken(c, db, userId, secret);
  } catch (err) {
    console.error('DB-backed refresh token creation failed; falling back to stateless refresh token', err);
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      user_id: userId,
      type: 'refresh',
      iat: now,
      exp: now + REFRESH_TOKEN_TTL_SECONDS
    };
    const token = await sign(payload, secret);
    return { token, payload, tokenHash: null };
  }
}

export async function markRefreshTokenUsed(db, tokenHash, replacedByHash = null) {
  if (!tokenHash) return;
  const now = Math.floor(Date.now() / 1000);
  await db.prepare(`
    UPDATE refresh_tokens
    SET used_at = COALESCE(used_at, ?),
        replaced_by_hash = COALESCE(replaced_by_hash, ?)
    WHERE token_hash = ?
  `).bind(now, replacedByHash, tokenHash).run();
}

export async function revokeRefreshTokenFamily(db, userId) {
  const now = Math.floor(Date.now() / 1000);
  await db.prepare(`
    UPDATE refresh_tokens
    SET revoked_at = COALESCE(revoked_at, ?)
    WHERE user_id = ? AND revoked_at IS NULL
  `).bind(now, userId).run();
}

function extractClientIp(c) {
  const fwd = c.req.header('cf-connecting-ip') ||
              c.req.header('CF-Connecting-IP') ||
              c.req.header('x-forwarded-for') ||
              '';
  return String(fwd).split(',')[0].trim() || 'unknown';
}
