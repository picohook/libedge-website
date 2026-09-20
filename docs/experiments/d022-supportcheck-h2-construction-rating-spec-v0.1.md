# D-022 supportCheck — H2 Construction and Rating Operational Specification v0.1

Status: `PROPOSED / INDEPENDENT REVIEW REQUIRED BEFORE ANY H2 RECORD IS AUTHORED`

Prepared: 2026-09-20

Upstream:
- `docs/experiments/d022-supportcheck-h2-preregistration-v0.1.md`
- frozen D-022 H1/H2 predecessor artifacts referenced there.

## Purpose and hard boundary

Operationalize every carry-forward required by the accepted H2 successor preregistration before H2 authorship begins.

**No H2 scenario, evidence item, claim, author_intent value, or candidate checker implementation may be authored under this specification until this artifact and all prerequisite identity/inventory artifacts below are independently reviewed and merged.**

## Prerequisite A — H1 rater identity attestation

The H1 blind prompts intentionally did not request provider/model identity. H2's same-rater exclusion therefore requires a separate operator-attested identity record.

Before H2 authorship, create and merge:
`docs/experiments/d022-h2/h1-rater-identity-attestation.json`

Exact schema:
`{"record_version":"D022-H2-H1-RATER-ID-V1","r1":{"model_family":"...","model_identity_version":"...","attested_by":"...","attested_at":"..."},"r2":{"model_family":"...","model_identity_version":"...","attested_by":"...","attested_at":"..."},"status":"FINAL / LOCKED"}`

Rules:
- values come from operator/session records, not inference from writing style;
- unknown values are literal `"UNKNOWN"`, never guessed;
- SHA-256 of canonical UTF-8/NFC/compact-JSON/LF bytes is recorded in the H2 manifest;
- if either model identity/version is UNKNOWN, that unknown identity cannot be used as an H2 primary rater unless independent evidence first resolves the identity and a new reviewed attestation version is frozen;
- a model identity/version recorded for H1 is excluded from H2 primary rating even in a new session;
- any person/model instance with H1 claim-level exposure is separately excluded regardless of identity string.

## Prerequisite B — reviewer-owned H1 structural inventory

Before H2 authorship, an eligible independent inventory reviewer constructs an H1 structural inventory using only the frozen H1 pool and construction metadata, **not H1 rater labels or consensus rows**.

The inventory:
- enumerates abstract evidence→claim transformations present in H1 across all strata;
- assigns immutable IDs `H1T001...`;
- defines each transformation in topic-independent terms;
- lists H1 claim IDs instantiating it;
- is canonical JSONL, independently reviewed, SHA-256 hashed and merged;
- is FINAL / LOCKED before any H2 template taxonomy or record is authored.

The inventory reviewer may not be an H1 primary rater, may not have inspected H1 claim-level consensus, and may not later author/audit/rate H2 or implement the H2 candidate checker.

Direct or renamed structural equivalents of inventory transformations are forbidden in H2.

## Role-separation matrix

For this H2 round the following roles are mutually exclusive in **either direction and regardless of chronological order**:
- H2 author;
- H2 construction/template auditor;
- H2 primary rater R1;
- H2 primary rater R2;
- H2 candidate-checker implementer/tuner.

No person, AI model instance/session, or agent may hold more than one of those roles. A model identity may be reused across author/auditor/checker roles only in a future separately preregistered round; not H2. H1 exclusions add to, rather than replace, this matrix.

Parallel checker development is permitted only by an isolated checker implementer who receives no H1 artifact and no H2 holdout text, author_intent, QA metadata, audit material, labels, consensus, or subset membership.

## H2 reasoning-template taxonomy freeze

Before H2 claim authorship, create a closed taxonomy file with immutable IDs `H2T001...`. Each entry must contain:
- `template_id`;
- topic-independent evidence condition;
- topic-independent claim transformation;
- bright-line inclusion rule;
- bright-line exclusion rule;
- explicit statement of non-equivalence to every potentially adjacent H1 structural-inventory entry.

The taxonomy is independently reviewed, canonicalized, hashed and merged before H2 authorship. No template may be added, split, merged, renamed, or redefined after H2 authorship begins.

The accepted preregistration caps remain binding: >=12 distinct templates in every U1-U6 stratum and in supported/partial pools; <=12/120 per negative stratum; <=10% of supported and partial pools per template.

## Audit seed — commit/reveal only

H2 uses **reviewer commit-then-reveal nonce**, not reviewer-chosen plaintext after seeing the snapshot and not an external beacon.

Before seeing the candidate snapshot hash or contents, the eligible construction auditor:
1. generates an unpredictable 32-byte nonce;
2. publishes/commits `SHA256(nonce)` as the seed commitment.

After authors commit the immutable candidate snapshot:
3. auditor reveals the nonce;
4. validator verifies the reveal hashes to the pre-snapshot commitment;
5. `audit_seed = lowercase hex nonce`.

The commitment timestamp/commit must precede the candidate-snapshot commit. Any mismatch, premature reveal, replacement commitment, or evidence that the auditor saw the candidate snapshot before commitment fails H2 construction.

For the single permitted revision cycle, the auditor must create a **new** nonce commitment before seeing the revised snapshot. The first nonce cannot be reused.

## Frozen audit-class literals

Rubric-boundary classes:
- `U1_AUDIT`
- `SUPPORTED_AUDIT`
- `PARTIAL_AUDIT`

Template-assignment classes:
- `U1_TEMPLATE_ASSIGNMENT`
- `U2_TEMPLATE_ASSIGNMENT`
- `U3_TEMPLATE_ASSIGNMENT`
- `U4_TEMPLATE_ASSIGNMENT`
- `U5_TEMPLATE_ASSIGNMENT`
- `U6_TEMPLATE_ASSIGNMENT`
- `SUPPORTED_TEMPLATE_ASSIGNMENT`
- `PARTIAL_TEMPLATE_ASSIGNMENT`

No other literal or alias is valid.

Ranking input is exactly:
`snapshot_sha256 + ":" + audit_seed + ":" + audit_class + ":" + claim_id`

Rank ascending by lowercase hexadecimal SHA-256 digest; ties break lexicographically by claim ID.

Every template-assignment class selects exactly 12 claims from exactly 12 distinct scenarios. The prior phrase "where possible" is removed: failure to obtain 12 distinct scenarios is construction failure.

## Audit decision and revision

The independent auditor is sole defect decision-maker for the construction screen. Authors cannot override a defect.

No informal semantic feedback from the auditor is permitted before the first snapshot.

A rubric-boundary or template-assignment defect requires class-wide/template-wide remediation, not sampled-item-only repair. Revisions may be made **only against rules already frozen before the first snapshot**; no rule, taxonomy, template definition, audit criterion, intended label, or sampling algorithm may change during remediation.

Exactly one revision cycle is allowed. A second-audit defect closes H2 and requires a successor version.

The audit is a gross-failure screen, not statistical assurance of a low unsampled defect rate.

For template assignment, the auditor verifies:
1. sampled claim instantiates its declared frozen H2 template;
2. declared template is not structurally equivalent to any locked H1 inventory transformation.

Within-H2 template distinctness is established at the **pre-authorship taxonomy review**, which must explicitly compare every pair of H2 template definitions and reject semantic duplicates. The assignment audit does not independently re-prove pairwise taxonomy distinctness.

## H2 pool and composition

The accepted H2 preregistration remains controlling:
- 1,080 claims total;
- 720 intended UNSUPPORTED =120 each U1-U6;
- 240 intended SUPPORTED;
- 120 intended PARTIALLY_SUPPORTED;
- 180 scenarios ×6 claims;
- all scaled composition, domain, evidence-contribution, anti-clone and cross-version rules remain unchanged.

Canonical record schema and byte serialization are inherited unchanged except `holdout_version = D022-H2`.

## Primary-rater identity and instrument freeze

Before H2 authorship, freeze a rating manifest that names:
- R1 model family and exact model identity/version;
- R2 model family and exact model identity/version;
- proof they are different model families;
- proof neither matches an excluded H1 identity/version;
- role/exposure attestations showing neither participated in H2 authorship, inventory, construction audit, checker implementation, nor had H1 claim-level exposure.

If a planned rater identity changes after authorship begins, H2 stops and requires a new successor version. This prevents post-authorship rater selection.

Both raters receive identical rubric/instructions and byte-identical blind content; only `rater_id` differs.

## Deterministic batching

Freeze exactly **12 batches of 90 items** each.

After the blind bundle is deterministically ordered by opaque `item_id`, batches are contiguous:
- batch 01 = items 0001-0090;
- ...
- batch 12 = items 0991-1080.

Both raters receive identical batch boundaries and order. No adaptive rebatching is permitted.

Each batch output schema contains:
`holdout_version,bundle_sha256,rater_id,batch_id,first_item_id,last_item_id,ratings,status`

`status` must equal `FINAL / LOCKED`. Ratings must contain exactly 90 unique expected item IDs in exact order and one allowed label each.

## Raw output, validation, retry and stop policy

Every first-attempt raw batch is preserved byte-for-byte where the interface permits and hashed before derivation.

A first attempt is invalid if it is truncated, incomplete, malformed, contains wrong/missing/duplicate IDs, invalid labels, wrong metadata/status, or violates the frozen exact-output contract.

**Exactly one whole-batch retry is allowed** for an invalid first attempt:
- identical blind input, prompt, model identity/version and configuration;
- same complete 90-item batch;
- no partial continuation;
- no selective item re-query;
- no prompt repair;
- no temperature/config change;
- symmetric policy for R1 and R2.

The invalid first attempt remains immutable provenance and contributes **zero** labels. Parseable labels from it are never mixed with retry labels.

The retry must itself validate as a complete batch. **Any invalid retry immediately closes D022-H2.** No third attempt, alternate model, manual completion, extraction invented after the fact, or selective salvage is allowed.

A pre-frozen deterministic extraction may be applied only if the exact extraction algorithm and its acceptance conditions are included in the rating validator before authorship. Otherwise any surrounding prose makes the attempt invalid.

H2 stop conditions therefore explicitly include: `second attempt for any rater batch is invalid`.

## Rater output assembly

Only validated batch artifacts are assembled. Concatenate batches 01→12 deterministically, verify all 1,080 opaque IDs occur exactly once in global order, then hash the assembled artifact.

Once a valid batch is FINAL / LOCKED its labels cannot be revised or rerun for semantic reasons.

Consensus is computed only after both complete assembled rater artifacts are locked. Frozen exact-agreement mapping and minimum-yield stop conditions remain unchanged.

## Yield reporting

Report eligibility yield:
- overall;
- separately U1-U6;
- supported;
- challenge/disagreement.

Any H1↔H2 yield comparison is **descriptive only** because construction, rater instrument and/or model pair may differ. It must not be presented as a causal estimate of improvement.

## Checker separation

The candidate checker must be frozen before receiving H2 holdout text or any H2 construction/rating artifact. Checker implementer identity and role attestation are recorded.

A checker implementer is prohibited from later becoming an H2 author, inventory reviewer, construction auditor, or primary rater, just as those roles are prohibited from later becoming checker implementers.

No H1 artifact may be used for checker training/tuning/tests except aggregate methodology statistics explicitly recorded in the closed H1 intake report.

## Stop conditions

All #126 and accepted H2 preregistration stop conditions remain active. Additionally H2 closes and requires a successor version if:
- prerequisite H1 identity attestation or H1 structural inventory is missing/unfrozen;
- planned H2 rater identities are not frozen before authorship;
- role separation is violated in either direction;
- audit commitment/reveal chronology or hash verification fails;
- an audit class cannot supply the required distinct-scenario sample;
- second audit contains any defect;
- a revision changes anything outside already-frozen construction rules;
- any second-attempt rater batch is invalid;
- any rater identity/model/configuration changes after authorship begins;
- checker development receives prohibited H1/H2 artifacts or checker output influences H2.

## Decision boundary

This specification authorizes **no H2 authorship yet**. H2 authorship becomes eligible only after:
1. this specification is independently accepted and merged;
2. H1 rater identity attestation is frozen;
3. H1 structural inventory is frozen;
4. H2 reasoning-template taxonomy is frozen;
5. H2 primary-rater identity/instrument/batching manifest is frozen;
6. required validators/tests for these artifacts are independently reviewed.

Even then, successful H2 construction/rating would not authorize checker deployment or production.

## Next action

Independent full methodology review of this operational specification. Do not author H2 records while it is under review.
