# D-016 — Next Rollout-Stage Preparation Follow-up

Status: `ACTIVE`

Date: 2026-09-11

## Reviewer classification

`ACCEPTED WITH MODIFICATION`

## Required modifications

### 1. Minimum temporal resolution

Track A capacity evidence must use an explicit minimum temporal resolution rather than the ambiguous phrase `sufficiently fine-grained`.

Accepted standard:

- per-request timestamps; or
- privacy-safe buckets no coarser than `2 seconds`.

Evidence coarser than 2-second buckets does not support a defensible peak-rate claim against the locked `<=0.5 requests/second` guardrail because burst traffic may be smoothed away.

If no source with per-request or <=2-second resolution is available, the correct outcome is:

`INSUFFICIENT EVIDENCE — BROAD ENABLEMENT REMAINS BLOCKED`.

### 2. Sampling/completeness must be explicit

A fine-grained source is not sufficient if it is sampled or incomplete in a way that can hide requests and understate the peak.

For Cloudflare Workers Logs specifically, account/environment state must verify:

- production logging/observability is enabled for the intended Worker and observation window; and
- effective `head_sampling_rate = 1.0` (100% head sampling), unless equivalent complete unsampled capture is independently demonstrated.

If `head_sampling_rate < 1.0`, the sampling rate is unknown, or completeness cannot be established, the source must not be used to claim the broad-enablement guardrail is satisfied.

Required outcome:

`INSUFFICIENT EVIDENCE — BROAD ENABLEMENT REMAINS BLOCKED`.

The reviewer specifically noted that dashboard-side sampling may exist even when no corresponding setting appears in `wrangler.toml`; repository state alone therefore cannot prove log completeness.

## Other reviewer conclusions

The reviewer accepted:

- rejection of daily averages/totals as peak-rate evidence;
- rejection of minute-level/coarser averages as peak-rate evidence;
- privacy-safe production telemetry / Cloudflare-native analytics / equivalent independently reviewable sources as valid evidence classes if they meet both temporal-resolution and completeness requirements;
- separation of Track A capacity evidence from Track B production D1 migration preparation;
- migration-first discipline;
- byte-identical migration verification;
- explicit production D1 binding verification;
- hard STOP on any unexpected pending production migration;
- no semantic enablement bundled with production migration;
- the rule that Track A may depend on Track B only if no existing privacy-safe source can provide the required evidence quality.

## Authorization boundary

With the required temporal-resolution and sampling/completeness modifications incorporated into the canonical preparation/discovery records, the reviewer authorizes only:

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

## Canonical implementation of modifications

Preparation standard:

`docs/architecture/p05-production-rollout-stage-preparation.md`

Temporal-resolution commit:

`c76b8f98caa20f3468f673931e61a6387c6dd5f1`

Sampling/completeness follow-up commit:

`0e65fc36dce8fcc5a2a64a22d1966ed679ba9952`

Evidence-source discovery:

`docs/architecture/p05-production-capacity-evidence-discovery.md`

Sampling/completeness discovery update commit:

`576c1391c6a432d1e9de60d01b2797ef7888b9ae`
