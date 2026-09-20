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
- diversity QA, anti-cloning, and lexical Jaccard threshold unless a separately preregistered successor artifact changes them before any H2 record is authored.

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

H2 therefore increases pre-frozen sampling margin and adds rubric-conformance QA before freeze. It does **not** make claims easier merely to manufacture rater agreement. Semantic difficulty must remain concentrated on evidence-support boundaries.

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

All H2 text must be newly authored. No H1 scenario, question, evidence sentence, claim text, or minimally transformed derivative may be reused.

## Pre-freeze semantic QA

Before H2 pool freeze, perform construction QA without candidate-checker outputs and without primary-rater labels.

For every claim, a construction QA pass must verify only whether the authored record conforms to its intended stratum definition and is unambiguous under the frozen rater rubric. This QA is not ground truth and must not be exposed to primary raters.

In addition to the inherited construction checks, H2 requires:

1. **U1 proposition-pair declaration.** Construction-only metadata records:
   - the neighboring proposition explicitly supported by evidence; and
   - the distinct material proposition introduced/substituted by the claim.
   QA fails if the distinction depends only on stylistic wording or a disputable implication.

2. **Supported entailment trace.** Construction-only metadata identifies the evidence sentence(s) that establish every material factual component of each intended-SUPPORTED claim. QA fails if any material component requires implication not visible in the EvidencePack.

3. **Partial boundary trace.** Construction-only metadata identifies the supported core and unsupported extension separately.

4. **Rubric-boundary audit sample.** Before freeze, an independent reviewer semantically inspects at least:
   - 24 U1 candidates from at least 12 scenarios;
   - 24 supported candidates from at least 12 scenarios;
   - 12 partial candidates.
   Sampling is deterministic by lexicographic claim ID after the candidate pool is authored. The reviewer checks construction-rule conformance only and must not simulate primary ratings or optimize expected consensus.

If sampled defects reveal a systematic construction-rule violation, the pool may be revised only before freeze, under the already-written H2 rules, and the audit sample is rerun on the revised pool. No checker may be run during this process.

## Diversity and anti-template requirements

H2 retains the 12-domain vocabulary and lexical near-clone algorithm from the frozen diversity addendum.

Scale the domain gates to 180 scenarios:
- negative H2-S001–H2-S120: all 12 domains represented; no domain >15; at least 8 domains have >=8 scenarios;
- all H2 scenarios: all 12 domains represented; no domain >20.

The same-stratum cross-scenario Jaccard failure threshold remains `J >= 0.70`; normalization, tokenization, trigram representation, exact-duplicate gates, and same-scenario exclusion remain unchanged.

No H2 record may be an exact normalized duplicate of any H1 claim text, complete ordered evidence concatenation, or comparison text. The H2 validator must additionally run the inherited trigram representation against H1 records of the same stratum and report the maximum cross-version similarity. **Cross-version J >= 0.70 fails H2 construction.** This threshold is frozen before H2 content exists.

## Canonical H2 record schema

Use the H1 canonical record schema with versioned values:
`holdout_version, scenario_id, claim_id, stratum_id, question, evidence_pack, claim_text, author_intent`.

`holdout_version` must equal `D022-H2`.

Construction-only proposition/entailment/boundary traces live in separate QA metadata and must never enter the canonical pool or blind-rater bundle.

Canonical byte rules remain UTF-8 no BOM, NFC, compact JSONL, LF-only, lexicographic claim-ID ordering, one final LF, no blank lines.

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
- H1 individual rating/consensus rows must not be used as checker training, few-shot examples, prompt-tuning examples, threshold calibration, or unit-test fixtures;
- aggregate H1 stop statistics may appear only as historical methodology evidence.

If the same AI/person participates in H2 authoring and later checker implementation, this authorship-style familiarity must be disclosed. The checker still may not receive H2 labels or be run on H2 during development.

## H2 stop conditions

Stop H2 and open a successor version if:
- fewer than 300 consensus-UNSUPPORTED overall;
- any U1-U6 stratum has fewer than 50 consensus-UNSUPPORTED;
- fewer than 100 consensus-SUPPORTED;
- H2/H1 contamination or prohibited derivative reuse is found;
- checker outputs influence H2 construction, QA, labels, or subset selection;
- a frozen rule would need to change after H2 ratings or checker outputs are visible.

## Decision boundary

Even a successful H2 consensus freeze would authorize only the next preregistered checker-evaluation preparation step. It would not itself demonstrate checker safety, select a provider/model, change retrieval architecture, authorize production, or reopen the paused go-live/migration work.

## Next action

Independent reviewer reviews this H2 successor preregistration. If accepted and merged, the next artifact is an H2 construction specification/validator update that implements these rules before any H2 candidate record is authored.
