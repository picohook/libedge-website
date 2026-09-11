# 0049 Controlled Staging Migration Apply — Closure Review Request

## Status

A single controlled staging application of migration 0049 has completed.

No account creation, fixture seed, user deletion, production migration, D-016 Track B resumption, or semantic-primary enablement occurred.

## Evidence record

`docs/reviews/2026-09-11-0049-staging-migration-apply-evidence.md`

Evidence commit:

`a8e13e5c0085f9c42cda1fb97b765d672a3d55ec`

## Workflow evidence

Run:

`34606916660`

Job:

`Controlled staging 0049 migration apply`

Conclusion:

`SUCCESS`

All three substantive phases completed successfully:

1. Pre-apply guardrails — SUCCESS
2. Apply exactly one authorized migration — SUCCESS
3. Post-apply verification — SUCCESS

## Exact executed apply command

```bash
npx wrangler d1 migrations apply libedge-db --env staging --remote
```

## Pre-apply result

- target: staging / `libedge-db` / remote;
- migration blob matched reviewed SHA `eba44d7bff0a38d8caaa54ffcd51b7763108ed89`;
- only pending migration was `0049_user_notifications_deletion_policy.sql`;
- live trigger matched reviewed pre-0049 migration-0047 semantics;
- live trigger did not yet contain explicit `user_notifications` cleanup;
- `user_notifications` had no FK and both expected indexes;
- `PRECHECKS PASS`.

## Apply result

Wrangler identified and applied exactly:

`0049_user_notifications_deletion_policy.sql`

Status was successful.

## Post-apply result

- migration list reported no migrations pending;
- live trigger contains `DELETE FROM user_notifications WHERE user_id = OLD.id;`;
- live trigger semantically matches reviewed migration-0049 trigger body;
- material migration-0047 privacy behavior remains present;
- `user_notifications` table/FK/index state remained unchanged;
- `POSTCHECKS PASS`.

## One-time workflow cleanup

The execution workflow was removed after success.

Cleanup commit:

`ad5a559cad3ae22abea988725fc379c418a3fe26`

## Questions for reviewer

1. Do the pre-apply checks demonstrate that only the reviewed 0049 migration was eligible to run?
2. Does the exact logged command match the previously authorized staging-only operation?
3. Does the Wrangler result demonstrate that exactly 0049 was applied?
4. Do the post-apply checks sufficiently prove that the live trigger now matches the reviewed 0049 semantics?
5. Was the `user_notifications` table itself correctly left unchanged?
6. Is the one-time workflow cleanup appropriate?
7. May `0047-SCOPE-01` now be considered structurally corrected in staging, while still withholding behavioral closure until a controlled deletion test succeeds?
8. If accepted, may the project return to the already-defined controlled staging deletion packet for a fresh pre-execution review, without yet creating or deleting any account?

## Required classification

Return exactly one:

- `ACCEPTED`
- `ACCEPTED WITH MODIFICATION`
- `REJECTED`

Also report any material `OUT-OF-SCOPE FINDING`.

## Decision boundary

`ACCEPTED` authorizes only:

- recording 0049 staging migration apply as independently verified PASS;
- classifying `0047-SCOPE-01` as structurally corrected in staging but behaviorally unverified;
- returning to controlled staging deletion-packet preparation/review.

It does NOT authorize:

- creating a staging account;
- fixture seeding;
- deleting any staging user;
- production migration;
- D-016 Track B resumption;
- semantic-primary enablement;
- automatic retry of any destructive test.
