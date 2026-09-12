# LibEdge AI Assistant Architecture v0.1

Status: `ARCHITECTURE ONLY / NO IMPLEMENTATION STARTED`

## Workstream status

The existing go-live checklist (G0-G9), including production migration reconciliation, is **PAUSED**, not cancelled.

Reason: current engineering focus is the LibEdge AI Assistant architecture and staging development.

The go-live workstream resumes from its existing state when the first public-launch decision is made. No production migration or production deployment work is to be executed while this workstream is paused.

Current workstream classification:

- `ACTIVE`: AI Assistant architecture + staging development.
- `PAUSED`: Production/go-live execution (G0-G9 checklist and production migration reconciliation).
- `SEPARATE`: Semantic-primary Track A/B (D-016), which remains on its own authorization and rollout chain.

## P0 invariant 1 — Evidence grounding

LibEdge must never claim more than the evidence it has retrieved supports.

The research-answering path is therefore designed as:

`ResearchWork[] -> Evidence Pack -> LLM -> Structured Claims -> Grounding Validator -> User Response`

Each item admitted to the Evidence Pack receives an immutable `evidence_id`. Every factual research claim produced by the AI layer must cite one or more of those evidence IDs. A claim without an evidence ID must not be rendered to the user as a factual research synthesis.

`ResearchWork.id` and `evidence_id` are intentionally distinct. `ResearchWork.id` is a bibliographic/work identity that may recur across requests or Evidence Packs, while `evidence_id` is an immutable reference assigned within a specific Evidence Pack for claim grounding. The AI grounding contract must not treat the bibliographic work ID as the pack-local evidence reference.

A citation reference alone is not sufficient: the cited evidence must actually support the claim. The grounding validator is the response boundary responsible for rejecting, weakening, or omitting unsupported claims.

Locked rule:

> **No unsupported claim may cross the AI response boundary.**

The intended response contract is structured rather than unconstrained prose, for example a claim object containing claim text plus its `evidence_ids`.

## P0 invariant 2 — Research-interest privacy

LibEdge must not disclose a user's research interest outside the permitted trust boundary.

A raw natural-language research query must **not** be sent to a third-party LLM unless the exact model/endpoint has passed the Provider Privacy Gate through a verified zero-data-retention (ZDR) or equivalent privacy contract. A self-hosted/private-inference solution may instead satisfy this boundary if separately verified.

No LLM provider is selected at this stage. OpenAI, Anthropic, and other hosted providers remain candidates only; no provider choice is implied by this document.

Changing or narrowing this invariant would require an explicit product/privacy decision. It must never occur as an implicit implementation exception.

## Provider Privacy Gate

Provider approval is performed at the **exact model/endpoint level**, not merely at provider or account level.

For every candidate model/endpoint, verify and record at minimum:

1. retention policy;
2. training/model-improvement use;
3. human-access policy;
4. subprocessors;
5. region and data-residency behavior;
6. exact endpoint/model eligibility for ZDR or an equivalent contractual privacy control.

A provider-wide privacy statement is not sufficient evidence that every model, endpoint, or hosting route has the same treatment. The concrete review must therefore include any model-specific or platform-specific exclusions. A previously raised example for verification is the claimed treatment of Anthropic `Claude Fable 5` / `Claude Mythos 5` and third-party hosting routes such as Bedrock or Vertex; this document does **not** assert that claim as fact. It records it only as the reason model/endpoint-level verification is mandatory before provider selection.

Provider selection is the first real gate after this architecture record is reconciled with the existing LibEdge/DISCOVER implementation.

## Retrieval-independent orchestration

The AI Assistant must not depend on whether retrieval is lexical, semantic, or hybrid.

Its retrieval contract is:

`Discover(query) -> ResearchWork[] -> EvidencePack`

The current DISCOVER implementation places authentication, rate limiting, caching, retrieval-policy selection, provider calls, enrichment, telemetry, and HTTP response construction in the research router. Before AI orchestration is implemented, the retrieval operation consumed by the AI layer must be exposed behind a service boundary that returns `ResearchWork[]`. The AI layer must not call provider-specific or retrieval-mode-specific branches directly.

Lexical/semantic/hybrid identity remains below this interface. The AI orchestration layer must not embed lexical-specific assumptions such as lexical score semantics, ranking mechanics, or a fixed result behavior.

Semantic-primary may therefore be enabled later through its separate Track A/B process without requiring a redesign of the AI Assistant architecture. Only retrieval policy changes; the AI-facing evidence contract remains stable.

## Data minimization and logging boundary

Only the minimum information required for the approved reasoning task may cross an approved model boundary.

Do not send unnecessary user/account context to the LLM, including:

- user ID;
- email address;
- session or cookie material;
- search history;
- quota/account-usage information.

Raw research query text, complete prompts, model responses, and other research-interest-bearing payloads must not be written to application logs or telemetry.

The current DISCOVER HTTP surface carries the raw research query in the `q` query-string parameter. Response-side `Cache-Control: private, no-store` does not by itself prevent request URLs from appearing in infrastructure or observability logs. Protection of that request-log surface is a shared responsibility with the existing D-016 Track A observability work, which plans query-string redaction; this AI Assistant architecture relies on that privacy control rather than defining a duplicate observability mechanism.

Existing privacy-safe aggregate telemetry remains a separate concern and must not be expanded to contain query text, topics, research interests, or user identifiers.

## Fail-closed behavior

Grounding failure must not trigger a more creative or less constrained answer.

If the available Evidence Pack cannot support a reliable synthesis, LibEdge must fail closed and communicate that the current results are insufficient, for example:

> Mevcut sonuçlar bu konuda güvenilir bir sonuç çıkarmak için yeterli değil.

The system must prefer an explicit evidence limitation over an unsupported answer.

## Reconciliation result

The current LibEdge/DISCOVER code is compatible with this architecture, with the explicit interface details recorded above:

1. expose DISCOVER retrieval to the AI layer through a retrieval-independent `ResearchWork[]` service boundary rather than router/provider internals;
2. keep pack-local immutable `evidence_id` distinct from bibliographic `ResearchWork.id`;
3. treat raw-query request-log protection as a shared privacy responsibility with the existing Track A observability/query-string-redaction work.

These clarifications do not reopen or modify the two P0 invariants, D-016, or the closed 0047/0049 privacy work.

## Next step

No AI Assistant implementation code has been authorized or started by this architecture record.

Architecture-to-code reconciliation is complete at the boundary level described above. No new architecture decision was introduced by that reconciliation.

The first real gate after this reconciliation is Provider Privacy Gate evaluation and provider/model/endpoint selection.
