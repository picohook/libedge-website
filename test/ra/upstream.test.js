import { describe, it, expect } from 'vitest';
import {
  buildCookieJarKey,
  stripProxySessionCookie,
  mergeBrowserCookieJar,
  rewriteSetCookieForProxy,
} from '../../workers/proxy/src/upstream.js';
import {
  buildUpstreamHeaders,
  buildSessionHostResponseHeaders,
  stripSessionCookie,
  rewriteSessionHostSetCookie,
  rewriteClientContextHeader,
  rewriteSessionHostLocation,
  rewriteSessionHostLocationWithUpstreamCookie,
  rewriteQueryProxyUrls,
  rewriteSessionTextProxyUrls,
  rewriteCloudflareChallengePaths,
  rewriteCloudflareChallengeRuntimeLocation,
  shouldRewritePublisherTextBody,
  rewritePublisherHostJavaScriptText,
  rewriteCurrentHostUrls,
  relaxProxyMetaContentSecurityPolicy,
  injectPublisherCookieNamespaceScript,
  injectSessionHostLinkProxyScript,
  injectSessionHostFullTextProxyRuntime,
  clearPublisherClearanceOnChallenge,
  decodeOidcStateSuffix,
  mergeSessionHostCookieJar,
  mergeSessionHostSetCookies,
  rewritePublisherCookieHeaderForUpstream,
  ensurePublisherScopedCookiesForwarded,
  webOfScienceFailureFallbackResponse,
  proQuestFailureFallbackResponse,
  webOfScienceDynamicRedirectHost,
  scienceDirectDynamicRedirectHost,
  shouldRouteSessionPathToOrigin,
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

  it('drops publisher-namespaced cookies when the current product has no namespace', () => {
    const headers = buildUpstreamHeaders(new Headers({
      Cookie: '__cp_emerald.com|__cf_bm=emerald; JSESSIONID=iop; theme=dark',
    }));

    expect(headers.get('Cookie')).toBe('JSESSIONID=iop; theme=dark');
  });

  it('converts publisher-namespaced cookies before forwarding upstream', () => {
    const headers = buildUpstreamHeaders(new Headers({
      Cookie: [
        'ra_proxy_session=abc',
        '__cp_emerald.com|cf_clearance=ok',
        '__cp_emerald.com|EMER_SessionId=sid',
        '__cp_nejm.org|cf_clearance=other',
        'theme=dark',
      ].join('; '),
    }), {
      publisherCookieScopeHost: 'emerald.com',
    });

    expect(headers.get('Cookie')).toBe('cf_clearance=ok; EMER_SessionId=sid; theme=dark');
  });

  it('lets a matching namespaced publisher cookie override the raw browser cookie', () => {
    const headers = buildUpstreamHeaders(new Headers({
      Cookie: 'cf_clearance=stale; __cp_emerald.com|cf_clearance=fresh',
    }), {
      publisherCookieScopeHost: 'emerald.com',
    });

    expect(headers.get('Cookie')).toBe('cf_clearance=fresh');
  });

  it('uses raw Cloudflare clearance as a fallback for namespaced WAF publishers', () => {
    const headers = buildUpstreamHeaders(new Headers({
      Cookie: 'cf_clearance=stale; __cf_bm=raw; __cp_emerald.com|__cf_bm=scoped; theme=dark',
    }), {
      publisherCookieScopeHost: 'emerald.com',
    });

    expect(headers.get('Cookie')).toBe('cf_clearance=stale; __cf_bm=scoped; theme=dark');
  });

  it('strips Cloudflare challenge runtime cookies for namespaced WAF publishers', () => {
    const headers = buildUpstreamHeaders(new Headers({
      Cookie: 'cf_chl_rc_ni=1; __cp_emerald.com|__cf_bm=scoped; theme=dark',
    }), {
      publisherCookieScopeHost: 'emerald.com',
    });

    expect(headers.get('Cookie')).toBe('__cf_bm=scoped; theme=dark');
  });

  it('forwards Cloudflare challenge runtime cookies to challenge endpoints', () => {
    const headers = buildUpstreamHeaders(new Headers({
      Cookie: 'cf_chl_rc_ni=1; __cp_emerald.com|__cf_bm=scoped; theme=dark',
    }), {
      publisherCookieScopeHost: 'emerald.com',
      targetPath: '/cdn-cgi/challenge-platform/h/g/flow/ov1/token',
    });

    expect(headers.get('Cookie')).toBe('cf_chl_rc_ni=1; __cf_bm=scoped; theme=dark');
  });

  it('forwards scoped clearance while a Cloudflare challenge runtime cookie is present', () => {
    const headers = buildUpstreamHeaders(new Headers({
      Cookie: [
        'cf_chl_rc_ni=1',
        '__cp_emerald.com|cf_clearance=possibly-stale',
        '__cp_emerald.com|__cf_bm=scoped',
        'theme=dark',
      ].join('; '),
    }), {
      publisherCookieScopeHost: 'emerald.com',
    });

    expect(headers.get('Cookie')).toBe('cf_clearance=possibly-stale; __cf_bm=scoped; theme=dark');
  });

  it('still forwards clearance on challenge endpoints while forwarding runtime cookies', () => {
    const headers = buildUpstreamHeaders(new Headers({
      Cookie: [
        'cf_chl_rc_ni=1',
        '__cp_emerald.com|cf_clearance=possibly-stale',
        '__cp_emerald.com|__cf_bm=scoped',
        'theme=dark',
      ].join('; '),
    }), {
      publisherCookieScopeHost: 'emerald.com',
      targetPath: '/cdn-cgi/challenge-platform/h/g/flow/ov1/token',
    });

    expect(headers.get('Cookie')).toBe('cf_chl_rc_ni=1; cf_clearance=possibly-stale; __cf_bm=scoped; theme=dark');
  });

  it('rewritePublisherCookieHeaderForUpstream forwards cf_chl_* when allowCloudflareChallengeRuntimeCookies is true', () => {
    const result = rewritePublisherCookieHeaderForUpstream(
      'cf_chl_rc_ni=1; __cf_bm=bm; apt.sid=s',
      'emerald.com',
      { allowCloudflareChallengeRuntimeCookies: true }
    );
    expect(result).toContain('cf_chl_rc_ni=1');
  });

  it('rewritePublisherCookieHeaderForUpstream strips cf_chl_* by default (non-challenge path)', () => {
    const result = rewritePublisherCookieHeaderForUpstream(
      'cf_chl_rc_ni=1; apt.sid=s',
      'emerald.com'
    );
    expect(result).not.toContain('cf_chl_rc_ni');
    expect(result).toContain('apt.sid=s');
  });

  it('full cookie preparation sequence forwards cf_chl_rc_ni for challenge-platform path', () => {
    // Simulate what the handler does: buildUpstreamHeaders already strips ra_proxy_session,
    // so mergeSessionHostCookieJar receives the pre-stripped cookie string.
    const strippedBrowserCookie = stripSessionCookie([
      'cf_chl_rc_ni=runtime-val',
      '__cp_emerald.com|__cf_bm=scoped-bm',
      'ra_proxy_session=sess',
    ].join('; '));

    const allowCfChl = { allowCloudflareChallengeRuntimeCookies: true };
    const scopeHost = 'emerald.com';

    let effective = mergeSessionHostCookieJar('', strippedBrowserCookie);
    effective = rewritePublisherCookieHeaderForUpstream(effective, scopeHost, allowCfChl);
    effective = ensurePublisherScopedCookiesForwarded(effective, strippedBrowserCookie, scopeHost, allowCfChl);

    expect(effective).toContain('cf_chl_rc_ni=runtime-val');
    expect(effective).toContain('__cf_bm=scoped-bm');
    expect(effective).not.toContain('ra_proxy_session');
  });

  it('full cookie preparation sequence strips cf_chl_rc_ni for normal publisher path', () => {
    const strippedBrowserCookie = stripSessionCookie([
      'cf_chl_rc_ni=runtime-val',
      '__cp_emerald.com|__cf_bm=scoped-bm',
      'ra_proxy_session=sess',
    ].join('; '));

    const allowCfChl = { allowCloudflareChallengeRuntimeCookies: false };
    const scopeHost = 'emerald.com';

    let effective = mergeSessionHostCookieJar('', strippedBrowserCookie);
    effective = rewritePublisherCookieHeaderForUpstream(effective, scopeHost, allowCfChl);
    effective = ensurePublisherScopedCookiesForwarded(effective, strippedBrowserCookie, scopeHost, allowCfChl);

    expect(effective).not.toContain('cf_chl_rc_ni');
    expect(effective).toContain('__cf_bm=scoped-bm');
  });

  it('drops tracking cookies for namespaced WAF publishers', () => {
    const headers = buildUpstreamHeaders(new Headers({
      Cookie: [
        '_ga=ga',
        '_ga_3KB7RE25QT=ga2',
        '__gtm_referrer=https%3A%2F%2Fstaging.libedge-website.pages.dev%2F',
        '_fbp=fb',
        '__cp_emerald.com|cf_clearance=clear',
        '__cp_emerald.com|__cf_bm=bm',
        'EMER_SessionId=sid',
      ].join('; '),
    }), {
      publisherCookieScopeHost: 'emerald.com',
    });

    expect(headers.get('Cookie')).toBe('cf_clearance=clear; __cf_bm=bm; EMER_SessionId=sid');
  });

  it('forwards namespaced Cloudflare bot cookies only with a matching clearance cookie', () => {
    const headers = buildUpstreamHeaders(new Headers({
      Cookie: '__cp_emerald.com|cf_clearance=ok; __cp_emerald.com|__cf_bm=scoped',
    }), {
      publisherCookieScopeHost: 'emerald.com',
    });

    expect(headers.get('Cookie')).toBe('cf_clearance=ok; __cf_bm=scoped');
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

  it('rewrites Referer on namespace document navigation for WAF-sensitive publishers', () => {
    const headers = buildUpstreamHeaders(new Headers({
      'Sec-Fetch-Dest': 'document',
      Accept: 'text/html',
      Referer: 'https://r4u69546.selmiye.com/__ra-redirect?to=%2F',
    }), {
      proxyHostname: 'r4u69546.selmiye.com',
      originHost: 'www.emerald.com',
      publisherCookieScopeHost: 'emerald.com',
    });

    expect(headers.get('Referer')).toBe('https://www.emerald.com/__ra-redirect?to=%2F');
  });

  it('normalizes external portal Referer on namespace document navigation', () => {
    const headers = buildUpstreamHeaders(new Headers({
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Site': 'cross-site',
      Accept: 'text/html',
      Referer: 'https://staging.libedge-website.pages.dev/',
    }), {
      proxyHostname: 'r4u69546.selmiye.com',
      originHost: 'www.emerald.com',
      publisherCookieScopeHost: 'emerald.com',
    });

    expect(headers.get('Referer')).toBe('https://www.emerald.com/');
    expect(headers.get('Sec-Fetch-Site')).toBe('same-origin');
  });

  it('normalizes stable entry redirect Referer to the final publisher path', () => {
    const headers = buildUpstreamHeaders(new Headers({
      'Sec-Fetch-Dest': 'document',
      Accept: 'text/html',
      Referer: 'https://3010836a0478e29e647497fafec3209d16e8c585.selmiye.com/coproxy/redirect?redirectUrl=https%3A%2F%2F3010836a0478e29e647497fafec3209d16e8c585.selmiye.com%2Finsight%2F',
    }), {
      proxyHostname: '3010836a0478e29e647497fafec3209d16e8c585.selmiye.com',
      originHost: 'www.emerald.com',
      publisherCookieScopeHost: 'emerald.com',
    });

    expect(headers.get('Referer')).toBe('https://www.emerald.com/insight/');
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

  it('rewrites selected publisher cookies with a namespaced parent-domain name', () => {
    const out = rewriteSessionHostSetCookie(
      'cf_clearance=abc; Domain=.emerald.com; Path=/; Secure; HttpOnly; SameSite=None',
      'rabc1234.selmiye.com',
      {
        publisherCookieScopeHost: 'emerald.com',
        publisherCookieDomain: 'selmiye.com',
      }
    );

    expect(out).toBe(
      '__cp_emerald.com|cf_clearance=abc; HttpOnly; SameSite=None; Domain=selmiye.com; Path=/; Secure'
    );
  });

  it('removes HTML meta CSP tags that block publisher challenge scripts', () => {
    const html = [
      '<html><head>',
      '<meta http-equiv="Content-Security-Policy" content="script-src https://challenges.cloudflare.com">',
      '<meta name="viewport" content="width=device-width">',
      '</head><body></body></html>',
    ].join('');

    const out = relaxProxyMetaContentSecurityPolicy(html);
    expect(out).not.toContain('Content-Security-Policy');
    expect(out).toContain('name="viewport"');
  });

  it('injects publisher cookie namespacing before challenge scripts', () => {
    const html = '<html><head><script src="/cdn-cgi/challenge-platform/x.js"></script></head><body></body></html>';
    const out = injectPublisherCookieNamespaceScript(html, 'emerald.com', 'www.emerald.com', true);

    expect(out).toContain('__raPublisherCookieNamespace');
    expect(out).toContain('__raPublisherLocation');
    expect(out).toContain('__ra-client-debug');
    expect(out).toContain("dbgurl('fetch'");
    expect(out).toContain("dbgurl('append'");
    expect(out).toContain("dbg('cookie-set',n)");
    expect(out).toContain("var fixu=function(u)");
    expect(out).toContain("arguments[1]=fixu(u)");
    expect(out).toContain("i=fixu(i)");
    expect(out).toContain('www.emerald.com');
    expect(out.indexOf('__raPublisherCookieNamespace')).toBeLessThan(out.indexOf('/cdn-cgi/challenge-platform'));
    expect(out).toContain('__cp_');
    expect(out).toContain('domain=[^;]');
    expect(out).toContain("n.indexOf('cf_chl_')===0");
    expect(out).toContain('scoped[n]');
    expect(out).toContain('if(scoped[n])return false');
    expect(out).toContain('publisherDomain');
    expect(out).toContain("domains['.'+scope]=1");
    expect(out).toContain('OptanonConsent');
    expect(out).toContain('OptanonAlertBoxClosed');
    expect(out).toContain('localStorage.setItem');
    expect(out).toContain('recall(parts,seen)');
    expect(out).toContain('#onetrust-accept-btn-handler');
    expect(out).toContain('stopImmediatePropagation');
    expect(out).toContain('OptanonAlertBoxClosed');
    expect(out).toContain('onetrust-banner-sdk');
    expect(injectPublisherCookieNamespaceScript(out, 'emerald.com')).toBe(out);
  });

  it('preserves Cloudflare challenge cookies on challenge responses', () => {
    const headers = new Headers();
    const upstreamResp = new Response('', {
      status: 403,
      headers: { 'cf-mitigated': 'challenge' },
    });

    clearPublisherClearanceOnChallenge(
      headers,
      upstreamResp,
      'emerald.com',
      'selmiye.com',
      '/insight/'
    );

    const cookies = headers.getSetCookie();
    expect(cookies).not.toContain('cf_clearance=; Path=/; Secure; SameSite=Lax; Max-Age=0');
    expect(cookies).not.toContain('cf_chl_rc_ni=; Path=/insight/; Secure; SameSite=Lax; Max-Age=0');
    expect(cookies).not.toContain('__cp_emerald.com|cf_clearance=; Domain=selmiye.com; Path=/insight/; Secure; SameSite=Lax; Max-Age=0');
    expect(cookies).toHaveLength(0);
  });

  it('strips X-Requested-With before forwarding to upstream', () => {
    const headers = new Headers({
      'X-Requested-With': 'XMLHttpRequest',
      Accept: 'text/html',
    });
    const out = buildUpstreamHeaders(headers, {
      proxyHostname: 'rabc1234.selmiye.com',
      originHost: 'www.cambridge.org',
      targetPath: '/core',
    });

    expect(out.has('X-Requested-With')).toBe(false);
    expect(out.has('x-requested-with')).toBe(false);
  });

  it('forwards WoS session auth while stripping proxy/bot artifacts', () => {
    const headers = new Headers({
      'X-1P-WOS-SID': 'session',
      'X-1P-WOS-No-Action': '1',
      AWSEnv: 'prod',
      ak_bmsc: 'akamai',
      bm_sv: 'akamai',
      bm_mi: 'akamai',
      bm_sz: 'akamai',
      _abck: 'akamai',
      Accept: 'text/html',
    });
    const out = buildUpstreamHeaders(headers, {
      proxyHostname: 'rabc1234.selmiye.com',
      originHost: 'www.webofscience.com',
      targetPath: '/',
    });

    expect(out.get('Accept')).toBe('text/html');
    expect(out.get('X-1P-WOS-SID')).toBe('session');
    for (const name of ['X-1P-WOS-No-Action', 'AWSEnv', 'ak_bmsc', 'bm_sv', 'bm_mi', 'bm_sz', '_abck']) {
      expect(out.has(name)).toBe(false);
      expect(out.has(name.toLowerCase())).toBe(false);
    }
  });

  it('turns failing WoS SignalR HTTP fallback into a close frame', async () => {
    const out = webOfScienceFailureFallbackResponse(
      { host: 'www.webofscience.com', path: '/api/wosnxcorews' },
      new Response('authorization failed', { status: 403 })
    );

    expect(out.status).toBe(200);
    expect(out.headers.get('Content-Type')).toBe('application/json');
    expect(out.headers.get('Cache-Control')).toBe('no-store');
    expect(await out.text()).toBe('{"type":7}\x1e');
  });

  it('allows WoS product context to handle ESTI fallbacks without third-party domain matching', async () => {
    const out = webOfScienceFailureFallbackResponse(
      { host: 'custom-access.example.edu', path: '/api/esti/Chat/history' },
      new Response('Server.authorization', { status: 403 }),
      { productSlug: 'web-of-science' }
    );

    expect(out.status).toBe(200);
    expect(await out.text()).toBe('[]');
  });

  it('rewrites Cloudflare challenge paths away from reserved /cdn-cgi', () => {
    const input = [
      `a.src = '/cdn-cgi/challenge-platform/h/g/orchestrate/chl_page/v1?ray=abc';`,
      `navigator.sendBeacon('/cdn-cgi/rum?', body);`,
      `b.src = "/cdn-cgi/challenge-platform/x";`,
      String.raw`c.src = "\/cdn-cgi\/challenge-platform\/y";`,
      String.raw`d.src = "\u002fcdn-cgi\u002fchallenge-platform\u002fz";`,
      `e.src = "%2Fcdn-cgi%2Fchallenge-platform%2Fq";`,
    ].join('\n');

    const out = rewriteCloudflareChallengePaths(input);

    expect(out).toContain("'/__ra-cdn-cgi/challenge-platform/h/g/orchestrate/chl_page/v1?ray=abc'");
    expect(out).toContain("'/__ra-cdn-cgi/rum?'");
    expect(out).toContain('"/__ra-cdn-cgi/challenge-platform/x"');
    expect(out).toContain(String.raw`"\/__ra-cdn-cgi\/challenge-platform\/y"`);
    expect(out).toContain(String.raw`"\u002f__ra-cdn-cgi\u002fchallenge-platform\u002fz"`);
    expect(out).toContain('"%2F__ra-cdn-cgi%2Fchallenge-platform%2Fq"');
    expect(out).not.toContain('src = \'/cdn-cgi/');
    expect(out).not.toContain(String.raw`\/cdn-cgi\/`);
    expect(out).not.toContain(String.raw`\u002fcdn-cgi\u002f`);
    expect(out).not.toContain('%2Fcdn-cgi%2F');
  });

  it('does not rewrite Cloudflare challenge asset bodies', () => {
    expect(shouldRewritePublisherTextBody(
      { path: '/cdn-cgi/challenge-platform/h/g/orchestrate/chl_page/v1' },
      'application/javascript'
    )).toBe(false);
    expect(shouldRewritePublisherTextBody(
      { path: '/cdn-cgi/challenge-platform/h/g/flow/ov1/token' },
      'application/json'
    )).toBe(false);
    expect(shouldRewritePublisherTextBody(
      { path: '/insight/' },
      'text/html; charset=UTF-8'
    )).toBe(true);
  });

  it('rewrites Cloudflare challenge location reads to the publisher-location shim', () => {
    const input = [
      'var a = location.hostname;',
      'var b = window.location.origin;',
      'var c = self.location.href;',
      'var d = document.location.host;',
      'var e = location.protocol + location.pathname + location.search + location.hash;',
      'location.href = "/insight/";',
      'window.location.href += "#x";',
    ].join('\n');

    const out = rewriteCloudflareChallengeRuntimeLocation(input);

    expect(out).toContain('var a = window.__raPublisherLocation.hostname;');
    expect(out).toContain('var b = window.__raPublisherLocation.origin;');
    expect(out).toContain('var c = window.__raPublisherLocation.href;');
    expect(out).toContain('var d = window.__raPublisherLocation.host;');
    expect(out).toContain('window.__raPublisherLocation.protocol + window.__raPublisherLocation.pathname + window.__raPublisherLocation.search + window.__raPublisherLocation.hash');
    expect(out).toContain('location.href = "/insight/";');
    expect(out).toContain('window.location.href += "#x";');
    expect(out).not.toContain('location.hostname');
    expect(out).not.toContain('location.origin');
  });

  it('rewrites Emerald HJ/DJ-style bare host strings in script text', () => {
    const input = [
      `var h = 'www.emerald.com';`,
      `var d = ".emerald.com";`,
      `var root = "emerald.com";`,
      `var other = "notemerald.com";`,
    ].join('\n');

    const out = rewritePublisherHostJavaScriptText(
      input,
      '3010836a0478e29e647497fafec3209d16e8c585.selmiye.com',
      'emerald.com',
      new Set(['www.emerald.com', 'emerald.com'])
    );

    expect(out).toContain(`'3010836a0478e29e647497fafec3209d16e8c585.selmiye.com'`);
    expect(out).toContain(`"3010836a0478e29e647497fafec3209d16e8c585.selmiye.com"`);
    expect(out).toContain(`"notemerald.com"`);
    expect(out).not.toContain('www.emerald.com');
    expect(out).not.toContain('.emerald.com');
  });

  it('rewrites OUP stanza scheme-relative global host through session proxy', () => {
    const input = `domain="//global.oup.com"; src="https://oup.silverchair-cdn.com/site.js"`;
    const out = rewriteSessionTextProxyUrls(
      input,
      'rabc1234.selmiye.com',
      'academic.oup.com',
      new Set(['academic.oup.com', 'global.oup.com', 'oup.silverchair-cdn.com'])
    );

    expect(out).toContain(`domain="//rabc1234.selmiye.com/__ra-host/global-oup-com"`);
    expect(out).toContain(`src="https://rabc1234.selmiye.com/__ra-host/oup-silverchair--cdn-com/site.js"`);
    expect(out).not.toContain('//global.oup.com');
    expect(out).not.toContain('https://oup.silverchair-cdn.com');
  });

  it('does not force navigation from form-control clicks inside data-target widgets', () => {
    const out = injectSessionHostLinkProxyScript(
      '<html><head></head><body><div data-target="https://www.webofscience.com/wos"><input></div><button data-fulltext-url="https://ct.prod.getft.io/fulltext"></button></body></html>',
      'rabc1234.selmiye.com',
      'www.webofscience.com',
      new Set(['www.webofscience.com', 'ct.prod.getft.io'])
    );

    expect(out).toContain('__raReservedPathProxy');
    expect(out).toContain('__raFullTextProxyV1');
    expect(out).toContain('a.full-record-links');
    expect(out).toContain('[data-pendo*="GetFTR"]');
    expect(out).toContain("u&&u.href?String(u.href):(u&&u.url?String(u.url):'')");
    expect(out).toContain('navigator.sendBeacon=function(u,d){return sf.call(this,fixu(u),d);}');
    expect(out).toContain("s.indexOf(ah+'/')===0");
    expect(out).toContain("'data-fulltext-url'");
    expect(out).toContain('[data-fulltext-url]');
    expect(out).toContain('var all=el.attributes||[]');
    expect(out).toContain('attrs.indexOf(at.name)>=0');
    expect(out).toContain('Element.prototype.setAttribute=function(n,v)');
    expect(out).toContain("Object.defineProperty(ap,'href'");
    expect(out).toContain("closest('.full-text-button,.viewPreprint,.mat-mdc-menu-trigger,[aria-haspopup=\"menu\"]')");
    expect(out).toContain('[0,25,100,300].forEach');
    expect(out).toContain('var direct=proxify(before);');
    expect(out).toContain('var dest=(direct&&direct!==before)?direct:after;');
    expect(out).toContain("if(dest&&dest!==before){e.preventDefault();if(/^(a|area)$/i.test(a.tagName||''))");
    expect(out).toContain('window.open(dest,tg)');
    expect(out).toContain("var navattrs=['href','data-href','data-url','data-link','data-destination']");
    expect(out).toContain("closest('input,textarea,select,[contenteditable=\"\"],[contenteditable=\"true\"]'))return");
    expect(out).not.toContain('select,button,[contenteditable');
    expect(out).toContain('var before=navval(a);');
    expect(out).not.toContain("var before=a.getAttribute('href')||a.getAttribute('data-href')||a.getAttribute('data-url')||a.getAttribute('data-link')||a.getAttribute('data-target')");
  });

  it('still injects the full-text normalizer when the base link proxy marker already exists', () => {
    const out = injectSessionHostLinkProxyScript(
      '<html><head><script>window.__raSessionHostLinkProxy=1;</script></head><body></body></html>',
      'rabc1234.selmiye.com',
      'www.webofscience.com',
      new Set(['www.webofscience.com', 'ct.prod.getft.io'])
    );

    expect(out).toContain('__raFullTextProxyV1');
    expect(out).toContain('__raReservedPathProxy');
  });

  it('can inject the full-text normalizer into WoS JavaScript bundles', () => {
    const out = injectSessionHostFullTextProxyRuntime(
      'console.log("main bundle");',
      'rabc1234.selmiye.com',
      'www.webofscience.com',
      new Set(['www.webofscience.com', 'ct.prod.getft.io'])
    );

    expect(out).toContain('__raFullTextProxyV1');
    expect(out).toContain('a.full-record-links');
    expect(out).toContain('console.log("main bundle");');
    expect(out).not.toContain('<script>');
  });

  it('strips strict challenge policy headers only for namespaced publisher responses', () => {
    const input = new Headers({
      'Content-Type': 'text/html; charset=UTF-8',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Critical-CH': 'Sec-CH-UA',
      'Referrer-Policy': 'same-origin',
      'X-Frame-Options': 'SAMEORIGIN',
    });

    const out = buildSessionHostResponseHeaders(
      input,
      'rabc1234.selmiye.com',
      'www.emerald.com',
      'www.emerald.com',
      new Set(['www.emerald.com']),
      { publisherCookieScopeHost: 'emerald.com' }
    );

    expect(out.get('Content-Type')).toBe('text/html; charset=UTF-8');
    expect(out.get('Content-Security-Policy')).toContain('default-src *');
    expect(out.has('Cross-Origin-Embedder-Policy')).toBe(false);
    expect(out.has('Cross-Origin-Opener-Policy')).toBe(false);
    expect(out.has('Cross-Origin-Resource-Policy')).toBe(false);
    expect(out.get('Critical-CH')).toBe('Sec-CH-UA');
    expect(out.has('Referrer-Policy')).toBe(false);
    expect(out.has('X-Frame-Options')).toBe(false);
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

  it('rewrites Springer Nature IDP redirect_uri values back through the session host', () => {
    const hosts = new Set(['link.springer.com', 'idp.springer.com']);
    const out = rewriteSessionHostLocationWithUpstreamCookie(
      'https://idp.springer.com/authorize?response_type=cookie&client_id=springerlink&redirect_uri=https%3A%2F%2Flink.springer.com%2F',
      'rabc1234.selmiye.com',
      'link.springer.com',
      'link.springer.com',
      hosts
    );

    expect(out.location).toContain('https://rabc1234.selmiye.com/authorize?');
    expect(out.location).toContain('redirect_uri=https%3A%2F%2Frabc1234.selmiye.com%2F');
    expect(out.upstreamCookie).toContain('__ra_upstream=idp.springer.com');
  });

  it('normalizes Nature IDP /nature callback back to the homepage', () => {
    const hosts = new Set(['www.nature.com', 'idp.nature.com']);
    const out = rewriteSessionHostLocationWithUpstreamCookie(
      'https://idp.nature.com/authorize?response_type=cookie&client_id=grover&redirect_uri=https%3A%2F%2Fwww.nature.com%2Fnature',
      'rabc1234.selmiye.com',
      'www.nature.com',
      'www.nature.com',
      hosts
    );

    expect(out.location).toContain('redirect_uri=https%3A%2F%2Frabc1234.selmiye.com%2F');
    expect(out.location).not.toContain('%2Fnature');
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

  it('detects WoS GetFTR publisher redirect hosts dynamically', () => {
    const host = webOfScienceDynamicRedirectHost(
      'https://link.springer.com/article/10.1007/s40820-025-01804-2',
      { host: 'ct.prod.getft.io', path: '/Y2xhcml2YXRl...' },
      { origin_host: 'www.webofscience.com', product_slug: 'web-of-science' }
    );

    expect(host).toBe('link.springer.com');
  });

  it('does not trust arbitrary redirects outside the WoS GetFTR chain', () => {
    const host = webOfScienceDynamicRedirectHost(
      'https://example.com/',
      { host: 'www.webofscience.com', path: '/api/random' },
      { origin_host: 'www.webofscience.com', product_slug: 'web-of-science' }
    );

    expect(host).toBe('');
  });

  it('keeps Web of Science record APIs on the origin after publisher redirects', () => {
    expect(shouldRouteSessionPathToOrigin(
      '/api/wosnx/core/getFullRecordByQueryId',
      'www.webofscience.com',
      { productSlug: 'web-of-science' }
    )).toBe(true);
  });

  it('does not pin publisher article paths back to Web of Science', () => {
    expect(shouldRouteSessionPathToOrigin(
      '/science/article/pii/S0272494419307376',
      'www.webofscience.com',
      { productSlug: 'web-of-science' }
    )).toBe(false);
  });

  it('only applies Web of Science origin pinning to Web of Science sessions', () => {
    expect(shouldRouteSessionPathToOrigin(
      '/api/wosnx/core/getFullRecordByQueryId',
      'www.sciencedirect.com',
      { productSlug: 'science-direct' }
    )).toBe(false);
  });

  it('rewrites dynamically allowed WoS GetFTR publisher redirects through the selected upstream cookie', () => {
    const hosts = new Set(['www.webofscience.com', 'ct.prod.getft.io', 'link.springer.com']);
    const out = rewriteSessionHostLocationWithUpstreamCookie(
      'https://link.springer.com/article/10.1007/s40820-025-01804-2',
      'rabc1234.selmiye.com',
      'www.webofscience.com',
      'ct.prod.getft.io',
      hosts
    );

    expect(out.location).toBe('https://rabc1234.selmiye.com/article/10.1007/s40820-025-01804-2');
    expect(out.upstreamCookie).toContain('__ra_upstream=link.springer.com');
  });

  it('restores ScienceDirect search API hostname query param before upstream', () => {
    const out = rewriteQueryProxyUrls(
      '?qs=nanotube&t=token&hostname=r5k5o3p3.selmiye.com&navigation=true',
      'r5k5o3p3.selmiye.com',
      'www.sciencedirect.com'
    );

    expect(out).toBe('?qs=nanotube&t=token&hostname=www.sciencedirect.com&navigation=true');
  });

  it('restores IDP redirect_uri to the publisher origin rather than the IDP host', () => {
    const out = rewriteQueryProxyUrls(
      '?response_type=cookie&redirect_uri=https%3A%2F%2Frabc1234.selmiye.com%2Fsearch',
      'rabc1234.selmiye.com',
      'idp.springer.com',
      { sessionOriginHost: 'link.springer.com' }
    );

    expect(out).toContain('response_type=cookie');
    expect(out).toContain('redirect_uri=https%3A%2F%2Flink.springer.com%2Fsearch');
    expect(out).not.toContain('idp.springer.com%2Fsearch');
  });

  it('rewrites Elsevier stanza application URLs embedded in text payloads', () => {
    const out = rewriteSessionTextProxyUrls(
      [
        '["APP_DOMAIN"] = "www.scopus.com";',
        'gsUrl%22%3A%22https%3A%2F%2Fwww.scopus.com%2F',
        'redirect_uri=https://www.scopus.com/auth',
        'pdfurl%3D%22https%3A%2F%2Fwww.sciencedirect.com%2Fscience%2Farticle%2Fpii%2F123',
      ].join('\n'),
      'rabc1234.selmiye.com',
      'www.scopus.com',
      new Set(['www.scopus.com', 'www.sciencedirect.com'])
    );

    expect(out).toContain('["APP_DOMAIN"] = "rabc1234.selmiye.com";');
    expect(out).toContain('gsUrl%22%3A%22https%3A%2F%2Frabc1234.selmiye.com%2F');
    expect(out).toContain('redirect_uri=https://rabc1234.selmiye.com/auth');
    expect(out).toContain('pdfurl%3D%22https%3A%2F%2Frabc1234.selmiye.com%2F__ra-host%2Fwww-sciencedirect-com%2Fscience%2Farticle%2Fpii%2F123');
  });

  it('keeps ProQuest intermediate redirect JS inside the proxy origin', () => {
    const out = rewriteSessionTextProxyUrls(
      'if(!document.location.hostname.toLowerCase().endsWith(pqDomain)){}function redirectUser(redirectURL){window.location.replace(redirectURL)}',
      'rabc1234.selmiye.com',
      'www.proquest.com',
      new Set(['www.proquest.com'])
    );

    expect(out).toContain('if(false)');
    expect(out).toContain("window.location.replace(String(redirectURL||'').replace");
    expect(out).toContain('https://rabc1234.selmiye.com');
  });

  it('suppresses optional ProQuest deferred panel 500 popups', () => {
    const fallback = proQuestFailureFallbackResponse(
      {
        host: 'www.proquest.com',
        path: '/docview.relatedarticlepanel.longdeferreddisplay:longdeferreddisplayaction',
      },
      new Response('error', { status: 500 })
    );

    expect(fallback?.status).toBe(204);
  });

  it('applies publisher-specific upstream headers for Wiley and Scopus', () => {
    const wileyHeaders = buildUpstreamHeaders(new Headers({
      Accept: 'text/html',
      Cookie: 'ra_proxy_session=sid',
      'X-Application-Id': 'client',
      'X-Forwarded-For': '203.0.113.1',
    }), {
      proxyHostname: 'rabc1234.selmiye.com',
      originHost: 'onlinelibrary.wiley.com',
      targetHost: 'onlinelibrary.wiley.com',
    });

    expect(wileyHeaders.get('X-Application-Id')).toBeNull();
    expect(wileyHeaders.get('X-Forwarded-For')).toBe('127.0.0.1');

    const scopusHeaders = buildUpstreamHeaders(new Headers({
      Accept: 'application/json',
      'Authentication-Source': 'browser-app',
    }), {
      proxyHostname: 'rabc1234.selmiye.com',
      originHost: 'www.scopus.com',
      targetHost: 'www.scopus.com',
    });

    expect(scopusHeaders.get('Authentication-Source')).toBeNull();
  });

  it('rewrites ScienceDirect DOI links when DOI resolver hosts are allowlisted', () => {
    const out = rewriteSessionTextProxyUrls(
      '<a href="https://doi.org/10.1016/j.camss.2017.11.001">doi</a>',
      'rabc1234.selmiye.com',
      'www.sciencedirect.com',
      new Set(['www.sciencedirect.com', 'doi.org', 'dx.doi.org', 'linkinghub.elsevier.com'])
    );

    expect(out).toContain('href="https://rabc1234.selmiye.com/__ra-host/doi-org/10.1016/j.camss.2017.11.001"');
    expect(out).not.toContain('href="https://doi.org/');
  });

  it('detects ScienceDirect DOI resolver redirects to Elsevier linkinghub', () => {
    const host = scienceDirectDynamicRedirectHost(
      'https://linkinghub.elsevier.com/retrieve/pii/S0894916617302367',
      { host: 'doi.org', path: '/10.1016/j.camss.2017.11.001' },
      { origin_host: 'www.sciencedirect.com', product_slug: 'sciencedirect' }
    );

    expect(host).toBe('linkinghub.elsevier.com');
  });

  it('detects ScienceDirect linkinghub redirects back to ScienceDirect', () => {
    const host = scienceDirectDynamicRedirectHost(
      'https://www.sciencedirect.com/science/article/pii/S0894916617302367',
      { host: 'linkinghub.elsevier.com', path: '/retrieve/pii/S0894916617302367' },
      { origin_host: 'www.sciencedirect.com', product_slug: 'sciencedirect' }
    );

    expect(host).toBe('www.sciencedirect.com');
  });

  it('does not trust arbitrary DOI resolver redirects for ScienceDirect sessions', () => {
    const host = scienceDirectDynamicRedirectHost(
      'https://example.com/article',
      { host: 'doi.org', path: '/10.0000/example' },
      { origin_host: 'www.sciencedirect.com', product_slug: 'sciencedirect' }
    );

    expect(host).toBe('');
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

  it('does not persist volatile Cloudflare challenge cookies in the session jar', () => {
    const out = mergeSessionHostSetCookies(
      '__cf_bm=old; cf_clearance=old; JSESSIONID=stable',
      [
        '__cf_bm=new; Path=/; Secure; HttpOnly',
        'cf_clearance=new; Path=/; Secure; HttpOnly',
        'EMER_SessionId=sid; Path=/; Secure; HttpOnly',
      ]
    );

    expect(out).toBe('JSESSIONID=stable; EMER_SessionId=sid');
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

  it('keeps absolute origin links inside the session-host proxy', () => {
    const hosts = new Set(['www.nature.com', 'nature.com']);
    const out = rewriteSessionTextProxyUrls(
      '<a href="https://www.nature.com/articles/test">Article</a><a href="//nature.com/search">Search</a>',
      'rabc1234.selmiye.com',
      'www.nature.com',
      hosts
    );

    expect(out).toContain('href="https://rabc1234.selmiye.com/articles/test"');
    expect(out).toContain('href="//rabc1234.selmiye.com/__ra-host/nature-com/search"');
  });

  it('rewrites Cambridge globalNav theme path like the EZproxy stanza', () => {
    const out = rewriteSessionTextProxyUrls(
      "globalNav('//www.cambridge.org/tools/packages/cambridge_themes/core.js')",
      'rabc1234.selmiye.com',
      'www.cambridge.org',
      new Set(['www.cambridge.org', 'cambridge.org'])
    );

    expect(out).toContain("globalNav('/tools/packages/cambridge_themes/core.js')");
    expect(out).not.toContain('//www.cambridge.org/tools/packages/cambridge_themes/');
  });

  it('rewrites escaped Cambridge URLs embedded in JSON/JS payloads', () => {
    const out = rewriteSessionTextProxyUrls(
      '{"href":"https:\\/\\/www.cambridge.org\\/core\\/journals","alt":"https:\\/\\/journals.cambridge.org\\/action","encoded":"https%3A%2F%2Fwww.cambridge.org%2Fcore%2Fpublications%2Fbooks"}',
      'rabc1234.selmiye.com',
      'www.cambridge.org',
      new Set(['www.cambridge.org', 'journals.cambridge.org'])
    );

    expect(out).toContain('https:\\/\\/rabc1234.selmiye.com\\/core\\/journals');
    expect(out).toContain('https:\\/\\/rabc1234.selmiye.com\\/__ra-host\\/journals-cambridge-org\\/action');
    expect(out).toContain('https%3A%2F%2Frabc1234.selmiye.com%2Fcore%2Fpublications%2Fbooks');
    expect(out).not.toContain('www.cambridge.org');
    expect(out).not.toContain('journals.cambridge.org');
  });

  it('rewrites Web of Science frame and double-encoded navigation URLs', () => {
    const out = rewriteSessionTextProxyUrls(
      [
        'location.href="https://www.webofscience.com/wos/?Func=Frame&path=%2Fwos%2Fwoscc%2Fsmart-search"',
        'buttonTarget="www.webofscience.com/wos/alldb/full-record/123"',
        "fullText='www.webofknowledge.com/fulltext'",
        'referrer=TARGET%3Dhttps%253A%252F%252Fwww.webofscience.com%252Fwos%252F%253FInit%253DYes',
        'goto=https%3A%2F%2Fwww.webofknowledge.com%2F',
      ].join(';'),
      'rabc1234.selmiye.com',
      'www.webofscience.com',
      new Set(['www.webofscience.com', 'www.webofknowledge.com', 'access.clarivate.com'])
    );

    expect(out).toContain('location.href="https://rabc1234.selmiye.com/wos/?Func=Frame');
    expect(out).toContain('buttonTarget="rabc1234.selmiye.com/wos/alldb/full-record/123"');
    expect(out).toContain("fullText='rabc1234.selmiye.com/__ra-host/www-webofknowledge-com/fulltext'");
    expect(out).toContain('referrer=TARGET%3Dhttps%253A%252F%252Frabc1234.selmiye.com%252Fwos%252F%253FInit%253DYes');
    expect(out).toContain('goto=https%3A%2F%2Frabc1234.selmiye.com%2F__ra-host%2Fwww-webofknowledge-com%2F');
    expect(out).not.toContain('www.webofscience.com');
    expect(out).not.toContain('www.webofknowledge.com');
  });

  it('injects a client-side guard for dynamically rendered Cambridge links', () => {
    const out = injectSessionHostLinkProxyScript(
      '<html><head></head><body><a href="https://www.cambridge.org/core/journals">Journals</a></body></html>',
      'rabc1234.selmiye.com',
      'www.cambridge.org',
      new Set(['www.cambridge.org', 'journals.cambridge.org'])
    );

    expect(out).toContain('__raSessionHostLinkProxy');
    expect(out).toContain('journals.cambridge.org');
    expect(out).toContain('/__ra-host/');
    expect(out).toContain('data-href');
    expect(out).toContain('attributeFilter:attrs');
    expect(out).toContain('[data-url]');
    expect(out).toContain('window.open=function');
    expect(out).toContain('lp.assign=function');
    expect(out).toContain('lp.replace=function');
  });
});
