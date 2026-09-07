import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const rootDir = path.resolve('.');
let server;
let baseURL;
let contactSubmissions;

test.beforeAll(async () => {
  contactSubmissions = [];
  server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');

    if (url.pathname === '/api/products') {
      return sendJson(res, {
        products: [
          {
            slug: 'evidencemd',
            name: 'EvidenceMD',
            logo_url: 'assets/images/evidencemd_logo.png',
            access_url: 'https://evidencemd.ai/',
            brochure_url: 'https://evidencemd.ai/brochure.pdf',
            subjects_json: '["saglik","yapay-zeka"]',
          },
          {
            slug: 'grammarly',
            name: 'Grammarly',
            logo_url: 'assets/images/grammarly_logo.svg',
            access_url: 'https://www.grammarly.com/',
            brochure_url: 'https://www.grammarly.com/business/education',
            subjects_json: '["yapay-zeka"]',
          },
          {
            slug: 'superhuman-suite',
            name: 'Superhuman Suite',
            logo_url: 'assets/images/superhuman_logo.png',
            access_url: 'https://superhuman.com/',
            brochure_url: 'https://superhuman.com/',
            subjects_json: '["yapay-zeka"]',
          },
        ],
      });
    }

    if (url.pathname === '/api/contact' && req.method === 'POST') {
      const body = await readRequestBody(req);
      contactSubmissions.push(JSON.parse(body || '{}'));
      return sendJson(res, { success: true });
    }

    const filePath = resolveStaticPath(url.pathname);
    if (!filePath) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    try {
      const body = await readFile(filePath);
      res.writeHead(200, { 'content-type': contentType(filePath) });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  baseURL = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

test.beforeEach(async ({ page }) => {
  contactSubmissions.length = 0;
  await page.goto(`${baseURL}/index.html`);
  await expect(page.locator('#products-grid')).toBeVisible();
  await expect(page.locator('#site-header nav, nav.nav-glass').first()).toBeVisible();
});

test('product filters keep new product cards discoverable', async ({ page }) => {
  await expect(page.locator('#evidencemd')).toBeVisible();
  await expect(page.locator('#grammarly')).toBeVisible();
  await expect(page.locator('#superhuman-suite')).toBeVisible();

  await page.locator('.subject-btn[data-subject="saglik"]').click();
  await expect(page.locator('#evidencemd')).toBeVisible();
  await expect(page.locator('#grammarly')).toHaveCount(0);

  await page.locator('.subject-btn[data-subject="all"]').click();
  await expect(page.locator('#grammarly')).toBeVisible();
  await expect(page.locator('#superhuman-suite')).toBeVisible();
});

test('product action buttons use API links when present', async ({ page }) => {
  await expect(page.locator('#evidencemd .flip-back a', { hasText: 'Broşür' }))
    .toHaveAttribute('href', 'https://evidencemd.ai/brochure.pdf');
  await expect(page.locator('#grammarly .flip-back a', { hasText: 'Broşür' }))
    .toHaveAttribute('href', 'https://www.grammarly.com/business/education');
  await expect(page.locator('#superhuman-suite .flip-back a', { hasText: 'Erişim Linki' }))
    .toHaveAttribute('href', 'https://superhuman.com/');
});

test('homepage content keeps public QA copy clean', async ({ page }) => {
  await expect(page.locator('#services')).toContainText('20 yıla yakın sektör deneyimimizle');
  await expect(page.getByText(/15 yılı aşkın/)).toHaveCount(0);
  await expect(page.getByText('- .../...')).toHaveCount(0);
  await expect(page.getByText(/Sağladıkları eğitimler çok faydalı/)).toHaveCount(0);
});

test('trial and suggestion modals validate and submit without page navigation', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());

  await page.getByRole('button', { name: /deneme erişimi/i }).click();
  await expect(page.locator('#trialModal')).toBeVisible();
  await expect(page.locator('#trialEmail')).toHaveAttribute('required', '');
  await expect(page.locator('#trialForm')).toHaveJSProperty('noValidate', false);
  expect(await page.locator('#trialEmail').evaluate((el) => el.checkValidity())).toBe(false);

  await page.locator('#trialName').fill('Frontend Smoke');
  await page.locator('#trialEmail').fill('frontend-smoke@example.edu');
  await page.locator('#trialCompany').fill('LibEdge QA');
  await page.locator('#trialForm textarea[name="message"]').fill('Trial form behavior smoke');
  await page.locator('#trialForm button[type="submit"]').click();
  await expect(page.locator('#trialModal')).toBeHidden();
  expect(contactSubmissions.at(-1)).toMatchObject({
    formType: 'trial',
    email: 'frontend-smoke@example.edu',
  });

  await page.getByRole('button', { name: /ürün önerisi/i }).click();
  await expect(page.locator('#suggestionModal')).toBeVisible();
  await page.locator('#suggestName').fill('Frontend Smoke');
  await page.locator('#suggestEmail').fill('suggest-smoke@example.edu');
  await page.locator('#suggestCompany').fill('LibEdge QA');
  await page.locator('#suggestionForm textarea[name="message"]').fill('Suggestion form behavior smoke');
  await page.locator('#suggestionForm button[type="submit"]').click();
  await expect(page.locator('#suggestionModal')).toBeHidden();
  expect(contactSubmissions.at(-1)).toMatchObject({
    formType: 'suggest',
    email: 'suggest-smoke@example.edu',
  });
});

test('language toggle translates key homepage controls', async ({ page }) => {
  if (!(await page.locator('#translateBtn').isVisible())) {
    await page.locator('.hamburger').click();
    await expect(page.locator('.nav-links')).toHaveClass(/active/);
  }

  await page.locator('#translateBtn').click();
  await expect(page.locator('#translateText')).toHaveText('Türkçe');
  await expect(page.locator('#products h2')).toHaveText('Products');
  await expect(page.locator('.subject-btn[data-subject="all"]')).toHaveText('All');

  await page.locator('#translateBtn').click();
  await expect(page.locator('#translateText')).toHaveText('English');
  await expect(page.locator('#products h2')).toHaveText('Ürünler');
});

test('mobile menu opens full-width and exposes new product links', async ({ page }) => {
  test.skip(test.info().project.name !== 'mobile-chromium', 'mobile navigation behavior is covered in the mobile project');

  await page.locator('.hamburger').click();
  await expect(page.locator('.hamburger')).toHaveAttribute('aria-expanded', 'true');
  const navLinks = page.locator('.nav-links');
  await expect(navLinks).toHaveClass(/active/);

  const viewportWidth = page.viewportSize()?.width || 0;
  const navBox = await navLinks.boundingBox();
  expect(navBox).not.toBeNull();
  expect(navBox.width).toBeGreaterThanOrEqual(viewportWidth - 2);

  const mobileProducts = page.locator('#mobile-products');
  await expect(mobileProducts).toBeVisible();
  const productsBox = await mobileProducts.boundingBox();
  expect(productsBox).not.toBeNull();
  expect(productsBox.width).toBeGreaterThan(viewportWidth * 0.85);

  await mobileProducts.getByRole('button', { name: /yapay zeka/i }).click();

  const aiLinks = mobileProducts.locator('.dropdown-list').first();
  await expect(aiLinks.locator('a[href="index.html#evidencemd"]')).toBeVisible();
  await expect(aiLinks.locator('a[href="index.html#grammarly"]')).toBeVisible();
  await expect(aiLinks.locator('a[href="index.html#superhuman-suite"]')).toBeVisible();
});

test('mobile hamburger remains available while scrolling', async ({ page }) => {
  test.skip(test.info().project.name !== 'mobile-chromium', 'mobile navigation behavior is covered in the mobile project');

  const hamburger = page.locator('.hamburger');
  await expect(hamburger).toBeVisible();

  await page.evaluate('window.scrollTo(0, 1200)');
  await expect.poll(() => page.evaluate('window.scrollY')).toBeGreaterThan(900);
  await expect(hamburger).toBeInViewport();
  await expect(hamburger).toBeVisible();
  await expect.poll(async () => {
    const box = await hamburger.boundingBox();
    return box ? Math.round(box.y) : 9999;
  }).toBeLessThan(80);

  await hamburger.click();
  await expect(hamburger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.nav-links')).toHaveClass(/active/);
});

test('live staging products endpoint completes in a browser when requested', async ({ page }) => {
  const liveURL = process.env.LIBEDGE_FRONTEND_SMOKE_LIVE_URL;
  test.skip(!liveURL, 'set LIBEDGE_FRONTEND_SMOKE_LIVE_URL to run live Network-panel style API validation');

  const response = await page.goto(`${liveURL.replace(/\/+$/, '')}/api/products`, {
    waitUntil: 'networkidle',
  });
  expect(response?.status()).toBe(200);
  const body = await page.locator('body').innerText();
  expect(body).toContain('EvidenceMD');
  expect(body).toContain('"brochure_url"');
  expect(body).toContain('"access_url"');
});

function resolveStaticPath(urlPathname) {
  const requested = urlPathname === '/' ? '/index.html' : decodeURIComponent(urlPathname);
  const relativePath = requested.replace(/^\/+/, '');
  const filePath = path.resolve(rootDir, relativePath);
  return filePath.startsWith(rootDir) ? filePath : '';
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}

function sendJson(res, body) {
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}
