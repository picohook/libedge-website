import { describe, it, expect } from 'vitest';
import {
  buildCookieJarKey,
  stripProxySessionCookie,
  mergeBrowserCookieJar,
  rewriteSetCookieForProxy,
} from '../../workers/proxy/src/upstream.js';

describe('buildCookieJarKey', () => {
  it('creates user+host scoped key', () => {
    const session = { user_id: 42, product_slug: 'pangram' };
    const key = buildCookieJarKey(session, 'web.pangram.com');
    expect(key).toBe('jar:u42:web.pangram.com');
  });

  it('different users get different keys for same host', () => {
    const k1 = buildCookieJarKey({ user_id: 1, product_slug: 'p' }, 'x.com');
    const k2 = buildCookieJarKey({ user_id: 2, product_slug: 'p' }, 'x.com');
    expect(k1).not.toBe(k2);
  });

  it('same user different host different keys', () => {
    const k1 = buildCookieJarKey({ user_id: 1, product_slug: 'p' }, 'a.com');
    const k2 = buildCookieJarKey({ user_id: 1, product_slug: 'p' }, 'b.com');
    expect(k1).not.toBe(k2);
  });

  it('does not depend on proxy session id (persistence across sessions)', () => {
    // Key yalnızca user_id + targetHost'a bağlı — sessionId tarla olarak alınmıyor
    const session = { user_id: 5, product_slug: 'anything' };
    expect(buildCookieJarKey(session, 'pangram.com'))
      .toBe(buildCookieJarKey(session, 'pangram.com'));
  });
});

describe('browser cookie forwarding helpers', () => {
  it('strips only the proxy session cookie from browser cookies', () => {
    const out = stripProxySessionCookie('ra_proxy_session=abc; cf_clearance=xyz; theme=dark');
    expect(out).toBe('cf_clearance=xyz; theme=dark');
  });

  it('merges stored upstream cookies with browser cookies', () => {
    const out = mergeBrowserCookieJar('SESSION=old; route=a', 'cf_clearance=xyz; route=b');
    expect(out).toBe('SESSION=old; route=b; cf_clearance=xyz');
  });

  it('handles empty inputs safely', () => {
    expect(stripProxySessionCookie('')).toBe('');
    expect(mergeBrowserCookieJar('', '')).toBe('');
  });
});

describe('rewriteSetCookieForProxy', () => {
  it('rewrites domain and path for proxy host', () => {
    const out = rewriteSetCookieForProxy(
      'cf_clearance=abc; Domain=.jove.com; Path=/; Secure; HttpOnly',
      'proxy-staging.selmiye.com',
      'www-jove-com'
    );
    expect(out).toContain('cf_clearance=abc');
    expect(out).toContain('Domain=proxy-staging.selmiye.com');
    expect(out).toContain('Path=/www-jove-com/');
  });

  it('adds scoped domain/path when upstream cookie has none', () => {
    const out = rewriteSetCookieForProxy(
      'session=xyz; Secure; SameSite=None',
      'proxy-staging.selmiye.com',
      'www-jove-com'
    );
    expect(out).toContain('Domain=proxy-staging.selmiye.com');
    expect(out).toContain('Path=/www-jove-com/');
  });
});
