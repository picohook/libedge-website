# P0.5 Production Retrieval — Capacity Evidence-Source Discovery

Status: `ACTIVE`

Date: 2026-09-11

## Purpose

Determine whether an already-existing, privacy-safe production data source can support the locked D-016 broad-enablement guardrail:

`peak eligible research-query rate <= 0.5 requests/second`

This is evidence discovery only. It changes no production behavior and does not authorize production semantic-primary.

## Accepted temporal-resolution standard

Following independent reviewer modification, a source is acceptable only if it provides either:

- per-request timestamps; or
- privacy-safe buckets no coarser than `2 seconds`.

Any source coarser than 2 seconds is insufficient for the peak-rate claim because burst traffic may be smoothed away.

## Completeness / sampling standard

Temporal resolution alone is not sufficient. The evidence source must also be complete enough that the observed peak cannot be understated by sampling.

For Cloudflare Workers Logs or any equivalent sampled invocation source, account/environment state must independently demonstrate:

- logging/observability is enabled for the intended production Worker and observation window; and
- `head_sampling_rate = 1.0` (100% head sampling), or an equivalently complete unsampled capture can be proven.

A source with `head_sampling_rate < 1.0`, an unknown sampling rate, or otherwise unquantified sampling/incompleteness is **not acceptable** for proving the `<=0.5 requests/second` upper guardrail. Missing sampled requests could hide a true burst above the threshold.

Such a source must be classified:

`INSUFFICIENT EVIDENCE — BROAD ENABLEMENT REMAINS BLOCKED`.

No correction factor or silent extrapolation from a sampled subset may be used to claim the guardrail is satisfied unless a separately reviewed method can defensibly establish a true upper bound.

## Existing repo-controlled research telemetry

Current D1 research telemetry stores counters keyed by:

- UTC date;
- allowlisted metric name;
- aggregate numeric value.

`research_requests` therefore has daily-bucket semantics. `updated_at` records only the row's most recent update time and cannot reconstruct per-request timing or <=2-second request buckets.

Conclusion:

`CURRENT D1 RESEARCH TELEMETRY IS INSUFFICIENT FOR TRACK A PEAK-RATE EVIDENCE.`

No attempt should be made to infer peak rate from the daily counter.

## Wrangler / repository observability state

The current repository configuration contains no explicit Workers Analytics Engine binding and no explicit production Workers Logs/observability configuration in `wrangler.toml`.

Therefore the repository itself does not prove that a pre-existing production source with per-request or <=2-second resolution is available, and it does not prove the production account's effective `head_sampling_rate`.

## Cloudflare-native candidate source

Current Cloudflare Workers documentation identifies Workers Logs as a native source containing invocation logs with timestamps and request metadata, and supports environment-specific observability configuration. This is a plausible Track A source **only if account-level production state confirms that the production Worker is already collecting complete invocation logs sufficient to isolate the eligible research endpoint**.

For Workers Logs specifically, the account-state check must verify both:

1. production observability/logging is actually enabled for the intended Worker and observation window; and
2. effective `head_sampling_rate` is exactly `1.0` for that production source, unless another independently reviewable mechanism proves equivalent complete capture.

This discovery record does not assume that production observability is currently enabled, complete, or unsampled. Dashboard-side configuration must not be inferred from the absence or presence of repo configuration alone.

Workers Metrics / coarse time-series analytics must not be treated as sufficient unless the actual queried source demonstrably meets both:

- the accepted per-request / <=2-second temporal-resolution requirement; and
- the complete/unsampled evidence requirement above.

## Human account-state observation — 2026-09-11

The human gatekeeper inspected the production Worker in the Cloudflare dashboard and reported:

`Workers Observability is Disabled`.

This means the candidate Workers Logs path cannot provide an already-existing observation window for Track A. Because observability is disabled, there is no pre-existing complete invocation-log source whose `head_sampling_rate` can be relied upon for the required production peak-rate evidence.

This is not a process failure. It is a genuine evidence-availability limitation.

Current Track A classification:

`INSUFFICIENT EVIDENCE — BROAD ENABLEMENT REMAINS BLOCKED`.

Enabling new production observability/instrumentation would change production configuration and therefore requires a separate proposal and independent review before any such change is made.

## Privacy condition

Any candidate source used for final capacity evidence must avoid recording or exporting:

- query text;
- normalized query;
- user ID or email;
- research topic/interests;
- result content;
- DOI/title;
- raw request body.

Endpoint/path and timestamp metadata may be used only to the minimum extent necessary to count eligible research requests, subject to independent review of the exact source/query/export surface.

## Discovery conclusion

At this point:

- existing repo-controlled D1 telemetry: **INSUFFICIENT**;
- repository-proven Analytics Engine source: **NONE**;
- production Workers Observability / Workers Logs: **DISABLED** by direct human dashboard observation.

Therefore Track A is not satisfied and broad enablement remains blocked.

The next Track A action, if desired, is not to infer or extrapolate from existing data. It is to prepare a separately reviewed production observability/instrumentation proposal that can provide:

1. per-request or <=2-second timing;
2. complete/unsampled capture or another defensible upper-bound method;
3. eligible-endpoint isolation;
4. the existing privacy boundary.

Until such a proposal is reviewed and deployed, the required Track A conclusion remains:

`INSUFFICIENT EVIDENCE — BROAD ENABLEMENT REMAINS BLOCKED`.

## External source check

Cloudflare Workers documentation rechecked 2026-09-11:

- Workers Logs: invocation logs include request/response metadata and are presented with timestamps; environment-specific observability can be configured.
- Workers observability configuration supports `head_sampling_rate`; sampling below 1.0 can omit invocations from the log stream.
- Workers observability documentation identifies Workers Logs, real-time logs, Tail Workers, and Logpush as available observability mechanisms.

These sources establish product capability only; the human account-state observation establishes that Workers Observability is currently disabled for the production Worker.
