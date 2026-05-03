# Task Queue
*Owned by Architect. Builder and Reviewer read only the Active Step.*

---

## Active Step

Step: 04 - ra-browser: Playwright/Chromium service for CF Managed Challenge publishers
Owner: Builder
Status: ready-for-review
Depends on: Step 02
Gate: CF Managed Challenge cannot be bypassed by Go HTTP client (fingerprint mismatch, confirmed after exhaustive testing). Solution: add Node.js Playwright service to institution Docker Compose. Real Chrome fingerprint + institutional IP = CF passes. Success signal: Emerald opens through proxy without any manual step.

---

## Queue

- [ ] Step 03 - Review Emerald outcome and decide whether to generalize for other WAF publishers.

---

## Status Values

- `planned` - Architect is still scoping.
- `ready-for-builder` - brief is complete.
- `building` - Builder owns the step.
- `monitoring` - Execution Monitor is running checks.
- `ready-for-review` - Builder has handed off and monitor report exists.
- `reviewing` - Reviewer owns the step.
- `blocked` - Architect decision or Project Owner decision required.
- `cleared` - Reviewer cleared the step.
- `deployed` - Architect deployed and logged the result.

---

## Dependency Rules

- Step N+1 does not start until Step N is cleared or explicitly deferred by Architect.
- Builder does not write code unless Active Step is `ready-for-builder` or `building`.
- Reviewer does not review unless Active Step is `ready-for-review` or `reviewing`.
- Production deploys require Project Owner approval after review.
