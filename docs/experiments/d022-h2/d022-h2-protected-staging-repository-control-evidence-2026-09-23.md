# D022-H2 protected-staging repository-control evidence — 2026-09-23

Status: **VERIFIED / PRE-CANONICAL-FREEZE**

## Source evidence

Operator exported the active GitHub repository ruleset JSON for `picohook/libedge-website`.

Exact uploaded JSON:
- bytes: 927
- SHA-256: `d18288c6a83ab63443d878e60c6f325866d1bae172fe128d520dd2cc7282ecd6`
- ruleset id: `23901296`
- name: `Protect staging`
- target: `branch`
- enforcement: `active`
- target ref: `refs/heads/staging`
- bypass actors: none

## Effective controls

The exported ruleset records:
- `deletion`: matching ref deletion is restricted.
- `non_fast_forward`: force pushes/non-fast-forward rewrites are blocked.
- `pull_request`: changes to the target branch require the pull-request path.
- required approving review count: 0.
- allowed merge methods: merge, squash, rebase.

## Freeze consequence

The required protected-`staging` repository-control condition is now evidenced: the target is explicit, enforcement is active, deletion and non-fast-forward rewrite are restricted, and no bypass actors are configured.

This record is mechanical evidence only. It does not itself open H2 authorship. Canonical freeze-manifest construction, independent review, and accepted manifest merge remain required.
