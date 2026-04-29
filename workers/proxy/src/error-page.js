export function htmlError(status, message) {
  const statusCode = Number(status);
  const safeStatus =
    Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599
      ? statusCode
      : 500;
  const portalUrl = 'https://selmiye.com/profile.html';
  const title =
    safeStatus >= 500
      ? 'Uzaktan erişim geçici olarak kullanılamıyor'
      : 'Uzaktan erişim devam edemedi';
  const body = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LibEdge Remote Access</title>
<style>
body{margin:0;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;background:#f4f6fb;color:#172033;display:grid;place-items:center;min-height:100vh;padding:24px}
main{width:min(560px,100%);background:#fff;border:1px solid #e6eaf2;border-radius:12px;box-shadow:0 16px 44px rgba(20,30,55,.12);padding:28px}
.brand{color:#220f60;font-weight:800;font-size:18px;margin-bottom:18px}
h1{font-size:22px;line-height:1.25;margin:0 0 12px;color:#111827}
p{line-height:1.55;margin:0 0 18px;color:#4b5563}
.code{display:inline-flex;align-items:center;border-radius:999px;background:#f1f5f9;color:#475569;font-size:12px;font-weight:700;padding:6px 10px;margin-bottom:18px}
a{display:inline-block;background:#220f60;color:#fff;text-decoration:none;border-radius:8px;padding:10px 14px;font-weight:700}
</style>
</head>
<body>
<main>
<div class="brand">LibEdge</div>
<div class="code">HTTP ${safeStatus}</div>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(message || 'Please return to the portal and try again.')}</p>
<a href="${portalUrl}">Return to portal</a>
</main>
</body>
</html>`;
  return new Response(body, {
    status: safeStatus,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
      'referrer-policy': 'no-referrer',
      'content-security-policy':
        "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    },
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
