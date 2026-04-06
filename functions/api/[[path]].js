export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const targetUrl = `https://form-handler.agursel.workers.dev/api${url.pathname.replace('/api', '')}${url.search}`;

  const headers = new Headers(request.headers);

  // Cookie'den token al, Authorization header'a taşı
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const tokenMatch = cookieHeader.match(/authToken=([^;]+)/);
    if (tokenMatch) {
      headers.set('Authorization', `Bearer ${tokenMatch[1]}`);
    }
  }

  let body = undefined;
  if (!['GET', 'HEAD'].includes(request.method)) {
    body = await request.arrayBuffer();
  }

  const response = await fetch(new Request(targetUrl, {
    method: request.method,
    headers,
    body,
  }));

  const newHeaders = new Headers(response.headers);
  newHeaders.delete('set-cookie');

  // Login: token'ı body'den al, cookie'ye taşı
  if (url.pathname.includes('/auth/login')) {
    const data = await response.json();
    if (data.token) {
      newHeaders.set('Set-Cookie',
        `authToken=${data.token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=900`
      );
    }
    return new Response(JSON.stringify({ success: data.success, user: data.user }), {
      status: response.status,
      headers: newHeaders,
    });
  }

  // Logout: cookie'yi sil
  if (url.pathname.includes('/auth/logout')) {
    newHeaders.set('Set-Cookie',
      `authToken=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
    );
    return new Response(response.body, { status: response.status, headers: newHeaders });
  }

  return new Response(response.body, { status: response.status, headers: newHeaders });
}