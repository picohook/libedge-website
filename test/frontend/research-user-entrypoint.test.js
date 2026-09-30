import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('Research end-user entry point', () => {
  const backend = fs.readFileSync('backend/src/index.js', 'utf8');
  const home = fs.readFileSync('index.html', 'utf8');

  it('derives access on the server from privacy gate and entitlement', () => {
    expect(backend).toContain("app.get('/api/research/access'");
    expect(backend).toContain('researchPrivacyGatePassed(c.env)');
    expect(backend).toContain('hasResearchEntitlement(c.env.DB, auth.user)');
    expect(backend).toContain("entry_url: privacy_passed && entitled ? '/assistant.html' : null");
  });

  it('keeps the Research entry hidden unless the server explicitly allows it', () => {
    expect(home).toContain('id="researchAccessEntry"');
    expect(home).toContain("fetch('/api/research/access'");
    expect(home).toContain("if (access.allowed && access.entry_url === '/assistant.html')");
    expect(home).toContain("entry.classList.remove('hidden')");
  });
});
