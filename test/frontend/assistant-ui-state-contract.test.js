import { describe, expect, it } from 'vitest';
import { ASSISTANT_UI_STATES, loadingStage, mapLiveAssistantResult } from '../../assets/js/assistant-ui-state.js';

describe('Assistant UI state contract', () => {
  it('maps a complete verified result to success', () => {
    const mapped = mapLiveAssistantResult({
      ok: true,
      code: 'OK',
      claims: [{ text: 'Supported claim', evidence_ids: ['e1'] }],
      evidence: [{ evidence_id: 'e1' }],
      evidence_pack_id: 'pack-1'
    });

    expect(mapped.state).toBe(ASSISTANT_UI_STATES.SUCCESS);
    expect(mapped.claims).toHaveLength(1);
    expect(mapped.evidencePackId).toBe('pack-1');
  });

  it('fails closed when a nominal success lacks evidence payload', () => {
    const mapped = mapLiveAssistantResult({ ok: true, code: 'OK', claims: [] });
    expect(mapped.state).toBe(ASSISTANT_UI_STATES.EVIDENCE_PAYLOAD_REQUIRED);
    expect(mapped.claims).toEqual([]);
  });

  it.each([
    ['PROVIDER_PRIVACY_GATE_REQUIRED', ASSISTANT_UI_STATES.GATE_BLOCKED],
    ['MODEL_ADAPTER_REQUIRED', ASSISTANT_UI_STATES.ADAPTER_MISSING],
    ['ASSISTANT_QUERY_INVALID', ASSISTANT_UI_STATES.INVALID_QUERY],
    ['ASSISTANT_QUERY_REQUIRED', ASSISTANT_UI_STATES.INVALID_QUERY],
    ['DISCOVER_FAILED', ASSISTANT_UI_STATES.RETRIEVAL_ERROR],
    ['EVIDENCE_PACK_FAILED', ASSISTANT_UI_STATES.EVIDENCE_ERROR],
    ['MODEL_ADAPTER_FAILED', ASSISTANT_UI_STATES.MODEL_ERROR],
    ['MODEL_OUTPUT_INVALID', ASSISTANT_UI_STATES.MODEL_ERROR],
    ['GROUNDING_VALIDATION_FAILED', ASSISTANT_UI_STATES.GROUNDING_REJECTED],
    ['GROUNDING_REJECTED', ASSISTANT_UI_STATES.GROUNDING_REJECTED]
  ])('maps %s without exposing claims', (code, expectedState) => {
    const mapped = mapLiveAssistantResult({ ok: false, code, claims: [{ text: 'must not leak' }] });
    expect(mapped.state).toBe(expectedState);
    expect(mapped.claims).toEqual([]);
  });

  it('fails closed for unknown errors', () => {
    const mapped = mapLiveAssistantResult({ ok: false, code: 'UNEXPECTED' });
    expect(mapped.state).toBe(ASSISTANT_UI_STATES.GENERIC_ERROR);
    expect(mapped.claims).toEqual([]);
  });

  it('bounds loading stages safely', () => {
    expect(loadingStage(-10)).toEqual(loadingStage(0));
    expect(loadingStage(999)).toEqual(loadingStage(2));
  });
});
