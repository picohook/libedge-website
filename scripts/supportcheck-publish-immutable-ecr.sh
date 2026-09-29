#!/usr/bin/env bash
set -euo pipefail

need() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: $name" >&2
    exit 2
  fi
}

need AWS_REGION
need ECR_REPOSITORY
need SOURCE_COMMIT

if [[ ! "$SOURCE_COMMIT" =~ ^[0-9a-f]{40}$ ]]; then
  echo "SOURCE_COMMIT must be a full 40-character lowercase git SHA" >&2
  exit 2
fi

account_id="$(aws sts get-caller-identity --query Account --output text)"
if [[ ! "$account_id" =~ ^[0-9]{12}$ ]]; then
  echo "Could not resolve a 12-digit AWS account ID" >&2
  exit 1
fi

mutability="$(aws ecr describe-repositories \
  --repository-names "$ECR_REPOSITORY" \
  --region "$AWS_REGION" \
  --query 'repositories[0].imageTagMutability' \
  --output text)"

if [[ "$mutability" != "IMMUTABLE" && "$mutability" != "IMMUTABLE_WITH_EXCLUSION" ]]; then
  echo "Refusing to publish: ECR repository is not immutable (reported: $mutability)" >&2
  exit 1
fi

registry="$account_id.dkr.ecr.$AWS_REGION.amazonaws.com"
tag="git-$SOURCE_COMMIT"
tagged_uri="$registry/$ECR_REPOSITORY:$tag"

aws ecr get-login-password --region "$AWS_REGION" |
  docker login --username AWS --password-stdin "$registry" >/dev/null

docker build \
  --label "org.opencontainers.image.revision=$SOURCE_COMMIT" \
  -t "$tagged_uri" \
  support-checker

docker push "$tagged_uri" >/dev/null

digest="$(aws ecr describe-images \
  --repository-name "$ECR_REPOSITORY" \
  --image-ids imageTag="$tag" \
  --region "$AWS_REGION" \
  --query 'imageDetails[0].imageDigest' \
  --output text)"

if [[ ! "$digest" =~ ^sha256:[0-9a-f]{64}$ ]]; then
  echo "Push completed but no valid immutable image digest was returned" >&2
  exit 1
fi

immutable_uri="$registry/$ECR_REPOSITORY@$digest"
printf 'source_commit=%s\n' "$SOURCE_COMMIT"
printf 'aws_account_id=%s\n' "$account_id"
printf 'aws_region=%s\n' "$AWS_REGION"
printf 'ecr_repository=%s\n' "$ECR_REPOSITORY"
printf 'image_digest=%s\n' "$digest"
printf 'immutable_image_uri=%s\n' "$immutable_uri"
