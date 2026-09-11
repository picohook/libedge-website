# P0.5 Production Retrieval — Next Rollout-Stage Preparation

Status: `ACTIVE`

Date: 2026-09-11

## Purpose

Define the next preparation stage after the independently accepted controlled semantic retry PASS, without implicitly authorizing production migration or production semantic-primary enablement.

This document keeps two workstreams independent:

1. production traffic/capacity evidence for the locked `<=0.5 eligible research requests/second` broad-enablement guardrail;
2. production D1 telemetry migration preparation.

Neither workstream authorizes the other, and neither authorizes production semantic-primary by itself.

## Upstream closure

The controlled semantic retry v2 is independently `ACCEPTED`.

Canonical closure acceptance:

`docs/reviews/2026-09-11-d016-controlled-semantic-retry-closure-acceptance.md`

The reviewer explicitly approved closure of:

- `OOS-D016-CODE-01`;
- `OOS-D016-TELEMETRY-01`.

Current flags remain:

- staging semantic-primary: OFF;
- production semantic-primary: OFF.

## Track A — Production traffic / capacity guardrail evidence

### Locked requirement

D-016 requires broad enablement to remain blocked unless peak eligible research-query rate is documented at or below:

`0.5 requests/second`.

This is an operational capacity condition, not a relevance gate.

### Evidence standard

The evidence source must be able to support a defensible peak-rate statement without smoothing away short bursts or understating them through incomplete sampling.

Acceptable evidence is one of:

1. privacy-safe production request telemetry with per-request timestamps and complete/unsampled capture;
2. privacy-safe time buckets no coarser than **2 seconds** that can isolate eligible research requests and are based on complete/unsampled capture;
3. Cloudflare/native operational analytics that can isolate the eligible research endpoint at per-request or <=2-second temporal resolution without exposing query text, user identity, research topic, result content, DOI/title, or raw request bodies, and whose effective sampling/completeness is independently verified;
4. another independently reviewable operational source with equivalent temporal resolution, completeness, and privacy guarantees.

Any evidence source coarser than 2-second buckets is insufficient to support a peak-rate claim against the locked `<=0.5 req/s` guardrail because it may smooth materially bursty traffic.

Any sampled or incomplete source whose missing requests could reduce the observed peak is also insufficient. For Cloudflare Workers Logs specifically, account/environment state must demonstrate `head_sampling_rate = 1.0` (100% head sampling), or an equivalently complete unsampled capture must be independently proven.

A source with `head_sampling_rate < 1.0`, unknown sampling state, or otherwise unquantified incompleteness must be classified:

`INSUFFICIENT EVIDENCE — BROAD ENABLEMENT REMAINS BLOCKED`.

Daily totals, daily averages, minute-level averages, or other coarse aggregates alone are **not sufficient** to establish the locked peak-rate guardrail.

No silent correction factor or extrapolation from a sampled subset may be used to claim the upper guardrail is satisfied unless a separately reviewed method can defensibly establish a true upper bound.

If the available source cannot support a credible peak calculation at per-request or <=2-second resolution with complete/unsampled coverage, the correct result is:

`INSUFFICIENT EVIDENCE — BROAD ENABLEMENT REMAINS BLOCKED`.

### Minimum observation record

Any capacity evidence record must state:

- source/system;
- exact observation window;
- whether data are observed or estimated;
- temporal resolution;
- sampling/completeness state;
- effective `head_sampling_rate` when Workers Logs is used;
- eligible-request definition;
- total eligible requests;
- maximum observed rate and the calculation method;
- missing-data caveats;
- privacy boundary;
- conclusion against the `<=0.5 req/s` guardrail.

If bucketed data are used, the record must also state the bucket width explicitly and show that it is `<=2 seconds`.

If Workers Logs is used, the record must show that effective `head_sampling_rate = 1.0` for the production Worker/environment and relevant observation window, unless equivalent complete capture is independently demonstrated.

### No silent extrapolation

Low staging traffic is not evidence of low production traffic.

The successful controlled retry does not satisfy the production capacity guardrail.

The P0.5 experiment request rate does not satisfy the production capacity guardrail.

Sampled production traffic is not evidence of a safe upper bound unless completeness is independently established.

## Track B — Production D1 telemetry migration proposal

### Scope

Prepare, but do not yet execute, production migration of the already-reviewed telemetry table:

`migrations/0048_research_telemetry_counters.sql`

Production semantic-primary remains OFF before, during, and after this migration proposal.

### Migration-first rule

Before any production runtime can rely on D1-backed research telemetry, the production D1 schema must contain `research_telemetry_counters`.

### Mandatory pre-apply checks

A production migration execution request must first demonstrate:

1. production semantic-primary is `false`;
2. the production D1 binding is the intended production database;
3. the migration file is byte-identical to the staging-reviewed `0048_research_telemetry_counters.sql`;
4. pending production migrations are listed before apply;
5. if any unexpected pending migration exists in addition to the intended telemetry migration, STOP and return to review;
6. no production semantic enablement is bundled into the migration change;
7. rollback/recovery expectations are documented before apply.

### Intended migration verification

After a separately authorized production migration, verify only:

- migration command success;
- `research_telemetry_counters` table exists;
- expected columns/primary key exist;
- semantic-primary remains OFF;
- no production semantic provider call is made as part of migration verification.

### Migration does not equal rollout

Successful production telemetry migration does **not** authorize:

- production semantic-primary ON;
- broad production enablement;
- relevance evaluation;
- H/RRF;
- Vectorize;
- weakening the pacing/fallback/privacy constraints.

## Dependency between Track A and Track B

The two tracks are logically independent, but a practical measurement dependency may exist:

- if existing production operational analytics already provide privacy-safe eligible research-request timing at per-request or `<=2-second` resolution with complete/unsampled coverage, Track A can proceed without production D1 telemetry;
- if no such source exists, production D1 migration may become a prerequisite for a separately reviewed privacy-safe rate-measurement implementation.

That dependency must be demonstrated, not assumed.

## Decision boundary

This preparation document authorizes no production action.

Before any production D1 migration:

- separate reviewer acceptance is required.

Before any production semantic-primary enablement:

- Track A must satisfy the locked capacity guardrail;
- required production telemetry/migration prerequisites must be independently accepted;
- a separate production rollout proposal and review must occur.

## Next review request

The independent reviewer should assess:

1. whether the capacity evidence standard is strong enough to support the locked `<=0.5 req/s` guardrail;
2. whether the explicit per-request / `<=2-second` minimum temporal resolution is conservative enough to preserve burst evidence;
3. whether complete/unsampled capture, including `head_sampling_rate = 1.0` for Workers Logs, is required to avoid false-safe peak estimates;
4. whether daily/minute/coarser aggregate telemetry is correctly rejected as insufficient for peak-rate evidence;
5. whether the production migration prechecks are conservative enough;
6. whether unexpected pending migrations should be a hard STOP;
7. whether Track A and Track B are sufficiently separated to prevent migration acceptance from being misread as production semantic enablement;
8. whether an additional blocker should be added before either track begins.
