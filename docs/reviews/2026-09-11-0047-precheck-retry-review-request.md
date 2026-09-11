# 0047 — Corrected Precheck Retry — Review Request

Date: 2026-09-11
Status: `FRESH RETRY AUTHORIZATION REQUEST / NO DELETION EXECUTED`

## Why this review exists

The first controlled staging deletion precheck stopped on a test-harness typo (`support_ticket_replies` instead of `ticket_replies`) before any write occurred.

The reviewer requested three items before considering fresh retry authorization:

1. the full correction diff proving only that table name changed;
2. confirmation the bad identifier does not recur elsewhere;
3. one corrected read-only precheck proving all required objects are present before any destructive/synthetic execution.

All three are now complete.

## Evidence

Canonical evidence:

`docs/reviews/2026-09-11-0047-precheck-retry-evidence.md`

Evidence commit:

`f7cf7a87f5cbab0fa458c9e1f1e672020c82c68a`

## Item 1 — exact correction diff

Original precheck commit:

`bcfadf042cafe4d111c190c0d388b63884b8466d`

Corrected precheck commit:

`b8bee5bee1f0eebb89f3c12ad6c1765e50591af1`

GitHub compare reports exactly one changed file with `+1/-1`.

Only identifier replacement:

```diff
- support_ticket_replies
+ ticket_replies
```

No other precheck behavior changed.

## Item 2 — duplicate typo check

Repository code search for `support_ticket_replies` returned no results.

`migrations/0004_support_tickets.sql` creates the real `ticket_replies` table, and the reviewed 0047/0049 trigger uses the same name.

## Item 3 — corrected read-only live result

Run:

`34620472197`

Branch:

`staging`

Head SHA:

`b8bee5bee1f0eebb89f3c12ad6c1765e50591af1`

Conclusion:

`SUCCESS`

The required-object step passed and emitted:

`PRECHECK_PASS`

The corrected loop checked 30/30 required table objects, including `ticket_replies` and `user_notifications`.

The same run re-confirmed:

- no pending staging migrations;
- live `trg_users_privacy_cleanup` exists;
- live trigger contains explicit `user_notifications` cleanup from 0049;
- `user_notifications` remains FK-less with expected indexes.

## Safety boundary preserved

No account was created.
No fixture was seeded.
No user was deleted.
No R2 consumer was run.
No production resource was changed.
Semantic-primary remains outside this work.

The temporary retry workflow was removed after PASS.

Cleanup commit:

`abea7ee07a06cf145651167a3ab1021f7f9b5d85`

## Review questions

1. Does the +1/-1 diff prove the retry corrected only the known harness typo?
2. Is the repository-wide absence of `support_ticket_replies`, plus canonical `ticket_replies` schema evidence, sufficient to close the typo concern?
3. Does run `34620472197` sufficiently prove the corrected read-only precheck now reaches 30/30 required objects and `PRECHECK_PASS`?
4. Was cleanup of the one-time workflow appropriate?
5. Is any additional read-only blocker required before the single controlled synthetic staging execution already defined in the accepted packet?
6. If accepted, may the project perform exactly ONE controlled synthetic staging execution under the canonical packet, only after fresh human confirmation that the execution window still contains controlled test traffic only?

## Required classification

- ACCEPTED
- ACCEPTED WITH MODIFICATION
- REJECTED

Also report any material:

- OUT-OF-SCOPE FINDING

## Decision boundary

An ACCEPTED decision authorizes only the one already-defined controlled synthetic staging execution after a fresh human isolation confirmation.

It does NOT authorize:

- production migration or deletion;
- repeated retry after a STOP;
- D-016 Track B resumption;
- semantic-primary enablement;
- H/RRF/Vectorize;
- use of real user data.
