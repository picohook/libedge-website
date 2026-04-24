import { describe, it, expect } from 'vitest';
import {
  renderTemplate,
  extractJsonPath,
  mergeSetCookiesIntoJar,
  pathMatches,
  maybeCaptureTokenAndForward,
} from '../../workers/proxy/src/recipe.js';

describe('renderTemplate', () => {
  it('substitutes named placeholders', () => {
    const out = renderTemplate('{"email":"{{u}}","pw":"{{p}}"}', { u: 'a@b.com', p: 'pw' });
    expect(out).toBe('{"email":"a@b.com","pw":"pw"}');
  });

  it('escapes double quotes and backslashes to produce valid JSON', () => {
    const out = renderTemplate('{"email":"{{u}}","pw":"{{p}}"}', {
      u: 'a@b.com',
      p: 'pa"ss\\word',
    });
    // JSON-safe embedding: password escaped
    expect(JSON.parse(out)).toEqual({ email: 'a@b.com', pw: 'pa"ss\\word' });
  });

  it('empty string for missing vars', () => {
    const out = renderTemplate('x={{missing}};y={{u}}', { u: '1' });
    expect(out).toBe('x=;y=1');
  });
});

describe('extractJsonPath', () => {
  it('flat field', () => {
    expect(extractJsonPath({ access_token: 'abc' }, 'access_token')).toBe('abc');
  });
  it('nested dot path', () => {
    expect(extractJsonPath({ data: { token: 'xyz' } }, 'data.token')).toBe('xyz');
  });
  it('missing path returns null', () => {
    expect(extractJsonPath({ a: 1 }, 'b.c')).toBe(null);
  });
  it('null object returns null', () => {
    expect(extractJsonPath(null, 'x')).toBe(null);
  });
  it('numeric and boolean values coerced to string', () => {
    expect(extractJsonPath({ n: 42 }, 'n')).toBe('42');
  });
});

describe('mergeSetCookiesIntoJar', () => {
  it('adds new cookies when jar is empty', () => {
    const jar = mergeSetCookiesIntoJar('', [
      'SESSION=abc; Path=/; HttpOnly',
      'JSESSIONID=xyz; Path=/',
    ]);
    expect(jar).toContain('SESSION=abc');
    expect(jar).toContain('JSESSIONID=xyz');
  });

  it('overrides existing cookie with same name', () => {
    const jar = mergeSetCookiesIntoJar('SESSION=old', [
      'SESSION=new; Path=/',
    ]);
    expect(jar).toBe('SESSION=new');
  });

  it('preserves unrelated existing cookies', () => {
    const jar = mergeSetCookiesIntoJar('a=1; b=2', [
      'c=3; Path=/',
    ]);
    const parts = jar.split('; ').sort();
    expect(parts).toEqual(['a=1', 'b=2', 'c=3']);
  });

  it('strips cookie attributes (Path, Domain, Expires)', () => {
    const jar = mergeSetCookiesIntoJar('', [
      'foo=bar; Path=/; Domain=.example.com; Max-Age=3600; HttpOnly; Secure',
    ]);
    expect(jar).toBe('foo=bar');
  });
});

describe('pathMatches', () => {
  it('exact path match', () => {
    expect(pathMatches('/api/auth/login', '/api/auth/login')).toBe(true);
    expect(pathMatches('/api/auth/logout', '/api/auth/login')).toBe(false);
  });

  it('strips query string when matching exact paths', () => {
    expect(pathMatches('/api/auth/login?foo=bar', '/api/auth/login')).toBe(true);
  });

  it('regex pattern with slash delimiters', () => {
    expect(pathMatches('/api/v1/auth/login', '/^\\/api\\/v\\d+\\/auth\\/login$/')).toBe(true);
    expect(pathMatches('/api/foo/login', '/^\\/api\\/v\\d+\\/auth\\/login$/')).toBe(false);
  });

  it('empty or null pattern returns false', () => {
    expect(pathMatches('/api/auth/login', null)).toBe(false);
    expect(pathMatches('/api/auth/login', '')).toBe(false);
  });

  it('invalid regex returns false', () => {
    expect(pathMatches('/x', '/(?invalid/')).toBe(false);
  });
});

describe('maybeCaptureTokenAndForward', () => {
  // Mock env: DB.prepare().bind().run(), RA_UPSTREAM_SESSIONS.delete(),
  // RA_CREDS_MASTER_KEY present. We only want to verify capture path — not
  // the persistence chain. Token extraction + response reconstruction is
  // the critical logic.
  function mockEnv() {
    const calls = { dbRun: [], kvDelete: [] };
    return {
      calls,
      env: {
        RA_CREDS_MASTER_KEY: btoa('x'.repeat(32)),
        DB: {
          prepare() {
            return {
              bind() {
                return {
                  async run() {
                    calls.dbRun.push(true);
                    return { success: true };
                  },
                  async first() {
                    return null;
                  },
                };
              },
            };
          },
        },
        RA_UPSTREAM_SESSIONS: {
          async put() {},
          async delete(key) { calls.kvDelete.push(key); },
          async get() { return null; },
        },
      },
    };
  }

  const session = {
    user_id: 42,
    institution_id: 1,
    subscription_id: 7,
    product_slug: 'pangram',
    target_host: 'www.pangram.com',
  };

  it('pass-through when recipe has no capture path', async () => {
    const { env } = mockEnv();
    const original = new Response('{"a":1}', { status: 200 });
    const out = await maybeCaptureTokenAndForward(env, session, 'sid', {}, '/login', original);
    expect(out).toBe(original);
  });

  it('pass-through when request path does not match', async () => {
    const { env } = mockEnv();
    const recipe = {
      capture_token_on_login_path: '/api/auth/login',
      token_field: 'access_token',
    };
    const original = new Response('{"access_token":"abc"}', { status: 200 });
    const out = await maybeCaptureTokenAndForward(env, session, 'sid', recipe, '/api/other', original);
    expect(out).toBe(original);
  });

  it('pass-through when status is not in success codes', async () => {
    const { env } = mockEnv();
    const recipe = {
      capture_token_on_login_path: '/api/auth/login',
      token_field: 'access_token',
    };
    const original = new Response('{"error":"bad"}', { status: 400 });
    const out = await maybeCaptureTokenAndForward(env, session, 'sid', recipe, '/api/auth/login', original);
    expect(out).toBe(original);
  });

  it('captures token and reconstructs response when path + status match', async () => {
    const { env, calls } = mockEnv();
    const recipe = {
      capture_token_on_login_path: '/api/auth/login',
      token_source: 'response_json_field',
      token_field: 'access_token',
    };
    const original = new Response(
      JSON.stringify({ access_token: 'JWT.TOKEN.VALUE', user: { email: 'x@y.com' } }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
    const out = await maybeCaptureTokenAndForward(env, session, 'sid', recipe, '/api/auth/login', original);
    // Body forwarded intact
    const text = await out.text();
    expect(JSON.parse(text).access_token).toBe('JWT.TOKEN.VALUE');
    expect(out.status).toBe(200);
    // DB insert happened
    expect(calls.dbRun.length).toBe(1);
    // Cache invalidation happened
    expect(calls.kvDelete.length).toBe(1);
    expect(calls.kvDelete[0]).toContain('raauth:');
  });

  it('captures nested token path (e.g. data.token)', async () => {
    const { env, calls } = mockEnv();
    const recipe = {
      capture_token_on_login_path: '/api/auth/login',
      token_source: 'response_json_field',
      token_field: 'data.token',
    };
    const original = new Response(
      JSON.stringify({ data: { token: 'NESTED.JWT', refreshToken: 'R' } }),
      { status: 200 }
    );
    await maybeCaptureTokenAndForward(env, session, 'sid', recipe, '/api/auth/login', original);
    expect(calls.dbRun.length).toBe(1);
  });

  it('does not persist when token field missing in response', async () => {
    const { env, calls } = mockEnv();
    const recipe = {
      capture_token_on_login_path: '/api/auth/login',
      token_source: 'response_json_field',
      token_field: 'access_token',
    };
    const original = new Response(
      JSON.stringify({ wrong_field: 'xxx' }),
      { status: 200 }
    );
    await maybeCaptureTokenAndForward(env, session, 'sid', recipe, '/api/auth/login', original);
    // No DB write
    expect(calls.dbRun.length).toBe(0);
  });

  it('captures from response header', async () => {
    const { env, calls } = mockEnv();
    const recipe = {
      capture_token_on_login_path: '/api/auth/login',
      token_source: 'response_header',
      token_header_source: 'x-auth-token',
    };
    const original = new Response('', {
      status: 200,
      headers: { 'x-auth-token': 'Bearer HEADER.TOKEN' },
    });
    await maybeCaptureTokenAndForward(env, session, 'sid', recipe, '/api/auth/login', original);
    expect(calls.dbRun.length).toBe(1);
  });
});
