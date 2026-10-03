-- 0057_research_usage_retrieval_diagnostics.sql
-- Content-free retrieval diagnostics for controlled Research experiments.
-- Never stores query, title, DOI, claim, evidence text, or provider payload.

ALTER TABLE research_usage_events ADD COLUMN retrieval_mode TEXT
  CHECK (retrieval_mode IS NULL OR retrieval_mode IN ('lexical', 'semantic', 'crossref'));
ALTER TABLE research_usage_events ADD COLUMN candidate_depth INTEGER
  CHECK (candidate_depth IS NULL OR candidate_depth >= 0);
ALTER TABLE research_usage_events ADD COLUMN retrieved_count INTEGER
  CHECK (retrieved_count IS NULL OR retrieved_count >= 0);
ALTER TABLE research_usage_events ADD COLUMN authorized_relevant_count INTEGER
  CHECK (authorized_relevant_count IS NULL OR authorized_relevant_count >= 0);
ALTER TABLE research_usage_events ADD COLUMN abstract_bearing_count INTEGER
  CHECK (abstract_bearing_count IS NULL OR abstract_bearing_count >= 0);
ALTER TABLE research_usage_events ADD COLUMN metadata_only_count INTEGER
  CHECK (metadata_only_count IS NULL OR metadata_only_count >= 0);
