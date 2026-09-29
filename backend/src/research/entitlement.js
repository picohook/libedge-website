export async function hasResearchEntitlement(db, user) {
  if (!user?.user_id || !db) return false;
  if (user.role === 'super_admin') return true;

  const individual = await db.prepare(`
    SELECT 1 FROM subscriptions
    WHERE user_id = ? AND product_slug = 'research' AND status = 'active'
      AND (start_date IS NULL OR date(start_date) <= date('now'))
      AND (end_date IS NULL OR date(end_date) >= date('now'))
    LIMIT 1
  `).bind(user.user_id).first();
  if (individual) return true;

  if (!user.institution_id) return false;
  const seat = await db.prepare(`
    SELECT 1
    FROM institution_subscription_seats seat
    JOIN institution_subscriptions sub ON sub.id = seat.institution_subscription_id
    WHERE seat.user_id = ? AND sub.institution_id = ? AND sub.product_slug = 'research'
      AND sub.status = 'active'
      AND (sub.start_date IS NULL OR date(sub.start_date) <= date('now'))
      AND (sub.end_date IS NULL OR date(sub.end_date) >= date('now'))
    LIMIT 1
  `).bind(user.user_id, user.institution_id).first();
  return Boolean(seat);
}

export function researchPrivacyGatePassed(env = {}) {
  return String(env.RESEARCH_ASSISTANT_PROVIDER_GATE_STATUS || '').trim().toUpperCase() === 'PASS'
    && String(env.RESEARCH_ASSISTANT_SUPPORT_CHECK_PRIVACY_GATE_STATUS || '').trim().toUpperCase() === 'PASS';
}

export async function requireResearchAccess(env, user) {
  if (!researchPrivacyGatePassed(env)) {
    return { ok: false, status: 503, code: 'RESEARCH_PRIVACY_GATE_REQUIRED', error: 'Research erişimi bu ortamda etkin değil' };
  }
  if (!await hasResearchEntitlement(env?.DB, user)) {
    return { ok: false, status: 403, code: 'RESEARCH_ENTITLEMENT_REQUIRED', error: 'Research aboneliği veya kurum koltuğu gerekli' };
  }
  return { ok: true };
}
