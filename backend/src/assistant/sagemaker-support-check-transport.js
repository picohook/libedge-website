import { InvokeEndpointCommand, SageMakerRuntimeClient } from '@aws-sdk/client-sagemaker-runtime';
import { SUPPORT_CHECK_PIN } from './support-check-config.js';

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

export function sagemakerSupportCheckConfig(env) {
  return {
    region: configured(env?.RESEARCH_ASSISTANT_SUPPORT_CHECK_AWS_REGION),
    endpointName: configured(env?.RESEARCH_ASSISTANT_SUPPORT_CHECK_SAGEMAKER_ENDPOINT)
  };
}

function payloadFor(claim, citedEvidence) {
  return {
    pin: SUPPORT_CHECK_PIN,
    claim: { text: claim.text },
    evidence: citedEvidence.map((item) => ({
      evidence_id: item.evidence_id,
      title: item.title,
      abstract: item.abstract
    }))
  };
}

function timeoutMs(env) {
  const parsed = Number(env?.RESEARCH_ASSISTANT_SUPPORT_CHECK_TIMEOUT_MS);
  if (!Number.isFinite(parsed) || parsed <= 0) return 5000;
  return Math.min(Math.floor(parsed), 15000);
}

export function createSageMakerSupportCheckTransport(env, { clientFactory } = {}) {
  const credentials = credentialsFromEnv(env);
  const { region, endpointName } = sagemakerSupportCheckConfig(env);
  if (!credentials || !region || !endpointName) return null;

  const makeClient = clientFactory || ((options) => new SageMakerRuntimeClient(options));
  const client = makeClient({ region, credentials });

  return async function invoke(claim, citedEvidence) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs(env));
    try {
      const response = await client.send(new InvokeEndpointCommand({
      EndpointName: endpointName,
      ContentType: 'application/json',
      Accept: 'application/json',
      Body: new TextEncoder().encode(JSON.stringify(payloadFor(claim, citedEvidence)))
      }), { abortSignal: controller.signal });
      const decoded = new TextDecoder().decode(response.Body);
      return JSON.parse(decoded);
    } finally {
      clearTimeout(timer);
    }
  };
}

export const __test = { credentialsFromEnv, payloadFor, timeoutMs };
