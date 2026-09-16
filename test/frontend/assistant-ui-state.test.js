import { describe, expect, it } from 'vitest';
import { loadingStage, mapAssistantResult, mapLiveAssistantResult } from '../../assets/js/assistant-ui-state.js';

describe('Assistant UI response contract', () => {
  it('maps a grounded success result without dropping claims', () => {
    const result = mapAssistantResult({
      ok: true,
      code: 'OK',
      claims: [{ text: 'Supported claim', evidence_ids: ['pack:e1'] }],
      evidence_pack_id: 'pack'
    });
    expect(result.state).toBe('success');
    expect(result.claims).toHaveLength(1);
    expect(result.evidencePackId).toBe('pack');
  });

  it('maps privacy-gate and missing-adapter states to non-success UI states', () => {
    expect(mapAssistantResult({ ok: false, code: 'PROVIDER_PRIVACY_GATE_REQUIRED', claims: [] }).state).toBe('gate-blocked');
    expect(mapAssistantResult({ ok: false, code: 'MODEL_ADAPTER_REQUIRED', claims: [] }).state).toBe('adapter-missing');
  });

  it('keeps retrieval, evidence, model and grounding failures fail-closed', () => {
    for (const code of ['DISCOVER_FAILED', 'EVIDENCE_PACK_FAILED', 'MODEL_ADAPTER_FAILED', 'MODEL_OUTPUT_INVALID', 'GROUNDING_VALIDATION_FAILED', 'GROUNDING_REJECTED']) {
      const result = mapAssistantResult({ ok: false, code, claims: [{ text: 'must not render' }] });
      expect(result.state).not.toBe('success');
      expect(result.claims).toEqual([]);
    }
  });

  it('keeps a live OK result fail-closed when the evidence payload is absent', () => {
    const result = mapLiveAssistantResult({
      ok: true,
      code: 'OK',
      claims: [{ text: 'must not render', evidence_ids: ['pack:e1'] }],
      evidence_pack_id: 'pack'
    });
    expect(result.state).toBe('evidence-payload-required');
    expect(result.claims).toEqual([]);
    expect(result.title).toMatch(/kanıt/i);
  });

  it('allows a live OK result only when evidence is an array', () => {
    const result = mapLiveAssistantResult({
      ok: true,
      code: 'OK',
      claims: [{ text: 'Supported claim', evidence_ids: ['pack:e1'] }],
      evidence_pack_id: 'pack',
      evidence: []
    });
    expect(result.state).toBe('success');
    expect(result.claims).toHaveLength(1);
  });

  it('does not let fail-closed live states leak claims', () => {
    for (const code of ['PROVIDER_PRIVACY_GATE_REQUIRED', 'MODEL_ADAPTER_REQUIRED', 'EVIDENCE_PAYLOAD_REQUIRED']) {
      const result = mapLiveAssistantResult({ ok: false, code, claims: [{ text: 'must not render' }] });
      expect(result.state).not.toBe('success');
      expect(result.claims).toEqual([]);
    }
  });

  it('maps unknown codes to a generic fail-closed state', () => {
    const result = mapAssistantResult({ ok: false, code: 'SOMETHING_NEW', claims: [{ text: 'must not render' }] });
    expect(result.state).toBe('generic-error');
    expect(result.claims).toEqual([]);
  });

  it('exposes the three user-facing loading stages', () => {
    expect(loadingStage(0).title).toMatch(/kaynak/i);
    expect(loadingStage(1).title).toMatch(/kanıt/i);
    expect(loadingStage(2).title).toMatch(/doğrulan/i);
  });
});
