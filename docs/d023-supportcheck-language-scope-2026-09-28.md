# D-023 Open Item #2 — supportCheck Language Scope

Status: `PROPOSED / INDEPENDENT REVIEW REQUIRED`

Date: 2026-09-28

## Purpose

Establish the production language boundary required by D-023 without inferring multilingual checker validity from model-family capability, website localization, or general model knowledge.

## Repository evidence

The accepted Fresh-Checker record freezes:

- model: `MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli`;
- revision: `6f5cf0a2b59cabb106aca4c287eed12e357e90eb`;
- qualification: 11/12 primary PASS with 3/3 deterministic runs;
- Stage B: 11/12 semantic primary PASS and 16/16 structural/fault PASS.

The committed vNext provenance transcript contains English-language qualification examples, including:

- evidence: "The red bicycle was repaired." / claim: "The red car was repaired.";
- evidence: "Some people at the meeting wore hats." / claim: "Everyone at the meeting wore a hat.";
- evidence: "All the lights in the room were off." / claim: "At least one light in the room was off."

The current repository does not contain accepted qualification/Stage-B evidence establishing checker validity for Turkish or another non-English language. The repository also records a provenance limitation: raw external Stage-B/final-audit execution records named by the closure summaries are not committed as first-class artifacts.

## Proposed language boundary

For D-023 readiness purposes, the validated `supportCheck` language scope is **English only**.

This means:

1. English claims/evidence may enter the separately gated supportCheck production-readiness path, subject to every other D-023, privacy, runtime, staging, product-readiness, and production-authorization condition.
2. Turkish and every other non-English language remain **outside the authorized supportCheck production scope** until separately validated with a prospective, independently reviewed language-validation protocol.
3. Website/UI localization, provider multilingual claims, model-card descriptions, or ad hoc examples do not expand this boundary.
4. Unsupported-language handling must fail closed or route to a separately authorized non-supportCheck behavior; it must not silently run the frozen checker and present the result as validated.
5. This record does not select or authorize a specific language detector. Runtime enforcement design remains an implementation item and must itself preserve privacy and fail-closed behavior.

## Product-language architecture

This English-only boundary applies to the **verification/evidence path**, not to the intended user-facing language policy.

The product target keeps three concerns separate:

- **query language:** Turkish or English;
- **verification language:** English under the currently validated D-023 checker scope;
- **response language:** Turkish or English, selected independently from the query language.

A future Turkish-query path may normalize or translate the research task into an English canonical retrieval/verification task, and a verified English claim may later be rendered in Turkish. Neither transformation is authorized by this record: query translation and post-verification response translation require their own integrity/privacy contract so that entailment is not silently changed. The runtime English evidence filter is therefore a current checker-scope guardrail, not a declaration that LibEdge is an English-only product.

## What would expand the scope

A future language may be added only after a prospective validation record defines, before results are observed:

- target language and exact checker/runtime pin;
- representative SUPPORT / CONTRADICTS / NOT_SUPPORTING cases;
- primary SUPPORT vs NOT_SUPPORTED acceptance criterion;
- diagnostic reporting;
- deterministic-repeat requirement;
- minimum sample size and construction method;
- independent review and explicit human adoption of the resulting scope change.

A translation-to-English workaround is not implicitly authorized by this record because translation may alter entailment and would add a new provider/privacy/validation boundary.

## Non-goals

This record does not:

- authorize production activation;
- close D-023 open items #1 or #3;
- modify the frozen Fresh-Checker thresholds or engine;
- claim that the underlying model is intrinsically monolingual;
- claim that Turkish or another language cannot work;
- authorize real-user query sampling;
- modify D-016 semantic-primary or Track A/Track B.

## Canonical references

- `docs/d023-d022-h2-path-b-risk-acceptance-2026-09-28.md`
- `docs/d022-h2-final-status-2026-09-27.md`
- `docs/d022-h2-vnext-provenance-reconciliation-2026-09-28.md`
- `docs/experiments/d022-h2/d022-vnext-apertus70b-huggingchat-transcript-2026-09-27.txt`
