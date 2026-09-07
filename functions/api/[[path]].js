export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const hostname = url.hostname;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
  const defaultWorkerBase = isLocal
    ? 'http://127.0.0.1:8787'
    : hostname === 'staging.libedge-website.pages.dev'
      ? 'https://libedge-api-staging.agursel.workers.dev'
      : hostname === 'libedge-website.pages.dev'
        ? 'https://libedge-api-prod.agursel.workers.dev'
        : '';
  const workerBase = env.WORKER_BASE_URL || defaultWorkerBase;
  if (!workerBase) {
    return new Response(JSON.stringify({
      error: 'WORKER_BASE_URL tanımlı değil. Lütfen Pages env değişkenini ayarlayın.',
      host: hostname,
      code: 500
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
  }
  const targetUrl = `${workerBase}/api${url.pathname.replace('/api', '')}${url.search}`;
  const headers = new Headers(request.headers);

  // Cookie''den token al, Authorization header''a taşı
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const tokenMatch = cookieHeader.match(/authToken=([^;]+)/);
    if (tokenMatch) {
      headers.set('Authorization', `Bearer ${tokenMatch[1]}`);
    }
  }

  let body = null;
  if (!['GET', 'HEAD'].includes(request.method)) {
    // arrayBuffer ile tamamen belleğe al - ReadableStream olarak iletmek
    // Pages Function'da multipart/form-data sınırlarını bozabilir.
    body = await request.arrayBuffer();
  }

  const response = await fetch(new Request(targetUrl, {
    method: request.method,
    headers,
    body,
  }));

  const contentType = response.headers.get('Content-Type') || '';
  const responseBody = /^(application\/json|text\/)/i.test(contentType)
    ? await response.arrayBuffer()
    : response.body;

  // new Headers(response.headers) merges duplicate set-cookie lines into one,
  // breaking browser cookie parsing. Pass the original Headers object to the
  // Response constructor so CF Workers copies all set-cookie entries individually,
  // then mutate only the CSP header on the resulting mutable Headers instance.
  const newResponse = new Response(responseBody, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
  newResponse.headers.set('Content-Security-Policy',
    "default-src 'self'; script-src 'self' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com; img-src 'self' https: data:; connect-src 'self' https://; frame-src 'self';"
  );

  return newResponse;
}
