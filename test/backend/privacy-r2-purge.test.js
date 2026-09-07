import { describe, expect, it } from 'vitest';
import { derivePrivacyPurgeKey, purgePrivacyR2Queue } from '../../backend/src/privacy/r2-purge.js';

function createDb(rows) {
  const writes = [];
  return {
    writes,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async all() {
              return { results: rows };
            },
            async run() {
              writes.push({ sql, args });
              return { success: true };
            },
          };
        },
      };
    },
  };
}

describe('privacy R2 purge consumer', () => {
  it('accepts only managed ticket attachment keys', () => {
    expect(derivePrivacyPurgeKey('/api/files/ticket-attachments/12-123.pdf'))
      .toBe('ticket-attachments/12-123.pdf');
    expect(derivePrivacyPurgeKey('ticket-attachments/12-123.pdf'))
      .toBe('ticket-attachments/12-123.pdf');
    expect(derivePrivacyPurgeKey('/api/files/avatars/1.png')).toBeNull();
    expect(derivePrivacyPurgeKey('https://example.com/file.pdf')).toBeNull();
  });

  it('purges valid queued objects and rejects unmanaged keys', async () => {
    const db = createDb([
      { id: 1, object_url: '/api/files/ticket-attachments/42-100.pdf' },
      { id: 2, object_url: '/api/files/avatars/2.png' },
    ]);
    const deleted = [];
    const env = {
      DB: db,
      FILES_BUCKET: {
        async delete(key) {
          deleted.push(key);
        },
      },
    };

    await purgePrivacyR2Queue(env);

    expect(deleted).toEqual(['ticket-attachments/42-100.pdf']);
    expect(db.writes.some((entry) => entry.sql.includes('SET purged_at = CURRENT_TIMESTAMP') && entry.args[0] === 1)).toBe(true);
    expect(db.writes.some((entry) => entry.sql.includes('SET last_error = ?') && entry.args[0] === 'Rejected unmanaged R2 key' && entry.args[1] === 2)).toBe(true);
  });
});
