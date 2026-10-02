export async function resolveResearchEntitlement(db, user) {
  if (!user?.user_id) return { allowed: false, source: null };
  if (user.role === 'super_admin') return { allowed: true, source: 'individual' };
  if (!db) return { allowed: false, source: null };

  const individual = await db.prepare(`
    SELECT 1 FROM subscriptions
    WHERE user_id = ? AND product_slug = 'research' AND status = 'active'
      AND (start_date IS NULL OR date(start_date) <= date('now'))
      AND (end_date IS NULL OR date(end_date) >= date('now'))
    LIMIT 1
  `).bind(user.user_id).first();
  if (individual) return { allowed: true, source: 'individual' };

  if (!user.institution_id) return { allowed: false, source: null };
  const institutional = await db.prepare(`
    SELECT 1
    FROM institution_subscriptions sub
    LEFT JOIN institution_subscription_seats seat
      ON seat.institution_subscription_id = sub.id AND seat.user_id = ?
    WHERE sub.institution_id = ? AND sub.product_slug = 'research'
      AND sub.status = 'active'
      AND (sub.start_date IS NULL OR date(sub.start_date) <= date('now'))
      AND (sub.end_date IS NULL OR date(sub.end_date) >= date('now'))
      AND (
        sub.seat_limit IS NULL
        OR (sub.seat_limit > 0 AND seat.user_id IS NOT NULL)
      )
    LIMIT 1
  `).bind(user.user_id, user.institution_id).first();
  return institutional
    ? { allowed: true, source: 'institution' }
    : { allowed: false, source: null };
}

export async function hasResearchEntitlement(db, user) {
  return (await resolveResearchEntitlement(db, user)).allowed;
}

export function researchPrivacyGatePassed(env = {}) {
  return String(env.RESEARCH_ASSISTANT_PROVIDER_GATE_STATUS || '').trim().toUpperCase() === 'PASS'
    && String(env.RESEARCH_ASSISTANT_SUPPORT_CHECK_PRIVACY_GATE_STATUS || '').trim().toUpperCase() === 'PASS';
}

export async function requireResearchAccess(env, user) {
  if (!researchPrivacyGatePassed(env)) {
    return { ok: false, status: 503, code: 'RESEARCH_PRIVACY_GATE_REQUIRED', error: 'Research erişimi bu ortamda etkin değil' };
  }
  const entitlement = await resolveResearchEntitlement(env?.DB, user);
  if (!entitlement.allowed) {
    return { ok: false, status: 403, code: 'RESEARCH_ENTITLEMENT_REQUIRED', error: 'Research aboneliği veya kurum koltuğu gerekli' };
  }
  return { ok: true, entitlementSource: entitlement.source };
}
