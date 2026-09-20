# LibEdge AI Handoff Protocol

## Purpose

This file defines the startup and continuity protocol for AI implementer and reviewer sessions working on LibEdge.

The repository is the verifiable source of truth. Conversation memory, summaries, prior assistant statements, local branches, and implementer/reviewer narratives are orientation aids only and must not replace repository verification.

Canonical working branch: `staging`.

## Control-plane documents

Two documents have distinct roles:

- `docs/current-state.md` answers **where the project is now**: active tracks, blockers, pending external inputs, recently completed milestones, next safe work, and explicit do-not-do boundaries.
- `docs/decisions.md` answers **why the project is in that state**: durable architectural, privacy, product, and process decisions recorded as D-XXX entries. It is not a changelog and does not need an entry for every PR.

### Continuity rule

At every real milestone closure or materially state-changing decision, the implementer must check whether `docs/current-state.md` and/or `docs/decisions.md` require an update. If required, the update is made in the same PR when appropriate or in an immediately following documentation-only PR. The implementer does not wait for the reviewer to request this check.

Small UI/CSS/refactor PRs do not by themselves require control-plane updates unless they materially change project state, an invariant, a boundary, or a durable decision.

Examples of events that normally trigger the check include closure or material change of a Gate/Track, receipt of authoritative external evidence that changes a blocker, production observation-window conclusions, or a new durable architecture/privacy decision.

### Protocol maintenance rule

This protocol is not exempt from normal governance. If `docs/ai-handoff.md` itself needs to change, the change must go through the normal PR review process. Every modification to this file is independently reviewed with the same evidence discipline as other control-plane documentation.

## Implementer Startup Protocol

When starting a new implementer session:

1. Read `docs/current-state.md` in full.
2. Read `docs/decisions.md` in full.
3. Follow the canonical records referenced by those documents as needed to understand active work.
4. Verify that every referenced repository file relied upon for orientation actually exists on the canonical branch. Do not assume a listed path is valid merely because a control-plane document names it. Use the repository/Git object equivalent of `git cat-file -e <ref>:<path>` when available.
5. Independently inspect the real `staging` state. Do not rely solely on conversation memory, summaries, prior assistant claims, or stale/local branches.
6. Before modifying code, opening a PR, deploying, probing, or otherwise executing work, produce a startup checkpoint covering:
   - active tracks/workstreams and their states;
   - open blockers and pending external inputs;
   - locked architecture/privacy/product invariants;
   - the most recently completed material milestone;
   - the next safe work;
   - actions that are explicitly not authorized now;
   - any discrepancy between `current-state.md` / `decisions.md` and the verified repository state.
7. Stop after the checkpoint until the user authorizes the next task.

### Implementer operating rule

At each real milestone closure, independently perform the control-plane continuity check described above. Reviewer reminders are not a prerequisite.

## Reviewer Startup Protocol

When starting a new reviewer session:

1. Read `docs/current-state.md` in full.
2. Read `docs/decisions.md` in full.
3. Follow the canonical records referenced for active work as needed.
4. Verify that every referenced repository file relied upon for review context actually exists on the canonical branch. Do not trust the reference list alone. Use the repository/Git object equivalent of `git cat-file -e <ref>:<path>` when available.
5. Independently inspect the real `staging` state. Prior conversation memory, implementer descriptions, reviewer memory, summaries, and stale/local branches are not evidence.
6. Before issuing any PR classification, produce a startup checkpoint covering:
   1. active tracks and their states;
   2. open blockers;
   3. current Provider Privacy Gate state;
   4. current Track A state;
   5. the UI fixture/live boundary;
   6. fail-closed/privacy invariants that must be preserved;
   7. the latest accepted material milestone;
   8. any discrepancy between the control-plane documents and verified repository state;
   9. whether any PR is currently open and awaiting review, including its number when identifiable.
7. Do not classify a PR merely because a previous conversation appears to have left one pending. Verify the actual PR and its current state first.

### Reviewer PR protocol

For every review:

- Require or identify the exact PR number before treating a change as the review target.
- Verify the real base/head and inspect the diff against the correct base.
- Do not use an old local branch, stale checkout, or implementer narrative as evidence of repository state.
- Independently verify scope claims, referenced files, relevant commit ancestry, and byte/content identity when such identity is claimed.
- Treat `ACCEPTED`, `ACCEPTED WITH MODIFICATION`, and `FAIL` as evidence-based classifications, not narrative continuations from an earlier chat.
- Keep code/config review separate from authorization to execute production deploys, probes, reruns, or observation windows.
- At material milestone closure, check whether `docs/current-state.md` / `docs/decisions.md` require synchronization.

## Risk-tiered review discipline

Review depth must follow the risk and scope of the current head rather than mechanically repeating a full repository review.

- **Full review** is required for new or changed methodology, frozen evaluation artifacts, architecture/privacy/security invariants, production behavior, deployment authorization, or other material state changes.
- **Patch-only re-review** is preferred when a previously accepted PR head changes only by a narrowly scoped corrective patch. The reviewer verifies the exact delta from the previously accepted head, confirms that previously accepted frozen artifacts and methodology are byte/content unchanged as applicable, and verifies the current-head checks. Unchanged content is not re-reviewed from scratch.
- **Mechanical verification first:** hashes, schemas, deterministic validators, CI, changed-file lists, and exact-head status should be checked mechanically before asking a reviewer for semantic judgment. Do not spend reviewer context re-deriving machine-checkable facts.
- The implementer should provide a compact evidence package: previous accepted head, current head, exact changed files/diff scope, relevant hashes, CI/status results, and any remaining semantic question.
- Reviewer output should be concise: classification plus only the evidence/reasoning needed to support it. Brevity does not relax evidence requirements.
- Patch-only review must escalate to full review if the delta changes semantics, frozen bytes, methodology, scope, invariants, or if the claimed narrow scope cannot be independently verified.
- Exact-head discipline remains mandatory: an acceptance applies only to the reviewed head. Any subsequent head change requires at least a new delta review before merge.

## Progress reporting discipline

- Do not imply asynchronous or background progress. A status update must distinguish work actually performed in the current turn from work not yet started.
- Use an evidence-bearing form when tools were actually called: **"This turn I actually called tools; X was completed; evidence: Y."**
- Otherwise state plainly that work has not started or is waiting for the user's next explicit instruction. Do not say "I am continuing", "already in progress", or equivalent when no current-turn work occurred.
- Repository state, commits, checks, and PRs are evidence of completed repository work; plans and intentions are not.

## Suggested new-chat prompts

### Implementer

> LibEdge projesine implementer olarak devam ediyoruz. Repo `picohook/libedge-website`, canonical branch `staging`. Önce `docs/ai-handoff.md` içindeki **Implementer Startup Protocol**'ü uygula. Önce checkpoint'i ver; henüz kod değiştirme veya PR açma.

### Reviewer

> LibEdge projesine reviewer olarak devam ediyoruz. Repo `picohook/libedge-website`, canonical branch `staging`. Önce `docs/ai-handoff.md` içindeki **Reviewer Startup Protocol**'ü uygula. Önce bağımsız checkpoint'i ver; henüz hiçbir PR hakkında karar verme.

## Boundary

This file governs AI-session orientation, repository continuity, and review discipline. It does not itself authorize architecture changes, provider selection, production deployment, probes, observation windows, migrations, or changes to existing privacy/fail-closed invariants.