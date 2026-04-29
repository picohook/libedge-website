import { describe, it, expect } from 'vitest';
import {
  buildCookieJarKey,
  stripProxySessionCookie,
  mergeBrowserCookieJar,
  rewriteSetCookieForProxy,
} from '../../workers/proxy/src/upstream.js';
import {
  buildUpstreamHeaders,
  stripSessionCookie,
  rewriteSessionHostSetCookie,
  rewriteClientContextHeader,
  rewriteSessionHostLocation,
  rewriteSessionHostLocationWithUpstreamCookie,
  rewriteSessionTextProxyUrls,
  rewriteCurrentHostUrls,
  decodeOidcStateSuffix,
  mergeSessionHostCookieJar,
  mergeSessionHostSetCookies,
} from '../../workers/proxy/src/index.js';

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

describe('session-host proxy cookie handling', () => {
  it('strips LibEdge control cookies before forwarding upstream', () => {
    const out = stripSessionCookie('ra_proxy_session=abc; __ra_upstream=sso.cas.org; cf_clearance=xyz; __cf_bm=bm; theme=dark');
    expect(out).toBe('cf_clearance=xyz; __cf_bm=bm; theme=dark');
  });

  it('forwards browser challenge cookies to the publisher', () => {
    const headers = buildUpstreamHeaders(new Headers({
      Cookie: 'ra_proxy_session=abc; cf_clearance=xyz; __cf_bm=bm',
      'User-Agent': 'Mozilla/5.0',
    }));

    expect(headers.get('Cookie')).toBe('cf_clearance=xyz; __cf_bm=bm');
    expect(headers.get('User-Agent')).toBe('Mozilla/5.0');
  });

  it('strips Cloudflare and forwarding headers before upstream requests', () => {
    const headers = buildUpstreamHeaders(new Headers({
      'CF-Connecting-IP': '203.0.113.1',
      'CF-Ray': 'abc',
      'X-Forwarded-For': '203.0.113.1',
      'X-Real-IP': '203.0.113.1',
      Accept: 'text/html',
    }));

    expect(headers.get('CF-Connecting-IP')).toBeNull();
    expect(headers.get('CF-Ray')).toBeNull();
    expect(headers.get('X-Forwarded-For')).toBeNull();
    expect(headers.get('X-Real-IP')).toBeNull();
    expect(headers.get('Accept')).toBe('text/html');
  });

  it('rewrites session-host Origin and Referer to the publisher origin', () => {
    const headers = buildUpstreamHeaders(new Headers({
      Origin: 'https://rabc1234.selmiye.com',
      Referer: 'https://rabc1234.selmiye.com/research/?x=1',
    }), {
      proxyHostname: 'rabc1234.selmiye.com',
      originHost: 'www.jove.com',
    });

    expect(headers.get('Origin')).toBe('https://www.jove.com');
    expect(headers.get('Referer')).toBe('https://www.jove.com/research/?x=1');
  });

  it('can force a desktop browser identity for publisher mobile redirects', () => {
    const headers = buildUpstreamHeaders(new Headers({
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      'Sec-CH-UA-Mobile': '?1',
      'Sec-CH-UA-Platform': '"iOS"',
      Accept: 'text/html',
    }), {
      forceDesktopUserAgent: true,
    });

    expect(headers.get('User-Agent')).toContain('Windows NT 10.0');
    expect(headers.get('Sec-CH-UA-Mobile')).toBe('?0');
    expect(headers.get('Sec-CH-UA-Platform')).toBe('"Windows"');
    expect(headers.get('Accept')).toBe('text/html');
  });

  it('adds a desktop user-agent when forced and the browser sent none', () => {
    const headers = buildUpstreamHeaders(new Headers({
      Accept: 'text/html',
    }), {
      forceDesktopUserAgent: true,
    });

    expect(headers.get('User-Agent')).toContain('Windows NT 10.0');
  });

  it('overrides Sec-Fetch-Site to none on document navigation (ACS Cloudflare bypass)', () => {
    const headers = buildUpstreamHeaders(new Headers({
      'Sec-Fetch-Site': 'cross-site',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-User': '?1',
      Accept: 'text/html,application/xhtml+xml',
    }));

    expect(headers.get('Sec-Fetch-Site')).toBe('none');
    expect(headers.get('Sec-Fetch-Mode')).toBe('navigate');
    expect(headers.get('Sec-Fetch-Dest')).toBe('document');
    expect(headers.get('Sec-Fetch-User')).toBe('?1');
    expect(headers.get('Upgrade-Insecure-Requests')).toBe('1');
    expect(headers.get('Accept-Language')).toContain('tr');
  });

  it('strips Referer on document navigation to avoid leaking proxy domain', () => {
    const headers = buildUpstreamHeaders(new Headers({
      'Sec-Fetch-Dest': 'document',
      Accept: 'text/html',
      Referer: 'https://r4u69546.selmiye.com/',
    }));

    expect(headers.has('Referer')).toBe(false);
  });

  it('preserves natural Sec-Fetch values on sub-resource (asset) requests', () => {
    const headers = buildUpstreamHeaders(new Headers({
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Dest': 'image',
      Accept: 'image/avif,image/webp,*/*',
    }));

    expect(headers.get('Sec-Fetch-Site')).toBe('same-origin');
    expect(headers.get('Sec-Fetch-Dest')).toBe('image');
    expect(headers.has('Upgrade-Insecure-Requests')).toBe(false);
  });

  it('rewrites path-proxy Referer by removing the encoded host prefix', () => {
    const out = rewriteClientContextHeader(
      'Referer',
      'https://proxy-staging.selmiye.com/www-jove-com/research/?x=1',
      {
        proxyHostname: 'proxy-staging.selmiye.com',
        originHost: 'www.jove.com',
        pathPrefix: '/www-jove-com',
      }
    );

    expect(out).toBe('https://www.jove.com/research/?x=1');
  });

  it('rewrites publisher cookies for the session subdomain without duplicate scope attrs', () => {
    const out = rewriteSessionHostSetCookie(
      'cf_clearance=abc; Domain=.jove.com; Path=/; Secure; HttpOnly; SameSite=None',
      'rabc1234.selmiye.com'
    );

    expect(out).toBe(
      'cf_clearance=abc; HttpOnly; SameSite=None; Domain=rabc1234.selmiye.com; Path=/; Secure'
    );
  });

  it('rewrites alternate session-host locations through the encoded host prefix', () => {
    const hosts = new Set(['www.emis.com', 'cas.emis.com', 'auth.emis.com']);
    const out = rewriteSessionHostLocation(
      'https://cas.emis.com/login?service=https%3A%2F%2Fwww.emis.com%2Fv2%2F',
      'rabc1234.selmiye.com',
      'www.emis.com',
      'www.emis.com',
      hosts
    );

    expect(out).toBe(
      'https://rabc1234.selmiye.com/__ra-host/cas-emis-com/login?service=https%3A%2F%2Fwww.emis.com%2Fv2%2F'
    );
  });

  it('keeps relative alternate-host redirects under the encoded host prefix', () => {
    const hosts = new Set(['www.emis.com', 'cas.emis.com']);
    const out = rewriteSessionHostLocation(
      '/login',
      'rabc1234.selmiye.com',
      'www.emis.com',
      'cas.emis.com',
      hosts
    );

    expect(out).toBe('/__ra-host/cas-emis-com/login');
  });

  it('rewrites allowlisted cross-origin redirects onto the session host and stores upstream host', () => {
    const hosts = new Set(['scifinder-n.cas.org', 'sso.cas.org']);
    const out = rewriteSessionHostLocationWithUpstreamCookie(
      'https://sso.cas.org/as/authorization.oauth2?redirect_uri=https%3A%2F%2Fscifinder-n.cas.org%2Fpa%2Foidc%2Fcb',
      'rabc1234.selmiye.com',
      'scifinder-n.cas.org',
      'scifinder-n.cas.org',
      hosts
    );

    expect(out.location).toBe(
      'https://rabc1234.selmiye.com/as/authorization.oauth2?redirect_uri=https%3A%2F%2Fscifinder-n.cas.org%2Fpa%2Foidc%2Fcb'
    );
    expect(out.upstreamCookie).toContain('__ra_upstream=sso.cas.org');
    expect(out.upstreamCookie).toContain('Domain=rabc1234.selmiye.com');
    expect(out.upstreamCookie).toContain('Path=/');
  });

  it('clears the upstream host cookie when redirecting back to the origin host', () => {
    const hosts = new Set(['scifinder-n.cas.org', 'sso.cas.org']);
    const out = rewriteSessionHostLocationWithUpstreamCookie(
      'https://scifinder-n.cas.org/pa/oidc/cb?code=abc',
      'rabc1234.selmiye.com',
      'scifinder-n.cas.org',
      'sso.cas.org',
      hosts
    );

    expect(out.location).toBe('https://rabc1234.selmiye.com/pa/oidc/cb?code=abc');
    expect(out.upstreamCookie).toContain('__ra_upstream=');
    expect(out.upstreamCookie).toContain('Max-Age=0');
  });

  it('keeps relative redirects on the current alternate upstream with the cookie', () => {
    const hosts = new Set(['scifinder-n.cas.org', 'sso.cas.org']);
    const out = rewriteSessionHostLocationWithUpstreamCookie(
      '/as/login',
      'rabc1234.selmiye.com',
      'scifinder-n.cas.org',
      'sso.cas.org',
      hosts
    );

    expect(out.location).toBe('/as/login');
    expect(out.upstreamCookie).toContain('__ra_upstream=sso.cas.org');
  });

  it('rewrites absolute URLs for the current cookie-selected upstream host', () => {
    const out = rewriteCurrentHostUrls(
      '<form action="https://sso.cas.org/as/login"><script src="//sso.cas.org/assets/app.js"></script>',
      'rabc1234.selmiye.com',
      'sso.cas.org'
    );

    expect(out).toContain('action="https://rabc1234.selmiye.com/as/login"');
    expect(out).toContain('src="//rabc1234.selmiye.com/assets/app.js"');
  });

  it('extracts the CAS OIDC state suffix for callback cookie diagnostics', () => {
    const out = decodeOidcStateSuffix(
      '?state=eyJ6aXAiOiJERUYiLCJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2Iiwia2lkIjoiX18xcU5MVDN2V000TEYxRUlpWFcyc0hKOFhjIiwic3VmZml4IjoiZVZzc0JDLjE3Nzc2NTU4MjIifQ..GZ78'
    );

    expect(out).toBe('eVssBC.1777655822');
  });

  it('merges stored session-host cookies before browser cookies', () => {
    const out = mergeSessionHostCookieJar(
      'nonce.abc=stored; PF=old',
      'PF=new; browser=yes'
    );

    expect(out).toBe('nonce.abc=stored; PF=new; browser=yes');
  });

  it('persists and expires upstream Set-Cookie values for session-host proxy', () => {
    const out = mergeSessionHostSetCookies(
      'nonce.old=keep; route=a',
      [
        'nonce.new=abc; Path=/; Secure; HttpOnly',
        'route=; Max-Age=0; Path=/',
      ]
    );

    expect(out).toBe('nonce.old=keep; nonce.new=abc');
  });

  it('rewrites EMIS mobile config origins through the session host proxy', () => {
    const hosts = new Set(['www.emis.com', 'm.emis.com']);
    const out = rewriteSessionTextProxyUrls(
      "apiUrl: 'https://m.emis.com/api/', emisProUrl: 'https://www.emis.com/php/', emisProPublicUrl: 'http://www.emis.com/', cookieDomain: '.emis.com'",
      'rabc1234.selmiye.com',
      'www.emis.com',
      hosts
    );

    expect(out).toContain("apiUrl: 'https://rabc1234.selmiye.com/__ra-host/m-emis-com/api/'");
    expect(out).toContain("emisProUrl: 'https://rabc1234.selmiye.com/php/'");
    expect(out).toContain("emisProPublicUrl: 'https://rabc1234.selmiye.com/'");
    expect(out).toContain("cookieDomain: 'rabc1234.selmiye.com'");
  });
});
