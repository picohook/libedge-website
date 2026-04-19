CREATE TABLE IF NOT EXISTS products (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  region TEXT,
  default_access_type TEXT,
  default_access_url TEXT,
  default_requires_institution_email INTEGER DEFAULT 0,
  default_requires_vpn INTEGER DEFAULT 0,
  default_access_notes_tr TEXT,
  default_access_notes_en TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO products (slug, name, category, region) VALUES
  ('pangram', 'Pangram', 'Yapay Zeka', 'Türkiye, Orta Doğu'),
  ('chatpdf', 'ChatPDF', 'Yapay Zeka', 'Türkiye, Orta Doğu'),
  ('wonders', 'Wonders', 'Yapay Zeka', 'Türkiye, Orta Doğu'),
  ('assistin', 'Assistin', 'Yapay Zeka', 'Türkiye, Orta Doğu'),
  ('primal-pictures', 'Primal Pictures', 'Sağlık', 'Türkiye, Orta Doğu'),
  ('lecturio', 'Lecturio', 'Sağlık', 'Türkiye, Orta Doğu'),
  ('nejmhealer', 'NEJMHealer', 'Sağlık', 'Türkiye, Orta Doğu'),
  ('imachek', 'ImaChek', 'Sağlık', 'Türkiye, Orta Doğu'),
  ('cochrane-library', 'Cochrane Library', 'Sağlık', 'Türkiye (EKUAL dışı)'),
  ('jove-research', 'JoVE Research', 'Fen & Matematik', 'Türkiye'),
  ('jove-education', 'JoVE Education', 'Fen & Matematik', 'Türkiye'),
  ('jove-business', 'JoVE Business', 'İş & Hukuk', 'Türkiye'),
  ('biorender', 'BioRender', 'Mühendislik', 'Türkiye'),
  ('wiley-journals', 'Wiley Dergiler', 'Fen & Matematik', 'Türkiye (EKUAL dışı)'),
  ('wiley-books', 'Wiley Kitaplar', 'Fen & Matematik', 'Türkiye (EKUAL dışı)'),
  ('klasik-muzik', 'Klasik Müzik Koleksiyonu', 'Sanat', 'Türkiye, Orta Doğu'),
  ('caz-koleksiyonu', 'Caz Koleksiyonu', 'Sanat', 'Türkiye, Orta Doğu');
