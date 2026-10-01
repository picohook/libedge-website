#!/usr/bin/env bash
set -euo pipefail

need(){ local n="$1"; [[ -n "${!n:-}" ]] || { echo "Missing required environment variable: $n" >&2; exit 2; }; }
for n in AWS_REGION SAGEMAKER_ENDPOINT_NAME TARGET_INSTANCE_COUNT; do need "$n"; done

[[ "$TARGET_INSTANCE_COUNT" =~ ^[12]$ ]] || { echo "TARGET_INSTANCE_COUNT must be 1 or 2" >&2; exit 2; }

endpoint_json="$(aws sagemaker describe-endpoint --region "$AWS_REGION" --endpoint-name "$SAGEMAKER_ENDPOINT_NAME" --output json)"
status="$(printf '%s' "$endpoint_json" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).EndpointStatus||''))")"
config_name="$(printf '%s' "$endpoint_json" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).EndpointConfigName||''))")"
[[ "$status" == "InService" ]] || { echo "Endpoint must be InService before capacity mutation; got $status" >&2; exit 1; }
[[ -n "$config_name" ]] || { echo "EndpointConfigName missing" >&2; exit 1; }

config_json="$(aws sagemaker describe-endpoint-config --region "$AWS_REGION" --endpoint-config-name "$config_name" --output json)"
readarray -t variant_lines < <(printf '%s' "$config_json" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s); for(const v of j.ProductionVariants||[]) console.log([v.VariantName,v.InitialInstanceCount,v.InstanceType].join('\t'))})")
[[ "${#variant_lines[@]}" -eq 1 ]] || { echo "Expected exactly one production variant" >&2; exit 1; }
IFS=$'\t' read -r variant current_count instance_type <<< "${variant_lines[0]}"
[[ "$current_count" =~ ^[12]$ ]] || { echo "Current instance count must be 1 or 2; got $current_count" >&2; exit 1; }

printf 'endpoint=%s\nvariant=%s\ninstance_type=%s\ncurrent_instance_count=%s\ntarget_instance_count=%s\n' \
  "$SAGEMAKER_ENDPOINT_NAME" "$variant" "$instance_type" "$current_count" "$TARGET_INSTANCE_COUNT"

if [[ "$current_count" == "$TARGET_INSTANCE_COUNT" ]]; then
  echo "Capacity already at target; no mutation needed."
  exit 0
fi

aws sagemaker update-endpoint-weights-and-capacities \
  --region "$AWS_REGION" \
  --endpoint-name "$SAGEMAKER_ENDPOINT_NAME" \
  --desired-weights-and-capacities "VariantName=$variant,DesiredInstanceCount=$TARGET_INSTANCE_COUNT" >/dev/null

aws sagemaker wait endpoint-in-service --region "$AWS_REGION" --endpoint-name "$SAGEMAKER_ENDPOINT_NAME"

actual_count="$(aws sagemaker describe-endpoint --region "$AWS_REGION" --endpoint-name "$SAGEMAKER_ENDPOINT_NAME" --query "ProductionVariants[?VariantName=='$variant'].CurrentInstanceCount | [0]" --output text)"
[[ "$actual_count" == "$TARGET_INSTANCE_COUNT" ]] || { echo "Capacity verification failed: expected $TARGET_INSTANCE_COUNT, got $actual_count" >&2; exit 1; }

printf 'verified_instance_count=%s\n' "$actual_count"
