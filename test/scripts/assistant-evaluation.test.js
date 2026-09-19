import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { STRUCTURED_OUTPUT_SCHEMA, validateOutput } from '../../scripts/assistant-evaluation.mjs';

const cases = JSON.parse(fs.readFileSync('docs/experiments/p05-assistant-evaluation-cases-v0.1.json', 'utf8'));

describe('assistant evaluation frozen harness', () => {
  it('normalizes Windows-style entry paths through file URLs', () => {
    const winPath = 'C:\\Users\\OWNER\\Documents\\GitHub\\libedge-website\\scripts\\assistant-evaluation.mjs';
    expect(pathToFileURL(winPath).href).toContain('assistant-evaluation.mjs');
    expect(pathToFileURL(path.resolve('scripts/assistant-evaluation.mjs')).protocol).toBe('file:');
  });
  it('contains exactly E01-E24 with pack-local unique evidence IDs', () => {
    expect(cases).toHaveLength(24);
    expect(cases.map(c => c.case_id)).toEqual(Array.from({ length: 24 }, (_, i) => `E${String(i + 1).padStart(2, '0')}`));
    for (const c of cases) {
      expect(c.question.trim()).not.toBe('');
      expect(c.evidence.length).toBeGreaterThan(0);
      const ids = c.evidence.map(e => e.evidence_id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.every(id => id.startsWith(c.case_id + ':e'))).toBe(true);
    }
  });

  it('freezes the Round 2 structured-output schema without case-specific evidence IDs', () => {
    expect(STRUCTURED_OUTPUT_SCHEMA.required).toEqual(['claims']);
    expect(STRUCTURED_OUTPUT_SCHEMA.additionalProperties).toBe(false);
    const serialized = JSON.stringify(STRUCTURED_OUTPUT_SCHEMA);
    expect(serialized).not.toMatch(/E\\d{2}:e\\d+/);
  });

  it('keeps strict raw-JSON parsing with no markdown-fence repair', () => {
    const allowed = new Set(['E01:e1']);
    const fenced = '\`\`\`json\\n{"claims":[{"text":"Claim.","evidence_ids":["E01:e1"]}]}\\n\`\`\`';
    expect(validateOutput(fenced, allowed)).toMatchObject({ schema_valid: false, evidence_ids_valid: false });
  });

  it('accepts a valid structured grounded response', () => {
    const allowed = new Set(['E01:e1', 'E01:e2']);
    expect(validateOutput(JSON.stringify({ claims: [{ text: 'B is higher.', evidence_ids: ['E01:e1', 'E01:e2'] }] }), allowed)).toEqual({
      schema_valid: true, evidence_ids_valid: true, unknown_ids: [], missing_id_claims: 0,
    });
  });

  it('rejects unknown evidence IDs', () => {
    const result = validateOutput(JSON.stringify({ claims: [{ text: 'Claim.', evidence_ids: ['E01:e9'] }] }), new Set(['E01:e1']));
    expect(result.schema_valid).toBe(true);
    expect(result.evidence_ids_valid).toBe(false);
    expect(result.unknown_ids).toEqual(['E01:e9']);
  });

  it('rejects malformed or uncited claims', () => {
    expect(validateOutput('not json', new Set())).toMatchObject({ schema_valid: false, evidence_ids_valid: false });
    expect(validateOutput(JSON.stringify({ claims: [{ text: 'Claim.', evidence_ids: [] }] }), new Set())).toMatchObject({
      schema_valid: false, evidence_ids_valid: false, missing_id_claims: 1,
    });
  });
});
