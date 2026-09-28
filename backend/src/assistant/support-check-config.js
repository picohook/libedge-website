export const SUPPORT_CHECK_PIN = Object.freeze({
  model: 'MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli',
  revision: '6f5cf0a2b59cabb106aca4c287eed12e357e90eb',
  engineManifestSha256: '96790beaba6826db1efe51c8638be09b049e71517c7ac8334fe1dca20e991918',
  entailmentThreshold: 0.85,
  contradictionThreshold: 0.85,
  aggregateRule: 'ANY_SUPPORT_ELSE_NOT_SUPPORTED'
});

export function supportCheckGateFromEnv(env) {
  return {
    enabled: env?.RESEARCH_ASSISTANT_SUPPORT_CHECK_ENABLED === 'true',
    privacyStatus: env?.RESEARCH_ASSISTANT_SUPPORT_CHECK_PRIVACY_GATE_STATUS === 'PASS'
      ? 'PASS'
      : 'UNVERIFIED'
  };
}
