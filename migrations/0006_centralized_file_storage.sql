CREATE TABLE IF NOT EXISTS files (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  hash          TEXT NOT NULL UNIQUE,
  file_key      TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  file_size     INTEGER,
  mime_type     TEXT,
  extension     TEXT,
  uploaded_by   INTEGER,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS collections (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id   INTEGER,
  name        TEXT NOT NULL,
  scope_type  TEXT NOT NULL,
  scope_id    INTEGER,
  kind        TEXT NOT NULL DEFAULT 'folder',
  is_public   INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_by  INTEGER,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES collections(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS collection_files (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  collection_id INTEGER NOT NULL,
  file_id      INTEGER NOT NULL,
  display_name TEXT,
  category     TEXT DEFAULT 'other',
  is_public    INTEGER NOT NULL DEFAULT 0,
  is_active    INTEGER NOT NULL DEFAULT 1,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  added_by     INTEGER,
  added_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (added_by) REFERENCES users(id),
  UNIQUE (collection_id, file_id)
);

CREATE INDEX IF NOT EXISTS idx_files_hash
  ON files(hash);

CREATE INDEX IF NOT EXISTS idx_files_key
  ON files(file_key);

CREATE INDEX IF NOT EXISTS idx_collections_scope
  ON collections(scope_type, scope_id, parent_id, is_active);

CREATE INDEX IF NOT EXISTS idx_collection_files_collection
  ON collection_files(collection_id, is_active, added_at);

CREATE INDEX IF NOT EXISTS idx_collection_files_file
  ON collection_files(file_id, is_active);
