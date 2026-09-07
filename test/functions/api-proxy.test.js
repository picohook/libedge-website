import { afterEach, describe, expect, it, vi } from 'vitest';

import { onRequest } from '../../functions/api/[[path]].js';

describe('Pages API proxy', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('proxies staging API requests to the staging Worker and returns JSON bodies', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ products: [{ slug: 'evidencemd' }] }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ));

    const res = await onRequest({
      request: new Request('https://staging.libedge-website.pages.dev/api/products?visible=1'),
      env: {},
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const upstreamRequest = fetchMock.mock.calls[0][0];
    expect(upstreamRequest.url).toBe('https://libedge-api-staging.agursel.workers.dev/api/products?visible=1');
    expect(await res.json()).toEqual({ products: [{ slug: 'evidencemd' }] });
    expect(res.headers.has('Content-Length')).toBe(false);
    expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
  });

  it('copies auth cookies to Authorization for upstream requests', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ));

    await onRequest({
      request: new Request('https://staging.libedge-website.pages.dev/api/user/profile', {
        headers: { Cookie: 'theme=dark; authToken=access-token; refreshToken=refresh-token' },
      }),
      env: {},
    });

    const upstreamRequest = fetchMock.mock.calls[0][0];
    expect(upstreamRequest.headers.get('Authorization')).toBe('Bearer access-token');
  });
});
