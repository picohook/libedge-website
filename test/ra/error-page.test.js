import { describe, it, expect } from 'vitest';
import { htmlError } from '../../workers/proxy/src/error-page.js';

describe('htmlError', () => {
  it('returns a branded html response without leaking ignored raw details', async () => {
    const resp = htmlError(
      502,
      'Kurumun erişim sunucusuna ulaşılamadı.',
      'connect ECONNREFUSED secret-host'
    );
    const body = await resp.text();

    expect(resp.status).toBe(502);
    expect(resp.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(resp.headers.get('cache-control')).toBe('no-store');
    expect(body).toContain('LibEdge');
    expect(body).toContain('Kurumun erişim sunucusuna ulaşılamadı.');
    expect(body).not.toContain('ECONNREFUSED');
    expect(body).not.toContain('secret-host');
  });

  it('escapes messages before rendering html', async () => {
    const resp = htmlError(500, '<script>alert(1)</script>');
    const body = await resp.text();

    expect(body).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(body).not.toContain('<script>alert(1)</script>');
  });

  it('falls back to 500 for invalid status codes', () => {
    const resp = htmlError(700, 'Geçersiz durum');
    expect(resp.status).toBe(500);
  });
});
