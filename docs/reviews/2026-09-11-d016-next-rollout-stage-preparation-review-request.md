# D-016 — Next Rollout-Stage Preparation Review Request

Status: `ACTIVE`

Date: 2026-09-11

## Implementer summary

The independently accepted controlled semantic retry closed the live pacing and telemetry-integrity findings. The next stage is deliberately split into two independent preparation tracks:

1. production traffic/capacity evidence for the locked `<=0.5 eligible research requests/second` broad-enablement guardrail;
2. production D1 telemetry migration preparation.

No production migration or semantic enablement is requested in this review.

## Authoritative raw material

Canonical proposal:

`docs/architecture/p05-production-rollout-stage-preparation.md`

Creation commit:

`3e10738fb448f9f8aba95b4764557b29c092678c`

Upstream closure acceptance:

`docs/reviews/2026-09-11-d016-controlled-semantic-retry-closure-acceptance.md`

Commit:

`97523431d9875a2b7a5918dcc2636c3f4aa80f7f`

Current state:

`docs/current-state.md`

Commit:

`f1bf9c5d9dad77f823fcd3f8bb461ed9d3140967`

The raw repository material is authoritative over this implementer summary.

## Review questions

Please independently inspect the fresh canonical files and answer:

1. Is the capacity-evidence standard strong enough to support the locked `<=0.5 req/s` broad-enablement guardrail?
2. Is rejecting daily aggregate totals/averages as insufficient for peak-rate evidence correct?
3. Are the listed acceptable evidence sources sufficiently privacy-preserving and independently reviewable?
4. Is the production D1 migration proposal correctly separated from semantic-primary enablement?
5. Are the mandatory production migration prechecks conservative enough?
6. Should an unexpected pending production migration be a hard STOP before any apply step?
7. Is it correct that a practical dependency may exist if no existing production analytics source can provide sufficiently fine-grained privacy-safe request timing?
8. Does either track need an additional blocker before work begins?
9. If accepted, may the main engineering thread proceed only to evidence collection for Track A and migration-execution planning for Track B, with no production changes yet?

## Required classification

Return exactly one:

- `ACCEPTED`
- `ACCEPTED WITH MODIFICATION`
- `REJECTED`

Also report any material:

- `OUT-OF-SCOPE FINDING`

## Decision boundary

`ACCEPTED` authorizes only:

- Track A evidence-source discovery / evidence collection that does not change production behavior;
- Track B production migration execution planning and reviewer packet preparation.

It does **not** authorize:

- applying production D1 migration;
- changing production semantic-primary flag;
- broad production rollout;
- another semantic retry;
- relevance retuning;
- H/RRF;
- Vectorize.

## REVIEWER PACKET COMPLETENESS ATTESTATION

Packet ID:
`P05-D016-NEXT-ROLLOUT-STAGE-PREPARATION-2026-09-11`

Branch/ref:
`staging`

RAW MATERIALS

[x] Canonical rollout-stage preparation proposal — accessible repository file — current intended version — commit `3e10738fb448f9f8aba95b4764557b29c092678c`.
[x] Controlled semantic retry closure acceptance — accessible repository file — current intended version — commit `97523431d9875a2b7a5918dcc2636c3f4aa80f7f`.
[x] Current state — accessible repository file — current intended version — commit `f1bf9c5d9dad77f823fcd3f8bb461ed9d3140967`.
[x] Reviewer is instructed to refresh repository state and inspect fresh contents, not merely confirm commit existence.

CONSISTENCY

[x] No claim such as attached/pasted/included is false.
[x] Implementer summary is separated from raw material.
[x] Raw material is authoritative over the summary.
[x] Reviewer may report OUT-OF-SCOPE FINDING items.
[x] No production migration is claimed or implied as authorized.
[x] No production semantic enablement is claimed or implied as authorized.

RESULT: COMPLETE
