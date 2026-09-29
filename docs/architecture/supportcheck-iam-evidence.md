# supportCheck IAM evidence inventory

This read-only collector inventories the exact SageMaker execution role and endpoint identity used by supportCheck. It deliberately does **not** claim least-privilege PASS.

Prerequisites: AWS CLI authenticated to the intended LibEdge account with read-only access to STS, SageMaker endpoint description, and IAM role/policy inventory.

Run:

```bash
SUPPORT_CHECK_AWS_REGION=<region> \
SUPPORT_CHECK_SAGEMAKER_ENDPOINT=<endpoint-name> \
SAGEMAKER_EXECUTION_ROLE_ARN=<exact-role-arn> \
node scripts/supportcheck-iam-evidence.mjs > supportcheck-iam-evidence.json
```

The resulting inventory records account/caller, endpoint ARN, execution-role ARN/path/permissions boundary, attached managed-policy ARNs, and inline-policy names. It does not retrieve or print policy documents because those require separate interpretation and may contain unrelated account details.

Independent checker privacy review must still inspect the relevant policy documents and verify that the Cloudflare Worker AWS principal is restricted to the exact intended `sagemaker:InvokeEndpoint` resource. This collector does not establish that control by itself.
