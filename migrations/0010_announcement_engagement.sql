-- =====================================================================
-- 0010_announcement_engagement.sql
-- Duyurulara reaksiyon (emoji) ve yorum eklenmesi.
-- Kullanıcı giriş yapmış olmalıdır. Yorumlar anında yayına girer;
-- admin moderasyon için silebilir (soft delete).
-- =====================================================================

-- Reaksiyonlar: bir kullanıcı aynı duyuruya farklı tipte reaksiyon verebilir,
-- aynı tipte ikinci kez veremez (UNIQUE constraint toggle için kullanılır).
CREATE TABLE IF NOT EXISTS announcement_reactions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction        TEXT    NOT NULL CHECK (reaction IN ('like','love','clap','insightful','celebrate')),
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (announcement_id, user_id, reaction)
);

CREATE INDEX IF NOT EXISTS idx_announcement_reactions_ann
  ON announcement_reactions(announcement_id);

CREATE INDEX IF NOT EXISTS idx_announcement_reactions_user
  ON announcement_reactions(user_id);

-- Yorumlar: düz liste, nested yok. Soft delete — admin silerse
-- kayıt kalır (audit trail), listede "Silindi" olarak işaretlenir
-- veya tamamen gizlenir (frontend kararı).
CREATE TABLE IF NOT EXISTS announcement_comments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body            TEXT    NOT NULL,
  is_deleted      INTEGER NOT NULL DEFAULT 0,
  deleted_by      INTEGER REFERENCES users(id),
  deleted_at      DATETIME,
  edited_at       DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_announcement_comments_ann
  ON announcement_comments(announcement_id, is_deleted, created_at);

CREATE INDEX IF NOT EXISTS idx_announcement_comments_user
  ON announcement_comments(user_id);
