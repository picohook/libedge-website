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

Therefore the repository itself does not prove that a pre-existing production source with per-request or <=2-second resolution is available.

## Cloudflare-native candidate source

Current Cloudflare Workers documentation identifies Workers Logs as a native source containing invocation logs with timestamps and request metadata, and supports environment-specific observability configuration. This is a plausible Track A source **only if account-level production state confirms that the production Worker is already collecting unsampled or otherwise complete invocation logs sufficient to isolate the eligible research endpoint**.

This discovery record does not assume that production observability is currently enabled, complete, or unsampled.

Workers Metrics / coarse time-series analytics must not be treated as sufficient unless the actual queried source demonstrably meets the accepted per-request / <=2-second resolution requirement.

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
- Cloudflare Workers Logs/native invocation logs: **CANDIDATE — ACCOUNT STATE NOT YET VERIFIED**.

Therefore Track A is not yet satisfied.

The next non-behavior-changing step is to verify whether the production Worker already has a Cloudflare-native log/observability source that:

1. covers the intended observation window;
2. is complete enough for a peak-rate statement;
3. provides per-request or <=2-second timing;
4. can isolate the eligible research endpoint;
5. can be queried/exported without content-bearing fields.

If no such existing source can be verified, the correct Track A outcome remains:

`INSUFFICIENT EVIDENCE — BROAD ENABLEMENT REMAINS BLOCKED`

and any new instrumentation must be separately proposed and reviewed before deployment.

## External source check

Cloudflare Workers documentation rechecked 2026-09-11:

- Workers Logs: invocation logs include request/response metadata and are presented with timestamps; environment-specific observability can be configured.
- Workers observability documentation identifies Workers Logs, real-time logs, Tail Workers, and Logpush as available observability mechanisms.

These sources establish product capability only; they do not establish this account's current production configuration.
