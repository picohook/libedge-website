# D022-H1 Primary Blind Rating Intake Report v0.1

Status: **H1 STOPPED under the frozen holdout rules.** No checker execution is authorized.

## Frozen references

- Holdout: `D022-H1`
- Blind bundle SHA-256: `892db2a3e08f7afc7672661bf28db1a1c953123572faf458e79744e0f7e5abdb`
- Rating handoff merge commit: `360f33d98640c450948da95146661f7435231cee`

## Immutable raw rater artifacts and derivation

The exact received texts are preserved in:
- `results/d022-h1-r1-locked.raw.txt` — SHA-256 `a18a83fb37cb77e70e22a1f0442fec76bef53452f2d72e3062806bbd0b5eb8ef`
- `results/d022-h1-r2-locked.raw.txt` — SHA-256 `9511489b10a76ff76d9429064acbd58ad20bbaf02f68e48eb604b3ff33e2b51e`

Deterministic derivation is implemented by `scripts/d022-h1-rating-derive.mjs`. It extracts the first complete JSON object bounded by the first `{` and last `}`, parses it, verifies literal rater ID, `FINAL / LOCKED`, 720 ratings, unique IDs and exact B0001-B0720 order, and writes canonical one-line JSON plus the consensus JSONL. It does not alter any label.

Derived files:
- `results/d022-h1-r1-locked.normalized.json`
- `results/d022-h1-r2-locked.extracted.json`
- `results/d022-h1-r1-r2-consensus.jsonl`

R1 raw input contains only the JSON payload plus line ending. R2 raw input contains a prose prefix, so the raw R2 artifact violates the frozen “exactly one JSON object; no prose” output-format requirement. The R2 labels remain FINAL / LOCKED; the derived JSON is an extraction, not a rater revision.

## Locked label counts

R1: 66 SUPPORTED / 176 PARTIALLY_SUPPORTED / 478 UNSUPPORTED.
R2: 150 SUPPORTED / 90 PARTIALLY_SUPPORTED / 480 UNSUPPORTED.

Exact label agreement: **443/720 = 61.527777...%**.

Frozen consensus mapping produces:
- primary supported: **60**
- primary unsupported: **350**
- challenge/disagreement: **310**

No semantic adjudication is performed.

## Unsupported consensus by frozen stratum

- U1_NEAR_MISS: **0**
- U2_SCOPE_SHIFT: **71**
- U3_CAUSAL_MECHANISTIC: **69**
- U4_TEMPORAL_GENERALIZATION: **67**
- U5_CONFLICT_SIDE: **63**
- U6_CITATION_SEMANTIC_MISMATCH: **80**

## Frozen stop-condition result

The frozen statistical design requires at least 300 consensus-UNSUPPORTED overall, at least 50 consensus-UNSUPPORTED in **each** unsupported stratum, and at least 100 consensus-SUPPORTED.

H1 has 350 consensus-UNSUPPORTED overall, but it has only **0 U1_NEAR_MISS consensus-UNSUPPORTED** and only **60 consensus-SUPPORTED**. Therefore two frozen stop conditions are triggered.

**D022-H1 holdout construction fails and is closed for primary checker evaluation. A new holdout version is required.** Cases may not be added to H1 after seeing these ratings, and the frozen thresholds or consensus rule may not be weakened.

## Boundary

- Neither locked rater output is revised.
- No checker has been run against H1 as part of this intake.
- H1 labels must not be used to tune the candidate checker.
- No statistical threshold, consensus rule, or H1 holdout content is changed.
- The low exact agreement and large difference in PARTIALLY_SUPPORTED usage are retained as observed limitations.
- Any successor H2 construction must be separately preregistered/frozen before rating and must not amend H1 in place.
