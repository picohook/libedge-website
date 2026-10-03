import { describe, expect, it, vi, afterEach } from 'vitest';
import { fetchUnpaywallByDoi, normalizeUnpaywallRecord } from '../../backend/src/research/providers/unpaywall.js';
import { mergeUnpaywallEnrichment } from '../../backend/src/research/deduplicate.js';
import { enrichWithUnpaywall } from '../../backend/src/research/discover.js';
import { normalizeOpenAlexWork } from '../../backend/src/research/providers/openalex.js';

afterEach(() => vi.restoreAllMocks());

function baseWork() {
  return normalizeOpenAlexWork({
    id: 'https://openalex.org/W1',
    title: 'Example',
    doi: 'https://doi.org/10.1000/example',
    publication_year: 2026,
    authorships: [],
    open_access: { is_oa: false },
    primary_location: { source: { display_name: 'Journal' } }
  }, '2026-10-03T00:00:00.000Z');
}

describe('Unpaywall enrichment', () => {
  it('normalizes a found OA location and never promotes evidence depth', () => {
    const work = baseWork();
    const enrichment = normalizeUnpaywallRecord({
      doi: '10.1000/example',
      is_oa: true,
      oa_status: 'green',
      best_oa_location: { url_for_pdf: 'https://repository.example/paper.pdf' }
    }, '2026-10-03T01:00:00.000Z');
    const merged = mergeUnpaywallEnrichment(work, enrichment);
    expect(merged.openAccess).toMatchObject({ isOa: true, status: 'green', url: 'https://repository.example/paper.pdf', source: 'unpaywall' });
    expect(merged.urls.openAccess).toBe('https://repository.example/paper.pdf');
    expect(merged.evidence.level).toBe('METADATA_ONLY');
  });

  it('returns null for a DOI not found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    await expect(fetchUnpaywallByDoi('10.1000/missing', { UNPAYWALL_CONTACT_EMAIL: 'altan@libedge.com' })).resolves.toBeNull();
  });

  it('fails provider-locally on rate limits', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 429 })));
    await expect(fetchUnpaywallByDoi('10.1000/rate', { UNPAYWALL_CONTACT_EMAIL: 'altan@libedge.com' }))
      .rejects.toMatchObject({ code: 'UNPAYWALL_RATE_LIMITED', status: 429 });
  });

  it('uses DOI cache and avoids a second provider request', async () => {
    const store = new Map();
    const kv = {
      get: vi.fn(async (key) => store.get(key) || null),
      put: vi.fn(async (key, value) => { store.set(key, value); })
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      doi: '10.1000/example',
      is_oa: true,
      oa_status: 'gold',
      best_oa_location: { url: 'https://oa.example/article' }
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const env = { UNPAYWALL_CONTACT_EMAIL: 'altan@libedge.com', RATE_LIMIT_KV: kv };
    await enrichWithUnpaywall([baseWork()], env);
    await enrichWithUnpaywall([baseWork()], env);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(kv.put).toHaveBeenCalledTimes(1);
  });

  it('starts optional DOI lookups concurrently instead of serial batches', async () => {
    const started = [];
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      started.push(String(url));
      await gate;
      return new Response(JSON.stringify({ doi: '10.1000/example', is_oa: false }), { status: 200 });
    }));
    const works = Array.from({ length: 7 }, (_, index) => {
      const work = baseWork();
      work.doi = `10.1000/test-${index}`;
      return work;
    });
    const pending = enrichWithUnpaywall(works, { UNPAYWALL_CONTACT_EMAIL: 'altan@libedge.com' });
    await vi.waitFor(() => expect(started).toHaveLength(7));
    release();
    await pending;
  });


  it('degrades gracefully when the provider errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })));
    const original = baseWork();
    const result = await enrichWithUnpaywall([original], { UNPAYWALL_CONTACT_EMAIL: 'altan@libedge.com' });
    expect(result.status).toBe('unavailable');
    expect(result.results).toEqual([original]);
  });
});
