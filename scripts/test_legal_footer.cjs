'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {walk,protectedHtml}=require('./publication_policy.cjs');
const root=process.argv[2]?path.resolve(process.argv[2]):path.resolve(__dirname,'../site');
const protectedPaths=protectedHtml(root);
let count=0,legal=0,preserved=0;
for(const filename of walk(root).filter(p=>p.toLowerCase().endsWith('.html'))){
  const rel=path.relative(root,filename).replace(/\\/g,'/'),s=fs.readFileSync(filename,'utf8');
  if(protectedPaths.has(rel)){preserved++;continue}
  if(rel.startsWith('legal/')){
    assert.equal((s.match(/<footer\b[^>]*class="footer"/g)||[]).length,1,rel+' native footer count');
    assert(/<footer\b[^>]*class="footer"[\s\S]*<\/footer>\s*<\/body>\s*<\/html>\s*$/i.test(s),rel+' native footer must be last');
    assert(s.includes('href="terms.html"')&&s.includes('href="privacy.html"'),rel+' native legal links absent');
    legal++;continue;
  }
  assert.equal(s.split('<!-- MIH_LEGAL_FOOTER_V1 -->').length-1,1,rel+' footer marker count');
  const css=path.posix.relative(path.posix.dirname(rel),'legal-footer.css');
  assert(s.includes('<link rel="stylesheet" href="'+css+'">'),rel+' footer stylesheet absent');
  assert(fs.statSync(path.join(root,'legal-footer.css')).isFile(),'missing shared footer stylesheet');
  const tail=s.slice(s.lastIndexOf('<!-- MIH_LEGAL_FOOTER_V1 -->'));
  assert(/^<!-- MIH_LEGAL_FOOTER_V1 -->\s*<footer\b[\s\S]*<\/footer>\s*(?:<\/body\s*>\s*)?<\/html\s*>\s*$/i.test(tail),rel+' footer must be last');
  assert(!/<\/(?:main|body|html)\b/i.test(tail.slice(0,tail.lastIndexOf('</footer>'))),rel+' invalid footer placement');
  assert(tail.includes('legal/privacy.html')&&tail.includes('legal/risk-disclosures.html')&&tail.includes('legal/terms.html'),rel+' legal links absent');
  assert(!/<\/footer>\s*\S[\s\S]*<\/footer>/i.test(tail),rel+' duplicate nested footer');
  count++;
}
assert(count>0&&legal>0&&preserved>0,'missing publication page category');
console.log('Verified bottom legal footer on '+count+' mutable pages and '+legal+' legal pages; '+preserved+' protected originals exempt (byte audit required).');
