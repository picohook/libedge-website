CREATE TABLE IF NOT EXISTS individual_tools (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  access_type TEXT NOT NULL DEFAULT 'free',
  delivery_type TEXT NOT NULL DEFAULT 'external_link',
  target_url TEXT,
  affiliate_url TEXT,
  summary_tr TEXT,
  summary_en TEXT,
  logo_url TEXT,
  featured INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  display_order INTEGER DEFAULT 999,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_slug TEXT NOT NULL,
  user_id INTEGER,
  source TEXT,
  referer TEXT,
  user_agent TEXT,
  clicked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_tool_time
  ON affiliate_clicks(tool_slug, clicked_at DESC);

INSERT OR IGNORE INTO individual_tools
  (slug, name, category, access_type, delivery_type, target_url, affiliate_url, summary_tr, logo_url, featured, status, display_order)
VALUES
  ('notebooklm', 'NotebookLM', 'Araştırma Asistanı', 'free', 'external_link', 'https://notebooklm.google/', NULL, 'Kaynaklarınızı yükleyip not, özet ve çalışma rehberi üretebileceğiniz ücretsiz araştırma aracı.', 'https://www.google.com/s2/favicons?domain=notebooklm.google&sz=128', 1, 'active', 10),
  ('google-scholar', 'Google Scholar', 'Akademik Arama', 'free', 'external_link', 'https://scholar.google.com/', NULL, 'Makale, atıf ve yazar profili aramaları için temel akademik arama motoru.', 'https://www.google.com/s2/favicons?domain=scholar.google.com&sz=128', 1, 'active', 20),
  ('orcid', 'ORCID', 'Akademik Kimlik', 'free', 'external_link', 'https://orcid.org/', NULL, 'Araştırmacı kimliğinizi ve yayın profilinizi standartlaştırmak için ücretsiz akademik kimlik.', 'https://www.google.com/s2/favicons?domain=orcid.org&sz=128', 1, 'active', 30),
  ('zotero', 'Zotero', 'Referans Yönetimi', 'free', 'external_link', 'https://www.zotero.org/', NULL, 'Kaynak toplama, atıf verme ve bibliyografya oluşturma için ücretsiz referans yöneticisi.', 'https://www.google.com/s2/favicons?domain=zotero.org&sz=128', 1, 'active', 40),
  ('researchrabbit', 'ResearchRabbit', 'Literatür Keşfi', 'free', 'external_link', 'https://www.researchrabbit.ai/', NULL, 'Makaleler arası ilişkileri görerek literatür keşfi yapmaya yardımcı olan ücretsiz araç.', 'https://www.google.com/s2/favicons?domain=researchrabbit.ai&sz=128', 0, 'active', 50),
  ('scite', 'Scite', 'Atıf Analizi', 'affiliate', 'affiliate_redirect', 'https://scite.ai/', 'https://scite.ai/', 'Atıfların destekleyici, karşıt veya yalnızca bahsedici bağlamını analiz eden akademik araç.', 'https://www.google.com/s2/favicons?domain=scite.ai&sz=128', 0, 'active', 60);
