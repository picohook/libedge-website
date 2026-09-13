# Research Assistant — Evidence-first UI refinement

Status: UI-only design checkpoint.

## Product direction

The Research Assistant should read as an evidence-first research workspace rather than a generic chatbot.

Primary information hierarchy:

1. Research question
2. Evidence overview
3. Summary
4. Key findings
5. Conflicting evidence
6. Research gaps
7. Evidence/source panel with explicit claim-to-evidence relationships

## Evidence panel

Each fixture evidence card should make the relationship to the synthesis visible, for example:

- Supports Finding 1
- Supports Finding 2
- Relevant to conflicting evidence
- Publication metadata / DOI when available

Citation interaction should continue to focus/highlight the corresponding evidence card.

## Differentiation

Do not copy competitor UI. Preserve the existing LibEdge visual language and emphasize auditability: the user should be able to see not only *which source exists*, but *which finding it supports* and where evidence is mixed.

## Decision boundary

- Fixture/UI only.
- No `/api/assistant/ask` transport change.
- No provider/model integration.
- No Provider Privacy Gate change.
- No backend response-contract change.
- No production behavior change.
