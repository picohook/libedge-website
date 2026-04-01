console.log("HONO VERSION LOADED");
import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// ====================== CORS AYARLARI ======================
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization']
}));

// ====================== YARDIMCI FONKSİYONLAR (TEK BİR YERDE) ======================

async function getUserRole(c) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = JSON.parse(atob(token));
    if (decoded.exp < Date.now()) return null;
    return decoded.role || 'user';
  } catch(e) { return null; }
}

async function getUserInstitution(c) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = JSON.parse(atob(token));
    if (decoded.exp < Date.now()) return null;
    return decoded.institution || null;
  } catch(e) { return null; }
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
  if (role === 'super_admin') return true;
  if (role === 'admin') return true;
  return false;
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

app.post('/api/auth/login', async (c) => {
  try {
    const { email, password } = await c.req.json();
    const db = c.env.DB;

    // Password hash
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const password_hash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    // Kullanıcıyı bul - ROLE'Ü DE AL
    const user = await db.prepare(`
      SELECT id, email, full_name, institution, password_hash, role 
      FROM users WHERE email = ?
    `).bind(email.toLowerCase().trim()).first();

    if (!user || user.password_hash !== password_hash) {
      return c.json({ success: false, error: 'E-posta veya şifre hatalı.' }, 401);
    }

    // Token payload - ROLE EKLENDİ
    const tokenPayload = {
      user_id: user.id,
      email: user.email,
      full_name: user.full_name || "",
      institution: user.institution || "",
      role: user.role || "user",  // ← BURASI ÇOK ÖNEMLİ
      exp: Date.now() + (7 * 24 * 60 * 60 * 1000)
    };
    
    const jsonString = JSON.stringify(tokenPayload);
    const token = btoa(unescape(encodeURIComponent(jsonString)));

    return c.json({
      success: true,
      token: token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        institution: user.institution,
        role: user.role  // ← ROL'Ü DE DÖNDÜR
      }
    });

  } catch (err) {
    console.error("Login error:", err);
    return c.json({ success: false, error: err.message || 'Giriş sırasında hata oluştu.' }, 500);
  }
});

app.get('/api/subscription/check', async (c) => {
  const product = c.req.query('product');
  const authHeader = c.req.header('Authorization');

  if (!product) return c.json({ hasAccess: false, error: 'Product belirtilmedi.' }, 400);
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ hasAccess: false, message: 'Oturum açmanız gerekiyor.' }, 401);
  }

  const token = authHeader.split(' ')[1];
  let userId;

  try {
    const decoded = JSON.parse(atob(token));
    if (decoded.exp < Date.now()) throw new Error('Token expired');
    userId = decoded.user_id;
  } catch (e) {
    return c.json({ hasAccess: false, message: 'Geçersiz token.' }, 401);
  }

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
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Yetkilendirme gerekli' }, 401);
  }

  const token = authHeader.split(' ')[1];
  let userId;

  try {
    const decoded = JSON.parse(atob(token));
    if (decoded.exp < Date.now()) throw new Error('Token expired');
    userId = decoded.user_id;
  } catch (e) {
    return c.json({ error: 'Geçersiz token' }, 401);
  }

  const db = c.env.DB;
  const subscriptions = await db.prepare(`
    SELECT id, product_slug, status, start_date, end_date, created_at
    FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC
  `).bind(userId).all();

  return c.json({ subscriptions: subscriptions.results });
});

// ====================== POST ENDPOINT'LERİ ======================
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

app.post('/api/auth/login', async (c) => {
  try {
    const { email, password } = await c.req.json();
    const db = c.env.DB;

    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const password_hash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    const user = await db.prepare(`
      SELECT id, email, full_name, institution, password_hash, role 
      FROM users WHERE email = ?
    `).bind(email.toLowerCase().trim()).first();

    if (!user || user.password_hash !== password_hash) {
      return c.json({ success: false, error: 'E-posta veya şifre hatalı.' }, 401);
    }

    const tokenPayload = {
      user_id: user.id,
      email: user.email,
      full_name: user.full_name || "",
      institution: user.institution || "",
      role: user.role || "user",
      exp: Date.now() + (7 * 24 * 60 * 60 * 1000)
    };
    
    const jsonString = JSON.stringify(tokenPayload);
    const token = btoa(unescape(encodeURIComponent(jsonString)));

    return c.json({
      success: true,
      token: token,
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

app.post('/api/auth/register', async (c) => {
  try {
    const { email, password, full_name, institution } = await c.req.json();
    const db = c.env.DB;

    if (!email || !password) {
      return c.json({ success: false, error: 'E-posta ve şifre zorunludur.' }, 400);
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const password_hash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');

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

app.get('/api/user/profile', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Yetkilendirme gerekli' }, 401);
  }
  const token = authHeader.split(' ')[1];
  let userId;
  try {
    const decoded = JSON.parse(atob(token));
    if (decoded.exp < Date.now()) throw new Error('Token expired');
    userId = decoded.user_id;
  } catch (e) {
    return c.json({ error: 'Geçersiz token' }, 401);
  }
  const db = c.env.DB;
  const user = await db.prepare(`
    SELECT id, email, full_name, institution, created_at FROM users WHERE id = ?
  `).bind(userId).first();
  if (!user) {
    return c.json({ error: 'Kullanıcı bulunamadı' }, 404);
  }
  return c.json(user);
});

app.post('/api/user/update', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Yetkilendirme gerekli' }, 401);
  }
  const token = authHeader.split(' ')[1];
  let userId;
  try {
    const decoded = JSON.parse(atob(token));
    if (decoded.exp < Date.now()) throw new Error('Token expired');
    userId = decoded.user_id;
  } catch (e) {
    return c.json({ error: 'Geçersiz token' }, 401);
  }
  const { full_name, institution, new_password } = await c.req.json();
  const db = c.env.DB;

  if (new_password && new_password.length >= 6) {
    const encoder = new TextEncoder();
    const data = encoder.encode(new_password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const password_hash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');
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
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Yetkilendirme gerekli' }, 401);
  }
  const token = authHeader.split(' ')[1];
  let userId;
  try {
    const decoded = JSON.parse(atob(token));
    if (decoded.exp < Date.now()) throw new Error('Token expired');
    userId = decoded.user_id;
  } catch (e) {
    return c.json({ error: 'Geçersiz token' }, 401);
  }
  const db = c.env.DB;
  await db.prepare(`DELETE FROM subscriptions WHERE user_id = ?`).bind(userId).run();
  await db.prepare(`DELETE FROM users WHERE id = ?`).bind(userId).run();
  return c.json({ success: true });
});

// ====================== ADMIN ENDPOINT'LERİ (KURUM BAZLI) ======================

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
  
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password));
  const password_hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2,'0')).join('');
  
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
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password));
    const password_hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2,'0')).join('');
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
  const authHeader = c.req.header('Authorization');
  const token = authHeader.split(' ')[1];
  const decoded = JSON.parse(atob(token));
  const adminRole = await getUserRole(c);
  
  if (adminRole === 'admin' && !await canAccessUser(c, id)) {
    return c.json({ error: 'Sadece kendi kurumunuzdaki kullanıcıları silebilirsiniz' }, 403);
  }
  
  if (decoded.user_id == id && adminRole === 'super_admin') {
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

export default app;

// ====================== KURUM KLASÖR YÖNETİMİ ======================

// Klasörleri listele
app.get('/api/institution/:id/folders', async (c) => {
  const institutionId = c.req.param('id');
  const parentId = c.req.query('parent') || null;
  const role = await getUserRole(c);
  const userInstitution = await getUserInstitution(c);
  
  if (role !== 'super_admin' && (role !== 'admin' || userInstitution != institutionId)) {
    return c.json({ error: 'Yetkisiz' }, 403);
  }
  
  const db = c.env.DB;
  let folders;
  if (parentId) {
    folders = await db.prepare(`
      SELECT f.*, COUNT(ff.id) as subfolder_count,
        (SELECT COUNT(*) FROM institution_files WHERE folder_id = f.id AND is_active = 1) as file_count
      FROM institution_folders f
      LEFT JOIN institution_folders ff ON ff.parent_folder_id = f.id
      WHERE f.institution_id = ? AND f.parent_folder_id = ?
      GROUP BY f.id
      ORDER BY f.folder_name
    `).bind(institutionId, parentId).all();
  } else {
    folders = await db.prepare(`
      SELECT f.*, COUNT(ff.id) as subfolder_count,
        (SELECT COUNT(*) FROM institution_files WHERE folder_id = f.id AND is_active = 1) as file_count
      FROM institution_folders f
      LEFT JOIN institution_folders ff ON ff.parent_folder_id = f.id
      WHERE f.institution_id = ? AND f.parent_folder_id IS NULL
      GROUP BY f.id
      ORDER BY f.folder_name
    `).bind(institutionId).all();
  }
  
  return c.json(folders.results);
});

// Klasör oluştur
app.post('/api/institution/:id/folder', async (c) => {
  const institutionId = c.req.param('id');
  const { folder_name, parent_folder_id } = await c.req.json();
  const role = await getUserRole(c);
  const userInstitution = await getUserInstitution(c);
  const authHeader = c.req.header('Authorization');
  const token = authHeader.split(' ')[1];
  const decoded = JSON.parse(atob(token));
  
  if (role !== 'super_admin' && (role !== 'admin' || userInstitution != institutionId)) {
    return c.json({ error: 'Yetkisiz' }, 403);
  }
  
  const db = c.env.DB;
  
  try {
    await db.prepare(`
      INSERT INTO institution_folders (institution_id, folder_name, parent_folder_id, created_by)
      VALUES (?, ?, ?, ?)
    `).bind(institutionId, folder_name, parent_folder_id || null, decoded.user_id).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: 'Aynı isimde klasör zaten var' }, 400);
  }
});

// Klasör sil (içindeki dosyalar ve alt klasörler de silinir)
app.delete('/api/institution/folder/:id', async (c) => {
  const folderId = c.req.param('id');
  const role = await getUserRole(c);
  const userInstitution = await getUserInstitution(c);
  const db = c.env.DB;
  
  const folder = await db.prepare(`SELECT institution_id FROM institution_folders WHERE id = ?`).bind(folderId).first();
  if (!folder) return c.json({ error: 'Klasör bulunamadı' }, 404);
  
  if (role !== 'super_admin' && (role !== 'admin' || userInstitution != folder.institution_id)) {
    return c.json({ error: 'Yetkisiz' }, 403);
  }
  
  // Önce alt klasörleri ve dosyaları sil
  await db.prepare(`DELETE FROM institution_files WHERE folder_id IN (SELECT id FROM institution_folders WHERE id = ? OR parent_folder_id = ?)`).bind(folderId, folderId).run();
  await db.prepare(`DELETE FROM institution_folders WHERE id = ? OR parent_folder_id = ?`).bind(folderId, folderId).run();
  
  return c.json({ success: true });
});

// Dosya ekle (klasör ID ile)
app.post('/api/institution/:id/file', async (c) => {
  const institutionId = c.req.param('id');
  const { file_name, file_url, file_type, file_size, category, folder_id } = await c.req.json();
  const role = await getUserRole(c);
  const userInstitution = await getUserInstitution(c);
  const authHeader = c.req.header('Authorization');
  const token = authHeader.split(' ')[1];
  const decoded = JSON.parse(atob(token));
  
  if (role !== 'super_admin' && (role !== 'admin' || userInstitution != institutionId)) {
    return c.json({ error: 'Yetkisiz' }, 403);
  }
  
  const db = c.env.DB;
  await db.prepare(`
    INSERT INTO institution_files (institution_id, file_name, file_url, file_type, file_size, category, folder_id, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(institutionId, file_name, file_url, file_type, file_size, category, folder_id || null, decoded.user_id).run();
  
  return c.json({ success: true });
});

// Klasördeki dosyaları listele
app.get('/api/institution/folder/:id/files', async (c) => {
  const folderId = c.req.param('id');
  const role = await getUserRole(c);
  const db = c.env.DB;
  
  const folder = await db.prepare(`SELECT institution_id FROM institution_folders WHERE id = ?`).bind(folderId).first();
  if (!folder) return c.json({ error: 'Klasör bulunamadı' }, 404);
  
  const userInstitution = await getUserInstitution(c);
  if (role !== 'super_admin' && (role !== 'admin' || userInstitution != folder.institution_id)) {
    return c.json({ error: 'Yetkisiz' }, 403);
  }
  
  const files = await db.prepare(`
    SELECT f.*, u.full_name as uploaded_by_name 
    FROM institution_files f 
    LEFT JOIN users u ON f.uploaded_by = u.id
    WHERE f.folder_id = ? AND f.is_active = 1 
    ORDER BY f.id DESC
  `).bind(folderId).all();
  
  return c.json(files.results);
});