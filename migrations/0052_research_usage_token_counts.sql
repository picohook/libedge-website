-- 0052_research_usage_token_counts.sql
-- Content-free Bedrock metering for Research usage events.
-- Counts are nullable because not every outcome invokes or returns model usage.

ALTER TABLE research_usage_events ADD COLUMN input_tokens INTEGER CHECK (input_tokens IS NULL OR input_tokens >= 0);
ALTER TABLE research_usage_events ADD COLUMN output_tokens INTEGER CHECK (output_tokens IS NULL OR output_tokens >= 0);
