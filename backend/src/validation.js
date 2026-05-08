import { z } from 'zod';

export async function parseZodJson(c, schema) {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Geçersiz JSON gövdesi' }, 400);
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return c.json({ error: 'İstek gövdesi bir nesne olmalıdır' }, 400);
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    const errors = result.error.issues.map((issue) => issue.message);
    return c.json({ error: errors[0], errors }, 400);
  }
  return result.data;
}

export function zRequiredString(field, { min = 1, max, email = false } = {}) {
  let schema = z.string({
    error: (issue) => issue.input === undefined
      ? `"${field}" zorunludur`
      : `"${field}" string tipinde olmalıdır`
  }).trim();
  schema = schema.min(min, min === 1 ? `"${field}" zorunludur` : `"${field}" en az ${min} karakter olmalıdır`);
  if (max !== undefined) schema = schema.max(max, `"${field}" en fazla ${max} karakter olabilir`);
  if (email) schema = schema.email(`"${field}" geçerli bir e-posta adresi olmalıdır`);
  return schema;
}

export function zOptionalString(field, { max } = {}) {
  let schema = z.string({
    error: `"${field}" string tipinde olmalıdır`
  }).trim();
  if (max !== undefined) schema = schema.max(max, `"${field}" en fazla ${max} karakter olabilir`);
  return schema.optional();
}

export function zOptionalEnum(field, values) {
  return z.preprocess(
    (value) => value === '' ? undefined : value,
    z.enum(values, {
      error: `"${field}" şu değerlerden biri olmalıdır: ${values.join(', ')}`
    }).optional()
  );
}

export function zRequiredArray(field) {
  return z.array(z.unknown(), {
    error: (issue) => issue.input === undefined
      ? `"${field}" zorunludur`
      : `"${field}" dizi olmalıdır`
  });
}
