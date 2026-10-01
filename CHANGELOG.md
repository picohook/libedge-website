# Changelog

All adopted LibEdge product releases will be recorded here.

The project did not have a canonical product-release ledger before 2026-09-28. Historical commits, deployments, PRs, and the existing `package.json` value are therefore not retroactively assigned product release versions.

## Unreleased\n\n### Added\n\n- Added super-admin Research usage visibility, institution-level Research seat management, content-free usage events, and input/output token-count aggregation.\n- Added a super-admin self-service registration toggle.\n- Added bounded staging Research Assistant load evidence and a manual, rollback-verified SageMaker capacity experiment for #263 diagnosis.\n\n### Changed\n\n- GitHub default/canonical development branch is now `staging`.\n- CI now runs for pull requests targeting any base branch.\n- D1 migration chain now includes `0048` through `0052` for Research telemetry, notification deletion policy, Research seats, usage events, and token counts.\n\n### Governance\n\n- Adopted permanent merge discipline: PR claim ↔ actual diff ↔ tests ↔ exact HEAD ↔ CI ↔ independent ACCEPT.\n- Production activation remains separately gated; staging Research supportCheck evidence does not authorize production.

## 0.9.0 — 2026-09-28

### Governance

- Adopted `0.9.0` as the first canonical LibEdge product baseline.
- Established explicit product version and release governance.
- Established that `package.json` version metadata is not, by itself, an adopted LibEdge product release.
- Production deployment and go-live remain separately gated; this baseline does not authorize either.
