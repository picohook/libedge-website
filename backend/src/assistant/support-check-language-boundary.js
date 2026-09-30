const ASCII_LETTER = /[A-Za-z]/;
const NON_ASCII_LETTER = /[^\x00-\x7F]/u;

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
  if (NON_ASCII_LETTER.test(text)) {
    return { authorized: false, reason: 'SUPPORT_CHECK_LANGUAGE_UNAUTHORIZED' };
  }

  return { authorized: true, language: 'en' };
}
