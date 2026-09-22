import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const DEFAULT_MODEL_ID = 'us.anthropic.claude-sonnet-4-6';
const DEFAULT_REGION = 'us-east-1';
const MAX_CLAIMS = 8;

function configured(value) {
  return String(value ?? '').trim();
}

function credentialsFromEnv(env) {
  const accessKeyId = configured(env?.AWS_ACCESS_KEY_ID);
  const secretAccessKey = configured(env?.AWS_SECRET_ACCESS_KEY);
  if (!accessKeyId || !secretAccessKey) return null;
  const sessionToken = configured(env?.AWS_SESSION_TOKEN);
  return { accessKeyId, secretAccessKey, ...(sessionToken ? { sessionToken } : {}) };
}

function promptFor(task, evidencePack) {
  return [
    'Return JSON only with shape {"claims":[{"text":"...","evidence_ids":["..."]}]}.',
    `Produce at most ${MAX_CLAIMS} concise factual claims.`,
    'Every claim must cite one or more evidence_id values from the supplied evidence.',
    'Do not cite identifiers that are not present. Do not add unsupported facts.',
    '',
    `Research task: ${task}`,
    '',
    `EvidencePack: ${JSON.stringify(evidencePack)}`
  ].join('\n');
}

function parseClaimsPayload(payload) {
  const blocks = Array.isArray(payload?.content) ? payload.content : [];
  const text = blocks.filter((block) => block?.type === 'text').map((block) => block.text).join('').trim();
  if (!text) throw new Error('MODEL_OUTPUT_EMPTY');

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('MODEL_OUTPUT_NOT_JSON');
  }
  if (!Array.isArray(parsed?.claims)) throw new Error('MODEL_OUTPUT_CLAIMS_REQUIRED');
  return { claims: parsed.claims.slice(0, MAX_CLAIMS) };
}

export function bedrockAdapterConfig(env) {
  return {
    region: configured(env?.RESEARCH_ASSISTANT_AWS_REGION) || DEFAULT_REGION,
    modelId: configured(env?.RESEARCH_ASSISTANT_MODEL_ID) || DEFAULT_MODEL_ID
  };
}

/**
 * Bedrock model adapter for the provider-neutral assistant orchestration seam.
 *
 * This factory does not decide privacy eligibility. The orchestrator must block
 * before generateClaims unless the separately governed Provider Privacy Gate is
 * PASS. Credentials remain environment-only and never enter the adapter input.
 */
export function createBedrockModelAdapter(env, { clientFactory } = {}) {
  const credentials = credentialsFromEnv(env);
  if (!credentials) return null;

  const { region, modelId } = bedrockAdapterConfig(env);
  const makeClient = clientFactory || ((options) => new BedrockRuntimeClient(options));
  const client = makeClient({ region, credentials });

  return {
    async generateClaims({ task, evidencePack }) {
      const body = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 1800,
        temperature: 0,
        messages: [{ role: 'user', content: [{ type: 'text', text: promptFor(task, evidencePack) }] }]
      };

      const response = await client.send(new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: new TextEncoder().encode(JSON.stringify(body))
      }));

      const decoded = new TextDecoder().decode(response.body);
      return parseClaimsPayload(JSON.parse(decoded));
    }
  };
}

export const __test = { parseClaimsPayload, promptFor, credentialsFromEnv };
