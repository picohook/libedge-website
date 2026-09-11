# 0047 — Controlled Staging Deletion — Fresh Pre-Execution Review Request

Date: 2026-09-11

Status: `REVIEW REQUEST / NO ACCOUNT CREATION OR DELETION AUTHORIZED`

## Context

The two structural prerequisites are now in staging:

- PR #37 admin audit-order fix is merged;
- migration 0049 has been independently ACCEPTED and successfully applied to remote staging.

`0047-PRIVACY-01` and `0047-SCOPE-01` are structurally corrected but remain behaviorally unverified because no real staging deletion has been executed.

## Canonical controlled packet

`docs/reviews/2026-09-11-0047-controlled-staging-deletion-packet.md`

Packet commit:

`bace5cd506fa5c5fff0026085a84e3b811be8961`

## Relevant staging evidence

PR #37 merge:

`a47669de451b3ca0997f607b71cb4d914634e825`

0049 controlled apply run:

`34606916660`

0049 apply result:

`SUCCESS`

Live staging trigger now explicitly contains:

```sql
DELETE FROM user_notifications WHERE user_id = OLD.id;
```

and semantically matches reviewed migration 0049.

No live deletion behavior is claimed yet.

## Locked execution design

The packet defines one synthetic controlled staging execution covering:

- admin deletion path;
- self-service deletion path;
- 30 deletion-policy domains;
- positive and negative control assertions;
- exact `25,000 ai_usage_logs + 25,000 notifications` stress fixture;
- ordinary deletion `<=2.0s`;
- stress admin deletion `<=5.0s`;
- unrelated-write probe `<=2.0s`;
- 0047-PRIVACY-01 audit-redaction closure criterion;
- 0047-SCOPE-01 explicit `user_notifications` deletion closure criterion;
- R2 purge-queue boundary;
- hard STOP with no silent retry.

No real user data may be used.

## Fresh human gate required even after ACCEPTED

Even if this packet is ACCEPTED, execution may begin only after a fresh human confirmation that the staging window contains controlled test traffic only and no ordinary real end-user research/application traffic is expected.

## Review questions

1. Is the packet now correctly aligned with the live 0049 trigger rather than the disproven FK-cascade assumption?
2. Is the 30-domain fixture sufficiently comprehensive?
3. Are DELETE / RETAIN+UNLINK / REDACT expectations clear enough for mechanical verification?
4. Are the locked stress volumes appropriate?
5. Are the 2.0s / 5.0s / 2.0s timing and lock thresholds appropriate?
6. Is the control-user mirror sufficient to detect over-deletion?
7. Does the admin audit assertion correctly prove `0047-PRIVACY-01` behaviorally?
8. Does the explicit `user_notifications` PRE/POST assertion correctly prove `0047-SCOPE-01` behaviorally?
9. Is the R2 queue/consumer boundary safe and adequately separated from DB proof?
10. Are STOP and recovery rules sufficient?
11. Is any additional blocker required before creating synthetic staging fixtures?
12. If accepted, may exactly one controlled synthetic staging execution defined by the packet proceed after fresh human traffic-isolation confirmation?

## Required classification

Return exactly one:

- `ACCEPTED`
- `ACCEPTED WITH MODIFICATION`
- `REJECTED`

Also report any material `OUT-OF-SCOPE FINDING`.

## Decision boundary

An `ACCEPTED` decision would authorize only the single synthetic staging execution defined in the packet, and only after fresh human traffic-isolation confirmation.

It would not authorize:

- production migration;
- production deletion;
- another execution after any STOP;
- D-016 Track B resumption;
- semantic-primary enablement;
- H/RRF/Vectorize;
- use of real user data.
