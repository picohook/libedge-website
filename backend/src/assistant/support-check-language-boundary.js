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

export function supportCheckLanguageBoundary(claim, evidence = []) {
  const text = [
    claim?.text,
    ...evidence.flatMap((item) => [item?.title, item?.abstract])
  ].filter(Boolean).join(' ').trim();

  if (!text || !ASCII_LETTER.test(text)) {
    return { authorized: false, reason: 'SUPPORT_CHECK_LANGUAGE_UNAUTHORIZED' };
  }

  // D-023 authorizes English only. Do not equate harmless academic Unicode
  // with non-English prose, while continuing to fail closed for non-ASCII
  // natural-language letters outside the narrowly allowlisted notation above.
  if (hasUnauthorizedNonAsciiLetter(text)) {
    return { authorized: false, reason: 'SUPPORT_CHECK_LANGUAGE_UNAUTHORIZED' };
  }

  return { authorized: true, language: 'en' };
}
