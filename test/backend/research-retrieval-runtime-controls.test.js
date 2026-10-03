import { describe, expect, it, vi } from 'vitest';
import {
  RESEARCH_RETRIEVAL_CONTROL_KEY,
  researchRetrievalControls,
  serializeResearchRetrievalControls,
  validateResearchRetrievalControls
} from '../../backend/src/research/retrieval-runtime-controls.js';

describe('research retrieval runtime controls', () => {
  it('accepts the governed staging experiment values', () => {
    expect(validateResearchRetrievalControls({ mode: 'lexical', lexical_candidate_depth: 50, final_result_target: 10 }))
      .toEqual({ mode: 'lexical', lexical_candidate_depth: 50, final_result_target: 10 });
    expect(validateResearchRetrievalControls({ mode: 'semantic', lexical_candidate_depth: 20, final_result_target: 15 }))
      .toEqual({ mode: 'semantic', lexical_candidate_depth: 20, final_result_target: 15 });
  });

  it('rejects invalid modes, depths, targets, and target greater than lexical depth', () => {
    expect(validateResearchRetrievalControls({ mode: 'crossref', lexical_candidate_depth: 50, final_result_target: 10 })).toBeNull();
    expect(validateResearchRetrievalControls({ mode: 'lexical', lexical_candidate_depth: 40, final_result_target: 10 })).toBeNull();
    expect(validateResearchRetrievalControls({ mode: 'lexical', lexical_candidate_depth: 50, final_result_target: 12 })).toBeNull();
    expect(validateResearchRetrievalControls({ mode: 'lexical', lexical_candidate_depth: 10, final_result_target: 20 })).toBeNull();
  });

  it('uses a valid KV override only in staging', async () => {
    const get = vi.fn(async () => serializeResearchRetrievalControls({ mode: 'semantic', lexical_candidate_depth: 50, final_result_target: 10 }));
    await expect(researchRetrievalControls({
      ENVIRONMENT: 'staging',
      RATE_LIMIT_KV: { get },
      RESEARCH_SEMANTIC_PRIMARY_ENABLED: 'false'
    })).resolves.toEqual({ mode: 'semantic', lexical_candidate_depth: 50, final_result_target: 10, source: 'runtime' });
    expect(get).toHaveBeenCalledWith(RESEARCH_RETRIEVAL_CONTROL_KEY);
  });

  it('never applies runtime overrides in production', async () => {
    const get = vi.fn(async () => serializeResearchRetrievalControls({ mode: 'semantic', lexical_candidate_depth: 50, final_result_target: 10 }));
    await expect(researchRetrievalControls({
      ENVIRONMENT: 'production',
      RATE_LIMIT_KV: { get },
      RESEARCH_SEMANTIC_PRIMARY_ENABLED: 'false'
    })).resolves.toEqual({ mode: 'lexical', lexical_candidate_depth: 10, final_result_target: 10, source: 'env' });
    expect(get).not.toHaveBeenCalled();
  });

  it('fails safely to static staging defaults for invalid or unreadable runtime state', async () => {
    await expect(researchRetrievalControls({
      ENVIRONMENT: 'staging',
      RATE_LIMIT_KV: { get: vi.fn(async () => '{"mode":"semantic","lexical_candidate_depth":999,"final_result_target":10}') },
      RESEARCH_SEMANTIC_PRIMARY_ENABLED: 'false'
    })).resolves.toMatchObject({ mode: 'lexical', lexical_candidate_depth: 10, final_result_target: 10, source: 'env_fallback', reason: 'CONTROL_INVALID' });

    await expect(researchRetrievalControls({
      ENVIRONMENT: 'staging',
      RATE_LIMIT_KV: { get: vi.fn(async () => { throw new Error('down'); }) },
      RESEARCH_SEMANTIC_PRIMARY_ENABLED: 'false'
    })).resolves.toMatchObject({ mode: 'lexical', source: 'env_fallback', reason: 'CONTROL_READ_FAILED' });
  });
});
