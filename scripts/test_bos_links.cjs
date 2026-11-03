const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const b=require('../site/bos-resources.js');
assert.equal(b.sources.length,3);assert.equal(b.sources.filter(x=>x.kind==='bonds').length,2);
for(const s of b.sources){const u=new URL(s.url);assert.equal(u.hostname,'productgroup.bankofsingapore.com');assert.equal(u.protocol,'https:');assert(u.pathname.endsWith('.pdf'));}
assert.equal(b.sources[0].date,'2026-11-03');assert.equal(b.sources[1].date,'2026-11-04');assert.equal(b.sources[2].date,'2026-11-04');
assert(b.sources[2].scope.includes('no currency field'));assert(b.sources[1].scope.includes('including SGD'));
assert.equal((b.cards('equities').match(/Open original PDF/g)||[]).length,1);assert.equal((b.cards('bonds').match(/Open original PDF/g)||[]).length,2);
assert(b.cards().includes('previous-business-day'));assert(b.cards().includes('not automatically updated'));assert(b.cards().includes('target="_blank" rel="noopener noreferrer"'));assert(!b.cards().includes('<iframe'));
const html=fs.readFileSync('site/v4.html','utf8');for(const kind of ['equities','bonds','all'])assert(html.includes("BOSResources.cards('"+kind+"')"));assert(html.includes("BOSResources.cards(isStock?'equities':'bonds')"));
for(const m of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))if(m[1].trim())new vm.Script(m[1]);
console.log('PASS exact publisher URLs/editions, multicurrency distinction, no OCBC currency inference, external-only PDFs, pricing/access caveats and V4 section integration');
