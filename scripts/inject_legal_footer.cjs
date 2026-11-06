'use strict';
const fs = require('node:fs'), path = require('node:path');
const {walk, protectedHtml} = require('./publication_policy.cjs');
const root = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '../site');
const protectedPaths = protectedHtml(root);
const marker = '<!-- MIH_LEGAL_FOOTER_V1 -->';
const links = [
  ['index.html', 'Legal &amp; transparency'], ['disclaimer.html', 'Disclaimer'],
  ['privacy.html', 'Privacy'], ['terms.html', 'Terms'],
  ['risk-disclosures.html', 'Investment risks'], ['editorial-policy.html', 'Editorial standards']
];
let updated = 0, unchanged = 0, legal = 0, preserved = 0;
for (const filename of walk(root).filter(p => p.toLowerCase().endsWith('.html'))) {
  const relative = path.relative(root, filename).split(path.sep).join('/');
  if (protectedPaths.has(relative)) { preserved++; continue; }
  if (relative.startsWith('legal/')) { legal++; continue; }
  let content = fs.readFileSync(filename, 'utf8');
  if (content.includes(marker)) { unchanged++; continue; }
  const directory = path.posix.dirname(relative);
  const legalBase = path.posix.relative(directory, 'legal') + '/';
  const css = path.posix.relative(directory, 'legal-footer.css');
  if (!/<\/head\s*>/i.test(content)) throw new Error('Cannot attach footer stylesheet: ' + relative);
  content = content.replace(/<\/head\s*>/i, '<link rel="stylesheet" href="' + css + '"></head>');
  const footer = marker + '\n<footer class="mih-legal-footer" role="contentinfo"><div>' +
    '<p>Market Intelligence Hub · Independent educational research · Not personalised financial advice. ' +
    'Market data and simulations may be delayed, hypothetical or incomplete.</p>' +
    '<nav aria-label="Legal and disclosure information">' +
    links.map(([file, title]) => '<a href="' + legalBase + file + '">' + title + '</a>').join(' ') +
    '</nav></div></footer>';
  const bodies = [...content.matchAll(/<\/body\s*>/gi)], endings = [...content.matchAll(/<\/html\s*>/gi)];
  if (!bodies.length && !endings.length) throw new Error('Cannot place footer at document end: ' + relative);
  const at = bodies.length ? bodies.at(-1).index : endings.at(-1).index;
  content = content.slice(0, at) + '\n' + footer + '\n' + content.slice(at);
  fs.writeFileSync(filename, content, 'utf8');
  updated++;
}
console.log('Legal footer injection: ' + updated + ' new, ' + unchanged + ' already tagged, ' +
  legal + ' legal policy pages (native footer), ' + preserved + ' protected originals unchanged');
