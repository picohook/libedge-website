import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const serverSource = readFileSync(join(process.cwd(), 'ra-browser/server.js'), 'utf8');

describe('ra-browser Wiley search source guard', () => {
  it('keeps the first-search cold bootstrap path visible in builds', () => {
    expect(serverSource).toContain('wiley-cold-bootstrap=1');
    expect(serverSource).toContain('function isWileySearchUrl');
    expect(serverSource).toContain('fetchCookielessDocumentInPage');
    expect(serverSource).toContain('doc-cold-bootstrap-cookieless');
    expect(serverSource).toContain('x-ra-browser-cold-bootstrap-cookieless');
  });
});
