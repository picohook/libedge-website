-- 0055_research_usage_stage_timings.sql
-- Content-free Assistant stage timings for superadmin operational observability.
-- Nullable because requests can terminate before a stage is reached.

ALTER TABLE research_usage_events ADD COLUMN discover_ms INTEGER CHECK (discover_ms IS NULL OR discover_ms >= 0);
ALTER TABLE research_usage_events ADD COLUMN evidence_pack_ms INTEGER CHECK (evidence_pack_ms IS NULL OR evidence_pack_ms >= 0);
ALTER TABLE research_usage_events ADD COLUMN model_ms INTEGER CHECK (model_ms IS NULL OR model_ms >= 0);
ALTER TABLE research_usage_events ADD COLUMN grounding_ms INTEGER CHECK (grounding_ms IS NULL OR grounding_ms >= 0);
