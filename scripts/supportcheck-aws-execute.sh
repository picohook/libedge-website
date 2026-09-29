#!/usr/bin/env bash
set -euo pipefail

need(){ local n="$1"; [[ -n "${!n:-}" ]] || { echo "Missing required environment variable: $n" >&2; exit 2; }; }
for n in AWS_REGION ECR_REPOSITORY SOURCE_COMMIT SAGEMAKER_EXECUTION_ROLE_ARN SAGEMAKER_MODEL_NAME SAGEMAKER_ENDPOINT_CONFIG_NAME SAGEMAKER_ENDPOINT_NAME SAGEMAKER_INSTANCE_TYPE; do need "$n"; done

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"
head_sha="$(git rev-parse HEAD)"
[[ "$head_sha" == "$SOURCE_COMMIT" ]] || { echo "SOURCE_COMMIT does not match current checkout HEAD" >&2; exit 2; }

evidence_dir="${SUPPORT_CHECK_EVIDENCE_DIR:-supportcheck-evidence/$SOURCE_COMMIT}"
mkdir -p "$evidence_dir"

printf 'source_commit=%s\naws_region=%s\n' "$SOURCE_COMMIT" "$AWS_REGION" > "$evidence_dir/execution-context.txt"

publish_output="$(AWS_REGION="$AWS_REGION" ECR_REPOSITORY="$ECR_REPOSITORY" SOURCE_COMMIT="$SOURCE_COMMIT" bash scripts/supportcheck-publish-immutable-ecr.sh)"
printf '%s\n' "$publish_output" | tee "$evidence_dir/ecr-publish.txt"
immutable_uri="$(printf '%s\n' "$publish_output" | awk -F= '$1=="immutable_image_uri"{print substr($0,index($0,"=")+1)}')"
[[ "$immutable_uri" =~ @sha256:[0-9a-f]{64}$ ]] || { echo "No valid immutable image URI from publish step" >&2; exit 1; }

IMMUTABLE_IMAGE_URI="$immutable_uri" \
AWS_REGION="$AWS_REGION" \
SAGEMAKER_EXECUTION_ROLE_ARN="$SAGEMAKER_EXECUTION_ROLE_ARN" \
SAGEMAKER_MODEL_NAME="$SAGEMAKER_MODEL_NAME" \
SAGEMAKER_ENDPOINT_CONFIG_NAME="$SAGEMAKER_ENDPOINT_CONFIG_NAME" \
SAGEMAKER_ENDPOINT_NAME="$SAGEMAKER_ENDPOINT_NAME" \
SAGEMAKER_INSTANCE_TYPE="$SAGEMAKER_INSTANCE_TYPE" \
bash scripts/supportcheck-deploy-sagemaker.sh | tee "$evidence_dir/sagemaker-deploy.txt"

SUPPORT_CHECK_AWS_REGION="$AWS_REGION" SUPPORT_CHECK_SAGEMAKER_ENDPOINT="$SAGEMAKER_ENDPOINT_NAME" \
node scripts/supportcheck-privacy-evidence.mjs > "$evidence_dir/privacy-evidence.json"

SUPPORT_CHECK_AWS_REGION="$AWS_REGION" SUPPORT_CHECK_SAGEMAKER_ENDPOINT="$SAGEMAKER_ENDPOINT_NAME" \
SAGEMAKER_EXECUTION_ROLE_ARN="$SAGEMAKER_EXECUTION_ROLE_ARN" \
node scripts/supportcheck-iam-evidence.mjs > "$evidence_dir/iam-evidence.json"

printf 'evidence_dir=%s\nimmutable_image_uri=%s\nendpoint_name=%s\n' "$evidence_dir" "$immutable_uri" "$SAGEMAKER_ENDPOINT_NAME"
printf 'IMPORTANT: evidence collection is not checker Privacy PASS. Independent review remains required before enabling staging supportCheck.\n'
