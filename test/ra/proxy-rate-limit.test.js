import { describe, it, expect } from 'vitest';
import {
  checkFixedWindowLimit,
  enforceProxyRateLimit,
  isStaticAssetPath,
} from '../../workers/proxy/src/rate-limit.js';

function memoryKV() {
  const map = new Map();
  const writes = { count: 0 };
  return {
    async get(key) {
      return map.get(key) || null;
    },
    async put(key, value) {
      writes.count += 1;
      map.set(key, value);
    },
    _writes: writes,
    _map: map,
  };
}

describe('proxy rate limiting', () => {
  it('limits after the configured fixed-window count', async () => {
    const kv = memoryKV();
    const first = await checkFixedWindowLimit(kv, 'p', 'session-a', 2, 60, 100);
    const second = await checkFixedWindowLimit(kv, 'p', 'session-a', 2, 60, 101);
    const third = await checkFixedWindowLimit(kv, 'p', 'session-a', 2, 60, 102);

    expect(first.isLimited).toBe(false);
    expect(second.isLimited).toBe(false);
    expect(third.isLimited).toBe(true);
    expect(third.retryAfter).toBe(18);
  });

  it('checks session before institution', async () => {
    const env = {
      RATE_LIMIT_KV: memoryKV(),
      RA_PROXY_SESSION_RPM: 1,
      RA_PROXY_INSTITUTION_RPM: 100,
      RA_PROXY_RATE_WINDOW_SEC: 60,
    };

    expect(await enforceProxyRateLimit(env, 'sid', { institution_id: 7 }, '/page')).toBeNull();
    const limited = await enforceProxyRateLimit(env, 'sid', { institution_id: 7 }, '/page');

    expect(limited.scope).toBe('session');
    expect(limited.isLimited).toBe(true);
  });

  it('fails open when KV is unavailable', async () => {
    const env = { RATE_LIMIT_KV: null };
    expect(await enforceProxyRateLimit(env, 'sid', { institution_id: 7 }, '/page')).toBeNull();
  });

  it('skips rate-limit (no KV ops) for static asset paths', async () => {
    const kv = memoryKV();
    const env = {
      RATE_LIMIT_KV: kv,
      RA_PROXY_SESSION_RPM: 1,
      RA_PROXY_INSTITUTION_RPM: 1,
    };

    // Hit lots of asset paths with same session — no limiting, no KV writes
    for (let i = 0; i < 50; i += 1) {
      const result = await enforceProxyRateLimit(env, 'sid', { institution_id: 7 }, '/_next/static/chunk.js');
      expect(result).toBeNull();
    }
    expect(kv._writes.count).toBe(0);
  });

  it('still rate-limits non-asset (HTML/API) paths', async () => {
    const kv = memoryKV();
    const env = {
      RATE_LIMIT_KV: kv,
      RA_PROXY_SESSION_RPM: 1,
      RA_PROXY_INSTITUTION_RPM: 100,
    };

    expect(await enforceProxyRateLimit(env, 'sid', { institution_id: 7 }, '/articles/1')).toBeNull();
    const limited = await enforceProxyRateLimit(env, 'sid', { institution_id: 7 }, '/articles/2');
    expect(limited.isLimited).toBe(true);
  });

});

describe('isStaticAssetPath', () => {
  it('matches page-render asset extensions', () => {
    expect(isStaticAssetPath('/foo/bar.css')).toBe(true);
    expect(isStaticAssetPath('/foo/bar.JS')).toBe(true);
    expect(isStaticAssetPath('/foo/bar.woff2')).toBe(true);
    expect(isStaticAssetPath('/foo/bar.png')).toBe(true);
    expect(isStaticAssetPath('/foo/bar.svg')).toBe(true);
  });

  it('does NOT bypass valuable publisher content (PDF/video/data dumps)', () => {
    // Bunlar academic proxy'nin korumakla yükümlü olduğu asıl scraping
    // vektörleridir — rate-limit aktif kalmalı.
    expect(isStaticAssetPath('/articles/2024/paper.pdf')).toBe(false);
    expect(isStaticAssetPath('/download/dataset.zip')).toBe(false);
    expect(isStaticAssetPath('/videos/lecture.mp4')).toBe(false);
    expect(isStaticAssetPath('/audio/podcast.mp3')).toBe(false);
    expect(isStaticAssetPath('/dump/data.tar.gz')).toBe(false);
  });

  it('matches well-known static path prefixes', () => {
    expect(isStaticAssetPath('/_next/static/chunks/main.js')).toBe(true);
    expect(isStaticAssetPath('/_next/image?url=x')).toBe(true);
    expect(isStaticAssetPath('/static/foo')).toBe(true);
    expect(isStaticAssetPath('/assets/anything')).toBe(true);
  });

  it('does NOT bypass /_next/data/ — Next.js SSR/SSG JSON page content', () => {
    // Yayıncı (örn. JoVE) makale içeriğini /_next/data/<build>/<path>.json
    // formatında servisliyor; bu rate-limit'in koruduğu birincil scraping
    // hedefi, asset değil.
    expect(isStaticAssetPath('/_next/data/abc123/articles/foo.json')).toBe(false);
    expect(isStaticAssetPath('/_next/data/abc123/research/journal/biology.json')).toBe(false);
  });

  it('treats favicon.ico and robots.txt as static', () => {
    expect(isStaticAssetPath('/favicon.ico')).toBe(true);
    expect(isStaticAssetPath('/robots.txt')).toBe(true);
  });

  it('does not treat HTML/API paths as static', () => {
    expect(isStaticAssetPath('/')).toBe(false);
    expect(isStaticAssetPath('/articles/1')).toBe(false);
    expect(isStaticAssetPath('/api/login')).toBe(false);
    expect(isStaticAssetPath('/research/journal/biology')).toBe(false);
    expect(isStaticAssetPath('/page.html')).toBe(false); // HTML is dynamic content
  });
});
