import { describe, it, expect } from 'vitest';
import {
  renderTemplate,
  extractJsonPath,
  mergeSetCookiesIntoJar,
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
