const fs = require('fs');
const files = ['admin.html', 'announcements.html', 'backend/src/index.js'];
const markerRe = /[ÃÂÄÅï¿½]/;
const markerCount = value => (value.match(/[ÃÂÄÅï¿½]/g) || []).length;
const badReplacementCount = value => (value.match(/�/g) || []).length;
const printableScore = value => (value.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) || []).length;
function tryFixToken(token) {
  if (!markerRe.test(token)) return token;
  if (/https?:\/\//i.test(token)) return token;
  let current = token;
  for (let i = 0; i < 3; i += 1) {
    let next;
    try { next = Buffer.from(current, 'latin1').toString('utf8'); } catch { break; }
    const improved = markerCount(next) < markerCount(current) || badReplacementCount(next) < badReplacementCount(current);
    const sane = printableScore(next) <= printableScore(current);
    if (!improved || !sane) break;
    current = next;
  }
  return current;
}
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const fixed = text.replace(/[^\s"'<>]+/g, token => tryFixToken(token));
  fs.writeFileSync(file, fixed, 'utf8');
}