import { describe, expect, it } from 'vitest';
import { hasResearchEntitlement, researchPrivacyGatePassed, resolveResearchEntitlement } from '../../backend/src/research/entitlement.js';

function fakeDb({ individual = false, institutional = false } = {}) {
  return {
    prepare(sql) {
      return {
        bind() {
          return {
            async first() {
              if (sql.includes('FROM subscriptions')) return individual ? { ok: 1 } : null;
              if (sql.includes('FROM institution_subscriptions sub')) return institutional ? { ok: 1 } : null;
              return null;
            }
          };
        }
      };
    }
  };
}

describe('Research entitlement gate', () => {
  it('fails privacy closed unless both provider and supportCheck are PASS', () => {
    expect(researchPrivacyGatePassed({})).toBe(false);
    expect(researchPrivacyGatePassed({ RESEARCH_ASSISTANT_PROVIDER_GATE_STATUS: 'PASS' })).toBe(false);
    expect(researchPrivacyGatePassed({
      RESEARCH_ASSISTANT_PROVIDER_GATE_STATUS: 'PASS',
      RESEARCH_ASSISTANT_SUPPORT_CHECK_PRIVACY_GATE_STATUS: 'PASS'
    })).toBe(true);
  });

  it('allows an active individual Research subscription', async () => {
    expect(await hasResearchEntitlement(fakeDb({ individual: true }), { user_id: 7, role: 'user' })).toBe(true);
  });

  it('reports individual as the grant source when both individual and institution affiliation exist', async () => {
    await expect(resolveResearchEntitlement(
      fakeDb({ individual: true, institutional: true }),
      { user_id: 7, role: 'user', institution_id: 3 }
    )).resolves.toEqual({ allowed: true, source: 'individual' });
  });

  it('allows an eligible institutional Research subscription (unlimited or assigned limited seat)', async () => {
    expect(await hasResearchEntitlement(fakeDb({ institutional: true }), { user_id: 7, role: 'user', institution_id: 3 })).toBe(true);
  });

  it('denies an authenticated user without subscription or seat', async () => {
    expect(await hasResearchEntitlement(fakeDb(), { user_id: 7, role: 'user', institution_id: 3 })).toBe(false);
  });
});
