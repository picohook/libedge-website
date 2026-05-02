export function buildProxyLandingPath(rawLandingPath) {
  const raw = rawLandingPath ? String(rawLandingPath).trim() : '';
  if (!raw || raw === '/') return '/';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

export async function stableProxyHostLabel(productSlug, originHost) {
  const input = `${String(productSlug || '').trim().toLowerCase()}|${String(originHost || '').trim().toLowerCase()}`;
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
