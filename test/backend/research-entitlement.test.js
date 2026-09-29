import { describe, expect, it } from 'vitest';
import { hasResearchEntitlement, researchPrivacyGatePassed } from '../../backend/src/research/entitlement.js';

function fakeDb({ individual = false, seat = false } = {}) {
  return {
    prepare(sql) {
      return {
        bind() {
          return {
            async first() {
              if (sql.includes('FROM subscriptions')) return individual ? { ok: 1 } : null;
              if (sql.includes('institution_subscription_seats')) return seat ? { ok: 1 } : null;
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

  it('allows an assigned institutional Research seat', async () => {
    expect(await hasResearchEntitlement(fakeDb({ seat: true }), { user_id: 7, role: 'user', institution_id: 3 })).toBe(true);
  });

  it('denies an authenticated user without subscription or seat', async () => {
    expect(await hasResearchEntitlement(fakeDb(), { user_id: 7, role: 'user', institution_id: 3 })).toBe(false);
  });
});
