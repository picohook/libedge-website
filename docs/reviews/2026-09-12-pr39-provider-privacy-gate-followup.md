# PR #39 — Provider Privacy Gate Reviewer Follow-up

Status: `FOLLOW-UP READY`

Reviewer result received in the main engineering thread: `ACCEPTED WITH MODIFICATION`.

## Requested modification

Reviewer requested:

- change the active Bedrock Fable candidate from `claude-fable-5` to current `claude-fable-5.1`;
- distinguish the legacy `provider_data_share` mode from current `aws_review` handling;
- preserve the existing privacy verdict and gate methodology.

## Main-thread reconciliation

The model identifier correction to `claude-fable-5.1` is accepted and applied.

During implementation, current official AWS documentation was rechecked. It states that:

- both Claude Fable 5 and Claude Fable 5.1 require human review;
- current `aws_review` retains content within AWS and may permit AWS human review;
- `provider_data_share` is a legacy compatibility mode;
- Bedrock does not share customer content with model providers today, even when the legacy `provider_data_share` setting is configured.

Therefore the reviewer-supplied historical assertion that Fable 5 under `provider_data_share` actually sent content to Anthropic is not transcribed as established fact. It is recorded as an open source conflict in the canonical gate record with an explicit reconciliation trigger.

## Effect on verdict

No verdict is relaxed.

- Bedrock `anthropic.claude-fable-5.1` standard route: `FAIL` because up-to-30-day retention within AWS and possible AWS human review conflict with the locked LibEdge privacy invariant.
- No candidate is promoted to `PASS`.
- Provider/model selection remains blocked.

## Files changed in follow-up

- `docs/architecture/p05-provider-privacy-gate.md`
- this follow-up record

## Decision Boundary

This follow-up does not select a provider/model, authorize LLM use, authorize AI implementation, alter D-016, reopen 0047/0049, or authorize production work.
