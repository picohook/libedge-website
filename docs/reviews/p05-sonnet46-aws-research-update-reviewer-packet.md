# Reviewer packet — Sonnet 4.6 AWS research update

## Scope

Documentation-only update to `docs/architecture/p05-provider-privacy-gate-sonnet46-final-checks.md` recording the 2026-09-13 AWS research session.

## Raw evidence summarized

1. Live Mantle `GET /v1/models` catalog did not expose `anthropic.claude-sonnet-4-6`; the relevant Sonnet 4.6 route is `bedrock-runtime` via `us.anthropic.claude-sonnet-4-6`.
2. The same Mantle catalog observation exposed `anthropic.claude-opus-4-8` with `allowed_modes` including `none` and `status: available`, corroborating the AWS canonical retention documentation for that narrow capability fact.
3. AWS canonical `data-retention.html` and the July 2026 Security Blog do not explicitly reconcile implicit prompt caching with effective mode `none`; the caching question remains open despite the broad "won't persist anything" language.
4. Current AWS retention documentation again corroborates that `provider_data_share` is legacy and does not currently share content with model providers.
5. An authoritative AWS answer on implicit caching + `none` has been requested and is pending.

No credentials, tokens, account identifiers, prompts, or model outputs are recorded.

## Intended decision effect

- Close only the Sonnet 4.6 `PENDING PRIMARY MANTLE API CONFIRMATION` item, by route inapplicability rather than by a positive Sonnet Mantle `allowed_modes` read.
- Preserve Sonnet 4.6 verdict exactly as `PASS CANDIDATE — STRONGEST EVIDENCE / FINAL CONFIRMATION PENDING`.
- Preserve implicit prompt caching + `none` as the sole remaining Sonnet 4.6 privacy blocker.
- Add corroborating evidence for Opus 4.8 `none` eligibility and the current `provider_data_share` reconciliation without selecting or promoting either route.

## Reviewer checks

1. Does the record distinguish route-inapplicability from a positive Mantle confirmation for Sonnet 4.6?
2. Does it avoid treating the broad AWS "won't persist anything" statement as an explicit caching/ZDR resolution?
3. Is the caching question still fail-closed / UNVERIFIED pending authoritative AWS clarification?
4. Are the Opus 4.8 and `provider_data_share` observations represented only as corroboration, without unintended verdict changes?
5. Is the Sonnet 4.6 verdict unchanged and model selection still blocked?
6. Is the record free of credentials/account identifiers and other sensitive live-session material?

## Decision Boundary

This PR does **not**:

- grant final privacy-gate PASS;
- select Sonnet 4.6, Opus 4.8, or any provider/model;
- authorize sending LibEdge research queries to an LLM;
- authorize prompt caching or any optional Bedrock feature;
- change AI Assistant implementation code;
- alter either locked P0 invariant;
- alter D-016 / Semantic-primary Track A/B;
- reopen 0047/0049;
- authorize production deployment or migration work.
