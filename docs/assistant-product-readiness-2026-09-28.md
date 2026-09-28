# AI Assistant Product Readiness Gate

Status: `PROPOSED / INDEPENDENT REVIEW REQUIRED`

Date: 2026-09-28

## Purpose

Define the product-level evidence required before LibEdge requests production activation of the AI Assistant. This gate is separate from checker scientific validity, provider privacy, runtime integration, and deployment mechanics.

A green CI run, successful staging response, D-023 adoption, or checker privacy PASS does not by itself establish product readiness.

## P0 — user-visible grounding behavior

Production-readiness requires all of the following:

1. A successful answer exposes only claims that pass the all-or-nothing grounding contract and have valid outward evidence references.
2. Grounding rejection, checker unavailability/error/timeout/invalid response, unsupported language, provider failure, or evidence failure must not render an unverified partial answer.
3. The user receives a bounded failure state such as: **“Bu soruya yeterli kanıtla doğrulanmış bir yanıt oluşturamadım.”** The UI may offer verified-source discovery or a retry where safe, but must not imply that a rejected draft was trustworthy.
4. Fixture/demo content must never be presented as a live result.
5. Conflict/research-gap metrics that are not available from the live contract remain hidden.
6. A disabled or operationally paused checker must produce an explicit safe degraded behavior; there is no silent unchecked-answer fallback.

## P0 — privacy and feedback

1. Research queries/interests remain private under the existing LibEdge invariant.
2. No query text, evidence text, claims, topics, research interests, or user IDs are added to telemetry merely for product analytics.
3. A user-feedback control may be implemented, but a click/consent action alone does not authorize storing research-interest-bearing content.
4. Any feedback design that stores or links content requires its own reviewed privacy/storage/linkage specification before activation.
5. Aggregate product counters may be used only when consistent with the existing privacy decisions and must not reconstruct user research activity.

## P0 — operational safety

Before production authorization:

1. D-023 open-item requirements applicable to activation are adopted and implemented.
2. Checker-specific privacy gate is PASS for the exact runtime/hosting route.
3. Exact checker model/revision/manifest pin is enforced.
4. Staging operational-pause drill has been exercised.
5. Authenticated staging E2E has passed on the exact release candidate.
6. Rollback/fail-closed procedure has been exercised or otherwise evidenced on that candidate.
7. Production feature flag remains OFF until a separate human production authorization.

## P1 — latency, reliability, and cost evidence

The staging release candidate must record, without user-content logging:

- Assistant end-to-end p50 and p95 latency;
- checker-contribution p50 and p95 latency;
- checker timeout/error rate;
- grounded-success rate;
- fail-closed/rejection rate by coarse machine state, not topic;
- incremental checker cost per request and estimated monthly cost under the proposed rollout volume.

No universal numeric product SLO is invented by this record. Before production authorization, the human gatekeeper must accept the observed release-candidate measurements or adopt explicit numeric limits in a reviewed change.

## P1 — language expectation

The product must communicate or enforce the currently adopted supportCheck language boundary. An unsupported language must not silently enter the checker path and be presented as validated.

Expanding the language boundary requires the separately governed validation path; UI localization alone does not expand checker scope.

## P1 — responsibility / expectation text

Before external rollout, the Assistant experience must make clear, in concise product language, that:

- answers are generated from retrieved evidence and may be incomplete;
- users should inspect cited sources for consequential research decisions;
- failure to produce a grounded answer is preferable to presenting an unsupported answer.

This is product expectation-setting, not a disclaimer that weakens the grounding invariant.

## Rollout stages

### R0 — fail-closed baseline

- checker OFF or privacy gate not PASS;
- no unchecked generated answer reaches users.

### R1 — internal staging

Entry:

- exact runtime candidate available;
- checker privacy PASS;
- D-023 language boundary enforced;
- Trigger-B rule adopted;
- exact checker pin enforced.

Exit:

- CI/integration green;
- operational-pause drill PASS;
- authenticated staging E2E PASS;
- safe rejection UX verified;
- latency/reliability/cost evidence recorded.

### R2 — controlled production pilot

Requires separate human production authorization tied to an exact commit/config/runtime route and a defined limited rollout population or traffic fraction.

Exit toward wider rollout requires:

- no grounding/privacy P0 violation;
- operational monitoring healthy;
- rollback path available;
- observed latency/reliability/cost accepted;
- any D-023 trigger handled according to its adopted rule.

### R3 — wider production rollout

Requires a new human authorization after R2 evidence review. It is not automatic.

## Stop / rollback conditions

Pause new production reliance on the Assistant/checker and fail closed when:

- checker identity/pin mismatches;
- checker privacy status is not PASS;
- unsupported claims reach the UI;
- operational-pause mechanism fails;
- exact runtime route materially differs from the authorized route;
- D-023 Trigger A requires immediate action;
- Trigger B reaches its adopted escalation state;
- authenticated health/smoke checks fail materially after activation.

## Release evidence packet

A production-authorization request must identify:

- LibEdge product version;
- exact Git commit;
- checker model/revision/manifest;
- checker runtime/hosting route and privacy PASS record;
- answer-provider route and applicable privacy PASS;
- adopted D-023 language and drift records;
- CI run(s);
- staging operational-pause drill result;
- authenticated staging E2E result;
- latency/reliability/cost measurements;
- UX verification;
- rollout scope;
- rollback target;
- unresolved known risks.

## Non-goals

This record does not:

- authorize staging or production activation;
- grant checker privacy PASS;
- execute the deferred H2 holdout;
- authorize real-user content review;
- authorize Track A semantic-primary;
- declare LibEdge 0.9.0 production-ready.
