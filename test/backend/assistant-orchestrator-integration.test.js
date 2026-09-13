import { describe, expect, it } from 'vitest';
import { orchestrateResearchAnswer } from '../../backend/src/research/assistant-orchestrator.js';
import { Discover } from '../../backend/src/research/discover.js';

const QUERY = 'hydrogen membrane catalysis';

function integrationEnv() {
  return {
    RESEARCH_SEMANTIC_PRIMARY_ENABLED: 'false',
    CROSSREF_MAILTO: 'integration@libedge.test',
    ...(process.env.OPENALEX_API_KEY ? { OPENALEX_API_KEY: process.env.OPENALEX_API_KEY } : {})
  };
}

describe('assistant orchestration with real Discover', () => {
  it('builds a real EvidencePack and grounds an adapter claim against a real evidence_id', async () => {
    const modelAdapter = {
      async generateClaims({ task, evidencePack }) {
        expect(task).toBe(QUERY);
        expect(Array.isArray(evidencePack.evidence)).toBe(true);
        expect(evidencePack.evidence.length).toBeGreaterThan(0);

        const evidence = evidencePack.evidence[0];
        return {
          claims: [{
            text: `Bu çalışma "${evidence.title}" başlıklı kaynağa dayanıyor.`,
            evidence_ids: [evidence.evidence_id]
          }]
        };
      }
    };

    const supportCheck = async (claim, citedEvidence) => {
      if (citedEvidence.length !== 1) return false;
      const [evidence] = citedEvidence;
      return Boolean(evidence?.title) && claim.text.includes(evidence.title);
    };

    const result = await orchestrateResearchAnswer({
      query: QUERY,
      env: integrationEnv(),
      perPage: 3,
      providerGate: { status: 'PASS' },
      modelAdapter,
      supportCheck,
      discover: Discover
    });

    expect(result.ok).toBe(true);
    expect(result.code).toBe('OK');
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0].evidence_ids).toHaveLength(1);
    expect(result.claims[0].evidence_ids[0]).toMatch(/^pack-[^:]+:e\d+$/);
    expect(result.evidence_pack_id).toBeTruthy();
    expect(result.claims[0].evidence_ids[0].startsWith(`${result.evidence_pack_id}:`)).toBe(true);
  }, 30000);
});
