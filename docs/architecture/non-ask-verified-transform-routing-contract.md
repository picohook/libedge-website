# Non-Ask verified-input transformation routing contract

Status: design gate for #503. Non-Ask controls remain non-live until an implementation PR satisfies this contract.

## Current boundary

Today only Ask may invoke the live Research endpoint. Compare, Summarize, Gaps and Brief are presentation-only controls. Mode labels are never trust labels.

## Routing rule

Routing is proposition-based.

A **verified transform** may skip new discovery/generation/Fresh-Checker only when every factual proposition rendered to the user is a deterministic or restricted transformation of claims in an explicit prior verified-result bundle.

Anything that introduces a new factual proposition is **new_claim_grounded** and enters the normal current Research evidence, generation, grounding and Fresh-Checker path. If classification is uncertain, route to new_claim_grounded.

Gaps is not checker-free by mode. A statement that something is absent, missing, understudied or unsupported is itself a factual proposition and defaults to new_claim_grounded unless that exact absence proposition is already represented in the verified input.

## Verified input bundle

A transform request MUST carry an opaque prior verified-result identity that resolves server-side to:

- verified-result schema/version;
- originating user scope;
- verification timestamp/status;
- verified claim identities and text;
- evidence identities bound to each claim;
- generation/checker contract versions needed to establish that the source result was actually verified.

Client-supplied claims/evidence are never trusted as the verification record.

Before transformation, the server MUST reject missing, unknown, expired/stale, unverified, wrong-user-scope or otherwise invalid bundles.

## Proposition traceability

Every factual proposition emitted by verified_transform MUST be traceable to one or more verified input claim IDs. Citations may reference only evidence IDs already bound to those claims.

The transform path MUST NOT add external evidence IDs, silently perform discovery, or infer a new factual proposition from absence of evidence. If the requested output cannot be produced within those restrictions, fail closed or route the request through new_claim_grounded.

Pure formatting, ordering, shortening and extractive/abstractive compression are allowed only while preserving the supported meaning of the verified claims.

## Authorization and freshness

A prior verified identity is not an authorization token. Current Research entitlement and user scope are checked on every request. Revocation blocks reuse.

The implementation must define a bounded freshness window and invalidate reuse when the underlying verified-result contract says the source result is no longer reusable. No production enablement is implied by this document.

## Telemetry and history

Content-free route telemetry uses only:

- verified_transform
- new_claim_grounded

Do not log query, claim, answer, evidence text, verified-result IDs, cache keys or digests.

History/UI must distinguish a transformed prior verification from a newly grounded result; it must not imply that Fresh-Checker ran on the transform request.

## Required tests before live enablement

- each non-Ask mode remains unable to bypass this router;
- missing/stale/unverified/wrong-scope input fails closed;
- verified_transform cannot cite evidence outside the verified bundle;
- verified_transform cannot emit an untraceable factual proposition;
- Gaps with a new absence proposition routes to new_claim_grounded;
- new_claim_grounded exercises the normal grounding/checker boundary;
- route telemetry is allowlisted and content-free;
- production remains disabled until separately authorized under #399.
