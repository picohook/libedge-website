console.log("HONO VERSION LOADED");
import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// ====================== CORS AYARLARI ======================
const ALLOWED_ORIGINS = [
  'https://libedge.com',
  'https://www.libedge.com',
  'https://libedge-website.pages.dev',
  'https://staging.libedge-website.pages.dev',
];

app.use('*', cors({
  origin: (origin) => {
    if (!origin) return "https://staging.libedge-website.pages.dev";
    return ALLOWED_ORIGINS.includes(origin) ? origin : "https://staging.libedge-website.pages.dev";
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposeHeaders: ['Content-Length', 'Set-Cookie'],
  maxAge: 600,
  credentials: true,  // ✅ Bu çok önemli
}));

// ====================== JWT YARDIMCILARI ======================

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
  // Cookie header'ını al
  const cookieHeader = c.req.header('Cookie');
  if (!cookieHeader) {
    return { response: c.json({ error: 'Oturum bulunamadı' }, 401) };
  }

  // authToken cookie'sini bul
  const tokenMatch = cookieHeader.match(/authToken=([^;]+)/);
  if (!tokenMatch) {
    return { response: c.json({ error: 'Oturum bulunamadı' }, 401) };
  }

  const token = tokenMatch[1];
  const secret = c.env.JWT_SECRET;
  
  try {
    const payload = await verifyToken(token, secret);
    if (!payload) {
      return { response: c.json({ error: 'Geçersiz veya süresi dolmuş oturum' }, 401) };
    }
    
    // Token'ı ve payload'ı döndür, response yok
    return { user: payload, token };
  } catch (err) {
    console.error('requireAuth error:', err);
    return { response: c.json({ error: 'Yetkilendirme hatası' }, 401) };
  }
}

// 🆕 Yardımcı: Mevcut kullanıcıyı al (middleware sonrası kullanılır)
async function getCurrentUser(c) {
  const auth = await requireAuth(c);
  if (auth.response) return null;
  return auth.user;
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
  return payload?.org_id || payload?.institution || null;
}

async function isSuperAdmin(c) {
  const role = await getUserRole(c);
  return role === 'super_admin';
}

async function isAdmin(c) {
  const role = await getUserRole(c);
  return role === 'admin' || role === 'super_admin';
}

async function canAccessUser(c, targetUserId) {
  const role = await getUserRole(c);
  if (role === 'super_admin') return true;
  
  const adminInstitution = await getUserInstitution(c);
  if (!adminInstitution) return false;
  
  const db = c.env.DB;
  const targetUser = await db.prepare(`SELECT institution FROM users WHERE id = ?`).bind(targetUserId).first();
  return targetUser && targetUser.institution === adminInstitution;
}

async function canListUsers(c) {
  const role = await getUserRole(c);
  return role === 'super_admin' || role === 'admin';
}

// ====================== ŞİFRE HASHLEME (PBKDF2) ======================

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

// ====================== GET ENDPOINT'LERİ ======================
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

// ====================== 🆕 LOGIN (Cookie tabanlı) ======================
app.post('/api/auth/login', async (c) => {
  try {
    const { email, password } = await c.req.json();
    const db = c.env.DB;

    const user = await db.prepare(`
      SELECT id, email, full_name, institution, password_hash, role 
      FROM users WHERE email = ?
    `).bind(email.toLowerCase().trim()).first();

    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return c.json({ success: false, error: 'E-posta veya şifre hatalı.' }, 401);
    }

    const tokenPayload = {
      user_id: user.id,
      email: user.email,
      full_name: user.full_name || "",
      institution: user.institution || "",
      role: user.role || "user",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (15 * 60)
    };
    
    const secret = c.env.JWT_SECRET;
    const token = await signToken(tokenPayload, secret);

    // 🔥 KRİTİK DEĞİŞİKLİK: Cross-origin için SameSite=None, Secure=true
    c.cookie('authToken', token, {
      httpOnly: true,
      secure: true,        // ✅ HTTPS için zorunlu
      sameSite: 'None',    // ✅ Cross-origin için zorunlu!
      maxAge: 900,         // 15 dakika
      path: '/'
    });
    
    return c.json({
      success: true,
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
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ✅ OPTIONS isteğini POST'un DIŞINA çıkar
app.options('/api/auth/login', (c) => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': 'https://staging.libedge-website.pages.dev',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    }
  });
});

// 🆕 LOGOUT ENDPOINT
app.post('/api/auth/logout', async (c) => {
  c.header('Set-Cookie', 'authToken=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict');
  c.header('Access-Control-Allow-Credentials', 'true');
  return c.json({ success: true, message: 'Başarıyla çıkış yapıldı' });
});

// 🆕 TOKEN YENİLEME ENDPOINT (15 dakikalık token için)
app.post('/api/auth/refresh', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  
  const oldPayload = auth.user;
  const db = c.env.DB;
  
  const user = await db.prepare(`
    SELECT id, email, full_name, institution, role FROM users WHERE id = ?
  `).bind(oldPayload.user_id).first();
  
  if (!user) {
    return c.json({ error: 'Kullanıcı bulunamadı' }, 401);
  }
  
  const newPayload = {
    user_id: user.id,
    email: user.email,
    full_name: user.full_name || "",
    institution: user.institution || "",
    role: user.role || "user",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (15 * 60)
  };
  
  const secret = c.env.JWT_SECRET;
  const newToken = await signToken(newPayload, secret);
  
  // 🔥 AYNI COOKIE AYARLARI
  c.cookie('authToken', newToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'None',
    maxAge: 900,
    path: '/'
  });
  
  return c.json({ success: true, message: 'Token yenilendi' });
});

// ====================== 🆕 PROTECTED ENDPOINT'LER (Cookie ile) ======================

app.get('/api/user/profile', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  
  const userId = auth.user.user_id;
  const db = c.env.DB;
  
  const user = await db.prepare(`
    SELECT id, email, full_name, institution, role, created_at FROM users WHERE id = ?
  `).bind(userId).first();
  
  if (!user) {
    return c.json({ error: 'Kullanıcı bulunamadı' }, 404);
  }
  return c.json(user);
});

app.post('/api/user/update', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  
  const userId = auth.user.user_id;
  const { full_name, institution, new_password } = await c.req.json();
  const db = c.env.DB;

  if (new_password) {
    if (new_password.length < 6) {
      return c.json({ error: 'Şifre en az 6 karakter olmalı' }, 400);
    }
    const password_hash = await hashPassword(new_password);
    await db.prepare(`
      UPDATE users SET full_name = ?, institution = ?, password_hash = ? WHERE id = ?
    `).bind(full_name || null, institution || null, password_hash, userId).run();
  } else {
    await db.prepare(`
      UPDATE users SET full_name = ?, institution = ? WHERE id = ?
    `).bind(full_name || null, institution || null, userId).run();
  }
  return c.json({ success: true });
});

app.delete('/api/user/delete', async (c) => {
  const auth = await requireAuth(c);
  if (auth.response) return auth.response;
  
  const userId = auth.user.user_id;
  const db = c.env.DB;
  
  await db.prepare(`DELETE FROM subscriptions WHERE user_id = ?`).bind(userId).run();
  await db.prepare(`DELETE FROM users WHERE id = ?`).bind(userId).run();
  
  // Cookie'yi de sil
  c.header('Set-Cookie', 'authToken=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict');
  
  return c.json({ success: true });
});

// ====================== ABONELİK ENDPOINT'LERİ ======================
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
  const db = c.env.DB;
  
  const subscriptions = await db.prepare(`
    SELECT id, product_slug, status, start_date, end_date, created_at
    FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC
  `).bind(userId).all();

  return c.json({ subscriptions: subscriptions.results });
});

// ====================== REGISTER (değişmedi) ======================
app.post('/api/auth/register', async (c) => {
  try {
    const { email, password, full_name, institution } = await c.req.json();
    const db = c.env.DB;

    if (!email || !password) {
      return c.json({ success: false, error: 'E-posta ve şifre zorunludur.' }, 400);
    }

    const password_hash = await hashPassword(password);

    await db.prepare(`
      INSERT INTO users (email, password_hash, full_name, institution, role)
      VALUES (?, ?, ?, ?, 'user')
    `).bind(email.toLowerCase().trim(), password_hash, full_name || null, institution || null).run();

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
              <p><b>Mesaj:</b> ${message || "-"}</p>
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

app.get('/api/admin/users', async (c) => {
  if (!await canListUsers(c)) return c.json({ error: 'Yetkisiz' }, 403);
  const db = c.env.DB;
  const role = await getUserRole(c);
  const institution = await getUserInstitution(c);
  
  let users;
  if (role === 'super_admin') {
    users = await db.prepare(`SELECT id, email, full_name, institution, role, created_at FROM users ORDER BY id DESC`).all();
  } else {
    users = await db.prepare(`SELECT id, email, full_name, institution, role, created_at FROM users WHERE institution = ? ORDER BY id DESC`).bind(institution).all();
  }
  return c.json(users.results);
});

app.post('/api/admin/user', async (c) => {
  if (!await isAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);
  const { email, password, full_name, institution, role } = await c.req.json();
  const db = c.env.DB;
  const adminRole = await getUserRole(c);
  const adminInstitution = await getUserInstitution(c);
  
  let finalInstitution = institution;
  if (adminRole === 'admin') {
    if (institution && institution !== adminInstitution) {
      return c.json({ error: 'Kendi kurumunuz dışında kullanıcı ekleyemezsiniz' }, 403);
    }
    finalInstitution = adminInstitution;
  }
  
  const finalRole = (role === 'admin' && adminRole !== 'super_admin') ? 'user' : (role || 'user');
  
  const password_hash = await hashPassword(password);  
  await db.prepare(`INSERT INTO users (email, password_hash, full_name, institution, role) VALUES (?, ?, ?, ?, ?)`).bind(email, password_hash, full_name, finalInstitution, finalRole).run();
  return c.json({ success: true });
});

app.put('/api/admin/user/:id', async (c) => {
  if (!await isAdmin(c)) return c.json({ error: 'Yetkisiz' }, 403);
  const id = c.req.param('id');
  const { email, password, full_name, institution, role } = await c.req.json();
  const db = c.env.DB;
  const adminRole = await getUserRole(c);
  const adminInstitution = await getUserInstitution(c);
  
  if (adminRole === 'admin' && !await canAccessUser(c, id)) {
    return c.json({ error: 'Sadece kendi kurumunuzdaki kullanıcıları düzenleyebilirsiniz' }, 403);
  }
  
  let finalInstitution = institution;
  if (adminRole === 'admin') {
    finalInstitution = adminInstitution;
  }
  
  const isSuper = adminRole === 'super_admin';
  const finalRole = (role && role !== 'user' && !isSuper) ? null : role;
  
  if (password) {
    const password_hash = await hashPassword(password);
    if (finalRole) {
      await db.prepare(`UPDATE users SET email=?, password_hash=?, full_name=?, institution=?, role=? WHERE id=?`).bind(email, password_hash, full_name, finalInstitution, finalRole, id).run();
    } else {
      await db.prepare(`UPDATE users SET email=?, password_hash=?, full_name=?, institution=? WHERE id=?`).bind(email, password_hash, full_name, finalInstitution, id).run();
    }
  } else {
    if (finalRole) {
      await db.prepare(`UPDATE users SET email=?, full_name=?, institution=?, role=? WHERE id=?`).bind(email, full_name, finalInstitution, finalRole, id).run();
    } else {
      await db.prepare(`UPDATE users SET email=?, full_name=?, institution=? WHERE id=?`).bind(email, full_name, finalInstitution, id).run();
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
  const institution = await getUserInstitution(c);
  
  let subs;
  if (role === 'super_admin') {
    subs = await db.prepare(`
      SELECT s.*, u.full_name as user_name, u.institution as user_institution 
      FROM subscriptions s LEFT JOIN users u ON s.user_id = u.id ORDER BY s.id DESC
    `).all();
  } else {
    subs = await db.prepare(`
      SELECT s.*, u.full_name as user_name, u.institution as user_institution 
      FROM subscriptions s LEFT JOIN users u ON s.user_id = u.id 
      WHERE u.institution = ? ORDER BY s.id DESC
    `).bind(institution).all();
  }
  return c.json(subs.results);
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

// ====================== KURUM DOSYA YÖNETİMİ ======================

app.get('/api/admin/institutions', async (c) => {
  if (!await isSuperAdmin(c)) return c.json({ error: 'Sadece Super Admin' }, 403);
  const db = c.env.DB;
  const institutions = await db.prepare(`
    SELECT id, name, domain, created_at,
      (SELECT COUNT(*) FROM users WHERE institution = name) as user_count,
      (SELECT COUNT(*) FROM institution_files WHERE institution_id = id AND is_active = 1) as file_count
    FROM institutions ORDER BY name
  `).all();
  return c.json(institutions.results);
});

app.get('/api/admin/all-files', async (c) => {
  if (!await isSuperAdmin(c)) return c.json({ error: 'Sadece Super Admin' }, 403);
  const db = c.env.DB;
  const files = await db.prepare(`
    SELECT f.*, u.full_name as uploaded_by_name, i.name as institution_name
    FROM institution_files f
    LEFT JOIN users u ON f.uploaded_by = u.id
    LEFT JOIN institutions i ON f.institution_id = i.id
    WHERE f.is_active = 1
    ORDER BY f.id DESC
  `).all();
  return c.json(files.results);
});

app.get('/api/institution/:id/files', async (c) => {
  const institutionId = c.req.param('id');
  const role = await getUserRole(c);
  const userInstitution = await getUserInstitutionId(c);
  
  const db = c.env.DB;
  
  let files;
  if (role === 'super_admin') {
    files = await db.prepare(`
      SELECT f.*, u.full_name as uploaded_by_name 
      FROM institution_files f 
      LEFT JOIN users u ON f.uploaded_by = u.id
      WHERE f.institution_id = ? AND f.is_active = 1 
      ORDER BY f.id DESC
    `).bind(institutionId).all();
  } else if (role === 'admin' && userInstitution == institutionId) {
    files = await db.prepare(`
      SELECT f.*, u.full_name as uploaded_by_name 
      FROM institution_files f 
      LEFT JOIN users u ON f.uploaded_by = u.id
      WHERE f.institution_id = ? AND f.is_active = 1 
      ORDER BY f.id DESC
    `).bind(institutionId).all();
  } else {
    files = await db.prepare(`
      SELECT f.*, u.full_name as uploaded_by_name 
      FROM institution_files f 
      LEFT JOIN users u ON f.uploaded_by = u.id
      WHERE f.institution_id = ? AND f.is_active = 1 AND f.is_public = 1
      ORDER BY f.id DESC
    `).bind(institutionId).all();
  }
  
  return c.json(files.results);
});

app.get('/api/institution/:id/folders', async (c) => {
  try {
    const institutionId = c.req.param('id');
    const parentId = c.req.query('parent') || null;
    const role = await getUserRole(c);
    const userInstitution = await getUserInstitutionId(c);
    
    console.log('Folders request:', { institutionId, parentId, role, userInstitution });
    
    const db = c.env.DB;
    
    const institutionExists = await db.prepare(`
      SELECT id, name FROM institutions WHERE name = ? OR id = ?
    `).bind(institutionId, institutionId).first();
    
    if (!institutionExists) {
      console.log('Institution not found:', institutionId);
      return c.json({ error: 'Kurum bulunamadı' }, 404);
    }
    
    if (!role) {
      let folders;
      const publicFilter = 'AND is_public = 1';
      
      if (parentId) {
        folders = await db.prepare(`
          SELECT f.*, COUNT(ff.id) as subfolder_count,
            (SELECT COUNT(*) FROM institution_files WHERE folder_id = f.id AND is_active = 1 ${publicFilter}) as file_count
          FROM institution_folders f
          LEFT JOIN institution_folders ff ON ff.parent_folder_id = f.id
          WHERE f.institution_id = ? AND f.parent_folder_id = ? AND f.is_public = 1
          GROUP BY f.id
          ORDER BY f.folder_name
        `).bind(institutionExists.id, parentId).all();
      } else {
        folders = await db.prepare(`
          SELECT f.*, COUNT(ff.id) as subfolder_count,
            (SELECT COUNT(*) FROM institution_files WHERE folder_id = f.id AND is_active = 1 ${publicFilter}) as file_count
          FROM institution_folders f
          LEFT JOIN institution_folders ff ON ff.parent_folder_id = f.id
          WHERE f.institution_id = ? AND f.parent_folder_id IS NULL AND f.is_public = 1
          GROUP BY f.id
          ORDER BY f.folder_name
        `).bind(institutionExists.id).all();
      }
      
      return c.json(folders.results || []);
    }
    
    if (role !== 'super_admin' && role !== 'admin' && role !== 'user') {
      return c.json({ error: 'Yetkisiz' }, 403);
    }
    
    let folders;
    if (role === 'super_admin' || (role === 'admin' && userInstitution === institutionExists.name)) {
      if (parentId) {
        folders = await db.prepare(`
          SELECT f.*, 
            (SELECT COUNT(*) FROM institution_folders WHERE parent_folder_id = f.id) as subfolder_count,
            (SELECT COUNT(*) FROM institution_files WHERE folder_id = f.id AND is_active = 1) as file_count
          FROM institution_folders f
          WHERE f.institution_id = ? AND f.parent_folder_id = ?
          ORDER BY f.folder_name
        `).bind(institutionExists.id, parentId).all();
      } else {
        folders = await db.prepare(`
          SELECT f.*, 
            (SELECT COUNT(*) FROM institution_folders WHERE parent_folder_id = f.id) as subfolder_count,
            (SELECT COUNT(*) FROM institution_files WHERE folder_id = f.id AND is_active = 1) as file_count
          FROM institution_folders f
          WHERE f.institution_id = ? AND f.parent_folder_id IS NULL
          ORDER BY f.folder_name
        `).bind(institutionExists.id).all();
      }
    } else {
      if (parentId) {
        folders = await db.prepare(`
          SELECT f.*, 
            (SELECT COUNT(*) FROM institution_folders WHERE parent_folder_id = f.id AND is_public = 1) as subfolder_count,
            (SELECT COUNT(*) FROM institution_files WHERE folder_id = f.id AND is_active = 1 AND is_public = 1) as file_count
          FROM institution_folders f
          WHERE f.institution_id = ? AND f.parent_folder_id = ? AND f.is_public = 1
          ORDER BY f.folder_name
        `).bind(institutionExists.id, parentId).all();
      } else {
        folders = await db.prepare(`
          SELECT f.*, 
            (SELECT COUNT(*) FROM institution_folders WHERE parent_folder_id = f.id AND is_public = 1) as subfolder_count,
            (SELECT COUNT(*) FROM institution_files WHERE folder_id = f.id AND is_active = 1 AND is_public = 1) as file_count
          FROM institution_folders f
          WHERE f.institution_id = ? AND f.parent_folder_id IS NULL AND f.is_public = 1
          ORDER BY f.folder_name
        `).bind(institutionExists.id).all();
      }
    }
    
    const result = (folders && folders.results) ? folders.results : (folders || []);
    return c.json(result);
    
  } catch (error) {
    console.error('Folders endpoint error:', error);
    return c.json({ 
      error: 'Klasörler yüklenirken bir hata oluştu', 
      details: error.message 
    }, 500);
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
    
    const userInstitution = await getUserInstitutionId(c);
    
    let files;
    if (role === 'super_admin' || (role === 'admin' && userInstitution === folder.institution_name)) {
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

export default app;