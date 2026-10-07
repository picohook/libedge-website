import { describe, expect, it } from 'vitest';
import { ASSISTANT_UI_STATES, mapAssistantResult } from '../../assets/js/assistant-ui-state.js';

const expected = [
  ['ASSISTANT_RATE_LIMITED', 'warning'],
  ['ASSISTANT_USAGE_SCOPE_PAUSED', 'notice'],
  ['ASSISTANT_USAGE_SCOPE_QUOTA_EXHAUSTED', 'notice']
];

describe('Assistant expected operational code UX', () => {
  for (const [code, tone] of expected) {
    it(`${code} has explicit actionable copy instead of generic fallback`, () => {
      const mapped = mapAssistantResult({ ok: false, code });
      expect(mapped.tone).toBe(tone);
      expect(mapped.titleEn).not.toBe('The operation could not be completed');
      expect(mapped.messageEn).not.toContain('unexpected condition');
      expect(mapped.state).toBe(ASSISTANT_UI_STATES.GENERIC_ERROR);
    });
  }
});
