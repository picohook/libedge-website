# supportCheck AWS execution package

Status: MANUAL / ACCOUNT-SPECIFIC / PRE-PRIVACY-PASS.

`scripts/supportcheck-aws-execute.sh` composes the independently reviewed primitives into one operator command. It intentionally stops before checker enablement.

It first requires the declared `SOURCE_COMMIT` to equal the actual checkout HEAD. It then publishes the frozen image to an already-immutable ECR repository, deploys the SageMaker model/config/endpoint with the reviewed fail-closed gates, and writes content-free privacy and IAM evidence to a local evidence directory.

Required operator inputs are environment variables, not credentials in command history or repository files: `AWS_REGION`, `ECR_REPOSITORY`, `SOURCE_COMMIT`, `SAGEMAKER_EXECUTION_ROLE_ARN`, `SAGEMAKER_MODEL_NAME`, `SAGEMAKER_ENDPOINT_CONFIG_NAME`, `SAGEMAKER_ENDPOINT_NAME`, and `SAGEMAKER_INSTANCE_TYPE`. AWS authentication must already be configured through the operator's approved credential mechanism.

The package does **not** create the ECR repository or IAM role, select an instance type, configure Cloudflare secrets, invoke the checker with protected content, assert Privacy PASS, enable supportCheck, or authorize production.

On any partial deployment failure, inspect the emitted state and use `scripts/supportcheck-delete-sagemaker.sh` with the same region/model/config/endpoint names to remove created SageMaker resources. Do not delete evidence needed to diagnose the failure.
