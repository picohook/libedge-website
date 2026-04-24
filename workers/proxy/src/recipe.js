/**
 * workers/proxy/src/recipe.js
 *
 * Remote Access recipe executor. Bir proxy oturumu oluşturulduktan sonra,
 * ürün için ra_login_recipe_json tanımlıysa, bu modül ilgili publisher'a
 * otomatik login akışını yürütür. Sonuç: cookie jar dolu ve/veya session
 * kayıtlı bearer token — sonraki normal proxy akışı bu state'i kullanır.
 *
 * İki mod destekleniyor:
 *   form_post  — klasik HTML form POST (SESSION / JSESSIONID cookie set'ler)
 *                ScienceDirect, Springer, EBSCO gibi eski publisher'lar için.
 *   spa_token  — modern SPA (Pangram gibi). Login API JSON POST,
 *                response JSON'undan access_token çıkarılır; sonraki istek-
 *                lerde Authorization: Bearer header'ı eklenir ve ilk HTML
 *                dönüşünde token localStorage'a JS snippet ile inject edilir.
 *
 * Recipe format örnekleri admin panelde (admin.html) RA_RECIPE_TEMPLATES
 * sabitinde tutuluyor. Burada sadece parse + execute var — şema
 * bakımı ve validation admin endpoint'inde yapılıyor.
 */

import { decryptCredential, encryptCredential } from '../../../backend/src/ra/crypto.js';

const COOKIE_JAR_TTL = 3600;
const AUTH_STATE_TTL = 3600;

/**
 * Ana execute giriş noktası. Güvenli — hata durumunda throw etmez,
 * result.ok=false döner ve proxy akışı kredential olmadan devam edebilir.
 *
 * @param {any} env Cloudflare bindings
 * @param {object} session Proxy session objesi
 * @param {string} sessionId proxysess:{sid} KV key'i
 * @returns {Promise<{
 *   ok: boolean,
 *   mode?: 'form_post'|'spa_token',
 *   token?: { header_name: string, header_prefix: string, value: string, ls_key: string|null },
 *   error?: string,
 * }>}
 */
export async function ensureRecipeExecuted(env, session, sessionId) {
  const cacheKey = `raauth:${sessionId}:${session.target_host}`;
  const cached = await env.RA_UPSTREAM_SESSIONS.get(cacheKey, { type: 'json' });
  if (cached) return cached;

  let result;
  try {
    result = await executeRecipe(env, session, sessionId);
  } catch (err) {
    console.warn('recipe execution threw', err);
    result = { ok: false, error: String((err && err.message) || err) };
  }

  // failed'ları da cache'le (short TTL) — her request'te yeniden denemeyelim
  await env.RA_UPSTREAM_SESSIONS.put(
    cacheKey,
    JSON.stringify(result),
    { expirationTtl: result.ok ? AUTH_STATE_TTL : 60 }
  );
  return result;
}

async function executeRecipe(env, session, sessionId) {
  const product = await loadProduct(env.DB, session.product_slug);
  if (!product || !product.ra_login_recipe_json) {
    return { ok: false, error: 'no_recipe' };
  }

  let recipe;
  try {
    recipe = JSON.parse(product.ra_login_recipe_json);
  } catch (err) {
    return { ok: false, error: `recipe_parse_error: ${err.message}` };
  }
  if (!recipe || typeof recipe !== 'object') {
    return { ok: false, error: 'recipe_not_object' };
  }

  const originHost = product.ra_origin_host || session.target_host;
  const mode = recipe.mode || 'form_post';

  // Per-user token capture mode (Pangram gibi per-user invite'lı SPA'lar):
  // subscription.ra_credential_scope='per_user' + recipe'de
  // capture_token_on_login_path var. Her kullanıcı kendi token'ı üretir, ilk
  // login'de proxy onu yakalar, sonraki session'larda replay edilir.
  // Bu modda "credential" = kullanıcının ra_user_credentials'ta saklı token'ı,
  // admin-scope credential değil.
  if (mode === 'spa_token' && recipe.capture_token_on_login_path) {
    const captured = await loadCapturedUserToken(env, session);
    if (captured) {
      return buildSpaTokenState(recipe, captured);
    }
    // Token henüz yakalanmamış — passthrough et, kullanıcı publisher'ın kendi
    // login ekranını görsün. upstream.js capture_token_on_login_path'e gelen
    // response'u intercept edip token'ı storelayacak.
    return { ok: false, error: 'awaiting_capture', mode: 'awaiting_capture' };
  }

  const credential = await loadCredential(env, session);
  if (!credential) {
    return { ok: false, error: 'no_credential' };
  }

  if (mode === 'form_post') {
    return await executeFormPost({ env, session, sessionId, recipe, credential, originHost });
  }
  if (mode === 'spa_token') {
    return await executeSpaToken({ env, session, sessionId, recipe, credential, originHost });
  }
  return { ok: false, error: `unknown_mode: ${mode}` };
}

function buildSpaTokenState(recipe, tokenValue) {
  return {
    ok: true,
    mode: 'spa_token',
    token: {
      header_name: recipe.token_header_name || 'Authorization',
      header_prefix: recipe.token_header_prefix != null ? recipe.token_header_prefix : 'Bearer ',
      value: String(tokenValue),
      ls_key: recipe.localstorage_inject_key || null,
    },
  };
}

/**
 * form_post: GET login page → extract hidden fields (CSRF dahil) → POST
 * application/x-www-form-urlencoded body. Set-Cookie'ler proxyToUpstream
 * cookie jar'ına kaydedilir.
 */
async function executeFormPost({ env, session, sessionId, recipe, credential, originHost }) {
  const loginPagePath = recipe.login_page_path || '/login';
  const loginPageUrl = `https://${originHost}${loginPagePath}`;
  const jarKey = `jar:${sessionId}:${session.target_host}`;

  // 1) Login sayfasını GET et (hidden field'lar + CSRF token için).
  //    Çoğu eski publisher'da tek hidden field yeterli, çoğunda form boştur.
  let hiddenFields = {};
  let getCookieHeader = '';
  try {
    const getResp = await fetch(loginPageUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': userAgent() },
    });
    hiddenFields = await extractHiddenFields(getResp);
    const setCookies = collectSetCookies(getResp);
    if (setCookies.length) {
      getCookieHeader = mergeSetCookiesIntoJar('', setCookies);
    }
  } catch (err) {
    return { ok: false, error: `form_get_failed: ${err.message}` };
  }

  // 2) Form body oluştur
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(hiddenFields)) params.set(k, v);
  const fields = recipe.fields || {};
  const userField = fields.username || 'username';
  const passField = fields.password || 'password';
  params.set(userField, credential.username);
  params.set(passField, credential.password);
  if (recipe.extra_static_fields && typeof recipe.extra_static_fields === 'object') {
    for (const [k, v] of Object.entries(recipe.extra_static_fields)) {
      if (typeof v === 'string') params.set(k, v);
    }
  }

  const postUrl = recipe.login_post_path
    ? `https://${originHost}${recipe.login_post_path}`
    : loginPageUrl;

  // 3) POST
  let postResp;
  try {
    const postHeaders = new Headers({
      'User-Agent': userAgent(),
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': loginPageUrl,
    });
    if (getCookieHeader) postHeaders.set('Cookie', getCookieHeader);
    postResp = await fetch(postUrl, {
      method: 'POST',
      redirect: 'manual',
      headers: postHeaders,
      body: params.toString(),
    });
  } catch (err) {
    return { ok: false, error: `form_post_failed: ${err.message}` };
  }

  // 4) Set-Cookie'leri jar'a birleştir
  const newCookies = collectSetCookies(postResp);
  const mergedJar = mergeSetCookiesIntoJar(getCookieHeader, newCookies);
  if (mergedJar) {
    await env.RA_UPSTREAM_SESSIONS.put(jarKey, mergedJar, {
      expirationTtl: COOKIE_JAR_TTL,
    });
  }

  // 5) Başarı check: success_cookie_names içinden en az biri jar'da olmalı
  const successCookieNames = Array.isArray(recipe.success_cookie_names)
    ? recipe.success_cookie_names
    : [];
  const jarNames = new Set(
    (mergedJar || '').split(';').map((s) => s.split('=')[0].trim()).filter(Boolean)
  );
  const hasSuccessCookie = successCookieNames.length === 0
    || successCookieNames.some((n) => jarNames.has(n));

  // Alternatif success signal: POST response 3xx Location header success_redirect_contains içerir
  const location = postResp.headers.get('location') || '';
  const hasSuccessRedirect = recipe.success_redirect_contains
    ? location.includes(recipe.success_redirect_contains)
    : false;

  if (!hasSuccessCookie && !hasSuccessRedirect) {
    return {
      ok: false,
      error: `login_failed: status=${postResp.status} jar_cookies=${[...jarNames].join(',')}`,
    };
  }

  return { ok: true, mode: 'form_post' };
}

/**
 * spa_token: Login API'yi POST et, response JSON'undan token path'inden
 * bearer token çıkar; KV'ye kaydet. Upstream akışı bu token'ı
 * Authorization: Bearer ... header'ı ile ekleyecek ve ilk HTML response'a
 * <script>localStorage.setItem(...)</script> inject edecek.
 */
async function executeSpaToken({ env, session, sessionId, recipe, credential, originHost }) {
  const loginPath = recipe.login_endpoint_path || '/api/auth/login';
  const loginUrl = `https://${originHost}${loginPath}`;
  const method = (recipe.login_method || 'POST').toUpperCase();
  const contentType = recipe.login_content_type || 'application/json';

  const bodyTemplate = recipe.login_body_template
    || '{"email":"{{username}}","password":"{{password}}"}';
  const body = renderTemplate(bodyTemplate, {
    username: credential.username,
    password: credential.password,
  });

  let resp;
  try {
    resp = await fetch(loginUrl, {
      method,
      redirect: 'manual',
      headers: {
        'User-Agent': userAgent(),
        'Content-Type': contentType,
        'Accept': 'application/json',
      },
      body,
    });
  } catch (err) {
    return { ok: false, error: `spa_login_failed: ${err.message}` };
  }

  const successCodes = Array.isArray(recipe.success_status_codes)
    ? recipe.success_status_codes.map(Number)
    : [200, 201];
  if (!successCodes.includes(resp.status)) {
    return { ok: false, error: `spa_login_status: ${resp.status}` };
  }

  // Set-Cookie'ler (varsa) jar'a eklensin — SPA'lar bazen auth cookie + token'ı
  // birlikte set'ler
  const setCookies = collectSetCookies(resp);
  if (setCookies.length) {
    const jarKey = `jar:${sessionId}:${session.target_host}`;
    const existing = (await env.RA_UPSTREAM_SESSIONS.get(jarKey)) || '';
    const merged = mergeSetCookiesIntoJar(existing, setCookies);
    if (merged) {
      await env.RA_UPSTREAM_SESSIONS.put(jarKey, merged, {
        expirationTtl: COOKIE_JAR_TTL,
      });
    }
  }

  const tokenSource = recipe.token_source || 'response_json_field';
  let token = null;
  if (tokenSource === 'response_json_field') {
    const tokenField = recipe.token_field || 'access_token';
    let json;
    try {
      json = await resp.json();
    } catch (err) {
      return { ok: false, error: `spa_body_not_json: ${err.message}` };
    }
    token = extractJsonPath(json, tokenField);
  } else if (tokenSource === 'response_header') {
    const headerName = recipe.token_header_source || 'Authorization';
    token = resp.headers.get(headerName);
    if (token && /^bearer\s+/i.test(token)) token = token.replace(/^bearer\s+/i, '');
  }
  if (!token) {
    return { ok: false, error: `spa_token_missing_in_${tokenSource}` };
  }

  return {
    ok: true,
    mode: 'spa_token',
    token: {
      header_name: recipe.token_header_name || 'Authorization',
      header_prefix: recipe.token_header_prefix != null ? recipe.token_header_prefix : 'Bearer ',
      value: String(token),
      ls_key: recipe.localstorage_inject_key || null,
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Credential + product loaders
// ──────────────────────────────────────────────────────────────────────────

async function loadProduct(db, slug) {
  return await db
    .prepare(
      `SELECT slug, ra_enabled, ra_origin_host, ra_login_recipe_json
       FROM products WHERE slug = ?`
    )
    .bind(slug)
    .first();
}

/**
 * Ürünün parse edilmiş recipe'ini döner (token capture flow'da upstream.js
 * bu bilgiyi her upstream response'ta kullanır). Invalid JSON null döner.
 */
export async function loadRecipeForSession(env, session) {
  const product = await loadProduct(env.DB, session.product_slug);
  if (!product || !product.ra_login_recipe_json) return null;
  try {
    const recipe = JSON.parse(product.ra_login_recipe_json);
    return recipe && typeof recipe === 'object' ? recipe : null;
  } catch {
    return null;
  }
}

async function loadCredential(env, session) {
  // Shared (institution-level) credential
  const masterKey = env.RA_CREDS_MASTER_KEY;
  if (!masterKey) return null;

  const sub = await env.DB
    .prepare(
      `SELECT ra_credential_scope, ra_credential_enc, ra_recipe_override_json
       FROM institution_subscriptions WHERE id = ?`
    )
    .bind(session.subscription_id)
    .first();
  if (!sub) return null;

  const scope = sub.ra_credential_scope || 'shared';
  if (scope === 'shared') {
    if (!sub.ra_credential_enc) return null;
    return await decryptCredentialSafe(sub.ra_credential_enc, masterKey);
  }
  if (scope === 'per_user') {
    const userRow = await env.DB
      .prepare(
        `SELECT credential_enc FROM ra_user_credentials
         WHERE user_id = ? AND product_slug = ?`
      )
      .bind(session.user_id, session.product_slug)
      .first();
    if (!userRow || !userRow.credential_enc) return null;
    return await decryptCredentialSafe(userRow.credential_enc, masterKey);
  }
  return null;
}

/**
 * Per-user capture mode için yakalı token'ı ra_user_credentials'tan oku.
 * Saklanan plaintext JSON formatı: `{"token":"..."}` (password alanı yok).
 */
async function loadCapturedUserToken(env, session) {
  const masterKey = env.RA_CREDS_MASTER_KEY;
  if (!masterKey) return null;

  const row = await env.DB
    .prepare(
      `SELECT credential_enc FROM ra_user_credentials
       WHERE user_id = ? AND product_slug = ?`
    )
    .bind(session.user_id, session.product_slug)
    .first();
  if (!row || !row.credential_enc) return null;

  try {
    const plaintext = await decryptCredential(row.credential_enc, masterKey);
    const obj = JSON.parse(plaintext);
    if (!obj || typeof obj !== 'object') return null;
    // Token yakalanmış (Option B) ya da kullanıcı elle şifre girmiş (Option A)
    // Option A'yı şimdilik desteklemiyoruz; sadece token var olan kayıtlar geçerli.
    return obj.token ? String(obj.token) : null;
  } catch (err) {
    console.warn('captured token decrypt failed', err);
    return null;
  }
}

/**
 * Login response'undan extract edilen token'ı ra_user_credentials'a yazar.
 * Aynı zamanda raauth cache'ini invalidate eder, böylece aynı session'daki
 * sonraki request hemen token'ı replay moduna geçer.
 *
 * @param {any} env
 * @param {object} session
 * @param {string} sessionId
 * @param {string} token  Publisher'dan yakalanan auth token (JWT vb.)
 */
export async function storeCapturedUserToken(env, session, sessionId, token) {
  const masterKey = env.RA_CREDS_MASTER_KEY;
  if (!masterKey) {
    console.warn('RA_CREDS_MASTER_KEY missing — cannot persist captured token');
    return false;
  }
  const plaintext = JSON.stringify({ token: String(token) });
  let ciphertext;
  try {
    ciphertext = await encryptCredential(plaintext, masterKey);
  } catch (err) {
    console.warn('captured token encrypt failed', err);
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  // UPSERT (conflict → update): user_id + product_slug primary key
  await env.DB
    .prepare(
      `INSERT INTO ra_user_credentials (user_id, product_slug, credential_enc, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, product_slug) DO UPDATE SET
         credential_enc = excluded.credential_enc,
         created_at = excluded.created_at`
    )
    .bind(session.user_id, session.product_slug, ciphertext, now)
    .run();

  // Cache invalidate — sonraki ensureRecipeExecuted fresh read yapsın
  await invalidateAuthCache(env, session, sessionId);
  return true;
}

/**
 * Stored token geçersiz (401) — kullanıcı tekrar login yapsın diye
 * hem ra_user_credentials kaydını hem de raauth cache'ini sil.
 */
export async function invalidateCapturedUserToken(env, session, sessionId) {
  await env.DB
    .prepare(
      `DELETE FROM ra_user_credentials WHERE user_id = ? AND product_slug = ?`
    )
    .bind(session.user_id, session.product_slug)
    .run();
  await invalidateAuthCache(env, session, sessionId);
}

async function invalidateAuthCache(env, session, sessionId) {
  const cacheKey = `raauth:${sessionId}:${session.target_host}`;
  await env.RA_UPSTREAM_SESSIONS.delete(cacheKey);
}



/**
 * Login response'unu intercept et. Path eşleşiyorsa body'yi buffer'la,
 * token extract et, storela. Token bulunursa client'a forward edilecek
 * response buffer'dan reconstruct edilir.
 *
 * @param {any} env
 * @param {object} session
 * @param {string} sessionId
 * @param {object} recipe
 * @param {string} requestPath Publisher'a giden request'in path'i (/api/auth/login vs.)
 * @param {Response} resp Publisher'dan dönen response
 * @returns {Promise<Response>} Client'a forward edilecek response (body tüketildiyse
 *   yeniden oluşturulmuş)
 */
export async function maybeCaptureTokenAndForward(env, session, sessionId, recipe, requestPath, resp) {
  if (!recipe || !recipe.capture_token_on_login_path) return resp;
  if (!pathMatches(requestPath, recipe.capture_token_on_login_path)) return resp;

  const successCodes = Array.isArray(recipe.success_status_codes)
    ? recipe.success_status_codes.map(Number)
    : [200, 201];
  if (!successCodes.includes(resp.status)) return resp;

  // Body'yi buffer'la (JSON login response'ları küçük, güvenli)
  const bodyBuf = await resp.arrayBuffer();
  const bodyText = new TextDecoder().decode(bodyBuf);

  // Token çıkar
  const tokenSource = recipe.token_source || 'response_json_field';
  let token = null;
  if (tokenSource === 'response_json_field') {
    const tokenField = recipe.token_field || 'access_token';
    try {
      const json = JSON.parse(bodyText);
      token = extractJsonPath(json, tokenField);
    } catch (err) {
      console.warn('capture: response body not JSON', err);
    }
  } else if (tokenSource === 'response_header') {
    const headerName = recipe.token_header_source || 'Authorization';
    token = resp.headers.get(headerName);
    if (token && /^bearer\s+/i.test(token)) token = token.replace(/^bearer\s+/i, '');
  }

  if (token) {
    try {
      await storeCapturedUserToken(env, session, sessionId, token);
    } catch (err) {
      console.warn('captured token persist failed', err);
    }
  }

  // Response'u reconstruct et (body tüketildi) — client'a aynen yansıt
  return new Response(bodyBuf, {
    status: resp.status,
    statusText: resp.statusText,
    headers: resp.headers,
  });
}

/**
 * Path matching: recipe.capture_token_on_login_path "/api/auth/login" gibi
 * sabit path ya da regex (slash'la başlayıp slash'la biten: "/^\/api\/auth\/login/")
 */
export function pathMatches(requestPath, pattern) {
  if (!pattern) return false;
  const s = String(pattern);
  if (s.length > 2 && s.startsWith('/') && s.endsWith('/')) {
    // Regex pattern
    try {
      const re = new RegExp(s.slice(1, -1));
      return re.test(requestPath);
    } catch {
      return false;
    }
  }
  return requestPath === s || requestPath.split('?')[0] === s;
}

async function decryptCredentialSafe(ciphertext, masterKey) {
  try {
    const plaintext = await decryptCredential(ciphertext, masterKey);
    const obj = JSON.parse(plaintext);
    if (!obj.username || !obj.password) return null;
    return { username: String(obj.username), password: String(obj.password) };
  } catch (err) {
    console.warn('credential decrypt failed', err);
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function userAgent() {
  return 'Mozilla/5.0 (compatible; LibEdge-RA/1.0; +https://libedge.com/ra)';
}

function collectSetCookies(resp) {
  // CF Workers: Response.headers.getSetCookie() mevcut değil; entries()
  // multi-value Set-Cookie'leri virgülle birleştirir bu riskli. 'set-cookie'
  // için getAll benzeri tek sağlam yöntem headers iterator.
  const out = [];
  if (typeof resp.headers.getSetCookie === 'function') {
    for (const v of resp.headers.getSetCookie()) out.push(v);
    return out;
  }
  for (const [k, v] of resp.headers.entries()) {
    if (k.toLowerCase() === 'set-cookie') out.push(v);
  }
  return out;
}

export function mergeSetCookiesIntoJar(existing, newSetCookies) {
  const map = new Map();
  if (existing) {
    for (const pair of existing.split(';')) {
      const idx = pair.indexOf('=');
      if (idx > 0) {
        const name = pair.slice(0, idx).trim();
        const value = pair.slice(idx + 1).trim();
        if (name) map.set(name, value);
      }
    }
  }
  for (const sc of newSetCookies) {
    const firstSemi = sc.indexOf(';');
    const pair = firstSemi < 0 ? sc : sc.slice(0, firstSemi);
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (name) map.set(name, value);
    }
  }
  const out = [];
  for (const [k, v] of map.entries()) out.push(`${k}=${v}`);
  return out.join('; ');
}

async function extractHiddenFields(resp) {
  // HTMLRewriter: hidden input'ları topla. CF runtime'ında HTMLRewriter
  // akım tabanlı; topladıktan sonra accumulator'ı geri döndür.
  const fields = {};
  const rewriter = new HTMLRewriter().on('input[type="hidden"]', {
    element(el) {
      const name = el.getAttribute('name');
      const value = el.getAttribute('value') || '';
      if (name && !fields[name]) fields[name] = value;
    },
  });
  // Body'yi tüketmek için transform et + text() çağır
  await rewriter.transform(resp.clone()).text();
  return fields;
}

export function renderTemplate(tpl, vars) {
  return String(tpl).replace(/\{\{(\w+)\}\}/g, (_, k) =>
    vars[k] != null
      ? JSON.stringify(String(vars[k])).slice(1, -1)
      : ''
  );
}

export function extractJsonPath(obj, path) {
  if (!obj) return null;
  const parts = String(path).split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return null;
    cur = cur[p];
  }
  return cur != null ? String(cur) : null;
}
