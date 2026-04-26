export function buildProxyLandingPath(rawLandingPath) {
  const raw = rawLandingPath ? String(rawLandingPath).trim() : '';
  if (!raw || raw === '/') return '/';
  return raw.startsWith('/') ? raw : `/${raw}`;
}
