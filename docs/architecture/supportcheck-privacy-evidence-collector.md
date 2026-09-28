# supportCheck privacy evidence collector

This script collects a **content-free** snapshot of the exact AWS SageMaker endpoint/configuration used for supportCheck privacy qualification.

It does not invoke the model endpoint and does not print AWS access keys, secret keys, session tokens, request bodies, or model responses.

Prerequisites: AWS CLI authenticated to the intended LibEdge account with read-only access to STS caller identity and SageMaker endpoint/config/model descriptions.

Run with:

```bash
SUPPORT_CHECK_AWS_REGION=us-east-1 \
SUPPORT_CHECK_SAGEMAKER_ENDPOINT=<exact-endpoint-name> \
node scripts/supportcheck-privacy-evidence.mjs > supportcheck-privacy-evidence.json
```

The output is evidence, **not an automatic privacy PASS**. Independent review must still verify IAM least privilege, container no-content logging, exact checker model/revision/manifest, account/region, and the other requirements in `docs/architecture/supportcheck-sagemaker-direct-qualification-2026-09-28.md`.

A container image without an `@sha256:...` digest is flagged by `all_container_images_digest_pinned: false`; do not treat a mutable image tag as an immutable artifact pin.
