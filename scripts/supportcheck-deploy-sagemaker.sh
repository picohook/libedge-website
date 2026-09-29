#!/usr/bin/env bash
set -euo pipefail

need(){ local n="$1"; [[ -n "${!n:-}" ]] || { echo "Missing required environment variable: $n" >&2; exit 2; }; }
for n in AWS_REGION IMMUTABLE_IMAGE_URI SAGEMAKER_EXECUTION_ROLE_ARN SAGEMAKER_MODEL_NAME SAGEMAKER_ENDPOINT_CONFIG_NAME SAGEMAKER_ENDPOINT_NAME SAGEMAKER_INSTANCE_TYPE; do need "$n"; done

[[ "$IMMUTABLE_IMAGE_URI" =~ @sha256:[0-9a-f]{64}$ ]] || { echo "IMMUTABLE_IMAGE_URI must end in @sha256:<64 lowercase hex>" >&2; exit 2; }
[[ "$SAGEMAKER_EXECUTION_ROLE_ARN" =~ ^arn:aws[a-zA-Z-]*:iam::[0-9]{12}:role/ ]] || { echo "Invalid SageMaker execution role ARN" >&2; exit 2; }

for pair in "model:$SAGEMAKER_MODEL_NAME" "endpoint-config:$SAGEMAKER_ENDPOINT_CONFIG_NAME" "endpoint:$SAGEMAKER_ENDPOINT_NAME"; do
  kind="${pair%%:*}"; name="${pair#*:}"
  [[ "$name" =~ ^[A-Za-z0-9](-*[A-Za-z0-9]){0,62}$ ]] || { echo "Invalid $kind name: $name" >&2; exit 2; }
done

aws sagemaker create-model \
  --region "$AWS_REGION" \
  --model-name "$SAGEMAKER_MODEL_NAME" \
  --primary-container "Image=$IMMUTABLE_IMAGE_URI" \
  --execution-role-arn "$SAGEMAKER_EXECUTION_ROLE_ARN" \
  --enable-network-isolation >/dev/null

model_isolation="$(aws sagemaker describe-model --region "$AWS_REGION" --model-name "$SAGEMAKER_MODEL_NAME" --query EnableNetworkIsolation --output text)"
[[ "$model_isolation" == "True" || "$model_isolation" == "true" ]] || { echo "Model network isolation is not enabled; refusing endpoint creation" >&2; exit 1; }

aws sagemaker create-endpoint-config \
  --region "$AWS_REGION" \
  --endpoint-config-name "$SAGEMAKER_ENDPOINT_CONFIG_NAME" \
  --production-variants "VariantName=checker,ModelName=$SAGEMAKER_MODEL_NAME,InitialInstanceCount=1,InstanceType=$SAGEMAKER_INSTANCE_TYPE,InitialVariantWeight=1" \
  --enable-network-isolation >/dev/null

config_isolation="$(aws sagemaker describe-endpoint-config --region "$AWS_REGION" --endpoint-config-name "$SAGEMAKER_ENDPOINT_CONFIG_NAME" --query EnableNetworkIsolation --output text)"
capture_enabled="$(aws sagemaker describe-endpoint-config --region "$AWS_REGION" --endpoint-config-name "$SAGEMAKER_ENDPOINT_CONFIG_NAME" --query 'DataCaptureConfig.EnableCapture' --output text)"

[[ "$config_isolation" == "True" || "$config_isolation" == "true" ]] || { echo "Endpoint-config network isolation is not enabled; refusing endpoint creation" >&2; exit 1; }
[[ "$capture_enabled" == "None" || "$capture_enabled" == "null" || "$capture_enabled" == "False" || "$capture_enabled" == "false" ]] || { echo "Data Capture is enabled/uncertain; refusing endpoint creation" >&2; exit 1; }

aws sagemaker create-endpoint \
  --region "$AWS_REGION" \
  --endpoint-name "$SAGEMAKER_ENDPOINT_NAME" \
  --endpoint-config-name "$SAGEMAKER_ENDPOINT_CONFIG_NAME" >/dev/null

aws sagemaker wait endpoint-in-service --region "$AWS_REGION" --endpoint-name "$SAGEMAKER_ENDPOINT_NAME"

status="$(aws sagemaker describe-endpoint --region "$AWS_REGION" --endpoint-name "$SAGEMAKER_ENDPOINT_NAME" --query EndpointStatus --output text)"
[[ "$status" == "InService" ]] || { echo "Endpoint did not reach InService" >&2; exit 1; }

printf 'endpoint_name=%s\nendpoint_config_name=%s\nmodel_name=%s\nimmutable_image_uri=%s\ninstance_type=%s\nstatus=%s\n' \
  "$SAGEMAKER_ENDPOINT_NAME" "$SAGEMAKER_ENDPOINT_CONFIG_NAME" "$SAGEMAKER_MODEL_NAME" "$IMMUTABLE_IMAGE_URI" "$SAGEMAKER_INSTANCE_TYPE" "$status"
