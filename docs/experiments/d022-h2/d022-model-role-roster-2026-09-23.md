# D-022 Model / Role Roster — 2026-09-23

Status: **CURRENT OPERATING ROSTER / AUDIT AID**

This table consolidates model identities known to have been used, attempted, reserved, or considered in D-022 work. It is an audit aid, not a methodology amendment and not an authorization to reuse a model in a mutually exclusive substantive role.

| Phase | Model identity/version | D-022 role / use | Current disposition |
|---|---|---|---|
| H1 | GPT-5.6 Sol | Primary Blind Rater R1 | OCCUPIED substantive role; do not reuse for mutually exclusive D-022 substantive role |
| H1 | Claude Sonnet 5 | Primary Blind Rater R2 | OCCUPIED substantive role |
| H1 | Gemini 3.1 Pro Preview | Structural Inventory Constructor | OCCUPIED substantive role |
| H1 | Gemini 3.8 Flash | Independent Structural Inventory Reviewer | OCCUPIED substantive role |
| H1 | Gemini 3.7 Flash | Structural Inventory Construction Validator / Test Author | OCCUPIED substantive role |
| H1 | Gemini 3.6 Flash | Independent Validator/Test Reviewer attempt | FAILED; role exposure consumed |
| H1 | Claude Opus 4.8 | Independent Structural Inventory Validator/Test Reviewer | ACCEPTED; OCCUPIED substantive role |
| H2 | Claude Opus 5 | Taxonomy Author | OCCUPIED substantive role |
| H2 | Gemini 3.6 Thinking | Independent Taxonomy Reviewer | OCCUPIED substantive role |
| H2 | Claude Sonnet 4.6 | Original Validator Author | OCCUPIED substantive role |
| H2 | Grok 4.5 | Successor Validator Author | OCCUPIED substantive role |
| H2 | DeepSeek deepseek-v4-pro | Independent Validator Reviewer | OCCUPIED substantive role |
| H2 | Gemini 3.5 Flash-Lite | Original R1 candidate | QUALIFICATION FAILED / DISQUALIFIED |
| H2 | GPT-5.5 Instant | Replacement R1 candidate | rerun T1 PASS; T2 FAIL bundle hash; DISQUALIFIED; no T3 |
| H2 | Qwen/Qwen3.8-27B via Novita | Replacement R1 transport attempt | repeated HTTP 504 before model response; no qualification trial consumed |
| H2 | Qwen/Qwen3.8-27B via Cerebras | Replacement R1 transport attempt | Cloudflare HTTP 403 before model response; no qualification trial consumed |
| H2 | Qwen/Qwen3.8-27B via DeepInfra | Replacement R1 candidate | T1 substantive response FAIL bundle hash; DISQUALIFIED; no T2/T3 |
| H2 | Meta Llama 4 Maverick via OpenRouter | Replacement R1 candidate | eligibility PASS; streaming preflight PASS; T1 substantive response FAIL hash + B0030 field/order; DISQUALIFIED; no T2/T3 |
| H2 | Nex AGI Nex-N2.5-Pro (`nex-agi/nex-n2.5-pro:free`) via OpenRouter | Primary Rater R1 | QUALIFICATION 3/3 PASS under successor v0.2; locked R1 identity/config; raw artifact hashes recorded |
| H2 | Claude Opus 4.7 | Primary Rater R2 | QUALIFICATION 3/3 PASS; locked R2; exact raw-output evidence CLOSED; T1/T2/T3 each 4216 bytes with SHA-256 `916843547057aa654fa1f2be511b1b80278ed8393182b58dbb8d83850c416629` |
| H2 | DeepSeek deepseek-flash | R2 candidate | QUALIFICATION FAILED / DISQUALIFIED |
| H2 | Claude Opus 5.5 | Independent H2 Methodology Reviewer | OCCUPIED substantive role |
| H2 | Claude Opus 4.6 | H2 Successor Operational Specification Author | OCCUPIED substantive role |
| H2 | Claude Opus 3 | Candidate supportCheck implementer | eligibility passed; no deliverable after refusals; role exposure consumed |
| H2 | Grok 4.7 | Candidate supportCheck Implementer/Tuner | candidate artifacts recovered; usage exhausted; candidate not H2-evaluated/deployment-authorized |
| H2 | Kimi K2.5 (`moonshotai/kimi-k2.5`) via SiliconFlow | Qualification Instrument Successor v0.2 Exact Instantiator | OCCUPIED exact-instantiation role; eligibility PASS; exact artifacts mechanically instantiated |
| H2 | Mistral Medium 3.5 (`mistralai/mistral-medium-3-5`) | Independent Qualification Instrument Successor v0.2 Methodology Reviewer | ACCEPTED / FINAL / LOCKED; OCCUPIED independent review role |
| Reserved | Claude Haiku 4.5 | Intended final independent canonical freeze/checker-freeze review | RESERVED / UNUSED for substantive D-022 work; successor-author eligibility prompt was declined before any artifact exposure, so no substantive role was consumed |
| Considered only | Dolphin-Mistral-24B-Venice-Edition | Possible replacement R1 | NOT USED; no shared HF Inference Provider path selected |
| Considered only | Mistral family alternatives | Possible replacement R1 | NOT USED; no candidate qualified/started |

## Current gates

- H2 R1: **QUALIFIED 3/3 PASS** under successor qualification instrument v0.2; exact identity `nex-agi/nex-n2.5-pro:free` via OpenRouter locked for actual H2 R1.
- H2 R2: **QUALIFIED / LOCKED; exact raw-output evidence CLOSED**. T1/T2/T3 operator-saved raw JSON artifacts are byte-identical, 4216 bytes each, SHA-256 `916843547057aa654fa1f2be511b1b80278ed8393182b58dbb8d83850c416629`.
- H2 holdout authorship: **CLOSED**.
- Candidate supportCheck: recovered and mechanically tested, but **not H2 evaluated, independently freeze-accepted, or deployment-authorized**.
- Claude Haiku 4.5 remains reserved and should not be consumed merely to compensate for a knowingly incomplete package.

## Qualification-instrument issue identified

Multiple replacement R1 candidates have failed the frozen requirement that the rater itself compute the exact SHA-256 of the qualification JSON bytes. This record does not alter that frozen rule. Any change must be explicit, versioned, independently reviewed, and accepted before use. A successor qualification instrument may preserve the structural checks while supplying an authoritative harness-computed bundle hash for exact transcription rather than requiring cryptographic computation by the rater.

## Product priority

Governance work should now be bounded to the minimum needed to reopen the H2 authorship gate. Do not continue open-ended model shopping. Preserve the failed qualification evidence, define/review any successor instrument explicitly, qualify one eligible R1 under the accepted instrument, close the R2 evidence issue, then return to the supportCheck → H2 evaluation → independent validation → staging activation chain.
