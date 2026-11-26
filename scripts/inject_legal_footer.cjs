'use strict';
const fs = require('node:fs'), path = require('node:path');
const {walk, protectedHtml} = require('./publication_policy.cjs');
const root = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '../site');
const protectedPaths = protectedHtml(root);
const marker = '<!-- MIH_LEGAL_FOOTER_V1 -->';
const navigationVersion = '?v=20261127.atlas1';
const settingsVersion = '?v=20261127.usage1';
const accessFile = path.join(root, 'data/blueprint-access.json');
const access = fs.existsSync(accessFile) ? JSON.parse(fs.readFileSync(accessFile, 'utf8')) : null;
if(access){const owner=new URL(access.owner_url);if(access.schema_version!==1||owner.protocol!=='https:'||owner.username||owner.password||owner.search||owner.hash||!owner.hostname.endsWith('.chatgpt.site'))throw Error('Invalid blueprint access destination');}
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
  const directory = path.posix.dirname(relative);
  if (!content.includes('id="mih-usage"') && !/(?:-preview|-backup)\.html$/i.test(relative)) {
    const script = path.posix.relative(directory, 'hub-usage.js');
    content = content.replace(/<\/head\s*>/i, '<script id="mih-usage" defer src="' + script + '?v=1"></script></head>');
  }
  // Shared navigation belongs to mutable UI shells, never frozen reports.
  if (/^(?:desk\.html|v4\.html|historical-fred\.html|fred-[123]\.html|fred\/(?:index|market-desk|risk-observatory|signal-review|cross-market-replay|data)\.html)$/.test(relative)
      || relative === 'blueprint.html' || relative === 'research-feed.html') {
    const dependencies = content.slice(0, content.search(/<\/head\s*>/i)).replace(/%20/gi, ' ');
    const navigationCSS = 'Primary Navigation - Type CSS - 16-Nov-16.06.css';
    const navigationJS = 'Primary Navigation - Type JS - 16-Nov-16.06.js';
    const mobileCharts = 'Mobile Charts - Type JS - 16-Nov-16.06.js';
    const addPath = filename => path.posix.relative(directory, filename);
    const addScript = filename => '<script defer src="' + addPath(filename) + '"></script>';
    let assets = '';
    if (!dependencies.includes(navigationCSS)) assets += '<link id="hub-primary-assets" rel="stylesheet" href="' + addPath(navigationCSS) + navigationVersion + '">';
    if (!dependencies.includes(navigationJS)) assets += addScript(navigationJS + navigationVersion);
    if (relative !== 'blueprint.html' && relative !== 'research-feed.html' && !dependencies.includes(mobileCharts)) assets += addScript(mobileCharts);
    if (assets) content = content.replace(/<\/head\s*>/i, assets + '</head>');
  }
  content = content.replace(/((?:href|src)="[^"]*Primary(?:%20| )Navigation(?:%20| )-(?:%20| )Type(?:%20| )(?:CSS|JS)(?:%20| )-(?:%20| )16-Nov-16\.06\.(?:css|js))(?:\?[^"]*)?"/g, '$1' + navigationVersion + '"');
  const usageScript = path.posix.relative(directory, 'hub-usage.js') + '?v=1';
  if (!content.includes('id="mih-usage"')) content = content.replace(/<\/head\s*>/i,
    '<script id="mih-usage" defer src="' + usageScript + '"></script></head>');
  const legalBase = path.posix.relative(directory, 'legal') + '/';
  const css = path.posix.relative(directory, 'legal-footer.css');
  const bootstrap=path.posix.relative(directory,'blueprint-access.js')+settingsVersion;
  if(access&&!content.includes('id="mih-blueprint-access"'))content=content.replace(/<\/head\s*>/i,'<script id="mih-blueprint-access" src="'+bootstrap+'" defer></script></head>');
  if(access)content=content.replace(/(<script\b[^>]*\bid="mih-blueprint-access"[^>]*\bsrc="[^"]*blueprint-access\.js)(?:\?[^"]*)?"/g,'$1'+settingsVersion+'"');
  if (!/<\/head\s*>/i.test(content)) throw new Error('Cannot attach footer stylesheet: ' + relative);
  if(!content.includes('<link rel="stylesheet" href="'+css+'">'))content = content.replace(/<\/head\s*>/i, '<link rel="stylesheet" href="' + css + '"></head>');
  const footer = marker + '\n<footer class="mih-legal-footer" role="contentinfo"><div>' +
    '<p>Market Intelligence Hub · Independent educational research · Not personalised financial advice. ' +
    'Market data and simulations may be delayed, hypothetical or incomplete.</p>' +
    '<nav aria-label="Legal and disclosure information">' +
    links.map(([file, title]) => '<a href="' + legalBase + file + '">' + title + '</a>').join(' ') +
    '</nav>'+(access?'<details class="mih-blueprint-nav" data-blueprint-footer><summary>Settings</summary><nav aria-label="Site tools"><a href="'+path.posix.relative(directory,'blueprint.html')+'" target="_blank" rel="noopener noreferrer">◈ System Atlas</a><a href="'+access.owner_url+'" target="_blank" rel="noopener noreferrer">🔒 Private owner blueprint · password required</a></nav></details>':'')+'</div></footer>';
  if(content.includes(marker)){const start=content.lastIndexOf(marker),end=content.indexOf('</footer>',start);if(end<0)throw Error('Existing footer is incomplete');content=content.slice(0,start)+footer+content.slice(end+9);fs.writeFileSync(filename,content,'utf8');unchanged++;continue;}
  const bodies = [...content.matchAll(/<\/body\s*>/gi)], endings = [...content.matchAll(/<\/html\s*>/gi)];
  if (!bodies.length && !endings.length) throw new Error('Cannot place footer at document end: ' + relative);
  const at = bodies.length ? bodies.at(-1).index : endings.at(-1).index;
  content = content.slice(0, at) + '\n' + footer + '\n' + content.slice(at);
  fs.writeFileSync(filename, content, 'utf8');
  updated++;
}
console.log('Legal footer injection: ' + updated + ' new, ' + unchanged + ' already tagged, ' +
  legal + ' legal policy pages (native footer), ' + preserved + ' protected originals unchanged');
