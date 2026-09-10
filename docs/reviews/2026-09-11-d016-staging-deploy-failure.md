# D-016 — Staging Deploy Failure / Proposed Wrangler Correction

Status: `ACTIVE — CONFIG CORRECTION PENDING REVIEW`
Date: 2026-09-11
Deployment run: `34534642824`
Deployment commit: `4dc809efc9e8636d3af95e9e6a0e8c9422be257d`

## What happened

The reviewed D-016 implementation was deployed to the existing `Deploy Workers` workflow with `RESEARCH_SEMANTIC_PRIMARY_ENABLED=false`.

The workflow quality gate passed, but `Deploy backend to staging` failed at `npx wrangler deploy --env staging` before a new Worker version was published.

Cloudflare/Wrangler reported:

- the `OpenAlexSemanticPacer` Durable Object binding exists;
- the class is not provisioned because no Durable Object migration is configured;
- error code `10061`;
- Wrangler 4.86.0 also reports the top-level `[exports.OpenAlexSemanticPacer]` block as an unexpected field.

Therefore the failed deploy did not enable semantic-primary and did not publish the reviewed Worker revision to staging. Production deploy remained skipped.

## Root cause

The repository attempted to use the newer declarative Durable Object `exports` lifecycle syntax, but the project's installed Wrangler version (`4.86.0`) does not recognize that field. The same executable explicitly requests a legacy migration entry.

Cloudflare's current documentation supports both lifecycle models, but `exports` and legacy `migrations` are mutually exclusive. For compatibility with the repository's current Wrangler executable, the proposed correction uses the migration model requested by the actual deployment error.

## Proposed exact `wrangler.toml` correction

No runtime JavaScript, feature flag, binding name, rate limit, fallback rule, telemetry logic, cache behavior, or production rollout control changes.

Remove:

```toml
# New Durable Object namespaces use SQLite-backed storage.
[exports.OpenAlexSemanticPacer]
type = "durable-object"
storage = "sqlite"
```

Add immediately after the top-level Durable Object binding:

```toml
# Provision the new semantic pacing Durable Object namespace using the
# migration syntax supported by the repository's current Wrangler version.
[[migrations]]
tag = "v1-openalex-semantic-pacer"
new_sqlite_classes = ["OpenAlexSemanticPacer"]
```

The migration is top-level. Under Cloudflare's legacy migration rules, named environments inherit top-level migrations unless they explicitly override them; this repository currently defines no environment-level migration override.

## Why this is a deployment-config correction, not an architecture change

- D-016 remains LOCKED.
- `RESEARCH_SEMANTIC_PRIMARY_ENABLED` remains `false` in local, staging and production.
- `OPENALEX_SEMANTIC_PACER` remains the same named Durable Object binding.
- storage remains SQLite-backed through `new_sqlite_classes`.
- no semantic request can occur while the feature flag is off.
- broad production enablement remains unauthorized.

## Sequencing

Because `wrangler.toml` is a path watched by `.github/workflows/deploy-workers.yml`, committing this correction would itself trigger a staging deployment attempt.

Therefore the exact correction must be independently reviewed **before** it is committed.

After reviewer acceptance:

1. apply only the exact `wrangler.toml` diff above;
2. let the path-scoped staging deploy workflow run once;
3. verify quality gate + Cloudflare deploy result;
4. confirm semantic-primary remains OFF;
5. run baseline smoke checks;
6. do not enable semantic-primary until a later explicit authorization.

## Reviewer classification requested

- `ACCEPTED`
- `ACCEPTED WITH MODIFICATION`
- `REJECTED`

plus any material `OUT-OF-SCOPE FINDING`.

Last updated: 2026-09-11
