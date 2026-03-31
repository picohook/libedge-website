console.log("HONO VERSION LOADED");
import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// ====================== CORS AYARLARI (BASİTLEŞTİRİLDİ) ======================
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization']
}));

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

  return c.json({ 
    hasAccess: !!sub,
    status: sub ? sub.status : null 
  });
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
      INSERT INTO users (email, password_hash, full_name, institution)
      VALUES (?, ?, ?, ?)
    `).bind(email.toLowerCase().trim(), password_hash, full_name || null, institution || null).run();

    return c.json({ success: true, message: 'Kayıt başarılı! Şimdi giriş yapabilirsiniz.' });

  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return c.json({ success: false, error: 'Bu e-posta adresi zaten kayıtlı.' }, 409);
    }
    return c.json({ success: false, error: 'Kayıt sırasında hata oluştu.' }, 500);
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
      SELECT id, email, full_name, institution, role 
      FROM users WHERE email = ?
    `).bind(email.toLowerCase().trim()).first();

    if (!user) {
      return c.json({ success: false, error: 'E-posta veya şifre hatalı.' }, 401);
    }

    // Hash kontrolü için user'dan password_hash al
    const userWithHash = await db.prepare(`
      SELECT password_hash FROM users WHERE id = ?
    `).bind(user.id).first();
    
    if (userWithHash.password_hash !== password_hash) {
      return c.json({ success: false, error: 'E-posta veya şifre hatalı.' }, 401);
    }

    const tokenPayload = {
      user_id: user.id,
      email: user.email,
      full_name: user.full_name,
      institution: user.institution,
      exp: Date.now() + (7 * 24 * 60 * 60 * 1000)
    };

    const token = btoa(JSON.stringify(tokenPayload));

    return c.json({
      success: true,
      token: token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        institution: user.institution
      }
    });

  } catch (err) {
    console.error("Login error:", err);
    return c.json({ success: false, error: 'Giriş sırasında hata oluştu.' }, 500);
  }
});

export default app;