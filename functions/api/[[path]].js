export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  const targetUrl = `https://form-handler.agursel.workers.dev/api${url.pathname.replace('/api', '')}${url.search}`;

  const proxiedRequest = new Request(targetUrl, {
    method: request.method,
    headers: request.headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
  });

  const response = await fetch(proxiedRequest);

  // Cookie'yi same-origin olarak yeniden yaz
  const newHeaders = new Headers(response.headers);
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    newHeaders.set('set-cookie',
      setCookie
        .replace(/SameSite=None;?\s*/gi, 'SameSite=Lax; ')
        .replace(/;\s*Secure/gi, '')
    );
  }

  return new Response(response.body, {
    status: response.status,
    headers: newHeaders,
  });
}