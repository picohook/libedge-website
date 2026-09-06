# Tests

[Vitest](https://vitest.dev/) based. Runs under Node rather than Wrangler/Miniflare,
so it is fast enough for a pre-commit loop. Anything that needs real D1 / KV / R2
bindings remains a manual smoke check until a workers test harness is introduced.

## Layout

```text
test/
  backend/       -> unit tests for helpers exported from backend/src/index.js
    password.test.js          -> PBKDF2 hash/verify + legacy SHA-256 path
    rate-limit.test.js        -> KV-backed fixed-window rate limiter
    auth-refresh.test.js      -> refresh token helpers
    password-reset.test.js    -> reset token flow helpers
    register-consent.test.js  -> KVKK consent validation
    admin-products.test.js    -> product/admin helpers
```

## Running

```bash
npm test
npm run test:watch
```

## Adding Tests

- Pure helper? Export it from its module and add a focused test under
  `test/<module>/...`.
- Needs Hono `c.env`? Use `app.request(path, init, env)` from Hono and provide
  in-memory fakes for DB, R2 and KV.
- Never commit real secrets. Tests generate random keys on the fly.