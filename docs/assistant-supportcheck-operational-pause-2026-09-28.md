# supportCheck operational pause runbook

Status: implementation candidate for D-023 Open Item #1. This does not enable supportCheck.

The live pause state is stored in the already-bound `RATE_LIMIT_KV` key:

`assistant:supportcheck:paused`

The runtime is fail-closed:
- missing KV binding -> paused;
- missing key -> paused;
- KV read error -> paused;
- any value other than the explicit resume values `false`, `0`, or `resume` -> paused.

This makes the safe deployment default **paused**. A reviewed staging exercise must explicitly write `resume`, verify the authorized checker path, then write `true` and verify that new supportCheck-gated claims fail closed without a redeploy. The exercise must use non-user-derived test inputs and must not occur before checker privacy PASS.

Production remains paused/off until separate production authorization. Trigger A/B handling may set the key to `true` as an operational stop; it must not silently auto-resume.
