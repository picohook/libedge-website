#!/usr/bin/env bash
set -euo pipefail
need(){ local n="$1"; [[ -n "${!n:-}" ]] || { echo "Missing required environment variable: $n" >&2; exit 2; }; }
for n in AWS_REGION ECR_REPOSITORY SAGEMAKER_EXECUTION_ROLE_ARN SAGEMAKER_INSTANCE_TYPE SAGEMAKER_INITIAL_INSTANCE_COUNT; do need "$n"; done

[[ "$SAGEMAKER_EXECUTION_ROLE_ARN" =~ ^arn:aws[a-zA-Z-]*:iam::[0-9]{12}:role/ ]] || { echo "Invalid SageMaker execution role ARN" >&2; exit 2; }
[[ "$SAGEMAKER_INITIAL_INSTANCE_COUNT" =~ ^[12]$ ]] || { echo "SAGEMAKER_INITIAL_INSTANCE_COUNT must be 1 or 2" >&2; exit 2; }
role_name="${SAGEMAKER_EXECUTION_ROLE_ARN##*/}"

account="$(aws sts get-caller-identity --query Account --output text)"
[[ "$account" =~ ^[0-9]{12}$ ]] || { echo "Could not resolve AWS account" >&2; exit 1; }

repo_json="$(aws ecr describe-repositories --region "$AWS_REGION" --repository-names "$ECR_REPOSITORY" --output json)"
mutability="$(printf '%s' "$repo_json" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);process.stdout.write(String(j.repositories?.[0]?.imageTagMutability||''))})")"
[[ "$mutability" == "IMMUTABLE" || "$mutability" == "IMMUTABLE_WITH_EXCLUSION" ]] || { echo "ECR repository is not immutable" >&2; exit 1; }

role_arn="$(aws iam get-role --role-name "$role_name" --query 'Role.Arn' --output text)"
[[ "$role_arn" == "$SAGEMAKER_EXECUTION_ROLE_ARN" ]] || { echo "Execution role ARN mismatch" >&2; exit 1; }

aws sagemaker list-endpoint-configs --region "$AWS_REGION" --max-results 1 >/dev/null

printf 'preflight=PASS\naws_account_id=%s\naws_region=%s\necr_repository=%s\necr_mutability=%s\nsagemaker_execution_role_arn=%s\nrequested_instance_type=%s\nrequested_initial_instance_count=%s\n' \
 "$account" "$AWS_REGION" "$ECR_REPOSITORY" "$mutability" "$role_arn" "$SAGEMAKER_INSTANCE_TYPE" "$SAGEMAKER_INITIAL_INSTANCE_COUNT"
printf 'NOTE: preflight confirms identity/resource visibility only; it does not prove quota, capacity, pricing, least privilege, Privacy PASS, or deployment success.\n'
