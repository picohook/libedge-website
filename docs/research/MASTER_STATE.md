# LibEdge Research — Master Project State

> **Index, not authority:** this document is a short navigation layer. For mutable gates, limits, acceptance criteria, and execution details, follow the linked issue or canonical document rather than copying values from this page.

Verified against `staging` at `d9ac025e8df0d119e37c01f333c15a2fb14ff174` on **2026-10-07**.

## Authority rule

**Chat memory = discovery/context. Repository + live GitHub = authority. Runtime/production state = authority only when supported by direct operational evidence.**

Operational claims such as production migration state are verified only when an owner-run, read-only command output is recorded with date/time in the appropriate issue (normally [#399](https://github.com/picohook/libedge-website/issues/399)). Owner recollection without that evidence is **owner-reported / unverified**, not verified state.

## Current control plane

Open Research work at the verified SHA/date:

- [#399](https://github.com/picohook/libedge-website/issues/399) — production authorization packet and production boundary.
- [#536](https://github.com/picohook/libedge-website/issues/536) — Golden Set/domain-quality closure and grounding/support-check diagnosis.
- [#583](https://github.com/picohook/libedge-website/issues/583) — mandatory staging rollback after the Golden Set measurement window.
- [#591](https://github.com/picohook/libedge-website/issues/591) — bounded Turkish-question pilot path before Golden v1 freeze.
- [#592](https://github.com/picohook/libedge-website/issues/592) — post-pilot multilingual retrieval/evidence/answer roadmap.
- [#594](https://github.com/picohook/libedge-website/issues/594) — Research Admin person-name request drill-down UX.
- [PR #593](https://github.com/picohook/libedge-website/pull/593) — Turkish-query normalization implementation; **not merge-ready at this snapshot** because independent review still has a blocking English-path classifier regression.

Closed historical work remains closed unless a documented reopening condition is met; this page does not duplicate those issue histories.

## Research version governance

Canonical version sources:

- [`RESEARCH_VERSION`](../../RESEARCH_VERSION) — currently `0.9.0`.
- [`docs/research/VERSION.md`](VERSION.md) — version and maturity governance.
- [`docs/research/CHANGELOG.md`](CHANGELOG.md) — Research release ledger.

Version and maturity are separate dimensions. The canonical maturity lifecycle is **experimental → review → publishable → archived**. Do not infer Research lifecycle from website/product versioning.

## Candidate-depth experiment and retrieval

The candidate-depth experiment tracked by closed [#446](https://github.com/picohook/libedge-website/issues/446) / [#471](https://github.com/picohook/libedge-website/issues/471) is closed. Its small diagnostic sample is **not** domain validation.

Retrieval relevance, language effects, evidence depth, and `authorized_relevant_count` remain measured through the Golden Set work in [#536](https://github.com/picohook/libedge-website/issues/536) and the Turkish path in [#591](https://github.com/picohook/libedge-website/issues/591). Re-investigate retrieval if Golden Set evidence counts show insufficient authorized relevant evidence; do not reopen candidate-depth work merely from acceptance-rate changes.

## Golden v1 execution dependency

Current dependency order:

1. resolve [PR #593](https://github.com/picohook/libedge-website/pull/593), including its independent-review blocker;
2. amend the preregistration wording before candidate freeze;
3. in that amendment, define the bounded Turkish-supported contract and require a blind two-independent-rater on-topic / normalization-fidelity check for every Turkish `OK` row before it can count;
4. re-measure the six Turkish development questions only in an authorized bounded window;
5. freeze the candidate with the remaining independent sign-offs, including manifest/hash, rater/seed plan, benchmark code and fingerprint;
6. execute the held-out run;
7. apply the [#536](https://github.com/picohook/libedge-website/issues/536) closure gate;
8. complete [#583](https://github.com/picohook/libedge-website/issues/583) rollback after the measurement window closes;
9. carry accepted domain/language/UX evidence into [#399](https://github.com/picohook/libedge-website/issues/399);
10. production remains blocked until separate explicit authorization.

The two-rater on-topic / normalization-fidelity requirement above is a **pending preregistration amendment at this snapshot**, not an already-active Golden v1 gate.

## Migrations and production state

Repository migration files currently end at:

- [`0057_research_usage_retrieval_diagnostics.sql`](../../migrations/0057_research_usage_retrieval_diagnostics.sql)
- [`0058_research_usage_lexical_fallback_mode.sql`](../../migrations/0058_research_usage_lexical_fallback_mode.sql)

There is **no `0059` migration in the repository at this snapshot**. Any `0059` reference in planning documentation is future/unapproved work unless and until a migration is reviewed and merged.

**Production D1 migration state: UNVERIFIED FROM REPOSITORY.** Under [#399](https://github.com/picohook/libedge-website/issues/399), the owner must attach a dated/timestamped read-only production migration listing. Until then, prior statements about applied migrations are owner-reported/unverified. In particular, `0057` and `0058` must be checked explicitly in that production evidence rather than inferred from staging or chat history.

## Long-term Research roadmaps

Two durable roadmap tracks complement the current Golden v1 work:

- [Multilingual Research roadmap — #592](https://github.com/picohook/libedge-website/issues/592): language-specific retrieval, evidence verification and answer rendering after independent validation.
- [Evidence-depth / full-text roadmap](../architecture/p05-research-evidence-depth-roadmap.md), originating from closed [#495](https://github.com/picohook/libedge-website/issues/495): narrow authorized full-text acquisition, passage grounding, benchmark growth and eventual research-workspace capabilities.

Neither roadmap authorizes production changes or weakens the current verification/fail-closed boundary.

## Staleness rule

Every section above is a snapshot tied to the verified SHA/date. If a linked issue, PR, canonical governance document, or runtime evidence is newer, **the newer canonical source wins**. Update this index after material state transitions; do not turn it into a duplicate gate specification.
