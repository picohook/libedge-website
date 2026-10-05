const ASCII_LETTER = /[A-Za-z]/;
const SAFE_SCIENTIFIC_GREEK = new Set(['α','β','γ','δ','ε','θ','λ','μ','π','σ','φ','ω','Δ','Ω']);

function hasUnauthorizedNonAsciiLetter(value) {
  for (const char of String(value || '')) {
    if (char.codePointAt(0) <= 127) continue;
    // Unicode punctuation, symbols, separators and numeric marks do not imply
    // non-English prose. Permit a narrow set of Greek scientific notation
    // commonly embedded in otherwise-English academic text (e.g. β, μm).
    if (/^[\p{P}\p{S}\p{Z}\p{N}]$/u.test(char)) continue;
    if (SAFE_SCIENTIFIC_GREEK.has(char)) continue;
    return true;
  }
  return false;
}

function boundaryResult(text, source) {
  if (!text || !ASCII_LETTER.test(text) || hasUnauthorizedNonAsciiLetter(text)) {
    return { authorized: false, reason: 'SUPPORT_CHECK_LANGUAGE_UNAUTHORIZED', source };
  }
  return { authorized: true, language: 'en' };
}

export function supportCheckLanguageBoundary(claim, evidence = []) {
  const claimResult = boundaryResult(String(claim?.text || '').trim(), 'claim');
  if (!claimResult.authorized) return claimResult;

  for (const item of evidence) {
    if (item?.language_authorized === true) continue;
    const evidenceText = [item?.title, item?.abstract].filter(Boolean).join(' ').trim();
    if (!evidenceText) continue;
    const evidenceResult = boundaryResult(evidenceText, 'evidence');
    if (!evidenceResult.authorized) return evidenceResult;
  }

  return { authorized: true, language: 'en' };
}
