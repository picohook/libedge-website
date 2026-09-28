import { describe, expect, it, vi } from 'vitest';
import { __test, bedrockAdapterConfig, createBedrockModelAdapter } from '../../backend/src/assistant/bedrock-model-adapter.js';

describe('Bedrock assistant adapter boundary', () => {
  it('defaults to the narrowly configured Sonnet 4.6 inference profile and region', () => {
    expect(bedrockAdapterConfig({})).toEqual({
      region: 'us-east-1',
      modelId: 'us.anthropic.claude-sonnet-4-6'
    });
  });

  it('does not create an adapter without environment credentials', () => {
    expect(createBedrockModelAdapter({})).toBeNull();
  });

  it('keeps credentials out of the provider prompt', () => {
    const env = { AWS_ACCESS_KEY_ID: 'secret-access', AWS_SECRET_ACCESS_KEY: 'secret-key' };
    const credentials = __test.credentialsFromEnv(env);
    expect(credentials).toEqual({ accessKeyId: 'secret-access', secretAccessKey: 'secret-key' });
    const prompt = __test.promptFor('hydrogen membrane', { pack_id: 'p1', evidence: [] });
    expect(prompt).not.toContain('secret-access');
    expect(prompt).not.toContain('secret-key');
  });

  it('sends only task/evidence-derived content and parses structured claims', async () => {
    const send = vi.fn(async () => ({
      body: new TextEncoder().encode(JSON.stringify({
        content: [{ type: 'text', text: JSON.stringify({ claims: [{ text: 'Claim', evidence_ids: ['p1:e1'] }] }) }]
      }))
    }));
    const clientFactory = vi.fn(() => ({ send }));
    const adapter = createBedrockModelAdapter({
      AWS_ACCESS_KEY_ID: 'ak',
      AWS_SECRET_ACCESS_KEY: 'sk'
    }, { clientFactory });

    const result = await adapter.generateClaims({
      task: 'hydrogen membrane',
      evidencePack: { pack_id: 'p1', evidence: [{ evidence_id: 'p1:e1', title: 'Paper' }] }
    });

    expect(result).toEqual({ claims: [{ text: 'Claim', evidence_ids: ['p1:e1'] }] });
    expect(send).toHaveBeenCalledOnce();
    const command = send.mock.calls[0][0];
    const body = JSON.parse(new TextDecoder().decode(command.input.body));
    const prompt = body.messages[0].content[0].text;
    expect(prompt).toContain('hydrogen membrane');
    expect(prompt).toContain('p1:e1');
    expect(prompt).not.toContain('"ak"');
    expect(prompt).not.toContain('"sk"');
  });
  it('classifies model-output parse failures with fixed content-free reasons', () => {
    for (const [payload, reason] of [
      [{ content: [] }, 'MODEL_OUTPUT_EMPTY'],
      [{ content: [{ type: 'text', text: 'not-json' }] }, 'MODEL_OUTPUT_NOT_JSON'],
      [{ content: [{ type: 'text', text: '{"other":[]}' }] }, 'MODEL_OUTPUT_CLAIMS_REQUIRED']
    ]) {
      try {
        __test.parseClaimsPayload(payload);
        throw new Error('expected diagnostic failure');
      } catch (error) {
        expect(error.name).toBe('ModelAdapterDiagnosticError');
        expect(error.diagnostic_reason).toBe(reason);
      }
    }
  });

  it('accepts one exact JSON code fence but rejects surrounding prose', () => {
    const fenced = { content: [{ type: 'text', text: '```json\\n{"claims":[{"text":"Claim","evidence_ids":["p1:e1"]}]}\\n```' }] };
    expect(__test.parseClaimsPayload(fenced)).toEqual({ claims: [{ text: 'Claim', evidence_ids: ['p1:e1'] }] });

    const prose = { content: [{ type: 'text', text: 'Here is the JSON:\\n```json\\n{"claims":[]}\\n```' }] };
    expect(() => __test.parseClaimsPayload(prose)).toThrowError(expect.objectContaining({ diagnostic_reason: 'MODEL_OUTPUT_NOT_JSON' }));
  });

});
