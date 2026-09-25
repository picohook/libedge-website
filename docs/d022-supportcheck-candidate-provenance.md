# D-022 candidate supportCheck implementation provenance

Status: CANDIDATE IMPLEMENTATION COMPLETE / CHECKER-FREEZE ACCEPTED / NOT H2-EVALUATED

This record preserves mechanical provenance for the candidate `supportCheck` implementation produced in an isolated Grok 4.7 implementer/tuner session. It does not record D-022 validation, H2 acceptance, production authorization, deployment authorization, or checker-freeze acceptance.

## Role and isolation record

- Model identity/version: Grok 4.7.
- Locked role: D-022 H2 Candidate supportCheck Implementer/Tuner.
- Eligibility/isolation gate: PASS as reported in the operator-controlled Grok Build session.
- Allowed-input boundary: `IMPLEMENTER_TASK.md`, `PRODUCT_CONTRACT.md`, `REFERENCE_BOUNDARY.js`, and `PACKAGE_MANIFEST.json` only.
- The implementation turn was interrupted after files had been written; the recovered deliverables below were preserved without modification.
- The implementer was not supplied H1/H2 evaluation artifacts, preregistration, operational specification, taxonomy, holdout, qualification/rating material, QA/audit records, consensus data, or evaluation results.
- Grok usage ended before a final completion message; the recovered artifact bytes, rather than an unobserved completion claim, are the provenance source.

## Recovered candidate deliverables

| Deliverable | Bytes | SHA-256 |
| --- | ---: | --- |
| `supportCheck.mjs` | 9,839 | `61870a5ee504a0a4514e75529340401e761134ebd63ca26004b4edb3847a7279` |
| `supportCheck.test.mjs` | 13,864 | `64305218b64e6acd3a11298152f62274bf0044ef126b0a68b156e9c712f0eb5f` |
| `supportCheck.dependencies.json` | 2,383 | `82e2fc98fdf813ddd87f6fbb8609130ccd7f4ae862f859975bfcae574d29c97b` |
| `README.md` | 4,646 | `0671adfcb34bd527725b94c4e27bf5ef8160229f38ab082fe5283d8e9d5ebbcc` |
| recovered `FREEZE_INVENTORY.json` | exact recovered bytes | `78e9245c9d0df7c85bb578a16ef68582d5e6f2e635ecc3cb974205052050c9ea` |

The four deliverable hashes and byte counts were independently recomputed from the recovered files and match the recovered `FREEZE_INVENTORY.json` entries exactly.

## Mechanical test rerun

Command:

```text
node --test supportCheck.test.mjs
```

Independent rerun result on the recovered exact bytes:

```text
tests: 15
pass: 15
fail: 0
cancelled: 0
skipped: 0
todo: 0
```

This is a deterministic implementation/unit-test result only. It is not an H2 semantic evaluation.

## Runtime declaration

The recovered dependency manifest declares Node.js >=18, ESM, no npm dependencies, no environment variables, and no network access by the component itself. An external semantic model is required for affirmative support and is not bundled or configured in the candidate package. The package therefore remains unbound and fail-closed until a separately frozen provider binding exists.

## Gate consequence

The recovered candidate implementation is mechanically complete enough to enter the independent checker-freeze review path. It must remain byte-identical while that review is pending. No H2 evaluation, production integration, provider activation, or deployment authorization follows from this record.

Checker-freeze review: CLOSED — Claude Haiku 4.5 ACCEPT / FINAL / LOCKED; exact candidate bytes accepted unchanged for subsequent H2 evaluation.
Canonical H2 freeze manifest: OPEN.
H2 authorship: CLOSED.


## Successor checker attempts after v0.3 reconciliation — 2026-09-24

These records are historical governance evidence only. They do not alter, repair, seed, or authorize the frozen Grok 4.7 candidate above, and none of the attempts below is an H2-authorized checker.

### Qwen/Qwen3-Coder-Next

- Fresh-checker eligibility: PASS.
- Deterministic candidate tests: 8/8 PASS.
- Governance disposition: DISQUALIFIED because prospective independent technical-isolation review had not been completed before implementation.
- Consequence: historical evidence only; not eligible as the H2 checker.

### zai-org/GLM-5.3 via Novita

- Fresh-checker eligibility: PASS.
- Prospective isolation review: PASS for the controlled Novita API route.
- Authoritative controlled streaming execution: HTTP 200 and completed SSE stream.
- Model token accounting: 65,536 completion tokens, all reported as reasoning; assistant-content length was zero.
- No implementation deliverables were produced.
- Frozen stopping rule prohibited continuation, repair, or tuning.
- Disposition: IMPLEMENTATION ATTEMPT CLOSED / UNSUCCESSFUL.

### moonshotai/Kimi-K2.7-Code

- Fresh-checker eligibility: PASS.
- Prospective isolation review: PASS by deepseek-ai/DeepSeek-V4-Pro-0813 before implementation.
- One controlled implementation response was produced.
- Independent mechanical test result: 14 total, 13 PASS, 1 FAIL.
- The emitted FREEZE_INVENTORY.json contained placeholder SHA-256 values rather than final deliverable hashes.
- Frozen single-attempt rule prohibited repair, continuation, or result-driven tuning.
- Disposition: IMPLEMENTATION ATTEMPT FAILED / CLOSED.
- The Kimi output must not be supplied to a future checker implementer.

### thinkingmachines/Inkling

- Fresh-checker eligibility: PASS / FINAL.
- Prospective isolation review: PASS / FINAL / LOCKED by google/gemma-4-26B-A4B-it before checker inputs were supplied.
- The controlled implementation attempt started only after the prospective gate passed.
- The model output stopped inside the first file, src/supportCheck.js, before an END FILE envelope.
- No complete deliverable was returned; no testable package, FREEZE_INVENTORY.json, IMPLEMENTATION_COMPLETE marker, or FINAL marker was produced.
- Frozen single-attempt rule prohibits continuation, repair, or result-driven tuning.
- Disposition: INCOMPLETE / TRUNCATED OUTPUT — IMPLEMENTATION ATTEMPT FAILED / CLOSED.

## Current checker gate

No successor attempt listed above is authorized for H2 use. The historical Grok 4.7 package remains preserved as previously freeze-reviewed evidence, but the accepted v0.3 reconciliation requires a fresh checker rather than reuse of that historical candidate. H2 authorship therefore remains CLOSED.

No further AI checker-candidate churn is authorized by this provenance update. A different implementation route may be considered only if it independently satisfies the frozen role-separation and checker-isolation requirements before the implementer receives prohibited H1/H2 material. Pure mechanical CI/execution remains non-substantive only when it has no discretion over checker content or results.


### deepseek-ai/DeepSeek-V3.2 — 2026-09-25

- Operator-observed implementer identity: `deepseek-ai/DeepSeek-V3.2`.
- Neutral connectivity probe: PASS.
- Fresh-checker eligibility: PASS / FINAL; self-reported identity UNKNOWN, operator-observed selector identity preserved separately.
- Independent prospective-isolation reviewer: `Qwen/Qwen3-235B-A22B-Instruct-2507` via Novita.
- Reviewer eligibility: PASS; self-reported identity UNKNOWN, operator-observed selector identity preserved separately.
- Prospective isolation: PASS / FINAL / LOCKED before implementation. Four-input limit, prohibited-material exclusion, repository exclusion, broad-enumeration exclusion, role separation, and technical isolation were all marked YES; blocking finding NONE.
- Implementer then received one controlled implementation request containing only the four frozen allowlisted inputs.
- Raw implementation response: 13,093 bytes; SHA-256 `c2c64bc4e26fe8fd1571cb668799068660b74b6e999bb91bda642c80aff951e4`.
- Response status: `IMPLEMENTATION COMPLETE / NOT EVALUATED`; five deliverables returned.
- Mechanically recomputed UTF-8 deliverable hashes from the exact JSON `content` strings:
  - `src/supportCheck.js`: 5,487 bytes; `31c95fd38be7da7fc51c690956ca3122804b45d89e568f2971667d3e7dfa970a`.
  - `test/supportCheck.test.js`: 3,113 bytes; `66a95c481a0a7e6e961f3403ca434d6fd8fa98bc21d9a35a49826756bb8405e8`.
  - `package.json`: 304 bytes; `710b91eb1018fb8c75a11bdff136f84dc6af6e7602949854f25fb94f25d2dfad`.
  - `README.md`: 2,061 bytes; `f7f89351421edebe3aa31637ae648c3fe374ce58a70704182c75e608e79bc134`.
  - `FREEZE_INVENTORY.json`: 619 bytes; `a366fef0d9d54c47314abdafe0de18e141eb4d371e5e02b5eb9c47fe0b75a759`.
- The hashes declared inside the returned `FREEZE_INVENTORY.json` do not match the mechanically recomputed hashes of the returned deliverable contents. This violates the required exact SHA-256 freeze inventory.
- The implementation also binds semantic decisions to external Google Gemini `gemini-2.0-flash-exp` via `@google/generative-ai` and requires `GEMINI_API_KEY`. The supplied tests invoke `supportCheck` on semantic cases rather than injecting a deterministic semantic provider, so those cases depend on the external runtime and do not constitute deterministic unit tests under the frozen task requirement.
- Frozen single-attempt rule prohibits repair, continuation, or result-driven tuning.
- Disposition: IMPLEMENTATION ATTEMPT FAILED / CLOSED. The output must not be supplied to a future checker implementer.
