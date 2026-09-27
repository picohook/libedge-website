# D-022 — Fresh-Checker vs. H2 Holdout Scope Reconciliation

Status: **PROPOSED CONTROL-PLANE CORRECTION / INDEPENDENT REVIEW REQUIRED**

Date: 2026-09-28

## Question resolved by this record

Did the later Fresh-Checker A1/A2/B qualification path replace, reduce, complete, or cancel the previously preregistered D-022 H2 holdout of 1,080 claims / 180 scenarios?

**Repository-supported answer: no such replacement, reduction, completion, or cancellation decision has been established.**

The two lines are distinct:

1. **Fresh-Checker qualification/freeze line** — qualifies and freezes a semantic checker/engine and implementation boundary using the successor A1/A2/B process.
2. **H2 statistical holdout line** — constructs, blind-rates, freezes, and evaluates the separately preregistered 1,080-claim / 180-scenario H2 holdout under the D-022 false-positive acceptance design.

The Fresh-Checker line reached its recorded qualification closure. The 1,080-claim H2 holdout has not been shown to have been authored, rated, frozen, or executed.

## Repository chronology

### H1 closure

H1 closed without checker execution after failing its frozen consensus-yield prerequisites. The decision log preserves H1 as immutable historical evidence and requires a separately preregistered successor holdout rather than top-up or repair.

### H2 successor holdout preregistration

PR #132, `docs: preregister D022-H2 successor holdout`, was merged to `staging` on 2026-09-20 as merge commit `6b182fba14f7d66ca86c5cce8d0e59c87b7f8dcf`. Its PR head was `f0ca5e6bd2328ab61b4d34368cac2b6d3dd4c391`.

The merged preregistration at `docs/experiments/d022-supportcheck-h2-preregistration-v0.1.md` defines, before H2 construction: exactly 1,080 candidate claims; 720 intended UNSUPPORTED (120 in each U1-U6 stratum); 240 intended SUPPORTED; 120 intended PARTIALLY_SUPPORTED; exactly 180 new scenarios × 6 claims; two isolated primary raters; exact-agreement consensus; frozen minimum consensus yields; and the existing one-sided false-positive acceptance discipline.

The preregistration explicitly states that it does not authorize H2 construction, rating, checker execution, or deployment.

### H2 operational specification

The later operational specification `docs/experiments/d022-supportcheck-h2-construction-rating-spec-v0.2-PROPOSED.md` continues to state that the accepted H2 preregistration remains controlling and repeats the 1,080-claim / 180-scenario composition. It also states that no H2 authorship is authorized until its prerequisite/gate chain is complete.

Its status remains `PROPOSED / INDEPENDENT REVIEW REQUIRED`; this record does not promote that proposal to accepted status.

### Fresh-Checker successor line

The v0.4.x Fresh-Checker methodology introduced generic semantic-engine qualification (A1), exact artifact/runtime freeze (A2), and implementation conformance (B) while keeping H2 content isolated.

An external archived v0.4.2 package recovered during provenance review states: `H2 authorship and evaluation remain CLOSED throughout Stage A1, Stage A2, and Stage B.` That source is not currently committed as a first-class repository artifact, and the quoted sentence is not independently searchable in the current repository. It must therefore be treated as external provenance rather than repository evidence until imported and hash-linked.

This external record is consistent with — but is not by itself repository proof of — A1/A2/B being a prerequisite checker line rather than execution of the 1,080-claim H2 holdout. The repository-supported conclusion remains narrower: the accepted H2 preregistration exists, the 1,080-claim holdout is not shown as executed, and no canonical repository decision currently establishes its cancellation or supersession.

## Status reconciliation

- **Fresh-Checker qualification/freeze:** recorded as CLOSED / PASS / FINAL / LOCKED for the exact accepted engine and frozen rule set, subject to the provenance limitations already recorded in the repository.
- **1,080-claim / 180-scenario H2 holdout:** **NOT SHOWN AS EXECUTED / NOT COMPLETE**.
- **Relationship:** the Fresh-Checker result does not retroactively satisfy the H2 holdout's statistical evaluation.
- **Supersession:** no canonical evidence currently establishes that the H2 holdout was cancelled or superseded.
- **Scientific interpretation:** this correction does not reverse the Fresh-Checker qualification result. It corrects the scope attributed to that result.
- **Historical records:** files that previously used `H2 CLOSED / PASS / FINAL / LOCKED` for the Fresh-Checker line remain historical records; they must not be cited as proof that the 1,080-claim H2 holdout was completed.

## D-022 production consequence

The original D-022 decision requires a production `supportCheck` to be evaluated against an explicit measurable false-positive criterion using preregistered experimental discipline before production use.

Because the preregistered H2 statistical holdout has not been shown as executed, **D-022 production validation is not complete merely from the Fresh-Checker A1/A2/B qualification result**.

Therefore:
- checker integration and fail-closed staging engineering may be prepared/tested as engineering work if separately authorized;
- no production semantic activation may cite the Fresh-Checker qualification alone as completion of the D-022 false-positive validation gate;
- production validation remains blocked until either (1) the accepted H2 holdout path is completed under its governing prerequisites and independently reviewed, or (2) a future prospective, independently reviewed governance/methodology decision explicitly replaces that production-validation requirement before relying on the replacement result.

Option 2 may not retroactively rewrite H1, the accepted H2 preregistration, or historical Fresh-Checker records.

## Provenance limitations retained

This scope reconciliation does not cure the separate provenance limitations recorded in `docs/d022-h2-vnext-provenance-reconciliation-2026-09-28.md`, including missing first-class raw Stage-B/final-audit execution records and limitations on external transcript authentication.

## Review boundary

Independent review should determine whether this record accurately reflects the repository chronology and whether the production consequence follows from the existing D-022 decision without inventing a supersession.

This record does not authorize H2 authorship, H2 execution, checker integration, staging activation, or production deployment.
