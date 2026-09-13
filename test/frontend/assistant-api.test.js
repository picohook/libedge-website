import { describe, expect, it, vi } from 'vitest';
import { askAssistant } from '../../assets/js/assistant-api.js';

function response(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: vi.fn(async () => body)
  };
}

describe('Assistant API transport', () => {
  it('posts only the query with same-origin credentials', async () => {
    const fetchImpl = vi.fn(async () => response(200, { ok: false, code: 'PROVIDER_PRIVACY_GATE_REQUIRED', claims: [] }));
    const result = await askAssistant('hydrogen membrane catalysis', { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/assistant/ask');
    expect(options.method).toBe('POST');
    expect(options.credentials).toBe('include');
    expect(JSON.parse(options.body)).toEqual({ query: 'hydrogen membrane catalysis' });
    expect(result.code).toBe('PROVIDER_PRIVACY_GATE_REQUIRED');
  });

  it('maps 401 without leaking response content', async () => {
    const result = await askAssistant('test query', { fetchImpl: vi.fn(async () => response(401, { error: 'secret-ish detail' })) });
    expect(result).toEqual({ ok: false, code: 'AUTH_REQUIRED', claims: [], http_status: 401 });
  });

  it('preserves the backend 400 query code', async () => {
    const result = await askAssistant('x', { fetchImpl: vi.fn(async () => response(400, { code: 'ASSISTANT_QUERY_INVALID' })) });
    expect(result.code).toBe('ASSISTANT_QUERY_INVALID');
    expect(result.claims).toEqual([]);
  });

  it('fails closed on non-json or non-success HTTP responses', async () => {
    const fetchImpl = vi.fn(async () => ({ status: 503, ok: false, json: vi.fn(async () => { throw new Error('bad json'); }) }));
    const result = await askAssistant('test query', { fetchImpl });
    expect(result).toEqual({ ok: false, code: 'ASSISTANT_HTTP_ERROR', claims: [], http_status: 503 });
  });
});
