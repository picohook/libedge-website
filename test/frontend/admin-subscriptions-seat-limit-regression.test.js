import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('subscription seat-limit migration compatibility', () => {
  const backend = fs.readFileSync('backend/src/index.js', 'utf8');
  const admin = fs.readFileSync('admin.html', 'utf8');

  it('runtime compatibility guard includes seat_limit before paged queries use it', () => {
    const ensureStart = backend.indexOf('async function ensureInstitutionSubscriptionAccessColumns');
    const ensureEnd = backend.indexOf('\n}', ensureStart);
    expect(backend.slice(ensureStart, ensureEnd)).toContain('ADD COLUMN seat_limit INTEGER');
  });

  it('does not silently render API failures as an empty subscription list', () => {
    expect(admin).toContain('Abonelikler yüklenemedi:');
    expect(admin).toContain('if (!res.ok)');
  });
});
