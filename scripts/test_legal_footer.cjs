'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../site');let count=0;
function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{const p=path.join(d,e.name);return e.isDirectory()?walk(p):e.isFile()&&p.endsWith('.html')?[p]:[]})}
for(const p of walk(root)){const rel=path.relative(root,p).replace(/\\/g,'/'),s=fs.readFileSync(p,'utf8');if(rel.startsWith('legal/')){assert(s.includes('class="footer"'),rel+' missing native footer');continue}
assert.equal(s.split('<!-- MIH_LEGAL_FOOTER_V1 -->').length-1,1,rel+' footer marker count');
const i=s.lastIndexOf('<!-- MIH_LEGAL_FOOTER_V1 -->');assert(i>=0);
const b=s.toLowerCase().lastIndexOf('</body>'),h=s.toLowerCase().lastIndexOf('</html>');const end=b>=0?b:h;assert(end>i,rel+' footer not at document end');
assert(s.slice(i,end).includes('legal/privacy.html')&&s.slice(i,end).includes('legal/risk-disclosures.html'),rel+' legal links absent');
assert(!/<\/main\s*>/i.test(s.slice(i,end)),rel+' footer before main content end');count++}
assert(count>40,'unexpected HTML page count');console.log('Verified legal footer at end of '+count+' HTML pages; legal pages have their own footer.');