# Research Admin support-check latency share

Status: UI/data contract for #509, using telemetry introduced by #501.

## Meaning

The Admin funnel may annotate the Grounding step with **support-check share** only when numerator and denominator come from the same selected Admin window, filters, and row population.

The existing global daily telemetry counter `assistant_support_check_ms_total` is **not sufficient** for a 7/30/90-day or user/institution-filtered Admin denominator. It MUST NOT be divided by filtered Research usage latency.

## Required data path

Implementation requires a maintainer-approved D1 migration before UI wiring. The next migration is expected to be `0059`, adding nullable INTEGER `support_check_ms` to `research_usage_events`. This is intentionally outside the original no-migration #509 UI slice; do not implement the persistence change until that migration decision is approved.

Persist the already content-free `diagnostic_timings.support_check_ms` alongside the existing Research usage-event stage timings. Existing/pre-migration rows remain NULL. Query it through the same SQL date window, user filter, and institution filter as grounding.

Expose the filtered timing as `summary.stage_latency_ms.support_check`.

For the **share**, use only rows where both `support_check_ms` and `grounding_ms` are non-null. Compute `SUM(support_check_ms) / SUM(grounding_ms)` over that paired population (equivalently, a ratio of averages over the identical paired rows), with a zero grounding sum producing no percentage. Also expose/display the paired covered-row count `n` so low coverage is visible. Do not mix the paired-population share with the broader `avg_grounding_ms` population.

No query, answer, claim, evidence, title, DOI, topic, cache key or digest is added.

## UI

Grounding remains the primary step latency. When a valid paired-population share exists, show a subordinate annotation such as:

`support-check 420 ms · %35 of grounding · n=24`

If support-check is null/missing, show no percentage. If paired grounding is zero, show no percentage. Do not infer missing support-check time as zero.

This annotation is diagnostic, not an SLA and not a verification-success metric.

## Tests

- migration/persistence stores only nullable numeric `support_check_ms`;
- aggregation uses the same selected period/user/institution filters as grounding;
- share numerator and denominator use exactly the same rows where both timings are non-null;
- pre-migration/null support-check rows remain excluded rather than becoming zero;
- zero paired grounding never divides;
- covered-row count `n` accompanies any rendered percentage;
- content-free field allowlists include only numeric timing/aggregate fields;
- no global daily counter is used as the filtered share source.
