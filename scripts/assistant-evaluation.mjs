#!/usr/bin/env node
/**
 * P0.5 Assistant evaluation harness.
 *
 * Safety:
 * - synthetic frozen cases only
 * - no application telemetry
 * - no automatic retries
 * - dry-run by default; live execution requires --execute
 */

import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const CONFIG = Object.freeze({
  region: 'us-east-1',
  modelId: 'us.anthropic.claude-sonnet-4-6',
  anthropicVersion: 'bedrock-2023-05-31',
  maxTokens: 1024,
  temperature: 0,
  timeoutMs: 60_000,
  maxAttempts: 1,
  measuredRepetitions: 3,
  measuredCases: 24,
  streaming: false,
  explicitCacheControls: false,
  tools: false,
});

const SYSTEM = 'Use only the supplied question and EvidencePack. Do not use or claim outside knowledge. Return JSON only as {"claims":[{"text":"factual claim","evidence_ids":["CASE:e1"]}]}. Every factual claim must cite one or more pack-local evidence IDs. If evidence is insufficient or materially conflicting, say so rather than resolving the gap by inference.';

function usageFromResponse(body) {
  const u = body?.usage ?? {};
  return {
    input_tokens: u.input_tokens ?? null,
    output_tokens: u.output_tokens ?? null,
    cache_read_input_tokens: u.cache_read_input_tokens ?? null,
    cache_creation_input_tokens: u.cache_creation_input_tokens ?? null,
  };
}

export function validateOutput(raw, allowedIds) {
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return { schema_valid: false, evidence_ids_valid: false, unknown_ids: [], missing_id_claims: null }; }
  if (!parsed || !Array.isArray(parsed.claims)) return { schema_valid: false, evidence_ids_valid: false, unknown_ids: [], missing_id_claims: null };
  let schemaValid = true;
  let missing = 0;
  const unknown = [];
  for (const claim of parsed.claims) {
    if (!claim || typeof claim.text !== 'string' || !claim.text.trim() || !Array.isArray(claim.evidence_ids) || claim.evidence_ids.length === 0 || claim.evidence_ids.some(x => typeof x !== 'string')) {
      schemaValid = false;
      if (!Array.isArray(claim?.evidence_ids) || claim.evidence_ids.length === 0) missing++;
      continue;
    }
    for (const id of claim.evidence_ids) if (!allowedIds.has(id)) unknown.push(id);
  }
  return { schema_valid: schemaValid, evidence_ids_valid: schemaValid && unknown.length === 0, unknown_ids: [...new Set(unknown)], missing_id_claims: missing };
}

function configFingerprint() {
  return crypto.createHash('sha256').update(JSON.stringify(CONFIG)).digest('hex');
}

async function invoke(client, caseData) {
  const body = JSON.stringify({
    anthropic_version: CONFIG.anthropicVersion,
    max_tokens: CONFIG.maxTokens,
    temperature: CONFIG.temperature,
    system: SYSTEM,
    messages: [{ role: 'user', content: [{ type: 'text', text: `Question: ${caseData.question}\n\nEvidencePack:\n${caseData.evidence.map(e => `- ${e.evidence_id}: ${e.text}`).join('\n')}` }] }],
  });
  const started = performance.now();
  try {
    const response = await client.send(new InvokeModelCommand({
      modelId: CONFIG.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: new TextEncoder().encode(body),
    }));
    const latency_ms = Math.round((performance.now() - started) * 100) / 100;
    const decoded = JSON.parse(new TextDecoder().decode(response.body));
    const text = (decoded.content ?? []).filter(x => x.type === 'text').map(x => x.text).join('');
    return { ok: true, latency_ms, request_id: response.$metadata?.requestId ?? null, usage: usageFromResponse(decoded), raw_output: text };
  } catch (error) {
    return { ok: false, latency_ms: Math.round((performance.now() - started) * 100) / 100, request_id: error?.$metadata?.requestId ?? null, error_name: error?.name ?? 'Error' };
  }
}

async function main() {
  const execute = process.argv.includes('--execute');
  const casesPath = new URL('../docs/experiments/p05-assistant-evaluation-cases-v0.1.json', import.meta.url);
  const cases = JSON.parse(await fs.readFile(casesPath, 'utf8'));
  if (!Array.isArray(cases) || cases.length !== CONFIG.measuredCases) throw new Error('Frozen case file must contain exactly 24 cases.');

  const ids = new Set(cases.map(c => c.case_id));
  if (ids.size !== 24) throw new Error('Case IDs must be unique.');

  const protocolSha = process.env.EVAL_PROTOCOL_SHA || 'UNSET';
  if (!execute) {
    console.log(JSON.stringify({ mode: 'dry-run', cases: cases.length, config: CONFIG, config_fingerprint: configFingerprint(), protocol_sha: protocolSha }, null, 2));
    return;
  }
  if (protocolSha === 'UNSET') throw new Error('EVAL_PROTOCOL_SHA is required for live execution.');

  const client = new BedrockRuntimeClient({ region: CONFIG.region, maxAttempts: CONFIG.maxAttempts, requestHandler: { requestTimeout: CONFIG.timeoutMs } });

  // One synthetic unscored warm-up.
  await invoke(client, cases[0]);

  for (const c of cases) {
    const allowed = new Set(c.evidence.map(e => e.evidence_id));
    for (let repetition = 1; repetition <= CONFIG.measuredRepetitions; repetition++) {
      const result = await invoke(client, c);
      const record = {
        protocol_sha: protocolSha,
        timestamp: new Date().toISOString(),
        case_id: c.case_id,
        arm_label: 'A',
        repetition,
        model_id: CONFIG.modelId,
        region: CONFIG.region,
        operation: 'InvokeModel',
        config_fingerprint: configFingerprint(),
        success: result.ok,
        latency_ms: result.latency_ms,
        provider_request_id: result.request_id,
        ...(result.usage ?? {}),
        ...(result.ok ? validateOutput(result.raw_output, allowed) : {}),
        ...(result.ok ? { output: result.raw_output } : { error_name: result.error_name }),
      };
      process.stdout.write(JSON.stringify(record) + '\n');
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(error); process.exitCode = 1; });
