# P0.5 Assistant — Research Gaps UI Boundary

Status: `UI BOUNDARY DECISION — FIXTURE ONLY`

Date: 2026-09-15

## Decision

The `Research Gaps / Araştırma boşlukları` concept remains fixture/conceptual UI only for the current assistant prototype.

No live API binding is authorized in this decision.

## Why this boundary exists

The current grounding invariant is intentionally all-or-nothing:

- a successful assistant response is render-ready only when all returned claims are grounded;
- if grounding rejects any claim, the public result does not expose a partial claim set as a successful answer;
- the render-ready `evidence` payload is emitted only on the fully grounded success path.

The internal orchestrator may calculate rejection information while validating claims, but that information is not part of the public assistant API contract today.

A first-class `Research Gaps` UI, by contrast, naturally suggests partial-answer semantics such as “this part is supported, this part is missing/uncertain.” Binding the current UI to internal rejection details without a separately reviewed contract would silently weaken or bypass the existing all-or-nothing boundary.

Therefore the prototype must not infer, synthesize, or display live research-gap conclusions from internal/rejected claim data.

## Current UI rule

For the current prototype:

1. the visible Research Gaps examples are fixture content only;
2. the UI must label that state clearly enough that it is not mistaken for a live backend result;
3. selecting the `Boşlukları Bul` mode may explain that a dedicated minimized contract is not yet available;
4. no `rejected_claims` field is requested, assumed, reconstructed, or exposed;
5. no backend/orchestrator/provider/gate behavior changes as part of this decision.

## Live API state remains fail-closed

The real `/api/assistant/ask` path remains governed by the Provider Privacy Gate. While the gate is `UNVERIFIED`, the UI must not present fixture content as if it were the result of a successful provider-backed request.

The existing `EVIDENCE_PAYLOAD_REQUIRED` fail-closed behavior remains unchanged.

## Deferred contract question

If live Research Gaps becomes a product requirement, it requires a separate design review before implementation.

One candidate is a minimized rejection summary that does **not** expose raw rejected claim text or provider/model material, for example only reviewed aggregate/category information. That is only a future design candidate, not an approved schema.

Any such contract must answer at least:

- whether partial-answer semantics are being introduced at all;
- which rejection categories are safe and stable enough to expose;
- whether counts/categories could leak sensitive query or model behavior;
- how the public response distinguishes a fully grounded answer from diagnostic/gap metadata;
- whether the all-or-nothing grounding invariant itself changes or remains intact.

## Decision boundary

This decision authorizes only fixture-boundary UI clarification and documentation.

It does **not** authorize:

- `rejected_claims` exposure;
- assistant API contract changes;
- partial-grounding responses;
- provider/model activation;
- Provider Privacy Gate changes;
- semantic-primary / D-016 changes;
- production observability/logging changes during the active Track A window.
