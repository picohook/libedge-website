# D-016 — Next Rollout-Stage Preparation Follow-up

Status: `ACTIVE`

Date: 2026-09-11

## Reviewer classification

`ACCEPTED WITH MODIFICATION`

## Required modification

Track A capacity evidence must use an explicit minimum temporal resolution rather than the ambiguous phrase `sufficiently fine-grained`.

Accepted standard:

- per-request timestamps; or
- privacy-safe buckets no coarser than `2 seconds`.

Evidence coarser than 2-second buckets does not support a defensible peak-rate claim against the locked `<=0.5 requests/second` guardrail because burst traffic may be smoothed away.

If no source with per-request or <=2-second resolution is available, the correct outcome is:

`INSUFFICIENT EVIDENCE — BROAD ENABLEMENT REMAINS BLOCKED`.

## Other reviewer conclusions

The reviewer accepted:

- rejection of daily averages/totals as peak-rate evidence;
- privacy-safe production telemetry / Cloudflare-native analytics / equivalent independently reviewable sources as valid evidence classes if they meet the temporal-resolution requirement;
- separation of Track A capacity evidence from Track B production D1 migration preparation;
- migration-first discipline;
- byte-identical migration verification;
- explicit production D1 binding verification;
- hard STOP on any unexpected pending production migration;
- no semantic enablement bundled with production migration;
- the rule that Track A may depend on Track B only if no existing privacy-safe source can provide the required temporal resolution.

## Authorization boundary

With the required temporal-resolution modification incorporated into the canonical preparation record, the reviewer authorizes only:

- Track A evidence-source discovery / evidence collection that changes no production behavior;
- Track B production-migration execution planning and reviewer-packet preparation.

This review does **not** authorize:

- applying the production D1 migration;
- production semantic-primary enablement;
- broad production rollout;
- another semantic retry;
- relevance retuning;
- H/RRF;
- Vectorize.

## Canonical implementation of modification

`docs/architecture/p05-production-rollout-stage-preparation.md`

Follow-up commit containing the explicit per-request / `<=2-second` requirement:

`c76b8f98caa20f3468f673931e61a6387c6dd5f1`
