# Tests

[Vitest](https://vitest.dev/) based. Runs under Node (not Wrangler/Miniflare) —
fast enough for a pre-commit loop (<2 seconds today). Anything that needs real
D1 / KV / R2 bindings lives as a manual smoke check until we pick a pool-workers
solution.

## Layout

```
test/
  ra/            → unit tests for the RA (remote access) module
    host.test.js       — hyphen encoding / decoding / validation
    jwt.test.js        — HS256 JWT signing/verification, tamper detection
    crypto.test.js     — AES-GCM credential encryption, HMAC, SHA-256
    routes.test.js     — issue-token direct_login + admin RA listing coverage
  backend/       → unit tests for helpers exported from backend/src/index.js
    password.test.js   — PBKDF2 hash/verify + legacy SHA-256 path
    rate-limit.test.js — KV-backed fixed-window rate limiter
```

## Running

```bash
npm test              # one-shot, CI-style
npm run test:watch    # watch mode for local development
```

## Adding tests

- Pure helper? Export it from its module (if not already) and add a test
  under `test/<module>/…`. No env setup required — see
  `test/ra/host.test.js` for the simplest pattern.

- Needs Hono `c.env`? Use `app.request(path, init, env)` from Hono — the
  worker's `app` is the default export of `backend/src/index.js`. Provide
  an in-memory env:

  ```js
  import app from '../../backend/src/index.js';

  const env = {
    DB: fakeD1(),        // see e.g. better-sqlite3 in-memory wrapper
    FILES_BUCKET: fakeR2(),
    RATE_LIMIT_KV: memoryKV(),  // see test/backend/rate-limit.test.js
  };
  const res = await app.request('/api/...', { method: 'POST', body: ... }, env);
  ```

  (No D1 fake in this PR — adding it is a follow-up.)

- Never commit real secrets. Tests generate random keys on the fly.
