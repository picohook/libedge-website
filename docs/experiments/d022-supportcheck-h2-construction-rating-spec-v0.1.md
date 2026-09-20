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
- the attester must be an operator with direct access to the relevant session/account execution record; an H1/H2 rater, H2 author, inventory/taxonomy constructor or reviewer, auditor, checker implementer, or validator reviewer may not attest;
- the attestation receives independent review and is merged before the H2 freeze-manifest gate;
- values come from operator/session records, not inference from writing style;
- unknown values are literal `"UNKNOWN"`, never guessed;
- SHA-256 of canonical UTF-8/NFC/compact-JSON/LF bytes is recorded in the **freeze manifest**;
- if the H1 **family is known but identity/version is UNKNOWN**, the entire known family is excluded from H2 primary rating;
- if the H1 **family is UNKNOWN**, H2 cannot proceed until independent evidence resolves at least the family and a new reviewed attestation version is frozen;
- `model_family` means the provider-independent model lineage named by the operator record (for example, a ChatGPT/GPT lineage versus a Claude lineage), not a free-form string chosen for H2; the rating manifest must record the evidence used for family assignment and reviewers must verify that R1/R2 are different lineages;
- a known H1 model identity/version is excluded from H2 primary rating even in a new session;
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

Completeness/granularity gate:
- exactly all 720 H1 claim IDs must map to **one and only one** inventory transformation; missing or multiply mapped IDs fail mechanically;
- transformations must be abstracted at the evidence→claim operation level: changing only topic/entity/nouns/numbers/domain/stratum does not create a new transformation;
- entries that differ only by those surface substitutions must be merged;
- the inventory validator reports 720/720 coverage, uniqueness, per-template counts and cross-stratum membership.

The **inventory constructor** and **inventory reviewer** are separate eligible roles. The constructor produces the inventory; the reviewer independently checks the abstraction rule, complete mapping, and validator output before freeze. Neither may be an H1 primary rater, may not have inspected H1 claim-level consensus, and may not later author/audit/rate H2 or implement the H2 candidate checker.

Direct or renamed structural equivalents of inventory transformations are forbidden in H2.

## Role-separation matrix

For this H2 round the following substantive roles are mutually exclusive in **either direction and regardless of chronological order**:
- H1 inventory constructor;
- H1 inventory reviewer;
- H2 taxonomy author;
- H2 taxonomy reviewer;
- H2 author;
- H2 construction/template auditor;
- H2 primary rater R1;
- H2 primary rater R2;
- H2 candidate-checker implementer/tuner;
- H2 construction/rating validator author;
- independent validator/test reviewer;
- H1 identity-manifest attester;
- rater operator/conduit who executes prompts.

No person or AI model **identity/version** may hold more than one substantive role above in H2; a new session does not reset this separation. R1 and R2 must additionally be different model families. Also freeze two independent governance roles: **identity-attestation reviewer** and **freeze-manifest reviewer**. They may not hold any substantive role above and may not be the attester whose artifact they review.

The freeze manifest contains a **role roster** naming, for every substantive/governance role, the human/operator identifier where applicable, AI model family + exact identity/version where applicable, and role-specific H1-exposure attestation. H2 author and construction auditor must explicitly attest whether they have seen H1 pool text, author_intent, ratings, or consensus; any exposure prohibited by the accepted preregistration disqualifies them. The roster must also record the candidate checker's runtime model lineage (or `NON_MODEL`); any lineage overlap with a primary rater is reported as a correlated-error limitation in the final report.

No roster substitution, identity/version change, or newly discovered prohibited H1 exposure is permitted after the freeze-manifest gate; any such change stops H2 and requires a successor version.

Pure mechanical CI execution is not a substantive role if it has no discretion over content or results. H1 exclusions add to, rather than replace, this matrix.

Parallel checker development is permitted only if isolation is mechanically or attestably established **before any H2 pool artifact is committed to a location accessible to the checker implementer**. Choose exactly one mechanism in the freeze manifest:
1. **checker-first freeze:** checker code/configuration/prompt and dependency hashes are committed and independently reviewed before any H2 pool/QA text is committed to an accessible repository; the checker implementer also provides an independently reviewed H1 non-access attestation, except for the permitted aggregate H1 intake statistics; or
2. **workspace exclusion:** an independently reviewed attestation identifies a workspace/account that cannot access the LibEdge repository or H1/H2 artifacts and records the checker freeze hash before access is later broadened.

The checker implementer may receive only the aggregate methodology statistics explicitly quoted in the closed H1 intake report; that report is the sole H1 exception. No H1 pool, construction, rating, consensus, or derived artifact may be accessed.

## H2 reasoning-template taxonomy freeze

Before H2 claim authorship, create a closed taxonomy file with immutable IDs `H2T001...`. Each entry must contain:
- `template_id`;
- exactly one `target_pool` from `U1,U2,U3,U4,U5,U6,SUPPORTED,PARTIAL`;
- topic-independent evidence condition;
- topic-independent claim transformation;
- bright-line inclusion rule;
- bright-line exclusion rule;
- explicit statement of non-equivalence to every potentially adjacent H1 structural-inventory entry.

The taxonomy is independently reviewed, canonicalized, hashed and merged before H2 authorship. No template may be added, split, merged, renamed, moved between target pools, or redefined after H2 authorship begins. If the closed taxonomy cannot satisfy the frozen >=12-template and concentration caps during construction, H2 construction fails; the taxonomy may not be expanded to rescue the round.

The accepted preregistration caps remain binding: >=12 distinct templates in every U1-U6 stratum and in supported/partial pools; <=12/120 per negative stratum; <=10% of supported and partial pools per template.

## Freeze chronology and single gate manifest

Private or unpublished H2 record drafting before the gate is prohibited and is treated as contamination. "Authorship begins" means creation of the first H2 scenario/evidence/claim text in any workspace.

Prerequisites are frozen in this order on the protected `staging` ancestry:
1. this operational specification;
2. H1 identity attestation;
3. H1 structural inventory + validator/review;
4. H2 template taxonomy + pairwise-distinctness review;
5. H2 rating instrument/identity/batching manifest + prompt/schema/validator/config hashes;
6. construction/rating validators and tests.

Then create one canonical `d022-h2-freeze-manifest.json` containing the SHA-256 and merge commit of every prerequisite, the complete role roster/exposure attestations, the selected checker-isolation mechanism/evidence, and recorded repository-control evidence that the protected `staging` history rejects force-push/non-fast-forward rewriting. Independent review verifies every referenced commit is an ancestor of the manifest merge commit. **The merge commit of this freeze manifest is the authorship gate:** it must be an ancestor of the first commit containing any H2 authored record. This ancestry rule, not timestamps, establishes chronology. No prerequisite artifact referenced by the gate may change after the gate; any change requires a successor holdout version and a new gate.

## Audit snapshot definition

An audit snapshot is a canonical manifest whose hash commits to **every artifact the audit can read or whose mutation could affect an audit decision**:
- canonical candidate pool;
- scenario/domain metadata;
- reasoning_template_id assignments;
- U1 proposition-pair declarations;
- supported entailment traces;
- partial boundary traces;
- construction QA metadata;
- validator version/hash and its machine-readable QA output;
- the accepted freeze-manifest SHA-256.

Each component SHA-256 is listed in lexicographic path order; `snapshot_sha256` is SHA-256 of the canonical snapshot-manifest bytes. After seed reveal none of these components may change under that snapshot.

Chronology is by protected-`staging` commit ancestry only: the seed-commitment merge commit must be an ancestor of the candidate-snapshot merge commit, which must be an ancestor of the seed-reveal/ranking commit. Git author/committer timestamps are not evidence of order.

The deterministic validator—not the auditor—computes and commits the complete ranking and selected IDs immediately after valid reveal and **before the auditor receives selected content**.

If the auditor does not reveal the nonce within the frozen reveal window of **72 hours after the candidate-snapshot merge**, H2 construction stops; no replacement auditor/nonce is allowed for that snapshot. A successor version is required.

## Audit seed — commit/reveal only

H2 uses **reviewer commit-then-reveal nonce**, not reviewer-chosen plaintext after seeing the snapshot and not an external beacon.

Before any candidate snapshot is pushed to **any ref, PR, branch, workspace, or artifact store visible to the construction auditor**, the eligible construction auditor:
1. generates an unpredictable raw 32-byte nonce;
2. publishes/merges `SHA256(raw_nonce_bytes)` as the seed commitment on protected `staging`. The commitment stores the lowercase hexadecimal digest only.

Only after that commitment merge is an ancestor may authors push the candidate snapshot to an auditor-visible ref. After the immutable candidate snapshot is merged to protected `staging`:
3. auditor reveals the nonce;
4. validator verifies the reveal hashes to the pre-snapshot commitment;
5. `audit_seed = lowercase hex nonce`.

The **commitment merge commit ancestry** must precede the candidate-snapshot merge commit; timestamps are never used. Any mismatch, premature reveal, replacement commitment, or evidence that the auditor saw the candidate snapshot before commitment fails H2 construction.

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

Selection walk for every audit class: traverse the ranked list from first to last; select a claim only if its scenario has not yet been selected for that class; stop at the class quota. Rubric quotas are 24/24/12 as preregistered; every template-assignment class selects exactly 12 claims from exactly 12 distinct scenarios. The prior phrase "where possible" is removed: failure to obtain 12 distinct scenarios is construction failure.

## Audit decision and revision

The independent auditor is sole defect decision-maker for the construction screen. Authors cannot override a defect.

No informal semantic feedback from the auditor is permitted before the first snapshot.

A rubric-boundary or template-assignment defect requires **defect-pattern-wide remediation across every record to which the same frozen rule/template defect applies**, not sampled-item-only repair. The affected set must be derived mechanically when the violated frozen condition has a machine-identifiable key (including `template_id`, target_pool, subtype, domain, or other frozen metadata). For a semantic condition without a mechanical key, the auditor must explicitly approve the complete affected-record set **before any edits occur**. Authors cannot define the set unilaterally. "Class-wide" never means blindly editing every member of an audit class. Revisions may be made **only against rules already frozen before the first snapshot**; no rule, taxonomy, template definition, audit criterion, intended label, or sampling algorithm may change during remediation.

The revision log must list each defect, the frozen rule violated, whether the affected set was mechanically derived or auditor-approved, the complete affected-record set, auditor approval where required, and the before/after hashes. A deterministic diff-scope validator fails if a revision changes any record outside those logged affected sets or changes any frozen rule/taxonomy/audit artifact.

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

Before H2 authorship, freeze a **rating manifest** that names and hashes:
- R1/R2 model family and exact model identity/version, with evidence for family assignment and proof of different lineages;
- proof neither matches an excluded H1 identity/version/family rule;
- role/exposure attestations;
- exact evaluator prompt + rubric bytes and SHA-256;
- exact output JSON Schema and SHA-256;
- rating validator + tests and SHA-256;
- interface/provider endpoint and model configuration: temperature, max output tokens, thinking/reasoning mode, tools disabled, system/developer-message policy, and any other generation parameter exposed by the interface;
- blind-bundle construction algorithm and ordering algorithm;
- batch-file hashes after bundle construction, recorded before rating.

**Rubric semantics are frozen to H1.** H2 evaluator instructions may change only for format/transport/batching mechanics required by this spec. Every textual delta from the H1 semantic rubric must be enumerated with a reviewer finding that it is format-only and does not alter SUPPORTED/PARTIALLY_SUPPORTED/UNSUPPORTED semantics.

If a planned rater identity, prompt semantic text, schema, validator, interface, or generation configuration changes after authorship begins, H2 stops and requires a successor version.

Both raters receive identical rubric/instructions and byte-identical blind content; only `rater_id` differs.

Before H2 authorship, each chosen rater identity/version must also pass a **non-holdout format qualification** using a frozen synthetic set that is not H1/H2 records or derivatives. The synthetic 90-item input, expected structural properties, prompt, schema and configuration are canonicalized and SHA-256 hashed into the freeze manifest.

Run exactly **3 independent fresh-session qualification trials per planned rater** using the same frozen evaluator prompt, schema, max-output-token limit, tools-off setting and generation configuration planned for H2. Pass requires **3/3 structurally valid 90-item JSON-only outputs**; semantic accuracy is not scored. Any qualification failure disqualifies that planned rater identity/configuration before authorship rather than consuming an H2 attempt.

## Blind-bundle identity, ordering and deterministic batching

Opaque item IDs are assigned **independently of author-controlled text, scenario IDs, claim IDs, strata, domains, or templates**. After the canonical pool is frozen, compute `pool_sha256`; derive a deterministic permutation by sorting claim IDs on SHA-256(`"D022-H2-BLIND:" + pool_sha256 + ":" + claim_id`), tie-breaking by claim ID. Assign sequential opaque IDs `B0001` through `B1080` in that permutation. Before bundle serialization, every source evidence ID is deterministically remapped **within each blind item** to local IDs `E01,E02,...` in canonical evidence-pack order. Every claim citation/reference to a source evidence ID is rewritten to the corresponding local ID. The blind bundle exposes only `item_id, question, evidence_pack, claim_text`, and evidence entries expose only local `evidence_id,text`; it strips claim/scenario/stratum/template/domain/author_intent/QA metadata and all source evidence IDs.

A blind-leak validator must fail if any serialized blind item contains a source scenario/claim/evidence identifier or stratum marker, including substrings matching `H2-S[0-9]{3}`, `D022-H2-S[0-9]{3}-C[0-9]{2}`, source `:e[0-9]+` identifiers, or frozen stratum IDs. It also verifies every claim citation resolves only to local `E##` IDs.

Freeze exactly **12 batch input files of 90 items**:
- `D022-H2-RATING-B01` = B0001-B0090;
- ...
- `D022-H2-RATING-B12` = B0991-B1080.

Both raters receive byte-identical batch input bytes for a given batch. Each canonical batch file SHA-256 is recorded in the rating manifest amendment produced from the already-frozen bundle; this amendment may add only derived hashes/IDs and may not alter the pre-authorship instrument/configuration.

Each batch output schema contains:
`holdout_version,bundle_sha256,rater_id,batch_id,first_item_id,last_item_id,ratings,status`

`status` must equal `FINAL / LOCKED`. Ratings must contain exactly 90 unique expected item IDs in exact order and one allowed label each.

## Raw output, validation, retry and stop policy

An **attempt begins only when the provider accepts the request for generation**. A pre-generation rejection with evidence of zero generation (for example an explicit 429/5xx rejection before model execution) is logged but does **not** consume an attempt and may be resubmitted unchanged. Once generation is accepted/started, a timeout, connection loss, empty delivered response, or other missing-output outcome counts as an attempt and is preserved/logged as provenance to the extent the interface permits.

Every first-attempt raw batch is preserved byte-for-byte where the interface permits and hashed before derivation.

A first attempt is invalid if it is truncated, incomplete, malformed, contains wrong/missing/duplicate IDs, invalid labels, wrong metadata/status, or violates the frozen exact-output contract.

**Exactly one whole-batch retry is allowed** for an invalid first attempt:
- identical blind input, prompt, model identity/version and configuration;
- a **fresh isolated session/context** with no prior batch or attempt transcript; first attempts also use fresh isolated sessions;
- same complete 90-item batch;
- no partial continuation;
- no selective item re-query;
- no prompt repair;
- no temperature/config change;
- symmetric policy for R1 and R2.

The invalid first attempt remains immutable provenance and contributes **zero** labels. Parseable labels from it are never mixed with retry labels.

The retry must itself validate as a complete batch. **Any invalid retry immediately closes D022-H2.** No third attempt, alternate model, manual completion, extraction invented after the fact, or selective salvage is allowed.

**Deterministic extraction is not permitted in H2.** The response bytes must be UTF-8 with **no BOM**; leading/trailing ASCII whitespace is permitted and stripped solely for JSON parsing/hash-of-normalized-payload purposes, but any non-whitespace surrounding prose, fences, truncation, or extra JSON/text makes the attempt invalid. The parsed value must satisfy the exact frozen JSON-only schema. This removes post-hoc extraction discretion.

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

Checker role incompatibility is governed exclusively by the symmetric role-separation matrix above; no chronological loophole is permitted.

No H1 artifact may be used for checker training/tuning/tests except aggregate methodology statistics explicitly recorded in the closed H1 intake report.

## Stop conditions

All #126 and accepted H2 preregistration stop conditions remain active. Additionally H2 closes and requires a successor version if:
- prerequisite H1 identity attestation or H1 structural inventory is missing/unfrozen;
- planned H2 rater identities are not frozen before authorship;
- role separation is violated in either direction;
- the frozen role roster changes, a role identity/version is substituted, or prohibited H1 exposure is discovered after the gate;
- protected-`staging` non-rewrite/force-push-block evidence required by the freeze manifest is absent;
- audit commitment/reveal chronology or hash verification fails;
- the auditor fails to reveal within the frozen 72-hour window;
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
6. required validators/tests for these artifacts are independently reviewed;
7. the canonical freeze manifest, including role roster, checker-isolation evidence, repository non-rewrite evidence and all prerequisite hashes/merge commits, is independently accepted and merged.

Even then, successful H2 construction/rating would not authorize checker deployment or production.

## Next action

Independent full methodology review of this operational specification. Do not author H2 records while it is under review.
