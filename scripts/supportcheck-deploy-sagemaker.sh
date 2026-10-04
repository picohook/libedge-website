#!/usr/bin/env bash
set -euo pipefail

need(){ local n="$1"; [[ -n "${!n:-}" ]] || { echo "Missing required environment variable: $n" >&2; exit 2; }; }
for n in AWS_REGION IMMUTABLE_IMAGE_URI SAGEMAKER_EXECUTION_ROLE_ARN SAGEMAKER_MODEL_NAME SAGEMAKER_ENDPOINT_CONFIG_NAME SAGEMAKER_ENDPOINT_NAME SAGEMAKER_INSTANCE_TYPE SAGEMAKER_INITIAL_INSTANCE_COUNT; do need "$n"; done

[[ "$IMMUTABLE_IMAGE_URI" =~ @sha256:[0-9a-f]{64}$ ]] || { echo "IMMUTABLE_IMAGE_URI must end in @sha256:<64 lowercase hex>" >&2; exit 2; }
[[ "$SAGEMAKER_EXECUTION_ROLE_ARN" =~ ^arn:aws[a-zA-Z-]*:iam::[0-9]{12}:role/ ]] || { echo "Invalid SageMaker execution role ARN" >&2; exit 2; }
[[ "$SAGEMAKER_INITIAL_INSTANCE_COUNT" =~ ^[12]$ ]] || { echo "SAGEMAKER_INITIAL_INSTANCE_COUNT must be 1 or 2" >&2; exit 2; }

for pair in "model:$SAGEMAKER_MODEL_NAME" "endpoint-config:$SAGEMAKER_ENDPOINT_CONFIG_NAME" "endpoint:$SAGEMAKER_ENDPOINT_NAME"; do
  kind="${pair%%:*}"; name="${pair#*:}"
  [[ "$name" =~ ^[A-Za-z0-9](-*[A-Za-z0-9]){0,62}$ ]] || { echo "Invalid $kind name: $name" >&2; exit 2; }
done

if aws sagemaker describe-endpoint --region "$AWS_REGION" --endpoint-name "$SAGEMAKER_ENDPOINT_NAME" >/dev/null 2>&1; then
  status="$(aws sagemaker describe-endpoint --region "$AWS_REGION" --endpoint-name "$SAGEMAKER_ENDPOINT_NAME" --query EndpointStatus --output text)"
  [[ "$status" == "InService" ]] || { echo "Existing endpoint is not InService: $status. Run teardown before redeploy." >&2; exit 1; }
  echo "Endpoint already exists; skipping creation. Workflow verification will enforce invariants." >&2
else
  if aws sagemaker describe-model --region "$AWS_REGION" --model-name "$SAGEMAKER_MODEL_NAME" >/dev/null 2>&1 || \
     aws sagemaker describe-endpoint-config --region "$AWS_REGION" --endpoint-config-name "$SAGEMAKER_ENDPOINT_CONFIG_NAME" >/dev/null 2>&1; then
    echo "Partial staging deployment exists without endpoint. Run teardown before redeploy." >&2
    exit 1
  fi

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
    --production-variants "VariantName=checker,ModelName=$SAGEMAKER_MODEL_NAME,InitialInstanceCount=$SAGEMAKER_INITIAL_INSTANCE_COUNT,InstanceType=$SAGEMAKER_INSTANCE_TYPE,InitialVariantWeight=1" >/dev/null

  capture_enabled="$(aws sagemaker describe-endpoint-config --region "$AWS_REGION" --endpoint-config-name "$SAGEMAKER_ENDPOINT_CONFIG_NAME" --query 'DataCaptureConfig.EnableCapture' --output text)"
  [[ "$capture_enabled" == "None" || "$capture_enabled" == "null" || "$capture_enabled" == "False" || "$capture_enabled" == "false" ]] || { echo "Data Capture is enabled/uncertain; refusing endpoint creation" >&2; exit 1; }

  aws sagemaker create-endpoint \
    --region "$AWS_REGION" \
    --endpoint-name "$SAGEMAKER_ENDPOINT_NAME" \
    --endpoint-config-name "$SAGEMAKER_ENDPOINT_CONFIG_NAME" >/dev/null

  aws sagemaker wait endpoint-in-service --region "$AWS_REGION" --endpoint-name "$SAGEMAKER_ENDPOINT_NAME"
fi

status="$(aws sagemaker describe-endpoint --region "$AWS_REGION" --endpoint-name "$SAGEMAKER_ENDPOINT_NAME" --query EndpointStatus --output text)"
[[ "$status" == "InService" ]] || { echo "Endpoint did not reach InService" >&2; exit 1; }

observed_config="$(aws sagemaker describe-endpoint --region "$AWS_REGION" --endpoint-name "$SAGEMAKER_ENDPOINT_NAME" --query EndpointConfigName --output text)"
observed_model="$(aws sagemaker describe-endpoint-config --region "$AWS_REGION" --endpoint-config-name "$observed_config" --query 'ProductionVariants[0].ModelName' --output text)"
observed_isolation="$(aws sagemaker describe-model --region "$AWS_REGION" --model-name "$observed_model" --query EnableNetworkIsolation --output text)"
[[ "$observed_isolation" == "True" || "$observed_isolation" == "true" ]] || { echo "Observed model network isolation is not enabled" >&2; exit 1; }
observed_capture="$(aws sagemaker describe-endpoint-config --region "$AWS_REGION" --endpoint-config-name "$observed_config" --query 'DataCaptureConfig.EnableCapture' --output text)"
[[ "$observed_capture" == "None" || "$observed_capture" == "null" || "$observed_capture" == "False" || "$observed_capture" == "false" ]] || { echo "Observed Data Capture is enabled/uncertain" >&2; exit 1; }
observed_image="$(aws sagemaker describe-model --region "$AWS_REGION" --model-name "$observed_model" --query 'PrimaryContainer.Image' --output text)"
[[ "$observed_image" == "$IMMUTABLE_IMAGE_URI" ]] || { echo "Observed image does not match requested immutable image" >&2; exit 1; }
observed_instance_type="$(aws sagemaker describe-endpoint-config --region "$AWS_REGION" --endpoint-config-name "$observed_config" --query 'ProductionVariants[0].InstanceType' --output text)"
observed_instance_count="$(aws sagemaker describe-endpoint --region "$AWS_REGION" --endpoint-name "$SAGEMAKER_ENDPOINT_NAME" --query 'ProductionVariants[0].CurrentInstanceCount' --output text)"
[[ "$observed_instance_count" =~ ^[12]$ ]] || { echo "Observed instance count is outside bounded range 1..2" >&2; exit 1; }

printf 'endpoint_name=%s\nendpoint_config_name=%s\nmodel_name=%s\nimmutable_image_uri=%s\ninstance_type=%s\ninitial_instance_count=%s\nstatus=%s\n' \
  "$SAGEMAKER_ENDPOINT_NAME" "$observed_config" "$observed_model" "$observed_image" "$observed_instance_type" "$observed_instance_count" "$status"
