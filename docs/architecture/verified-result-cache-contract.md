# Verified-result cache contract

Status: staging design contract for #502. This document does not enable caching.

## First implementation scope

The first verified-result cache MUST be **user-scoped**. Institution-wide and global reuse are explicitly out of scope until a separate privacy and authorization review approves them.

The first staging implementation MUST be disabled by default and MUST use a bounded TTL of **15 minutes**. TTL expiry is a cache miss; it is never permission to reuse a stale verification result.

## Trust identity

A reusable entry MUST bind all of the following in one versioned identity:

- user scope identifier;
- opaque cryptographic digest of the canonical research query; query text MUST NOT be persisted in the cache key;
- ordered/canonical evidence identities and evidence content/version fingerprints;
- generation model ID and prompt/generation-contract version;
- Fresh-Checker model, revision and manifest identity;
- checker threshold and D-023/decision-contract version;
- evidence-policy version and cache-schema version;
- relevant language and evidence-depth policy version.

The cache key MUST be derived from a canonical serialization of the complete identity. Missing fields, unknown versions, parse/schema failures, corruption, identity mismatch, authorization mismatch or TTL expiry MUST produce a cache miss.

## Authorization and fail-closed rules

A hit is usable only if the current requester is still authorized for the bound evidence under the current policy. Cache lookup MUST NOT bypass Research entitlement, evidence authorization, grounding policy, checker pins, threshold or D-023.

Any uncertainty is a miss followed by the normal live path. Cache failure MUST NOT turn a rejected or unverifiable request into an accepted answer.

## Payload and privacy

The cached payload may contain generated/verified research content, so it is not operational telemetry. It MUST remain within the user scope selected above and MUST NOT be copied into content-free Admin telemetry.

Operational telemetry may record only content-free cache outcomes such as hit, miss, stale, invalid and disabled.

## Budget and UX semantics

A valid hit consumes zero new Fresh-Checker invocations. A hit MUST be labeled operationally as reused verification; the UI MUST NOT imply that Fresh-Checker ran for the current request.

Cost and latency accounting MUST distinguish a verified-result cache hit from a live generation/check path.

## Deterministic invalidation tests

Before staging enablement, tests MUST prove a miss for each independent change to user scope, query digest, evidence identity/fingerprint/order, generation model/contract, checker model/revision/manifest, checker threshold/D-023, evidence policy/cache schema, language/evidence-depth policy, TTL, and current evidence authorization.

Tests MUST also prove that malformed/corrupt entries fail closed and that a valid hit performs no new checker invocation.

## Production boundary

No production enablement is authorized by this contract. Production remains gated by #399 and explicit maintainer authorization.
