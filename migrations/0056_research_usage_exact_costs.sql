-- 0056_research_usage_exact_costs.sql
-- Request-attributed exact provider costs for Research Assistant.
-- Components remain separate so estimated infrastructure costs are never mixed in.

ALTER TABLE research_usage_events ADD COLUMN llm_cost_usd REAL
  CHECK (llm_cost_usd IS NULL OR llm_cost_usd >= 0);
ALTER TABLE research_usage_events ADD COLUMN discovery_cost_usd REAL
  CHECK (discovery_cost_usd IS NULL OR discovery_cost_usd >= 0);
