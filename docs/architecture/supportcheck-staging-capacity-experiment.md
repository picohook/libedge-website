# supportCheck staging capacity experiment

Status: MANUAL / STAGING ONLY / EVIDENCE COLLECTION.

Use this procedure only for issue #263 capacity measurement. It changes only the current SageMaker endpoint variant instance count. It does not change the frozen checker image, model revision, engine manifest, thresholds, gunicorn worker count, Assistant timeout, invocation budget, or any production setting.

AWS authentication must already exist in the operator's approved environment. Do not place AWS credentials in repository files, command history, or GitHub Actions secrets for this procedure.

## Preconditions

The staging endpoint is `libedge-fresh-checker-staging` in `us-east-1`. Before mutation, independently verify that the endpoint is `InService`, the expected frozen checker remains deployed, network isolation remains enabled, and data capture remains disabled using the existing privacy-evidence tooling.

## Scale to two instances

```bash
AWS_REGION=us-east-1 \
SAGEMAKER_ENDPOINT_NAME=libedge-fresh-checker-staging \
TARGET_INSTANCE_COUNT=2 \
bash scripts/supportcheck-set-staging-capacity.sh
```

After the script reports `verified_instance_count=2`, run the existing **Assistant Bounded Load Evidence** workflow against `staging` with levels `1,2`. For the #263 R2 closure, repeat the exact same C1/C2 run at least twice on the exact release-candidate configuration. Preserve both workflow run IDs and their content-free grounding diagnostic deltas. C4 is explicitly outside this closure scope and must not be run merely to close #263.

Do not change grounding thresholds, timeout, checker artifact/model/revision/manifest, or fail-closed behavior to make the experiment pass. Both C1 and C2 must complete without supportCheck timeout/error for a repeat to count as passing.

## Roll back to one instance

Rollback is mandatory after the bounded measurement, including when the load workflow fails:

```bash
AWS_REGION=us-east-1 \
SAGEMAKER_ENDPOINT_NAME=libedge-fresh-checker-staging \
TARGET_INSTANCE_COUNT=1 \
bash scripts/supportcheck-set-staging-capacity.sh
```

Require `verified_instance_count=1` before considering the experiment complete. Re-run the existing privacy-evidence collection after rollback if endpoint state is uncertain.

This experiment is staging evidence only. It does not authorize production supportCheck or establish a production concurrency limit.
