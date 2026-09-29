#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

function aws(args) {
  return JSON.parse(execFileSync('aws', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }));
}
function need(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
function roleNameFromArn(arn) {
  const match = arn.match(/^arn:aws[a-zA-Z-]*:iam::\d{12}:role\/(.+)$/);
  if (!match) throw new Error('SAGEMAKER_EXECUTION_ROLE_ARN must be an IAM role ARN');
  return match[1].split('/').pop();
}

const region = need('SUPPORT_CHECK_AWS_REGION');
const endpointName = need('SUPPORT_CHECK_SAGEMAKER_ENDPOINT');
const executionRoleArn = need('SAGEMAKER_EXECUTION_ROLE_ARN');

const caller = aws(['sts', 'get-caller-identity', '--output', 'json']);
const endpoint = aws(['sagemaker', 'describe-endpoint', '--endpoint-name', endpointName, '--region', region, '--output', 'json']);
if (!endpoint.EndpointArn) throw new Error('EndpointArn missing');

const roleName = roleNameFromArn(executionRoleArn);
const role = aws(['iam', 'get-role', '--role-name', roleName, '--output', 'json']);
const attached = aws(['iam', 'list-attached-role-policies', '--role-name', roleName, '--output', 'json']);
const inline = aws(['iam', 'list-role-policies', '--role-name', roleName, '--output', 'json']);

const out = {
  schema: 'libedge.supportcheck_iam_evidence.v1',
  collected_at: new Date().toISOString(),
  account_id: caller.Account || null,
  caller_arn: caller.Arn || null,
  region,
  endpoint: {
    name: endpoint.EndpointName || endpointName,
    arn: endpoint.EndpointArn
  },
  sagemaker_execution_role: {
    arn: role.Role?.Arn || executionRoleArn,
    role_name: roleName,
    path: role.Role?.Path || null,
    permissions_boundary_arn: role.Role?.PermissionsBoundary?.PermissionsBoundaryArn || null,
    attached_managed_policy_arns: (attached.AttachedPolicies || []).map((p) => p.PolicyArn).filter(Boolean).sort(),
    inline_policy_names: (inline.PolicyNames || []).slice().sort()
  },
  note: 'Inventory evidence only. Policy documents and the Worker invoke principal must be independently reviewed for least privilege; this output does not assert IAM PASS.'
};

process.stdout.write(JSON.stringify(out, null, 2) + '\n');
