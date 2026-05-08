import { getCookie } from 'hono/cookie';
import { verify } from 'hono/jwt';

export async function requireAuth(c) {
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

export async function getOptionalAuth(c) {
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
