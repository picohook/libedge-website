# D-022 supportCheck — Fresh Holdout Construction Specification v0.1

Status: `PROPOSED / INDEPENDENT REVIEW REQUIRED BEFORE POOL CONSTRUCTION`

Prepared: 2026-09-20

Upstream:
- `docs/experiments/d022-supportcheck-evaluation-preregistration-v0.1.md`
- `docs/experiments/d022-supportcheck-statistical-holdout-freeze-v0.1.md`

## Purpose

Freeze the rules that will generate the fresh D-022 holdout **before any holdout case is authored**.

This artifact freezes construction, oversampling, IDs, canonical serialization, hashing, and the no-mutation boundary. It does not contain the candidate pool itself and does not authorize checker implementation, rating, measured execution, or deployment.

## Frozen candidate-pool size

Construct exactly **720 candidate claim instances**:

- **480 intended-UNSUPPORTED**: 80 in each of the six frozen hard-negative strata;
- **150 intended-SUPPORTED**;
- **90 intended-PARTIALLY_SUPPORTED**.

These are construction targets only. Author intent is not ground truth and must not be exposed to blind raters.

The 480 negative candidates provide 60% oversampling relative to the required 300 final consensus-UNSUPPORTED claims and 60% oversampling within each required 50-claim negative stratum.

The 150 positive candidates provide 50% oversampling relative to the required 100 consensus-SUPPORTED claims.

No pool-size increase, replacement, or top-up is permitted after primary rating begins. If consensus yield is insufficient, the holdout version fails and a new version must be preregistered.

## Scenario architecture

Use exactly **120 base scenarios**, IDs `S001` through `S120`.

Each base scenario contributes exactly **6 claim instances**, yielding 720 claims.

Scenario allocation:
- 80 negative-focused scenarios: `S001-S080`;
- 25 supported-focused scenarios: `S081-S105`;
- 15 partial-focused scenarios: `S106-S120`.

Each scenario must be self-contained and synthetic or based only on public/non-user-specific material. No real LibEdge user query, account data, research history, or private source may appear.

A scenario may contain multiple evidence items, but its six claims must not be lexical paraphrase clones. Each claim must test a distinct proposition/evidence relation.

### Negative-focused scenarios

Each of S001-S080 contributes exactly six intended-UNSUPPORTED claims, one in each hard-negative stratum. Therefore every negative stratum receives exactly 80 candidates and no evidence item contributes more than three primary-negative candidates.

### Supported-focused scenarios

Each of S081-S105 contributes exactly six intended-SUPPORTED claims = 150 candidates.

### Partial-focused scenarios

Each of S106-S120 contributes exactly six intended-PARTIALLY_SUPPORTED claims = 90 candidates.

## Immutable IDs

Scenario IDs are fixed by the ranges above.

Evidence IDs:
`S###:e##`, with two-digit evidence ordinal starting at 01.

Claim IDs:
`D022-H1-S###-C##`, with claim ordinal `C01-C06`.

Each claim record also carries a frozen `stratum_id`.

Unsupported strata:
- `U1_NEAR_MISS`
- `U2_SCOPE_SHIFT`
- `U3_CAUSAL_MECHANISTIC`
- `U4_TEMPORAL_GENERALIZATION`
- `U5_CONFLICT_SIDE`
- `U6_CITATION_SEMANTIC_MISMATCH`

Supported: `S_SUPPORTED`  
Partial: `P_PARTIAL_EXTENSION`

An ID identifies content, not a reusable slot. After pool freeze, an ID may never be reassigned to corrected or replacement content. Any semantic correction requires a new holdout version, not reuse of the old ID.

## Record schema

Canonical pool is JSONL, one claim record per line, exactly 720 lines, sorted ascending by `claim_id`.

Each record contains exactly these keys in this order:

`holdout_version, scenario_id, claim_id, stratum_id, question, evidence_pack, claim_text, author_intent`

Where:
- `holdout_version` = `D022-H1`;
- `evidence_pack` is an array of 1-6 objects;
- each evidence object contains exactly `evidence_id`, `text`;
- `author_intent` is one of `SUPPORTED`, `PARTIALLY_SUPPORTED`, `UNSUPPORTED`.

`author_intent` exists only for construction QA and must be removed from blind-rater bundles.

No optional metadata is permitted in the canonical pool.

## Content constraints

Every scenario must be answerable using only its EvidencePack. Outside knowledge must be unnecessary and prohibited in the rater instructions.

Evidence must be concise enough that support can be evaluated directly. Do not create ambiguity merely by omitting basic referents.

No claim may depend on:
- obscure external domain knowledge;
- subjective taste;
- political judgment;
- hidden definitions;
- unstated arithmetic conventions;
- adversarial typography or parsing tricks.

Difficulty must come from semantic evidence boundaries, not trivia.

## Hard-negative generation rules

A negative candidate is valid only if the EvidencePack is plausible and topically relevant while failing to support a material part of the claim.

### U1 — Near-miss entailment

Construct evidence that supports a neighboring proposition but not the claim.

Required:
- same entity/topic;
- at least one overlapping factual dimension;
- claim introduces or substitutes one material fact not entailed.

Forbidden easy negatives:
- unrelated evidence;
- different entity with no ambiguity;
- direct evidence sentence saying the claim is false.

### U2 — Quantifier / denominator / scope shift

Evidence and claim must share the same underlying measurements/events, but the claim changes the population, denominator, quantifier, or scope.

Required patterns include a balanced mixture of:
- enrolled vs completed;
- subset vs whole population;
- some/most/all;
- conditional subgroup vs overall cohort;
- numerator with wrong denominator.

At least half of U2 candidates must require noticing a denominator or population boundary rather than a simple numeric mismatch.

### U3 — Causal / mechanistic overreach

Evidence must contain a real observed association/change, while the claim asserts a cause, mechanism, diagnosis, or explanatory pathway not established by the evidence.

At least half must avoid explicit words such as "caused" in the evidence so that the checker must distinguish observation from inference.

Forbidden:
- evidence with no observed phenomenon at all;
- absurd mechanisms unrelated to the evidence.

### U4 — Temporal / generalization overreach

Evidence supports a bounded time, condition, material, location, dose, or test regime; claim extrapolates beyond that boundary.

At least half must be subtle extensions (e.g. 100 h -> long-term durability, one temperature -> general performance) rather than extreme extrapolations.

### U5 — Conflict-side overclaim

EvidencePack must contain at least two materially relevant evidence items in unresolved tension or conflict.

Claim must:
- select one side as settled;
- erase uncertainty; or
- strengthen a conclusion beyond what the conflicting pack supports.

Both sides must be credible and directly relevant. Do not make one side obviously defective.

### U6 — Citation-valid semantic mismatch

The cited evidence IDs exist and are topically relevant, but they do not semantically support the claim.

Construct cases where a mechanical citation-ID validator would pass.

At least half must have lexical overlap high enough that keyword matching alone is unreliable.

Forbidden:
- nonexistent evidence IDs;
- empty citations;
- wholly unrelated sources.

## Supported generation rules

Supported claims must be fully entailed by the supplied evidence without outside knowledge.

The 150 candidates must include:
- >=30 numeric/bounded claims;
- >=30 multi-evidence synthesis claims;
- >=20 explicit uncertainty/limitation claims;
- >=20 conflict-aware claims that accurately preserve unresolved conflict;
- >=20 negative/absence claims only where the evidence explicitly supports the absence;
- remaining claims may cover direct factual synthesis.

No supported claim may rely on author-intended implication that is not visible in the evidence.

## Partially-supported generation rules

Each partial claim must contain:
1. a material proposition clearly supported by the evidence; and
2. a material extension not fully supported.

The unsupported extension must affect meaning; cosmetic wording does not qualify.

Balance the 90 partial candidates across scope, mechanism, temporal extrapolation, conflict resolution, evaluative strengthening, and denominator/generalization extensions (15 each).

A partial candidate must not be reducible to two independent sentences where one could simply be deleted without changing the other; the supported and unsupported components should form one natural user-facing claim.

## Difficulty QA before freeze

Before pool freeze, construction QA may revise cases **only against these frozen rules**, without seeing any candidate checker's output.

For each record, QA records pass/fail for:
- self-contained;
- intended stratum rule satisfied;
- not trivial/unrelated;
- no outside knowledge required;
- no paraphrase clone;
- evidence-ID integrity;
- scenario/evidence contribution limits.

All 720 must pass. Failed cases may be revised only before the pool freeze commit.

No checker may be run on candidate cases during construction QA.

## Canonical serialization

Canonical pool bytes are defined as:

- UTF-8 without BOM;
- Unicode normalized to NFC;
- JSON Lines;
- exactly one JSON object per line;
- keys exactly in the frozen schema order;
- compact JSON separators: comma and colon, no insignificant spaces;
- JSON strings escaped according to RFC 8259;
- line ending LF (`\n`) only;
- records sorted lexicographically by `claim_id`;
- exactly one final LF after the last record;
- no blank lines.

A deterministic build/validation script must generate the canonical JSONL from the authored source and fail if canonicalization changes on a second pass.

## Hash freeze

At pool freeze, compute and record:

- SHA-256 of the complete canonical JSONL byte stream;
- record count;
- per-stratum counts;
- first and last claim IDs;
- SHA-256 of the construction/validation script used to generate it.

Create a manifest containing those values. The manifest and canonical pool must be committed in the same freeze PR.

The blind-rater bundle must be deterministically derived from that exact canonical pool and must record:
- source-pool SHA-256;
- bundle SHA-256;
- number of scenarios/claims;
- explicit confirmation that `author_intent` was removed.

Any byte change to the canonical pool changes its SHA-256 and therefore creates a different artifact. After reviewer acceptance, the accepted hash is the holdout identity.

## Mechanical freeze boundary

The freeze point is the merge commit of the future candidate-pool freeze PR after independent reviewer acceptance.

After that merge:
- no claim/evidence text may change;
- no record may be added or deleted;
- no IDs may be renumbered/reused;
- no stratum assignment may change;
- no author intent may change;
- no pool ordering/canonicalization rule may change.

If any content defect is later discovered, record it. Do not silently fix the accepted pool. If the defect affects validity, close D022-H1 and create a new preregistered holdout version (e.g. D022-H2).

Git history is not treated as permission to amend an accepted artifact in place.

## Rating sequence

After the candidate pool is frozen:

1. deterministically derive the blind-rater bundle from the accepted pool;
2. remove `author_intent` and construction-only QA;
3. independently verify source-pool hash and blind-bundle hash;
4. send the byte-identical bundle to two isolated primary AI raters from different model families;
5. lock both outputs `FINAL / LOCKED`;
6. mechanically derive exact-agreement binary subsets under the already-frozen statistical rule;
7. apply deterministic lexicographic subset selection;
8. hash the final primary subset;
9. only then may the frozen candidate checker be run against the evaluation set, subject to the upstream execution prerequisites.

## Separation from checker development

The candidate checker may be designed in parallel only against separate development examples.

The checker implementer must not receive:
- `author_intent`;
- primary-rater labels;
- consensus mapping;
- final primary subset membership,

until the checker code/configuration is frozen.

The checker must not be run against D022-H1 during prompt/threshold development.

## Decision boundary

This specification does not:
- create or freeze the actual 720 records;
- validate any semantic labels;
- authorize a checker implementation;
- authorize measured evaluation;
- authorize production deployment;
- alter the frozen statistical threshold;
- modify Round 2 or its seed benchmark.

## Next action

Independent reviewer reviews these construction rules. If accepted and merged, construct exactly the 720-record D022-H1 candidate pool and deterministic validator under these rules. That later pool-freeze PR must expose the full canonical pool, validation script, QA summary, and hashes for independent inspection before rating begins.
