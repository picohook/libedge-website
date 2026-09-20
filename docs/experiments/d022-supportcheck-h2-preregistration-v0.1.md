# D-022 supportCheck — H2 Successor Holdout Preregistration v0.1

Status: `PROPOSED / INDEPENDENT REVIEW REQUIRED BEFORE H2 CONSTRUCTION`

Prepared: 2026-09-20

Upstream frozen artifacts:
- `docs/experiments/d022-supportcheck-evaluation-preregistration-v0.1.md`
- `docs/experiments/d022-supportcheck-statistical-holdout-freeze-v0.1.md`
- `docs/experiments/d022-supportcheck-holdout-construction-spec-v0.1.md`
- `docs/experiments/d022-supportcheck-construction-diversity-qa-addendum-v0.1.md`
- `docs/experiments/d022-h1/rating/d022-h1-primary-rating-intake-report-v0.1.md`

## Purpose

Define the successor-round construction protocol required after D022-H1 stopped under the already-frozen consensus-yield conditions. H2 is a new holdout version, not an amendment, top-up, relabeling, or repair of H1.

This document does not authorize H2 case construction, rating, checker implementation, checker execution, or deployment.

## Inherited rules that do not change

H2 inherits without relaxation:
- primary FPR definition and one-sided 95% exact Clopper-Pearson acceptance rule;
- zero observed false accepts and upper bound <1.0%;
- final primary minimums: >=300 consensus-UNSUPPORTED overall, >=50 consensus-UNSUPPORTED in each U1-U6 stratum, >=100 consensus-SUPPORTED;
- two isolated primary AI raters from different model families;
- exact-agreement consensus rule with no post-hoc semantic adjudication;
- fail/close-and-new-version behavior when minimum consensus yield is not reached;
- no holdout exposure to checker development/tuning;
- canonicalization, hash-freeze, no in-place mutation, and independent-review discipline;
- diversity QA, anti-cloning, and lexical Jaccard threshold; a successor artifact may only **strengthen** these controls before any H2 record is authored, never relax them.

H1 remains immutable historical evidence and contributes zero claims to H2 primary denominators.

## What H1 established and what H2 may use

H1 mechanically established:
- 60 consensus-SUPPORTED;
- 350 consensus-UNSUPPORTED;
- 310 challenge/disagreement;
- U1_NEAR_MISS consensus-UNSUPPORTED = 0;
- U2=71, U3=69, U4=67, U5=63, U6=80;
- exact rater agreement = 443/720.

These aggregate outcomes may justify changing H2 **sampling margins and pre-rating quality-control procedure**. They must not be used to relabel, rewrite, select, minimally transform, or clone individual H1 claims for H2.

The H1 blind item labels, consensus membership, claim-level disagreement pattern, and checker-inaccessible labels are not H2 authoring material. H2 construction must not inspect individual H1 disagreement rows to reverse-engineer cases that the raters are more likely to agree on.

## H2 design principle

H1's failure is treated as a consensus-yield failure, not evidence that the frozen semantic definitions or acceptance threshold should be weakened.

H2 therefore increases pre-frozen sampling margin and adds construction-rule QA before freeze. The larger pool is a robustness margin, **not a yield-model claim**: H1's U1 yield was 0%, so no finite scaling justified from that observation can be claimed to solve U1, and H1 supported yield (60/150 = 40%) would project only 96/240 at the same rate. H2 therefore must stand or fail on newly preregistered construction and rater-instrument controls, not on arithmetic oversampling alone. It does **not** make claims easier merely to manufacture rater agreement. Semantic difficulty must remain concentrated on evidence-support boundaries.

## Candidate-pool size — H2

Before any H2 rating, construct and freeze exactly **1,080 candidate claim instances**:

- **720 intended-UNSUPPORTED:** 120 per U1-U6 stratum;
- **240 intended-SUPPORTED**;
- **120 intended-PARTIALLY_SUPPORTED**.

These are author-intent construction targets only, not ground truth.

Rationale: compared with H1, the negative candidate margin increases from 80 to 120 per stratum and supported candidates from 150 to 240. This is a preregistered successor-round margin chosen before H2 records exist. It does not guarantee consensus yield and cannot be increased after rating begins.

## H2 scenario architecture

Use exactly **180 new base scenarios**, IDs `H2-S001` through `H2-S180`, each with exactly six claims:

- `H2-S001`–`H2-S120`: negative-focused; one intended claim in each U1-U6 stratum = 720;
- `H2-S121`–`H2-S160`: supported-focused; six intended-SUPPORTED claims = 240;
- `H2-S161`–`H2-S180`: partial-focused; six intended-PARTIALLY_SUPPORTED claims = 120.

Claim IDs: `D022-H2-S###-C##`. Evidence IDs: `H2-S###:e##`.

All H2 text must be newly authored. No H1 scenario, question, evidence sentence, claim text, reasoning template, or minimally transformed derivative may be reused.

## Pre-freeze semantic QA

Before H2 pool freeze, perform construction QA without candidate-checker outputs and without primary-rater labels.

For every claim, construction QA must verify only the **bright-line construction conditions stated in the frozen stratum definitions** (for example: U1 same entity/topic, overlapping factual dimension, and one distinct material non-entailed substitution; supported claims have every material component explicitly traceable to evidence; partial claims have both a traceable supported core and a material unestablished extension). QA must not predict, simulate, or optimize a primary-rater label. This QA is not ground truth and must not be exposed to primary raters.

In addition to the inherited construction checks, H2 requires:

1. **U1 proposition-pair declaration.** Construction-only metadata records:
   - the neighboring proposition explicitly supported by evidence; and
   - the distinct material proposition introduced/substituted by the claim.
   QA fails if the distinction depends only on stylistic wording or a disputable implication.

2. **Supported entailment trace.** Construction-only metadata identifies the evidence sentence(s) that establish every material factual component of each intended-SUPPORTED claim. QA fails if any material component requires implication not visible in the EvidencePack.

3. **Partial boundary trace.** Construction-only metadata identifies the supported core and unsupported extension separately.

4. **Rubric-boundary audit sample.** Before freeze, an independent construction-audit reviewer inspects exactly:
   - 24 U1 candidates from 24 distinct scenarios;
   - 24 supported candidates from 24 distinct scenarios;
   - 12 partial candidates from 12 distinct scenarios.

   Authorship must be complete and the candidate snapshot committed **before** the sampling seed exists. The audit seed must be an unpredictable value supplied after that commit by the independent reviewer (or an independently verifiable randomness source defined in the successor construction specification); it must not be chosen, influenced, ground, or previewed by H2 authors. The literal audit class names are frozen as exactly `U1_AUDIT`, `SUPPORTED_AUDIT`, and `PARTIAL_AUDIT`. For each class, rank eligible claim IDs by SHA-256(`snapshot_sha256 + ":" + audit_seed + ":" + audit_class + ":" + claim_id`) and take the first claim from each distinct scenario until the required scenario count is reached. The seed, snapshot hash, ranked IDs, and selected IDs are committed as audit provenance.

   The independent construction-audit reviewer is the sole defect decision-maker for this screen. Authors may provide factual clarification but cannot override a defect finding; a dispute therefore does not convert a defect to pass. No informal pre-snapshot semantic feedback from that reviewer is permitted. The reviewer checks only the bright-line construction conditions above, not expected primary-rater labels.

   Audit pass requires **zero sampled construction-rule defects**. This is explicitly a gross-failure screen, not evidence that the unsampled pool has a low defect rate. If a sampled defect is found, remediation must apply to the **entire affected construction class/template**, not only the sampled record(s), and the revision log must identify the class-wide rule applied. At most **one** pre-freeze revision cycle is permitted. After revision, authors commit a new snapshot **before** a new independent seed is released; the audit is then rerun with that fresh seed. If the second audit has any sampled defect, H2 construction fails and a successor version is required. No checker or primary rater may see either candidate snapshot during this process.

## Diversity and anti-template requirements

H2 retains the 12-domain vocabulary and lexical near-clone algorithm from the frozen diversity addendum. Because H1 demonstrated that lexical Jaccard alone does not control abstract template concentration, H2 adds the structural gate below.

Scale the domain gates to 180 scenarios:
- negative H2-S001–H2-S120: all 12 domains represented; no domain >15; at least 8 domains have >=8 scenarios;
- all H2 scenarios: all 12 domains represented; no domain >20.

The same-stratum cross-scenario Jaccard failure threshold remains `J >= 0.70`; normalization, tokenization, trigram representation, exact-duplicate gates, and same-scenario exclusion remain unchanged.

No H2 record may be an exact normalized duplicate of any H1 claim text, complete ordered evidence concatenation, or comparison text. The H2 validator must additionally run the inherited trigram representation against **all H1 records across all strata** and report the maximum cross-version similarity. **Cross-version J >= 0.70 fails H2 construction**, regardless of stratum. This threshold is frozen before H2 content exists.

### Structural template-concentration gate

Lexical diversity is not treated as semantic independence. Before any H2 record is authored, the successor construction specification must freeze: (a) a closed construction-only `reasoning_template_id` taxonomy; (b) bright-line assignment rules for each template; and (c) a **reviewer-owned H1 structural inventory** produced without H1 rater labels or consensus rows. That H1 inventory must list the abstract evidence→claim transformations found in the H1 pool, be independently reviewed, canonicalized, SHA-256 hashed, and merged **before H2 authorship begins**. Its hash becomes an H2 construction input.

A template ID represents the abstract evidence→claim transformation being tested, independent of topic nouns, numbers, surface domain, or stratum label. H2 template definitions that are structurally equivalent to an H1 inventory entry are forbidden even if renamed or moved to another stratum.

Within H2, each U1-U6 stratum must contain at least **12 distinct reasoning_template_id values**, and no single template may contribute more than **12 of the 120** candidates in that stratum. Supported and partial pools must each contain at least **12 templates**, with no template contributing more than 10% of that pool.

Template assignment is not accepted by author declaration alone. The construction audit must include a separate assignment audit selected with the same post-commit independent-seed mechanism. For **each U1-U6 stratum, supported pool, and partial pool**, sample 12 claims from 12 distinct scenarios where possible. The audit reviewer must verify both (1) that each sampled claim actually instantiates its declared template under the frozen assignment rules and (2) that the declared template is not structurally equivalent to a forbidden H1 inventory transformation. Any mismatch is a construction defect and triggers the same class-wide remediation, one-revision maximum, fresh-snapshot/fresh-seed, and second-audit failure rule above.

The validator enforces declared-ID counts/caps mechanically; the independent audit validates declaration truth and template distinctness. Template IDs are compared across all strata so relabeling a transformation into another stratum does not evade the gate.

These template constraints are construction independence controls, not a claim that Bernoulli trials are perfectly independent. The final report must retain the clustering limitation required by #126.

## Canonical H2 record schema

Use the H1 canonical record schema with versioned values:
`holdout_version, scenario_id, claim_id, stratum_id, question, evidence_pack, claim_text, author_intent`.

`holdout_version` must equal `D022-H2`.

Construction-only proposition/entailment/boundary traces live in separate QA metadata and must never enter the canonical pool or blind-rater bundle.

Canonical byte rules remain UTF-8 no BOM, NFC, compact JSONL, LF-only, lexicographic claim-ID ordering, one final LF, no blank lines.

## Scaled composition requirements

The inherited H1 composition rules scale as follows for H2:
- U2: at least 60/120 require a denominator or population boundary; preserve a balanced mixture of the frozen U2 pattern families.
- U3: at least 60/120 satisfy the frozen non-explicit-causation condition.
- U4: at least 60/120 are subtle bounded extensions.
- U6: at least 60/120 have high lexical overlap while remaining semantic mismatches.
- Evidence contribution remains at most 3 intended primary-negative candidates per evidence item; scenario contribution remains at most 6.
- Among 240 supported candidates: >=48 numeric/bounded, >=48 multi-evidence synthesis, >=32 explicit uncertainty/limitation, >=32 conflict-aware, >=32 explicit negative/absence; remaining 48 may be direct factual synthesis. Categories may overlap only where the inherited H1 rule allowed the same claim to satisfy multiple characteristics; the QA summary must report both category memberships and unique-claim counts.
- The 120 partial candidates are exactly balanced: 20 each across scope, mechanism, temporal extrapolation, conflict resolution, evaluative strengthening, and denominator/generalization.

## Frozen H2 rater instrument and batching

Before any H2 record is authored, the successor construction/rating specification must freeze the primary-rater prompt, output schema, exact model-family separation requirement, and batching protocol. H2 may not rely on an unspecified 1,080-item single response.

The protocol must use byte-identical blind content and identical rubric text for both raters, with only rater ID differing. Batch boundaries must be deterministic and identical across raters, preserve global item order, and be frozen before rating. Each batch output is validated before the next is accepted; labels are immutable once a batch is FINAL / LOCKED. The final rater artifact is a deterministic concatenation of locked batches and must contain every item exactly once.

Raw-output handling is also frozen before authorship: preserve each received raw batch byte-for-byte where the interface permits; validate exact JSON-only format; a format defect is recorded and **cannot be repaired by asking the rater to change labels**. If deterministic extraction of an existing JSON object is allowed, the extraction algorithm, raw-byte hash, derived hash, and acceptance/failure conditions must be specified before rating. No post-lock ad hoc extraction procedure is permitted.

The rating specification must also freeze **incomplete/truncated batch handling**. A malformed, incomplete, truncated, or validator-failing batch is retained as the immutable first-attempt raw artifact and cannot contribute labels to the final rating artifact. If one retry is permitted, it must be exactly one **whole-batch** retry using the identical blind input/prompt/configuration; partial continuation or selective item re-query is forbidden. The same retry policy applies symmetrically to both raters. First-attempt parseable labels are retained only as provenance and are never mixed with retry labels; the accepted batch, if any, is the complete validated retry artifact. A second failure stops that rater/round rather than permitting further label shopping.

The two primary raters must be isolated and from different model families. The exact family-pair policy is frozen in the successor rating specification before H2 authorship; neither rater may have participated in H2 authorship or construction audit. For exclusion purposes, **same rater** means the same model identity/version used as an H1 primary rater, not merely the same chat/session; a new session of that same model identity remains excluded. A materially different model identity/version is not automatically the same rater, but prior H1 claim-level exposure by that session/person/model instance remains independently disqualifying.

## Rating and deterministic selection

After H2 pool freeze and blind-bundle freeze, two isolated primary raters receive the same byte-identical blind bundle and frozen rubric.

Consensus mapping remains:
- SUPPORTED/SUPPORTED -> eligible supported;
- UNSUPPORTED/UNSUPPORTED -> eligible unsupported;
- either PARTIALLY_SUPPORTED or any disagreement -> challenge/disagreement.

If eligible counts satisfy the frozen minimums, deterministic primary selection remains:
- first 50 lexicographic eligible unsupported claims within each U1-U6 stratum = 300;
- first 100 lexicographic eligible supported claims;
- all excess eligible cases supplementary.

If any minimum is missed, H2 stops. No top-up, relabeling, adjudication, threshold change, or third rater may rescue the round.

## Contamination firewall

Before H2 checker execution:
- H2 author intent and construction QA remain sealed from primary raters;
- H2 primary labels, consensus rows, and final subset remain sealed from checker development;
- **No H1 artifact**—including pool text, questions, evidence, claims, author_intent, construction QA, rating rows, consensus rows, or derived subsets—may be used as checker training, few-shot examples, prompt-tuning examples, threshold calibration, or unit-test fixtures. Only aggregate H1 methodology statistics explicitly recorded in the closed intake report may be used as historical evidence;
- H2 authors and the construction-audit reviewer must disclose whether they had prior exposure to H1 pool text, author_intent, ratings, or consensus artifacts. Any such exposure is a documented limitation; a person/model that served as an H1 primary rater or inspected H1 claim-level consensus may not author, construction-audit, or primary-rate H2;
- aggregate H1 stop statistics may appear only as historical methodology evidence.

**H2 authors and construction-audit reviewers are prohibited from later serving as candidate-checker implementers for this H2 evaluation round.** This is a separation requirement, not a disclosure-only limitation. Candidate-checker implementers must not receive H2 author_intent, construction QA, labels, consensus, subset membership, or holdout text during development and must not run the checker on H2 before checker code/configuration is frozen.

## H2 stop conditions

The following are **in addition to all inherited #126 stop conditions**. Stop H2 and open a successor version if:
- fewer than 300 consensus-UNSUPPORTED overall;
- any U1-U6 stratum has fewer than 50 consensus-UNSUPPORTED;
- fewer than 100 consensus-SUPPORTED;
- H2/H1 contamination or prohibited derivative reuse is found;
- checker outputs influence H2 construction, QA, labels, or subset selection;
- a candidate checker was tuned against sealed H2 labels;
- the permitted single construction-audit revision cycle is exhausted without a zero-defect audit;
- a frozen rule would need to change after H2 ratings or checker outputs are visible.

## Decision boundary

Even a successful H2 consensus freeze would authorize only the next preregistered checker-evaluation preparation step. The frozen false-positive confidence bound applies to the **consensus-eligible primary unsupported subset**, not automatically to all authored negatives or production claims. The H2 report must publish eligibility yield overall and by U1-U6, and compare those aggregate rates with the already-recorded H1 aggregate eligibility outcomes without claim-level mining. Any H1-versus-H2 eligibility-yield comparison is **descriptive only**, because both holdout construction and the rater instrument/model pair may differ between rounds; it is not a causal estimate of improvement. It would not itself demonstrate checker safety, select a provider/model, change retrieval architecture, authorize production, or reopen the paused go-live/migration work.

## Next action

Independent reviewer reviews this H2 successor preregistration. If accepted and merged, the next artifact is an H2 construction specification/validator update that implements these rules before any H2 candidate record is authored.
