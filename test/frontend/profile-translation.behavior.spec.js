import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const rootDir = path.resolve('.');
let server;
let baseURL;

const collisionValue = 'Destek';

test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');

    if (url.pathname === '/api/user/profile') {
      return sendJson(res, {
        id: 1,
        email: 'profile-smoke@example.edu',
        full_name: collisionValue,
        role: 'user',
        institution: 'LibEdge QA',
        bio: '',
      });
    }

    if (url.pathname === '/api/user/profile-links') {
      return sendJson(res, {
        links: [
          {
            id: 1,
            link_type: 'website',
            label: collisionValue,
            url: 'https://example.com/profile-smoke',
          },
        ],
      });
    }

    if (url.pathname === '/api/auth/refresh' && req.method === 'POST') {
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
  await page.goto(`${baseURL}/profile.html`);
  await expect(page.locator('#profileName')).toHaveText(collisionValue);
});

test('user-owned profile name and link title survive repeated language toggles byte-for-byte', async ({ page }) => {
  const profileName = page.locator('#profileName');
  const overviewName = page.locator('#overviewName');
  const userLink = page.locator('#profileIdentityLinks a[data-no-translate], #profileSocialLinks a[data-no-translate]').first();

  await expect(profileName).toHaveAttribute('data-no-translate', '');
  await expect(overviewName).toHaveAttribute('data-no-translate', '');
  await expect(userLink).toHaveAttribute('title', collisionValue);
  await expect(userLink).toHaveAttribute('aria-label', collisionValue);

  for (let i = 0; i < 4; i += 1) {
    await page.locator('#translateBtn').click();
    await expect(profileName).toHaveText(collisionValue);
    await expect(overviewName).toHaveText(collisionValue);
    await expect(userLink).toHaveAttribute('title', collisionValue);
    await expect(userLink).toHaveAttribute('aria-label', collisionValue);
  }
});

test('fallback profile UI remains translatable when no user name is present', async ({ page }) => {
  await page.route('**/api/user/profile', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 2,
        email: 'fallback-smoke@example.edu',
        full_name: '',
        role: 'user',
        institution: '',
        bio: '',
      }),
    });
  });

  await page.reload();
  const profileName = page.locator('#profileName');
  await expect(profileName).toHaveText('Kullanıcı');
  await expect(profileName).not.toHaveAttribute('data-no-translate', '');

  await page.locator('#translateBtn').click();
  await expect(profileName).not.toHaveText('Kullanıcı');
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
