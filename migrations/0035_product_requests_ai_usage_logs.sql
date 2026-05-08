-- 0035_product_requests_ai_usage_logs.sql
--
-- Product request ve AI usage temelleri.
-- Privacy-by-design notları:
-- - AI tarafında ham prompt/output saklanmaz; yalnız hash, tool/model ve sayaç metadata tutulur.
-- - Ham IP, cookie, JWT, credential veya e-posta tutulmaz.
-- - Product request kayıtları user_id/institution_id ile ilişkilidir; reason alanı kısa tutulur.

CREATE TABLE IF NOT EXISTS product_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_slug TEXT NOT NULL,
  institution_id INTEGER NOT NULL,
  user_id INTEGER,
  reason TEXT,
  use_case TEXT,
  urgency TEXT NOT NULL DEFAULT 'normal'
    CHECK (urgency IN ('low', 'normal', 'high')),
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reviewed', 'sent_to_institution', 'approved', 'rejected', 'fulfilled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_requests_unique_user_product_institution
  ON product_requests(user_id, product_slug, institution_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_requests_institution_status
  ON product_requests(institution_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_requests_product_status
  ON product_requests(product_slug, status, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  anonymous_id TEXT,
  institution_id INTEGER,
  tool TEXT NOT NULL,
  model TEXT,
  input_hash TEXT,
  output_hash TEXT,
  tokens_estimate INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE SET NULL,
  CHECK (user_id IS NOT NULL OR anonymous_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_created
  ON ai_usage_logs(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_anonymous_created
  ON ai_usage_logs(anonymous_id, created_at DESC)
  WHERE anonymous_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_tool_created
  ON ai_usage_logs(tool, created_at DESC);
