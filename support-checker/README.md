# Fresh-Checker SageMaker inference source

Frozen identity and request/response contract mirror the Worker supportCheck pin.

Build and push the image to LibEdge ECR, then record and deploy the immutable `@sha256:...` digest. Do not deploy by mutable tag alone.

The handler emits no request/response, claim, evidence, query, or identifier logs. Deployment, IAM, Data Capture configuration, endpoint creation, and privacy PASS remain separate account-specific steps.
