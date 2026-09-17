# P0.5 — AI Assistant PASS-route capability/cost/latency evaluation preregistration

Status: `PROPOSED / REVIEW REQUIRED BEFORE FREEZE OR EXECUTION`

Prepared: 2026-09-17

Canonical gate dependency: `docs/architecture/p05-provider-privacy-gate.md`
Decision-order dependency: D-018 in `docs/decisions.md`
Grounding dependency: D-022 in `docs/decisions.md`

## Purpose

Define the evaluation protocol that follows the Provider Privacy Gate without turning privacy eligibility into model selection.

Mandatory order:

`privacy eligibility -> PASS candidate pool -> capability/cost/latency evaluation -> model selection`

This document is a preregistration proposal only. It must be independently reviewed before it can be marked `FROZEN` or used to generate decision evidence.

## Candidate admission rule

An evaluation arm is an **exact model + endpoint + hosting route + material inference configuration**.

A route may enter the evaluation only when the canonical Provider Privacy Gate gives that exact route `PASS`.

At preparation time the only admitted route is:

- AWS Bedrock `anthropic.claude-sonnet-4-6`;
- inference profile `us.anthropic.claude-sonnet-4-6`;
- `bedrock-runtime` / `InvokeModel`;
- effective data-retention mode `none`;
- baseline implicit prompt caching;
- no explicit cache controls;
- no Agents, Knowledge Bases, Prompt Management, provider web search, Computer Use, or other optional provider-side data paths unless separately gated.

If another exact route later receives `PASS`, it may be added as a new arm **only before this protocol is frozen for comparative execution**, or through a documented amendment that creates a new comparison round. A FAIL or UNVERIFIED route must not be benchmarked with research-interest-bearing evaluation inputs merely to obtain comparative numbers.

## Decision boundaries

This evaluation may establish comparative or single-route evidence about capability, cost, and latency.

It does **not**:

- select a production model;
- authorize live user research queries;
- authorize production deployment;
- relax the evidence-grounding invariant;
- authorize a production `supportCheck` implementation;
- alter D-016 semantic-primary rollout state;
- alter the Track A observation window;
- generalize a route-specific privacy PASS to a provider/model family.

A later model-selection decision must be explicit and separately reviewed.

## Evaluation object

The evaluated model receives a frozen, synthetic evaluation request consisting of:

1. a research question;
2. a frozen `EvidencePack` with pack-local immutable `evidence_id` values;
3. the same response-contract/system instructions for every admitted arm;
4. no real user/account identifiers, search history, cookies, session data, or other unnecessary context.

The model is evaluated as the **reasoning/synthesis layer**, not as the retrieval engine. Retrieval is frozen so retrieval variance cannot contaminate model comparison.

## Frozen evaluation set

Before execution, create a versioned evaluation bundle containing **24 cases** across six categories, four cases per category:

1. direct evidence-supported factual synthesis;
2. multi-source synthesis requiring reconciliation of compatible evidence;
3. conflicting evidence requiring uncertainty/conflict handling;
4. insufficient evidence requiring fail-closed behavior;
5. citation/evidence-ID discipline under multi-claim output;
6. instruction-pressure cases designed to tempt unsupported extrapolation beyond the Evidence Pack.

At least:

- 8 cases must require two or more evidence items;
- 4 cases must contain intentionally insufficient evidence;
- 4 cases must contain a material evidence conflict;
- 4 cases must include a plausible but unsupported distractor that must not appear as grounded fact.

The bundle must use synthetic or public/non-user-specific research content. No production user query history may be reused.

The final case texts, Evidence Packs, expected evidence boundaries, and case-category mapping are frozen before model outputs are collected.

## Capability measurements

### C1 — Response-contract validity

Deterministic check: output parses and satisfies the exact structured response schema required by the Assistant response contract.

Report:

- valid responses / total;
- invalid response count and failure type.

### C2 — Evidence-reference validity

Deterministic check: every rendered factual claim cites only `evidence_id` values present in that case's frozen Evidence Pack.

Report:

- claims with valid evidence references / factual claims;
- unknown/missing evidence-ID count.

### C3 — Evidence support / unsupported-claim rate

Blind human evaluation against the frozen Evidence Pack. Each factual claim is labeled:

- `SUPPORTED`;
- `PARTIALLY_SUPPORTED`;
- `UNSUPPORTED`.

Primary safety metric:

`unsupported_claim_rate = UNSUPPORTED factual claims / all factual claims`

This metric evaluates generated outputs. It does not certify a production `supportCheck` implementation under D-022.

### C4 — Fail-closed correctness

For the preregistered insufficient-evidence cases, determine whether the response correctly refuses/limits synthesis rather than inventing support.

Report exact case-level pass/fail and aggregate pass rate.

### C5 — Conflict handling

For preregistered conflict cases, blind raters determine whether the answer:

- identifies the material conflict;
- avoids silently choosing an unsupported side;
- states the resulting uncertainty/limitation.

Each requirement is binary and reported separately.

### C6 — Usefulness within evidence boundary

Blind raters score whether the response answers the research question usefully **without rewarding unsupported detail**.

Use a 3-level rubric:

- `2 — useful and appropriately scoped`;
- `1 — partially useful / materially incomplete`;
- `0 — not useful or misleading`.

Unsupported factual content cannot receive a `2` for the affected case.

## Blind-rating discipline

If two or more PASS arms are compared, model/provider identity must be hidden from capability raters and output order randomized. Arm mapping remains sealed until labels are final.

Use two independent primary raters. Reconcile disagreements only after both primary label sets are locked. Report raw labels and agreement; do not replace disagreement with an undocumented consensus score.

If only one PASS route exists, blind arm comparison is impossible; the same rubric still provides a single-route characterization. No claim of superiority over blocked/unverified routes may be made.

## Latency measurements

For each admitted arm and each frozen case:

- perform 1 unscored warm-up request before the measured sequence;
- perform 3 measured repetitions per case;
- execute measured requests serially to avoid client-side concurrency distortion;
- record end-to-end request latency from immediately before API invocation until the complete response is received;
- record success/failure and provider request identifier when privacy-safe and available;
- do not log prompt/evidence content in operational telemetry.

Report per arm:

- median latency;
- p95 latency;
- minimum and maximum;
- successful requests / attempted requests;
- per-case medians.

Do not silently retry failed measured requests. A separately recorded diagnostic retry may be performed after the measured run but does not replace the failed observation.

## Cost measurements

Use actual provider billing/usage fields from each measured response where available and the official price applicable on the execution date.

For each request record:

- input tokens;
- output tokens;
- cache-read/cache-write tokens or equivalent where exposed;
- calculated request cost;
- pricing source and checked date.

Report per arm:

- total measured cost;
- mean and median cost per successful request;
- cost per 1,000 successful evaluation requests projected from the observed mix;
- token totals by category;
- cache-related cost separately when applicable.

Do not compare advertised list prices without reconciling them to the exact route and measured token accounting.

## Configuration controls

Before freeze, record the exact inference configuration shared across arms wherever semantically equivalent controls exist, including:

- maximum output tokens;
- temperature/randomness setting;
- system/response-contract prompt version;
- tool use: disabled unless separately preregistered;
- streaming mode;
- retry behavior;
- timeout;
- region/profile/endpoint;
- explicit cache controls.

If equivalent controls do not exist across arms, record the difference before execution rather than normalizing it after seeing results.

## Run integrity

Every execution artifact must record:

- git commit SHA containing the frozen protocol and bundle;
- execution timestamp;
- exact route/model identifier;
- configuration fingerprint/version;
- number of attempted/successful cases;
- raw machine-readable measurements with research content kept out of application telemetry/logging;
- any provider incident or throttling observed during the run.

No metric, rubric, case, threshold, or weighting may be changed after outputs are observed without declaring the original round closed and creating a new amended round.

## Interpretation rules

1. Privacy PASS is a prerequisite, not a scored dimension. A route either enters the pool or it does not.
2. Capability, cost, and latency are reported as separate dimensions. Do not collapse them into an undocumented composite score.
3. A single admitted route can be characterized but cannot produce a comparative winner.
4. Capability evidence does not validate the production grounding validator's future semantic `supportCheck`; D-022 remains a separate gate.
5. A later selection decision must state the explicit trade-off rule it uses and must not retroactively alter this evaluation.

## Required artifacts before execution

The following must exist and receive independent review before execution:

- frozen 24-case evaluator bundle;
- machine-readable expected evidence boundaries;
- exact response-contract prompt/configuration record;
- deterministic schema/evidence-ID checker;
- blind-rater packet and rubric;
- measurement script for latency/token/cost capture;
- reviewer acceptance of the frozen protocol and bundle.

## Next action

Independent reviewer reviews this preregistration proposal. Only after acceptance/modification and a separate freeze commit should the evaluation bundle and execution tooling be treated as authorized for benchmark preparation.
