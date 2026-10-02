import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

describe('admin inline script syntax', () => {
  it('keeps the main inline script parseable after Research admin edits', () => {
    const html = fs.readFileSync('admin.html', 'utf8');
    const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
      .map((match) => match[1])
      .filter((body) => body.trim());
    expect(scripts.length).toBeGreaterThan(0);
    for (const body of scripts) {
      expect(() => new vm.Script(body)).not.toThrow();
    }
  });
});
