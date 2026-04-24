#!/usr/bin/env node
/**
 * scripts/cleanup-r2-orphans.mjs
 *
 * One-shot cleanup for R2 objects left behind before the
 * owner-aware delete/update handlers (PR #4) were deployed. Walks
 * every managed-upload prefix, compares the R2 keys against the
 * columns in D1 that should reference them, and reports (or deletes)
 * anything in R2 that is no longer referenced.
 *
 * Managed prefixes covered:
 *   avatars/
 *   institution-logos/
 *   announcement-covers/
 *
 * Not touched — these have their own lifecycles / permission model
 * and are out of scope for this script:
 *   files/               managed library uploads (collection_files)
 *   ticket-attachments/  per-ticket files (ticket_replies)
 *
 * Usage:
 *   node scripts/cleanup-r2-orphans.mjs                        # dry-run, staging
 *   node scripts/cleanup-r2-orphans.mjs --apply                # delete, staging
 *   node scripts/cleanup-r2-orphans.mjs --env=production       # dry-run, prod
 *   node scripts/cleanup-r2-orphans.mjs --env=production --apply
 *
 * Required environment variables (R2 S3-compat credentials):
 *   CLOUDFLARE_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *
 * The D1 side uses `wrangler d1 execute --remote --json`, so the
 * usual CLOUDFLARE_API_TOKEN (or wrangler login) applies there.
 *
 * Credentials are read from env, never logged.
 */

import { spawnSync } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';

const args = parseArgs(process.argv.slice(2));
const ENV = args.env || 'staging';
const APPLY = !!args.apply;

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;

if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
  console.error('Missing CLOUDFLARE_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY');
  process.exit(2);
}

const BUCKET =
  ENV === 'production' ? 'libedge-files' : 'libedge-files-staging';
const REGION = 'auto';
const ENDPOINT = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;
const D1_DB = 'libedge-db';

console.log(
  `R2 orphan scan — env=${ENV} bucket=${BUCKET} mode=${APPLY ? 'APPLY' : 'dry-run'}`
);

const PREFIXES = {
  'avatars/': {
    sql: `SELECT avatar_url FROM users WHERE avatar_url IS NOT NULL AND avatar_url != ''`,
    column: 'avatar_url',
  },
  'institution-logos/': {
    sql: `SELECT logo_url FROM institutions WHERE logo_url IS NOT NULL AND logo_url != ''`,
    column: 'logo_url',
  },
  'announcement-covers/': {
    sql: `SELECT cover_image_url FROM announcements WHERE cover_image_url IS NOT NULL AND cover_image_url != ''`,
    column: 'cover_image_url',
  },
};

let totalOrphans = 0;
let totalDeleted = 0;
let totalBytes = 0;

for (const [prefix, cfg] of Object.entries(PREFIXES)) {
  console.log(`\n=== ${prefix} ===`);

  // 1. Pull referenced URLs from D1.
  const refRows = await queryD1(cfg.sql);
  const refKeys = new Set();
  for (const row of refRows) {
    const url = row[cfg.column];
    const key = extractKey(url, prefix);
    if (key) refKeys.add(key);
  }
  console.log(`  D1 rows referencing prefix: ${refKeys.size}`);

  // 2. List every R2 object under the prefix.
  const r2Keys = await listAll(prefix);
  console.log(`  R2 objects in bucket:       ${r2Keys.length}`);

  // 3. Diff.
  const orphans = r2Keys.filter(k => !refKeys.has(k.Key));
  console.log(`  orphans (in R2, not in D1): ${orphans.length}`);
  totalOrphans += orphans.length;

  if (orphans.length === 0) continue;

  // 4. Preview (first 10) + size total.
  const bytes = orphans.reduce((acc, o) => acc + (Number(o.Size) || 0), 0);
  totalBytes += bytes;
  console.log(`  orphan total size:          ${fmtBytes(bytes)}`);
  console.log('  first 10:');
  for (const o of orphans.slice(0, 10)) {
    console.log(`    ${o.Key}  (${fmtBytes(Number(o.Size) || 0)})`);
  }
  if (orphans.length > 10) {
    console.log(`    …and ${orphans.length - 10} more`);
  }

  // 5. Delete if --apply.
  if (APPLY) {
    console.log('  deleting…');
    for (const o of orphans) {
      try {
        await deleteObject(o.Key);
        totalDeleted++;
      } catch (err) {
        console.error(`    ! failed to delete ${o.Key}: ${err.message}`);
      }
    }
    console.log(`  deleted ${totalDeleted} so far`);
  }
}

console.log('\n=== summary ===');
console.log(`  total orphans found:  ${totalOrphans}`);
console.log(`  total size:           ${fmtBytes(totalBytes)}`);
if (APPLY) {
  console.log(`  total deleted:        ${totalDeleted}`);
} else {
  console.log('  dry-run only. Re-run with --apply to delete.');
}

// ──────────────────────────────────────────────────────────────────────────
// D1 via wrangler CLI
// ──────────────────────────────────────────────────────────────────────────

async function queryD1(sql) {
  const result = spawnSync(
    'npx',
    [
      'wrangler',
      'd1',
      'execute',
      D1_DB,
      `--env=${ENV}`,
      '--remote',
      `--command=${sql}`,
      '--json',
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    throw new Error(`wrangler d1 execute failed (exit ${result.status})`);
  }
  const trimmed = result.stdout.trim();
  const jsonStart = trimmed.indexOf('[');
  if (jsonStart < 0) return [];
  const jsonText = trimmed.slice(jsonStart);
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`cannot parse wrangler d1 JSON output: ${err.message}`);
  }
  // wrangler's JSON shape: [{ results: [...], success, meta }]
  if (Array.isArray(parsed) && parsed[0] && Array.isArray(parsed[0].results)) {
    return parsed[0].results;
  }
  return Array.isArray(parsed) ? parsed : [];
}

function extractKey(url, prefix) {
  if (typeof url !== 'string') return null;
  const idx = url.indexOf(prefix);
  if (idx < 0) return null;
  // Everything from the prefix onward, stripping any query string.
  const rest = url.slice(idx).split('?')[0].split('#')[0];
  return rest;
}

// ──────────────────────────────────────────────────────────────────────────
// R2 S3 API (SigV4 signed fetch, no dependencies)
// ──────────────────────────────────────────────────────────────────────────

async function listAll(prefix) {
  const all = [];
  let continuationToken;
  for (let page = 0; page < 1000; page++) {
    const params = new URLSearchParams({
      'list-type': '2',
      prefix,
      'max-keys': '1000',
    });
    if (continuationToken) params.set('continuation-token', continuationToken);
    const url = `${ENDPOINT}/${BUCKET}?${params.toString()}`;
    const res = await signedFetch('GET', url, null);
    if (!res.ok) {
      throw new Error(`R2 ListObjects ${res.status}: ${await res.text()}`);
    }
    const xml = await res.text();
    const contents = extractContents(xml);
    all.push(...contents);
    const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
    if (!truncated) break;
    const tokenMatch = /<NextContinuationToken>([^<]+)<\/NextContinuationToken>/.exec(xml);
    continuationToken = tokenMatch ? decodeXml(tokenMatch[1]) : undefined;
    if (!continuationToken) break;
  }
  return all;
}

async function deleteObject(key) {
  const url = `${ENDPOINT}/${BUCKET}/${encodeURIComponent(key).replace(/%2F/g, '/')}`;
  const res = await signedFetch('DELETE', url, null);
  if (!res.ok && res.status !== 204) {
    throw new Error(`DELETE ${res.status}: ${await res.text()}`);
  }
}

// Very small XML extractor — we only need <Contents><Key>, <Size>.
function extractContents(xml) {
  const out = [];
  const re = /<Contents>([\s\S]*?)<\/Contents>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const body = m[1];
    const key = /<Key>([^<]+)<\/Key>/.exec(body)?.[1];
    const size = /<Size>(\d+)<\/Size>/.exec(body)?.[1];
    if (key) out.push({ Key: decodeXml(key), Size: size });
  }
  return out;
}

function decodeXml(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// ──────────────────────────────────────────────────────────────────────────
// AWS SigV4 (S3-style, unsigned payload)
// ──────────────────────────────────────────────────────────────────────────

async function signedFetch(method, urlStr, body) {
  const url = new URL(urlStr);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]/g, '').replace(/\.\d{3}/, '');
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = body
    ? createHash('sha256').update(body).digest('hex')
    : 'UNSIGNED-PAYLOAD';

  const host = url.host;
  const headers = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };

  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map(k => `${k}:${headers[k]}\n`)
    .join('');

  const canonicalQuery = canonicalizeQuery(url.searchParams);
  const canonicalRequest = [
    method,
    url.pathname,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const scope = `${dateStamp}/${REGION}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');

  const kDate = hmac(`AWS4${SECRET_ACCESS_KEY}`, dateStamp);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = hmac(kSigning, stringToSign).toString('hex');

  const authHeader =
    `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY_ID}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return fetch(urlStr, {
    method,
    headers: { ...headers, authorization: authHeader },
    body: body || undefined,
  });
}

function canonicalizeQuery(params) {
  const pairs = [];
  for (const [k, v] of params.entries()) pairs.push([k, v]);
  pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1));
  return pairs
    .map(
      ([k, v]) =>
        `${encodeURIComponent(k).replace(/[!'()*]/g, escapeRfc3986)}=` +
        `${encodeURIComponent(v).replace(/[!'()*]/g, escapeRfc3986)}`
    )
    .join('&');
}

function escapeRfc3986(c) {
  return '%' + c.charCodeAt(0).toString(16).toUpperCase();
}

function hmac(key, data) {
  return createHmac('sha256', key).update(data).digest();
}

// ──────────────────────────────────────────────────────────────────────────
// misc
// ──────────────────────────────────────────────────────────────────────────

function fmtBytes(b) {
  if (!b) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let x = b;
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024;
    i++;
  }
  return `${x.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function parseArgs(argv) {
  const out = {};
  for (const a of argv) {
    if (a === '--apply') out.apply = true;
    else if (a.startsWith('--env=')) out.env = a.slice('--env='.length);
    else if (a === '--help' || a === '-h') {
      console.log(
`Usage:
  node scripts/cleanup-r2-orphans.mjs                      # dry-run, staging
  node scripts/cleanup-r2-orphans.mjs --apply              # delete, staging
  node scripts/cleanup-r2-orphans.mjs --env=production
  node scripts/cleanup-r2-orphans.mjs --env=production --apply

Env:
  CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
  (R2 API token with Object Read & Write for the target bucket)
`
      );
      process.exit(0);
    }
  }
  return out;
}
