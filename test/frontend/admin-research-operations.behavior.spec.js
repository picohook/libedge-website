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
    const filePath = path.join(rootDir, url.pathname === '/' ? 'admin.html' : url.pathname.replace(/^\//, ''));
    try {
      const body = await readFile(filePath);
      res.writeHead(200, { 'content-type': filePath.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/plain' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${server.address().port}`;
});

test.afterAll(async () => {
  await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
});

test('Research operations center renders outcome, pipeline and account controls in a real browser', async ({ page }) => {
  await page.route('**/api/user/profile', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, role: 'super_admin', full_name: 'Test Super Admin', email: 'admin@example.test' }) });
  });
  await page.goto(`${baseURL}/admin.html`);
  await expect(page.locator('#authGate')).toBeVisible();
  const research = page.locator('#tab-research');
  await research.evaluate((el) => el.classList.remove('hidden'));

  await expect(research.getByText('Research Operasyon Merkezi')).toBeVisible();
  await expect(research.getByText('Verified yanıt', { exact: true })).toBeVisible();
  await expect(research.getByText('Geçerli boş / bulgu yok')).toBeVisible();
  await expect(research.getByText('Kurum Bazlı Kullanım')).toBeVisible();
  await expect(research.getByText('Kişi Bazlı Kullanım')).toBeVisible();
  await expect(research.locator('#researchCheckerPauseBtn')).toBeVisible();
  await expect(research.locator('#researchCheckerResumeBtn')).toBeVisible();
  await expect(research.locator('#researchOpsAlert')).toHaveAttribute('role', 'status');

  const institutionHeaders = await research.locator('#researchUsageInstitutions').locator('xpath=ancestor::table/thead').innerText();
  expect(institutionHeaders).toContain('Verified');
  expect(institutionHeaders).toContain('Boş');
  expect(institutionHeaders).toContain('Hata');
  expect(institutionHeaders).toContain('Research seat');
  expect(institutionHeaders).toContain('Bugünkü ortak havuz');

  const userHeaders = await research.locator('#researchUsageUsers').locator('xpath=ancestor::table/thead').innerText();
  expect(userHeaders).toContain('Kişi');
  expect(userHeaders).toContain('Kurum / scope');
  expect(userHeaders).toContain('Verified');
  expect(userHeaders).toContain('Boş');
  expect(userHeaders).toContain('Hata');



});
