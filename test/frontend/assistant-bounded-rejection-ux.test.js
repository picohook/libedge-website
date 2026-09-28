import { describe, expect, it } from 'vitest';
import { mapLiveAssistantResult } from '../../assets/js/assistant-ui-state.js';

const SAFE_TR = 'Bu soruya yeterli kanıtla doğrulanmış bir yanıt oluşturamadım.';
const SAFE_EN = 'I could not produce an answer to this question that was verified with sufficient evidence.';

describe('Assistant bounded rejection UX', () => {
  for (const code of ['GROUNDING_REJECTED', 'GROUNDING_VALIDATION_FAILED']) {
    it(`${code} exposes no draft claims and uses the bounded safe message`, () => {
      const state = mapLiveAssistantResult({
        ok: false,
        code,
        claims: [{ text: 'unverified draft', evidence_ids: ['x'] }],
        evidence: [{ evidence_id: 'x', abstract: 'draft evidence' }]
      });
      expect(state.claims).toEqual([]);
      expect(state.message).toBe(SAFE_TR);
      expect(state.messageEn).toBe(SAFE_EN);
    });
  }
});
