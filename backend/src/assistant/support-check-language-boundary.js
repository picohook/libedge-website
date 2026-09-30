const ASCII_LETTER = /[A-Za-z]/;
function containsNonAscii(value) {
  return [...String(value || '')].some((char) => char.codePointAt(0) > 127);
}

export function supportCheckLanguageBoundary(claim, evidence = []) {
  const text = [
    claim?.text,
    ...evidence.flatMap((item) => [item?.title, item?.abstract])
  ].filter(Boolean).join(' ').trim();

  if (!text || !ASCII_LETTER.test(text)) {
    return { authorized: false, reason: 'SUPPORT_CHECK_LANGUAGE_UNAUTHORIZED' };
  }

  // D-023 authorizes English only. This is deliberately conservative:
  // non-ASCII text is not silently sent through the English-only checker.
  if (containsNonAscii(text)) {
    return { authorized: false, reason: 'SUPPORT_CHECK_LANGUAGE_UNAUTHORIZED' };
  }

  return { authorized: true, language: 'en' };
}
