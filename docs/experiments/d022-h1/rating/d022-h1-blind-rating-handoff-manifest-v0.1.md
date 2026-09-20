# D022-H1 Blind Rating Handoff Manifest v0.1

Status: `REVIEW CANDIDATE — DO NOT START RATING BEFORE ACCEPTANCE + MERGE`

Source frozen pool SHA-256: `8e191f4d728467a788a55f24725ada21e4a563323dd5f72252b78d93b0ab47cb`  
Source freeze merge: `497a2cfec1eca20c9b776b7dbb47e9c377322108`

## Blind bundle

File: `d022-h1-blind-rater-bundle.json`  
Exact UTF-8 SHA-256: `892db2a3e08f7afc7672661bf28db1a1c953123572faf458e79744e0f7e5abdb`  
Items: 720 (`B0001` … `B0720`).

The bundle exposes only:
- bundle/holdout identity and source-pool hash,
- opaque sequential `item_id`,
- question,
- evidence pack with bundle-local `E01...` IDs,
- claim text.

It does **not** expose source claim/scenario IDs, stratum, author intent, domain metadata, construction-QA labels/features, or the source evidence IDs. Source records are deterministically reordered by raw claim-text ordering before opaque item IDs are assigned, so the frozen source scenario/claim sequence is not preserved in the rater bundle.

The separate `d022-h1-blind-id-map.jsonl` is an implementer/audit join artifact and **must not be supplied to either primary rater before both outputs are FINAL / LOCKED**.

## Rater isolation

Use exactly two primary raters from different model families. Supply each rater only:
1. the exact blind bundle bytes above;
2. its own exact prompt (`d022-h1-r1-prompt-v0.1.md` or `d022-h1-r2-prompt-v0.1.md`);
3. the rating output JSON Schema.

Neither rater receives the other rater's output, the blind-ID map, source pool, construction files, author intent, checker output, or post-rating analysis before locking.

No outside knowledge. No identity inference. No label repair after lock.

## Output contract

Each rater emits exactly one JSON object with:
`holdout_version, bundle_sha256, rater_id, ratings, status`.

Exactly 720 ratings, in bundle order, each containing only `item_id,label`. Labels are exactly `SUPPORTED | PARTIALLY_SUPPORTED | UNSUPPORTED`. Final status is exactly `FINAL / LOCKED`.

`scripts/d022-h1-rating-output-validate.mjs` independently binds each output to:
- the exact bundle SHA-256,
- expected rater ID,
- exact item count/order,
- unique item IDs,
- closed label vocabulary,
- final lock marker,
- closed key sets.

## Blindness QA

`scripts/d022-h1-blind-bundle-validate.mjs` checks count, opaque IDs, local evidence IDs, absence of forbidden metadata keys, source-pool identity, and a 720-row bijective blind-ID map.

The map is intentionally outside the rater-facing bundle. Repository visibility does not authorize a rater to inspect it; the primary prompt restricts the rater to the supplied frozen bundle.

## Ground-truth rule after both locks

Apply the already-frozen #126 rule without semantic adjudication:
- SUPPORTED / SUPPORTED -> primary supported
- UNSUPPORTED / UNSUPPORTED -> primary unsupported
- either PARTIALLY_SUPPORTED, or any disagreement -> challenge/disagreement; not primary binary.

No rater is shown hidden author intent for this operation.

## Boundary

This PR prepares rating handoff artifacts only. It does not authorize checker execution, expose checker outputs, alter the H1 pool, or change D-022 statistical/semantic acceptance rules. Rating begins only after independent review accepts and merges this exact handoff.
