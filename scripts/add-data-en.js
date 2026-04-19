/**
 * Migration: translatable elementlere data-en attribute ekle
 * Kullanım: node scripts/add-data-en.js
 *
 * - translations dict'teki metinleri HTML'de bulur
 * - Eşleşen elementlere data-en="..." ekler
 * - Zaten data-en olanları atlar
 * - Nested HTML içeren elementleri atlar (dict fallback'e devam ederler)
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Translations dict'i script.js'den oku ─────────────────────────────────
const scriptSrc = readFileSync(resolve(ROOT, 'assets/js/script.js'), 'utf8');
const dictMatch = scriptSrc.match(/const translations\s*=\s*\{([\s\S]*?)\n\s*\};/);
if (!dictMatch) { console.error('translations dict bulunamadı'); process.exit(1); }

// HTML entity decode (migration script içi kullanım)
function decodeEntities(str) {
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

// Basit key-value parse (eval yerine güvenli regex)
const translations = {};
const kvRegex = /['"`]((?:[^'"`\\]|\\[\s\S])*?)['"`]\s*:\s*['"`]((?:[^'"`\\]|\\[\s\S])*?)['"`]/g;
let m;
while ((m = kvRegex.exec(dictMatch[1])) !== null) {
  translations[m[1].replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\')] =
    m[2].replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}
console.log(`Translations yüklendi: ${Object.keys(translations).length} giriş`);

// ── İşlenecek HTML dosyaları ───────────────────────────────────────────────
const HTML_FILES = [
  'index.html',
  'announcements.html',
  'cookies.html',
  'privacy.html',
  'terms.html',
  'partials/header.html',
].map(f => resolve(ROOT, f));

// ── Her dosyayı işle ──────────────────────────────────────────────────────
let totalAdded = 0;
let totalSkipped = 0;

for (const filePath of HTML_FILES) {
  let html;
  try { html = readFileSync(filePath, 'utf8'); }
  catch { console.warn(`Atlandı (bulunamadı): ${filePath}`); continue; }

  let added = 0;
  let skipped = 0;

  /**
   * Regex: translatable özelliğine sahip açılış tagını + sade text içeriğini eşleştirir.
   * Nested element içeren (<tag>...<inner>...</inner>...) satırları ATLAR.
   *
   * Grup 1: açılış tag (data-en ekleme yeri)
   * Grup 2: text içeriği
   */
  const pattern = /(<(?:[a-zA-Z][a-zA-Z0-9]*)\b[^>]*\btranslatable\b[^>]*>)([ \t]*)((?:[^<\n])+?)(\s*)(?=<\/)/g;

  html = html.replace(pattern, (full, openTag, leadWs, text, trailWs) => {
    const trimmed = text.trim();
    if (!trimmed) return full;

    const enText = translations[trimmed] || translations[decodeEntities(trimmed)];
    if (!enText) { skipped++; return full; }

    // Zaten data-en varsa atla
    if (/\bdata-en\s*=/.test(openTag)) { skipped++; return full; }

    // data-en ekle (kapanış > öncesine)
    const newTag = openTag.replace(/>$/, ` data-en="${enText.replace(/"/g, '&quot;')}">`);
    added++;
    return newTag + leadWs + text + trailWs;
  });

  writeFileSync(filePath, html, 'utf8');
  totalAdded += added;
  totalSkipped += skipped;
  console.log(`${filePath.replace(ROOT, '')}: +${added} data-en eklendi, ${skipped} eşleşme yok`);
}

console.log(`\nToplam: ${totalAdded} data-en eklendi, ${totalSkipped} element dict'te yok (fallback devam)`);
