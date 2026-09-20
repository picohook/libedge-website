# D022-H1 Primary Blind Rating Intake Report v0.1

Status: REVIEW CANDIDATE — no checker execution authorized by this artifact.

## Frozen references

- Holdout: `D022-H1`
- Blind bundle SHA-256: `892db2a3e08f7afc7672661bf28db1a1c953123572faf458e79744e0f7e5abdb`
- Rating handoff merge commit: `360f33d98640c450948da95146661f7435231cee`

## Locked rater outputs received

Both primary raters returned 720 ordered item labels for `B0001` through `B0720`, with the frozen bundle hash and `FINAL / LOCKED`.

### R1

- rater_id: `R1`
- raw received artifact SHA-256: `a18a83fb37cb77e70e22a1f0442fec76bef53452f2d72e3062806bbd0b5eb8ef`
- 720 ratings; 720 unique item IDs; order matches the blind bundle.
- SUPPORTED: 66
- PARTIALLY_SUPPORTED: 176
- UNSUPPORTED: 478
- No non-JSON prefix was present in the received text.

### R2

- rater_id: `R2`
- raw received artifact SHA-256: `9511489b10a76ff76d9429064acbd58ad20bbaf02f68e48eb604b3ff33e2b51e`
- 720 ratings; 720 unique item IDs; order matches the blind bundle.
- SUPPORTED: 150
- PARTIALLY_SUPPORTED: 90
- UNSUPPORTED: 480
- The received text contains a non-JSON prose prefix before the JSON object. Therefore the raw artifact does not satisfy the frozen “exactly one JSON object; no prose” output-format requirement.
- The labels are nevertheless FINAL / LOCKED and must not be revised. Any later machine-readable extraction must preserve the raw artifact and deterministically extract the existing JSON payload without changing labels or fields.

## Agreement and frozen consensus mapping

Exact label agreement: **443 / 720 = 61.527777...%**.

The already-frozen consensus rule is applied mechanically:

- SUPPORTED / SUPPORTED -> primary supported: **60**
- UNSUPPORTED / UNSUPPORTED -> primary unsupported: **350**
- any PARTIALLY_SUPPORTED or any disagreement -> challenge/disagreement: **310**

No semantic adjudication is performed.

The primary unsupported consensus count is 350, which is above the preregistered minimum of 300 needed for deterministic subset selection. This statement is only a count check; it is not checker execution and not a production acceptance result.

## Integrity and boundary

- Neither locked rater output may be revised after the fact.
- R2's format defect is recorded rather than repaired by the rater.
- A derived clean JSON payload, if created, must be explicitly marked derived and traceable to the immutable raw artifact hash.
- The source blind-ID map remains non-rater-facing.
- No candidate supportCheck/checker has been run against D022-H1 as part of this intake.
- No statistical threshold, consensus rule, holdout content, or rating label is changed here.
- The low exact agreement and the large R1/R2 difference in PARTIALLY_SUPPORTED usage are reported as observed facts, not reconciled post hoc.
