export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  // Never silently fall back to staging in live traffic.
  const workerBase = env.WORKER_BASE_URL || 'https://form-handler.agursel.workers.dev';
  const targetUrl = `${workerBase}/api${url.pathname.replace('/api', '')}${url.search}`;
  const headers = new Headers(request.headers);

  // Cookie'den token al, Authorization header'a taşı
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const tokenMatch = cookieHeader.match(/authToken=([^;]+)/);
    if (tokenMatch) {
      headers.set('Authorization', `Bearer ${tokenMatch[1]}`);
    }
  }

  const body = !['GET', 'HEAD'].includes(request.method) ? request.body : null;

  const response = await fetch(new Request(targetUrl, {
    method: request.method,
    headers,
    body,
  }));

  // Backend cookie'lerini (authToken + refreshToken) olduğu gibi geçir.
  // Proxy cookie yönetimine karışmıyor — set-cookie silinmiyor.
  const newHeaders = new Headers(response.headers);
  newHeaders.set('Content-Security-Policy',
    "default-src 'self'; script-src 'self' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com; img-src 'self' https: data:; connect-src 'self' https://; frame-src 'self';"
  );

  return new Response(response.body, { status: response.status, headers: newHeaders });
}
