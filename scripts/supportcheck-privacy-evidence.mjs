#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

function aws(args) {
  return JSON.parse(execFileSync('aws', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }));
}
function need(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
function digestFromImage(image) {
  const match = String(image || '').match(/@sha256:([a-f0-9]{64})$/i);
  return match ? `sha256:${match[1].toLowerCase()}` : null;
}

const region = need('SUPPORT_CHECK_AWS_REGION');
const endpointName = need('SUPPORT_CHECK_SAGEMAKER_ENDPOINT');

const caller = aws(['sts','get-caller-identity','--output','json']);
const endpoint = aws(['sagemaker','describe-endpoint','--endpoint-name',endpointName,'--region',region,'--output','json']);
const configName = String(endpoint.EndpointConfigName || '');
if (!configName) throw new Error('EndpointConfigName missing');
const config = aws(['sagemaker','describe-endpoint-config','--endpoint-config-name',configName,'--region',region,'--output','json']);

const variants = Array.isArray(config.ProductionVariants) ? config.ProductionVariants : [];
const models = variants.map((v) => {
  const m = aws(['sagemaker','describe-model','--model-name',v.ModelName,'--region',region,'--output','json']);
  const containers = [m.PrimaryContainer, ...(m.Containers || [])].filter(Boolean).map((x) => ({
    image: x.Image || null,
    image_digest: digestFromImage(x.Image),
    model_data_url_present: Boolean(x.ModelDataUrl || x.ModelDataSource)
  }));
  return {
    model_name: v.ModelName,
    execution_role_arn: m.ExecutionRoleArn || null,
    network_isolation_enabled: Boolean(m.EnableNetworkIsolation),
    variant_name: v.VariantName || null,
    instance_type: v.InstanceType || null,
    initial_instance_count: Number.isFinite(v.InitialInstanceCount) ? v.InitialInstanceCount : null,
    initial_variant_weight: Number.isFinite(v.InitialVariantWeight) ? v.InitialVariantWeight : null,
    containers
  };
});

const out = {
  schema: 'libedge.supportcheck_privacy_qualification_evidence.v1',
  collected_at: new Date().toISOString(),
  account_id: caller.Account || null,
  caller_arn: caller.Arn || null,
  region,
  endpoint: {
    name: endpoint.EndpointName || endpointName,
    arn: endpoint.EndpointArn || null,
    status: endpoint.EndpointStatus || null,
    config_name: configName
  },
  data_capture: {
    configured_enabled: Boolean(config.DataCaptureConfig?.EnableCapture),
    configured_destination_s3_uri: config.DataCaptureConfig?.DestinationS3Uri ? '[configured]' : null,
    active_enabled: Boolean(endpoint.DataCaptureConfig?.EnableCapture),
    active_capture_status: endpoint.DataCaptureConfig?.CaptureStatus || null,
    active_sampling_percentage: Number.isFinite(endpoint.DataCaptureConfig?.CurrentSamplingPercentage)
      ? endpoint.DataCaptureConfig.CurrentSamplingPercentage
      : null,
    active_destination_s3_uri: endpoint.DataCaptureConfig?.DestinationS3Uri ? '[configured]' : null
  },
  network_isolation: {
    enabled: Boolean(config.EnableNetworkIsolation)
  },
  models,
  assertions: {
    data_capture_disabled: !config.DataCaptureConfig?.EnableCapture && !endpoint.DataCaptureConfig?.EnableCapture,
    network_isolation_enabled: Boolean(config.EnableNetworkIsolation) && models.length > 0 && models.every((m) => m.network_isolation_enabled),
    all_container_images_digest_pinned: models.length > 0 && models.every((m) => m.containers.length > 0 && m.containers.every((x) => Boolean(x.image_digest)))
  }
};

process.stdout.write(JSON.stringify(out, null, 2) + '\n');
