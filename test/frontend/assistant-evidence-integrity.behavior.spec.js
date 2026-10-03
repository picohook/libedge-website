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
        research_summary: {
          literature: { retrieved_count: 17, authorized_relevant_count: 6, abstract_bearing_count: 4, metadata_only_count: 2 },
          verification: { checked_count: 3, verified_count: 1, truncated_count: 2 }
        },
        claims: [
          { text: 'Live supported finding', evidence_ids: ['live-e1'] },
          { text: 'Second verified finding', evidence_ids: ['live-e2'] }
        ],
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
        }, {
          evidence_id: 'live-e2',
          title: 'Second evidence title',
          abstract: '',
          doi: '10.1000/second',
          evidence: { level: 'METADATA_ONLY', sources: [] },
          urls: { doi: 'https://doi.org/10.1000/second' }
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
  await page.addInitScript(() => localStorage.setItem('language', 'en'));
  await page.goto(`${baseURL}/assistant.html`);
  await expect(page.getByText('Sample fixture record representing hydrogen permeability')).toHaveCount(0);
  await expect(page.locator('.evidence-overview')).toHaveCount(0);
  await expect(page.locator('.source-count')).toHaveText('0');

  await page.locator('#assistantQuery').fill('new production smoke query');
  await page.locator('#assistantDemoSearch').click();

  await expect(page.getByText('Live supported finding')).toBeVisible();
  await expect(page.getByText('Live evidence title')).toBeVisible();
  await expect(page.getByText('Second evidence title')).toBeVisible();
  await expect(page.locator('[data-verification-state="checker-passed"]')).toHaveCount(2);
  await expect(page.getByText('Verified · passed checker contract')).toHaveCount(2);
  await expect(page.locator('#assistantSources [data-live-evidence]')).toHaveCount(2);
  await expect(page.locator('.source-count')).toHaveText('2');
  const summary = page.locator('[data-live-evidence-overview][data-research-summary="true"]');
  await expect(summary).toBeVisible();
  await expect(summary.getByText('17')).toBeVisible();
  await expect(summary.getByText('works found')).toBeVisible();
  await expect(summary.getByText('6')).toBeVisible();
  await expect(summary.getByText('eligible evidence records')).toBeVisible();
  await expect(summary.getByText('4')).toBeVisible();
  await expect(summary.getByText('records with abstracts')).toBeVisible();
  await expect(summary.getByText('metadata-only records')).toBeVisible();
  await expect(summary.getByText('claims checked')).toBeVisible();
  await expect(summary.getByText('verified findings')).toBeVisible();
  await expect(summary.getByText('not checked due to request limit')).toBeVisible();
  await expect(summary.getByText('sources reviewed')).toHaveCount(0);
  await expect(page.getByText('Sample fixture record representing hydrogen permeability')).toHaveCount(0);
  await expect(page.locator('[data-live-evidence] [data-evidence-level="ABSTRACT"]')).toHaveText('ABSTRACT');
  await expect(page.locator('[data-live-evidence] [data-evidence-level="METADATA_ONLY"]')).toHaveText('METADATA ONLY');
  const firstFinding = page.locator('.finding-item').filter({ hasText: 'Live supported finding' });
  await firstFinding.click();
  await expect(firstFinding).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#live-live-e1')).toHaveClass(/is-related/);
  await expect(page.locator('#live-live-e2')).not.toHaveClass(/is-related/);
  const secondFinding = page.locator('.finding-item').filter({ hasText: 'Second verified finding' });
  await secondFinding.focus();
  await page.keyboard.press('Enter');
  await expect(secondFinding).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#live-live-e2')).toHaveClass(/is-related/);
  await expect(page.locator('#live-live-e1')).not.toHaveClass(/is-related/);
  await expect(page.locator('[data-live-evidence] .live-source-links a')).toHaveCount(4);
  await expect(page.locator('#live-live-e1').getByRole('link', { name: 'DOI' })).toHaveAttribute('href', 'https://doi.org/10.1000/live');
  await expect(page.getByRole('link', { name: 'Publisher' })).toHaveAttribute('href', 'https://publisher.example/article');
  await expect(page.getByRole('link', { name: 'Open full text' })).toHaveAttribute('href', 'https://repository.example/live');
  for (const link of await page.locator('[data-live-evidence] .live-source-links a').all()) {
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
  test('distinguishes corpus breadth from unique sources supporting verified findings', async ({ page }) => {
    await page.goto('/assistant.html');
    await page.locator('#assistant-query').fill('support breadth');
    await page.locator('#assistant-run').click();
    await expect(page.locator('[data-research-summary="true"]')).toContainText('6');
    await expect(page.locator('[data-research-summary="true"]')).toContainText(/sources supporting verified findings|doğrulanmış bulguları destekleyen kaynak/i);
    await expect(page.locator('.evidence-support-note')).toContainText(/1 supporting source|1 destekleyici kaynağa/i);
  });

});
