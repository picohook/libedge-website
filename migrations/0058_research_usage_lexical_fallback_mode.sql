-- 0058_research_usage_lexical_fallback_mode.sql
-- Widen the content-free retrieval_mode constraint to persist Assistant lexical fallback.
-- SQLite cannot alter an existing column CHECK constraint in place, so rebuild the table
-- while preserving every column introduced by 0051/0052/0055/0056/0057 and all indexes.

PRAGMA foreign_keys = OFF;

CREATE TABLE research_usage_events_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  institution_id INTEGER,
  operation TEXT NOT NULL CHECK (operation IN ('assistant_ask')),
  outcome_code TEXT NOT NULL,
  latency_ms INTEGER NOT NULL CHECK (latency_ms >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  input_tokens INTEGER CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens INTEGER CHECK (output_tokens IS NULL OR output_tokens >= 0),
  discover_ms INTEGER CHECK (discover_ms IS NULL OR discover_ms >= 0),
  evidence_pack_ms INTEGER CHECK (evidence_pack_ms IS NULL OR evidence_pack_ms >= 0),
  model_ms INTEGER CHECK (model_ms IS NULL OR model_ms >= 0),
  grounding_ms INTEGER CHECK (grounding_ms IS NULL OR grounding_ms >= 0),
  llm_cost_usd REAL CHECK (llm_cost_usd IS NULL OR llm_cost_usd >= 0),
  discovery_cost_usd REAL CHECK (discovery_cost_usd IS NULL OR discovery_cost_usd >= 0),
  retrieval_mode TEXT CHECK (retrieval_mode IS NULL OR retrieval_mode IN ('lexical', 'lexical_fallback', 'semantic', 'crossref')),
  candidate_depth INTEGER CHECK (candidate_depth IS NULL OR candidate_depth >= 0),
  retrieved_count INTEGER CHECK (retrieved_count IS NULL OR retrieved_count >= 0),
  authorized_relevant_count INTEGER CHECK (authorized_relevant_count IS NULL OR authorized_relevant_count >= 0),
  abstract_bearing_count INTEGER CHECK (abstract_bearing_count IS NULL OR abstract_bearing_count >= 0),
  metadata_only_count INTEGER CHECK (metadata_only_count IS NULL OR metadata_only_count >= 0),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE SET NULL
);

INSERT INTO research_usage_events_new (
  id, user_id, institution_id, operation, outcome_code, latency_ms, created_at,
  input_tokens, output_tokens, discover_ms, evidence_pack_ms, model_ms, grounding_ms,
  llm_cost_usd, discovery_cost_usd, retrieval_mode, candidate_depth, retrieved_count,
  authorized_relevant_count, abstract_bearing_count, metadata_only_count
)
SELECT
  id, user_id, institution_id, operation, outcome_code, latency_ms, created_at,
  input_tokens, output_tokens, discover_ms, evidence_pack_ms, model_ms, grounding_ms,
  llm_cost_usd, discovery_cost_usd, retrieval_mode, candidate_depth, retrieved_count,
  authorized_relevant_count, abstract_bearing_count, metadata_only_count
FROM research_usage_events;

DROP TABLE research_usage_events;
ALTER TABLE research_usage_events_new RENAME TO research_usage_events;

CREATE INDEX idx_research_usage_events_created
  ON research_usage_events(created_at DESC);
CREATE INDEX idx_research_usage_events_user_created
  ON research_usage_events(user_id, created_at DESC);
CREATE INDEX idx_research_usage_events_institution_created
  ON research_usage_events(institution_id, created_at DESC)
  WHERE institution_id IS NOT NULL;

PRAGMA foreign_keys = ON;
