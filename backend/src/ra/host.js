/**
 * backend/src/ra/host.js
 *
 * Hyphen encoding for publisher origin hostnames.
 *
 * Rule:
 *   - '.' becomes '-'
 *   - '-' becomes '--' (RFC 1123 compatible — consecutive hyphens are legal in DNS labels
 *     but not at the start/end of a label, so the encoded label never starts/ends
 *     with a hyphen because hostname labels never start/end with '.' or '-' in practice)
 *
 * Decode walks the string and pairs consecutive '-' back to a literal '-',
 * single '-' back to '.'.
 *
 * Examples:
 *   journals.example.com     <->  journals-example-com
 *   my-site.example.com      <->  my--site-example-com
 *   sub.journals.example.com <->  sub-journals-example-com
 */

/**
 * @param {string} host canonical host (publisher origin)
 * @returns {string} hyphen-encoded subdomain label
 */
export function encodeHost(host) {
  const lower = host.toLowerCase().trim();
  let out = '';
  for (const ch of lower) {
    if (ch === '.') out += '-';
    else if (ch === '-') out += '--';
    else out += ch;
  }
  return out;
}

/**
 * @param {string} encoded hyphen-encoded label
 * @returns {string} canonical host
 */
export function decodeHost(encoded) {
  let out = '';
  let i = 0;
  const s = encoded.toLowerCase();
  while (i < s.length) {
    if (s[i] === '-') {
      if (s[i + 1] === '-') {
        out += '-';
        i += 2;
      } else {
        out += '.';
        i += 1;
      }
    } else {
      out += s[i];
      i += 1;
    }
  }
  return out;
}

/**
 * Validator: encoded label RFC 1123 compliant subdomain olarak çözülebiliyor mu?
 *
 * @param {string} encoded
 * @returns {boolean}
 */
export function isValidEncodedHost(encoded) {
  if (!encoded || encoded.length > 253) return false;
  if (!/^[a-z0-9-]+$/i.test(encoded)) return false;
  // Ardışık hyphen grupları: çift '-' (literal '-' kodu) serbest, tekli '-' nokta kodu.
  // Decode deneyip geçerli hostname çıkıyor mu diye bakalım.
  const decoded = decodeHost(encoded);
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i.test(decoded)) {
    return false;
  }
  return true;
}
