#!/usr/bin/env bash
set -euo pipefail
need(){ local n="$1"; [[ -n "${!n:-}" ]] || { echo "Missing required environment variable: $n" >&2; exit 2; }; }
for n in AWS_REGION SAGEMAKER_MODEL_NAME SAGEMAKER_ENDPOINT_CONFIG_NAME SAGEMAKER_ENDPOINT_NAME; do need "$n"; done

if aws sagemaker describe-endpoint --region "$AWS_REGION" --endpoint-name "$SAGEMAKER_ENDPOINT_NAME" >/dev/null 2>&1; then
  aws sagemaker delete-endpoint --region "$AWS_REGION" --endpoint-name "$SAGEMAKER_ENDPOINT_NAME"
  aws sagemaker wait endpoint-deleted --region "$AWS_REGION" --endpoint-name "$SAGEMAKER_ENDPOINT_NAME"
fi
if aws sagemaker describe-endpoint-config --region "$AWS_REGION" --endpoint-config-name "$SAGEMAKER_ENDPOINT_CONFIG_NAME" >/dev/null 2>&1; then
  aws sagemaker delete-endpoint-config --region "$AWS_REGION" --endpoint-config-name "$SAGEMAKER_ENDPOINT_CONFIG_NAME"
fi
if aws sagemaker describe-model --region "$AWS_REGION" --model-name "$SAGEMAKER_MODEL_NAME" >/dev/null 2>&1; then
  aws sagemaker delete-model --region "$AWS_REGION" --model-name "$SAGEMAKER_MODEL_NAME"
fi
printf 'cleanup_complete=true\n'
