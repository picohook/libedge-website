console.log("HONO VERSION LOADED");

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCookie, setCookie } from 'hono/cookie';
import { sign, verify } from 'hono/jwt';

// ─── Remote Access (RA) modülü ─────────────────────────────────────────────
// Kurumsal publisher aboneliklerine uzaktan erişim proxy'si.
// Route handler: POST /api/ra/issue-token
// Şema guard (ALTER TABLE + CREATE TABLE IF NOT EXISTS) handler içinde çağrılır.
import { registerRaIssueToken } from './routes/ra/issue-token.js';
import { registerRaAdminTunnel } from './routes/ra/admin-tunnel.js';

const app = new Hono();

// ====================== CONFIGURATION ======================
// Ortak sabitler ve uygulama yapılandırmaları
const ALLOWED_ORIGINS = [
  'https://libedge.com',
  'https://www.libedge.com',
  'https://libedge-website.pages.dev',
  'https://staging.libedge-website.pages.dev',
];

const DEFAULT_PRODUCT_CATALOG = [
  { slug: 'pangram', name: 'Pangram', category: 'Yapay Zeka', region: 'Türkiye, Orta Doğu' },
  { slug: 'chatpdf', name: 'ChatPDF', category: 'Yapay Zeka', region: 'Türkiye, Orta Doğu' },
  { slug: 'wonders', name: 'Wonders', category: 'Yapay Zeka', region: 'Türkiye, Orta Doğu' },
  { slug: 'assistin', name: 'Assistin', category: 'Yapay Zeka', region: 'Türkiye, Orta Doğu' },
  { slug: 'primal-pictures', name: 'Primal Pictures', category: 'Sağlık', region: 'Türkiye, Orta Doğu' },
  { slug: 'lecturio', name: 'Lecturio', category: 'Sağlık', region: 'Türkiye, Orta Doğu' },
  { slug: 'nejmhealer', name: 'NEJMHealer', category: 'Sağlık', region: 'Türkiye, Orta Doğu' },
  { slug: 'imachek', name: 'ImaChek', category: 'Sağlık', region: 'Türkiye, Orta Doğu' },
  { slug: 'cochrane-library', name: 'Cochrane Library', category: 'Sağlık', region: 'Türkiye (EKUAL dışı)' },
  { slug: 'jove-research', name: 'JoVE Research', category: 'Fen & Matematik', region: 'Türkiye' },
  { slug: 'jove-education', name: 'JoVE Education', category: 'Fen & Matematik', region: 'Türkiye' },
  { slug: 'jove-business', name: 'JoVE Business', category: 'İş & Hukuk', region: 'Türkiye' },
  { slug: 'biorender', name: 'BioRender', category: 'Mühendislik', region: 'Türkiye' },
  { slug: 'wiley-journals', name: 'Wiley Dergiler', category: 'Fen & Matematik', region: 'Türkiye (EKUAL dışı)' },
  { slug: 'wiley-books', name: 'Wiley Kitaplar', category: 'Fen & Matematik', region: 'Türkiye (EKUAL dışı)' },
  { slug: 'klasik-muzik', name: 'Klasik Müzik Koleksiyonu', category: 'Sanat', region: 'Türkiye, Orta Doğu' },
  { slug: 'caz-koleksiyonu', name: 'Caz Koleksiyonu', category: 'Sanat', region: 'Türkiye, Orta Doğu' }
];

// 1. CORS Middleware (En üstte, her şeyden önce)
app.use('*', async (c, next) => {
  const fallbackOrigin =
    c.env?.ENVIRONMENT === 'production'
      ? 'https://www.libedge.com'
      : 'https://staging.libedge-website.pages.dev';

  return cors({
    origin: (origin) => {
      if (!origin) return fallbackOrigin;
      return ALLOWED_ORIGINS.includes(origin) ? origin : fallbackOrigin;
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Set-Cookie', 'Content-Length'],
    maxAge: 86400,
  })(c, next);
});

// ====================== TOKEN HELPERS ======================
// hono/jwt: sign() and verify() replace manual HS256 implementation.
// verify() throws on invalid signature or expired token (exp checked automatically).

// ====================== INPUT VALIDATION ======================

/**
 * Hafif yerel validator. Zod olmadan tip güvenli giriş doğrulaması.
 *
 * Kural tipleri:
 *   required        — null / undefined / boş string kabul etmez
 *   type            — 'string' | 'number' | 'boolean' | 'array' | 'object'
 *   integer         — Number.isInteger kontrolü (type:'number' ile birlikte)
 *   min / max       — sayı aralığı
 *   minLength / maxLength — string uzunluğu (trim sonrası)
 *   email           — basit RFC-uyumlu format
 *   enum            — allowedValues dizisinde olmalı
 *   nullable        — required ile birlikte null'a izin verir
 *
 * Döner: { ok: true } | { ok: false, errors: string[], response: Response }
 */
function validate(data, rules) {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const errors = [];

  for (const [field, checks] of Object.entries(rules)) {
    let val = data[field];

    // String ise trim et (orijinal değeri değiştirme — sadece kontrol için)
    const strVal = typeof val === 'string' ? val.trim() : val;
    const isEmpty = val === null || val === undefined || strVal === '';

    // nullable: null'a açıkça izin ver
    if (checks.nullable && val === null) continue;

    // required
    if (checks.required && isEmpty) {
      errors.push(`"${field}" zorunludur`);
      continue; // bu alan için diğer kontrolleri atla
    }

    // değer yoksa ve required değilse kontrol etme
    if (isEmpty) continue;

    // type
    if (checks.type) {
      if (checks.type === 'array') {
        if (!Array.isArray(val)) errors.push(`"${field}" dizi olmalıdır`);
      } else if (typeof val !== checks.type) {
        errors.push(`"${field}" ${checks.type} tipinde olmalıdır`);
      }
    }

    // integer
    if (checks.integer && !Number.isInteger(Number(val))) {
      errors.push(`"${field}" tam sayı olmalıdır`);
    }

    // min / max (sayılar için)
    if (checks.min !== undefined && Number(val) < checks.min) {
      errors.push(`"${field}" en az ${checks.min} olmalıdır`);
    }
    if (checks.max !== undefined && Number(val) > checks.max) {
      errors.push(`"${field}" en fazla ${checks.max} olabilir`);
    }

    // minLength / maxLength (string için, trim sonrası)
    if (typeof strVal === 'string') {
      if (checks.minLength !== undefined && strVal.length < checks.minLength) {
        errors.push(`"${field}" en az ${checks.minLength} karakter olmalıdır`);
      }
      if (checks.maxLength !== undefined && strVal.length > checks.maxLength) {
        errors.push(`"${field}" en fazla ${checks.maxLength} karakter olabilir`);
      }
    }

    // email
    if (checks.email && !EMAIL_RE.test(strVal)) {
      errors.push(`"${field}" geçerli bir e-posta adresi olmalıdır`);
    }

    // enum
    if (checks.enum && !checks.enum.includes(val)) {
      errors.push(`"${field}" şu değerlerden biri olmalıdır: ${checks.enum.join(', ')}`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true };
}

/**
 * Endpoint'lerde kısa kullanım için yardımcı.
 * Geçersizse doğrudan 400 JSON response döner, aksi hâlde body'yi verir.
 *
 * Kullanım:
 *   const body = await parseAndValidate(c, { email: { required:true, email:true }, ... });
 *   if (body instanceof Response) return body;
 */
export async function parseAndValidate(c, rules) {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Geçersiz JSON gövdesi' }, 400);
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return c.json({ error: 'İstek gövdesi bir nesne olmalıdır' }, 400);
  }
  // String alanları trim et (mutasyonlu — orijinal referans korunur)
  for (const key of Object.keys(body)) {
    if (typeof body[key] === 'string') body[key] = body[key].trim();
  }
  const result = validate(body, rules);
  if (!result.ok) {
    return c.json({ error: result.errors[0], errors: result.errors }, 400);
  }
  return body;
}

// ====================== 🆕 AUTH MIDDLEWARE (Cookie tabanlı) ======================

export async function requireAuth(c) {
  // ✅ YENİ: Proxy'den gelen Authorization header'ı da kabul et
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const secret = c.env.JWT_SECRET;
    try {
      const payload = await verify(token, secret, 'HS256');
      return { user: payload, token };
    } catch {
      return { response: c.json({ error: 'Geçersiz token' }, 401) };
    }
  }

  const token = getCookie(c, 'authToken');
  if (!token) {
    return { response: c.json({ error: 'Oturum bulunamadı' }, 401) };
  }
  const secret = c.env.JWT_SECRET;
  try {
    const payload = await verify(token, secret, 'HS256');
    return { user: payload, token };
  } catch {
    return { response: c.json({ error: 'Geçersiz veya süresi dolmuş oturum' }, 401) };
  }
}
// 🆕 Yardımcı: Mevcut kullanıcıyı al (middleware sonrası kullanılır)
async function getCurrentUser(c) {
  const auth = await requireAuth(c);
  if (auth.response) return null;
  return auth.user;
}

async function getOptionalAuth(c) {
  const authHeader = c.req.header('Authorization');
  const secret = c.env.JWT_SECRET;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = await verify(token, secret, 'HS256');
      return { user: payload, token };
    } catch {
      return null;
    }
  }

  const token = getCookie(c, 'authToken');
  if (!token) return null;

  try {
    const payload = await verify(token, secret, 'HS256');
    return { user: payload, token };
  } catch {
    return null;
  }
}


function splitFullName(fullName) {
  const cleaned = String(fullName || '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return { first_name: '', last_name: '' };

  const parts = cleaned.split(' ');
  if (parts.length === 1) {
    return { first_name: parts[0], last_name: '' };
  }

  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(' ')
  };
}

function buildFullName(firstName, lastName, fallbackFullName) {
  const joined = [firstName, lastName]
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();

  if (joined) return joined;

  const fallback = String(fallbackFullName || '').trim().replace(/\s+/g, ' ');
  return fallback || null;
}

function normalizeUserProfileFields(input = {}) {
  const fallbackNames = splitFullName(input.full_name);
  const firstName = String(input.first_name ?? fallbackNames.first_name ?? '').trim();
  const lastName = String(input.last_name ?? fallbackNames.last_name ?? '').trim();
  const title = String(input.title || '').trim();

  return {
    first_name: firstName || null,
    last_name: lastName || null,
    full_name: buildFullName(firstName, lastName, input.full_name),
    title: title || null
  };
}

function randomPassword(length = 24) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('');
}


function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanAnnouncementText(value) {
  return String(value || '').trim();
}

function parseAnnouncementPublishAt(value) {
  const raw = cleanAnnouncementText(value);
  if (!raw) return null;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString();
}

function getPollinationsKey(env) {
  return env.POLLINATIONS_API_KEY || env.POLLINATIONS_KEY || '';
}

const ALLOWED_IMAGE_MODELS = ['flux', 'flux-realism', 'flux-anime', 'flux-3d', 'turbo'];

function buildAnnouncementImageUrl(title, summary, env, options = {}) {
  const basePrompt = cleanAnnouncementText(
    `${title}. ${summary || ''}. Premium educational technology announcement cover, modern editorial layout, clean corporate composition, no readable text, photorealistic marketing image`
  ).replace(/\s+/g, ' ');

  const customPrompt = cleanAnnouncementText(options.custom_prompt);
  const prompt = customPrompt || basePrompt;
  const model = ALLOWED_IMAGE_MODELS.includes(options.model) ? options.model : 'flux';

  const url = new URL(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`);
  const apiKey = getPollinationsKey(env);
  if (apiKey) {
    url.searchParams.set('key', apiKey);
    }
  url.searchParams.set('model', model);
  url.searchParams.set('width', '1200');
  url.searchParams.set('height', '630');
  url.searchParams.set('nologo', 'true');
  url.searchParams.set('seed', String(Math.floor(Math.random() * 2147483647)));

  return {
    prompt,
    model,
    imageUrl: url.toString()
  };
}

async function callPollinationsText(prompt, env) {
  const apiKey = getPollinationsKey(env);
  const body = {
    model: 'openai',
    messages: [{ role: 'user', content: prompt }],
    jsonMode: true,
    seed: Math.floor(Math.random() * 1e9)
  };
  if (apiKey) body.key = apiKey;

  const response = await fetch('https://text.pollinations.ai/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(errBody || `Pollinations request failed with ${response.status}`);
  }

  return response.text();
}

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (_) {
  }

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch (_) {
    return null;
  }
}

async function runAnnouncementAiTask(task, payload, env) {
  const title = cleanAnnouncementText(payload.title);
  const summary = cleanAnnouncementText(payload.summary);
  const fullContent = cleanAnnouncementText(payload.full_content);
  const sourceLang = cleanAnnouncementText(payload.source_lang || 'tr');
  const targetLang = cleanAnnouncementText(payload.target_lang || 'en');

  let prompt = '';

  if (task === 'polish') {
    prompt = [
      'You are an expert announcement editor for a B2B education technology company.',
      'Rewrite the input into polished, professional Turkish.',
      'Preserve meaning, product facts, numbers, links, Markdown structure, and tone of urgency.',
      'Return ONLY valid JSON with keys: title, summary, full_content.',
      'Keep summary under 240 characters.',
      '',
      `TITLE: ${title}`,
      `SUMMARY: ${summary}`,
      `FULL_CONTENT: ${fullContent}`
    ].join('\n');
  } else if (task === 'translate') {
    prompt = [
      'You are a professional translator for product announcements.',
      `Translate the content from ${sourceLang} to ${targetLang}.`,
      'Preserve product names, Markdown formatting, links, and factual accuracy.',
      'Return ONLY valid JSON with keys: title, summary, full_content.',
      '',
      `TITLE: ${title}`,
      `SUMMARY: ${summary}`,
      `FULL_CONTENT: ${fullContent}`
    ].join('\n');
  } else {
    throw new Error('Unsupported AI task');
  }

  const responseText = await callPollinationsText(prompt, env);
  const parsed = extractJsonObject(responseText);

  if (!parsed?.title && !parsed?.summary && !parsed?.full_content) {
    throw new Error('AI response could not be parsed');
  }

  return {
    title: cleanAnnouncementText(parsed.title) || title,
    summary: cleanAnnouncementText(parsed.summary) || summary,
    full_content: cleanAnnouncementText(parsed.full_content) || fullContent
  };
}
// 🆕 Token'dan rol ve kurum bilgilerini al (eski fonksiyonlarla uyumlu)
async function getTokenPayloadFromCookie(c) {
  const auth = await requireAuth(c);
  if (auth.response) return null;
  return auth.user;
}

async function getUserRole(c) {
  const payload = await getTokenPayloadFromCookie(c);
  return payload?.role || null;
}

async function getUserInstitution(c) {
  const payload = await getTokenPayloadFromCookie(c);
  return payload?.institution || null;
}

async function getUserInstitutionId(c) {
  const payload = await getTokenPayloadFromCookie(c);
  return payload?.institution_id || null;
}

async function isSuperAdmin(c) {
  const role = await getUserRole(c);
  return role === 'super_admin';
}

async function isAdmin(c) {
  const role = await getUserRole(c);
  return role === 'admin' || role === 'super_admin';
}

const MANAGED_FILE_EXTENSIONS = new Set([
  // Görseller
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'tiff', 'tif',
  // Belgeler
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'odt', 'ods', 'odp', 'rtf', 'txt', 'csv', 'md',
  // Arşivler
  'zip', 'rar', '7z', 'tar', 'gz',
  // Ses / Video
  'mp3', 'mp4', 'wav', 'ogg', 'webm', 'avi', 'mov', 'mkv',
  // Veri / Kod
  'json', 'xml', 'html', 'htm',
]);

function normalizeExtension(fileName = '', fallback = 'bin') {
  const ext = String(fileName || '').split('.').pop()?.toLowerCase().trim();
  return ext || fallback;
}

function normalizePublicBaseUrl(url = '') {
  return String(url || '').trim().replace(/\/+$/, '');
}

function buildInternalFileUrl(fileKey) {
  return `/api/files/${fileKey}`;
}

function buildManagedFileKey(hash, extension) {
  return `files/${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}.${extension}`;
}

function mapFileType(extension, mimeType = '') {
  const ext = String(extension || '').toLowerCase().trim();
  if (ext) return ext;
  const subtype = String(mimeType || '').split('/')[1];
  return subtype || 'other';
}

async function sha256Hex(arrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function extractManagedFileKey(rawUrl, publicBaseUrl = '') {
  const value = String(rawUrl || '').trim();
  if (!value) return null;
  if (value.startsWith('/api/files/')) return value.slice('/api/files/'.length);

  const normalizedBase = normalizePublicBaseUrl(publicBaseUrl);
  if (normalizedBase && value.startsWith(`${normalizedBase}/`)) {
    return value.slice(normalizedBase.length + 1);
  }

  try {
    const parsed = new URL(value);
    if (parsed.pathname.startsWith('/api/files/')) {
      return parsed.pathname.slice('/api/files/'.length);
    }
    if (normalizedBase && value.startsWith(`${normalizedBase}/`)) {
      return value.slice(normalizedBase.length + 1);
    }
  } catch (_) {
    return null;
  }

  return null;
}

function canManageInstitutionScope(user, institution) {
  if (!user || !institution) return false;
  if (user.role === 'super_admin') return true;
  if (user.role !== 'admin') return false;

  return String(user.institution_id || '') === String(institution.id || '')
    || (user.institution && institution.name && String(user.institution) === String(institution.name));
}

function canManageCollectionScope(user, collection) {
  if (!user || !collection) return false;
  if (collection.scope_type === 'institution') {
    return canManageInstitutionScope(user, { id: collection.scope_id, name: collection.scope_name || null });
  }

  if (collection.scope_type === 'system') {
    return user.role === 'super_admin' && String(collection.scope_id || '') === String(user.user_id || '');
  }

  return false;
}

async function getInstitutionByIdentifier(db, identifier) {
  if (/^\d+$/.test(String(identifier || '').trim())) {
    return db.prepare(`SELECT id, name, domain, category, status, created_at FROM institutions WHERE id = ?`)
      .bind(Number(identifier))
      .first();
  }

  return db.prepare(`SELECT id, name, domain, category, status, created_at FROM institutions WHERE name = ?`)
    .bind(identifier)
    .first();
}

async function ensureInstitutionMetadataColumns(db) {
  for (const sql of [
    `ALTER TABLE institutions ADD COLUMN logo_url TEXT`,
    `ALTER TABLE institutions ADD COLUMN website_url TEXT`,
    `ALTER TABLE institutions ADD COLUMN city TEXT`
  ]) {
    try {
      await db.prepare(sql).run();
    } catch (err) {
      const message = String(err?.message || '').toLowerCase();
      if (!message.includes('duplicate column name')) {
        throw err;
      }
    }
  }
}

async function ensureInstitutionSubscriptionAccessColumns(db) {
  for (const sql of [
    'ALTER TABLE institution_subscriptions ADD COLUMN access_type TEXT',
    'ALTER TABLE institution_subscriptions ADD COLUMN access_url TEXT',
    'ALTER TABLE institution_subscriptions ADD COLUMN requires_institution_email INTEGER DEFAULT 0',
    'ALTER TABLE institution_subscriptions ADD COLUMN requires_vpn INTEGER DEFAULT 0',
    'ALTER TABLE institution_subscriptions ADD COLUMN access_notes_tr TEXT',
    'ALTER TABLE institution_subscriptions ADD COLUMN access_notes_en TEXT'
  ]) {
    try {
      await db.prepare(sql).run();
    } catch (err) {
      const message = String(err?.message || '').toLowerCase();
      if (!message.includes('duplicate column name')) {
        throw err;
      }
    }
  }
}

async function ensureProductsTableAndSeed(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS products (
      slug TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      region TEXT,
      default_access_type TEXT,
      default_access_url TEXT,
      default_requires_institution_email INTEGER DEFAULT 0,
      default_requires_vpn INTEGER DEFAULT 0,
      default_access_notes_tr TEXT,
      default_access_notes_en TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  for (const sql of [
    'ALTER TABLE products ADD COLUMN default_access_type TEXT',
    'ALTER TABLE products ADD COLUMN default_access_url TEXT',
    'ALTER TABLE products ADD COLUMN default_requires_institution_email INTEGER DEFAULT 0',
    'ALTER TABLE products ADD COLUMN default_requires_vpn INTEGER DEFAULT 0',
    'ALTER TABLE products ADD COLUMN default_access_notes_tr TEXT',
    'ALTER TABLE products ADD COLUMN default_access_notes_en TEXT'
  ]) {
    try {
      await db.prepare(sql).run();
    } catch (err) {
      const message = String(err?.message || '').toLowerCase();
      if (!message.includes('duplicate column name')) {
        throw err;
      }
    }
  }

  for (const product of DEFAULT_PRODUCT_CATALOG) {
    await db.prepare(`
      INSERT OR IGNORE INTO products (
        slug, name, category, region,
        default_access_type, default_access_url,
        default_requires_institution_email, default_requires_vpn,
        default_access_notes_tr, default_access_notes_en
      )
      VALUES (?, ?, ?, ?, NULL, NULL, 0, 0, NULL, NULL)
    `).bind(
      product.slug,
      product.name,
      product.category || null,
      product.region || null
    ).run();
  }
}
async function ensureInstitutionRootCollection(db, institutionId, createdBy = null) {
  const existing = await db.prepare(`
    SELECT id, parent_id, name, scope_type, scope_id, kind, is_public, is_active, sort_order, created_by, created_at
    FROM collections
    WHERE scope_type = 'institution' AND scope_id = ? AND kind = 'root' AND is_active = 1
    ORDER BY id ASC
    LIMIT 1
  `).bind(institutionId).first();

  if (existing) return existing;

  const result = await db.prepare(`
    INSERT INTO collections (parent_id, name, scope_type, scope_id, kind, is_public, is_active, sort_order, created_by)
    VALUES (NULL, '__root__', 'institution', ?, 'root', 0, 1, 0, ?)
  `).bind(institutionId, createdBy).run();

  return db.prepare(`
    SELECT id, parent_id, name, scope_type, scope_id, kind, is_public, is_active, sort_order, created_by, created_at
    FROM collections
    WHERE id = ?
  `).bind(result.meta?.last_row_id).first();
}

async function ensureSystemRootCollection(db, userId, createdBy = null) {
  const existing = await db.prepare(`
    SELECT id, parent_id, name, scope_type, scope_id, kind, is_public, is_active, sort_order, created_by, created_at
    FROM collections
    WHERE scope_type = 'system' AND scope_id = ? AND kind = 'root' AND is_active = 1
    ORDER BY id ASC
    LIMIT 1
  `).bind(userId).first();

  if (existing) return existing;

  const result = await db.prepare(`
    INSERT INTO collections (parent_id, name, scope_type, scope_id, kind, is_public, is_active, sort_order, created_by)
    VALUES (NULL, '__root__', 'system', ?, 'root', 0, 1, 0, ?)
  `).bind(userId, createdBy).run();

  return db.prepare(`
    SELECT id, parent_id, name, scope_type, scope_id, kind, is_public, is_active, sort_order, created_by, created_at
    FROM collections
    WHERE id = ?
  `).bind(result.meta?.last_row_id).first();
}

async function getActiveCollection(db, collectionId) {
  return db.prepare(`
    SELECT id, parent_id, name, scope_type, scope_id, kind, is_public, is_active, sort_order, created_by, created_at
    FROM collections
    WHERE id = ? AND is_active = 1
  `).bind(collectionId).first();
}

async function getInstitutionCollectionOrRoot(db, institutionId, folderId = null, createdBy = null) {
  const root = await ensureInstitutionRootCollection(db, institutionId, createdBy);
  if (!folderId) return root;

  const folder = await getActiveCollection(db, folderId);
  if (!folder || folder.scope_type !== 'institution' || String(folder.scope_id) !== String(institutionId)) {
    return null;
  }

  return folder;
}

async function getSystemCollectionOrRoot(db, userId, folderId = null, createdBy = null) {
  const root = await ensureSystemRootCollection(db, userId, createdBy);
  if (!folderId) return root;

  const folder = await getActiveCollection(db, folderId);
  if (!folder || folder.scope_type !== 'system' || String(folder.scope_id) !== String(userId)) {
    return null;
  }

  return folder;
}

async function getStoredFileByKey(db, fileKey) {
  return db.prepare(`
    SELECT id, hash, file_key, original_name, file_size, mime_type, extension, uploaded_by, created_at
    FROM files
    WHERE file_key = ?
  `).bind(fileKey).first();
}

async function getStoredFileById(db, fileId) {
  return db.prepare(`
    SELECT id, hash, file_key, original_name, file_size, mime_type, extension, uploaded_by, created_at
    FROM files
    WHERE id = ?
  `).bind(fileId).first();
}

async function ensureStoredFileRecord(c, file, uploadedBy) {
  const bucket = c.env.FILES_BUCKET;
  if (!bucket) throw new Error('R2 bucket bagli degil');

  const extension = normalizeExtension(file.name);
  if (!MANAGED_FILE_EXTENSIONS.has(extension)) {
    throw new Error('Desteklenmeyen dosya turu');
  }

  const arrayBuffer = await file.arrayBuffer();
  const hash = await sha256Hex(arrayBuffer);
  const db = c.env.DB;

  let stored = await db.prepare(`
    SELECT id, hash, file_key, original_name, file_size, mime_type, extension, uploaded_by, created_at
    FROM files
    WHERE hash = ?
    LIMIT 1
  `).bind(hash).first();

  if (!stored) {
    const fileKey = buildManagedFileKey(hash, extension);
    await bucket.put(fileKey, arrayBuffer, {
      httpMetadata: { contentType: file.type || 'application/octet-stream' }
    });

    const result = await db.prepare(`
      INSERT INTO files (hash, file_key, original_name, file_size, mime_type, extension, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(hash, fileKey, file.name, file.size || arrayBuffer.byteLength, file.type || 'application/octet-stream', extension, uploadedBy).run();

    stored = await getStoredFileById(db, result.meta?.last_row_id);
    return { stored, deduplicated: false };
  }

  return { stored, deduplicated: true };
}

async function countActiveReferences(db, fileId) {
  const row = await db.prepare(`
    SELECT (
      COALESCE((SELECT COUNT(*) FROM collection_files WHERE file_id = ? AND is_active = 1), 0) +
      COALESCE((SELECT COUNT(*) FROM user_collection_files WHERE file_id = ?), 0)
    ) AS cnt
  `).bind(fileId, fileId).first();

  return Number(row?.cnt || 0);
}

async function formatManagedFileResponse(db, refId) {
  return db.prepare(`
    SELECT
      cf.id,
      col.scope_id AS institution_id,
      COALESCE(inst.name, '') AS institution_name,
      cf.collection_id AS folder_id,
      COALESCE(cf.display_name, f.original_name) AS file_name,
      '/api/files/' || f.file_key AS file_url,
      COALESCE(f.extension, '') AS file_type,
      f.file_size,
      COALESCE(cf.category, 'other') AS category,
      cf.is_public,
      cf.added_by AS uploaded_by,
      cf.added_at AS uploaded_at,
      u.full_name AS uploaded_by_name,
      f.mime_type,
      f.id AS source_file_id
    FROM collection_files cf
    JOIN files f ON f.id = cf.file_id
    JOIN collections col ON col.id = cf.collection_id
    LEFT JOIN institutions inst ON inst.id = col.scope_id
    LEFT JOIN users u ON u.id = cf.added_by
    WHERE cf.id = ?
  `).bind(refId).first();
}

async function getInstitutionFileCount(db, institutionId) {
  const row = await db.prepare(`
    SELECT COUNT(*) AS cnt
    FROM collection_files cf
    JOIN collections col ON col.id = cf.collection_id
    WHERE col.scope_type = 'institution'
      AND col.scope_id = ?
      AND col.is_active = 1
      AND cf.is_active = 1
  `).bind(institutionId).first();

  return Number(row?.cnt || 0);
}

async function ensureUserRootCollection(db, userId) {
  const existing = await db.prepare(`
    SELECT id, user_id, parent_id, name, created_at, sort_order
    FROM user_collections
    WHERE user_id = ? AND parent_id IS NULL AND name = '__root__'
    LIMIT 1
  `).bind(userId).first();

  if (existing) return existing;

  const result = await db.prepare(`
    INSERT INTO user_collections (user_id, parent_id, name, sort_order)
    VALUES (?, NULL, '__root__', 0)
  `).bind(userId).run();

  return db.prepare(`
    SELECT id, user_id, parent_id, name, created_at, sort_order
    FROM user_collections
    WHERE id = ?
  `).bind(result.meta?.last_row_id).first();
}

async function getUserCollection(db, collectionId, userId = null) {
  const row = await db.prepare(`
    SELECT id, user_id, parent_id, name, created_at, sort_order
    FROM user_collections
    WHERE id = ?
  `).bind(collectionId).first();

  if (!row) return null;
  if (userId && String(row.user_id) !== String(userId)) return null;
  return row;
}

async function createNotification(db, userId, type, title, content = null, data = null) {
  await db.prepare(`
    INSERT INTO notifications (user_id, type, title, content, data, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
  `).bind(userId, type, title, content, data ? JSON.stringify(data) : null).run();
}

async function resolveShareRecipients(db, actor, recipients = []) {
  const resolved = new Map();

  for (const recipient of recipients) {
    if (!recipient?.type) continue;

    if (recipient.type === 'user' && recipient.id) {
      const user = await db.prepare(`
        SELECT id, full_name, email, institution_id, institution, role
        FROM users
        WHERE id = ?
      `).bind(Number(recipient.id)).first();
      if (!user) continue;
      if (actor.role === 'admin' && String(user.institution_id || '') !== String(actor.institution_id || '')) continue;
      resolved.set(String(user.id), user);
      continue;
    }

    if (recipient.type === 'institution' && recipient.id) {
      const institutionId = Number(recipient.id);
      if (actor.role === 'admin' && String(actor.institution_id || '') !== String(institutionId)) continue;

      let roleFilter = `AND role IN ('admin','user')`;
      if (recipient.filter === 'admin') roleFilter = `AND role = 'admin'`;
      if (recipient.filter === 'user') roleFilter = `AND role = 'user'`;

      const users = await db.prepare(`
        SELECT id, full_name, email, institution_id, institution, role
        FROM users
        WHERE institution_id = ?
          ${roleFilter}
      `).bind(institutionId).all();

      for (const user of users.results || []) {
        resolved.set(String(user.id), user);
      }
    }
  }

  return Array.from(resolved.values());
}

// ====================== RATE LIMITING ======================
// Fixed-window rate limiting via Cloudflare KV (RATE_LIMIT_KV binding).
// KV is shared across all Worker instances so this actually works.
async function checkRateLimit(kv, endpoint, identifier, maxRequests = 10, windowSeconds = 300) {
  if (!kv) {
    return {
      isLimited: false,
      remaining: maxRequests,
      resetTime: Date.now() + windowSeconds * 1000
    };
  }

  const safeEndpoint = String(endpoint || 'unknown').trim().toLowerCase();
  const safeIdentifier = String(identifier || 'anonymous').trim().toLowerCase();
  const key = `rate:${safeEndpoint}:${safeIdentifier}`;
  const now = Date.now();

  const raw = await kv.get(key);
  let record = raw ? JSON.parse(raw) : null;

  if (!record || now > Number(record.resetTime || 0)) {
    record = {
      count: 1,
      resetTime: now + windowSeconds * 1000
    };
  } else {
    record.count += 1;
  }

  await kv.put(key, JSON.stringify(record), {
    expirationTtl: windowSeconds
  });

  return {
    isLimited: record.count > maxRequests,
    remaining: Math.max(0, maxRequests - record.count),
    resetTime: record.resetTime
  };
}

async function canAccessUser(c, targetUserId) {
  const role = await getUserRole(c);
  if (role === 'super_admin') return true;

  const db = c.env.DB;
  const adminInstitutionId = await getUserInstitutionId(c);
  const adminInstitution = await getUserInstitution(c);
  const targetUser = await db.prepare(`SELECT institution, institution_id FROM users WHERE id = ?`).bind(targetUserId).first();
  if (!targetUser) return false;
  if (adminInstitutionId && targetUser.institution_id) {
    return targetUser.institution_id === adminInstitutionId;
  }
  return targetUser.institution === adminInstitution;
}

async function canListUsers(c) {
  const role = await getUserRole(c);
  return role === 'super_admin' || role === 'admin';
}

// ====================== PASSWORD HELPERS ======================

async function hashPassword(password) {
  const salt       = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name:       'PBKDF2',
      salt:       salt,
      iterations: 100_000,
      hash:       'SHA-256'
    },
    keyMaterial,
    256
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const saltArray = Array.from(salt);

  const saltHex = saltArray.map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password, storedHash) {
  if (!storedHash.includes(':')) {
    const encoder    = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password));
    const hashHex    = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex === storedHash;
  }

  const [saltHex, existingHashHex] = storedHash.split(':');
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  return timingSafeEqual(hashHex, existingHashHex);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ====================== HEALTH AND AUTH ROUTES ======================
app.get('/test', (c) => {
  console.log("✅ Test endpoint called");
  return c.text('Worker is alive - ' + new Date().toISOString());
});

app.get('/api/auth/status', (c) => {
  console.log("✅ Status endpoint called");
  return c.json({ 
    status: '✅ LibEdge Auth API çalışıyor', 
    database: 'Connected',
    timestamp: new Date().toISOString()
  });
});

// ====================== LOGIN ENDPOINT ======================
app.post('/api/auth/login', async (c) => {
  try {
    const body = await parseAndValidate(c, {
      email:    { required: true, type: 'string', email: true, maxLength: 254 },
      password: { required: true, type: 'string', minLength: 1, maxLength: 128 },
    });
    if (body instanceof Response) return body;
    const { email, password } = body;
    const db = c.env.DB;

    const user = await db.prepare(`
      SELECT id, email, full_name, institution, institution_id, password_hash, role
      FROM users WHERE email = ?
    `).bind(email.toLowerCase()).first();

    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return c.json({ success: false, error: 'E-posta veya şifre hatalı.' }, 401);
    }

    await db.prepare(`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`).bind(user.id).run();

    // Access Token: 15 dakika
    const accessTokenPayload = {
      user_id: user.id,
      email: user.email,
      full_name: user.full_name || "",
      institution: user.institution || "",
      institution_id: user.institution_id || null,
      role: user.role || "user",
      type: 'access',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (15 * 60)
    };
    
    // Refresh Token: 7 gün
    const refreshTokenPayload = {
      user_id: user.id,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
    };
    
    const secret = c.env.JWT_SECRET;
    const accessToken = await sign(accessTokenPayload, secret);
    const refreshToken = await sign(refreshTokenPayload, secret);

    // Access Token: Cookie ile (httpOnly)
    setCookie(c, 'authToken', accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      maxAge: 900,
      path: '/',
    });
    
    // Refresh Token: Ayrı cookie ile (httpOnly)
    setCookie(c, 'refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });
    
    return c.json({
      success: true,
      token: accessToken,  // Eski client'lar için compatibility
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        institution: user.institution,
        role: user.role
      }
    });

  } catch (err) {
    console.error("Login error:", err);
    return c.json({ success: false, error: err.message || 'Giriş sırasında hata oluştu.' }, 500);
  }
});

// ====================== LOGOUT ENDPOINT ======================
app.post('/api/auth/logout', async (c) => {
  setCookie(c, 'authToken', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'None',
    maxAge: 0,
    path: '/'
  });
  
  setCookie(c, 'refreshToken', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'None',
    maxAge: 0,
    path: '/'
  });
  
  return c.json({ success: true, message: 'Başarıyla çıkış yapıldı' });
});

// ====================== REFRESH ENDPOINT ======================
app.post('/api/auth/refresh', async (c) => {
  // Rate limiting: 10 requests per 5 minutes
  const identifier = c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip') || 'unknown';
  const rateLimitCheck = await checkRateLimit(c.env.RATE_LIMIT_KV, 'refresh', identifier, 10, 300);
  
  if (rateLimitCheck.isLimited) {
    c.header('Retry-After', Math.ceil((rateLimitCheck.resetTime - Date.now()) / 1000).toString());
    return c.json({ 
      error: 'Çok fazla refresh isteği. Lütfen bir süre sonra tekrar deneyin.',
      retryAfter: rateLimitCheck.resetTime
    }, 429);
  }
  
  const refreshToken = getCookie(c, 'refreshToken');
  if (!refreshToken) {
    return c.json({ error: 'Refresh token bulunamadı' }, 401);
  }
  const secret = c.env.JWT_SECRET;
  let refreshPayload;
  try {
    refreshPayload = await verify(refreshToken, secret);
  } catch {
    return c.json({ error: 'Geçersiz veya süresi dolmuş refresh token' }, 401);
  }
  if (!refreshPayload || refreshPayload.type !== 'refresh') {
    return c.json({ error: 'Geçersiz veya süresi dolmuş refresh token' }, 401);
  }
  
  const db = c.env.DB;
  
  const user = await db.prepare(`
    SELECT id, email, full_name, institution, institution_id, role FROM users WHERE id = ?
  `).bind(refreshPayload.user_id).first();

  if (!user) {
    return c.json({ error: 'Kullanıcı bulunamadı' }, 401);
  }

  // Yeni Access Token
  const newAccessPayload = {
    user_id: user.id,
    email: user.email,
    full_name: user.full_name || "",
    institution: user.institution || "",
    institution_id: user.institution_id || null,
    role: user.role || "user",
    type: 'access',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (15 * 60)
  };
  
  // Yeni Refresh Token (7 gün)
  const newRefreshPayload = {
    user_id: user.id,
    type: 'refresh',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
  };
  
  const newAccessToken = await sign(newAccessPayload, secret);
  const newRefreshToken = await sign(newRefreshPayload, secret);
  
  setCookie(c, 'authToken', newAccessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'None',
    maxAge: 900,
    path: '/'
  });
  
  setCookie(c, 'refreshToken', newRefreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'None',
    maxAge: 7 * 24 * 60 * 60,
    path: '/'
  });
  
  return c.json({ 
    success: true, 
    message: 'Token yenilendi',
    remaining: rateLimitCheck.remaining
  });
});

// ====================== 🆕 PROTECTED ENDPOINT'LER (Cookie ile) ======================

app.get('/api/user/profile', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  
  const userId = auth.user.user_id;
  const db = c.env.DB;
  
  const user = await db.prepare(`
    SELECT u.id, u.email, u.full_name, u.institution, u.institution_id, u.role, u.created_at, u.avatar_url,
           i.name as institution_name, i.logo_url as institution_logo_url, i.domain as institution_domain, i.website_url as institution_website_url
    FROM users u
    LEFT JOIN institutions i ON u.institution_id = i.id
    WHERE u.id = ?
  `).bind(userId).first();
  
  if (!user) {
    return c.json({ error: 'Kullanıcı bulunamadı' }, 404);
  }
  return c.json(user);
});

app.post('/api/user/avatar', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;

  const userId = auth.user.user_id;
  const db = c.env.DB;
  const bucket = c.env.FILES_BUCKET;
  const r2PublicUrl = c.env.R2_PUBLIC_URL;

  if (!r2PublicUrl) return c.json({ error: 'R2_PUBLIC_URL yapılandırılmamış' }, 500);
  if (!bucket) return c.json({ error: 'R2 bucket bağlantısı yok' }, 500);

  try {
    const formData = await c.req.formData();
    const file = formData.get('avatar');

    if (!file || typeof file === 'string') return c.json({ error: 'Dosya bulunamadı' }, 400);

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) return c.json({ error: 'Sadece JPEG, PNG veya WebP desteklenir' }, 400);

    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) return c.json({ error: 'Dosya 2MB\'dan küçük olmalı' }, 400);

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const key = `avatars/${userId}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    await bucket.put(key, arrayBuffer, {
      httpMetadata: { contentType: file.type, cacheControl: 'no-cache, no-store' }
    });

    const avatarUrl = `${r2PublicUrl}/${key}`;

    await db.prepare(`UPDATE users SET avatar_url = ? WHERE id = ?`).bind(avatarUrl, userId).run();

    return c.json({ success: true, avatar_url: avatarUrl });
  } catch (err) {
    console.error('Avatar upload error:', err);
    return c.json({ error: err.message }, 500);
  }
});

app.post('/api/user/update', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  
  const userId = auth.user.user_id;
  const { full_name, institution, new_password } = await c.req.json();
  const db = c.env.DB;

  const profileFields = normalizeUserProfileFields({ full_name });

  if (new_password) {
    if (new_password.length < 6) {
      return c.json({ error: 'Şifre en az 6 karakter olmalı' }, 400);
    }
    const password_hash = await hashPassword(new_password);
    await db.prepare(`
      UPDATE users SET full_name = ?, first_name = ?, last_name = ?, institution = ?, password_hash = ? WHERE id = ?
    `).bind(profileFields.full_name, profileFields.first_name, profileFields.last_name, institution || null, password_hash, userId).run();
  } else {
    await db.prepare(`
      UPDATE users SET full_name = ?, first_name = ?, last_name = ?, institution = ? WHERE id = ?
    `).bind(profileFields.full_name, profileFields.first_name, profileFields.last_name, institution || null, userId).run();
  }
  return c.json({ success: true });
});

app.delete('/api/user/delete', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  
  const userId = auth.user.user_id;
  const db = c.env.DB;
  

  await db.prepare(`DELETE FROM newsletter_subscriptions WHERE user_id = ?`).bind(userId).run();
  await db.prepare(`DELETE FROM subscriptions WHERE user_id = ?`).bind(userId).run();
  await db.prepare(`DELETE FROM users WHERE id = ?`).bind(userId).run();
  
  // Cookie'yi de sil
  setCookie(c, 'authToken', '', {
  httpOnly: true,
  secure: true,
  sameSite: 'None',
  maxAge: 0,
  path: '/'
});

setCookie(c, 'refreshToken', '', {
  httpOnly: true,
  secure: true,
  sameSite: 'None',
  maxAge: 0,
  path: '/'
});
  
  return c.json({ success: true });
});

// ====================== SUBSCRIPTION ROUTES ======================
app.get('/api/subscription/check', async (c) => {
  const product = c.req.query('product');
  if (!product) return c.json({ hasAccess: false, error: 'Product belirtilmedi.' }, 400);
  
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  
  const userId = auth.user.user_id;
  const institutionId = auth.user.institution_id;
  const db = c.env.DB;
  await ensureInstitutionSubscriptionAccessColumns(db);
  await ensureProductsTableAndSeed(db);
  
  const sub = await db.prepare(`
    SELECT s.*, p.default_access_type, p.default_access_url,
           p.default_requires_institution_email, p.default_requires_vpn,
           p.default_access_notes_tr, p.default_access_notes_en
    FROM subscriptions s
    LEFT JOIN products p ON p.slug = s.product_slug
    WHERE user_id = ? AND product_slug = ? 
      AND status IN ('trial', 'active')
      AND (end_date IS NULL OR end_date > CURRENT_TIMESTAMP)
  `).bind(userId, product).first();

  let institutionSub = null;
  if (institutionId) {
    institutionSub = await db.prepare(`
      SELECT is2.id, is2.product_slug, is2.status,
             COALESCE(NULLIF(TRIM(is2.access_type), ''), p.default_access_type) AS access_type,
             COALESCE(NULLIF(TRIM(is2.access_url), ''), p.default_access_url) AS access_url,
             CASE WHEN COALESCE(is2.requires_institution_email, 0) = 1 OR COALESCE(p.default_requires_institution_email, 0) = 1 THEN 1 ELSE 0 END AS requires_institution_email,
             CASE WHEN COALESCE(is2.requires_vpn, 0) = 1 OR COALESCE(p.default_requires_vpn, 0) = 1 THEN 1 ELSE 0 END AS requires_vpn,
             COALESCE(NULLIF(TRIM(is2.access_notes_tr), ''), p.default_access_notes_tr) AS access_notes_tr,
             COALESCE(NULLIF(TRIM(is2.access_notes_en), ''), p.default_access_notes_en) AS access_notes_en
      FROM institution_subscriptions is2
      LEFT JOIN products p ON p.slug = is2.product_slug
      WHERE institution_id = ? AND product_slug = ?
        AND status IN ('trial', 'active')
        AND (end_date IS NULL OR end_date > CURRENT_TIMESTAMP)
      LIMIT 1
    `).bind(institutionId, product).first();
  }

  const productAccess = sub ? {
    access_type: sub.default_access_type || null,
    access_url: sub.default_access_url || null,
    requires_institution_email: sub.default_requires_institution_email ? 1 : 0,
    requires_vpn: sub.default_requires_vpn ? 1 : 0,
    access_notes_tr: sub.default_access_notes_tr || null,
    access_notes_en: sub.default_access_notes_en || null
  } : null;

  const effective = institutionSub || (sub ? { ...sub, ...productAccess } : null);
  return c.json({ hasAccess: !!effective, status: effective ? effective.status : null, access: effective || null });
});

app.get('/api/subscription/list', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;

  const userId = auth.user.user_id;
  const institutionId = auth.user.institution_id;
  const db = c.env.DB;
  await ensureInstitutionSubscriptionAccessColumns(db);
  await ensureProductsTableAndSeed(db);

  const individual = await db.prepare(`
    SELECT s.id, s.product_slug, s.status, s.start_date, s.end_date, s.created_at, 'individual' as source,
           p.default_access_type AS access_type,
           p.default_access_url AS access_url,
           COALESCE(p.default_requires_institution_email, 0) AS requires_institution_email,
           COALESCE(p.default_requires_vpn, 0) AS requires_vpn,
           p.default_access_notes_tr AS access_notes_tr,
           p.default_access_notes_en AS access_notes_en
    FROM subscriptions s
    LEFT JOIN products p ON p.slug = s.product_slug
    WHERE s.user_id = ? ORDER BY s.created_at DESC
  `).bind(userId).all();

  let instSubs = [];
  if (institutionId) {
    const instRes = await db.prepare(`
      SELECT is2.id, is2.product_slug, is2.status, is2.start_date, is2.end_date, is2.created_at, 'institution' as source,
             COALESCE(NULLIF(TRIM(is2.access_type), ''), p.default_access_type) AS access_type,
             COALESCE(NULLIF(TRIM(is2.access_url), ''), p.default_access_url) AS access_url,
             CASE WHEN COALESCE(is2.requires_institution_email, 0) = 1 OR COALESCE(p.default_requires_institution_email, 0) = 1 THEN 1 ELSE 0 END AS requires_institution_email,
             CASE WHEN COALESCE(is2.requires_vpn, 0) = 1 OR COALESCE(p.default_requires_vpn, 0) = 1 THEN 1 ELSE 0 END AS requires_vpn,
             COALESCE(NULLIF(TRIM(is2.access_notes_tr), ''), p.default_access_notes_tr) AS access_notes_tr,
             COALESCE(NULLIF(TRIM(is2.access_notes_en), ''), p.default_access_notes_en) AS access_notes_en
      FROM institution_subscriptions is2
      LEFT JOIN products p ON p.slug = is2.product_slug
      WHERE is2.institution_id = ? AND is2.status IN ('active','trial')
        AND (is2.end_date IS NULL OR is2.end_date > CURRENT_TIMESTAMP)
    `).bind(institutionId).all();
    instSubs = instRes.results || [];
  }

  // Kurum öncelikli — aynı product_slug varsa kurum aboneliği kazanır
  const bySlug = {};
  for (const s of (individual.results || [])) bySlug[s.product_slug] = s;
  for (const s of instSubs) bySlug[s.product_slug] = s;

  return c.json({ subscriptions: Object.values(bySlug) });
});

// GET /api/user/subscriptions — birleşik kullanıcı abonelikleri (yeni endpoint)
app.get('/api/user/subscriptions', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;

  const userId = auth.user.user_id;
  const institutionId = auth.user.institution_id;
  const db = c.env.DB;
  await ensureInstitutionSubscriptionAccessColumns(db);
  await ensureProductsTableAndSeed(db);

  const individual = await db.prepare(`
    SELECT s.id, s.product_slug, s.status, s.start_date, s.end_date, 'individual' as source,
           p.default_access_type AS access_type,
           p.default_access_url AS access_url,
           COALESCE(p.default_requires_institution_email, 0) AS requires_institution_email,
           COALESCE(p.default_requires_vpn, 0) AS requires_vpn,
           p.default_access_notes_tr AS access_notes_tr,
           p.default_access_notes_en AS access_notes_en
    FROM subscriptions s
    LEFT JOIN products p ON p.slug = s.product_slug
    WHERE s.user_id = ? AND s.status IN ('active','trial')
      AND (s.end_date IS NULL OR s.end_date > CURRENT_TIMESTAMP)
  `).bind(userId).all();

  let instSubs = [];
  if (institutionId) {
    const instRes = await db.prepare(`
      SELECT is2.id, is2.product_slug, is2.status, is2.start_date, is2.end_date, 'institution' as source,
             COALESCE(NULLIF(TRIM(is2.access_type), ''), p.default_access_type) AS access_type,
             COALESCE(NULLIF(TRIM(is2.access_url), ''), p.default_access_url) AS access_url,
             CASE WHEN COALESCE(is2.requires_institution_email, 0) = 1 OR COALESCE(p.default_requires_institution_email, 0) = 1 THEN 1 ELSE 0 END AS requires_institution_email,
             CASE WHEN COALESCE(is2.requires_vpn, 0) = 1 OR COALESCE(p.default_requires_vpn, 0) = 1 THEN 1 ELSE 0 END AS requires_vpn,
             COALESCE(NULLIF(TRIM(is2.access_notes_tr), ''), p.default_access_notes_tr) AS access_notes_tr,
             COALESCE(NULLIF(TRIM(is2.access_notes_en), ''), p.default_access_notes_en) AS access_notes_en
      FROM institution_subscriptions is2
      LEFT JOIN products p ON p.slug = is2.product_slug
      WHERE is2.institution_id = ? AND is2.status IN ('active','trial')
        AND (is2.end_date IS NULL OR is2.end_date > CURRENT_TIMESTAMP)
    `).bind(institutionId).all();
    instSubs = instRes.results || [];
  }

  const bySlug = {};
  for (const s of (individual.results || [])) bySlug[s.product_slug] = s;
  for (const s of instSubs) bySlug[s.product_slug] = s;

  return c.json(Object.values(bySlug));
});

// ====================== NEWSLETTER ROUTES ======================
app.get('/api/newsletter/status', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;

  const db = c.env.DB;

  const subscription = await db.prepare(`
    SELECT id, email, status, subscribed_at, unsubscribed_at, updated_at
    FROM newsletter_subscriptions
    WHERE user_id = ?
    LIMIT 1
  `).bind(auth.user.user_id).first();

  return c.json({
    subscribed: subscription?.status === 'active',
    subscription: subscription || null,
    email: subscription?.email || auth.user.email || ''
  });
});

app.post('/api/newsletter/subscribe', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const optionalAuth = await getOptionalAuth(c);
    const userId = optionalAuth?.user?.user_id || null;
    const userEmail = optionalAuth?.user?.email || '';
    const email = String(body.email || userEmail || '').trim().toLowerCase();

    if (!email) {
      return c.json({ error: 'E-posta zorunludur.' }, 400);
    }

    const db = c.env.DB;
  
    const existing = await db.prepare(`
      SELECT id, user_id, email, status
      FROM newsletter_subscriptions
      WHERE email = ? OR (? IS NOT NULL AND user_id = ?)
      LIMIT 1
    `).bind(email, userId, userId).first();

    if (existing) {
      await db.prepare(`
        UPDATE newsletter_subscriptions
        SET email = ?, user_id = COALESCE(?, user_id), status = 'active',
            source = ?, subscribed_at = COALESCE(subscribed_at, CURRENT_TIMESTAMP),
            unsubscribed_at = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(email, userId, userId ? 'user' : 'guest', existing.id).run();
    } else {
      await db.prepare(`
        INSERT INTO newsletter_subscriptions
          (user_id, email, status, source, subscribed_at, updated_at)
        VALUES (?, ?, 'active', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(userId, email, userId ? 'user' : 'guest').run();
    }

    const ip = c.req.header('CF-Connecting-IP') || '';
    const payload = {
      ...body,
      email,
      name: body.name || optionalAuth?.user?.full_name || email.split('@')[0],
      formType: 'newsletter'
    };

    c.executionCtx.waitUntil(
      sendToAirtable(c.env, payload, 'newsletter', ip).catch(err =>
        console.error('Newsletter Airtable background error:', err)
      )
    );

    return c.json({ success: true, subscribed: true, email });
  } catch (err) {
    console.error('Newsletter subscribe error:', err);
    return c.json({ error: err.message }, 500);
  }
});

app.delete('/api/newsletter/subscribe', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;

  const db = c.env.DB;

  await db.prepare(`
    UPDATE newsletter_subscriptions
    SET status = 'inactive', unsubscribed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).bind(auth.user.user_id).run();

  return c.json({ success: true, subscribed: false });
});

// ====================== REGISTER (değişmedi) ======================
// ====================== REGISTRATION ROUTES ======================
app.post('/api/auth/register', async (c) => {
  try {
    const body = await parseAndValidate(c, {
      email:       { required: true, type: 'string', email: true, maxLength: 254 },
      password:    { required: true, type: 'string', minLength: 6, maxLength: 128 },
      full_name:   { type: 'string', maxLength: 120 },
      institution: { type: 'string', maxLength: 200 },
    });
    if (body instanceof Response) return body;
    const { email, password, full_name, institution } = body;
    const db = c.env.DB;

    const password_hash = await hashPassword(password);
    const profileFields = normalizeUserProfileFields({ full_name });

    await db.prepare(`
      INSERT INTO users (email, password_hash, full_name, first_name, last_name, institution, role)
      VALUES (?, ?, ?, ?, ?, ?, 'user')
    `).bind(email.toLowerCase().trim(), password_hash, profileFields.full_name, profileFields.first_name, profileFields.last_name, institution || null).run();

    return c.json({ success: true, message: 'Kayıt başarılı! Şimdi giriş yapabilirsiniz.' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return c.json({ success: false, error: 'Bu e-posta adresi zaten kayıtlı.' }, 409);
    }
    return c.json({ success: false, error: 'Kayıt sırasında hata oluştu.' }, 500);
  }
});

// ====================== FORM ENDPOINT ======================
app.post('/form', async (c) => {
  try {
    const data = await c.req.json();
    const { formType, name, email, message } = data;

    let subject = "Form Gönderimi";
    let sheetPayload = {};

    if (formType === "trial") {
      subject = "Trial Access Request";
      sheetPayload = { form: "Trial", name, email, message };
    } else if (formType === "suggest") {
      subject = "Suggest a Product";
      sheetPayload = { form: "Suggest", name, email, message };
    } else if (formType === "newsletter") {
      subject = "Newsletter Subscription";
      sheetPayload = { form: "Newsletter", name: name || "Newsletter Subscriber", email, message: "Newsletter subscription request" };
    } else if (formType === "contact") {
      subject = "Contact Form";
      sheetPayload = {
        form: "Contact",
        name,
        email,
        phone: data.phone || "",
        subject: data.subject || "",
        message
      };
    }

    if (c.env.RESEND_API_KEY) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${c.env.RESEND_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: "LibEdge <noreply@libedge.com>",
            to: ["info@libedge.com.tr", email],
            subject,
            html: `
              <h3>${escapeHtml(subject)}</h3>
              <p><b>Ad:</b> ${escapeHtml(name)}</p>
              <p><b>Email:</b> ${escapeHtml(email)}</p>
              ${formType === "contact" ? `<p><b>Telefon:</b> ${escapeHtml(data.phone || "-")}</p>` : ""}
              ${formType === "contact" ? `<p><b>Konu:</b> ${escapeHtml(data.subject || "-")}</p>` : ""}
              <p><b>Mesaj:</b> ${escapeHtml(message || (formType === "newsletter" ? "Newsletter subscription request" : "-"))}</p>
            `
          })
        });
      } catch (emailErr) {
        console.error("Resend hatası:", emailErr.message);
      }
    }

    if (c.env.GSHEET_WEBHOOK_URL) {
      try {
        await fetch(c.env.GSHEET_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sheetPayload)
        });
      } catch (sheetErr) {
        console.error("Sheets hatası:", sheetErr.message);
      }
    }

    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ====================== ADMIN ENDPOINT'LERİ (Cookie ile güncellendi) ======================

// ====================== ADMIN ROUTES ======================
app.get('/api/admin/users', async (c) => {
  if (!await canListUsers(c)) return c.json({ error: 'Yetkisiz' }, 403);
  const db = c.env.DB;
  const role = await getUserRole(c);
  const url = new URL(c.req.url);
  const hasPagedRequest =
    url.searchParams.has('page') ||
    url.searchParams.has('page_size') ||
    url.searchParams.has('search') ||
    url.searchParams.has('role') ||
    url.searchParams.has('institution');

  const search = (url.searchParams.get('search') || '').trim().toLowerCase();
  const roleFilter = (url.searchParams.get('role') || '').trim();
  const institutionFilter = (url.searchParams.get('institution') || '').trim();
  const requestedPage = Math.max(1, Number(url.searchParams.get('page') || 1));
  const requestedPageSize = Math.max(1, Math.min(100, Number(url.searchParams.get('page_size') || 25)));

  const whereParts = [];
  const params = [];

  if (role === 'super_admin') {
    if (roleFilter) {
      whereParts.push(`u.role = ?`);
      params.push(roleFilter);
    }
    if (institutionFilter) {
      whereParts.push(`COALESCE(i.name, u.institution) = ?`);
      params.push(institutionFilter);
    }
  } else {
    const adminInstitutionId = await getUserInstitutionId(c);
    const adminInstitution = await getUserInstitution(c);
    whereParts.push(`u.role != 'super_admin'`);
    if (adminInstitutionId) {
      whereParts.push(`u.institution_id = ?`);
      params.push(adminInstitutionId);
    } else {
      whereParts.push(`u.institution = ?`);
      params.push(adminInstitution);
    }
  }

  if (search) {
    whereParts.push(`(
      LOWER(COALESCE(u.full_name, '')) LIKE ?
      OR LOWER(u.email) LIKE ?
      OR LOWER(COALESCE(i.name, u.institution, '')) LIKE ?
    )`);
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const baseSql = `
    FROM users u
    LEFT JOIN institutions i ON u.institution_id = i.id
    ${whereSql}
  `;
  const selectSql = `
    SELECT u.id, u.email, u.full_name, u.first_name, u.last_name, u.title,
           u.institution, u.institution_id, u.role, u.created_at, u.last_login,
           COALESCE(i.name, u.institution) as institution_name
    ${baseSql}
    ORDER BY u.id DESC
  `;

  if (!hasPagedRequest) {
    const users = await db.prepare(selectSql).bind(...params).all();
    return c.json(users.results);
  }

  const totalRow = await db.prepare(`SELECT COUNT(*) as total ${baseSql}`).bind(...params).first();
  const total = Number(totalRow?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / requestedPageSize));
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * requestedPageSize;

  const users = await db.prepare(`${selectSql} LIMIT ? OFFSET ?`).bind(...params, requestedPageSize, offset).all();
  const institutionsQuery = role === 'super_admin'
    ? `
      SELECT DISTINCT COALESCE(i.name, u.institution) AS institution_name
      FROM users u
      LEFT JOIN institutions i ON u.institution_id = i.id
      WHERE COALESCE(i.name, u.institution) IS NOT NULL AND COALESCE(i.name, u.institution) != ''
      ORDER BY institution_name
    `
    : `
      SELECT DISTINCT COALESCE(i.name, u.institution) AS institution_name
      FROM users u
      LEFT JOIN institutions i ON u.institution_id = i.id
      WHERE u.role != 'super_admin'
        AND COALESCE(i.name, u.institution) IS NOT NULL
        AND COALESCE(i.name, u.institution) != ''
        AND ${whereParts.some(part => part.includes('u.institution_id = ?')) ? 'u.institution_id = ?' : 'u.institution = ?'}
      ORDER BY institution_name
    `;
  const institutionParams = role === 'super_admin' ? [] : [params[0]];
  const institutionsRes = await db.prepare(institutionsQuery).bind(...institutionParams).all();

  return c.json({
    items: users.results || [],
    total,
    page,
    page_size: requestedPageSize,
    total_pages: totalPages,
    institutions: (institutionsRes.results || []).map(r => r.institution_name).filter(Boolean)
  });
});

// ====================== KULLANICI DOSYA GÖRÜNTÜLEME (ADMIN) ======================

app.get('/api/admin/users/:id/files', async (c) => {
  try {
    if (!await isAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);

    const targetUserId = Number(c.req.param('id'));
    if (!targetUserId) return c.json({ error: 'Geçersiz kullanıcı ID' }, 400);

    const db = c.env.DB;
    const role = await getUserRole(c);

    // Hedef kullanıcıyı doğrula
    const targetUser = await db.prepare(`
      SELECT u.id, u.email, u.full_name, u.institution_id, u.institution
      FROM users u WHERE u.id = ?
    `).bind(targetUserId).first();

    if (!targetUser) return c.json({ error: 'Kullanıcı bulunamadı' }, 404);

    // admin yalnızca kendi kurumundaki kullanıcıları görebilir
    if (role === 'admin') {
      const adminInstId = await getUserInstitutionId(c);
      const adminInst   = await getUserInstitution(c);
      const sameById    = adminInstId && String(targetUser.institution_id) === String(adminInstId);
      const sameByName  = adminInst   && targetUser.institution === adminInst;
      if (!sameById && !sameByName) {
        return c.json({ error: 'Bu kullanıcıya erişim yetkiniz yok' }, 403);
      }
    }

    const requestedCollectionId = c.req.query('collection_id');
    let targetCollectionId = null;

    if (requestedCollectionId) {
      // Klasörün bu kullanıcıya ait olduğunu doğrula
      const col = await db.prepare(`
        SELECT id FROM user_collections WHERE id = ? AND user_id = ?
      `).bind(Number(requestedCollectionId), targetUserId).first();
      if (!col) return c.json({ error: 'Klasör bulunamadı' }, 404);
      targetCollectionId = col.id;
    } else {
      // Kök koleksiyon (parent_id IS NULL)
      const root = await db.prepare(`
        SELECT id FROM user_collections WHERE user_id = ? AND parent_id IS NULL LIMIT 1
      `).bind(targetUserId).first();
      if (root) {
        targetCollectionId = root.id;
      } else {
        // Hiç koleksiyon yoksa boş döndür
        return c.json({
          user: { id: targetUser.id, full_name: targetUser.full_name, email: targetUser.email },
          collections: [],
          files: [],
          current_collection_id: null
        });
      }
    }

    // Tüm klasörleri getir (breadcrumb + navigasyon için)
    const allCollections = await db.prepare(`
      SELECT id, parent_id, name, created_at, sort_order,
        (SELECT COUNT(*) FROM user_collections sub WHERE sub.parent_id = uc.id) AS child_folder_count,
        (SELECT COUNT(*) FROM user_collection_files ucf2 WHERE ucf2.collection_id = uc.id) AS file_count
      FROM user_collections uc
      WHERE uc.user_id = ?
      ORDER BY uc.sort_order, uc.name
    `).bind(targetUserId).all();

    // Seçili klasördeki dosyaları getir
    const files = await db.prepare(`
      SELECT
        ucf.id,
        ucf.collection_id,
        COALESCE(ucf.display_name, f.original_name) AS file_name,
        '/api/files/' || f.file_key AS file_url,
        f.id AS file_id,
        f.file_size,
        f.mime_type,
        f.extension AS file_type,
        ucf.is_read,
        ucf.added_at,
        sender.full_name AS shared_by_name
      FROM user_collection_files ucf
      JOIN files f ON f.id = ucf.file_id
      LEFT JOIN file_shares fs ON fs.id = ucf.share_id
      LEFT JOIN users sender ON sender.id = fs.from_user_id
      WHERE ucf.collection_id = ?
      ORDER BY ucf.added_at DESC, ucf.id DESC
    `).bind(targetCollectionId).all();

    return c.json({
      user: { id: targetUser.id, full_name: targetUser.full_name, email: targetUser.email },
      collections: allCollections.results || [],
      files: files.results || [],
      current_collection_id: targetCollectionId
    });
  } catch (err) {
    console.error('admin/users/:id/files error:', err);
    return c.json({ error: 'Sunucu hatası: ' + (err?.message || String(err)) }, 500);
  }
});

app.get('/api/admin/dashboard', async (c) => {
  if (!await isAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);

  const db = c.env.DB;


  const role = await getUserRole(c);
  const adminInstitutionId = await getUserInstitutionId(c);
  const adminInstitution = await getUserInstitution(c);

  const isSuper = role === 'super_admin';
  const requestedPeriod = c.req.query('period') || 'all';
  const periodConfig = (() => {
    switch (requestedPeriod) {
      case 'today':
        return { key: 'today', label: 'Bugün', modifier: ", 'start of day'" };
      case '7d':
        return { key: '7d', label: 'Son 7 Gün', modifier: ", '-6 day', 'start of day'" };
      case '30d':
        return { key: '30d', label: 'Son 30 Gün', modifier: ", '-29 day', 'start of day'" };
      case '90d':
        return { key: '90d', label: 'Son 90 Gün', modifier: ", '-89 day', 'start of day'" };
      default:
        return { key: 'all', label: 'Tüm Zamanlar', modifier: '' };
    }
  })();
  const appendCondition = (baseClause, extraCondition) => {
    if (!extraCondition) return baseClause;
    return baseClause ? `${baseClause} AND ${extraCondition}` : `WHERE ${extraCondition}`;
  };
  const getPeriodCondition = (columnName) => (
    periodConfig.key === 'all'
      ? ''
      : `date(${columnName}) >= date('now'${periodConfig.modifier})`
  );

  const userScope = isSuper
    ? { clause: '', bindings: [] }
    : adminInstitutionId
      ? { clause: "WHERE u.institution_id = ? AND u.role != 'super_admin'", bindings: [adminInstitutionId] }
      : { clause: "WHERE u.institution = ? AND u.role != 'super_admin'", bindings: [adminInstitution] };

  const institutionScope = isSuper
    ? { clause: '', bindings: [] }
    : adminInstitutionId
      ? { clause: 'WHERE i.id = ?', bindings: [adminInstitutionId] }
      : { clause: 'WHERE i.name = ?', bindings: [adminInstitution] };

  const submissionScope = isSuper
    ? { clause: '', bindings: [] }
    : adminInstitution
      ? { clause: 'WHERE institution = ?', bindings: [adminInstitution] }
      : { clause: 'WHERE 1 = 0', bindings: [] };

  const userPeriodClause = appendCondition(userScope.clause, getPeriodCondition('u.created_at'));
  const institutionPeriodClause = appendCondition(institutionScope.clause, getPeriodCondition('i.created_at'));
  const submissionPeriodClause = appendCondition(submissionScope.clause, getPeriodCondition('submitted_at'));
  const subscriptionPeriodClause = appendCondition(userScope.clause, getPeriodCondition('s.created_at'));
  const institutionSubscriptionPeriodClause = appendCondition(institutionScope.clause, getPeriodCondition('is2.created_at'));
  const announcementPeriodClause = appendCondition('', getPeriodCondition('published_at'));

  const userCountRow = await db.prepare(`
    SELECT COUNT(*) as count
    FROM users u
    ${userPeriodClause}
  `).bind(...userScope.bindings).first();

  const todayRegistrationsRow = await db.prepare(`
    SELECT COUNT(*) as count
    FROM users u
    ${userPeriodClause}
  `).bind(...userScope.bindings).first();

  const recentUsersRows = await db.prepare(`
    SELECT u.id, u.full_name, u.email, u.institution, u.created_at
    FROM users u
    ${userPeriodClause}
    ORDER BY u.created_at DESC, u.id DESC
    LIMIT 5
  `).bind(...userScope.bindings).all();

  const institutionsCountRow = await db.prepare(`
    SELECT COUNT(*) as count
    FROM institutions i
    ${institutionPeriodClause}
  `).bind(...institutionScope.bindings).first();

  const activeIndividualRow = await db.prepare(`
    SELECT COUNT(*) as count
    FROM subscriptions s
    LEFT JOIN users u ON s.user_id = u.id
    ${appendCondition(subscriptionPeriodClause, `s.status = 'active'`)}
  `).bind(...userScope.bindings).first();

  const activeInstitutionRow = await db.prepare(`
    SELECT COUNT(*) as count
    FROM institution_subscriptions is2
    LEFT JOIN institutions i ON is2.institution_id = i.id
    ${appendCondition(institutionSubscriptionPeriodClause, `is2.status = 'active'`)}
  `).bind(...institutionScope.bindings).first();

  const trialRequestsRow = await db.prepare(`
    SELECT COUNT(*) as count
    FROM form_submissions
    ${appendCondition(submissionPeriodClause, `form_type = 'trial'`)}
  `).bind(...submissionScope.bindings).first();

  const pendingRequestsRow = await db.prepare(`
    SELECT COUNT(*) as count
    FROM form_submissions
    ${appendCondition(submissionPeriodClause, `status = 'pending'`)}
  `).bind(...submissionScope.bindings).first();

  const usersWithoutInstitutionRow = await db.prepare(`
    SELECT COUNT(*) as count
    FROM users u
    ${isSuper ? "WHERE (u.institution_id IS NULL AND (u.institution IS NULL OR TRIM(u.institution) = ''))" : `${userScope.clause} AND (u.institution_id IS NULL OR COALESCE(TRIM(u.institution), '') = '')`}
  `).bind(...userScope.bindings).first();

  const expiringIndividualRows = await db.prepare(`
    SELECT COUNT(*) as count
    FROM subscriptions s
    LEFT JOIN users u ON s.user_id = u.id
    ${userScope.clause ? `${userScope.clause} AND ` : 'WHERE '}s.status IN ('active', 'trial')
      AND s.end_date IS NOT NULL
      AND date(s.end_date) >= date('now')
      AND date(s.end_date) <= date('now', '+7 day')
  `).bind(...userScope.bindings).first();

  const expiringInstitutionRows = await db.prepare(`
    SELECT COUNT(*) as count
    FROM institution_subscriptions is2
    LEFT JOIN institutions i ON is2.institution_id = i.id
    ${institutionScope.clause ? `${institutionScope.clause} AND ` : 'WHERE '}is2.status IN ('active', 'trial')
      AND is2.end_date IS NOT NULL
      AND date(is2.end_date) >= date('now')
      AND date(is2.end_date) <= date('now', '+7 day')
  `).bind(...institutionScope.bindings).first();

  const recentUsersActivity = await db.prepare(`
    SELECT u.id, u.full_name, u.email, u.created_at
    FROM users u
    ${userPeriodClause}
    ORDER BY u.created_at DESC, u.id DESC
    LIMIT 4
  `).bind(...userScope.bindings).all();

  const recentInstitutionsActivity = await db.prepare(`
    SELECT i.id, i.name, i.created_at
    FROM institutions i
    ${institutionPeriodClause}
    ORDER BY i.created_at DESC, i.id DESC
    LIMIT 3
  `).bind(...institutionScope.bindings).all();

  const recentAnnouncementsActivity = await db.prepare(`
    SELECT id, title, published_at
    FROM announcements
    ${announcementPeriodClause}
    ORDER BY published_at DESC, id DESC
    LIMIT 3
  `).all();

  const recentIndividualSubscriptions = await db.prepare(`
    SELECT s.id, s.product_slug, s.status, s.created_at, u.full_name
    FROM subscriptions s
    LEFT JOIN users u ON s.user_id = u.id
    ${appendCondition(subscriptionPeriodClause, '1 = 1')}
    ORDER BY s.created_at DESC, s.id DESC
    LIMIT 4
  `).bind(...userScope.bindings).all();

  const recentInstitutionSubscriptions = await db.prepare(`
    SELECT is2.id, is2.product_slug, is2.status, is2.created_at, i.name as institution_name
    FROM institution_subscriptions is2
    LEFT JOIN institutions i ON is2.institution_id = i.id
    ${appendCondition(institutionSubscriptionPeriodClause, '1 = 1')}
    ORDER BY is2.created_at DESC, is2.id DESC
    LIMIT 4
  `).bind(...institutionScope.bindings).all();

  const activity = [
    ...(recentUsersActivity.results || []).map(row => ({
      type: 'user',
      icon: 'fas fa-user-plus',
      title: row.full_name || row.email,
      meta: 'Yeni kullanıcı eklendi',
      created_at: row.created_at
    })),
    ...(recentInstitutionsActivity.results || []).map(row => ({
      type: 'institution',
      icon: 'fas fa-building',
      title: row.name,
      meta: 'Yeni kurum kaydı',
      created_at: row.created_at
    })),
    ...(recentAnnouncementsActivity.results || []).map(row => ({
      type: 'announcement',
      icon: 'fas fa-bullhorn',
      title: row.title,
      meta: 'Yeni duyuru',
      created_at: row.published_at
    })),
    ...(recentIndividualSubscriptions.results || []).map(row => ({
      type: 'subscription',
      icon: 'fas fa-ticket-alt',
      title: row.full_name || 'Kullanıcı aboneliği',
      meta: `${row.product_slug} aboneliği (${row.status})`,
      created_at: row.created_at
    })),
    ...(recentInstitutionSubscriptions.results || []).map(row => ({
      type: 'institution_subscription',
      icon: 'fas fa-building-circle-check',
      title: row.institution_name || 'Kurum aboneliği',
      meta: `${row.product_slug} kurum aboneliği (${row.status})`,
      created_at: row.created_at
    }))
  ]
    .filter(item => item.created_at)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 10);

  // Dönemden bağımsız toplam sayılar (delta için)
  const totalUsersRow = await db.prepare(`
    SELECT COUNT(*) as count FROM users u ${userScope.clause}
  `).bind(...userScope.bindings).first();

  const totalInstitutionsRow = await db.prepare(`
    SELECT COUNT(*) as count FROM institutions i ${institutionScope.clause}
  `).bind(...institutionScope.bindings).first();

  const publishedAnnouncementsRow = await db.prepare(`
    SELECT COUNT(*) as count FROM announcements WHERE is_published = 1
  `).first();

  const draftAnnouncementsRow = await db.prepare(`
    SELECT COUNT(*) as count FROM announcements WHERE is_published = 0
  `).first();

  const stats = {
    users: userCountRow?.count || 0,
    total_users: totalUsersRow?.count || 0,
    active_subscriptions: (activeIndividualRow?.count || 0) + (activeInstitutionRow?.count || 0),
    trial_requests: trialRequestsRow?.count || 0,
    institutions: institutionsCountRow?.count || 0,
    total_institutions: totalInstitutionsRow?.count || 0,
    pending_requests: pendingRequestsRow?.count || 0,
    today_registrations: todayRegistrationsRow?.count || 0,
    active_institution_subscriptions: activeInstitutionRow?.count || 0,
    published_announcements: publishedAnnouncementsRow?.count || 0,
    draft_announcements: draftAnnouncementsRow?.count || 0
  };

  const actions = [
    {
      key: 'expiring_subscriptions',
      label: 'Yakında bitecek abonelikler',
      count: (expiringIndividualRows?.count || 0) + (expiringInstitutionRows?.count || 0),
      description: '7 gün içinde süresi dolacak aktif/deneme abonelikler',
      tab: 'subscriptions'
    },
    {
      key: 'users_without_institution',
      label: 'Kurumsuz kullanıcılar',
      count: usersWithoutInstitutionRow?.count || 0,
      description: 'Kurum bilgisi eksik kullanıcı kayıtları',
      tab: 'users'
    },
    {
      key: 'pending_requests',
      label: 'Bekleyen talepler',
      count: pendingRequestsRow?.count || 0,
      description: isSuper ? 'Henüz işleme alınmamış formlar' : 'Sadece Super Admin tarafından yönetilir',
      tab: isSuper ? 'requests' : null
    }
  ];

  return c.json({
    success: true,
    period: {
      key: periodConfig.key,
      label: periodConfig.label
    },
    stats,
    actions,
    activity,
    recent_users: recentUsersRows.results || []
  });
});

app.post('/api/admin/user', async (c) => {
  if (!await isAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);
  const { email, password, full_name, first_name, last_name, title, institution, institution_id, role } = await c.req.json();
  const db = c.env.DB;

  const adminRole = await getUserRole(c);
  const adminInstitutionId = await getUserInstitutionId(c);
  const adminInstitution = await getUserInstitution(c);
  const normalizedEmail = email?.toLowerCase().trim();
  const profileFields = normalizeUserProfileFields({ full_name, first_name, last_name, title });

  if (!normalizedEmail) {
    return c.json({ error: 'E-posta zorunludur' }, 400);
  }

  // institution_id veya institution string'inden her iki değeri de resolve et
  let finalInstitutionId = institution_id ? parseInt(institution_id) : null;
  let finalInstitution = institution || null;
  if (finalInstitutionId && !finalInstitution) {
    const inst = await db.prepare(`SELECT name FROM institutions WHERE id = ?`).bind(finalInstitutionId).first();
    finalInstitution = inst?.name || null;
  } else if (finalInstitution && !finalInstitutionId) {
    const inst = await db.prepare(`SELECT id FROM institutions WHERE name = ?`).bind(finalInstitution).first();
    finalInstitutionId = inst?.id || null;
  }

  if (adminRole === 'admin') {
    if (adminInstitutionId && finalInstitutionId && finalInstitutionId !== adminInstitutionId) {
      return c.json({ error: 'Kendi kurumunuz dışında kullanıcı ekleyemezsiniz' }, 403);
    }
    finalInstitutionId = adminInstitutionId;
    finalInstitution = adminInstitution;

    // Email domain kontrolü
    const emailDomain = normalizedEmail?.split('@')[1]?.toLowerCase();
    if (emailDomain && finalInstitution) {
      const inst = await db.prepare(`SELECT domain FROM institutions WHERE name = ?`).bind(finalInstitution).first();
      if (inst?.domain) {
        const allowedDomains = inst.domain.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
        if (allowedDomains.length && !allowedDomains.includes(emailDomain)) {
          return c.json({ error: "Bu e-posta adresi kurumunuzun domain'iyle eşleşmiyor" }, 400);
        }
      }
    }
  }

  const finalRole = (role === 'admin' && adminRole !== 'super_admin') ? 'user' : (role || 'user');
  const password_hash = await hashPassword(password || randomPassword());
  await db.prepare(`
    INSERT INTO users (email, password_hash, full_name, first_name, last_name, title, institution, institution_id, role)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(
      normalizedEmail,
      password_hash,
      profileFields.full_name,
      profileFields.first_name,
      profileFields.last_name,
      profileFields.title,
      finalInstitution,
      finalInstitutionId,
      finalRole
    ).run();
  return c.json({ success: true });
});

app.put('/api/admin/user/:id', async (c) => {
  if (!await isAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);
  const id = c.req.param('id');
  const { email, password, full_name, first_name, last_name, title, institution, institution_id, role } = await c.req.json();
  const db = c.env.DB;

  const adminRole = await getUserRole(c);
  const adminInstitutionId = await getUserInstitutionId(c);
  const adminInstitution = await getUserInstitution(c);
  const normalizedEmail = email?.toLowerCase().trim();
  const profileFields = normalizeUserProfileFields({ full_name, first_name, last_name, title });
  if (!normalizedEmail) {
    return c.json({ error: 'E-posta zorunludur' }, 400);
  }

  if (adminRole === 'admin' && !await canAccessUser(c, id)) {
    return c.json({ error: 'Sadece kendi kurumunuzdaki kullanıcıları düzenleyebilirsiniz' }, 403);
  }

  // institution_id veya institution string'inden her iki değeri de resolve et
  let finalInstitutionId = institution_id ? parseInt(institution_id) : null;
  let finalInstitution = institution || null;
  if (finalInstitutionId && !finalInstitution) {
    const inst = await db.prepare(`SELECT name FROM institutions WHERE id = ?`).bind(finalInstitutionId).first();
    finalInstitution = inst?.name || null;
  } else if (finalInstitution && !finalInstitutionId) {
    const inst = await db.prepare(`SELECT id FROM institutions WHERE name = ?`).bind(finalInstitution).first();
    finalInstitutionId = inst?.id || null;
  }

  if (adminRole === 'admin') {
    finalInstitutionId = adminInstitutionId;
    finalInstitution = adminInstitution;
  }

  const isSuper = adminRole === 'super_admin';
  const finalRole = (role && role !== 'user' && !isSuper) ? null : role;

  if (password) {
    const password_hash = await hashPassword(password);
    if (finalRole) {
      await db.prepare(`UPDATE users SET email=?, password_hash=?, full_name=?, first_name=?, last_name=?, title=?, institution=?, institution_id=?, role=? WHERE id=?`)
        .bind(normalizedEmail, password_hash, profileFields.full_name, profileFields.first_name, profileFields.last_name, profileFields.title, finalInstitution, finalInstitutionId, finalRole, id).run();
    } else {
      await db.prepare(`UPDATE users SET email=?, password_hash=?, full_name=?, first_name=?, last_name=?, title=?, institution=?, institution_id=? WHERE id=?`)
        .bind(normalizedEmail, password_hash, profileFields.full_name, profileFields.first_name, profileFields.last_name, profileFields.title, finalInstitution, finalInstitutionId, id).run();
    }
  } else {
    if (finalRole) {
      await db.prepare(`UPDATE users SET email=?, full_name=?, first_name=?, last_name=?, title=?, institution=?, institution_id=?, role=? WHERE id=?`)
        .bind(normalizedEmail, profileFields.full_name, profileFields.first_name, profileFields.last_name, profileFields.title, finalInstitution, finalInstitutionId, finalRole, id).run();
    } else {
      await db.prepare(`UPDATE users SET email=?, full_name=?, first_name=?, last_name=?, title=?, institution=?, institution_id=? WHERE id=?`)
        .bind(normalizedEmail, profileFields.full_name, profileFields.first_name, profileFields.last_name, profileFields.title, finalInstitution, finalInstitutionId, id).run();
    }
  }
  return c.json({ success: true });
});

app.delete('/api/admin/user/:id', async (c) => {
  if (!await isAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);
  
  const id = c.req.param('id');
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  
  const currentUserId = auth.user.user_id;
  const adminRole = await getUserRole(c);
  
  if (adminRole === 'admin' && !await canAccessUser(c, id)) {
    return c.json({ error: 'Sadece kendi kurumunuzdaki kullanıcıları silebilirsiniz' }, 403);
  }
  
  if (String(currentUserId) === String(id) && adminRole === 'super_admin') {
    return c.json({ error: 'Super admin kendini silemez' }, 400);
  }

  const db = c.env.DB;


  await db.prepare(`DELETE FROM newsletter_subscriptions WHERE user_id = ?`).bind(id).run();
  await db.prepare(`DELETE FROM subscriptions WHERE user_id=?`).bind(id).run();
  await db.prepare(`DELETE FROM users WHERE id=?`).bind(id).run();
  
  return c.json({ success: true });
});

app.post('/api/admin/set-role/:id', async (c) => {
  if (!await isSuperAdmin(c)) return c.json({ error: 'Sadece Super Admin' }, 403);
  const id = c.req.param('id');
  const { role } = await c.req.json();
  const db = c.env.DB;
  await db.prepare(`UPDATE users SET role = ? WHERE id = ?`).bind(role, id).run();
  return c.json({ success: true });
});

app.get('/api/admin/products', async (c) => {
  if (!await isSuperAdmin(c)) return c.json({ error: 'Sadece Super Admin' }, 403);
  const db = c.env.DB;
  await ensureProductsTableAndSeed(db);
  const rows = await db.prepare(`
    SELECT slug, name, category, region,
           default_access_type, default_access_url,
           COALESCE(default_requires_institution_email, 0) AS default_requires_institution_email,
           COALESCE(default_requires_vpn, 0) AS default_requires_vpn,
           default_access_notes_tr, default_access_notes_en
    FROM products
    ORDER BY name COLLATE NOCASE ASC
  `).all();
  return c.json(rows.results || []);
});

app.get('/api/admin/runtime-info', async (c) => {
  if (!await isAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);
  return c.json({
    environment: c.env?.ENVIRONMENT || 'unknown',
    worker_name: c.env?.WORKER_NAME || 'unknown',
    api_base: '',
    has_worker_base_url: !!c.env?.WORKER_BASE_URL
  });
});

app.put('/api/admin/product/:slug', async (c) => {
  if (!await isSuperAdmin(c)) return c.json({ error: 'Sadece Super Admin' }, 403);
  const slug = String(c.req.param('slug') || '').trim();
  if (!slug) return c.json({ error: 'Geçersiz ürün slug' }, 400);

  const {
    name, category, region,
    default_access_type, default_access_url,
    default_requires_institution_email, default_requires_vpn,
    default_access_notes_tr, default_access_notes_en
  } = await c.req.json();

  const validAccessTypes = ['direct', 'ip', 'proxy', 'sso', 'institution_link', 'email_password_external', 'mixed'];
  const db = c.env.DB;
  await ensureProductsTableAndSeed(db);

  const existing = await db.prepare(`SELECT slug FROM products WHERE slug = ?`).bind(slug).first();
  if (!existing) return c.json({ error: 'Ürün bulunamadı' }, 404);

  await db.prepare(`
    UPDATE products
    SET name = ?, category = ?, region = ?,
        default_access_type = ?, default_access_url = ?,
        default_requires_institution_email = ?, default_requires_vpn = ?,
        default_access_notes_tr = ?, default_access_notes_en = ?
    WHERE slug = ?
  `).bind(
    String(name || '').trim() || slug,
    String(category || '').trim() || null,
    String(region || '').trim() || null,
    validAccessTypes.includes(default_access_type) ? default_access_type : null,
    String(default_access_url || '').trim() || null,
    default_requires_institution_email ? 1 : 0,
    default_requires_vpn ? 1 : 0,
    String(default_access_notes_tr || '').trim() || null,
    String(default_access_notes_en || '').trim() || null,
    slug
  ).run();

  return c.json({ success: true });
});

app.get('/api/admin/subscriptions', async (c) => {
  if (!await isAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);
  const db = c.env.DB;
  await ensureInstitutionSubscriptionAccessColumns(db);
  await ensureProductsTableAndSeed(db);
  const role = await getUserRole(c);
  const adminInstitutionId = await getUserInstitutionId(c);
  const adminInstitution = await getUserInstitution(c);
  const url = new URL(c.req.url);
  const hasPagedRequest =
    url.searchParams.has('page') ||
    url.searchParams.has('page_size') ||
    url.searchParams.has('search') ||
    url.searchParams.has('type') ||
    url.searchParams.has('status');
  const requestedPage = Math.max(1, Number(url.searchParams.get('page') || 1));
  const requestedPageSize = Math.max(1, Math.min(100, Number(url.searchParams.get('page_size') || 25)));
  const search = (url.searchParams.get('search') || '').trim().toLowerCase();
  const typeFilter = (url.searchParams.get('type') || '').trim();
  const statusFilter = (url.searchParams.get('status') || '').trim();

  let individualResults = [], institutionalResults = [];

  try {
    if (role === 'super_admin') {
      const individual = await db.prepare(`
        SELECT s.id, 'individual' as type, s.product_slug, s.status, s.start_date, s.end_date,
               u.full_name as subject_name, u.institution as institution_name, s.user_id
        FROM subscriptions s LEFT JOIN users u ON s.user_id = u.id ORDER BY s.id DESC
      `).all();
      individualResults = individual.results || [];
    } else {
      const individual = adminInstitutionId
        ? await db.prepare(`
            SELECT s.id, 'individual' as type, s.product_slug, s.status, s.start_date, s.end_date,
                   u.full_name as subject_name, u.institution as institution_name, s.user_id
            FROM subscriptions s LEFT JOIN users u ON s.user_id = u.id
            WHERE u.institution_id = ? ORDER BY s.id DESC
          `).bind(adminInstitutionId).all()
        : await db.prepare(`
            SELECT s.id, 'individual' as type, s.product_slug, s.status, s.start_date, s.end_date,
                   u.full_name as subject_name, u.institution as institution_name, s.user_id
            FROM subscriptions s LEFT JOIN users u ON s.user_id = u.id
            WHERE u.institution = ? ORDER BY s.id DESC
          `).bind(adminInstitution).all();
      individualResults = individual.results || [];
    }
  } catch (e) {
    console.error('subscriptions individual query error:', e.message);
  }

  try {
    if (role === 'super_admin') {
      const institutional = await db.prepare(`
        SELECT is2.id, 'institution' as type, is2.product_slug, is2.status, is2.start_date, is2.end_date,
               is2.access_type AS raw_access_type,
               is2.access_url AS raw_access_url,
               COALESCE(is2.requires_institution_email, 0) AS raw_requires_institution_email,
               COALESCE(is2.requires_vpn, 0) AS raw_requires_vpn,
               is2.access_notes_tr AS raw_access_notes_tr,
               is2.access_notes_en AS raw_access_notes_en,
               COALESCE(NULLIF(TRIM(is2.access_type), ''), p.default_access_type) AS access_type,
               COALESCE(NULLIF(TRIM(is2.access_url), ''), p.default_access_url) AS access_url,
               CASE WHEN COALESCE(is2.requires_institution_email, 0) = 1 OR COALESCE(p.default_requires_institution_email, 0) = 1 THEN 1 ELSE 0 END AS requires_institution_email,
               CASE WHEN COALESCE(is2.requires_vpn, 0) = 1 OR COALESCE(p.default_requires_vpn, 0) = 1 THEN 1 ELSE 0 END AS requires_vpn,
               COALESCE(NULLIF(TRIM(is2.access_notes_tr), ''), p.default_access_notes_tr) AS access_notes_tr,
               COALESCE(NULLIF(TRIM(is2.access_notes_en), ''), p.default_access_notes_en) AS access_notes_en,
               i.name as subject_name, i.name as institution_name, NULL as user_id
        FROM institution_subscriptions is2
        LEFT JOIN institutions i ON is2.institution_id = i.id
        LEFT JOIN products p ON p.slug = is2.product_slug
        ORDER BY is2.id DESC
      `).all();
      institutionalResults = institutional.results || [];
    } else if (adminInstitutionId) {
      const institutional = await db.prepare(`
        SELECT is2.id, 'institution' as type, is2.product_slug, is2.status, is2.start_date, is2.end_date,
               is2.access_type AS raw_access_type,
               is2.access_url AS raw_access_url,
               COALESCE(is2.requires_institution_email, 0) AS raw_requires_institution_email,
               COALESCE(is2.requires_vpn, 0) AS raw_requires_vpn,
               is2.access_notes_tr AS raw_access_notes_tr,
               is2.access_notes_en AS raw_access_notes_en,
               COALESCE(NULLIF(TRIM(is2.access_type), ''), p.default_access_type) AS access_type,
               COALESCE(NULLIF(TRIM(is2.access_url), ''), p.default_access_url) AS access_url,
               CASE WHEN COALESCE(is2.requires_institution_email, 0) = 1 OR COALESCE(p.default_requires_institution_email, 0) = 1 THEN 1 ELSE 0 END AS requires_institution_email,
               CASE WHEN COALESCE(is2.requires_vpn, 0) = 1 OR COALESCE(p.default_requires_vpn, 0) = 1 THEN 1 ELSE 0 END AS requires_vpn,
               COALESCE(NULLIF(TRIM(is2.access_notes_tr), ''), p.default_access_notes_tr) AS access_notes_tr,
               COALESCE(NULLIF(TRIM(is2.access_notes_en), ''), p.default_access_notes_en) AS access_notes_en,
               i.name as subject_name, i.name as institution_name, NULL as user_id
        FROM institution_subscriptions is2
        LEFT JOIN institutions i ON is2.institution_id = i.id
        LEFT JOIN products p ON p.slug = is2.product_slug
        WHERE is2.institution_id = ? ORDER BY is2.id DESC
      `).bind(adminInstitutionId).all();
      institutionalResults = institutional.results || [];
    }
  } catch (e) {
    // Tablo henüz oluşturulmamış olabilir (migration bekliyor)
    console.error('institution_subscriptions query error:', e.message);
  }

  let allResults = [...institutionalResults, ...individualResults];

  if (typeFilter) {
    allResults = allResults.filter(item => item.type === typeFilter);
  }
  if (statusFilter) {
    allResults = allResults.filter(item => item.status === statusFilter);
  }
  if (search) {
    allResults = allResults.filter(item => {
      const haystack = [
        item.subject_name || '',
        item.institution_name || '',
        item.product_slug || ''
      ].join(' ').toLowerCase();
      return haystack.includes(search);
    });
  }

  allResults.sort((a, b) => Number(b.id) - Number(a.id));
  if (!hasPagedRequest) {
    return c.json(allResults);
  }

  const total = allResults.length;
  const totalPages = Math.max(1, Math.ceil(total / requestedPageSize));
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * requestedPageSize;

  return c.json({
    items: allResults.slice(offset, offset + requestedPageSize),
    total,
    page,
    page_size: requestedPageSize,
    total_pages: totalPages
  });
});

app.post('/api/admin/subscription', async (c) => {
  if (!await isAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);
  const { user_id, product_slug, status, end_date } = await c.req.json();
  const db = c.env.DB;
  await ensureProductsTableAndSeed(db);
  const role = await getUserRole(c);
  const adminInstitution = await getUserInstitution(c);
  const productExists = await db.prepare(`SELECT slug FROM products WHERE slug = ?`).bind(product_slug).first();
  if (!productExists) return c.json({ error: 'Geçersiz ürün' }, 400);
  
  if (role === 'admin') {
    const targetUser = await db.prepare(`SELECT institution FROM users WHERE id = ?`).bind(user_id).first();
    if (!targetUser || targetUser.institution !== adminInstitution) {
      return c.json({ error: 'Sadece kendi kurumunuzdaki kullanıcılara abonelik ekleyebilirsiniz' }, 403);
    }
  }
  
  await db.prepare(`INSERT INTO subscriptions (user_id, product_slug, status, end_date) VALUES (?, ?, ?, ?)`).bind(user_id, product_slug, status, end_date || null).run();
  return c.json({ success: true });
});

app.put('/api/admin/subscription/:id', async (c) => {
  if (!await isAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);
  const id = Number(c.req.param('id'));
  if (!id) return c.json({ error: 'Geçersiz abonelik id' }, 400);

  const { user_id, product_slug, status, end_date } = await c.req.json();
  const db = c.env.DB;
  await ensureProductsTableAndSeed(db);
  const role = await getUserRole(c);
  const adminInstitution = await getUserInstitution(c);
  const productExists = await db.prepare(`SELECT slug FROM products WHERE slug = ?`).bind(product_slug).first();
  if (!productExists) return c.json({ error: 'Geçersiz ürün' }, 400);

  const existing = await db.prepare(`
    SELECT s.id, u.institution
    FROM subscriptions s
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.id = ?
  `).bind(id).first();
  if (!existing) return c.json({ error: 'Abonelik bulunamadı' }, 404);

  if (role === 'admin') {
    const targetUser = await db.prepare(`SELECT institution FROM users WHERE id = ?`).bind(user_id).first();
    if (!targetUser || targetUser.institution !== adminInstitution || existing.institution !== adminInstitution) {
      return c.json({ error: 'Sadece kendi kurumunuzdaki kullanıcı aboneliklerini düzenleyebilirsiniz' }, 403);
    }
  }

  await db.prepare(`
    UPDATE subscriptions
    SET user_id = ?, product_slug = ?, status = ?, end_date = ?
    WHERE id = ?
  `).bind(user_id, product_slug, status || 'active', end_date || null, id).run();

  return c.json({ success: true });
});

app.delete('/api/admin/subscription/:id', async (c) => {
  if (!await isAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);
  const id = c.req.param('id');
  const db = c.env.DB;
  const role = await getUserRole(c);
  const adminInstitution = await getUserInstitution(c);
  
  if (role === 'admin') {
    const sub = await db.prepare(`
      SELECT u.institution FROM subscriptions s LEFT JOIN users u ON s.user_id = u.id WHERE s.id = ?
    `).bind(id).first();
    if (!sub || sub.institution !== adminInstitution) {
      return c.json({ error: 'Sadece kendi kurumunuzdaki abonelikleri silebilirsiniz' }, 403);
    }
  }
  
  await db.prepare(`DELETE FROM subscriptions WHERE id=?`).bind(id).run();
  return c.json({ success: true });
});

// ====================== KURUM ABONELİK YÖNETİMİ ======================

app.post('/api/admin/institution-subscription', async (c) => {
  if (!await isSuperAdmin(c)) return c.json({ error: 'Sadece Super Admin' }, 403);
  const auth = await requireAuth(c);
  const { institution_id, product_slug, status, end_date, access_type, access_url, requires_institution_email, requires_vpn, access_notes_tr, access_notes_en } = await c.req.json();
  if (!institution_id || !product_slug) return c.json({ error: 'institution_id ve product_slug zorunlu' }, 400);
  const db = c.env.DB;
  await ensureProductsTableAndSeed(db);
  await ensureInstitutionSubscriptionAccessColumns(db);
  const productExists = await db.prepare(`SELECT slug FROM products WHERE slug = ?`).bind(product_slug).first();
  if (!productExists) return c.json({ error: 'Geçersiz ürün' }, 400);
  const validAccessTypes = ['direct', 'ip', 'proxy', 'sso', 'institution_link', 'email_password_external', 'mixed'];
  await db.prepare(`
    INSERT INTO institution_subscriptions (
      institution_id, product_slug, status, end_date, created_by,
      access_type, access_url, requires_institution_email, requires_vpn, access_notes_tr, access_notes_en
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    parseInt(institution_id),
    product_slug,
    status || 'active',
    end_date || null,
    auth.user.user_id,
    validAccessTypes.includes(access_type) ? access_type : null,
    String(access_url || '').trim() || null,
    requires_institution_email ? 1 : 0,
    requires_vpn ? 1 : 0,
    String(access_notes_tr || '').trim() || null,
    String(access_notes_en || '').trim() || null
  ).run();
  return c.json({ success: true });
});

app.put('/api/admin/institution-subscription/:id', async (c) => {
  if (!await isSuperAdmin(c)) return c.json({ error: 'Sadece Super Admin' }, 403);
  const id = Number(c.req.param('id'));
  if (!id) return c.json({ error: 'Geçersiz abonelik id' }, 400);
  const { institution_id, product_slug, status, end_date, access_type, access_url, requires_institution_email, requires_vpn, access_notes_tr, access_notes_en } = await c.req.json();
  if (!institution_id || !product_slug) return c.json({ error: 'institution_id ve product_slug zorunlu' }, 400);
  const db = c.env.DB;
  await ensureProductsTableAndSeed(db);
  await ensureInstitutionSubscriptionAccessColumns(db);
  const productExists = await db.prepare(`SELECT slug FROM products WHERE slug = ?`).bind(product_slug).first();
  if (!productExists) return c.json({ error: 'Geçersiz ürün' }, 400);
  const validAccessTypes = ['direct', 'ip', 'proxy', 'sso', 'institution_link', 'email_password_external', 'mixed'];

  const existing = await db.prepare(`SELECT id FROM institution_subscriptions WHERE id = ?`).bind(id).first();
  if (!existing) return c.json({ error: 'Abonelik bulunamadı' }, 404);

  await db.prepare(`
    UPDATE institution_subscriptions
    SET institution_id = ?, product_slug = ?, status = ?, end_date = ?,
        access_type = ?, access_url = ?, requires_institution_email = ?, requires_vpn = ?, access_notes_tr = ?, access_notes_en = ?
    WHERE id = ?
  `).bind(
    parseInt(institution_id),
    product_slug,
    status || 'active',
    end_date || null,
    validAccessTypes.includes(access_type) ? access_type : null,
    String(access_url || '').trim() || null,
    requires_institution_email ? 1 : 0,
    requires_vpn ? 1 : 0,
    String(access_notes_tr || '').trim() || null,
    String(access_notes_en || '').trim() || null,
    id
  ).run();

  return c.json({ success: true });
});

app.get('/api/admin/institution/:id/subscriptions', async (c) => {
  if (!await isAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);
  const role = await getUserRole(c);
  const institutionId = parseInt(c.req.param('id'));
  if (role === 'admin') {
    const adminInstId = await getUserInstitutionId(c);
    if (adminInstId !== institutionId) return c.json({ error: 'Sadece kendi kurumunuzu görebilirsiniz' }, 403);
  }
  const db = c.env.DB;
  await ensureInstitutionSubscriptionAccessColumns(db);
  await ensureProductsTableAndSeed(db);
  const subs = await db.prepare(`
    SELECT is2.id, is2.institution_id, is2.product_slug, is2.status, is2.start_date, is2.end_date, is2.created_by, is2.created_at,
           COALESCE(NULLIF(TRIM(is2.access_type), ''), p.default_access_type) AS access_type,
           COALESCE(NULLIF(TRIM(is2.access_url), ''), p.default_access_url) AS access_url,
           CASE WHEN COALESCE(is2.requires_institution_email, 0) = 1 OR COALESCE(p.default_requires_institution_email, 0) = 1 THEN 1 ELSE 0 END AS requires_institution_email,
           CASE WHEN COALESCE(is2.requires_vpn, 0) = 1 OR COALESCE(p.default_requires_vpn, 0) = 1 THEN 1 ELSE 0 END AS requires_vpn,
           COALESCE(NULLIF(TRIM(is2.access_notes_tr), ''), p.default_access_notes_tr) AS access_notes_tr,
           COALESCE(NULLIF(TRIM(is2.access_notes_en), ''), p.default_access_notes_en) AS access_notes_en,
           i.name as institution_name
    FROM institution_subscriptions is2
    LEFT JOIN institutions i ON is2.institution_id = i.id
    LEFT JOIN products p ON p.slug = is2.product_slug
    WHERE is2.institution_id = ? ORDER BY is2.id DESC
  `).bind(institutionId).all();
  return c.json(subs.results);
});

app.delete('/api/admin/institution-subscription/:id', async (c) => {
  if (!await isSuperAdmin(c)) return c.json({ error: 'Sadece Super Admin' }, 403);
  const id = c.req.param('id');
  const db = c.env.DB;
  const sub = await db.prepare(`SELECT id FROM institution_subscriptions WHERE id = ?`).bind(id).first();
  if (!sub) return c.json({ error: 'Abonelik bulunamadı' }, 404);
  await db.prepare(`DELETE FROM institution_subscriptions WHERE id = ?`).bind(id).run();
  return c.json({ success: true });
});


// GET /api/admin/airtable/accounts
app.get('/api/admin/airtable/accounts', async (c) => {
    const auth = await requireAuth(c);
    if (auth.response) return auth.response;
    if (auth.user.role !== 'admin' && auth.user.role !== 'super_admin') {
        return c.json({ error: 'Yetkisiz' }, 403);
    }
    
    const baseId = c.env.AIRTABLE_BASE_ID;
    const pat = c.env.AIRTABLE_PAT;
    
    if (!baseId || !pat) {
        return c.json({ error: 'Airtable ayarları eksik' }, 500);
    }
    
    const url = `https://api.airtable.com/v0/${baseId}/Accounts`;
    
    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${pat}` }
        });
        const data = await response.json();
        
        if (data.error) {
            console.error('Airtable error:', data.error);
            return c.json({ error: data.error.message }, 500);
        }
        
        return c.json({
            success: true,
            records: data.records || [],
            total: data.records?.length || 0
        });
    } catch (err) {
        console.error('Airtable fetch error:', err);
        return c.json({ error: err.message }, 500);
    }
});

// ====================== KURUM DOSYA YÖNETİMİ ======================

app.get('/api/admin/my-institution', async (c) => {
  const payload = await getTokenPayloadFromCookie(c);
  if (!payload) return c.json({ error: 'Yetkisiz' }, 403);
  if (payload.role !== 'admin' && payload.role !== 'super_admin') return c.json({ error: 'Yetkisiz' }, 403);
  const db = c.env.DB;
  await ensureInstitutionMetadataColumns(db);
  await ensureInstitutionSubscriptionAccessColumns(db);
  await ensureProductsTableAndSeed(db);
  // JWT payload'undan doğrudan al
  if (!payload.institution) return c.json({ error: 'Kullanıcıya atanmış kurum yok' }, 404);
  const inst = await db.prepare(`
    SELECT id, name, domain, website_url, city, category, logo_url,
      (SELECT COUNT(*) FROM users WHERE institution = name AND role != 'super_admin') as user_count
    FROM institutions WHERE name = ?
  `).bind(payload.institution).first();
  if (!inst) return c.json({ error: 'Kurum bulunamadı' }, 404);

  const subRows = await db.prepare(`
    SELECT is2.id, is2.product_slug, is2.status, is2.start_date, is2.end_date,
           COALESCE(NULLIF(TRIM(is2.access_type), ''), p.default_access_type) AS access_type,
           COALESCE(NULLIF(TRIM(is2.access_url), ''), p.default_access_url) AS access_url,
           CASE WHEN COALESCE(is2.requires_institution_email, 0) = 1 OR COALESCE(p.default_requires_institution_email, 0) = 1 THEN 1 ELSE 0 END AS requires_institution_email,
           CASE WHEN COALESCE(is2.requires_vpn, 0) = 1 OR COALESCE(p.default_requires_vpn, 0) = 1 THEN 1 ELSE 0 END AS requires_vpn,
           COALESCE(NULLIF(TRIM(is2.access_notes_tr), ''), p.default_access_notes_tr) AS access_notes_tr,
           COALESCE(NULLIF(TRIM(is2.access_notes_en), ''), p.default_access_notes_en) AS access_notes_en
    FROM institution_subscriptions is2
    LEFT JOIN products p ON p.slug = is2.product_slug
    WHERE is2.institution_id = ? AND is2.status = 'active'
    ORDER BY is2.end_date ASC
  `).bind(inst.id).all();

  const recentUsers = await db.prepare(`
    SELECT id, full_name, email, role, created_at
    FROM users WHERE (institution_id = ? OR institution = ?) AND role != 'super_admin'
    ORDER BY created_at DESC LIMIT 5
  `).bind(inst.id, inst.name).all();

  const openTickets = await db.prepare(`
    SELECT COUNT(*) as cnt FROM support_tickets
    WHERE institution_id = ? AND status NOT IN ('resolved','closed')
  `).bind(inst.id).first();

  return c.json({
    ...inst,
    file_count: await getInstitutionFileCount(db, inst.id),
    active_subscriptions: subRows.results || [],
    recent_users: recentUsers.results || [],
    open_ticket_count: openTickets?.cnt ?? 0
  });
});

app.get('/api/admin/institutions', async (c) => {
  if (!await isAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);
  const db = c.env.DB;
  await ensureInstitutionMetadataColumns(db);
  const role = await getUserRole(c);
  const url = new URL(c.req.url);
  const search = (url.searchParams.get('search') || '').trim();
  const category = (url.searchParams.get('category') || '').trim();
  const status = (url.searchParams.get('status') || '').trim();
  const sort = (url.searchParams.get('sort') || 'name').trim();
  const order = (url.searchParams.get('order') || 'asc').trim().toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const requestedPage = Math.max(1, Number(url.searchParams.get('page') || 1));
  const requestedPageSize = Math.max(1, Math.min(100, Number(url.searchParams.get('page_size') || 25)));

  const sortColumns = {
    name: 'LOWER(inst.name)',
    city: 'LOWER(COALESCE(inst.city, \'\'))',
    user_count: 'user_count',
    file_count: 'file_count'
  };
  const sortSql = sortColumns[sort] || sortColumns.name;

  const whereParts = [];
  const params = [];
  if (search) {
    whereParts.push(`(
      LOWER(inst.name) LIKE ?
      OR LOWER(COALESCE(inst.domain, '')) LIKE ?
      OR LOWER(COALESCE(inst.city, '')) LIKE ?
    )`);
    const like = `%${search.toLowerCase()}%`;
    params.push(like, like, like);
  }
  if (category) {
    whereParts.push(`inst.category = ?`);
    params.push(category);
  }
  if (status) {
    whereParts.push(`inst.status = ?`);
    params.push(status);
  }
  const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  if (role === 'super_admin') {
    const totalRow = await db.prepare(`
      SELECT COUNT(*) AS total
      FROM institutions inst
      ${whereSql}
    `).bind(...params).first();

    const total = Number(totalRow?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / requestedPageSize));
    const page = Math.min(requestedPage, totalPages);
    const offset = (page - 1) * requestedPageSize;

    const institutions = await db.prepare(`
      SELECT
        inst.id,
        inst.name,
        inst.domain,
        inst.website_url,
        inst.city,
        inst.category,
        inst.status,
        inst.created_at,
        inst.logo_url,
        (SELECT COUNT(*) FROM users WHERE institution = inst.name) AS user_count,
        (
          SELECT COUNT(*)
          FROM collection_files cf
          JOIN collections col ON col.id = cf.collection_id
          WHERE col.scope_type = 'institution'
            AND col.scope_id = inst.id
            AND col.is_active = 1
            AND cf.is_active = 1
        ) AS file_count
      FROM institutions inst
      ${whereSql}
      ORDER BY ${sortSql} ${order}, inst.id ASC
      LIMIT ? OFFSET ?
    `).bind(...params, requestedPageSize, offset).all();

    const rows = institutions.results || [];
    for (const row of rows) {
      row.file_count = Number(row.file_count || 0);
      row.user_count = Number(row.user_count || 0);
    }
    return c.json({
      items: rows,
      total,
      page,
      page_size: requestedPageSize,
      total_pages: totalPages
    });
  } else {
    const adminInstitutionId = await getUserInstitutionId(c);
    const adminInstitution = await getUserInstitution(c);
    let inst;
    if (adminInstitutionId) {
      inst = await db.prepare(`
        SELECT inst.id, inst.name, inst.domain, inst.website_url, inst.city, inst.category, inst.status, inst.created_at, inst.logo_url,
          (SELECT COUNT(*) FROM users WHERE institution = inst.name AND role != 'super_admin') as user_count
        FROM institutions inst WHERE inst.id = ?
      `).bind(adminInstitutionId).first();
    } else if (adminInstitution) {
      inst = await db.prepare(`
        SELECT inst.id, inst.name, inst.domain, inst.website_url, inst.city, inst.category, inst.status, inst.created_at, inst.logo_url,
          (SELECT COUNT(*) FROM users WHERE institution = inst.name AND role != 'super_admin') as user_count
        FROM institutions inst WHERE inst.name = ?
      `).bind(adminInstitution).first();
    }
    if (inst) {
      inst.file_count = await getInstitutionFileCount(db, inst.id);
      inst.user_count = Number(inst.user_count || 0);
    }
    const items = inst ? [inst] : [];
    return c.json({
      items,
      total: items.length,
      page: 1,
      page_size: items.length || requestedPageSize,
      total_pages: 1
    });
  }
});

app.get('/api/admin/all-files', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  const role = auth.user.role;
  if (role !== 'super_admin' && role !== 'admin') return c.json({ error: 'Yetkisiz' }, 403);
  const db = c.env.DB;
  let files;
  if (role === 'super_admin') {
    files = await db.prepare(`
      SELECT
        cf.id,
        col.scope_id AS institution_id,
        i.name AS institution_name,
        cf.collection_id AS folder_id,
        COALESCE(cf.display_name, f.original_name) AS file_name,
        '/api/files/' || f.file_key AS file_url,
        COALESCE(f.extension, '') AS file_type,
        f.file_size,
        COALESCE(cf.category, 'other') AS category,
        cf.is_public,
        cf.added_by AS uploaded_by,
        cf.added_at AS uploaded_at,
        u.full_name as uploaded_by_name,
        f.mime_type,
        f.id AS source_file_id
      FROM collection_files cf
      JOIN files f ON f.id = cf.file_id
      JOIN collections col ON col.id = cf.collection_id AND col.scope_type = 'institution' AND col.is_active = 1
      LEFT JOIN users u ON cf.added_by = u.id
      LEFT JOIN institutions i ON col.scope_id = i.id
      WHERE cf.is_active = 1
      ORDER BY cf.id DESC
    `).all();
  } else {
    const adminInstId = auth.user.institution_id;
    const adminInstName = auth.user.institution;
    let instId = adminInstId;
    if (!instId && adminInstName) {
      const instRow = await db.prepare(`SELECT id FROM institutions WHERE name = ?`).bind(adminInstName).first();
      instId = instRow?.id;
    }
    files = await db.prepare(`
      SELECT
        cf.id,
        col.scope_id AS institution_id,
        i.name AS institution_name,
        cf.collection_id AS folder_id,
        COALESCE(cf.display_name, f.original_name) AS file_name,
        '/api/files/' || f.file_key AS file_url,
        COALESCE(f.extension, '') AS file_type,
        f.file_size,
        COALESCE(cf.category, 'other') AS category,
        cf.is_public,
        cf.added_by AS uploaded_by,
        cf.added_at AS uploaded_at,
        u.full_name as uploaded_by_name,
        f.mime_type,
        f.id AS source_file_id
      FROM collection_files cf
      JOIN files f ON f.id = cf.file_id
      JOIN collections col ON col.id = cf.collection_id AND col.scope_type = 'institution' AND col.is_active = 1
      LEFT JOIN users u ON cf.added_by = u.id
      LEFT JOIN institutions i ON col.scope_id = i.id
      WHERE cf.is_active = 1 AND col.scope_id = ?
      ORDER BY cf.id DESC
    `).bind(instId).all();
  }
  return c.json(files.results);
});

// ====================== MERKEZI DOSYA YONETIMI ======================

app.get('/api/institution/:id/files', async (c) => {
  const identifier = c.req.param('id');
  const db = c.env.DB;

  try {
    const institution = await getInstitutionByIdentifier(db, identifier);
    if (!institution) return c.json([]);

    const auth = await getOptionalAuth(c);
    const canManage = canManageInstitutionScope(auth?.user, institution);
    const root = await ensureInstitutionRootCollection(db, institution.id);

    const result = await db.prepare(`
      SELECT
        cf.id,
        col.scope_id AS institution_id,
        COALESCE(inst.name, '') AS institution_name,
        cf.collection_id AS folder_id,
        COALESCE(cf.display_name, f.original_name) AS file_name,
        '/api/files/' || f.file_key AS file_url,
        COALESCE(f.extension, '') AS file_type,
        f.file_size,
        COALESCE(cf.category, 'other') AS category,
        cf.is_public,
        cf.added_by AS uploaded_by,
        cf.added_at AS uploaded_at,
        u.full_name AS uploaded_by_name,
        f.mime_type,
        f.id AS source_file_id
      FROM collection_files cf
      JOIN files f ON f.id = cf.file_id
      JOIN collections col ON col.id = cf.collection_id
      LEFT JOIN users u ON cf.added_by = u.id
      LEFT JOIN institutions inst ON inst.id = col.scope_id
      WHERE cf.collection_id = ?
        AND cf.is_active = 1
        ${canManage ? '' : 'AND cf.is_public = 1'}
      ORDER BY cf.id DESC
    `).bind(root.id).all();

    return c.json(result.results || []);
  } catch (err) {
    console.error('Root dosyaları sorgu hatası:', err);
    return c.json({ error: 'Dosyalar alınamadı' }, 500);
  }
});

app.get('/api/institution/:id/folders', async (c) => {
  const identifier = c.req.param('id');
  const parentId = c.req.query('parent') || null;
  const db = c.env.DB;

  try {
    const institution = await getInstitutionByIdentifier(db, identifier);
    if (!institution) return c.json([]);

    const auth = await getOptionalAuth(c);
    const canManage = canManageInstitutionScope(auth?.user, institution);
    const root = await ensureInstitutionRootCollection(db, institution.id);
    const parentCollectionId = parentId && parentId !== 'null' ? Number(parentId) : root.id;

    const publicFilter = canManage ? '' : 'AND col.is_public = 1';
    const cfPublicFilter = canManage ? '' : 'AND cf.is_public = 1';

    // Tüm kurum klasörlerini tek sorguda çek
    const allFolderRows = await db.prepare(`
      SELECT id, name AS folder_name, parent_id AS parent_folder_id,
             is_public, created_by, created_at
      FROM collections col
      WHERE col.scope_type = 'institution' AND col.scope_id = ?
        AND col.kind = 'folder' AND col.is_active = 1 ${publicFilter}
      ORDER BY col.sort_order, col.name
    `).bind(institution.id).all();

    // Doğrudan dosya sayıları
    const fileCountRows = await db.prepare(`
      SELECT cf.collection_id, COUNT(*) AS cnt
      FROM collection_files cf
      JOIN collections col ON col.id = cf.collection_id
      WHERE col.scope_type = 'institution' AND col.scope_id = ?
        AND cf.is_active = 1 ${cfPublicFilter}
      GROUP BY cf.collection_id
    `).bind(institution.id).all();

    const directFileCounts = {};
    for (const r of fileCountRows.results || []) {
      directFileCounts[r.collection_id] = Number(r.cnt);
    }

    // Bellek içi ağaç ve recursive sayım
    const allFolders = allFolderRows.results || [];
    const folderMap = {};
    for (const f of allFolders) {
      folderMap[f.id] = { ...f, institution_id: institution.id, _directFiles: directFileCounts[f.id] || 0, _children: [] };
    }
    for (const f of allFolders) {
      if (f.parent_folder_id && folderMap[f.parent_folder_id]) {
        folderMap[f.parent_folder_id]._children.push(f.id);
      }
    }
    function recursiveCounts(id) {
      const node = folderMap[id];
      if (!node) return 0;
      let files = node._directFiles;
      for (const childId of node._children) files += recursiveCounts(childId);
      node._totalFiles = files;
      return files;
    }
    for (const f of allFolders) recursiveCounts(f.id);

    const result = allFolders
      .filter(f => f.parent_folder_id === parentCollectionId)
      .map(f => ({
        id: f.id,
        institution_id: institution.id,
        folder_name: f.folder_name,
        parent_folder_id: f.parent_folder_id,
        is_public: f.is_public,
        created_by: f.created_by,
        created_at: f.created_at,
        subfolder_count: folderMap[f.id]._children.length,
        file_count: folderMap[f.id]._totalFiles || 0,
      }));

    return c.json(result);
  } catch (err) {
    console.error('Klasör sorgu hatası:', err);
    return c.json({ error: err.message }, 500);
  }
});

app.get('/api/institution/folder/:id/files', async (c) => {
  try {
    const folderId = Number(c.req.param('id'));
    const db = c.env.DB;

    const folder = await db.prepare(`
      SELECT
        col.id,
        col.parent_id,
        col.name AS folder_name,
        col.scope_id AS institution_id,
        col.is_public,
        i.name AS institution_name
      FROM collections col
      LEFT JOIN institutions i ON col.scope_id = i.id
      WHERE col.id = ?
        AND col.scope_type = 'institution'
        AND col.kind = 'folder'
        AND col.is_active = 1
    `).bind(folderId).first();

    if (!folder) {
      return c.json({ error: 'Klasör bulunamadı' }, 404);
    }

    const auth = await getOptionalAuth(c);
    const canManage = canManageInstitutionScope(auth?.user, { id: folder.institution_id, name: folder.institution_name });

    const files = await db.prepare(`
      SELECT
        cf.id,
        col.scope_id AS institution_id,
        COALESCE(inst.name, '') AS institution_name,
        cf.collection_id AS folder_id,
        COALESCE(cf.display_name, f.original_name) AS file_name,
        '/api/files/' || f.file_key AS file_url,
        COALESCE(f.extension, '') AS file_type,
        f.file_size,
        COALESCE(cf.category, 'other') AS category,
        cf.is_public,
        cf.added_by AS uploaded_by,
        cf.added_at AS uploaded_at,
        u.full_name AS uploaded_by_name,
        f.mime_type,
        f.id AS source_file_id
      FROM collection_files cf
      JOIN files f ON f.id = cf.file_id
      JOIN collections col ON col.id = cf.collection_id
      LEFT JOIN users u ON cf.added_by = u.id
      LEFT JOIN institutions inst ON inst.id = col.scope_id
      WHERE cf.collection_id = ?
        AND cf.is_active = 1
        ${canManage ? '' : 'AND cf.is_public = 1'}
      ORDER BY cf.id DESC
    `).bind(folderId).all();

    return c.json(files.results || []);
  } catch (error) {
    console.error('Folder files endpoint error:', error);
    return c.json({
      error: 'Dosyalar yüklenirken bir hata oluştu',
      details: error.message
    }, 500);
  }
});

app.get('/api/institution/folder/:id', async (c) => {
  try {
    const folderId = Number(c.req.param('id'));
    const db = c.env.DB;

    const folder = await db.prepare(`
      SELECT
        col.id,
        col.name AS folder_name,
        col.parent_id AS parent_folder_id,
        col.scope_id AS institution_id,
        col.is_public,
        i.name AS institution_name
      FROM collections col
      LEFT JOIN institutions i ON col.scope_id = i.id
      WHERE col.id = ?
        AND col.scope_type = 'institution'
        AND col.kind = 'folder'
        AND col.is_active = 1
    `).bind(folderId).first();

    if (!folder) {
      return c.json({ error: 'Klasör bulunamadı' }, 404);
    }

    const auth = await getOptionalAuth(c);
    const canManage = canManageInstitutionScope(auth?.user, { id: folder.institution_id, name: folder.institution_name });
    if (!canManage && folder.is_public !== 1) {
      return c.json({ error: 'Bu klasöre erişim yetkiniz yok' }, 403);
    }

    return c.json(folder);
  } catch (error) {
    console.error('Folder detail endpoint error:', error);
    return c.json({
      error: 'Klasör bilgisi yüklenirken bir hata oluştu',
      details: error.message
    }, 500);
  }
});

async function handleManagedUpload(c) {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  if (auth.user.role !== 'super_admin') {
    return c.json({ error: 'Sadece Super Admin dosya yükleyebilir' }, 403);
  }

  const formData = await c.req.formData();
  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return c.json({ error: 'Dosya bulunamadı' }, 400);
  }

  try {
    const { stored, deduplicated } = await ensureStoredFileRecord(c, file, auth.user.user_id);
    const systemRoot = await ensureSystemRootCollection(c.env.DB, auth.user.user_id, auth.user.user_id);
    await c.env.DB.prepare(`
      INSERT INTO collection_files (collection_id, file_id, display_name, category, is_public, is_active, sort_order, added_by, added_at)
      SELECT ?, ?, ?, 'other', 0, 1, 0, ?, CURRENT_TIMESTAMP
      WHERE NOT EXISTS (
        SELECT 1
        FROM collection_files
        WHERE collection_id = ? AND file_id = ? AND is_active = 1
      )
    `).bind(systemRoot.id, stored.id, stored.original_name, auth.user.user_id, systemRoot.id, stored.id).run();

    return c.json({
      success: true,
      deduplicated,
      file_id: stored.id,
      url: buildInternalFileUrl(stored.file_key),
      key: stored.file_key,
      name: stored.original_name,
      type: mapFileType(stored.extension, stored.mime_type),
      size: stored.file_size
    });
  } catch (error) {
    return c.json({ error: error.message || 'Yükleme başarısız' }, 400);
  }
}

app.post('/api/upload', handleManagedUpload);
app.post('/api/files/upload', handleManagedUpload);

// Kurum kullanıcılarını listele (admin kendi kurumunu, super_admin hepsini görebilir)
app.get('/api/institution/:id/users', async (c) => {
  try {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  if (auth.user.role !== 'super_admin' && auth.user.role !== 'admin') {
    return c.json({ error: 'Yetkisiz' }, 403);
  }
  const db = c.env.DB;
  const institution = await getInstitutionByIdentifier(db, c.req.param('id'));
  if (!institution) return c.json({ error: 'Kurum bulunamadı' }, 404);
  if (!canManageInstitutionScope(auth.user, institution)) {
    return c.json({ error: 'Yetkisiz' }, 403);
  }
  const rows = await db.prepare(`
    SELECT id, full_name, email, role, created_at
    FROM users
    WHERE (institution_id = ? OR institution = ?) AND role != 'super_admin'
    ORDER BY full_name
  `).bind(institution.id, institution.name).all();
  return c.json(rows.results || []);
  } catch(e) { console.error('/api/institution/:id/users error:', e); return c.json({ error: e.message }, 500); }
});

// Kişilere Gönder: dosyaları seçilen kullanıcılara bildirim olarak işaretle
app.post('/api/institution/:id/send-to-users', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth.response) return auth.response;
    if (auth.user.role !== 'super_admin' && auth.user.role !== 'admin') {
      return c.json({ error: 'Yetkisiz' }, 403);
    }
    const db = c.env.DB;
    const institution = await getInstitutionByIdentifier(db, c.req.param('id'));
    if (!institution) return c.json({ error: 'Kurum bulunamadı' }, 404);
    if (!canManageInstitutionScope(auth.user, institution)) {
      return c.json({ error: 'Yetkisiz' }, 403);
    }

    const { file_ids, user_ids } = await c.req.json();
    if (!Array.isArray(file_ids) || !file_ids.length) return c.json({ error: 'Dosya seçilmedi' }, 400);
    if (!Array.isArray(user_ids) || !user_ids.length)  return c.json({ error: 'Kullanıcı seçilmedi' }, 400);

    // Tablo yoksa oluştur (migration uygulanmamış ortamlar için)
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS user_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL DEFAULT 'info',
        title TEXT NOT NULL,
        body TEXT,
        ref_id INTEGER,
        ref_type TEXT,
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();

    const now = new Date().toISOString();
    let sent = 0;
    for (const userId of user_ids) {
      for (const fileId of file_ids) {
        const cf = await db.prepare(
          `SELECT cf.id, COALESCE(cf.display_name, f.original_name) AS name
           FROM collection_files cf JOIN files f ON f.id = cf.file_id
           WHERE cf.id = ? AND cf.is_active = 1 LIMIT 1`
        ).bind(fileId).first();
        if (!cf) continue;

        await db.prepare(`
          INSERT OR IGNORE INTO user_notifications (user_id, type, title, body, ref_id, ref_type, created_at, is_read)
          VALUES (?, 'file_shared', ?, ?, ?, 'collection_file', ?, 0)
        `).bind(
          userId,
          `Dosya paylaşıldı: ${cf.name}`,
          `${auth.user.full_name || 'Yöneticiniz'} bir dosyayı sizinle paylaştı.`,
          cf.id, now
        ).run();
        sent++;
      }
    }

    return c.json({ success: true, sent });
  } catch(e) {
    console.error('/api/institution/:id/send-to-users error:', e);
    return c.json({ error: e.message || 'Sunucu hatası' }, 500);
  }
});

// Merkezi Dosyalar → Kişilere Gönder (super_admin)
// ====================== MERKEZİ DOSYALARDAN KİŞİLERE GÖNDER (DÜZELTİLMİŞ) ======================
app.post('/api/system/send-to-users', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth.response) return auth.response;
    if (auth.user.role !== 'super_admin') {
      return c.json({ error: 'Yetkisiz' }, 403);
    }

    const db = c.env.DB;
    const { file_ids, user_ids } = await c.req.json();

    if (!Array.isArray(file_ids) || !file_ids.length) {
      return c.json({ error: 'Dosya seçilmedi' }, 400);
    }
    if (!Array.isArray(user_ids) || !user_ids.length) {
      return c.json({ error: 'Kullanıcı seçilmedi' }, 400);
    }

    // Tabloların varlığını garanti et
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS user_collections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        parent_id INTEGER,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        sort_order INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `).run();

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS user_collection_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collection_id INTEGER NOT NULL,
        file_id INTEGER NOT NULL,
        share_id INTEGER,
        display_name TEXT,
        is_read INTEGER DEFAULT 0,
        added_at TEXT NOT NULL DEFAULT (datetime('now')),
        sort_order INTEGER DEFAULT 0,
        FOREIGN KEY (collection_id) REFERENCES user_collections(id) ON DELETE CASCADE,
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
      )
    `).run();

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL DEFAULT 'info',
        title TEXT NOT NULL,
        content TEXT,
        data TEXT,
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();

    let sent = 0;
    const now = new Date().toISOString();

    for (const userId of user_ids) {
      // 1. Kullanıcının root klasörünü bul (yoksa oluştur)
      let userRoot = await db.prepare(`
        SELECT id FROM user_collections WHERE user_id = ? AND parent_id IS NULL LIMIT 1
      `).bind(userId).first();

      if (!userRoot) {
        const insertRoot = await db.prepare(`
          INSERT INTO user_collections (user_id, parent_id, name, sort_order)
          VALUES (?, NULL, '__root__', 0)
        `).bind(userId).run();
        userRoot = { id: insertRoot.meta.last_row_id };
      }

      for (const fileId of file_ids.map(Number)) {
        // 2. Dosya bilgilerini al (display_name veya original_name)
        const fileInfo = await db.prepare(`
          SELECT
            f.id as file_id,
            COALESCE(cf.display_name, f.original_name) as display_name,
            f.file_key,
            f.mime_type,
            f.file_size
          FROM collection_files cf
          JOIN files f ON f.id = cf.file_id
          WHERE cf.id = ? AND cf.is_active = 1
          LIMIT 1
        `).bind(fileId).first();

        if (!fileInfo) {
          console.log(`Dosya bulunamadı: ${fileId}`);
          continue;
        }

        // 3. Aynı dosya daha önce bu kullanıcıya paylaşılmış mı kontrol et
        const existing = await db.prepare(`
          SELECT id FROM user_collection_files
          WHERE collection_id = ? AND file_id = ?
        `).bind(userRoot.id, fileInfo.file_id).first();

        if (existing) {
          console.log(`Dosya zaten paylaşılmış: user=${userId}, file=${fileInfo.file_id}`);
          continue;
        }

        // 4. Kullanıcının klasörüne dosya kaydını ekle
        const insertFile = await db.prepare(`
          INSERT INTO user_collection_files (collection_id, file_id, display_name, is_read, added_at)
          VALUES (?, ?, ?, 0, ?)
        `).bind(userRoot.id, fileInfo.file_id, fileInfo.display_name, now).run();

        // 5. Bildirim oluştur
        await db.prepare(`
          INSERT INTO notifications (user_id, type, title, content, is_read, created_at)
          VALUES (?, 'file_shared', ?, ?, 0, ?)
        `).bind(
          userId,
          `Yeni dosya paylaşıldı: ${fileInfo.display_name}`,
          `${auth.user.full_name || 'Yönetici'} tarafından sizinle bir dosya paylaşıldı. "Kurum Dosyaları" bölümünden inceleyebilirsiniz.`,
          now
        ).run();

        sent++;
      }
    }

    return c.json({
      success: true,
      sent,
      message: `${sent} dosya ${user_ids.length} kullanıcıya paylaşıldı.`
    });

  } catch (error) {
    console.error('System send-to-users error:', error);
    return c.json({
      error: error.message || 'Dosya paylaşılırken bir hata oluştu.'
    }, 500);
  }
});

app.post('/api/institution/:id/folder', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  if (auth.user.role !== 'super_admin' && auth.user.role !== 'admin') {
    return c.json({ error: 'Yetkisiz' }, 403);
  }

  const db = c.env.DB;
  const institution = await getInstitutionByIdentifier(db, c.req.param('id'));
  if (!institution) return c.json({ error: 'Kurum bulunamadı' }, 404);
  if (!canManageInstitutionScope(auth.user, institution)) {
    return c.json({ error: 'Sadece kendi kurumunuza klasör ekleyebilirsiniz' }, 403);
  }

  const { folder_name, parent_folder_id, is_public } = await c.req.json();
  if (!folder_name?.trim()) return c.json({ error: 'Klasör adı boş olamaz' }, 400);

  const parentCollection = await getInstitutionCollectionOrRoot(db, institution.id, parent_folder_id || null, auth.user.user_id);
  if (!parentCollection) return c.json({ error: 'Hedef klasör bulunamadı' }, 404);

  const result = await db.prepare(`
    INSERT INTO collections (parent_id, name, scope_type, scope_id, kind, is_public, is_active, sort_order, created_by)
    VALUES (?, ?, 'institution', ?, 'folder', ?, 1, 0, ?)
  `).bind(parentCollection.id, folder_name.trim(), institution.id, is_public ? 1 : 0, auth.user.user_id).run();

  return c.json({ success: true, id: result.meta?.last_row_id });
});

app.delete('/api/institution/folder/:id', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  if (auth.user.role !== 'super_admin' && auth.user.role !== 'admin') {
    return c.json({ error: 'Yetkisiz' }, 403);
  }

  const folderId = Number(c.req.param('id'));
  const db = c.env.DB;
  const folder = await db.prepare(`
    SELECT
      col.id,
      col.scope_id AS institution_id,
      i.name AS institution_name
    FROM collections col
    LEFT JOIN institutions i ON col.scope_id = i.id
    WHERE col.id = ?
      AND col.scope_type = 'institution'
      AND col.kind = 'folder'
      AND col.is_active = 1
  `).bind(folderId).first();

  if (!folder) return c.json({ error: 'Klasör bulunamadı' }, 404);
  if (!canManageInstitutionScope(auth.user, { id: folder.institution_id, name: folder.institution_name })) {
    return c.json({ error: 'Yetkisiz' }, 403);
  }

  const folderIds = [];
  let queue = [folderId];
  while (queue.length) {
    const batch = queue.splice(0, 20);
    folderIds.push(...batch);

    const placeholders = batch.map(() => '?').join(', ');
    const children = await db.prepare(`
      SELECT id
      FROM collections
      WHERE parent_id IN (${placeholders})
        AND kind = 'folder'
        AND is_active = 1
    `).bind(...batch).all();
    queue.push(...(children.results || []).map(row => Number(row.id)));
  }

  const placeholders = folderIds.map(() => '?').join(', ');
  const affectedRefs = await db.prepare(`
    SELECT DISTINCT file_id
    FROM collection_files
    WHERE collection_id IN (${placeholders})
      AND is_active = 1
  `).bind(...folderIds).all();

  await db.prepare(`
    UPDATE collection_files
    SET is_active = 0
    WHERE collection_id IN (${placeholders})
  `).bind(...folderIds).run();

  await db.prepare(`
    UPDATE collections
    SET is_active = 0
    WHERE id IN (${placeholders})
  `).bind(...folderIds).run();

  for (const row of affectedRefs.results || []) {
    const refCount = await countActiveReferences(db, row.file_id);
    if (refCount > 0) continue;

    const stored = await getStoredFileById(db, row.file_id);
    if (stored && c.env.FILES_BUCKET) {
      await c.env.FILES_BUCKET.delete(stored.file_key);
    }
    await db.prepare(`DELETE FROM files WHERE id = ?`).bind(row.file_id).run();
  }

  return c.json({ success: true });
});

app.put('/api/institution/folder/:id', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  if (auth.user.role !== 'super_admin' && auth.user.role !== 'admin') {
    return c.json({ error: 'Yetkisiz' }, 403);
  }

  const folderId = Number(c.req.param('id'));
  const db = c.env.DB;
  const body = await c.req.json();
  const { folder_name, parent_folder_id } = body;

  // En az bir güncelleme alanı gelmeli
  if (!folder_name?.trim() && parent_folder_id === undefined) {
    return c.json({ error: 'Güncellenecek alan yok' }, 400);
  }

  const folder = await db.prepare(`
    SELECT
      col.id,
      col.scope_id AS institution_id,
      i.name AS institution_name
    FROM collections col
    LEFT JOIN institutions i ON col.scope_id = i.id
    WHERE col.id = ?
      AND col.scope_type = 'institution'
      AND col.kind = 'folder'
      AND col.is_active = 1
  `).bind(folderId).first();

  if (!folder) return c.json({ error: 'Klasör bulunamadı' }, 404);
  if (!canManageInstitutionScope(auth.user, { id: folder.institution_id, name: folder.institution_name })) {
    return c.json({ error: 'Yetkisiz' }, 403);
  }

  if (folder_name?.trim()) {
    await db.prepare(`UPDATE collections SET name = ? WHERE id = ?`).bind(folder_name.trim(), folderId).run();
  }
  if (parent_folder_id !== undefined) {
    // null = kök (parent = kurumun root collection'ı)
    let newParentId = null;
    if (parent_folder_id) {
      // Hedef klasörün aynı kuruma ait olduğunu doğrula
      const target = await db.prepare(`
        SELECT id FROM collections WHERE id = ? AND scope_id = ? AND scope_type = 'institution' AND is_active = 1
      `).bind(Number(parent_folder_id), folder.institution_id).first();
      if (!target) return c.json({ error: 'Hedef klasör bulunamadı' }, 404);
      newParentId = target.id;
    } else {
      // Kök: kurumun root collection'ını bul
      const root = await db.prepare(`
        SELECT id FROM collections WHERE scope_id = ? AND scope_type = 'institution' AND kind = 'root' AND is_active = 1
      `).bind(folder.institution_id).first();
      if (root) newParentId = root.id;
    }
    await db.prepare(`UPDATE collections SET parent_id = ? WHERE id = ?`).bind(newParentId, folderId).run();
  }

  return c.json({ success: true });
});

app.post('/api/institution/:id/file', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  if (auth.user.role !== 'super_admin' && auth.user.role !== 'admin') {
    return c.json({ error: 'Yetkisiz' }, 403);
  }

  const db = c.env.DB;
  const institution = await getInstitutionByIdentifier(db, c.req.param('id'));
  if (!institution) return c.json({ error: 'Kurum bulunamadı' }, 404);
  if (!canManageInstitutionScope(auth.user, institution)) {
    return c.json({ error: 'Yetkisiz' }, 403);
  }

  const { file_name, file_url, category, folder_id, is_public, source_file_id } = await c.req.json();
  const targetCollection = await getInstitutionCollectionOrRoot(db, institution.id, folder_id || null, auth.user.user_id);
  if (!targetCollection) return c.json({ error: 'Hedef klasör bulunamadı' }, 404);

  let stored = null;
  if (source_file_id) {
    stored = await getStoredFileById(db, source_file_id);
  } else {
    const fileKey = extractManagedFileKey(file_url, c.env.R2_PUBLIC_URL);
    if (fileKey) stored = await getStoredFileByKey(db, fileKey);
  }

  if (!stored) {
    return c.json({ error: 'Yalnızca sistemde yüklenmiş dosyalar eklenebilir' }, 400);
  }

  const existingRef = await db.prepare(`
    SELECT id
    FROM collection_files
    WHERE collection_id = ? AND file_id = ? AND is_active = 1
    LIMIT 1
  `).bind(targetCollection.id, stored.id).first();

  if (existingRef) {
    await db.prepare(`UPDATE collection_files SET display_name = ?, category = ? WHERE id = ?`)
      .bind(file_name?.trim() || stored.original_name, category || 'other', existingRef.id).run();
    return c.json({ success: true, id: existingRef.id, deduplicated: true });
  }

  const result = await db.prepare(`
    INSERT INTO collection_files (collection_id, file_id, display_name, category, is_public, is_active, sort_order, added_by, added_at)
    VALUES (?, ?, ?, ?, ?, 1, 0, ?, CURRENT_TIMESTAMP)
  `).bind(
    targetCollection.id,
    stored.id,
    file_name?.trim() || stored.original_name,
    category || 'other',
    is_public ? 1 : 0,
    auth.user.user_id
  ).run();

  return c.json({ success: true, id: result.meta?.last_row_id });
});

app.put('/api/institution/file/:id', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  if (auth.user.role !== 'super_admin' && auth.user.role !== 'admin') {
    return c.json({ error: 'Yetkisiz' }, 403);
  }

  const refId = Number(c.req.param('id'));
  const db = c.env.DB;
  const ref = await db.prepare(`
    SELECT
      cf.id,
      cf.collection_id,
      cf.file_id,
      col.scope_id AS institution_id,
      i.name AS institution_name
    FROM collection_files cf
    JOIN collections col ON col.id = cf.collection_id
    LEFT JOIN institutions i ON col.scope_id = i.id
    WHERE cf.id = ?
      AND cf.is_active = 1
      AND col.scope_type = 'institution'
      AND col.is_active = 1
  `).bind(refId).first();

  if (!ref) return c.json({ error: 'Dosya bulunamadı' }, 404);
  if (!canManageInstitutionScope(auth.user, { id: ref.institution_id, name: ref.institution_name })) {
    return c.json({ error: 'Yetkisiz' }, 403);
  }

  const { file_name, file_url, category, is_public, folder_id, source_file_id } = await c.req.json();
  let nextCollectionId = ref.collection_id;
  if (folder_id !== undefined) {
    const targetCollection = await getInstitutionCollectionOrRoot(db, ref.institution_id, folder_id || null, auth.user.user_id);
    if (!targetCollection) return c.json({ error: 'Hedef klasör bulunamadı' }, 404);
    nextCollectionId = targetCollection.id;
  }

  let nextFileId = ref.file_id;
  if (source_file_id || file_url) {
    const nextStored = source_file_id
      ? await getStoredFileById(db, source_file_id)
      : await getStoredFileByKey(db, extractManagedFileKey(file_url, c.env.R2_PUBLIC_URL));
    if (!nextStored) return c.json({ error: 'Kaynak dosya bulunamadı' }, 404);
    nextFileId = nextStored.id;
  }

  await db.prepare(`
    UPDATE collection_files
    SET
      display_name = COALESCE(?, display_name),
      category = COALESCE(?, category),
      is_public = COALESCE(?, is_public),
      collection_id = ?,
      file_id = ?
    WHERE id = ?
  `).bind(
    file_name?.trim() || null,
    category || null,
    is_public !== undefined ? (is_public ? 1 : 0) : null,
    nextCollectionId,
    nextFileId,
    refId
  ).run();

  return c.json({ success: true });
});

app.delete('/api/institution/file/:id', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  if (auth.user.role !== 'super_admin' && auth.user.role !== 'admin') {
    return c.json({ error: 'Yetkisiz' }, 403);
  }

  const refId = Number(c.req.param('id'));
  const db = c.env.DB;
  const ref = await db.prepare(`
    SELECT
      cf.id,
      cf.file_id,
      col.scope_id AS institution_id,
      i.name AS institution_name
    FROM collection_files cf
    JOIN collections col ON col.id = cf.collection_id
    LEFT JOIN institutions i ON col.scope_id = i.id
    WHERE cf.id = ?
      AND cf.is_active = 1
      AND col.scope_type = 'institution'
      AND col.is_active = 1
  `).bind(refId).first();

  if (!ref) return c.json({ error: 'Dosya bulunamadı' }, 404);
  if (!canManageInstitutionScope(auth.user, { id: ref.institution_id, name: ref.institution_name })) {
    return c.json({ error: 'Yetkisiz' }, 403);
  }

  await db.prepare(`UPDATE collection_files SET is_active = 0 WHERE id = ?`).bind(refId).run();

  const remainingRefs = await countActiveReferences(db, ref.file_id);
  if (remainingRefs === 0) {
    const stored = await getStoredFileById(db, ref.file_id);
    if (stored && c.env.FILES_BUCKET) {
      await c.env.FILES_BUCKET.delete(stored.file_key);
    }
    await db.prepare(`DELETE FROM files WHERE id = ?`).bind(ref.file_id).run();
  }

  return c.json({ success: true });
});

// ====================== ATOMIK KLASÖR PAYLAŞIMI ======================
// Sistem klasörünü (ve alt ağacını) bir kuruma tek seferde, atomik olarak bağlar.
// sendFolderRecursive (admin.html) yerine geçer; N×M API çağrısını 1'e indirir.
app.post('/api/admin/folder-share', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  if (auth.user.role !== 'super_admin') return c.json({ error: 'Yetkisiz' }, 403);

  const db = c.env.DB;
  const body = await c.req.json().catch(() => ({}));
  const { source_collection_id, institution_id, target_collection_id } = body;

  if (!source_collection_id || !institution_id) {
    return c.json({ error: 'source_collection_id ve institution_id zorunlu' }, 400);
  }

  // Kaynak klasör sistem klasörü olmak zorunda
  const sourceFolder = await db.prepare(`
    SELECT id, name FROM collections
    WHERE id = ? AND scope_type = 'system' AND kind = 'folder' AND is_active = 1
  `).bind(Number(source_collection_id)).first();
  if (!sourceFolder) return c.json({ error: 'Kaynak sistem klasörü bulunamadı' }, 404);

  // Hedef kurum
  const institution = await getInstitutionByIdentifier(db, institution_id);
  if (!institution) return c.json({ error: 'Kurum bulunamadı' }, 404);

  // Hedef üst klasör (belirtilmemişse kurum root'u)
  const parentCollection = await getInstitutionCollectionOrRoot(
    db, institution.id, target_collection_id ? Number(target_collection_id) : null, auth.user.user_id
  );
  if (!parentCollection) return c.json({ error: 'Hedef klasör bulunamadı' }, 404);

  // Hata anında cleanup için oluşturulan ID'leri takip et
  const createdCollectionIds = [];
  const createdFileRefIds = [];
  const stats = { folders_created: 0, files_linked: 0, duplicates_skipped: 0 };

  try {
    // BFS: sistem klasör ağacını gez, kurumda karşılıklarını oluştur
    const queue = [{
      systemCollectionId: sourceFolder.id,
      parentInstCollId: parentCollection.id,
      folderName: sourceFolder.name
    }];

    while (queue.length > 0) {
      const { systemCollectionId, parentInstCollId, folderName } = queue.shift();

      // Kurumda klasörü oluştur
      const folderResult = await db.prepare(`
        INSERT INTO collections (parent_id, name, scope_type, scope_id, kind, is_public, is_active, sort_order, created_by)
        VALUES (?, ?, 'institution', ?, 'folder', 1, 1, 0, ?)
      `).bind(parentInstCollId, folderName, institution.id, auth.user.user_id).run();

      const newCollId = Number(folderResult.meta?.last_row_id);
      createdCollectionIds.push(newCollId);
      stats.folders_created++;

      // Sistem klasöründeki dosyaları al
      const filesInFolder = await db.prepare(`
        SELECT cf.file_id,
               COALESCE(cf.display_name, f.original_name) AS display_name,
               cf.category,
               cf.is_public
        FROM collection_files cf
        JOIN files f ON f.id = cf.file_id
        WHERE cf.collection_id = ? AND cf.is_active = 1
      `).bind(systemCollectionId).all();

      // Dosyaları yeni kurum klasörüne referans olarak bağla
      for (const fileRef of (filesInFolder.results || [])) {
        // Aynı dosya zaten varsa atla
        const existing = await db.prepare(`
          SELECT id FROM collection_files
          WHERE collection_id = ? AND file_id = ? AND is_active = 1
          LIMIT 1
        `).bind(newCollId, fileRef.file_id).first();

        if (existing) { stats.duplicates_skipped++; continue; }

        const refResult = await db.prepare(`
          INSERT INTO collection_files (collection_id, file_id, display_name, category, is_public, is_active, sort_order, added_by, added_at)
          VALUES (?, ?, ?, ?, ?, 1, 0, ?, CURRENT_TIMESTAMP)
        `).bind(
          newCollId, fileRef.file_id, fileRef.display_name,
          fileRef.category || 'other', fileRef.is_public ? 1 : 0, auth.user.user_id
        ).run();

        createdFileRefIds.push(Number(refResult.meta?.last_row_id));
        stats.files_linked++;
      }

      // Alt klasörleri kuyruğa ekle
      const subfolders = await db.prepare(`
        SELECT id, name FROM collections
        WHERE parent_id = ? AND kind = 'folder' AND is_active = 1
        ORDER BY sort_order, name
      `).bind(systemCollectionId).all();

      for (const sub of (subfolders.results || [])) {
        queue.push({ systemCollectionId: sub.id, parentInstCollId: newCollId, folderName: sub.name });
      }
    }

    return c.json({ success: true, stats });

  } catch (err) {
    console.error('folder-share error:', err);

    // Rollback: oluşturulan kayıtları geri al
    try {
      if (createdFileRefIds.length) {
        const ph = createdFileRefIds.map(() => '?').join(',');
        await db.prepare(`DELETE FROM collection_files WHERE id IN (${ph})`).bind(...createdFileRefIds).run();
      }
      if (createdCollectionIds.length) {
        const ph = createdCollectionIds.map(() => '?').join(',');
        await db.prepare(`UPDATE collections SET is_active = 0 WHERE id IN (${ph})`).bind(...createdCollectionIds).run();
      }
    } catch (cleanupErr) {
      console.error('folder-share cleanup error:', cleanupErr);
    }

    return c.json({ error: err.message || 'Klasör paylaşımı başarısız' }, 500);
  }
});

app.get('/api/_legacy/institution/:id/files', (c) => c.json({ error: 'Kaldırıldı' }, 410));

// ====================== KURUM KLASÖRLERİNİ GETİR (DÜZELTİLMİŞ) ======================
app.get('/api/_legacy/institution/:id/folders', (c) => c.json({ error: 'Kaldırıldı' }, 410));

app.get('/api/_legacy/institution/folder/:id/files', (c) => c.json({ error: 'Kaldırıldı' }, 410));
app.get('/api/_legacy/institution/folder/:id', (c) => c.json({ error: 'Kaldırıldı' }, 410));
app.post('/api/_legacy/upload', (c) => c.json({ error: 'Kaldırıldı' }, 410));
app.post('/api/_legacy/institution/:id/folder', (c) => c.json({ error: 'Kaldırıldı' }, 410));
app.delete('/api/_legacy/institution/folder/:id', (c) => c.json({ error: 'Kaldırıldı' }, 410));
app.put('/api/_legacy/institution/folder/:id', (c) => c.json({ error: 'Kaldırıldı' }, 410));
app.post('/api/_legacy/institution/:id/file', (c) => c.json({ error: 'Kaldırıldı' }, 410));
app.put('/api/_legacy/institution/file/:id', (c) => c.json({ error: 'Kaldırıldı' }, 410));
app.delete('/api/_legacy/institution/file/:id', (c) => c.json({ error: 'Kaldırıldı' }, 410));

// ====================== KURUM YÖNETİMİ ======================

app.get('/api/files/library', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  if (auth.user.role !== 'super_admin' && auth.user.role !== 'admin') {
    return c.json({ error: 'Yetkisiz' }, 403);
  }

  const db = c.env.DB;
  if (auth.user.role === 'super_admin') {
    const rows = await db.prepare(`
      SELECT DISTINCT
        f.id,
        f.original_name,
        f.file_key,
        '/api/files/' || f.file_key AS file_url,
        f.file_size,
        f.mime_type,
        f.extension,
        f.created_at,
        f.uploaded_by,
        u.full_name AS uploaded_by_name,
        (
          SELECT COUNT(*)
          FROM collection_files cf
          WHERE cf.file_id = f.id AND cf.is_active = 1
        ) AS usage_count
      FROM files f
      JOIN collection_files cf ON cf.file_id = f.id AND cf.is_active = 1
      JOIN collections col ON col.id = cf.collection_id AND col.scope_type = 'system' AND col.scope_id = ? AND col.is_active = 1
      LEFT JOIN users u ON u.id = f.uploaded_by
      ORDER BY f.created_at DESC, f.id DESC
    `).bind(auth.user.user_id).all();
    return c.json(rows.results || []);
  }

  const institutionId = auth.user.institution_id;
  const rows = await db.prepare(`
    SELECT DISTINCT
      f.id,
      f.original_name,
      f.file_key,
      '/api/files/' || f.file_key AS file_url,
      f.file_size,
      f.mime_type,
      f.extension,
      f.created_at,
      f.uploaded_by,
      u.full_name AS uploaded_by_name,
      (
        SELECT COUNT(*)
        FROM collection_files cf2
        WHERE cf2.file_id = f.id AND cf2.is_active = 1
      ) AS usage_count
    FROM files f
    JOIN collection_files cf ON cf.file_id = f.id AND cf.is_active = 1
    JOIN collections col ON col.id = cf.collection_id
    LEFT JOIN users u ON u.id = f.uploaded_by
    WHERE col.scope_type = 'institution' AND col.scope_id = ?
    ORDER BY f.created_at DESC, f.id DESC
  `).bind(institutionId).all();

  return c.json(rows.results || []);
});

app.get('/api/files/:id/usage', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  if (auth.user.role !== 'super_admin' && auth.user.role !== 'admin') {
    return c.json({ error: 'Yetkisiz' }, 403);
  }

  const fileId = Number(c.req.param('id'));
  const db = c.env.DB;
  const rows = await db.prepare(`
    SELECT
      cf.id,
      cf.collection_id,
      col.name AS collection_name,
      col.kind,
      col.scope_id AS institution_id,
      i.name AS institution_name,
      cf.is_public,
      cf.added_at
    FROM collection_files cf
    JOIN collections col ON col.id = cf.collection_id
    LEFT JOIN institutions i ON i.id = col.scope_id
    WHERE cf.file_id = ? AND cf.is_active = 1 AND col.is_active = 1
    ORDER BY cf.added_at DESC, cf.id DESC
  `).bind(fileId).all();

  if (auth.user.role === 'admin') {
    const filtered = (rows.results || []).filter(row => String(row.institution_id) === String(auth.user.institution_id || ''));
    return c.json(filtered);
  }

  return c.json(rows.results || []);
});

app.post('/api/files/use', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  if (auth.user.role !== 'super_admin' && auth.user.role !== 'admin') {
    return c.json({ error: 'Yetkisiz' }, 403);
  }

  const { file_id, collection_id, display_name, category, is_public } = await c.req.json();
  if (!file_id || !collection_id) {
    return c.json({ error: 'file_id ve collection_id zorunlu' }, 400);
  }

  const db = c.env.DB;
  const collection = await getActiveCollection(db, Number(collection_id));
  if (!collection) return c.json({ error: 'Koleksiyon bulunamadı' }, 404);
  if (collection.scope_type !== 'institution') return c.json({ error: 'Yalnızca kurum klasörleri destekleniyor' }, 400);
  const institution = await db.prepare(`SELECT id, name FROM institutions WHERE id = ?`).bind(collection.scope_id).first();
  if (!canManageInstitutionScope(auth.user, institution)) return c.json({ error: 'Yetkisiz' }, 403);

  const stored = await getStoredFileById(db, Number(file_id));
  if (!stored) return c.json({ error: 'Dosya bulunamadı' }, 404);

  const existing = await db.prepare(`
    SELECT id
    FROM collection_files
    WHERE collection_id = ? AND file_id = ? AND is_active = 1
    LIMIT 1
  `).bind(collection.id, stored.id).first();
  if (existing) {
    await db.prepare(`UPDATE collection_files SET display_name = ?, category = ? WHERE id = ?`)
      .bind(display_name?.trim() || stored.original_name, category || 'other', existing.id).run();
    return c.json({ success: true, id: existing.id, deduplicated: true });
  }

  const result = await db.prepare(`
    INSERT INTO collection_files (collection_id, file_id, display_name, category, is_public, is_active, sort_order, added_by, added_at)
    VALUES (?, ?, ?, ?, ?, 1, 0, ?, CURRENT_TIMESTAMP)
  `).bind(
    collection.id,
    stored.id,
    display_name?.trim() || stored.original_name,
    category || 'other',
    is_public ? 1 : 0,
    auth.user.user_id
  ).run();

  return c.json({ success: true, id: result.meta?.last_row_id });
});

app.post('/api/files/bulk-add', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  if (auth.user.role !== 'super_admin' && auth.user.role !== 'admin') {
    return c.json({ error: 'Yetkisiz' }, 403);
  }

  const { file_id, collection_ids, institution_ids, folder_name, display_name, category, is_public } = await c.req.json();
  if (!file_id) return c.json({ error: 'file_id zorunlu' }, 400);

  const db = c.env.DB;
  const stored = await getStoredFileById(db, Number(file_id));
  if (!stored) return c.json({ error: 'Dosya bulunamadı' }, 404);

  const targetCollectionIds = new Set();
  for (const id of Array.isArray(collection_ids) ? collection_ids : []) {
    targetCollectionIds.add(Number(id));
  }

  for (const institutionId of Array.isArray(institution_ids) ? institution_ids : []) {
    const institution = await db.prepare(`SELECT id, name FROM institutions WHERE id = ?`).bind(Number(institutionId)).first();
    if (!institution) continue;
    if (!canManageInstitutionScope(auth.user, institution)) continue;

    let targetCollection = await ensureInstitutionRootCollection(db, institution.id, auth.user.user_id);
    if (folder_name?.trim()) {
      const existingFolder = await db.prepare(`
        SELECT id
        FROM collections
        WHERE scope_type = 'institution'
          AND scope_id = ?
          AND parent_id = ?
          AND kind = 'folder'
          AND is_active = 1
          AND name = ?
        LIMIT 1
      `).bind(institution.id, targetCollection.id, folder_name.trim()).first();

      if (existingFolder) {
        targetCollection = await getActiveCollection(db, existingFolder.id);
      } else {
        const createResult = await db.prepare(`
          INSERT INTO collections (parent_id, name, scope_type, scope_id, kind, is_public, is_active, sort_order, created_by)
          VALUES (?, ?, 'institution', ?, 'folder', 0, 1, 0, ?)
        `).bind(targetCollection.id, folder_name.trim(), institution.id, auth.user.user_id).run();
        targetCollection = await getActiveCollection(db, createResult.meta?.last_row_id);
      }
    }

    if (targetCollection?.id) targetCollectionIds.add(Number(targetCollection.id));
  }

  const createdIds = [];
  for (const collectionId of targetCollectionIds) {
    const collection = await getActiveCollection(db, collectionId);
    if (!collection || collection.scope_type !== 'institution') continue;
    const institution = await db.prepare(`SELECT id, name FROM institutions WHERE id = ?`).bind(collection.scope_id).first();
    if (!canManageInstitutionScope(auth.user, institution)) continue;

    const existing = await db.prepare(`
      SELECT id
      FROM collection_files
      WHERE collection_id = ? AND file_id = ? AND is_active = 1
      LIMIT 1
    `).bind(collectionId, stored.id).first();

    if (existing) {
      createdIds.push(existing.id);
      continue;
    }

    const result = await db.prepare(`
      INSERT INTO collection_files (collection_id, file_id, display_name, category, is_public, is_active, sort_order, added_by, added_at)
      VALUES (?, ?, ?, ?, ?, 1, 0, ?, CURRENT_TIMESTAMP)
    `).bind(
      collectionId,
      stored.id,
      display_name?.trim() || stored.original_name,
      category || 'other',
      is_public ? 1 : 0,
      auth.user.user_id
    ).run();

    createdIds.push(result.meta?.last_row_id);
  }

  return c.json({ success: true, count: createdIds.length, ids: createdIds });
});

app.get('/api/collections', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  if (auth.user.role !== 'super_admin' && auth.user.role !== 'admin') {
    return c.json({ error: 'Yetkisiz' }, 403);
  }

  const db = c.env.DB;
  const scopeType = c.req.query('scope_type') || 'institution';
  const scopeId = c.req.query('scope_id');
  const parentId = c.req.query('parent_id');

  let effectiveScopeId = scopeId;
  if (scopeType === 'system') {
    if (auth.user.role !== 'super_admin') {
      return c.json({ error: 'Yetkisiz' }, 403);
    }
    effectiveScopeId = auth.user.user_id;
    await ensureSystemRootCollection(db, auth.user.user_id, auth.user.user_id);
  } else if (auth.user.role === 'admin') {
    effectiveScopeId = auth.user.institution_id;
  }

  if (!effectiveScopeId) {
    return c.json({ error: 'scope_id zorunlu' }, 400);
  }

  const rows = await db.prepare(`
    SELECT id, parent_id, name, scope_type, scope_id, kind, is_public, is_active, sort_order, created_by, created_at
    FROM collections
    WHERE scope_type = ?
      AND scope_id = ?
      AND is_active = 1
      AND (${parentId ? 'parent_id = ?' : '1=1'})
    ORDER BY sort_order, name
  `).bind(...(parentId ? [scopeType, Number(effectiveScopeId), Number(parentId)] : [scopeType, Number(effectiveScopeId)])).all();

  return c.json(rows.results || []);
});

app.post('/api/collections', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  if (auth.user.role !== 'super_admin' && auth.user.role !== 'admin') {
    return c.json({ error: 'Yetkisiz' }, 403);
  }

  const db = c.env.DB;
  const { parent_id, name, scope_type, scope_id, kind, is_public } = await c.req.json();
  if (!name?.trim()) return c.json({ error: 'Koleksiyon adı zorunlu' }, 400);
  if (!['institution', 'system'].includes(scope_type)) {
    return c.json({ error: 'Desteklenmeyen scope_type' }, 400);
  }

  let effectiveScopeId;
  let effectiveParentId = parent_id || null;
  if (scope_type === 'system') {
    if (auth.user.role !== 'super_admin') return c.json({ error: 'Yetkisiz' }, 403);
    effectiveScopeId = auth.user.user_id;
    const sysRoot = await ensureSystemRootCollection(db, auth.user.user_id, auth.user.user_id);
    if (!effectiveParentId) effectiveParentId = sysRoot.id;
  } else {
    effectiveScopeId = auth.user.role === 'admin' ? auth.user.institution_id : scope_id;
    const institution = await db.prepare(`SELECT id, name FROM institutions WHERE id = ?`).bind(Number(effectiveScopeId)).first();
    if (!institution) return c.json({ error: 'Kurum bulunamadı' }, 404);
    if (!canManageInstitutionScope(auth.user, institution)) return c.json({ error: 'Yetkisiz' }, 403);
  }

  const result = await db.prepare(`
    INSERT INTO collections (parent_id, name, scope_type, scope_id, kind, is_public, is_active, sort_order, created_by)
    VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?)
  `).bind(effectiveParentId, name.trim(), scope_type, Number(effectiveScopeId), kind || 'folder', is_public ? 1 : 0, auth.user.user_id).run();

  return c.json({ success: true, id: result.meta?.last_row_id });
});

app.put('/api/collections/:id', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  if (auth.user.role !== 'super_admin' && auth.user.role !== 'admin') {
    return c.json({ error: 'Yetkisiz' }, 403);
  }

  const db = c.env.DB;
  const collection = await getActiveCollection(db, Number(c.req.param('id')));
  if (!collection) return c.json({ error: 'Koleksiyon bulunamadı' }, 404);
  if (!canManageCollectionScope(auth.user, collection)) return c.json({ error: 'Yetkisiz' }, 403);

  const { name, is_public, sort_order } = await c.req.json();
  await db.prepare(`
    UPDATE collections
    SET
      name = COALESCE(?, name),
      is_public = COALESCE(?, is_public),
      sort_order = COALESCE(?, sort_order)
    WHERE id = ?
  `).bind(name?.trim() || null, is_public !== undefined ? (is_public ? 1 : 0) : null, sort_order ?? null, collection.id).run();

  return c.json({ success: true });
});

app.delete('/api/collections/:id', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  if (auth.user.role !== 'super_admin' && auth.user.role !== 'admin') {
    return c.json({ error: 'Yetkisiz' }, 403);
  }

  const db = c.env.DB;
  const collection = await getActiveCollection(db, Number(c.req.param('id')));
  if (!collection) return c.json({ error: 'Koleksiyon bulunamadı' }, 404);
  if (collection.kind !== 'folder') return c.json({ error: 'Yalnızca klasör silinebilir' }, 400);
  if (!canManageCollectionScope(auth.user, collection)) return c.json({ error: 'Yetkisiz' }, 403);

  await c.env.DB.prepare(`UPDATE collections SET is_active = 0 WHERE id = ?`).bind(collection.id).run();
  await c.env.DB.prepare(`UPDATE collection_files SET is_active = 0 WHERE collection_id = ?`).bind(collection.id).run();

  return c.json({ success: true });
});

app.post('/api/collections/:id/files', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  if (auth.user.role !== 'super_admin' && auth.user.role !== 'admin') {
    return c.json({ error: 'Yetkisiz' }, 403);
  }

  const { file_id, display_name, category, is_public } = await c.req.json();
  if (!file_id) return c.json({ error: 'file_id zorunlu' }, 400);

  const db = c.env.DB;
  const collection = await getActiveCollection(db, Number(c.req.param('id')));
  if (!collection) return c.json({ error: 'Koleksiyon bulunamadı' }, 404);
  if (!['institution', 'system'].includes(collection.scope_type)) return c.json({ error: 'Desteklenmeyen scope' }, 400);
  if (!canManageCollectionScope(auth.user, collection)) return c.json({ error: 'Yetkisiz' }, 403);

  const stored = await getStoredFileById(db, Number(file_id));
  if (!stored) return c.json({ error: 'Dosya bulunamadı' }, 404);

  const existing = await db.prepare(`
    SELECT id
    FROM collection_files
    WHERE collection_id = ? AND file_id = ? AND is_active = 1
    LIMIT 1
  `).bind(collection.id, stored.id).first();
  if (existing) {
    await db.prepare(`UPDATE collection_files SET display_name = ?, category = ? WHERE id = ?`)
      .bind(display_name?.trim() || stored.original_name, category || 'other', existing.id).run();
    return c.json({ success: true, id: existing.id, deduplicated: true });
  }

  const result = await db.prepare(`
    INSERT INTO collection_files (collection_id, file_id, display_name, category, is_public, is_active, sort_order, added_by, added_at)
    VALUES (?, ?, ?, ?, ?, 1, 0, ?, CURRENT_TIMESTAMP)
  `).bind(
    collection.id,
    stored.id,
    display_name?.trim() || stored.original_name,
    category || 'other',
    is_public ? 1 : 0,
    auth.user.user_id
  ).run();

  return c.json({ success: true, id: result.meta?.last_row_id });
});

app.delete('/api/collections/:id/files/:fileId', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  if (auth.user.role !== 'super_admin' && auth.user.role !== 'admin') {
    return c.json({ error: 'Yetkisiz' }, 403);
  }

  const collectionId = Number(c.req.param('id'));
  const fileId = Number(c.req.param('fileId'));
  const db = c.env.DB;
  const collection = await getActiveCollection(db, collectionId);
  if (!collection) return c.json({ error: 'Koleksiyon bulunamadı' }, 404);
  if (!canManageCollectionScope(auth.user, collection)) return c.json({ error: 'Yetkisiz' }, 403);

  await db.prepare(`
    UPDATE collection_files
    SET is_active = 0
    WHERE collection_id = ? AND file_id = ? AND is_active = 1
  `).bind(collectionId, fileId).run();

  const remainingRefs = await countActiveReferences(db, fileId);
  if (remainingRefs === 0) {
    const stored = await getStoredFileById(db, fileId);
    if (stored && c.env.FILES_BUCKET) {
      await c.env.FILES_BUCKET.delete(stored.file_key);
    }
    await db.prepare(`DELETE FROM files WHERE id = ?`).bind(fileId).run();
  }

  return c.json({ success: true });
});

// ====================== KLASÖR TAŞIMA ======================

app.patch('/api/collections/:id/move', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  if (auth.user.role !== 'super_admin') return c.json({ error: 'Yetkisiz' }, 403);

  const folderId = Number(c.req.param('id'));
  const { parent_id } = await c.req.json();
  const db = c.env.DB;

  // Kaynak klasörü doğrula
  const folder = await db.prepare(
    `SELECT id, parent_id, scope_type, scope_id, kind FROM collections WHERE id = ? AND is_active = 1`
  ).bind(folderId).first();
  if (!folder) return c.json({ error: 'Klasör bulunamadı' }, 404);
  if (folder.kind !== 'folder') return c.json({ error: 'Yalnızca klasörler taşınabilir' }, 400);

  // Kendi kendine taşıma engeli
  if (parent_id != null && Number(parent_id) === folderId) {
    return c.json({ error: 'Klasör kendine taşınamaz' }, 400);
  }

  // Döngü kontrolü: hedefin ata zincirinde kaynak var mı?
  if (parent_id != null) {
    let cursor = Number(parent_id);
    const visited = new Set();
    while (cursor != null) {
      if (visited.has(cursor)) break; // sonsuz döngü koruması
      visited.add(cursor);
      if (cursor === folderId) {
        return c.json({ error: 'Klasör kendi alt klasörüne taşınamaz' }, 400);
      }
      const row = await db.prepare(`SELECT parent_id FROM collections WHERE id = ? AND is_active = 1`).bind(cursor).first();
      cursor = row?.parent_id ?? null;
    }
  }

  // Hedef parent_id'nin scope_type ve scope_id'si aynı olmalı
  if (parent_id != null) {
    const target = await db.prepare(
      `SELECT scope_type, scope_id FROM collections WHERE id = ? AND is_active = 1`
    ).bind(Number(parent_id)).first();
    if (!target) return c.json({ error: 'Hedef klasör bulunamadı' }, 404);
    if (target.scope_type !== folder.scope_type || String(target.scope_id) !== String(folder.scope_id)) {
      return c.json({ error: 'Farklı kapsama taşınamaz' }, 400);
    }
  }

  await db.prepare(`UPDATE collections SET parent_id = ? WHERE id = ?`)
    .bind(parent_id != null ? Number(parent_id) : null, folderId).run();

  return c.json({ success: true });
});

app.patch('/api/collection_files/:id/move', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  if (!['super_admin', 'admin'].includes(auth.user.role)) return c.json({ error: 'Yetkisiz' }, 403);

  const refId = Number(c.req.param('id'));
  const { target_collection_id } = await c.req.json();
  const db = c.env.DB;
  const ref = await db.prepare(`
    SELECT cf.id, col.scope_type, col.scope_id, i.name AS institution_name
    FROM collection_files cf
    JOIN collections col ON col.id = cf.collection_id
    LEFT JOIN institutions i ON i.id = col.scope_id
    WHERE cf.id = ? AND cf.is_active = 1 AND col.is_active = 1
  `).bind(refId).first();
  if (!ref) return c.json({ error: 'Dosya referansı bulunamadı' }, 404);
  // Kaynak dosyanın kurumunu da kontrol et
  if (!canManageCollectionScope(auth.user, {
    scope_type: ref.scope_type,
    scope_id: ref.scope_id,
    scope_name: ref.institution_name
  })) return c.json({ error: 'Yetkisiz' }, 403);

  const target = await getActiveCollection(db, Number(target_collection_id));
  if (!target) return c.json({ error: 'Hedef klasör bulunamadı' }, 404);
  if (String(target.scope_type) !== String(ref.scope_type) || String(target.scope_id) !== String(ref.scope_id)) {
    return c.json({ error: 'Farkli alanlar arasi tasima yapilamaz' }, 400);
  }
  if (!canManageCollectionScope(auth.user, target)) return c.json({ error: 'Yetkisiz' }, 403);

  await db.prepare(`UPDATE collection_files SET collection_id = ? WHERE id = ?`).bind(target.id, refId).run();
  return c.json({ success: true });
});

app.patch('/api/collection_files/:id/rename', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  if (auth.user.role !== 'super_admin') return c.json({ error: 'Yetkisiz' }, 403);

  const refId = Number(c.req.param('id'));
  const { display_name } = await c.req.json();
  if (!String(display_name || '').trim()) return c.json({ error: 'display_name zorunlu' }, 400);
  const db = c.env.DB;
  const ref = await db.prepare(`
    SELECT cf.id, col.scope_type, col.scope_id
    FROM collection_files cf
    JOIN collections col ON col.id = cf.collection_id
    WHERE cf.id = ? AND cf.is_active = 1 AND col.is_active = 1
  `).bind(refId).first();
  if (!ref) return c.json({ error: 'Dosya referansı bulunamadı' }, 404);
  if (!canManageCollectionScope(auth.user, ref)) return c.json({ error: 'Yetkisiz' }, 403);

  await db.prepare(`UPDATE collection_files SET display_name = ? WHERE id = ?`).bind(String(display_name).trim(), refId).run();
  return c.json({ success: true });
});

app.get('/api/system/files', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  if (auth.user.role !== 'super_admin') return c.json({ error: 'Yetkisiz' }, 403);

  const db = c.env.DB;
  const root = await ensureSystemRootCollection(db, auth.user.user_id, auth.user.user_id);
  const requestedCollectionId = c.req.query('collection_id');
  const targetCollection = await getSystemCollectionOrRoot(db, auth.user.user_id, requestedCollectionId || null, auth.user.user_id);
  if (!targetCollection) return c.json({ error: 'Koleksiyon bulunamadı' }, 404);

  const rows = await db.prepare(`
    SELECT
      cf.id,
      cf.collection_id AS folder_id,
      COALESCE(cf.display_name, f.original_name) AS file_name,
      '/api/files/' || f.file_key AS file_url,
      COALESCE(f.extension, '') AS file_type,
      f.file_size,
      COALESCE(cf.category, 'other') AS category,
      cf.added_by AS uploaded_by,
      cf.added_at AS uploaded_at,
      u.full_name AS uploaded_by_name,
      f.mime_type,
      f.id AS source_file_id
    FROM collection_files cf
    JOIN files f ON f.id = cf.file_id
    LEFT JOIN users u ON u.id = cf.added_by
    WHERE cf.collection_id = ? AND cf.is_active = 1
    ORDER BY cf.added_at DESC, cf.id DESC
  `).bind(targetCollection.id).all();

  return c.json({
    root_collection_id: root.id,
    current_collection_id: targetCollection.id,
    files: rows.results || []
  });
});

app.get('/api/system/folders', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  if (auth.user.role !== 'super_admin') return c.json({ error: 'Yetkisiz' }, 403);

  const db = c.env.DB;
  const root = await ensureSystemRootCollection(db, auth.user.user_id, auth.user.user_id);
  const parentId = c.req.query('parent_id') ? Number(c.req.query('parent_id')) : root.id;

  // Daha önce parent_id=null ile oluşturulmuş orphan klasörleri root'a bağla
  await db.prepare(`
    UPDATE collections SET parent_id = ?
    WHERE scope_type = 'system'
      AND scope_id = ?
      AND kind = 'folder'
      AND parent_id IS NULL
      AND is_active = 1
  `).bind(root.id, auth.user.user_id).run();

  // Tüm scope klasörlerini tek sorguda çek
  const allFolderRows = await db.prepare(`
    SELECT id, name AS folder_name, parent_id AS parent_folder_id, is_public, created_at
    FROM collections
    WHERE scope_type = 'system' AND scope_id = ? AND kind = 'folder' AND is_active = 1
    ORDER BY sort_order, name
  `).bind(auth.user.user_id).all();

  // Her koleksiyon için doğrudan dosya sayısını tek sorguda çek
  const fileCountRows = await db.prepare(`
    SELECT cf.collection_id, COUNT(*) AS cnt
    FROM collection_files cf
    JOIN collections col ON col.id = cf.collection_id
    WHERE col.scope_type = 'system' AND col.scope_id = ? AND cf.is_active = 1
    GROUP BY cf.collection_id
  `).bind(auth.user.user_id).all();

  const directFileCounts = {};
  for (const r of fileCountRows.results || []) {
    directFileCounts[r.collection_id] = Number(r.cnt);
  }

  // Bellek içi ağaç oluştur, recursive dosya sayısını hesapla
  const allFolders = allFolderRows.results || [];
  const folderMap = {};
  for (const f of allFolders) {
    folderMap[f.id] = { ...f, _directFiles: directFileCounts[f.id] || 0, _children: [] };
  }
  for (const f of allFolders) {
    if (f.parent_folder_id && folderMap[f.parent_folder_id]) {
      folderMap[f.parent_folder_id]._children.push(f.id);
    }
  }

  function recursiveCounts(id) {
    const node = folderMap[id];
    if (!node) return { files: 0 };
    let files = node._directFiles;
    for (const childId of node._children) {
      files += recursiveCounts(childId).files;
    }
    node._totalFiles = files;
    return { files };
  }
  for (const f of allFolders) recursiveCounts(f.id);

  // Sadece istenen parent seviyesini döndür
  const folders = allFolders
    .filter(f => f.parent_folder_id === parentId)
    .map(f => ({
      id: f.id,
      folder_name: f.folder_name,
      parent_folder_id: f.parent_folder_id,
      is_public: f.is_public,
      created_at: f.created_at,
      subfolder_count: folderMap[f.id]._children.length,
      file_count: folderMap[f.id]._totalFiles || 0,
    }));

  return c.json({ root_id: root.id, folders });
});

app.post('/api/system/file', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  if (auth.user.role !== 'super_admin') return c.json({ error: 'Yetkisiz' }, 403);

  const { file_id, file_url, file_name, file_type, folder_id, display_name, category } = await c.req.json();
  if (!file_id && !file_url) return c.json({ error: 'file_id veya file_url zorunlu' }, 400);

  const db = c.env.DB;
  const root = await ensureSystemRootCollection(db, auth.user.user_id, auth.user.user_id);
  const targetCollection = await getSystemCollectionOrRoot(db, auth.user.user_id, folder_id || null, auth.user.user_id);
  if (!targetCollection) return c.json({ error: 'Hedef klasör bulunamadı' }, 404);

  let stored = null;
  if (file_id) {
    stored = await getStoredFileById(db, Number(file_id));
  } else if (file_url) {
    const fileKey = extractManagedFileKey(file_url, c.env.R2_PUBLIC_URL);
    if (fileKey) stored = await getStoredFileByKey(db, fileKey);
  }
  if (!stored) return c.json({ error: 'Yalnızca sisteme yüklenmiş dosyalar eklenebilir' }, 400);

  const existing = await db.prepare(`
    SELECT id
    FROM collection_files
    WHERE collection_id = ? AND file_id = ? AND is_active = 1
    LIMIT 1
  `).bind(targetCollection.id, stored.id).first();
  if (existing) {
    // Upload endpoint creates a placeholder record with category='other'.
    // Always apply the user's chosen display_name and category on form submission.
    await db.prepare(`UPDATE collection_files SET display_name = ?, category = ? WHERE id = ?`)
      .bind(display_name?.trim() || stored.original_name, category || 'other', existing.id).run();
    return c.json({ success: true, id: existing.id, deduplicated: true });
  }

  if (Number(targetCollection.id) !== Number(root.id)) {
    const existingRootRef = await db.prepare(`
      SELECT id
      FROM collection_files
      WHERE collection_id = ? AND file_id = ? AND is_active = 1
      LIMIT 1
    `).bind(root.id, stored.id).first();

    if (existingRootRef) {
      const scopeRefCount = await db.prepare(`
        SELECT COUNT(*) AS cnt
        FROM collection_files cf
        JOIN collections col ON col.id = cf.collection_id
        WHERE cf.file_id = ?
          AND cf.is_active = 1
          AND col.is_active = 1
          AND col.scope_type = 'system'
          AND col.scope_id = ?
      `).bind(stored.id, auth.user.user_id).first();

      if (Number(scopeRefCount?.cnt || 0) === 1) {
        await db.prepare(`
          UPDATE collection_files
          SET collection_id = ?, display_name = ?, category = ?
          WHERE id = ?
        `).bind(
          targetCollection.id,
          display_name?.trim() || stored.original_name,
          category || 'other',
          existingRootRef.id
        ).run();

        return c.json({ success: true, id: existingRootRef.id, moved_from_root: true });
      }
    }
  }

  const result = await db.prepare(`
    INSERT INTO collection_files (collection_id, file_id, display_name, category, is_public, is_active, sort_order, added_by, added_at)
    VALUES (?, ?, ?, ?, 0, 1, 0, ?, CURRENT_TIMESTAMP)
  `).bind(
    targetCollection.id,
    stored.id,
    display_name?.trim() || stored.original_name,
    category || 'other',
    auth.user.user_id
  ).run();

  return c.json({ success: true, id: result.meta?.last_row_id });
});

app.put('/api/system/file/:id', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  if (auth.user.role !== 'super_admin') return c.json({ error: 'Yetkisiz' }, 403);

  const refId = Number(c.req.param('id'));
  const db = c.env.DB;
  const ref = await db.prepare(`
    SELECT cf.id FROM collection_files cf
    JOIN collections col ON col.id = cf.collection_id
    WHERE cf.id = ? AND cf.is_active = 1 AND col.is_active = 1
  `).bind(refId).first();
  if (!ref) return c.json({ error: 'Dosya referansı bulunamadı' }, 404);

  const { is_public, display_name, category } = await c.req.json();
  const updates = [];
  const binds = [];
  if (is_public !== undefined) { updates.push('is_public = ?'); binds.push(is_public ? 1 : 0); }
  if (display_name !== undefined) { updates.push('display_name = ?'); binds.push(display_name); }
  if (category !== undefined) { updates.push('category = ?'); binds.push(category); }
  if (!updates.length) return c.json({ error: 'Güncelleme alanı yok' }, 400);

  binds.push(refId);
  await db.prepare(`UPDATE collection_files SET ${updates.join(', ')} WHERE id = ?`).bind(...binds).run();
  return c.json({ success: true });
});

app.delete('/api/system/file/:id', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  if (auth.user.role !== 'super_admin') return c.json({ error: 'Yetkisiz' }, 403);

  const refId = Number(c.req.param('id'));
  const db = c.env.DB;
  const ref = await db.prepare(`
    SELECT cf.id, cf.file_id, col.scope_type, col.scope_id
    FROM collection_files cf
    JOIN collections col ON col.id = cf.collection_id
    WHERE cf.id = ? AND cf.is_active = 1 AND col.is_active = 1
  `).bind(refId).first();
  if (!ref) return c.json({ error: 'Dosya referansı bulunamadı' }, 404);
  if (!canManageCollectionScope(auth.user, ref)) return c.json({ error: 'Yetkisiz' }, 403);

  await db.prepare(`UPDATE collection_files SET is_active = 0 WHERE id = ?`).bind(refId).run();

  const remainingRefs = await countActiveReferences(db, ref.file_id);
  if (remainingRefs === 0) {
    const stored = await getStoredFileById(db, ref.file_id);
    if (stored && c.env.FILES_BUCKET) {
      await c.env.FILES_BUCKET.delete(stored.file_key);
    }
    await db.prepare(`DELETE FROM files WHERE id = ?`).bind(ref.file_id).run();
  }

  return c.json({ success: true });
});

app.post('/api/files/share', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  if (!['super_admin', 'admin'].includes(auth.user.role)) return c.json({ error: 'Yetkisiz' }, 403);

  const body = await parseAndValidate(c, {
    file_ids:   { required: true, type: 'array' },
    recipients: { required: true, type: 'array' },
    message:    { type: 'string', maxLength: 1000 },
    expires_at: { type: 'string', maxLength: 30 },
  });
  if (body instanceof Response) return body;
  const { file_ids, recipients, message, expires_at } = body;
  if (!file_ids.length) return c.json({ error: 'file_ids boş olamaz' }, 400);
  if (!recipients.length) return c.json({ error: 'recipients boş olamaz' }, 400);

  const db = c.env.DB;
  const resolvedRecipients = await resolveShareRecipients(db, auth.user, recipients);
  if (!resolvedRecipients.length) return c.json({ error: 'Geçerli alıcı bulunamadı' }, 400);

  const shareIds = [];
  let recipientCount = 0;
  let validFileCount = 0;

  for (const fileId of file_ids.map(Number)) {
    const stored = await getStoredFileById(db, fileId);
    if (!stored) continue;
    validFileCount++;

    const shareResult = await db.prepare(`
      INSERT INTO file_shares (file_id, from_user_id, message, expires_at, created_at, is_revoked)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 0)
    `).bind(fileId, auth.user.user_id, message || null, expires_at || null).run();

    const shareId = shareResult.meta?.last_row_id;
    shareIds.push(shareId);

    for (const recipient of resolvedRecipients) {
      await db.prepare(`
        INSERT OR IGNORE INTO share_recipients (share_id, user_id, delivered_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `).bind(shareId, recipient.id).run();

      const root = await ensureUserRootCollection(db, recipient.id);
      const existingUserRef = await db.prepare(`
        SELECT ucf.id, ucf.collection_id, ucf.display_name
        FROM user_collection_files ucf
        JOIN user_collections uc ON uc.id = ucf.collection_id
        WHERE uc.user_id = ?
          AND ucf.file_id = ?
        ORDER BY ucf.id DESC
        LIMIT 1
      `).bind(recipient.id, fileId).first();

      if (existingUserRef) {
        await db.prepare(`
          UPDATE user_collection_files
          SET
            share_id = ?,
            is_read = 0,
            added_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(shareId, existingUserRef.id).run();
      } else {
        await db.prepare(`
          INSERT INTO user_collection_files (collection_id, file_id, share_id, display_name, is_read, added_at, sort_order)
          VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP, 0)
        `).bind(root.id, fileId, shareId, stored.original_name).run();
      }

      await createNotification(
        db,
        recipient.id,
        'file_shared',
        'Yeni dosya paylasildi',
        message || `${stored.original_name} dosyasi sizinle paylasildi.`,
        { share_id: shareId, file_id: fileId, file_name: stored.original_name }
      );
      recipientCount++;
    }
  }

  if (!validFileCount) {
    return c.json({ error: 'Paylaşılabilir dosya bulunamadı' }, 400);
  }

  return c.json({ success: true, share_ids: shareIds, recipient_count: recipientCount });
});

app.get('/api/user/files', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;

  const db = c.env.DB;
  let requestedCollectionId = c.req.query('collection_id');
  let targetCollectionId = null;

  // 1. Eğer collection_id belirtilmişse, onu kullan
  if (requestedCollectionId) {
    targetCollectionId = Number(requestedCollectionId);
    
    // Klasörün kullanıcıya ait olduğunu doğrula
    const collection = await db.prepare(`
      SELECT id FROM user_collections 
      WHERE id = ? AND user_id = ?
    `).bind(targetCollectionId, auth.user.user_id).first();
    
    if (!collection) {
      return c.json({ error: 'Bu klasöre erişim yetkiniz yok' }, 403);
    }
  } else {
    // 2. Kullanıcının son ziyaret ettiği klasörü bul (session veya cookie'den)
    //    Basit çözüm: dosyası olan ilk klasörü bul
    const firstFolderWithFiles = await db.prepare(`
      SELECT uc.id
      FROM user_collections uc
      WHERE uc.user_id = ?
        AND EXISTS (
          SELECT 1 FROM user_collection_files ucf 
          WHERE ucf.collection_id = uc.id
        )
      ORDER BY uc.id ASC
      LIMIT 1
    `).bind(auth.user.user_id).first();
    
    if (firstFolderWithFiles) {
      targetCollectionId = firstFolderWithFiles.id;
    } else {
      // 3. Hiç dosya yoksa root klasörü bul
      const root = await db.prepare(`
        SELECT id FROM user_collections 
        WHERE user_id = ? AND parent_id IS NULL LIMIT 1
      `).bind(auth.user.user_id).first();
      
      if (root) {
        targetCollectionId = root.id;
      } else {
        return c.json({ error: 'Klasör bulunamadı' }, 404);
      }
    }
  }

  // Tüm kullanıcı klasörlerini getir (ana ekran için)
  const allCollections = await db.prepare(`
    SELECT 
      id, 
      user_id, 
      parent_id, 
      name, 
      created_at, 
      sort_order,
      (
        SELECT COUNT(*) FROM user_collections WHERE parent_id = uc.id
      ) as child_folder_count,
      (
        SELECT COUNT(*) FROM user_collection_files WHERE collection_id = uc.id
      ) as file_count
    FROM user_collections uc
    WHERE user_id = ?
    ORDER BY sort_order, name
  `).bind(auth.user.user_id).all();

  // Seçili klasördeki dosyaları getir
  const files = await db.prepare(`
    SELECT
      ucf.id,
      ucf.collection_id,
      ucf.share_id,
      COALESCE(ucf.display_name, f.original_name) AS file_name,
      '/api/files/' || f.file_key AS file_url,
      f.id AS file_id,
      f.file_size,
      f.mime_type,
      f.extension AS file_type,
      ucf.is_read,
      ucf.added_at,
      fs.message AS share_message,
      fs.created_at AS shared_at,
      sender.full_name AS shared_by_name
    FROM user_collection_files ucf
    JOIN files f ON f.id = ucf.file_id
    LEFT JOIN file_shares fs ON fs.id = ucf.share_id
    LEFT JOIN users sender ON sender.id = fs.from_user_id
    WHERE ucf.collection_id = ?
    ORDER BY ucf.added_at DESC, ucf.id DESC
  `).bind(targetCollectionId).all();

  return c.json({ 
    files: files.results || [], 
    collections: allCollections.results || [],
    current_collection_id: targetCollectionId
  });
});

app.get('/api/user/shared-with-me', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  const db = c.env.DB;
  const files = await db.prepare(`
    SELECT
      ucf.id,
      COALESCE(ucf.display_name, f.original_name) AS file_name,
      '/api/files/' || f.file_key AS file_url,
      f.extension AS file_type,
      ucf.added_at,
      ucf.is_read,
      fs.message AS share_message,
      sender.full_name AS shared_by_name
    FROM user_collection_files ucf
    JOIN user_collections uc ON uc.id = ucf.collection_id
    JOIN files f ON f.id = ucf.file_id
    LEFT JOIN file_shares fs ON fs.id = ucf.share_id
    LEFT JOIN users sender ON sender.id = fs.from_user_id
    WHERE uc.user_id = ?
      AND ucf.share_id IS NOT NULL
    ORDER BY ucf.added_at DESC
    LIMIT 30
  `).bind(auth.user.user_id).all();
  return c.json(files.results || []);
});

app.patch('/api/user/files/:id/read', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  const refId = Number(c.req.param('id'));
  const db = c.env.DB;
  const ref = await db.prepare(`
    SELECT ucf.id, ucf.share_id
    FROM user_collection_files ucf
    JOIN user_collections uc ON uc.id = ucf.collection_id
    WHERE ucf.id = ? AND uc.user_id = ?
  `).bind(refId, auth.user.user_id).first();
  if (!ref) return c.json({ error: 'Dosya bulunamadı' }, 404);

  await db.prepare(`UPDATE user_collection_files SET is_read = 1 WHERE id = ?`).bind(refId).run();
  if (ref.share_id) {
    await db.prepare(`
      UPDATE share_recipients
      SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
      WHERE share_id = ? AND user_id = ?
    `).bind(ref.share_id, auth.user.user_id).run();
  }
  return c.json({ success: true });
});

app.patch('/api/user/files/:id/move', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  const refId = Number(c.req.param('id'));
  const { target_collection_id } = await c.req.json();
  const db = c.env.DB;
  const target = await getUserCollection(db, Number(target_collection_id), auth.user.user_id);
  if (!target) return c.json({ error: 'Hedef klasör bulunamadı' }, 404);

  const ref = await db.prepare(`
    SELECT ucf.id
    FROM user_collection_files ucf
    JOIN user_collections uc ON uc.id = ucf.collection_id
    WHERE ucf.id = ? AND uc.user_id = ?
  `).bind(refId, auth.user.user_id).first();
  if (!ref) return c.json({ error: 'Dosya bulunamadı' }, 404);

  await db.prepare(`UPDATE user_collection_files SET collection_id = ? WHERE id = ?`).bind(target.id, refId).run();
  return c.json({ success: true });
});

app.patch('/api/user/files/:id/rename', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  const refId = Number(c.req.param('id'));
  const { display_name } = await c.req.json();
  if (!String(display_name || '').trim()) return c.json({ error: 'display_name zorunlu' }, 400);
  const db = c.env.DB;
  const ref = await db.prepare(`
    SELECT ucf.id
    FROM user_collection_files ucf
    JOIN user_collections uc ON uc.id = ucf.collection_id
    WHERE ucf.id = ? AND uc.user_id = ?
  `).bind(refId, auth.user.user_id).first();
  if (!ref) return c.json({ error: 'Dosya bulunamadı' }, 404);

  await db.prepare(`UPDATE user_collection_files SET display_name = ? WHERE id = ?`).bind(String(display_name).trim(), refId).run();
  return c.json({ success: true });
});

app.delete('/api/user/files/:id', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  const refId = Number(c.req.param('id'));
  const db = c.env.DB;
  const ref = await db.prepare(`
    SELECT ucf.id
    FROM user_collection_files ucf
    JOIN user_collections uc ON uc.id = ucf.collection_id
    WHERE ucf.id = ? AND uc.user_id = ?
  `).bind(refId, auth.user.user_id).first();
  if (!ref) return c.json({ error: 'Dosya bulunamadı' }, 404);

  await db.prepare(`DELETE FROM user_collection_files WHERE id = ?`).bind(refId).run();
  return c.json({ success: true });
});

app.post('/api/user/collections', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  const { name, parent_id } = await c.req.json();
  if (!String(name || '').trim()) return c.json({ error: 'Klasör adı zorunlu' }, 400);
  const db = c.env.DB;

  if (parent_id) {
    const parent = await getUserCollection(db, Number(parent_id), auth.user.user_id);
    if (!parent) return c.json({ error: 'Üst klasör bulunamadı' }, 404);
  }

  const result = await db.prepare(`
    INSERT INTO user_collections (user_id, parent_id, name, created_at, sort_order)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP, 0)
  `).bind(auth.user.user_id, parent_id || null, String(name).trim()).run();
  return c.json({ id: result.meta?.last_row_id, name: String(name).trim() });
});

app.put('/api/user/collections/:id', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  const collectionId = Number(c.req.param('id'));
  const { name } = await c.req.json();
  if (!String(name || '').trim()) return c.json({ error: 'Klasör adı zorunlu' }, 400);
  const db = c.env.DB;
  const collection = await getUserCollection(db, collectionId, auth.user.user_id);
  if (!collection) return c.json({ error: 'Klasör bulunamadı' }, 404);

  await db.prepare(`UPDATE user_collections SET name = ? WHERE id = ?`).bind(String(name).trim(), collectionId).run();
  return c.json({ success: true });
});

app.delete('/api/user/collections/:id', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  const collectionId = Number(c.req.param('id'));
  const db = c.env.DB;
  const collection = await getUserCollection(db, collectionId, auth.user.user_id);
  if (!collection) return c.json({ error: 'Klasör bulunamadı' }, 404);
  if (!collection.parent_id) return c.json({ error: 'Kök klasör silinemez' }, 400);

  await db.prepare(`DELETE FROM user_collection_files WHERE collection_id = ?`).bind(collectionId).run();
  await db.prepare(`DELETE FROM user_collections WHERE id = ?`).bind(collectionId).run();
  return c.json({ success: true });
});

app.get('/api/notifications', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  const db = c.env.DB;
  const unreadOnly = c.req.query('unread_only') === 'true';
  const limit = Math.min(Number(c.req.query('limit') || 20), 100);
  const offset = Math.max(Number(c.req.query('offset') || 0), 0);

  const rows = await db.prepare(`
    SELECT id, type, title, content, data, is_read, created_at
    FROM notifications
    WHERE user_id = ?
      ${unreadOnly ? 'AND is_read = 0' : ''}
    ORDER BY created_at DESC, id DESC
    LIMIT ? OFFSET ?
  `).bind(auth.user.user_id, limit, offset).all();

  const unread = await db.prepare(`
    SELECT COUNT(*) AS cnt
    FROM notifications
    WHERE user_id = ? AND is_read = 0
  `).bind(auth.user.user_id).first();

  return c.json({ notifications: rows.results || [], unread_count: Number(unread?.cnt || 0) });
});

app.patch('/api/notifications/:id/read', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  await c.env.DB.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`).bind(Number(c.req.param('id')), auth.user.user_id).run();
  return c.json({ success: true });
});

app.patch('/api/notifications/read-all', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  await c.env.DB.prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`).bind(auth.user.user_id).run();
  return c.json({ success: true });
});

app.post('/api/admin/institution', async (c) => {
  if (!await isSuperAdmin(c)) return c.json({ error: 'Sadece Super Admin' }, 403);
  const body = await parseAndValidate(c, {
    name:        { required: true, type: 'string', minLength: 2, maxLength: 200 },
    domain:      { type: 'string', maxLength: 500 },
    website_url: { type: 'string', maxLength: 500 },
    category:    { type: 'string', enum: ['University','Corporate','K-12','Government','Publisher','Service Provider','Sub-distributor'] },
    status:      { type: 'string', enum: ['Customer','Prospect','Partner','Inactive'] },
  });
  if (body instanceof Response) return body;
  const { name, domain, website_url, category, status } = body;
  const cat = category || 'University';
  const st  = status   || 'Customer';
  const db = c.env.DB;
  await ensureInstitutionMetadataColumns(db);
  try {
    const result = await db.prepare(`INSERT INTO institutions (name, domain, website_url, category, status) VALUES (?, ?, ?, ?, ?)`).bind(name.trim(), domain?.trim() || null, website_url?.trim() || null, cat, st).run();
    return c.json({ success: true, id: result.meta?.last_row_id });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return c.json({ error: 'Bu kurum adı zaten var' }, 409);
    throw e;
  }
});

app.put('/api/admin/institution/:id', async (c) => {
  if (!await isAdmin(c)) return c.json({ error: 'Yetersiz yetki' }, 403);
  const role = await getUserRole(c);
  const id = c.req.param('id');
  const { name, domain, website_url, category, status } = await c.req.json();
  const validCategories = ['University','Corporate','K-12','Government','Publisher','Service Provider','Sub-distributor'];
  const validStatuses = ['Customer','Prospect','Partner','Inactive'];
  const db = c.env.DB;
  await ensureInstitutionMetadataColumns(db);

  if (role === 'super_admin') {
    const cat = validCategories.includes(category) ? category : null;
    const st = validStatuses.includes(status) ? status : null;
    await db.prepare(`UPDATE institutions SET name = COALESCE(?, name), domain = ?, website_url = ?, category = COALESCE(?, category), status = COALESCE(?, status) WHERE id = ?`)
      .bind(name || null, domain ?? null, website_url ?? null, cat, st, id).run();
  } else {
    const payload = await getTokenPayloadFromCookie(c);
    const target = await db.prepare(`SELECT name FROM institutions WHERE id = ?`).bind(id).first();
    if (!target || !payload?.institution || target.name !== payload.institution) return c.json({ error: 'Bu kurumu düzenleme yetkiniz yok' }, 403);
    const st = validStatuses.includes(status) ? status : null;
    await db.prepare(`UPDATE institutions SET domain = ?, website_url = ?, status = COALESCE(?, status) WHERE id = ?`).bind(domain ?? null, website_url ?? null, st, id).run();
  }

  return c.json({ success: true });
});

app.post('/api/admin/institution/:id/logo', async (c) => {
  if (!await isAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);
  const id = c.req.param('id');
  const db = c.env.DB;
  const bucket = c.env.FILES_BUCKET;
  const r2PublicUrl = c.env.R2_PUBLIC_URL;

  await ensureInstitutionMetadataColumns(db);
  if (!bucket) return c.json({ error: 'FILES_BUCKET tanımlı değil' }, 500);
  if (!r2PublicUrl) return c.json({ error: 'R2_PUBLIC_URL tanımlı değil' }, 500);

  let formData;
  try { formData = await c.req.formData(); } catch { return c.json({ error: 'Form verisi okunamadı' }, 400); }
  const file = formData.get('logo');
  if (!file || typeof file === 'string') return c.json({ error: 'Logo dosyası gerekli' }, 400);

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
  if (!allowed.includes(file.type)) return c.json({ error: 'Sadece JPG, PNG, WEBP veya SVG' }, 400);
  if (file.size > 2 * 1024 * 1024) return c.json({ error: "Logo 2MB'dan küçük olmalı" }, 400);

  try {
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const key = `institution-logos/${id}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    await bucket.put(key, arrayBuffer, { httpMetadata: { contentType: file.type } });

    const logo_url = `${r2PublicUrl}/${key}`;
    await db.prepare(`UPDATE institutions SET logo_url = ? WHERE id = ?`).bind(logo_url, id).run();
    return c.json({ success: true, logo_url });
  } catch (err) {
    console.error('Institution logo upload error:', err);
    return c.json({ error: err?.message || 'Logo yükleme başarısız' }, 500);
  }
});

app.delete('/api/admin/institution/:id', async (c) => {
  if (!await isSuperAdmin(c)) return c.json({ error: 'Sadece Super Admin' }, 403);
  const id = c.req.param('id');
  const db = c.env.DB;
  const fileRows = await db.prepare(`
    SELECT DISTINCT cf.file_id
    FROM collection_files cf
    JOIN collections col ON col.id = cf.collection_id
    WHERE col.scope_type = 'institution'
      AND col.scope_id = ?
      AND cf.is_active = 1
  `).bind(id).all();
  await db.prepare(`
    UPDATE collection_files
    SET is_active = 0
    WHERE collection_id IN (
      SELECT id
      FROM collections
      WHERE scope_type = 'institution' AND scope_id = ?
    )
  `).bind(id).run();

  await db.prepare(`
    UPDATE collections
    SET is_active = 0
    WHERE scope_type = 'institution' AND scope_id = ?
  `).bind(id).run();

  for (const row of fileRows.results || []) {
    const remainingRefs = await countActiveReferences(db, row.file_id);
    if (remainingRefs > 0) continue;

    const stored = await getStoredFileById(db, row.file_id);
    if (stored && c.env.FILES_BUCKET) {
      await c.env.FILES_BUCKET.delete(stored.file_key);
    }
    await db.prepare(`DELETE FROM files WHERE id = ?`).bind(row.file_id).run();
  }

  await db.prepare(`DELETE FROM institutions WHERE id = ?`).bind(id).run();
  return c.json({ success: true });
});


// ====================== FILE ROUTES ======================

app.get('/api/files/*', async (c) => {
  const bucket = c.env.FILES_BUCKET;
  if (!bucket) return c.json({ error: 'R2 bucket bagli degil' }, 500);

  const key = c.req.path.replace(/^\/api\/files\//, '');
  if (!key) return c.json({ error: 'Dosya bulunamadı' }, 404);

  const db = c.env.DB;
  const stored = await getStoredFileByKey(db, key);
  const referenceRows = stored
    ? await db.prepare(`
        SELECT cf.is_public, col.scope_id AS institution_id
        FROM collection_files cf
        JOIN collections col ON col.id = cf.collection_id
        WHERE cf.file_id = ?
          AND cf.is_active = 1
          AND col.scope_type = 'institution'
          AND col.is_active = 1
      `).bind(stored.id).all()
    : { results: [] };

  const refs = referenceRows.results || [];
  const hasPublicReference = refs.some(row => Number(row.is_public) === 1);
  if (refs.length > 0 && !hasPublicReference) {
    const auth = await requireAuth(c);
    if (auth.response) {
      return c.json({ error: 'Bu dosyaya erişim yetkiniz yok' }, 403);
    }

    if (auth.user.role !== 'super_admin') {
      if (auth.user.role !== 'admin') {
        return c.json({ error: 'Bu dosyaya erişim yetkiniz yok' }, 403);
      }

      const adminInstitutionId = auth.user.institution_id;
      const matchesInstitution = refs.some(row => String(row.institution_id) === String(adminInstitutionId || ''));
      if (!matchesInstitution) {
        return c.json({ error: 'Bu dosyaya erişim yetkiniz yok' }, 403);
      }
    }
  }

  const object = await bucket.get(key);
  if (!object) return c.json({ error: 'Dosya bulunamadı' }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=3600');
  headers.set('content-disposition', 'inline');
  headers.delete('x-frame-options');
  headers.set('access-control-allow-origin', '*');

  return new Response(object.body, { headers });
});

app.get('/api/_legacy/files/*', (c) => c.json({ error: 'Kaldırıldı' }, 410));

// ====================== ANNOUNCEMENT ROUTES ======================

// Public: sadece yayında olanlar
app.get('/api/announcements', async (c) => {
  const db = c.env.DB;
  try {


    // Zamanı gelen planlı duyuruları otomatik yayınla
    await db.prepare(`
      UPDATE announcements
      SET is_published = 1,
          published_at = scheduled_publish_at,
          updated_at = CURRENT_TIMESTAMP
      WHERE is_published = 0
        AND scheduled_publish_at IS NOT NULL
        AND datetime(scheduled_publish_at) <= CURRENT_TIMESTAMP
    `).run();

    const rows = await db.prepare(`
      SELECT id, title, summary, full_content, title_en, summary_en, full_content_en, cover_image_url, ai_image_prompt, category, priority, published_at, scheduled_publish_at
      FROM announcements
      WHERE is_published = 1
      ORDER BY COALESCE(published_at, scheduled_publish_at) DESC
    `).all();
    const announcements = (rows.results || []).map(row => ({
      id: row.id,
      title: row.title,
      summary: row.summary,
      full_content: row.full_content,
      title_en: row.title_en,
      summary_en: row.summary_en,
      full_content_en: row.full_content_en,
      cover_image_url: row.cover_image_url,
      ai_image_prompt: row.ai_image_prompt,
      category: row.category,
      priority: row.priority,
      date: row.published_at,
      published_at: row.published_at,
      scheduled_publish_at: row.scheduled_publish_at
    }));
    return c.json(announcements);
  } catch (err) {
    console.error('Get announcements error:', err);
    return c.json({ error: err.message }, 500);
  }
});

app.get('/api/admin/announcements', async (c) => {
  if (!await isAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);
  const db = c.env.DB;
  try {


    // Zamanı gelen planlı duyuruları otomatik yayınla
    await db.prepare(`
      UPDATE announcements
      SET is_published = 1,
          published_at = scheduled_publish_at,
          updated_at = CURRENT_TIMESTAMP
      WHERE is_published = 0
        AND scheduled_publish_at IS NOT NULL
        AND datetime(scheduled_publish_at) <= CURRENT_TIMESTAMP
    `).run();

    const rows = await db.prepare(`
      SELECT a.*, u.full_name as author_name
      FROM announcements a
      LEFT JOIN users u ON a.created_by = u.id
      ORDER BY COALESCE(a.scheduled_publish_at, a.published_at, a.updated_at) DESC
    `).all();
    return c.json(rows.results || []);
  } catch (err) {
    console.error('Get admin announcements error:', err);
    return c.json({ error: err.message }, 500);
  }
});

app.post('/api/admin/announcements/upload-cover', async (c) => {
  if (!await isAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);

  const bucket = c.env.FILES_BUCKET;
  if (!bucket) return c.json({ error: 'R2 bucket bağlı değil' }, 500);

  const formData = await c.req.formData();
  const file = formData.get('file');
  if (!file || typeof file === 'string') return c.json({ error: 'Dosya bulunamadı' }, 400);

  try {
    const ext = (file.name || 'cover').split('.').pop()?.toLowerCase() || 'jpg';
    const key = `announcement-covers/${id}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    await bucket.put(key, arrayBuffer, {
      httpMetadata: { contentType: file.type || 'image/jpeg' }
    });
    const url = c.env.R2_PUBLIC_URL ? `${c.env.R2_PUBLIC_URL}/${key}` : `/api/files/${key}`;
    return c.json({ success: true, url });
  } catch (err) {
    console.error('Announcement cover upload error:', err);
    return c.json({ error: err.message || 'Yükleme başarısız' }, 400);
  }
});

app.post('/api/admin/announcements/ai/image', async (c) => {
  if (!await isSuperAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);

  try {
    const { title, summary, model, custom_prompt } = await c.req.json();
    const cleanTitle = cleanAnnouncementText(title);
    if (!cleanTitle) return c.json({ error: 'Başlık zorunludur' }, 400);

    const image = buildAnnouncementImageUrl(cleanTitle, summary, c.env, { model, custom_prompt });
    return c.json({ success: true, image_url: image.imageUrl, prompt: image.prompt, model: image.model });
  } catch (err) {
    console.error('Generate announcement image error:', err);
    return c.json({ error: err.message || 'Görsel oluşturulamadı' }, 500);
  }
});

app.post('/api/admin/announcements/ai/polish', async (c) => {
  if (!await isSuperAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);

  try {
    const payload = await c.req.json();
    if (!cleanAnnouncementText(payload.title) && !cleanAnnouncementText(payload.full_content) && !cleanAnnouncementText(payload.summary)) {
      return c.json({ error: 'Düzenlenecek metin bulunamadı' }, 400);
    }

    const polished = await runAnnouncementAiTask('polish', payload, c.env);
    return c.json({ success: true, announcement: polished });
  } catch (err) {
    console.error('Polish announcement error:', err);
    return c.json({ error: err.message || 'İçerik düzenlenemedi' }, 500);
  }
});

app.post('/api/admin/announcements/ai/translate', async (c) => {
  if (!await isSuperAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);

  try {
    const payload = await c.req.json();
    if (!cleanAnnouncementText(payload.title) && !cleanAnnouncementText(payload.full_content) && !cleanAnnouncementText(payload.summary)) {
      return c.json({ error: 'Çevrilecek metin bulunamadı' }, 400);
    }

    const translated = await runAnnouncementAiTask('translate', payload, c.env);
    return c.json({ success: true, announcement: translated });
  } catch (err) {
    console.error('Translate announcement error:', err);
    return c.json({ error: err.message || 'Çeviri yapılamadı' }, 500);
  }
});

app.post('/api/admin/announcements', async (c) => {
  if (!await isSuperAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);
  const auth = await requireAuth(c);
  const db = c.env.DB;
  const body = await c.req.json();
  const title = cleanAnnouncementText(body.title);
  const summary = cleanAnnouncementText(body.summary);
  const fullContent = cleanAnnouncementText(body.full_content);
  const titleEn = cleanAnnouncementText(body.title_en);
  const summaryEn = cleanAnnouncementText(body.summary_en);
  const fullContentEn = cleanAnnouncementText(body.full_content_en);
  const coverImageUrl = cleanAnnouncementText(body.cover_image_url);
  const aiImagePrompt = cleanAnnouncementText(body.ai_image_prompt);
  const category = cleanAnnouncementText(body.category) || 'general';
  const priority = cleanAnnouncementText(body.priority) || 'medium';
  const isPublished = body.is_published ? 1 : 0;
  const publishAt = parseAnnouncementPublishAt(body.published_at);
  const scheduledPublishAt = parseAnnouncementPublishAt(body.scheduled_publish_at);

  if (!title) return c.json({ error: 'Başlık zorunludur' }, 400);
  if (cleanAnnouncementText(body.published_at) && !publishAt) {
    return c.json({ error: 'Yayın tarihi geçersiz' }, 400);
  }
  if (cleanAnnouncementText(body.scheduled_publish_at) && !scheduledPublishAt) {
    return c.json({ error: 'Planlı yayın tarihi geçersiz' }, 400);
  }

  try {


    const result = await db.prepare(`
      INSERT INTO announcements (title, summary, full_content, title_en, summary_en, full_content_en, cover_image_url, ai_image_prompt, category, priority, is_published, published_at, scheduled_publish_at, updated_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? IS NOT NULL THEN ? ELSE CURRENT_TIMESTAMP END, ?, CURRENT_TIMESTAMP, ?)
    `).bind(title, summary, fullContent, titleEn || null, summaryEn || null, fullContentEn || null, coverImageUrl || null, aiImagePrompt || null, category, priority, isPublished, publishAt, publishAt, scheduledPublishAt, auth.user.user_id).run();
    return c.json({ success: true, id: result.meta?.last_row_id });
  } catch (err) {
    console.error('Create announcement error:', err);
    return c.json({ error: err.message }, 500);
  }
});

app.put('/api/admin/announcements/:id', async (c) => {
  if (!await isSuperAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);
  const db = c.env.DB;
  const id = c.req.param('id');
  const body = await c.req.json();
  const title = cleanAnnouncementText(body.title);
  const summary = cleanAnnouncementText(body.summary);
  const fullContent = cleanAnnouncementText(body.full_content);
  const titleEn = cleanAnnouncementText(body.title_en);
  const summaryEn = cleanAnnouncementText(body.summary_en);
  const fullContentEn = cleanAnnouncementText(body.full_content_en);
  const coverImageUrl = cleanAnnouncementText(body.cover_image_url);
  const aiImagePrompt = cleanAnnouncementText(body.ai_image_prompt);
  const category = cleanAnnouncementText(body.category) || 'general';
  const priority = cleanAnnouncementText(body.priority) || 'medium';
  const isPublished = body.is_published ? 1 : 0;
  const publishAt = parseAnnouncementPublishAt(body.published_at);
  const scheduledPublishAt = parseAnnouncementPublishAt(body.scheduled_publish_at);

  if (!title) return c.json({ error: 'Başlık zorunludur' }, 400);
  if (cleanAnnouncementText(body.published_at) && !publishAt) {
    return c.json({ error: 'Yayın tarihi geçersiz' }, 400);
  }
  if (cleanAnnouncementText(body.scheduled_publish_at) && !scheduledPublishAt) {
    return c.json({ error: 'Planlı yayın tarihi geçersiz' }, 400);
  }

  try {


    const result = await db.prepare(`
      UPDATE announcements
      SET title = ?, summary = ?, full_content = ?, title_en = ?, summary_en = ?, full_content_en = ?, cover_image_url = ?, ai_image_prompt = ?, category = ?, priority = ?, is_published = ?,
          published_at = CASE
            WHEN ? IS NOT NULL THEN ?
            WHEN ? = 1 THEN COALESCE(published_at, CURRENT_TIMESTAMP)
            ELSE published_at
          END,
          scheduled_publish_at = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(title, summary, fullContent, titleEn || null, summaryEn || null, fullContentEn || null, coverImageUrl || null, aiImagePrompt || null, category, priority, isPublished, publishAt, publishAt, isPublished, scheduledPublishAt, id).run();
    if (result.meta?.changes === 0) return c.json({ error: 'Duyuru bulunamadı' }, 404);
    return c.json({ success: true });
  } catch (err) {
    console.error('Update announcement error:', err);
    return c.json({ error: err.message }, 500);
  }
});

app.delete('/api/admin/announcements/:id', async (c) => {
  if (!await isSuperAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);
  const db = c.env.DB;
  const id = c.req.param('id');
  try {

    await db.prepare(`DELETE FROM announcements WHERE id = ?`).bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    console.error('Delete announcement error:', err);
    return c.json({ error: err.message }, 500);
  }
});

// ====================== DUYURU ETKİLEŞİMİ (REAKSİYON + YORUM) ======================
const ALLOWED_REACTIONS = ['like', 'love', 'clap', 'insightful', 'celebrate'];
const COMMENT_MAX_LEN = 2000;

// Reaksiyon + yorum özeti — duyuru modalı açıldığında tek istekle çekilir
app.get('/api/announcements/:id/engagement', async (c) => {
  const db = c.env.DB;
  const annId = Number(c.req.param('id'));
  if (!annId) return c.json({ error: 'Geçersiz duyuru id' }, 400);

  // Auth opsiyonel — kimlik doğrulanmışsa 'my_reactions' da döneriz
  const auth = await getOptionalAuth(c);
  const userId = auth && auth.user ? auth.user.user_id : null;

  try {
    // Reaksiyon sayımları
    const reactionRows = await db.prepare(`
      SELECT reaction, COUNT(*) AS cnt
      FROM announcement_reactions
      WHERE announcement_id = ?
      GROUP BY reaction
    `).bind(annId).all();

    const reactions = {};
    ALLOWED_REACTIONS.forEach(r => reactions[r] = 0);
    (reactionRows.results || []).forEach(r => {
      if (ALLOWED_REACTIONS.includes(r.reaction)) reactions[r.reaction] = Number(r.cnt) || 0;
    });

    // Kullanıcının verdiği reaksiyonlar
    let myReactions = [];
    if (userId) {
      const mine = await db.prepare(`
        SELECT reaction FROM announcement_reactions
        WHERE announcement_id = ? AND user_id = ?
      `).bind(annId, userId).all();
      myReactions = (mine.results || []).map(r => r.reaction);
    }

    // Yorumlar (silinmemiş olanlar, en yeni en üstte)
    const limit = Math.min(Number(c.req.query('comments_limit') || 50), 200);
    const commentRows = await db.prepare(`
      SELECT c.id, c.body, c.created_at, c.edited_at, c.user_id,
             u.full_name, u.avatar_url, u.role
      FROM announcement_comments c
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.announcement_id = ? AND c.is_deleted = 0
      ORDER BY c.created_at DESC, c.id DESC
      LIMIT ?
    `).bind(annId, limit).all();

    const comments = (commentRows.results || []).map(r => ({
      id: r.id,
      body: r.body,
      created_at: r.created_at,
      edited_at: r.edited_at,
      user: {
        id: r.user_id,
        full_name: r.full_name || 'Kullanıcı',
        avatar_url: r.avatar_url || null,
        role: r.role || 'user'
      },
      is_mine: userId ? r.user_id === userId : false
    }));

    return c.json({
      announcement_id: annId,
      reactions,
      my_reactions: myReactions,
      comments,
      comment_count: comments.length,
      is_authenticated: !!userId
    });
  } catch (err) {
    console.error('Get engagement error:', err);
    return c.json({ error: err.message }, 500);
  }
});

// Reaksiyon toggle — aynı tipi ikinci kez gönderirse kaldırır
app.post('/api/announcements/:id/reactions', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  const db = c.env.DB;
  const annId = Number(c.req.param('id'));
  if (!annId) return c.json({ error: 'Geçersiz duyuru id' }, 400);

  let body;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Geçersiz JSON' }, 400); }
  const reaction = String(body?.reaction || '').toLowerCase().trim();
  if (!ALLOWED_REACTIONS.includes(reaction)) {
    return c.json({ error: 'Geçersiz reaksiyon tipi' }, 400);
  }

  const userId = auth.user.user_id;

  // Duyuru var mı?
  const exists = await db.prepare(`SELECT id FROM announcements WHERE id = ?`).bind(annId).first();
  if (!exists) return c.json({ error: 'Duyuru bulunamadı' }, 404);

  try {
    const existing = await db.prepare(`
      SELECT id FROM announcement_reactions
      WHERE announcement_id = ? AND user_id = ? AND reaction = ?
    `).bind(annId, userId, reaction).first();

    let active;
    if (existing) {
      await db.prepare(`DELETE FROM announcement_reactions WHERE id = ?`).bind(existing.id).run();
      active = false;
    } else {
      await db.prepare(`
        INSERT INTO announcement_reactions (announcement_id, user_id, reaction)
        VALUES (?, ?, ?)
      `).bind(annId, userId, reaction).run();
      active = true;
    }

    // Güncel sayımı döndür (frontend tekrar hesaplamak zorunda kalmasın)
    const countRow = await db.prepare(`
      SELECT COUNT(*) AS cnt FROM announcement_reactions
      WHERE announcement_id = ? AND reaction = ?
    `).bind(annId, reaction).first();

    return c.json({
      success: true,
      reaction,
      active,
      count: Number(countRow?.cnt || 0)
    });
  } catch (err) {
    console.error('Reaction toggle error:', err);
    return c.json({ error: err.message }, 500);
  }
});

// Yorum ekle
app.post('/api/announcements/:id/comments', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  const db = c.env.DB;
  const annId = Number(c.req.param('id'));
  if (!annId) return c.json({ error: 'Geçersiz duyuru id' }, 400);

  let body;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Geçersiz JSON' }, 400); }
  const raw = String(body?.body || '').trim();
  if (!raw) return c.json({ error: 'Yorum boş olamaz' }, 400);
  if (raw.length > COMMENT_MAX_LEN) {
    return c.json({ error: `Yorum en fazla ${COMMENT_MAX_LEN} karakter olabilir` }, 400);
  }

  const userId = auth.user.user_id;

  // Duyuru var mı?
  const exists = await db.prepare(`SELECT id FROM announcements WHERE id = ?`).bind(annId).first();
  if (!exists) return c.json({ error: 'Duyuru bulunamadı' }, 404);

  try {
    const result = await db.prepare(`
      INSERT INTO announcement_comments (announcement_id, user_id, body)
      VALUES (?, ?, ?)
    `).bind(annId, userId, raw).run();

    const commentId = result.meta?.last_row_id;
    const row = await db.prepare(`
      SELECT c.id, c.body, c.created_at, c.edited_at, c.user_id,
             u.full_name, u.avatar_url, u.role
      FROM announcement_comments c
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.id = ?
    `).bind(commentId).first();

    return c.json({
      success: true,
      comment: {
        id: row.id,
        body: row.body,
        created_at: row.created_at,
        edited_at: row.edited_at,
        user: {
          id: row.user_id,
          full_name: row.full_name || 'Kullanıcı',
          avatar_url: row.avatar_url || null,
          role: row.role || 'user'
        },
        is_mine: true
      }
    });
  } catch (err) {
    console.error('Create comment error:', err);
    return c.json({ error: err.message }, 500);
  }
});

// Yorum sahibi kendi yorumunu siler (hard delete; pişmanlık hakkı)
app.delete('/api/announcements/comments/:id', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  const db = c.env.DB;
  const cid = Number(c.req.param('id'));
  if (!cid) return c.json({ error: 'Geçersiz yorum id' }, 400);

  const userId = auth.user.user_id;
  try {
    const row = await db.prepare(`
      SELECT user_id FROM announcement_comments WHERE id = ? AND is_deleted = 0
    `).bind(cid).first();
    if (!row) return c.json({ error: 'Yorum bulunamadı' }, 404);
    if (row.user_id !== userId) return c.json({ error: 'Bu yorumu silemezsin' }, 403);

    await db.prepare(`DELETE FROM announcement_comments WHERE id = ?`).bind(cid).run();
    return c.json({ success: true });
  } catch (err) {
    console.error('Delete comment error:', err);
    return c.json({ error: err.message }, 500);
  }
});

// Admin moderasyon: soft-delete (audit trail için kayıt kalır)
app.delete('/api/admin/announcements/comments/:id', async (c) => {
  if (!await isAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  const db = c.env.DB;
  const cid = Number(c.req.param('id'));
  if (!cid) return c.json({ error: 'Geçersiz yorum id' }, 400);

  try {
    await db.prepare(`
      UPDATE announcement_comments
      SET is_deleted = 1, deleted_by = ?, deleted_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(auth.user.user_id, cid).run();
    return c.json({ success: true });
  } catch (err) {
    console.error('Admin delete comment error:', err);
    return c.json({ error: err.message }, 500);
  }
});

// Admin: silinmiş dahil tüm yorumları listele (moderasyon paneli için)
app.get('/api/admin/announcements/:id/comments', async (c) => {
  if (!await isAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);
  const db = c.env.DB;
  const annId = Number(c.req.param('id'));
  if (!annId) return c.json({ error: 'Geçersiz duyuru id' }, 400);

  try {
    const rows = await db.prepare(`
      SELECT c.id, c.body, c.is_deleted, c.created_at, c.deleted_at, c.user_id,
             u.full_name, u.email, u.role
      FROM announcement_comments c
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.announcement_id = ?
      ORDER BY c.created_at DESC, c.id DESC
    `).bind(annId).all();

    return c.json({
      comments: (rows.results || []).map(r => ({
        id: r.id,
        body: r.body,
        is_deleted: !!r.is_deleted,
        created_at: r.created_at,
        deleted_at: r.deleted_at,
        user: {
          id: r.user_id,
          full_name: r.full_name || 'Kullanıcı',
          email: r.email || '',
          role: r.role || 'user'
        }
      }))
    });
  } catch (err) {
    console.error('Admin list comments error:', err);
    return c.json({ error: err.message }, 500);
  }
});

// ====================== DESTEK TALEPLERİ ======================

// Kullanıcı: yeni talep oluştur
app.post('/api/support/tickets', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  const db = c.env.DB;
  const body = await parseAndValidate(c, {
    subject:  { required: true, type: 'string', minLength: 3, maxLength: 200 },
    message:  { required: true, type: 'string', minLength: 10, maxLength: 5000 },
    priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
  });
  if (body instanceof Response) return body;
  const { subject, message, priority } = body;
  const p = priority || 'medium';
  const user = auth.user;
  const institution_id = user.institution_id || null;
  const result = await db.prepare(
    `INSERT INTO support_tickets (user_id, institution_id, subject, message, priority) VALUES (?, ?, ?, ?, ?)`
  ).bind(user.user_id, institution_id, subject.trim(), message.trim(), p).run();
  return c.json({ success: true, id: result.meta.last_row_id }, 201);
});

// Kullanıcı: kendi taleplerini listele
app.get('/api/support/tickets', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  const db = c.env.DB;
  const rows = await db.prepare(
    `SELECT t.id, t.subject, t.status, t.priority, t.created_at, t.updated_at,
      (SELECT COUNT(*) FROM ticket_replies WHERE ticket_id = t.id) as reply_count,
      EXISTS(
        SELECT 1
        FROM ticket_replies r
        WHERE r.ticket_id = t.id
          AND r.is_admin = 1
          AND r.created_at > COALESCE(t.user_last_seen, '1970-01-01 00:00:00')
      ) as has_unread_admin_reply
     FROM support_tickets t WHERE t.user_id = ? ORDER BY t.updated_at DESC`
  ).bind(auth.user.user_id).all();
  return c.json(rows.results || []);
});

// Kullanıcı: tek talep detayı (sadece kendi talebi) + mark seen
app.get('/api/support/tickets/:id', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  const db = c.env.DB;
  const id = c.req.param('id');
  const ticket = await db.prepare(
    `SELECT t.*, u.full_name as user_name, u.email as user_email
     FROM support_tickets t JOIN users u ON t.user_id = u.id
     WHERE t.id = ? AND t.user_id = ?`
  ).bind(id, auth.user.user_id).first();
  if (!ticket) return c.json({ error: 'Talep bulunamadı' }, 404);
  const replies = await db.prepare(
    `SELECT r.*, u.full_name as author_name FROM ticket_replies r
     LEFT JOIN users u ON r.user_id = u.id WHERE r.ticket_id = ? ORDER BY r.created_at ASC`
  ).bind(id).all();
  // mark user as having seen this ticket now
  await db.prepare(`UPDATE support_tickets SET user_last_seen = CURRENT_TIMESTAMP WHERE id = ?`).bind(id).run();
  return c.json({ ...ticket, replies: replies.results || [] });
});

// Kullanıcı: talebe yanıt yaz (JSON veya multipart)
app.post('/api/support/tickets/:id/reply', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  const db = c.env.DB;
  const bucket = c.env.FILES_BUCKET;
  const id = c.req.param('id');
  const ticket = await db.prepare(`SELECT id FROM support_tickets WHERE id = ? AND user_id = ?`)
    .bind(id, auth.user.user_id).first();
  if (!ticket) return c.json({ error: 'Talep bulunamadı' }, 404);

  let message = '', attachment_url = null;
  const ct = c.req.header('content-type') || '';
  if (ct.includes('multipart/form-data')) {
    const fd = await c.req.formData();
    message = String(fd.get('message') || '').trim();
    const file = fd.get('file');
    if (file && typeof file !== 'string' && bucket) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const key = `ticket-attachments/${id}-${Date.now()}.${ext}`;
      await bucket.put(key, await file.arrayBuffer(), { 
    httpMetadata: { contentType: file.type },
    });
      attachment_url = c.env.R2_PUBLIC_URL ? `${c.env.R2_PUBLIC_URL}/${key}` : `/api/files/${key}`;
    }
  } else {
    const body = await c.req.json();
    message = String(body.message || '').trim();
  }
  if (!message && !attachment_url) return c.json({ error: 'Mesaj veya dosya gerekli' }, 400);

  await db.prepare(`INSERT INTO ticket_replies (ticket_id, user_id, message, is_admin, attachment_url) VALUES (?, ?, ?, 0, ?)`)
    .bind(id, auth.user.user_id, message, attachment_url).run();
  await db.prepare(`UPDATE support_tickets SET status = 'open', updated_at = CURRENT_TIMESTAMP, user_last_seen = CURRENT_TIMESTAMP WHERE id = ?`).bind(id).run();
  return c.json({ success: true });
});

// Admin: tüm/kurum taleplerini listele
app.get('/api/admin/support/tickets', async (c) => {
  if (!await isAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);
  const db = c.env.DB;
  const role = await getUserRole(c);
  const isSA = role === 'super_admin';
  const instId = await getUserInstitutionId(c);
  const VALID_STATUSES   = new Set(['open', 'in_progress', 'resolved', 'closed']);
  const VALID_PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);

  const statusParam   = c.req.query('status')   || '';
  const priorityParam = c.req.query('priority')  || '';
  const status   = VALID_STATUSES.has(statusParam)   ? statusParam   : '';
  const priority = VALID_PRIORITIES.has(priorityParam) ? priorityParam : '';

  const conditions = [];
  const bindings   = [];

  if (!isSA) {
    conditions.push('t.institution_id = ?');
    bindings.push(instId ? Number(instId) : 0);
  }
  if (status) {
    conditions.push('t.status = ?');
    bindings.push(status);
  }
  if (priority) {
    conditions.push('t.priority = ?');
    bindings.push(priority);
  }

  const where = conditions.length ? conditions.join(' AND ') : '1=1';

  const rows = await db.prepare(
    `SELECT t.id, t.subject, t.status, t.priority, t.created_at, t.updated_at,
      u.full_name as user_name, u.email as user_email,
      COALESCE(i.name, '') as institution_name,
      (SELECT COUNT(*) FROM ticket_replies WHERE ticket_id = t.id) as reply_count,
      EXISTS(
        SELECT 1
        FROM ticket_replies r
        WHERE r.ticket_id = t.id
          AND r.is_admin = 0
          AND r.created_at > COALESCE(t.admin_last_seen, '1970-01-01 00:00:00')
      ) as has_unread_user_reply
     FROM support_tickets t
     JOIN users u ON t.user_id = u.id
     LEFT JOIN institutions i ON t.institution_id = i.id
     WHERE ${where} ORDER BY t.updated_at DESC`
  ).bind(...bindings).all();
  return c.json(rows.results || []);
});

// Admin: tek talep detayı
app.get('/api/admin/support/tickets/:id', async (c) => {
  if (!await isAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);
  const db = c.env.DB;
  const id = c.req.param('id');
  const role = await getUserRole(c);
  const isSA = role === 'super_admin';
  const instId = await getUserInstitutionId(c);

  const ticket = await db.prepare(
    `SELECT t.*, u.full_name as user_name, u.email as user_email, COALESCE(i.name,'') as institution_name
     FROM support_tickets t JOIN users u ON t.user_id = u.id LEFT JOIN institutions i ON t.institution_id = i.id
     WHERE t.id = ?`
  ).bind(id).first();
  if (!ticket) return c.json({ error: 'Talep bulunamadı' }, 404);
  if (!isSA && instId && String(ticket.institution_id) !== String(instId))
    return c.json({ error: 'Yetkisiz' }, 403);

  const replies = await db.prepare(
    `SELECT r.*, u.full_name as author_name FROM ticket_replies r
     LEFT JOIN users u ON r.user_id = u.id WHERE r.ticket_id = ? ORDER BY r.created_at ASC`
  ).bind(id).all();
  await db.prepare(`UPDATE support_tickets SET admin_last_seen = CURRENT_TIMESTAMP WHERE id = ?`).bind(id).run();
  return c.json({ ...ticket, replies: replies.results || [] });
});

// Admin: durum güncelle
app.put('/api/admin/support/tickets/:id', async (c) => {
  if (!await isAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);
  const db = c.env.DB;
  const id = c.req.param('id');
  const { status, priority } = await c.req.json();
  const allowed_status = ['open', 'in_progress', 'resolved', 'closed'];
  const allowed_priority = ['low', 'medium', 'high', 'urgent'];
  const updates = [];
  if (status && allowed_status.includes(status)) updates.push(`status = '${status}'`);
  if (priority && allowed_priority.includes(priority)) updates.push(`priority = '${priority}'`);
  if (!updates.length) return c.json({ error: 'Güncellenecek alan yok' }, 400);
  updates.push(`updated_at = CURRENT_TIMESTAMP`);
  await db.prepare(`UPDATE support_tickets SET ${updates.join(', ')} WHERE id = ?`).bind(id).run();
  return c.json({ success: true });
});

// Admin: talebe yan?t yaz
app.post('/api/admin/support/tickets/:id/reply', async (c) => {
  if (!await isAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);
  const db = c.env.DB;
  const bucket = c.env.FILES_BUCKET;
  const id = c.req.param('id');
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;

  let message = '', attachment_url = null;
  const ct = c.req.header('content-type') || '';
  if (ct.includes('multipart/form-data')) {
    const fd = await c.req.formData();
    message = String(fd.get('message') || '').trim();
    const file = fd.get('file');
    if (file && typeof file !== 'string' && bucket) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const key = `ticket-attachments/${id}-admin-${Date.now()}.${ext}`;
      await bucket.put(key, await file.arrayBuffer(), { 
    httpMetadata: { contentType: file.type },
    customMetadata: { 'x-amz-acl': 'public-read' }
    });
      attachment_url = c.env.R2_PUBLIC_URL ? `${c.env.R2_PUBLIC_URL}/${key}` : `/api/files/${key}`;
    }
  } else {
    const body = await c.req.json();
    message = String(body.message || '').trim();
  }
  if (!message && !attachment_url) return c.json({ error: 'Mesaj veya dosya gerekli' }, 400);

  await db.prepare(`INSERT INTO ticket_replies (ticket_id, user_id, message, is_admin, attachment_url) VALUES (?, ?, ?, 1, ?)`)
    .bind(id, auth.user.user_id, message, attachment_url).run();
  await db.prepare(`UPDATE support_tickets SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP, admin_last_seen = CURRENT_TIMESTAMP WHERE id = ?`).bind(id).run();
  return c.json({ success: true });
});

// ====================== AIRTABLE HELPERS ======================

// Account bul veya oluştur
async function findOrCreateAccount(env, accountName, ip) {
    if (!accountName) return null;

    const url = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/Accounts`;

    // Önce var mı kontrol et (formül tümünü encode et)
    const searchFormula = `{Account Name}="${accountName}"`;
    const searchRes = await fetch(`${url}?filterByFormula=${encodeURIComponent(searchFormula)}`, {
        headers: { 'Authorization': `Bearer ${env.AIRTABLE_PAT}` }
    });
    const searchData = await searchRes.json();

    if (searchData.records && searchData.records.length > 0) {
        return searchData.records[0].id;
    }

    // Yoksa oluştur
    const fields = {
        "Account Name": accountName,
        "Region": "Türkiye",
        "Industry": "University",
        "IP Range": ip || ""
    };

    const createRes = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${env.AIRTABLE_PAT}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields })
    });
    const createData = await createRes.json();
    if (!createRes.ok) console.error('Airtable Account create error:', JSON.stringify(createData));
    return createData.id || null;
}

// Contact bul veya oluştur
async function findOrCreateContact(env, contactData, accountId) {
    const url = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/Contacts`;

    // Email ile var mı kontrol et
    if (contactData.email) {
        const searchFormula = `{Email}="${contactData.email}"`;
        const searchRes = await fetch(`${url}?filterByFormula=${encodeURIComponent(searchFormula)}`, {
            headers: { 'Authorization': `Bearer ${env.AIRTABLE_PAT}` }
        });
        const searchData = await searchRes.json();

        if (searchData.records && searchData.records.length > 0) {
            return searchData.records[0].id;
        }
    }

    // Ad soyad ayır
    const fullName = contactData.name || '';
    const spaceIndex = fullName.indexOf(' ');
    const firstName = spaceIndex > 0 ? fullName.substring(0, spaceIndex) : fullName;
    const lastName = spaceIndex > 0 ? fullName.substring(spaceIndex + 1) : '';

    const fields = {
        "First Name": firstName,
        "Last Name": lastName,
        "Email": contactData.email || '',
        "Title": contactData.title || "Director"
    };

    if (accountId) {
        fields["Account"] = [accountId];
    }

    const createRes = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${env.AIRTABLE_PAT}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields })
    });
    const createData = await createRes.json();
    if (!createRes.ok) console.error('Airtable Contact create error:', JSON.stringify(createData));
    return createData.id || null;
}

// Ana fonksiyon - form verilerini Airtable'a gönder
async function sendToAirtable(env, formData, formType, ip) {
    try {
        const accountName = formData.institution || formData.company || '';
        const accountId = await findOrCreateAccount(env, accountName, ip);
        const fallbackName = formData.email
            ? formData.email.split('@')[0]
            : 'Newsletter Subscriber';

        const contactData = {
            name: formData.name || fallbackName,
            email: formData.email,
            title: formData.title || "Director"
        };
        await findOrCreateContact(env, contactData, accountId);

        console.log(`✅ Airtable: ${formType} talebi işlendi - Kurum: ${accountName}`);
        return true;
    } catch (err) {
        console.error('Airtable hatası:', err);
        return false;
    }
}

// ====================== CONTACT ROUTES ======================

app.post('/api/contact', async (c) => {
    try {
        const body = await c.req.json();
        const { name, email, formType, company, product, subject, message, onBehalf } = body;
        const type = formType || 'contact';
        const normalizedEmail = String(email || '').trim();
        const normalizedName = String(name || '').trim();

        if (!normalizedEmail) {
            return c.json({ error: 'E-posta zorunludur.' }, 400);
        }

        if (type !== 'newsletter' && !normalizedName) {
            return c.json({ error: 'Ad ve e-posta zorunludur.' }, 400);
        }

        const ip = c.req.header('CF-Connecting-IP') || '';
        body.email = normalizedEmail;
        if (normalizedName) body.name = normalizedName;

        // Giriş yapmış kullanıcıyı tespit et (hata olursa görmezden gel)
        let userId = null;
        try {
            const auth = await requireAuth(c);
            if (!auth.response) userId = auth.user.user_id;
        } catch (_) {}

        // D1'e kaydet
        const db = c.env.DB;
        await db.prepare(`
            INSERT INTO form_submissions (form_type, name, email, institution, product, subject, message, user_id, on_behalf)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            type,
            normalizedName || null,
            normalizedEmail,
            company || null,
            product || null,
            subject || null,
            message || null,
            userId,
            onBehalf ? 1 : 0
        ).run();

        // Airtable arka planda
        c.executionCtx.waitUntil(
            sendToAirtable(c.env, body, type, ip).catch(err =>
                console.error('Airtable background error:', err)
            )
        );

        return c.json({ success: true });
    } catch (err) {
        console.error('Contact endpoint error:', err);
        return c.json({ error: err.message }, 500);
    }
});

// Kullanıcı: kendi form gönderimlerini listele
app.get('/api/user/submissions', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  const db = c.env.DB;
  const rows = await db.prepare(
    `SELECT id, form_type, name, institution, product, subject, message, status, admin_note, submitted_at
     FROM form_submissions
     WHERE user_id = ?
        OR (user_id IS NULL AND LOWER(TRIM(email)) = LOWER(TRIM(?)))
     ORDER BY submitted_at DESC`
  ).bind(auth.user.user_id, auth.user.email || '').all();
  return c.json(rows.results || []);
});

// Admin: tüm form gönderimlerini listele
app.get('/api/admin/submissions', async (c) => {
    if (!await isSuperAdmin(c)) return c.json({ error: 'Sadece Super Admin' }, 403);
    const db = c.env.DB;
    const status = c.req.query('status');
    const type = c.req.query('type');

    let query = `SELECT fs.*, u.full_name as user_name FROM form_submissions fs
                 LEFT JOIN users u ON fs.user_id = u.id`;
    const conditions = [];
    const bindings = [];

    if (status) { conditions.push(`fs.status = ?`); bindings.push(status); }
    if (type)   { conditions.push(`fs.form_type = ?`); bindings.push(type); }

    if (conditions.length) query += ` WHERE ` + conditions.join(' AND ');
    query += ` ORDER BY fs.submitted_at DESC LIMIT 200`;

    const rows = await db.prepare(query).bind(...bindings).all();
    return c.json(rows.results || []);
});

// Admin: durum veya not güncelle
app.put('/api/admin/submission/:id', async (c) => {
    if (!await isSuperAdmin(c)) return c.json({ error: 'Sadece Super Admin' }, 403);
    const id = c.req.param('id');
    const { status, admin_note } = await c.req.json();
    const db = c.env.DB;

    const validStatuses = ['pending', 'reviewing', 'responded', 'completed'];
    if (status && !validStatuses.includes(status)) {
        return c.json({ error: 'Geçersiz durum' }, 400);
    }

    await db.prepare(`
        UPDATE form_submissions
        SET status = COALESCE(?, status),
            admin_note = COALESCE(?, admin_note),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).bind(status || null, admin_note ?? null, id).run();

    return c.json({ success: true });
});


// Airtable kayıtlarını çekip parse eden yardımcı
async function fetchAirtableAccounts(env) {
    const baseId = env.AIRTABLE_BASE_ID;
    const pat = env.AIRTABLE_PAT;
    let records = [];
    let offset = null;
    do {
        const url = new URL(`https://api.airtable.com/v0/${baseId}/Accounts`);
        url.searchParams.set('pageSize', '100');
        if (offset) url.searchParams.set('offset', offset);
        const res = await fetch(url.toString(), { headers: { 'Authorization': `Bearer ${pat}` } });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        records = records.concat(data.records || []);
        offset = data.offset || null;
    } while (offset);
    return records.map(r => ({
        airtable_id: r.id,
        name: r.fields['Account Name'] || '',
        domain: r.fields['Domain'] || '',
        website_url: r.fields['Company website'] || r.fields['Website'] || r.fields['Website URL'] || r.fields['Web Site'] || '',
        city: r.fields['City'] || r.fields['Sehir'] || r.fields['Şehir'] || '',
        category: Array.isArray(r.fields['Organization']) ? r.fields['Organization'][0] : (r.fields['Organization'] || ''),
        status: Array.isArray(r.fields['Status']) ? r.fields['Status'][0] : (r.fields['Status'] || ''),
    }));
}

function buildAirtableAccountFields(record) {
    return {
        'Account Name': record.name || '',
        'Domain': record.domain || '',
        'Company website': record.website_url || '',
        'City': record.city || '',
        'Organization': record.category || null,
        'Status': record.status || null,
    };
}

async function createAirtableAccount(env, record) {
    const url = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/Accounts`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${env.AIRTABLE_PAT}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields: buildAirtableAccountFields(record) })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || 'Airtable create hatası');
    return data;
}

async function updateAirtableAccount(env, airtableId, record) {
    const url = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/Accounts/${airtableId}`;
    const res = await fetch(url, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${env.AIRTABLE_PAT}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields: buildAirtableAccountFields(record) })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || 'Airtable update hatası');
    return data;
}

async function fetchAirtableContacts(env, accountMap = new Map()) {
    const baseId = env.AIRTABLE_BASE_ID;
    const pat = env.AIRTABLE_PAT;
    let records = [];
    let offset = null;

    do {
        const url = new URL(`https://api.airtable.com/v0/${baseId}/Contacts`);
        url.searchParams.set('pageSize', '100');
        if (offset) url.searchParams.set('offset', offset);
        const res = await fetch(url.toString(), { headers: { 'Authorization': `Bearer ${pat}` } });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        records = records.concat(data.records || []);
        offset = data.offset || null;
    } while (offset);

    const scalar = (value) => Array.isArray(value) ? (value[0] || '') : (value || '');
    const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
    const pickPrimaryEmail = (value) => {
        const raw = String(scalar(value) || '').trim();
        if (!raw) {
            return { email: '', emails: [], note: '' };
        }

        const candidates = raw
            .split(/[;,/]+/)
            .map(item => item.trim().toLowerCase())
            .filter(Boolean);

        const validEmails = candidates.filter(isValidEmail);
        const primary = validEmails[0] || (isValidEmail(raw.toLowerCase()) ? raw.toLowerCase() : '');
        const note = validEmails.length > 1
            ? `Çoklu e-posta bulundu, ilk adres kullanıldı: ${primary}`
            : '';

        return {
            email: primary,
            emails: validEmails,
            note
        };
    };

    return records.map(r => {
        const accountRaw = r.fields['Account'];
        const accountId = Array.isArray(accountRaw) ? (accountRaw[0] || '') : '';
        const accountName = accountMap.get(accountId) || scalar(r.fields['Account Name']) || scalar(accountRaw);
        const emailSelection = pickPrimaryEmail(r.fields['Email']);

        return {
            airtable_id: r.id,
            first_name: String(r.fields['First Name'] || '').trim(),
            last_name: String(r.fields['Last Name'] || '').trim(),
            email: emailSelection.email,
            email_candidates: emailSelection.emails,
            sync_note: emailSelection.note,
            title: String(scalar(r.fields['Title']) || '').trim(),
            account_name: String(accountName || '').trim(),
            account_airtable_id: accountId || null
        };
    });
}

function normalizeComparableValue(value) {
    return String(value || '').trim();
}

async function resolveInstitutionForContact(db, contact) {
    if (contact.account_airtable_id) {
        const byAirtable = await db.prepare(`
          SELECT id, name, airtable_id FROM institutions WHERE airtable_id = ?
        `).bind(contact.account_airtable_id).first();
        if (byAirtable) return byAirtable;
    }

    if (contact.account_name) {
        const byName = await db.prepare(`
          SELECT id, name, airtable_id FROM institutions WHERE LOWER(name) = LOWER(?)
        `).bind(contact.account_name).first();
        if (byName) return byName;
    }

    return null;
}

async function buildAirtableUserSyncChanges(c, { restrictToAdminInstitution = true } = {}) {
    const db = c.env.DB;
  

    const accounts = await fetchAirtableAccounts(c.env);
    const accountMap = new Map(accounts.map(account => [account.airtable_id, account.name]));
    let contacts = await fetchAirtableContacts(c.env, accountMap);

    const auth = await requireAuth(c);
    if (auth.response) throw new Error('Yetkisiz');

    if (restrictToAdminInstitution && auth.user.role === 'admin') {
        const adminInstitutionId = auth.user.institution_id || null;
        const adminInstitutionName = normalizeComparableValue(auth.user.institution).toLowerCase();
        let adminInstitutionAirtableId = null;

        if (adminInstitutionId) {
            const institution = await db.prepare(`
              SELECT airtable_id, name FROM institutions WHERE id = ?
            `).bind(adminInstitutionId).first();
            adminInstitutionAirtableId = institution?.airtable_id || null;
        }

        contacts = contacts.filter(contact => {
            const sameAirtable = adminInstitutionAirtableId && contact.account_airtable_id === adminInstitutionAirtableId;
            const sameName = adminInstitutionName && normalizeComparableValue(contact.account_name).toLowerCase() === adminInstitutionName;
            return sameAirtable || sameName;
        });
    }

    const changes = [];
    for (const contact of contacts) {
        if (!contact.email) continue;

        const profileFields = normalizeUserProfileFields(contact);
        const linkedInstitution = await resolveInstitutionForContact(db, contact);
        const existing = await db.prepare(`
          SELECT id, email, full_name, first_name, last_name, title, institution, institution_id, role
          FROM users
          WHERE LOWER(email) = LOWER(?)
        `).bind(contact.email).first();

        const nextState = {
            email: contact.email,
            first_name: profileFields.first_name,
            last_name: profileFields.last_name,
            full_name: profileFields.full_name,
            title: profileFields.title,
            institution: linkedInstitution?.name || contact.account_name || null,
            institution_id: linkedInstitution?.id || null,
            account_name: contact.account_name || null,
            account_airtable_id: contact.account_airtable_id || null
        };

        if (existing) {
            const changed =
                normalizeComparableValue(existing.first_name) !== normalizeComparableValue(nextState.first_name) ||
                normalizeComparableValue(existing.last_name) !== normalizeComparableValue(nextState.last_name) ||
                normalizeComparableValue(existing.full_name) !== normalizeComparableValue(nextState.full_name) ||
                normalizeComparableValue(existing.title) !== normalizeComparableValue(nextState.title) ||
                normalizeComparableValue(existing.institution) !== normalizeComparableValue(nextState.institution) ||
                Number(existing.institution_id || 0) !== Number(nextState.institution_id || 0);

            if (changed) {
                changes.push({
                    action: 'update',
                    id: existing.id,
                    email: nextState.email,
                    first_name: nextState.first_name,
                    last_name: nextState.last_name,
                    full_name: nextState.full_name,
                    title: nextState.title,
                    institution: nextState.institution,
                    institution_id: nextState.institution_id,
                    account_name: nextState.account_name,
                    account_airtable_id: nextState.account_airtable_id,
                    sync_note: contact.sync_note || '',
                    before: {
                        full_name: existing.full_name,
                        title: existing.title,
                        institution: existing.institution,
                        role: existing.role
                    }
                });
            }
        } else {
            changes.push({
                action: 'create',
                email: nextState.email,
                first_name: nextState.first_name,
                last_name: nextState.last_name,
                full_name: nextState.full_name,
                title: nextState.title,
                institution: nextState.institution,
                institution_id: nextState.institution_id,
                account_name: nextState.account_name,
                account_airtable_id: nextState.account_airtable_id,
                sync_note: contact.sync_note || '',
                before: null
            });
        }
    }

    return { total: contacts.length, changes };
}

// GET /api/admin/sync/airtable-to-d1 — Dry-run, önizleme
app.get('/api/admin/sync/airtable-to-d1', async (c) => {
    const auth = await requireAuth(c);
    if (auth.response) return auth.response;
    if (auth.user.role !== 'admin' && auth.user.role !== 'super_admin') return c.json({ error: 'Yetkisiz' }, 403);
    if (!c.env.AIRTABLE_BASE_ID || !c.env.AIRTABLE_PAT) return c.json({ error: 'Airtable ayarları eksik' }, 500);

    try {
        const db = c.env.DB;
        await ensureInstitutionMetadataColumns(db);
        const records = await fetchAirtableAccounts(c.env);
        const changes = [];

        for (const rec of records) {
            if (!rec.name) continue;

            const existing = await db.prepare(
                `SELECT id, name, domain, website_url, city, category, status FROM institutions WHERE airtable_id = ?`
            ).bind(rec.airtable_id).first();

            if (existing) {
                // Değişiklik var mı? (null ve '' aynı kabul et)
                const norm = v => v || '';
                if (norm(existing.name) !== norm(rec.name) || norm(existing.domain) !== norm(rec.domain) ||
                    norm(existing.website_url) !== norm(rec.website_url) || norm(existing.city) !== norm(rec.city) ||
                    norm(existing.category) !== norm(rec.category) || norm(existing.status) !== norm(rec.status)) {
                    changes.push({
                        action: 'update',
                        airtable_id: rec.airtable_id,
                        name: rec.name,
                        domain: rec.domain,
                        website_url: rec.website_url,
                        city: rec.city,
                        category: rec.category,
                        status: rec.status,
                        before: { name: existing.name, domain: existing.domain, website_url: existing.website_url, city: existing.city, category: existing.category, status: existing.status }
                    });
                }
            } else {
                const nameConflict = await db.prepare(
                    `SELECT id, name, domain, website_url, city, category, status FROM institutions WHERE name = ?`
                ).bind(rec.name).first();

                if (nameConflict) {
                    changes.push({
                        action: 'link',
                        airtable_id: rec.airtable_id,
                        name: rec.name,
                        domain: rec.domain,
                        website_url: rec.website_url,
                        city: rec.city,
                        category: rec.category,
                        status: rec.status,
                        before: { name: nameConflict.name, domain: nameConflict.domain, website_url: nameConflict.website_url, city: nameConflict.city, category: nameConflict.category, status: nameConflict.status }
                    });
                } else {
                    changes.push({
                        action: 'create',
                        airtable_id: rec.airtable_id,
                        name: rec.name,
                        domain: rec.domain,
                        website_url: rec.website_url,
                        city: rec.city,
                        category: rec.category,
                        status: rec.status,
                        before: null
                    });
                }
            }
        }

        return c.json({ success: true, total: records.length, changes });
    } catch (err) {
        console.error('Sync preview error:', err);
        return c.json({ error: err.message }, 500);
    }
});

// POST /api/admin/sync/airtable-to-d1 — Seçili değişiklikleri uygula
app.post('/api/admin/sync/airtable-to-d1', async (c) => {
    const auth = await requireAuth(c);
    if (auth.response) return auth.response;
    if (auth.user.role !== 'admin' && auth.user.role !== 'super_admin') return c.json({ error: 'Yetkisiz' }, 403);
    if (!c.env.AIRTABLE_BASE_ID || !c.env.AIRTABLE_PAT) return c.json({ error: 'Airtable ayarları eksik' }, 500);

    try {
        const db = c.env.DB;
        await ensureInstitutionMetadataColumns(db);
        const { changes } = await c.req.json(); // Seçili change listesi
        if (!Array.isArray(changes) || changes.length === 0) return c.json({ error: 'Uygulanacak değişiklik yok' }, 400);

        let created = 0, updated = 0;

        for (const ch of changes) {
            const { action, airtable_id, name, domain, website_url, city, category, status } = ch;
            if (!name || !airtable_id) continue;

            if (action === 'update') {
                await db.prepare(
                    `UPDATE institutions SET name = ?, domain = ?, website_url = ?, city = ?, category = ?, status = ? WHERE airtable_id = ?`
                ).bind(name, domain, website_url || null, city || null, category, status, airtable_id).run();
                updated++;
            } else if (action === 'link') {
                await db.prepare(
                    `UPDATE institutions SET domain = ?, website_url = ?, city = ?, category = ?, status = ?, airtable_id = ? WHERE name = ?`
                ).bind(domain, website_url || null, city || null, category, status, airtable_id, name).run();
                updated++;
            } else if (action === 'create') {
                await db.prepare(
                    `INSERT INTO institutions (name, domain, website_url, city, category, status, airtable_id) VALUES (?, ?, ?, ?, ?, ?, ?)`
                ).bind(name, domain, website_url || null, city || null, category, status, airtable_id).run();
                created++;
            }
        }

        console.log(`✅ Sync uygulandı: ${created} eklendi, ${updated} güncellendi`);
        return c.json({ success: true, created, updated });
    } catch (err) {
        console.error('Sync apply error:', err);
        return c.json({ error: err.message }, 500);
    }
});

// GET /api/admin/sync/d1-to-airtable — Dry-run, önizleme
app.get('/api/admin/sync/d1-to-airtable', async (c) => {
    const auth = await requireAuth(c);
    if (auth.response) return auth.response;
    if (auth.user.role !== 'super_admin') return c.json({ error: 'Sadece Super Admin' }, 403);
    if (!c.env.AIRTABLE_BASE_ID || !c.env.AIRTABLE_PAT) return c.json({ error: 'Airtable ayarları eksik' }, 500);

    try {
        const db = c.env.DB;
        await ensureInstitutionMetadataColumns(db);

        const institutionsResult = await db.prepare(
            `SELECT id, name, domain, website_url, city, category, status, airtable_id
             FROM institutions
             ORDER BY name COLLATE NOCASE ASC`
        ).all();
        const institutions = institutionsResult.results || [];
        const airtableAccounts = await fetchAirtableAccounts(c.env);
        const airtableById = new Map(airtableAccounts.map(account => [account.airtable_id, account]));
        const airtableByName = new Map();
        for (const account of airtableAccounts) {
            const key = normalizeComparableValue(account.name).toLowerCase();
            if (key && !airtableByName.has(key)) airtableByName.set(key, account);
        }

        const changes = [];
        const norm = (value) => normalizeComparableValue(value);

        for (const institution of institutions) {
            if (!institution.name) continue;

            const nextState = {
                institution_id: institution.id,
                airtable_id: institution.airtable_id || null,
                name: institution.name || '',
                domain: institution.domain || '',
                website_url: institution.website_url || '',
                city: institution.city || '',
                category: institution.category || '',
                status: institution.status || '',
            };

            const linkedAccount = nextState.airtable_id ? airtableById.get(nextState.airtable_id) : null;
            const nameMatchedAccount = linkedAccount || airtableByName.get(norm(nextState.name).toLowerCase()) || null;

            if (linkedAccount) {
                const changed =
                    norm(linkedAccount.name) !== norm(nextState.name) ||
                    norm(linkedAccount.domain) !== norm(nextState.domain) ||
                    norm(linkedAccount.website_url) !== norm(nextState.website_url) ||
                    norm(linkedAccount.city) !== norm(nextState.city) ||
                    norm(linkedAccount.category) !== norm(nextState.category) ||
                    norm(linkedAccount.status) !== norm(nextState.status);

                if (changed) {
                    changes.push({
                        action: 'update',
                        ...nextState,
                        before: {
                            name: linkedAccount.name,
                            domain: linkedAccount.domain,
                            website_url: linkedAccount.website_url,
                            city: linkedAccount.city,
                            category: linkedAccount.category,
                            status: linkedAccount.status,
                        }
                    });
                }
                continue;
            }

            if (nameMatchedAccount) {
                const changed =
                    norm(nameMatchedAccount.name) !== norm(nextState.name) ||
                    norm(nameMatchedAccount.domain) !== norm(nextState.domain) ||
                    norm(nameMatchedAccount.website_url) !== norm(nextState.website_url) ||
                    norm(nameMatchedAccount.city) !== norm(nextState.city) ||
                    norm(nameMatchedAccount.category) !== norm(nextState.category) ||
                    norm(nameMatchedAccount.status) !== norm(nextState.status) ||
                    !nextState.airtable_id;

                if (changed) {
                    changes.push({
                        action: 'link',
                        ...nextState,
                        airtable_id: nameMatchedAccount.airtable_id,
                        before: {
                            name: nameMatchedAccount.name,
                            domain: nameMatchedAccount.domain,
                            website_url: nameMatchedAccount.website_url,
                            city: nameMatchedAccount.city,
                            category: nameMatchedAccount.category,
                            status: nameMatchedAccount.status,
                        }
                    });
                }
                continue;
            }

            changes.push({
                action: 'create',
                ...nextState,
                before: null
            });
        }

        return c.json({ success: true, total: institutions.length, changes });
    } catch (err) {
        console.error('D1 to Airtable sync preview error:', err);
        return c.json({ error: err.message }, 500);
    }
});

// POST /api/admin/sync/d1-to-airtable — Seçili değişiklikleri uygula
app.post('/api/admin/sync/d1-to-airtable', async (c) => {
    const auth = await requireAuth(c);
    if (auth.response) return auth.response;
    if (auth.user.role !== 'super_admin') return c.json({ error: 'Sadece Super Admin' }, 403);
    if (!c.env.AIRTABLE_BASE_ID || !c.env.AIRTABLE_PAT) return c.json({ error: 'Airtable ayarları eksik' }, 500);

    try {
        const db = c.env.DB;
        await ensureInstitutionMetadataColumns(db);
        const { changes } = await c.req.json();
        if (!Array.isArray(changes) || changes.length === 0) return c.json({ error: 'Uygulanacak değişiklik yok' }, 400);

        let created = 0;
        let updated = 0;
        let linked = 0;

        for (const ch of changes) {
            const institutionId = Number(ch.institution_id || 0);
            if (!institutionId || !ch.name) continue;

            const payload = {
                name: ch.name || '',
                domain: ch.domain || '',
                website_url: ch.website_url || '',
                city: ch.city || '',
                category: ch.category || '',
                status: ch.status || '',
            };

            if (ch.action === 'create') {
                const createdRecord = await createAirtableAccount(c.env, payload);
                await db.prepare(`UPDATE institutions SET airtable_id = ? WHERE id = ?`)
                    .bind(createdRecord.id, institutionId)
                    .run();
                created++;
                continue;
            }

            if (!ch.airtable_id) continue;

            await updateAirtableAccount(c.env, ch.airtable_id, payload);

            if (ch.action === 'link') {
                await db.prepare(`UPDATE institutions SET airtable_id = ? WHERE id = ?`)
                    .bind(ch.airtable_id, institutionId)
                    .run();
                linked++;
            } else {
                updated++;
            }
        }

        return c.json({ success: true, created, updated, linked });
    } catch (err) {
        console.error('D1 to Airtable sync apply error:', err);
        return c.json({ error: err.message }, 500);
    }
});

// GET /api/admin/sync/airtable-contacts-to-users — Dry-run, önizleme
app.get('/api/admin/sync/airtable-contacts-to-users', async (c) => {
    const auth = await requireAuth(c);
    if (auth.response) return auth.response;
    if (auth.user.role !== 'admin' && auth.user.role !== 'super_admin') return c.json({ error: 'Yetkisiz' }, 403);
    if (!c.env.AIRTABLE_BASE_ID || !c.env.AIRTABLE_PAT) return c.json({ error: 'Airtable ayarları eksik' }, 500);

    try {
        const result = await buildAirtableUserSyncChanges(c);
        return c.json({ success: true, total: result.total, changes: result.changes });
    } catch (err) {
        console.error('User sync preview error:', err);
        return c.json({ error: err.message }, 500);
    }
});

// POST /api/admin/sync/airtable-contacts-to-users — Seçili değişiklikleri uygula
app.post('/api/admin/sync/airtable-contacts-to-users', async (c) => {
    const auth = await requireAuth(c);
    if (auth.response) return auth.response;
    if (auth.user.role !== 'admin' && auth.user.role !== 'super_admin') return c.json({ error: 'Yetkisiz' }, 403);
    if (!c.env.AIRTABLE_BASE_ID || !c.env.AIRTABLE_PAT) return c.json({ error: 'Airtable ayarları eksik' }, 500);

    try {
        const db = c.env.DB;
      
        const { changes } = await c.req.json();
        if (!Array.isArray(changes) || changes.length === 0) return c.json({ error: 'Uygulanacak değişiklik yok' }, 400);

        let created = 0;
        let updated = 0;

        for (const rawChange of changes) {
            const normalizedEmail = String(rawChange.email || '').trim().toLowerCase();
            if (!normalizedEmail) continue;

            const profileFields = normalizeUserProfileFields(rawChange);
            const finalInstitutionId = rawChange.institution_id ? parseInt(rawChange.institution_id) : null;
            const finalInstitution = rawChange.institution || null;
            const existing = await db.prepare(`SELECT id FROM users WHERE LOWER(email) = LOWER(?)`).bind(normalizedEmail).first();

            if (rawChange.action === 'update' || existing) {
                await db.prepare(`
                  UPDATE users
                  SET full_name = ?, first_name = ?, last_name = ?, title = ?, institution = ?, institution_id = ?
                  WHERE LOWER(email) = LOWER(?)
                `).bind(
                  profileFields.full_name,
                  profileFields.first_name,
                  profileFields.last_name,
                  profileFields.title,
                  finalInstitution,
                  finalInstitutionId,
                  normalizedEmail
                ).run();
                updated++;
            } else if (rawChange.action === 'create') {
                const password_hash = await hashPassword(randomPassword());
                await db.prepare(`
                  INSERT INTO users (email, password_hash, full_name, first_name, last_name, title, institution, institution_id, role)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'user')
                `).bind(
                  normalizedEmail,
                  password_hash,
                  profileFields.full_name,
                  profileFields.first_name,
                  profileFields.last_name,
                  profileFields.title,
                  finalInstitution,
                  finalInstitutionId
                ).run();
                created++;
            }
        }

        return c.json({ success: true, created, updated });
    } catch (err) {
        console.error('User sync apply error:', err);
        return c.json({ error: err.message }, 500);
    }
});

// PUT /api/admin/airtable/accounts/:id
app.put('/api/admin/airtable/accounts/:id', async (c) => {
    return c.json({ error: 'Tek yönlü sync aktif. Airtable kayıtları proje içinden güncellenmez.' }, 410);
});

// ─── Remote Access (RA) route registration ─────────────────────────────────
// POST /api/ra/issue-token
registerRaIssueToken(app);
// GET/PUT /api/ra/admin/institution-egress/:id ; POST .../test
registerRaAdminTunnel(app);


// ====================== PAGE VIEWS ROUTES ======================

function normalizeViewSlug(raw) {
  const slug = String(raw || '').trim().toLowerCase();
  if (!/^[a-z0-9-_]{1,120}$/.test(slug)) return null;
  return slug;
}

app.get('/api/views-ping', (c) => {
  return c.json({ ok: true, marker: 'views-ping-v1' });
});

// POST - Birden fazla slug için görüntülenme sayılarını toplu al
app.post('/api/views/batch', async (c) => {
  try {
    const body = await c.req.json().catch(() => null);

    if (!body || !Array.isArray(body.slugs)) {
      return c.json({ error: 'slugs dizisi zorunludur' }, 400);
    }

    const normalizedSlugs = body.slugs
      .map(normalizeViewSlug)
      .filter(Boolean)
      .slice(0, 200);

    if (!normalizedSlugs.length) {
      return c.json({ views: {} });
    }

    const uniqueSlugs = [...new Set(normalizedSlugs)];
    const placeholders = uniqueSlugs.map(() => '?').join(', ');

    const result = await c.env.DB.prepare(`
      SELECT page_slug, view_count
      FROM page_views
      WHERE page_slug IN (${placeholders})
    `).bind(...uniqueSlugs).all();

    const viewsMap = {};
    for (const slug of uniqueSlugs) {
      viewsMap[slug] = 0;
    }

    for (const row of (result.results || [])) {
      viewsMap[row.page_slug] = Number(row.view_count || 0);
    }

    return c.json({ views: viewsMap });
  } catch (err) {
    console.error('POST /api/views/batch error:', err);
    return c.json({ error: 'Toplu görüntülenme sayıları alınamadı' }, 500);
  }
});

app.get('/api/views/:slug', async (c) => {
  try {
    const slug = normalizeViewSlug(c.req.param('slug'));
    if (!slug) {
      return c.json({ error: 'Geçersiz slug' }, 400);
    }

    const row = await c.env.DB.prepare(
      'SELECT view_count FROM page_views WHERE page_slug = ?'
    ).bind(slug).first();

    return c.json({
      slug,
      views: Number(row?.view_count || 0)
    });
  } catch (err) {
    console.error('GET /api/views/:slug error:', err);
    return c.json({ error: 'Görüntülenme sayısı alınamadı' }, 500);
  }
});

app.post('/api/views/:slug', async (c) => {
  try {
    const slug = normalizeViewSlug(c.req.param('slug'));
    if (!slug) {
      return c.json({ error: 'Geçersiz slug' }, 400);
    }

    await c.env.DB.prepare(`
      INSERT INTO page_views (page_slug, view_count, created_at, updated_at)
      VALUES (?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(page_slug) DO UPDATE SET
        view_count = view_count + 1,
        updated_at = CURRENT_TIMESTAMP
    `).bind(slug).run();

    const row = await c.env.DB.prepare(
      'SELECT view_count FROM page_views WHERE page_slug = ?'
    ).bind(slug).first();

    return c.json({
      slug,
      views: Number(row?.view_count || 0)
    });
  } catch (err) {
    console.error('POST /api/views/:slug error:', err);
    return c.json({ error: 'Görüntülenme sayısı artırılamadı' }, 500);
  }
});

app.onError((err, c) => {
  console.error(`[onError] ${c.req.method} ${c.req.url}`, err);
  return c.json({ error: 'Sunucu hatası', code: 500 }, 500);
});

app.notFound((c) => c.json({ error: 'Endpoint bulunamadı', code: 404 }, 404));

export default app;
