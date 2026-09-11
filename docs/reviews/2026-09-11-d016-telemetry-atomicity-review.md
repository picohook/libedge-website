# D-016 telemetry atomicity correction — reviewer follow-up

Date: 2026-09-11
Classification: **ACCEPTED WITH MODIFICATION**

## Reviewer conclusion

The reviewer independently accepted the lost-update diagnosis in the current KV read-modify-write implementation.

The initial proposal was incomplete because it compared only Durable Object variants and did not explicitly evaluate D1, despite the repository already having `env.DB` bound.

## Required modification 1 — DO vs D1 comparison

The reviewer required the canonical proposal to compare D1 and Durable Objects before implementation.

Reviewer reasoning:

- a single telemetry DO would receive not only semantic traffic but all research telemetry traffic, including ordinary lexical requests;
- this could create an unnecessary global serialization queue and latency/bottleneck source;
- D1 can perform an atomic `UPDATE`/upsert increment in a single SQL statement without application-level read-modify-write locking;
- if D1 is selected, telemetry should live in its own table and a dedicated D1 binding/database should be considered to reduce coupling to core auth/admin data;
- if DO is selected, it must be a **separate DO**, never the existing semantic pacer, because pacing is functionally critical while telemetry is best-effort observability.

## Required modification 2 — cross-metric invariant test

The reviewer observed that the live incident was not only a same-metric lost update. The impossible state `semantic_successes > semantic_attempts` showed cross-metric inconsistency.

Required Test I:

- simulate N concurrent `attempt -> success` event pairs using the real telemetry path;
- after all operations complete, assert `semantic_successes <= semantic_attempts` always;
- for an all-success synthetic run, assert exact equality and no lost update.

## Reviewer answers to the remaining questions

- privacy invariants: accepted;
- tests A-H: accepted but incomplete without Test I;
- only blocker before implementation: explicit DO vs D1 comparison and reasoned selection;
- no semantic retry or production change authorized.

## Main-thread resolution

The required comparison and Test I have now been incorporated into:

`docs/architecture/p05-research-telemetry-atomicity-correction.md`

The main thread selected **D1 atomic counters in a dedicated table on the existing `env.DB` for the immediate correction**, with the shared failure-domain trade-off explicitly documented and a dedicated telemetry D1 binding/database retained as a pre-broad-enable revisit if load/latency evidence warrants it.

A global telemetry DO was rejected for this correction; if a DO solution is ever revisited, it must remain separate from `OpenAlexSemanticPacer`.

This resolves the reviewer's two required modifications and authorizes implementation **with semantic-primary OFF only**. It does not authorize another semantic retry or any production enablement.
