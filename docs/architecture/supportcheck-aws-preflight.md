# supportCheck AWS read-only preflight

Status: PREPARATION ONLY / READ-ONLY.

Run this before the mutation-capable AWS execution package. It verifies caller identity, visibility of the named ECR repository, immutable repository mode, exact visibility of the supplied SageMaker execution role ARN, and basic SageMaker API access in the selected region.

It deliberately does not create resources, push an image, invoke an endpoint, inspect protected content, claim IAM least privilege, establish quota/capacity, establish current pricing, assert Privacy PASS, enable supportCheck, or authorize production.

Required environment values: `AWS_REGION`, `ECR_REPOSITORY`, `SAGEMAKER_EXECUTION_ROLE_ARN`, `SAGEMAKER_INSTANCE_TYPE`. AWS authentication must already exist in the operator environment; never place access keys or session secrets in this file, repository, or evidence output.

A PASS only means the named account resources are visible and the ECR repository passes the immutable-mode gate. Deployment remains a separate reviewed step.
