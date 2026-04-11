console.log("HONO VERSION LOADED");

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { setCookie } from 'hono/cookie';

const app = new Hono();

// ====================== CONFIGURATION ======================
// Ortak sabitler ve uygulama yapılandırmaları
const ALLOWED_ORIGINS = [
  'https://libedge.com',
  'https://www.libedge.com',
  'https://libedge-website.pages.dev',
  'https://staging.libedge-website.pages.dev',
];

// 1. CORS Middleware (En üstte, her şeyden önce)
app.use('*', cors({
  origin: (origin) => {
    // Gelen origin izin verilenler listesinde varsa onu kullan, yoksa staging'i kullan
    if (!origin) return "https://staging.libedge-website.pages.dev";
    return ALLOWED_ORIGINS.includes(origin) ? origin : "https://staging.libedge-website.pages.dev";
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Set-Cookie', 'Content-Length'],  // ← Set-Cookie expose et!
  maxAge: 86400,
}));

// ====================== TOKEN HELPERS ======================

function b64urlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

async function signToken(payload, secret) {
  const header  = b64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body    = b64urlEncode(unescape(encodeURIComponent(JSON.stringify(payload))));
  const data    = `${header}.${body}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const sig = b64urlEncode(String.fromCharCode(...new Uint8Array(sigBuffer)));

  return `${data}.${sig}`;
}

async function verifyToken(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;
    const data   = `${header}.${payload}`;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBytes = Uint8Array.from(b64urlDecode(signature), c => c.charCodeAt(0));
    const valid    = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data));
    if (!valid) return null;

    const decoded = JSON.parse(decodeURIComponent(escape(b64urlDecode(payload))));
    if (decoded.exp * 1000 < Date.now()) return null;

    return decoded;
  } catch (e) {
    console.error('verifyToken error:', e);
    return null;
  }
}

// ====================== 🆕 AUTH MIDDLEWARE (Cookie tabanlı) ======================

async function requireAuth(c) {
  // ✅ YENİ: Proxy'den gelen Authorization header'ı da kabul et
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const secret = c.env.JWT_SECRET;
    const payload = await verifyToken(token, secret);
    if (!payload) {
      return { response: c.json({ error: 'Geçersiz token' }, 401) };
    }
    return { user: payload, token };
  }

  // Mevcut cookie kontrolü (main branch için - dokunma)
  const cookieHeader = c.req.header('Cookie');
  if (!cookieHeader) {
    return { response: c.json({ error: 'Oturum bulunamadı' }, 401) };
  }
  const tokenMatch = cookieHeader.match(/authToken=([^;]+)/);
  if (!tokenMatch) {
    return { response: c.json({ error: 'Oturum bulunamadı' }, 401) };
  }
  const token = tokenMatch[1];
  const secret = c.env.JWT_SECRET;
  const payload = await verifyToken(token, secret);
  if (!payload) {
    return { response: c.json({ error: 'Geçersiz veya süresi dolmuş oturum' }, 401) };
  }
  return { user: payload, token };
}
// 🆕 Yardımcı: Mevcut kullanıcıyı al (middleware sonrası kullanılır)
async function getCurrentUser(c) {
  const auth = await requireAuth(c);
  if (auth.response) return null;
  return auth.user;
}

async function getOptionalAuth(c) {
  const authHeader = c.req.header('Authorization');
  const cookieHeader = c.req.header('Cookie');
  const secret = c.env.JWT_SECRET;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = await verifyToken(token, secret);
    return payload ? { user: payload, token } : null;
  }

  if (!cookieHeader) return null;
  const tokenMatch = cookieHeader.match(/authToken=([^;]+)/);
  if (!tokenMatch) return null;

  const token = tokenMatch[1];
  const payload = await verifyToken(token, secret);
  return payload ? { user: payload, token } : null;
}

async function ensureNewsletterTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER UNIQUE,
      email           TEXT NOT NULL UNIQUE,
      status          TEXT NOT NULL DEFAULT 'active',
      source          TEXT NOT NULL DEFAULT 'guest',
      subscribed_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
      unsubscribed_at DATETIME,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `).run();

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_newsletter_status
    ON newsletter_subscriptions(status)
  `).run();

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_newsletter_user_status
    ON newsletter_subscriptions(user_id, status)
  `).run();
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

async function ensureUserContactColumns(db) {
  const columns = await db.prepare(`PRAGMA table_info(users)`).all();
  const existing = new Set((columns.results || []).map(column => column.name));

  if (!existing.has('first_name')) {
    await db.prepare(`ALTER TABLE users ADD COLUMN first_name TEXT`).run();
  }
  if (!existing.has('last_name')) {
    await db.prepare(`ALTER TABLE users ADD COLUMN last_name TEXT`).run();
  }
  if (!existing.has('title')) {
    await db.prepare(`ALTER TABLE users ADD COLUMN title TEXT`).run();
  }
}

async function ensureAnnouncementColumns(db) {
  const columns = await db.prepare(`PRAGMA table_info(announcements)`).all();
  const existing = new Set((columns.results || []).map(column => column.name));

  if (!existing.has('cover_image_url')) {
    await db.prepare(`ALTER TABLE announcements ADD COLUMN cover_image_url TEXT`).run();
  }
  if (!existing.has('title_en')) {
    await db.prepare(`ALTER TABLE announcements ADD COLUMN title_en TEXT`).run();
  }
  if (!existing.has('summary_en')) {
    await db.prepare(`ALTER TABLE announcements ADD COLUMN summary_en TEXT`).run();
  }
  if (!existing.has('full_content_en')) {
    await db.prepare(`ALTER TABLE announcements ADD COLUMN full_content_en TEXT`).run();
  }
  if (!existing.has('ai_image_prompt')) {
    await db.prepare(`ALTER TABLE announcements ADD COLUMN ai_image_prompt TEXT`).run();
  }
}

function cleanAnnouncementText(value) {
  return String(value || '').trim();
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
  const key = getPollinationsKey(env);
  if (key) {
    url.searchParams.set('key', key);
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
  const key = getPollinationsKey(env);
  const body = {
    model: 'openai',
    messages: [{ role: 'user', content: prompt }],
    jsonMode: true,
    seed: Math.floor(Math.random() * 1e9)
  };
  if (key) body.key = key;

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

// ====================== RATE LIMITING ======================
const rateLimitStore = new Map();

function getRateLimitKey(endpoint, identifier) {
  return `${endpoint}:${identifier}`;
}

function checkRateLimit(endpoint, identifier, maxRequests = 10, windowSeconds = 300) {
  const key = getRateLimitKey(endpoint, identifier);
  const now = Date.now();
  const record = rateLimitStore.get(key) || { count: 0, resetTime: now + windowSeconds * 1000 };
  
  if (now > record.resetTime) {
    // Window expired, reset
    record.count = 1;
    record.resetTime = now + windowSeconds * 1000;
  } else {
    record.count++;
  }
  
  rateLimitStore.set(key, record);
  
  const remaining = Math.max(0, maxRequests - record.count);
  const isLimited = record.count > maxRequests;
  
  return { isLimited, remaining, resetTime: record.resetTime };
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
    const { email, password } = await c.req.json();
    const db = c.env.DB;

    const user = await db.prepare(`
      SELECT id, email, full_name, institution, institution_id, password_hash, role
      FROM users WHERE email = ?
    `).bind(email.toLowerCase().trim()).first();

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
    const accessToken = await signToken(accessTokenPayload, secret);
    const refreshToken = await signToken(refreshTokenPayload, secret);

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
  const rateLimitCheck = checkRateLimit('refresh', identifier, 10, 300);
  
  if (rateLimitCheck.isLimited) {
    c.header('Retry-After', Math.ceil((rateLimitCheck.resetTime - Date.now()) / 1000).toString());
    return c.json({ 
      error: 'Çok fazla refresh isteği. Lütfen bir süre sonra tekrar deneyin.',
      retryAfter: rateLimitCheck.resetTime
    }, 429);
  }
  
  // Refresh Token'ı cookie'den al
  const cookieHeader = c.req.header('Cookie');
  if (!cookieHeader) {
    return c.json({ error: 'Refresh token bulunamadı' }, 401);
  }
  const refreshTokenMatch = cookieHeader.match(/refreshToken=([^;]+)/);
  if (!refreshTokenMatch) {
    return c.json({ error: 'Refresh token bulunamadı' }, 401);
  }
  
  const refreshToken = refreshTokenMatch[1];
  const secret = c.env.JWT_SECRET;
  const refreshPayload = await verifyToken(refreshToken, secret);
  
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
  
  const newAccessToken = await signToken(newAccessPayload, secret);
  const newRefreshToken = await signToken(newRefreshPayload, secret);
  
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
           i.name as institution_name
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
      httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000' }
    });

    // Cache busting için timestamp ekle
    const avatarUrl = `${r2PublicUrl}/${key}?t=${Date.now()}`;

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
  await ensureUserContactColumns(db);
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
  
  await ensureNewsletterTable(db);
  await db.prepare(`DELETE FROM newsletter_subscriptions WHERE user_id = ?`).bind(userId).run();
  await db.prepare(`DELETE FROM subscriptions WHERE user_id = ?`).bind(userId).run();
  await db.prepare(`DELETE FROM users WHERE id = ?`).bind(userId).run();
  
  // Cookie'yi de sil
  c.header('Set-Cookie', 'authToken=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict');
  
  return c.json({ success: true });
});

// ====================== SUBSCRIPTION ROUTES ======================
app.get('/api/subscription/check', async (c) => {
  const product = c.req.query('product');
  if (!product) return c.json({ hasAccess: false, error: 'Product belirtilmedi.' }, 400);
  
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  
  const userId = auth.user.user_id;
  const db = c.env.DB;
  
  const sub = await db.prepare(`
    SELECT * FROM subscriptions 
    WHERE user_id = ? AND product_slug = ? 
      AND status IN ('trial', 'active')
      AND (end_date IS NULL OR end_date > CURRENT_TIMESTAMP)
  `).bind(userId, product).first();

  return c.json({ hasAccess: !!sub, status: sub ? sub.status : null });
});

app.get('/api/subscription/list', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;

  const userId = auth.user.user_id;
  const institutionId = auth.user.institution_id;
  const db = c.env.DB;

  const individual = await db.prepare(`
    SELECT id, product_slug, status, start_date, end_date, created_at, 'individual' as source
    FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC
  `).bind(userId).all();

  let instSubs = [];
  if (institutionId) {
    const instRes = await db.prepare(`
      SELECT id, product_slug, status, start_date, end_date, created_at, 'institution' as source
      FROM institution_subscriptions
      WHERE institution_id = ? AND status IN ('active','trial')
        AND (end_date IS NULL OR end_date > CURRENT_TIMESTAMP)
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

  const individual = await db.prepare(`
    SELECT id, product_slug, status, start_date, end_date, 'individual' as source
    FROM subscriptions
    WHERE user_id = ? AND status IN ('active','trial')
      AND (end_date IS NULL OR end_date > CURRENT_TIMESTAMP)
  `).bind(userId).all();

  let instSubs = [];
  if (institutionId) {
    const instRes = await db.prepare(`
      SELECT id, product_slug, status, start_date, end_date, 'institution' as source
      FROM institution_subscriptions
      WHERE institution_id = ? AND status IN ('active','trial')
        AND (end_date IS NULL OR end_date > CURRENT_TIMESTAMP)
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
  await ensureNewsletterTable(db);
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
    await ensureNewsletterTable(db);
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
  await ensureNewsletterTable(db);
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
    const { email, password, full_name, institution } = await c.req.json();
    const db = c.env.DB;
    await ensureUserContactColumns(db);

    if (!email || !password) {
      return c.json({ success: false, error: 'E-posta ve şifre zorunludur.' }, 400);
    }

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
              <h3>${subject}</h3>
              <p><b>Ad:</b> ${name}</p>
              <p><b>Email:</b> ${email}</p>
              ${formType === "contact" ? `<p><b>Telefon:</b> ${data.phone || "-"}</p>` : ""}
              ${formType === "contact" ? `<p><b>Konu:</b> ${data.subject || "-"}</p>` : ""}
              <p><b>Mesaj:</b> ${message || (formType === "newsletter" ? "Newsletter subscription request" : "-")}</p>
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
  await ensureUserContactColumns(db);

  let users;
  if (role === 'super_admin') {
    users = await db.prepare(`
      SELECT u.id, u.email, u.full_name, u.first_name, u.last_name, u.title,
             u.institution, u.institution_id, u.role, u.created_at, u.last_login,
             COALESCE(i.name, u.institution) as institution_name
      FROM users u
      LEFT JOIN institutions i ON u.institution_id = i.id
      ORDER BY u.id DESC
    `).all();
  } else {
    const adminInstitutionId = await getUserInstitutionId(c);
    const adminInstitution = await getUserInstitution(c);
    if (adminInstitutionId) {
      users = await db.prepare(`
        SELECT u.id, u.email, u.full_name, u.first_name, u.last_name, u.title,
               u.institution, u.institution_id, u.role, u.created_at, u.last_login,
               COALESCE(i.name, u.institution) as institution_name
        FROM users u
        LEFT JOIN institutions i ON u.institution_id = i.id
        WHERE u.institution_id = ?
        ORDER BY u.id DESC
      `).bind(adminInstitutionId).all();
    } else {
      users = await db.prepare(`
        SELECT u.id, u.email, u.full_name, u.first_name, u.last_name, u.title,
               u.institution, u.institution_id, u.role, u.created_at, u.last_login,
               COALESCE(i.name, u.institution) as institution_name
        FROM users u
        LEFT JOIN institutions i ON u.institution_id = i.id
        WHERE u.institution = ?
        ORDER BY u.id DESC
      `).bind(adminInstitution).all();
    }
  }
  return c.json(users.results);
});

app.get('/api/admin/dashboard', async (c) => {
  if (!await isAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);

  const db = c.env.DB;
  await ensureUserContactColumns(db);

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
      ? { clause: 'WHERE u.institution_id = ?', bindings: [adminInstitutionId] }
      : { clause: 'WHERE u.institution = ?', bindings: [adminInstitution] };

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

  const stats = {
    users: userCountRow?.count || 0,
    active_subscriptions: (activeIndividualRow?.count || 0) + (activeInstitutionRow?.count || 0),
    trial_requests: trialRequestsRow?.count || 0,
    institutions: institutionsCountRow?.count || 0,
    pending_requests: pendingRequestsRow?.count || 0,
    today_registrations: todayRegistrationsRow?.count || 0,
    active_institution_subscriptions: activeInstitutionRow?.count || 0
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
  await ensureUserContactColumns(db);
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
  await ensureUserContactColumns(db);
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
  
  if (currentUserId == id && adminRole === 'super_admin') {
    return c.json({ error: 'Super admin kendini silemez' }, 400);
  }
  
  const db = c.env.DB;
  
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

app.get('/api/admin/subscriptions', async (c) => {
  if (!await isAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);
  const db = c.env.DB;
  const role = await getUserRole(c);
  const adminInstitutionId = await getUserInstitutionId(c);
  const adminInstitution = await getUserInstitution(c);

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
               i.name as subject_name, i.name as institution_name, NULL as user_id
        FROM institution_subscriptions is2 LEFT JOIN institutions i ON is2.institution_id = i.id ORDER BY is2.id DESC
      `).all();
      institutionalResults = institutional.results || [];
    } else if (adminInstitutionId) {
      const institutional = await db.prepare(`
        SELECT is2.id, 'institution' as type, is2.product_slug, is2.status, is2.start_date, is2.end_date,
               i.name as subject_name, i.name as institution_name, NULL as user_id
        FROM institution_subscriptions is2 LEFT JOIN institutions i ON is2.institution_id = i.id
        WHERE is2.institution_id = ? ORDER BY is2.id DESC
      `).bind(adminInstitutionId).all();
      institutionalResults = institutional.results || [];
    }
  } catch (e) {
    // Tablo henüz oluşturulmamış olabilir (migration bekliyor)
    console.error('institution_subscriptions query error:', e.message);
  }

  return c.json([...institutionalResults, ...individualResults]);
});

app.post('/api/admin/subscription', async (c) => {
  if (!await isAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);
  const { user_id, product_slug, status, end_date } = await c.req.json();
  const db = c.env.DB;
  const role = await getUserRole(c);
  const adminInstitution = await getUserInstitution(c);
  
  if (role === 'admin') {
    const targetUser = await db.prepare(`SELECT institution FROM users WHERE id = ?`).bind(user_id).first();
    if (!targetUser || targetUser.institution !== adminInstitution) {
      return c.json({ error: 'Sadece kendi kurumunuzdaki kullanıcılara abonelik ekleyebilirsiniz' }, 403);
    }
  }
  
  await db.prepare(`INSERT INTO subscriptions (user_id, product_slug, status, end_date) VALUES (?, ?, ?, ?)`).bind(user_id, product_slug, status, end_date || null).run();
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
  const { institution_id, product_slug, status, end_date } = await c.req.json();
  if (!institution_id || !product_slug) return c.json({ error: 'institution_id ve product_slug zorunlu' }, 400);
  const db = c.env.DB;
  await db.prepare(`
    INSERT INTO institution_subscriptions (institution_id, product_slug, status, end_date, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).bind(parseInt(institution_id), product_slug, status || 'active', end_date || null, auth.user.user_id).run();
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
  const subs = await db.prepare(`
    SELECT is2.*, i.name as institution_name
    FROM institution_subscriptions is2
    LEFT JOIN institutions i ON is2.institution_id = i.id
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
  // JWT payload'undan doğrudan al
  if (!payload.institution) return c.json({ error: 'Kullanıcıya atanmış kurum yok' }, 404);
  const inst = await db.prepare(`
    SELECT id, name, domain, category,
      (SELECT COUNT(*) FROM users WHERE institution = name) as user_count
    FROM institutions WHERE name = ?
  `).bind(payload.institution).first();
  if (!inst) return c.json({ error: 'Kurum bulunamadı' }, 404);

  const fileRow = await db.prepare(`
    SELECT COUNT(*) as cnt FROM institution_files
    WHERE institution_id = ? AND is_active = 1
  `).bind(inst.id).first();

  return c.json({ ...inst, file_count: fileRow?.cnt ?? 0 });
});

app.get('/api/admin/institutions', async (c) => {
  if (!await isAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);
  const db = c.env.DB;
  const role = await getUserRole(c);

  if (role === 'super_admin') {
    const institutions = await db.prepare(`
      SELECT inst.id, inst.name, inst.domain, inst.category, inst.status, inst.created_at,
        (SELECT COUNT(*) FROM users WHERE institution = inst.name) as user_count,
        (SELECT COUNT(*) FROM institution_files WHERE institution_id = inst.id AND is_active = 1) as file_count
      FROM institutions inst ORDER BY inst.name
    `).all();
    return c.json(institutions.results);
  } else {
    const adminInstitutionId = await getUserInstitutionId(c);
    const adminInstitution = await getUserInstitution(c);
    let inst;
    if (adminInstitutionId) {
      inst = await db.prepare(`
        SELECT inst.id, inst.name, inst.domain, inst.category, inst.status, inst.created_at,
          (SELECT COUNT(*) FROM users WHERE institution = inst.name) as user_count,
          (SELECT COUNT(*) FROM institution_files WHERE institution_id = inst.id AND is_active = 1) as file_count
        FROM institutions inst WHERE inst.id = ?
      `).bind(adminInstitutionId).first();
    } else if (adminInstitution) {
      inst = await db.prepare(`
        SELECT inst.id, inst.name, inst.domain, inst.category, inst.status, inst.created_at,
          (SELECT COUNT(*) FROM users WHERE institution = inst.name) as user_count,
          (SELECT COUNT(*) FROM institution_files WHERE institution_id = inst.id AND is_active = 1) as file_count
        FROM institutions inst WHERE inst.name = ?
      `).bind(adminInstitution).first();
    }
    return c.json(inst ? [inst] : []);
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
      SELECT f.*, u.full_name as uploaded_by_name, i.name as institution_name
      FROM institution_files f
      LEFT JOIN users u ON f.uploaded_by = u.id
      LEFT JOIN institutions i ON f.institution_id = i.id
      WHERE f.is_active = 1
      ORDER BY f.id DESC
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
      SELECT f.*, u.full_name as uploaded_by_name, i.name as institution_name
      FROM institution_files f
      LEFT JOIN users u ON f.uploaded_by = u.id
      LEFT JOIN institutions i ON f.institution_id = i.id
      WHERE f.is_active = 1 AND f.institution_id = ?
      ORDER BY f.id DESC
    `).bind(instId).all();
  }
  return c.json(files.results);
});

// ====================== KURUM ROOT DOSYALARINI GETİR ======================
app.get('/api/institution/:id/files', async (c) => {
    const identifier = c.req.param('id');
    const db = c.env.DB;

    // Kurum ID'sini bul
    let institutionId = null;
    if (/^\d+$/.test(identifier)) {
        institutionId = parseInt(identifier);
    } else {
        const inst = await db.prepare(`SELECT id FROM institutions WHERE name = ?`).bind(identifier).first();
        if (inst) institutionId = inst.id;
    }
    if (!institutionId) return c.json([]);

    // Rol ve kurum kontrolü
    const role = await getUserRole(c);
    const isAdmin = role === 'super_admin' || role === 'admin';
    const publicOnly = isAdmin ? '' : 'AND f.is_public = 1';

    try {
        const result = await db.prepare(`
            SELECT f.*, u.full_name as uploaded_by_name, COALESCE(i.name, '') as institution_name
            FROM institution_files f
            LEFT JOIN users u ON f.uploaded_by = u.id
            LEFT JOIN institutions i ON f.institution_id = i.id
            WHERE CAST(f.institution_id AS INTEGER) = ?
              AND f.is_active = 1
              AND (f.folder_id IS NULL OR f.folder_id = 0)
              ${publicOnly}
            ORDER BY f.id DESC
        `).bind(institutionId).all();
        return c.json(result.results || []);
    } catch (err) {
        console.error('Root dosyaları sorgu hatası:', err);
        return c.json({ error: 'Dosyalar alınamadı' }, 500);
    }
});

// ====================== KURUM KLASÖRLERİNİ GETİR (DÜZELTİLMİŞ) ======================
app.get('/api/institution/:id/folders', async (c) => {
    const identifier = c.req.param('id');
    const parentId = c.req.query('parent') || null;
    const db = c.env.DB;
    
    console.log('🔍 [FOLDERS] Request for:', identifier, 'parent:', parentId);
    
    try {
        // 1. Kurum ID'sini bul
        let institutionId = null;
        
        // Önce institutions tablosunda ara (hem ID hem isim olabilir)
        if (!isNaN(parseInt(identifier))) {
            const inst = await db.prepare(`SELECT id FROM institutions WHERE id = ?`).bind(parseInt(identifier)).first();
            if (inst) institutionId = inst.id;
        } else {
            const inst = await db.prepare(`SELECT id FROM institutions WHERE name = ?`).bind(identifier).first();
            if (inst) institutionId = inst.id;
        }
        
        if (!institutionId) {
            console.log('❌ Kurum bulunamadı:', identifier);
            return c.json([]);
        }
        
        console.log('🏢 Kurum ID:', institutionId);
        
        // Rol kontrolü — admin değilse sadece public klasörler
        const role = await getUserRole(c);
        const isAdmin = role === 'super_admin' || role === 'admin';
        const folderFilter  = isAdmin ? '' : 'AND f.is_public = 1';
        const fileCountCond = isAdmin ? 'AND is_active = 1' : 'AND is_active = 1 AND is_public = 1';

        // 2. Klasörleri getir
        let query, params;
        if (parentId && parentId !== 'null') {
            query = `
                SELECT f.*,
                    (SELECT COUNT(*) FROM institution_folders WHERE parent_folder_id = f.id) as subfolder_count,
                    (SELECT COUNT(*) FROM institution_files WHERE folder_id = f.id ${fileCountCond}) as file_count
                FROM institution_folders f
                WHERE CAST(f.institution_id AS INTEGER) = ? AND f.parent_folder_id = ?
                  ${folderFilter}
                ORDER BY f.folder_name`;
            params = [institutionId, parseInt(parentId)];
        } else {
            query = `
                SELECT f.*,
                    (SELECT COUNT(*) FROM institution_folders WHERE parent_folder_id = f.id) as subfolder_count,
                    (SELECT COUNT(*) FROM institution_files WHERE folder_id = f.id ${fileCountCond}) as file_count
                FROM institution_folders f
                WHERE CAST(f.institution_id AS INTEGER) = ? AND (f.parent_folder_id IS NULL OR f.parent_folder_id = 0)
                  ${folderFilter}
                ORDER BY f.folder_name`;
            params = [institutionId];
        }
        
        const result = await db.prepare(query).bind(...params).all();
        const folders = result.results || [];
        
        console.log(`✅ ${folders.length} klasör bulundu`);
        if (folders.length > 0) {
            folders.forEach(f => console.log(`   📁 ${f.folder_name} (ID: ${f.id})`));
        }
        
        return c.json(folders);
        
    } catch (err) {
        console.error('❌ Klasör sorgu hatası:', err);
        return c.json({ error: err.message }, 500);
    }
});

app.get('/api/institution/folder/:id/files', async (c) => {
  try {
    const folderId = c.req.param('id');
    const role = await getUserRole(c);
    const db = c.env.DB;
    
    const folder = await db.prepare(`
      SELECT f.*, i.name as institution_name 
      FROM institution_folders f 
      LEFT JOIN institutions i ON f.institution_id = i.id
      WHERE f.id = ?
    `).bind(folderId).first();
    
    if (!folder) {
      return c.json({ error: 'Klasör bulunamadı' }, 404);
    }
    
    const userInstitutionId = await getUserInstitutionId(c);

    let files;
    if (role === 'super_admin' || (role === 'admin' && String(userInstitutionId) === String(folder.institution_id))) {
      files = await db.prepare(`
        SELECT f.*, u.full_name as uploaded_by_name 
        FROM institution_files f 
        LEFT JOIN users u ON f.uploaded_by = u.id
        WHERE f.folder_id = ? AND f.is_active = 1 
        ORDER BY f.id DESC
      `).bind(folderId).all();
    } else {
      files = await db.prepare(`
        SELECT f.*, u.full_name as uploaded_by_name 
        FROM institution_files f 
        LEFT JOIN users u ON f.uploaded_by = u.id
        WHERE f.folder_id = ? AND f.is_active = 1 AND f.is_public = 1
        ORDER BY f.id DESC
      `).bind(folderId).all();
    }
    
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
    const folderId = c.req.param('id');
    const role = await getUserRole(c);
    const db = c.env.DB;
    
    const folder = await db.prepare(`
      SELECT f.id, f.folder_name, f.parent_folder_id, f.institution_id, f.is_public,
        i.name as institution_name
      FROM institution_folders f 
      LEFT JOIN institutions i ON f.institution_id = i.id
      WHERE f.id = ?
    `).bind(folderId).first();
    
    if (!folder) {
      return c.json({ error: 'Klasör bulunamadı' }, 404);
    }
    
    const userInstitution = await getUserInstitutionId(c);
    
    if (role !== 'super_admin' && role !== 'admin' && role !== 'user') {
      return c.json({ error: 'Yetkisiz' }, 403);
    }
    
    if (role !== 'super_admin' && role !== 'admin' && folder.is_public !== 1) {
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

// ====================== DOSYA UPLOAD (R2) ======================

app.post('/api/upload', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  if (auth.user.role !== 'super_admin' && auth.user.role !== 'admin') {
    return c.json({ error: 'Yetkisiz' }, 403);
  }
  const bucket = c.env.FILES_BUCKET;
  if (!bucket) return c.json({ error: 'R2 bucket bağlı değil' }, 500);
  const formData = await c.req.formData();
  const file = formData.get('file');
  if (!file || typeof file === 'string') return c.json({ error: 'Dosya bulunamadı' }, 400);
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const key = `uploads/${auth.user.user_id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip'];
  if (!allowed.includes(ext)) return c.json({ error: 'Desteklenmeyen dosya türü' }, 400);

  const buf = await file.arrayBuffer();
  await bucket.put(key, buf, {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
  });
  const r2PublicUrl = c.env.R2_PUBLIC_URL;
  const publicUrl = r2PublicUrl ? `${r2PublicUrl}/${key}` : `/api/files/${key}`;
  return c.json({ success: true, url: publicUrl, key, name: file.name, type: ext, size: file.size });
});

// ====================== KURUM KLASÖR CRUD ======================

app.post('/api/institution/:id/folder', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  const role = auth.user.role;
  if (role !== 'super_admin' && role !== 'admin') return c.json({ error: 'Yetkisiz' }, 403);
  const institutionId = c.req.param('id');
  const db = c.env.DB;
  const institution = await db.prepare(`SELECT id, name FROM institutions WHERE name = ? OR id = ?`).bind(institutionId, institutionId).first();
  if (!institution) return c.json({ error: 'Kurum bulunamadı' }, 404);
  if (role === 'admin' && auth.user.institution !== institution.name) return c.json({ error: 'Sadece kendi kurumunuza klasör ekleyebilirsiniz' }, 403);
  const { folder_name, parent_folder_id, is_public } = await c.req.json();
  if (!folder_name?.trim()) return c.json({ error: 'Klasör adı boş olamaz' }, 400);
  const result = await db.prepare(`INSERT INTO institution_folders (institution_id, folder_name, parent_folder_id, is_public) VALUES (?, ?, ?, ?)`)
    .bind(institution.id, folder_name.trim(), parent_folder_id || null, is_public ? 1 : 0).run();
  return c.json({ success: true, id: result.meta?.last_row_id });
});

app.delete('/api/institution/folder/:id', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  const role = auth.user.role;
  if (role !== 'super_admin' && role !== 'admin') return c.json({ error: 'Yetkisiz' }, 403);
  const folderId = c.req.param('id');
  const db = c.env.DB;
  const folder = await db.prepare(`SELECT f.*, i.name as institution_name FROM institution_folders f LEFT JOIN institutions i ON f.institution_id = i.id WHERE f.id = ?`).bind(folderId).first();
  if (!folder) return c.json({ error: 'Klasör bulunamadı' }, 404);
  if (role === 'admin' && auth.user.institution !== folder.institution_name) return c.json({ error: 'Yetkisiz' }, 403);
  await db.prepare(`UPDATE institution_files SET is_active = 0 WHERE folder_id = ?`).bind(folderId).run();
  await db.prepare(`DELETE FROM institution_folders WHERE id = ? OR parent_folder_id = ?`).bind(folderId, folderId).run();
  return c.json({ success: true });
});

app.put('/api/institution/folder/:id', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  const role = auth.user.role;
  if (role !== 'super_admin' && role !== 'admin') return c.json({ error: 'Yetkisiz' }, 403);
  const folderId = c.req.param('id');
  const db = c.env.DB;
  const { folder_name } = await c.req.json();
  if (!folder_name?.trim()) return c.json({ error: 'Klasör adı boş olamaz' }, 400);
  const folder = await db.prepare(`SELECT f.*, i.name as institution_name FROM institution_folders f LEFT JOIN institutions i ON f.institution_id = i.id WHERE f.id = ?`).bind(folderId).first();
  if (!folder) return c.json({ error: 'Klasör bulunamadı' }, 404);
  if (role === 'admin' && auth.user.institution !== folder.institution_name) return c.json({ error: 'Yetkisiz' }, 403);
  await db.prepare(`UPDATE institution_folders SET folder_name = ? WHERE id = ?`).bind(folder_name.trim(), folderId).run();
  return c.json({ success: true });
});

// ====================== KURUM DOSYA CRUD ======================

app.post('/api/institution/:id/file', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  const role = auth.user.role;
  if (role !== 'super_admin' && role !== 'admin') return c.json({ error: 'Yetkisiz' }, 403);
  const institutionId = c.req.param('id');
  const db = c.env.DB;
  const institution = await db.prepare(`SELECT id, name FROM institutions WHERE name = ? OR id = ?`).bind(institutionId, institutionId).first();
  if (!institution) return c.json({ error: 'Kurum bulunamadı' }, 404);
  if (role === 'admin' && auth.user.institution !== institution.name) return c.json({ error: 'Yetkisiz' }, 403);
  const { file_name, file_url, file_type, category, folder_id, is_public } = await c.req.json();
  if (!file_name?.trim() || !file_url?.trim()) return c.json({ error: 'Dosya adı ve URL zorunludur' }, 400);
  const result = await db.prepare(`INSERT INTO institution_files (institution_id, file_name, file_url, file_type, category, folder_id, is_public, is_active, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)`)
    .bind(institution.id, file_name.trim(), file_url.trim(), file_type || 'other', category || 'other', folder_id || null, is_public ? 1 : 0, auth.user.user_id).run();
  return c.json({ success: true, id: result.meta?.last_row_id });
});

app.put('/api/institution/file/:id', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  const role = auth.user.role;
  if (role !== 'super_admin' && role !== 'admin') return c.json({ error: 'Yetkisiz' }, 403);
  const fileId = c.req.param('id');
  const db = c.env.DB;
  const file = await db.prepare(`SELECT f.*, i.name as institution_name FROM institution_files f LEFT JOIN institutions i ON f.institution_id = i.id WHERE f.id = ? AND f.is_active = 1`).bind(fileId).first();
  if (!file) return c.json({ error: 'Dosya bulunamadı' }, 404);
  if (role === 'admin' && auth.user.institution !== file.institution_name) return c.json({ error: 'Yetkisiz' }, 403);
  const { file_name, file_url, category, is_public, folder_id } = await c.req.json();
  await db.prepare(`UPDATE institution_files SET file_name = COALESCE(?, file_name), file_url = COALESCE(?, file_url), category = COALESCE(?, category), is_public = COALESCE(?, is_public), folder_id = COALESCE(?, folder_id) WHERE id = ?`)
    .bind(file_name || null, file_url || null, category || null, is_public !== undefined ? (is_public ? 1 : 0) : null, folder_id !== undefined ? folder_id : null, fileId).run();
  return c.json({ success: true });
});

app.delete('/api/institution/file/:id', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  const role = auth.user.role;
  if (role !== 'super_admin' && role !== 'admin') return c.json({ error: 'Yetkisiz' }, 403);
  const fileId = c.req.param('id');
  const db = c.env.DB;
  const file = await db.prepare(`SELECT f.*, i.name as institution_name FROM institution_files f LEFT JOIN institutions i ON f.institution_id = i.id WHERE f.id = ? AND f.is_active = 1`).bind(fileId).first();
  if (!file) return c.json({ error: 'Dosya bulunamadı' }, 404);
  if (role === 'admin' && auth.user.institution !== file.institution_name) return c.json({ error: 'Yetkisiz' }, 403);

  // R2'den sil (eğer /api/files/ URL'iyse)
  const bucket = c.env.FILES_BUCKET;
  if (bucket && file.file_url?.includes('/api/files/')) {
    const key = file.file_url.replace(/^.*\/api\/files\//, '');
    console.log('R2 delete attempt - file_url:', file.file_url, 'key:', key);
    try {
      await bucket.delete(key);
      console.log('R2 delete success:', key);
    } catch (e) {
      console.error('R2 delete error:', e);
    }
  } else {
    console.log('R2 skip - file_url:', file.file_url);
  }

  // DB'den soft delete
  await db.prepare(`UPDATE institution_files SET is_active = 0 WHERE id = ?`).bind(fileId).run();
  return c.json({ success: true });
});

// ====================== KURUM YÖNETİMİ ======================

app.post('/api/admin/institution', async (c) => {
  if (!await isSuperAdmin(c)) return c.json({ error: 'Sadece Super Admin' }, 403);
  const { name, domain, category, status } = await c.req.json();
  if (!name?.trim()) return c.json({ error: 'Kurum adı zorunludur' }, 400);
  const validCategories = ['University','Corporate','K-12','Government','Publisher','Service Provider','Sub-distributor'];
  const validStatuses = ['Customer','Prospect','Partner','Inactive'];
  const cat = validCategories.includes(category) ? category : 'University';
  const st = validStatuses.includes(status) ? status : 'Customer';
  const db = c.env.DB;
  try {
    const result = await db.prepare(`INSERT INTO institutions (name, domain, category, status) VALUES (?, ?, ?, ?)`).bind(name.trim(), domain?.trim() || null, cat, st).run();
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
  const { name, domain, category, status } = await c.req.json();
  const validCategories = ['University','Corporate','K-12','Government','Publisher','Service Provider','Sub-distributor'];
  const validStatuses = ['Customer','Prospect','Partner','Inactive'];
  const db = c.env.DB;

  if (role === 'super_admin') {
    const cat = validCategories.includes(category) ? category : null;
    const st = validStatuses.includes(status) ? status : null;
    await db.prepare(`UPDATE institutions SET name = COALESCE(?, name), domain = ?, category = COALESCE(?, category), status = COALESCE(?, status) WHERE id = ?`)
      .bind(name || null, domain ?? null, cat, st, id).run();
  } else {
    const payload = await getTokenPayloadFromCookie(c);
    const target = await db.prepare(`SELECT name FROM institutions WHERE id = ?`).bind(id).first();
    if (!target || !payload?.institution || target.name !== payload.institution) return c.json({ error: 'Bu kurumu düzenleme yetkiniz yok' }, 403);
    const st = validStatuses.includes(status) ? status : null;
    await db.prepare(`UPDATE institutions SET domain = ?, status = COALESCE(?, status) WHERE id = ?`).bind(domain ?? null, st, id).run();
  }

  return c.json({ success: true });
});

app.delete('/api/admin/institution/:id', async (c) => {
  if (!await isSuperAdmin(c)) return c.json({ error: 'Sadece Super Admin' }, 403);
  const id = c.req.param('id');
  const db = c.env.DB;
  await db.prepare(`UPDATE institution_files SET is_active = 0 WHERE institution_id = ?`).bind(id).run();
  await db.prepare(`DELETE FROM institution_folders WHERE institution_id = ?`).bind(id).run();
  await db.prepare(`DELETE FROM institutions WHERE id = ?`).bind(id).run();
  return c.json({ success: true });
});


// ====================== FILE ROUTES ======================

app.get('/api/files/*', async (c) => {
  const bucket = c.env.FILES_BUCKET;
  if (!bucket) return c.json({ error: 'R2 bucket bağlı değil' }, 500);

  const key = c.req.path.replace('/api/files/', '');
  if (!key) return c.json({ error: 'Dosya bulunamadı' }, 404);

  // Erişim kontrolü: admin/super_admin her dosyaya erişebilir
  // Normal kullanıcı ve misafir sadece is_public=1 dosyalara erişebilir
  const db = c.env.DB;
  const fileRecord = await db.prepare(
    `SELECT is_public, institution_id FROM institution_files 
     WHERE file_url = ? AND is_active = 1`
  ).bind(`/api/files/${key}`).first();

  if (fileRecord) {
    if (!fileRecord.is_public) {
      const auth = await requireAuth(c);
      if (auth.response) {
        return c.json({ error: 'Bu dosyaya erişim yetkiniz yok' }, 403);
      }
      const role = auth.user.role;
      // super_admin tüm dosyalara erişebilir
      if (role === 'super_admin') {
        // izin ver
      } else if (role === 'admin') {
        // admin sadece kendi kurumunun private dosyasına erişebilir
        const adminInstitutionId = await getUserInstitutionId(c);
        if (!adminInstitutionId || String(adminInstitutionId) !== String(fileRecord.institution_id)) {
          return c.json({ error: 'Bu dosyaya erişim yetkiniz yok' }, 403);
        }
      } else {
        // normal kullanıcı: kendi kurumuna ait private dosyalara erişemez
        return c.json({ error: 'Bu dosyaya erişim yetkiniz yok' }, 403);
      }
    }
  }
  // DB'de kayıt yoksa (eski dosyalar vb.) izin ver

  const object = await bucket.get(key);
  if (!object) return c.json({ error: 'Dosya bulunamadı' }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=3600');
  headers.set('content-disposition', 'inline');
  headers.delete('x-frame-options');
  // Google Docs Viewer ve iframe erişimi için CORS
  headers.set('access-control-allow-origin', '*');

  return new Response(object.body, { headers });
});

// ====================== ANNOUNCEMENT ROUTES ======================

// Public: sadece yayında olanlar
app.get('/api/announcements', async (c) => {
  const db = c.env.DB;
  try {
    await ensureAnnouncementColumns(db);

    const rows = await db.prepare(`
      SELECT id, title, summary, full_content, title_en, summary_en, full_content_en, cover_image_url, ai_image_prompt, category, priority, published_at
      FROM announcements
      WHERE is_published = 1
      ORDER BY published_at DESC
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
      published_at: row.published_at
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
    await ensureAnnouncementColumns(db);

    const rows = await db.prepare(`
      SELECT a.*, u.full_name as author_name
      FROM announcements a
      LEFT JOIN users u ON a.created_by = u.id
      ORDER BY a.published_at DESC
    `).all();
    return c.json(rows.results || []);
  } catch (err) {
    console.error('Get admin announcements error:', err);
    return c.json({ error: err.message }, 500);
  }
});

app.post('/api/admin/announcements/ai/image', async (c) => {
  if (!await isAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);

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
  if (!await isAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);

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
  if (!await isAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);

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
  if (!await isAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);
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

  if (!title) return c.json({ error: 'Başlık zorunludur' }, 400);

  try {
    await ensureAnnouncementColumns(db);

    const result = await db.prepare(`
      INSERT INTO announcements (title, summary, full_content, title_en, summary_en, full_content_en, cover_image_url, ai_image_prompt, category, priority, is_published, published_at, updated_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)
    `).bind(title, summary, fullContent, titleEn || null, summaryEn || null, fullContentEn || null, coverImageUrl || null, aiImagePrompt || null, category, priority, isPublished, auth.user.user_id).run();
    return c.json({ success: true, id: result.meta?.last_row_id });
  } catch (err) {
    console.error('Create announcement error:', err);
    return c.json({ error: err.message }, 500);
  }
});

app.put('/api/admin/announcements/:id', async (c) => {
  if (!await isAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);
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

  if (!title) return c.json({ error: 'Başlık zorunludur' }, 400);

  try {
    await ensureAnnouncementColumns(db);

    const result = await db.prepare(`
      UPDATE announcements
      SET title = ?, summary = ?, full_content = ?, title_en = ?, summary_en = ?, full_content_en = ?, cover_image_url = ?, ai_image_prompt = ?, category = ?, priority = ?, is_published = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(title, summary, fullContent, titleEn || null, summaryEn || null, fullContentEn || null, coverImageUrl || null, aiImagePrompt || null, category, priority, isPublished, id).run();
    if (result.meta?.changes === 0) return c.json({ error: 'Duyuru bulunamadı' }, 404);
    return c.json({ success: true });
  } catch (err) {
    console.error('Update announcement error:', err);
    return c.json({ error: err.message }, 500);
  }
});

app.delete('/api/admin/announcements/:id', async (c) => {
  if (!await isAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);
  const db = c.env.DB;
  const id = c.req.param('id');
  try {
    await ensureAnnouncementColumns(db);
    await db.prepare(`DELETE FROM announcements WHERE id = ?`).bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    console.error('Delete announcement error:', err);
    return c.json({ error: err.message }, 500);
  }
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
        category: Array.isArray(r.fields['Organization']) ? r.fields['Organization'][0] : (r.fields['Organization'] || ''),
        status: Array.isArray(r.fields['Status']) ? r.fields['Status'][0] : (r.fields['Status'] || ''),
    }));
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
    await ensureUserContactColumns(db);

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
        const records = await fetchAirtableAccounts(c.env);
        const changes = [];

        for (const rec of records) {
            if (!rec.name) continue;

            const existing = await db.prepare(
                `SELECT id, name, domain, category, status FROM institutions WHERE airtable_id = ?`
            ).bind(rec.airtable_id).first();

            if (existing) {
                // Değişiklik var mı? (null ve '' aynı kabul et)
                const norm = v => v || '';
                if (norm(existing.name) !== norm(rec.name) || norm(existing.domain) !== norm(rec.domain) ||
                    norm(existing.category) !== norm(rec.category) || norm(existing.status) !== norm(rec.status)) {
                    changes.push({
                        action: 'update',
                        airtable_id: rec.airtable_id,
                        name: rec.name,
                        domain: rec.domain,
                        category: rec.category,
                        status: rec.status,
                        before: { name: existing.name, domain: existing.domain, category: existing.category, status: existing.status }
                    });
                }
            } else {
                const nameConflict = await db.prepare(
                    `SELECT id, name, domain, category, status FROM institutions WHERE name = ?`
                ).bind(rec.name).first();

                if (nameConflict) {
                    changes.push({
                        action: 'link',
                        airtable_id: rec.airtable_id,
                        name: rec.name,
                        domain: rec.domain,
                        category: rec.category,
                        status: rec.status,
                        before: { name: nameConflict.name, domain: nameConflict.domain, category: nameConflict.category, status: nameConflict.status }
                    });
                } else {
                    changes.push({
                        action: 'create',
                        airtable_id: rec.airtable_id,
                        name: rec.name,
                        domain: rec.domain,
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
        const { changes } = await c.req.json(); // Seçili change listesi
        if (!Array.isArray(changes) || changes.length === 0) return c.json({ error: 'Uygulanacak değişiklik yok' }, 400);

        let created = 0, updated = 0;

        for (const ch of changes) {
            const { action, airtable_id, name, domain, category, status } = ch;
            if (!name || !airtable_id) continue;

            if (action === 'update') {
                await db.prepare(
                    `UPDATE institutions SET name = ?, domain = ?, category = ?, status = ? WHERE airtable_id = ?`
                ).bind(name, domain, category, status, airtable_id).run();
                updated++;
            } else if (action === 'link') {
                await db.prepare(
                    `UPDATE institutions SET domain = ?, category = ?, status = ?, airtable_id = ? WHERE name = ?`
                ).bind(domain, category, status, airtable_id, name).run();
                updated++;
            } else if (action === 'create') {
                await db.prepare(
                    `INSERT INTO institutions (name, domain, category, status, airtable_id) VALUES (?, ?, ?, ?, ?)`
                ).bind(name, domain, category, status, airtable_id).run();
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
        await ensureUserContactColumns(db);
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
    const auth = await requireAuth(c);
    if (auth.response) return auth.response;
    if (auth.user.role !== 'admin' && auth.user.role !== 'super_admin') {
        return c.json({ error: 'Yetkisiz' }, 403);
    }
    
    const recordId = c.req.param('id');
    const { name, organization, status, domain } = await c.req.json();

    const baseId = c.env.AIRTABLE_BASE_ID;
    const pat = c.env.AIRTABLE_PAT;

    const url = `https://api.airtable.com/v0/${baseId}/Accounts/${recordId}`;

    const fields = {};
    if (name) fields['Account Name'] = name;
    if (organization) fields['Organization'] = organization;
    if (status) fields['Status'] = status;
    if (domain !== undefined) fields['Domain'] = domain;
    
    try {
        const response = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${pat}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fields })
        });
        const data = await response.json();
        
        if (data.error) {
            console.error('Airtable update error:', data.error);
            return c.json({ error: data.error.message }, 500);
        }
        
        return c.json({ success: true, record: data });
    } catch (err) {
        console.error('Airtable fetch error:', err);
        return c.json({ error: err.message }, 500);
    }
});

export default app;




