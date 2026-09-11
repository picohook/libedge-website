# D-016 — Pacing / Observability Correction Review

Status: `HISTORICAL — ACCEPTED WITH MODIFICATION`
Date: 2026-09-11
Related incident: `docs/reviews/2026-09-11-d016-staging-semantic-smoke-incident.md`

## Classification

`ACCEPTED WITH MODIFICATION`

The reviewer accepted the two narrow correction directions:

1. increase the global semantic Durable Object grant interval from 1000 ms to a conservative 1500 ms;
2. expose existing privacy-safe aggregate research telemetry through the existing super-admin-only `/api/admin/system-health` surface.

No semantic retry or staging flag enablement was authorized by this review.

## Required modifications / checks

Before any semantic retry:

1. check whether another process using the same OpenAlex account/key could have overlapped the incident window, because an account-wide 1 request/second semantic limit can be exceeded by a process outside the Durable Object path;
2. the telemetry read path must reuse `RESEARCH_TELEMETRY_METRICS` / the existing telemetry allowlist as the single source of metric names rather than introducing a second hand-maintained list;
3. update the deterministic pacer boundary test from 999/1000 ms to 1499/1500 ms;
4. test that non-super-admin callers are rejected by the health surface;
5. test that the returned research telemetry contains only allowlisted aggregate metrics and no query/user/topic/result content.

## Shared-key / concurrent-process check

Repository evidence was checked before the correction was finalized:

- both P0.5 provider-retrieval workflows that use `${{ secrets.OPENALEX_API_KEY }}` are `workflow_dispatch`-only;
- GitHub Actions reports only two `workflow_dispatch` runs on the staging branch in the accessible history, both on 2026-09-06 and unrelated to the 2026-09-11 incident window;
- therefore there is no evidence of a concurrent repository GitHub Actions retrieval job using the staging OpenAlex secret during the semantic smoke window.

This narrows but does **not** eliminate the alternative-concurrency hypothesis. The control plane cannot inspect secret values and therefore cannot prove whether the Worker secret and Actions secret are byte-identical, nor can it exclude non-GitHub/external use of the same OpenAlex account/key. The 1500 ms margin is therefore treated as a pragmatic correction for the observed boundary sensitivity, not proof that grant-to-fetch jitter was the unique root cause.

## Decision boundary

This review authorizes correction code and tests with semantic-primary remaining OFF. It does not authorize another controlled semantic smoke, staging flag ON, production changes, relevance retuning, H/RRF, or Vectorize.
