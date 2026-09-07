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

  it('exposes product brochure_url in public product cards response', async () => {
    const db = {
      prepare() {
        return {
          bind() {
            return this;
          },
          async all() {
            return {
              results: [{
                slug: 'sample-card',
                name: 'Sample Card',
                category: 'Test',
                region: 'TR',
                logo_url: null,
                logo_updated_at: null,
                brand_color: null,
                card_background_url: null,
                card_background_updated_at: null,
                card_background_overlay: 'light',
                card_front_text_color: null,
                card_back_text_color: null,
                short_description_tr: null,
                short_description_en: null,
                brochure_url: 'https://example.com/sample.pdf',
                subjects_json: '["yapay-zeka"]',
                access_tags_json: '[]',
                card_visible: 1,
                display_order: 10,
                is_featured: 0,
              }],
            };
          },
        };
      },
    };

    const res = await app.request('/api/products', {}, {
      DB: db,
      ENVIRONMENT: 'staging',
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.products).toHaveLength(1);
    expect(data.products[0]).toMatchObject({
      slug: 'sample-card',
      brochure_url: 'https://example.com/sample.pdf',
      subjects: ['yapay-zeka'],
    });
  });
});
