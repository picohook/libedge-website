import { describe, expect, it } from 'vitest';
import { decryptAssistantHistory, encryptAssistantHistory } from '../../backend/src/assistant/history-crypto.js';

const secret = 'test-only-assistant-history-secret-at-least-32-chars';

describe('Assistant history encryption', () => {
  it('round-trips with AES-GCM without embedding plaintext', async () => {
    const plaintext = 'private research query';
    const ciphertext = await encryptAssistantHistory(plaintext, secret);
    expect(ciphertext).toMatch(/^v1\./);
    expect(ciphertext).not.toContain(plaintext);
    expect(await decryptAssistantHistory(ciphertext, secret)).toBe(plaintext);
  });

  it('uses a fresh IV for each encryption', async () => {
    const first = await encryptAssistantHistory('same content', secret);
    const second = await encryptAssistantHistory('same content', secret);
    expect(first).not.toBe(second);
  });

  it('rejects tampered ciphertext', async () => {
    const ciphertext = await encryptAssistantHistory('content', secret);
    const tampered = ciphertext.slice(0, -2) + 'AA';
    await expect(decryptAssistantHistory(tampered, secret)).rejects.toThrow();
  });

  it('rejects undersized secrets', async () => {
    await expect(encryptAssistantHistory('content', 'short')).rejects.toThrow(/at least 32/);
  });
});
