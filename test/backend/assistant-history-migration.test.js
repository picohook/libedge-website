import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../../migrations/0054_assistant_saved_queries.sql', import.meta.url);

describe('Assistant history persistence boundary', () => {
  it('stores encrypted payload columns only and cascades account deletion', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('query_ciphertext TEXT NOT NULL');
    expect(sql).toContain('result_ciphertext TEXT NOT NULL');
    expect(sql).not.toMatch(/\bquery_text\b/i);
    expect(sql).not.toMatch(/\bresult_json\b/i);
    expect(sql).toContain("CHECK (outcome_code = 'OK')");
    expect(sql).toContain("visibility TEXT NOT NULL DEFAULT 'private'");
    expect(sql).toContain('ON DELETE CASCADE');
    expect(sql).toContain("datetime('now', '+90 days')");
  });
});
