import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const rootDir = path.resolve('.');
let server;
let baseURL;

test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (url.pathname === '/api/user/profile') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ user_id: 1, full_name: 'Research Smoke' }));
      return;
    }
    if (url.pathname === '/api/assistant/ask' && req.method === 'POST') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        ok: true, code: 'OK', evidence_pack_id: 'browser-regression',
        claims: [{ text: 'Live supported finding', evidence_ids: ['live-e1'] }],
        evidence: [{
          evidence_id: 'live-e1',
          title: 'Live evidence title',
          abstract: 'Live evidence abstract',
          doi: '10.1000/live',
          evidence: { level: 'ABSTRACT', sources: [] },
          urls: {
            doi: 'https://doi.org/10.1000/live',
            publisher: 'https://publisher.example/article',
            openAccess: 'https://repository.example/live'
          }
        }]
      }));
      return;
    }
    const requested = url.pathname === '/' ? '/assistant.html' : decodeURIComponent(url.pathname);
    const filePath = path.resolve(rootDir, requested.replace(/^\/+/, ''));
    if (!filePath.startsWith(rootDir)) { res.writeHead(403); res.end(); return; }
    try {
      const body = await readFile(filePath);
      const ext = path.extname(filePath);
      const type = ext === '.html' ? 'text/html; charset=utf-8' : ext === '.js' ? 'text/javascript; charset=utf-8' : ext === '.css' ? 'text/css; charset=utf-8' : 'application/octet-stream';
      res.writeHead(200, { 'content-type': type }); res.end(body);
    } catch { res.writeHead(404); res.end('not found'); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${server.address().port}`;
});

test.afterAll(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('fixture evidence is absent and live evidence/counts are rendered in a real browser', async ({ page }) => {
  await page.goto(`${baseURL}/assistant.html`);
  await expect(page.getByText('Sample fixture record representing hydrogen permeability')).toHaveCount(0);
  await expect(page.locator('.evidence-overview')).toHaveCount(0);
  await expect(page.locator('.source-count')).toHaveText('0');

  await page.locator('#assistantQuery').fill('new production smoke query');
  await page.locator('#assistantDemoSearch').click();

  await expect(page.getByText('Live supported finding')).toBeVisible();
  await expect(page.getByText('Live evidence title')).toBeVisible();
  await expect(page.locator('#assistantSources [data-live-evidence]')).toHaveCount(1);
  await expect(page.locator('.source-count')).toHaveText('1');
  await expect(page.locator('[data-live-evidence-overview] strong').first()).toHaveText('1');
  await expect(page.getByText('Sample fixture record representing hydrogen permeability')).toHaveCount(0);
  await expect(page.locator('[data-live-evidence] [data-evidence-level="ABSTRACT"]')).toHaveText('ABSTRACT');
  await expect(page.locator('[data-live-evidence] .live-source-links a')).toHaveCount(3);
  await expect(page.getByRole('link', { name: 'DOI' })).toHaveAttribute('href', 'https://doi.org/10.1000/live');
  await expect(page.getByRole('link', { name: 'Publisher' })).toHaveAttribute('href', 'https://publisher.example/article');
  await expect(page.getByRole('link', { name: 'Open access' })).toHaveAttribute('href', 'https://repository.example/live');
  for (const link of await page.locator('[data-live-evidence] .live-source-links a').all()) {
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
});
