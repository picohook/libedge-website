import { existsSync, writeFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { INSTITUTION_LOCAL_LOGO_MAP } from '../backend/src/institution-logo-map.js';

function parseArgs(argv) {
  const options = {
    env: 'production',
    bucket: '',
    database: 'libedge-db',
    publicBase: '',
    dryRun: false,
    limit: 0,
  };

  const positionals = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }
    if (arg.startsWith('--env=')) {
      options.env = arg.slice('--env='.length) || options.env;
      continue;
    }
    if (arg.startsWith('--bucket=')) {
      options.bucket = arg.slice('--bucket='.length) || options.bucket;
      continue;
    }
    if (arg.startsWith('--database=')) {
      options.database = arg.slice('--database='.length) || options.database;
      continue;
    }
    if (arg.startsWith('--public-base=')) {
      options.publicBase = arg.slice('--public-base='.length) || options.publicBase;
      continue;
    }
    if (arg.startsWith('--limit=')) {
      options.limit = Number(arg.slice('--limit='.length) || 0);
      continue;
    }
    if (arg === '--env') options.env = argv[i + 1] || options.env;
    if (arg === '--bucket') options.bucket = argv[i + 1] || options.bucket;
    if (arg === '--database') options.database = argv[i + 1] || options.database;
    if (arg === '--public-base') options.publicBase = argv[i + 1] || options.publicBase;
    if (arg === '--dry-run') options.dryRun = true;
    if (arg === '--limit') options.limit = Number(argv[i + 1] || 0);
  }

  if (!options.env && process.env.npm_config_env) options.env = process.env.npm_config_env;
  if (!options.bucket && process.env.npm_config_bucket) options.bucket = process.env.npm_config_bucket;
  if (!options.database && process.env.npm_config_database) options.database = process.env.npm_config_database;
  if (!options.publicBase && process.env.npm_config_public_base) options.publicBase = process.env.npm_config_public_base;
  if (!options.limit && process.env.npm_config_limit) options.limit = Number(process.env.npm_config_limit || 0);
  if (process.env.npm_config_dry_run === 'true' || process.env.npm_config_dry_run === '1') options.dryRun = true;

  if (positionals[0] && ['staging', 'production'].includes(positionals[0])) {
    options.env = positionals[0];
  }
  if (positionals[1] && !options.publicBase) {
    options.publicBase = positionals[1];
  }
  if (positionals[2] && !options.limit) {
    options.limit = Number(positionals[2] || 0);
  }

  if (!options.bucket) {
    options.bucket = options.env === 'staging' ? 'libedge-files-staging' : 'libedge-files';
  }

  return options;
}

const scriptDir = resolve(fileURLToPath(new URL('.', import.meta.url)));
const repoRoot = resolve(scriptDir, '..');
const localWranglerJs = resolve(repoRoot, 'node_modules', 'wrangler', 'bin', 'wrangler.js');

function run(command, args, cwd) {
  const executable = existsSync(localWranglerJs) ? process.execPath : command;
  const finalArgs = existsSync(localWranglerJs) ? [localWranglerJs, ...args] : args;
  const result = spawnSync(executable, finalArgs, {
    cwd,
    stdio: 'inherit',
    shell: false
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${executable} ${finalArgs.join(' ')} failed with exit code ${result.status}`);
  }
}

const options = parseArgs(process.argv.slice(2));

if (!options.publicBase) {
  console.error('Missing required --public-base argument');
  console.error('Example: node scripts/import-institution-logos.mjs --env production --public-base https://files.selmiye.com');
  process.exit(1);
}

const publicBase = String(options.publicBase).trim().replace(/\/+$/, '');

const entries = Object.entries(INSTITUTION_LOCAL_LOGO_MAP)
  .sort((a, b) => Number(a[0]) - Number(b[0]))
  .slice(0, options.limit > 0 ? options.limit : undefined);

if (!entries.length) {
  console.log('No logo entries found.');
  process.exit(0);
}

const sqlLines = [];
let uploadCount = 0;

for (const [institutionId, assetUrl] of entries) {
  const relativePath = decodeURIComponent(String(assetUrl || '').replace(/^\//, ''));
  const absPath = resolve(repoRoot, relativePath);

  if (!existsSync(absPath)) {
    throw new Error(`Logo file not found: ${absPath}`);
  }

  const extension = extname(absPath).replace(/^\./, '').toLowerCase() || 'png';
  const objectKey = `institution-logos/${institutionId}.${extension}`;
  const publicUrl = `${publicBase}/${objectKey}`;

  if (!options.dryRun) {
    const r2Args = ['r2', 'object', 'put', `${options.bucket}/${objectKey}`, '--file', absPath, '--remote'];
    if (options.env === 'staging') r2Args.push('--env', 'staging');
    run('wrangler', r2Args, repoRoot);
  }

  sqlLines.push(`UPDATE institutions SET logo_url = '${publicUrl}' WHERE id = ${Number(institutionId)};`);
  uploadCount += 1;
}

const sqlPath = resolve(repoRoot, 'tmp_import_institution_logos.sql');
writeFileSync(sqlPath, `${sqlLines.join('\n')}\n`, 'utf8');

if (!options.dryRun) {
  const d1Args = ['d1', 'execute', options.database, '--remote', '--file', sqlPath];
  if (options.env === 'staging') d1Args.push('--env', 'staging');
  run('wrangler', d1Args, repoRoot);
}

console.log(`Prepared ${uploadCount} institution logos.`);
console.log(`SQL file: ${sqlPath}`);
if (options.dryRun) {
  console.log('Dry run enabled. No uploads or D1 updates were executed.');
}
