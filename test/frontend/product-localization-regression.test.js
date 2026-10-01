import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const profileSource = readFileSync('profile.html', 'utf8');
const adminSource = readFileSync('admin.html', 'utf8');
const backendSource = readFileSync('backend/src/index.js', 'utf8');
const migrationSource = readFileSync('migrations/0053_product_name_localization.sql', 'utf8');

describe('#347 product localization contract', () => {
  it('stores and exposes an optional English product name', () => {
    expect(migrationSource).toContain('ALTER TABLE products ADD COLUMN name_en TEXT');
    expect(backendSource).toContain('SELECT slug, name, name_en, category');
    expect(backendSource).toContain('SET name = ?, name_en = ?, category = ?');
  });

  it('lets admins edit the English product name', () => {
    expect(adminSource).toContain('id="productNameEn"');
    expect(adminSource).toContain("name_en: document.getElementById('productNameEn').value.trim() || null");
  });

  it('uses deterministic locale fallback for product names', () => {
    expect(profileSource).toContain("prod.name_en || prod.name || sub.product_name");
    expect(profileSource).toContain("p.name_en || p.name || p.slug");
    expect(profileSource).toContain("p.name || p.name_en || p.slug");
  });

  it('centralizes known category translations instead of duplicating category_en per product', () => {
    expect(profileSource).toContain("'Yapay Zeka': 'Artificial Intelligence'");
    expect(profileSource).toContain("'Genel': 'General'");
    expect(profileSource).toContain("'AI Etik & Akademik Dürüstlük': 'AI Ethics & Academic Integrity'");
    expect(profileSource).toContain("'Akademik Yazım & Dil': 'Academic Writing & Language'");
    expect(profileSource).toContain("'Anket & Veri Toplama': 'Survey & Data Collection'");
    expect(profileSource).toContain('translateProfileString(rawCategory, useEnglish)');
  });
});
