import { describe, expect, it } from 'vitest';

import app from '../../backend/src/index.js';

function strictNoDdlDb() {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      calls.push(sql);
      if (/\b(CREATE|ALTER)\b/i.test(sql)) {
        throw new Error(`runtime DDL blocked in test: ${sql}`);
      }
      return {
        bind() {
          return this;
        },
        async all() {
          return { results: [] };
        },
        async first() {
          return null;
        },
        async run() {
          return { success: true };
        },
      };
    },
    async exec(sql) {
      calls.push(sql);
      if (/\b(CREATE|ALTER)\b/i.test(sql)) {
        throw new Error(`runtime DDL blocked in test: ${sql}`);
      }
      return { success: true };
    },
  };
}

describe('runtime DDL guard', () => {
  it('does not run product schema DDL in staging requests', async () => {
    const db = strictNoDdlDb();
    const res = await app.request('/api/products', {}, {
      DB: db,
      ENVIRONMENT: 'staging',
    });

    expect(res.status).toBe(200);
    expect(db.calls.some((sql) => /\b(CREATE|ALTER)\b/i.test(sql))).toBe(false);
  });
});
