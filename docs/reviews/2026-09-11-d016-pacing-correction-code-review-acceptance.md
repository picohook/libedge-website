# D-016 Pacing / Observability Correction — Independent Code Review Acceptance

Status: `ACTIVE`

Date: 2026-09-11

## Scope

Independent review of the semantic-pacing and observability correction after the first controlled semantic staging smoke produced a live OpenAlex semantic `429` and staging was rolled back to semantic-primary OFF.

Reviewed code range:

- Base: `8b41b61befd858b56e9c6550513678cab4feefde`
- Head: `08edd0d85d1d041ab36065a4827ba2d247557509`

## Reviewer classification

`ACCEPTED`

The reviewer independently inspected the complete diff and confirmed:

1. pacing changed only from `1000 ms` to `1500 ms`, preserving the existing Durable Object serialization/storage/fail-closed design;
2. deterministic pacing tests now prove `1499 ms` remains blocked and `1500 ms` releases, with grant spacing asserted `>=1500 ms`;
3. `readResearchTelemetrySnapshot()` derives metric names directly from the existing `ALLOWED_METRICS` / `RESEARCH_TELEMETRY_METRICS` single source;
4. `/api/admin/system-health` remains protected by the existing super-admin authorization before the new research telemetry data can be returned;
5. the new system-health tests enforce non-super-admin rejection, exact metric-key equality with the shared allowlist, and absence of query/email/topic/DOI/title/result-content leakage;
6. the repository workflow investigation found no GitHub Actions retrieval workflow concurrent with the incident window while correctly retaining the limitation that non-repository/shared-account use cannot be excluded;
7. the flag-OFF staging deployment of the correction code is acceptable and does not itself close the live pacing finding.

## CI / deploy evidence carried forward

CI run `34565285661`:

- `23` test files PASS;
- `93` tests PASS;
- lint PASS;
- syntax PASS;
- staging Wrangler dry-run PASS;
- dry-run shows `RESEARCH_SEMANTIC_PRIMARY_ENABLED="false"`.

Flag-OFF staging deploy run `34565273515`:

- Quality gate PASS;
- staging deploy PASS;
- production deploy SKIPPED;
- deployed semantic flag remained OFF;
- Worker version recorded as `12b8a9e1-f3f3-487e-b556-59333c34b304`.

## Shared-key / concurrency finding

The reviewer accepted the investigation boundary:

- no repository GitHub Actions conflict was evidenced in the incident window;
- this does not prove byte-identical secrets or exclude independent/manual/non-GitHub consumers of the same OpenAlex account/key.

The `1500 ms` change is therefore accepted as a conservative operational safety margin, not as proof of a unique root cause.

## Governing boundary

This acceptance authorizes **retry preparation only**.

It does **not** authorize:

- staging semantic-primary flag ON;
- another live semantic request;
- production flag changes;
- broad production enablement;
- relevance testing or retuning;
- H/RRF;
- Vectorize.

`OOS-D016-CODE-01` remains `OPEN / BLOCKS SEMANTIC RETRY` until a separately authorized live retry demonstrates both:

- `semantic_pacing_wait_ms_total` delta `> 0`; and
- `semantic_429` delta `= 0`

for the controlled near-concurrent pair.

## Reviewer verification depth

The reviewer reported full code/test inspection and explicitly disclosed that GitHub API rate limiting prevented independent re-fetch of the CI/deploy runs in that session. The classification was based primarily on direct code/test verification, with the run evidence retained from the main engineering thread.

## Result

`ACCEPTED — retry preparation may proceed; retry execution remains separately gated.`
