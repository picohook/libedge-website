import { describe, it, expect } from 'vitest';
import {
  encodeHost,
  decodeHost,
  isValidEncodedHost,
} from '../../backend/src/ra/host.js';

describe('encodeHost / decodeHost', () => {
  const cases = [
    ['journals.example.com', 'journals-example-com'],
    ['www.jove.com', 'www-jove-com'],
    ['sub.journals.example.com', 'sub-journals-example-com'],
    // hyphens in the source become double hyphens
    ['my-site.example.com', 'my--site-example-com'],
    ['a-b-c.example.com', 'a--b--c-example-com'],
    // IDN / lowercasing
    ['Example.COM', 'example-com'],
    // single-label
    ['localhost', 'localhost'],
  ];

  for (const [source, encoded] of cases) {
    it(`encodes ${source}`, () => {
      expect(encodeHost(source)).toBe(encoded);
    });
    it(`round-trips ${source}`, () => {
      expect(decodeHost(encodeHost(source))).toBe(source.toLowerCase().trim());
    });
  }
});

describe('isValidEncodedHost', () => {
  it('accepts legitimate encoded hosts', () => {
    expect(isValidEncodedHost('www-jove-com')).toBe(true);
    expect(isValidEncodedHost('my--site-example-com')).toBe(true);
    expect(isValidEncodedHost('localhost')).toBe(true);
  });

  it('rejects empty / garbage input', () => {
    expect(isValidEncodedHost('')).toBe(false);
    expect(isValidEncodedHost(null)).toBe(false);
    expect(isValidEncodedHost(undefined)).toBe(false);
  });

  it('rejects characters outside [a-z0-9-]', () => {
    expect(isValidEncodedHost('www jove com')).toBe(false);
    expect(isValidEncodedHost('www.jove.com')).toBe(false);
    expect(isValidEncodedHost('www/jove/com')).toBe(false);
    expect(isValidEncodedHost('www_jove_com')).toBe(false);
  });

  it('rejects oversize input (>253 chars)', () => {
    expect(isValidEncodedHost('a'.repeat(254))).toBe(false);
  });
});
