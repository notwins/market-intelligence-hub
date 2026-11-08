const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const api=require('../site/tag-family-tree.js');
const html=fs.readFileSync('site/tag-map.html','utf8');
const taxonomy=JSON.parse(html.match(/id="taxonomy">(.*?)<\/script>/)[1]);
const standard=JSON.parse(fs.readFileSync('site/data/colour-templates-v3.json','utf8'));
const index=api.canonicalIndex(standard.tags),flat=api.flatten(taxonomy);
assert.equal(flat.length,515);assert.equal(taxonomy.length,14);assert.equal(new Set(flat.map(x=>x.id)).size,515);
assert(html.indexOf('id="family-map"')<html.indexOf('id="catalogue"'));
assert(html.includes('tag-family-tree.css'));assert(html.includes('tag-family-tree.js'));
let mapped=0;for(const [i,root] of taxonomy.entries())for(const n of api.flatten([root])){const s=api.nodeStyle(n,root,index,i);assert(api.contrast(s.ink,s.bg)>=4.5,`${n.label}: contrast`);if(s.canonical){mapped++;let t=standard.tags.find(x=>x.id===s.canonical);assert.equal(s.ink,t.light);assert.equal(s.bg,t.lightChip);}else assert.equal(s.ink,root.color);}
assert(mapped>100);assert.equal(api.resolveTag({label:'BOC',id:'institutions--boc'},index),null);assert.equal(api.resolveTag({label:'DE',id:'country-region--de'},index),null);assert.equal(api.resolveTag({label:'FedEx',id:'x'},index).id,'company.fdx');
assert.equal(api.resolveTag({label:'Singapore',id:'country-region--singapore'},index).light,'#047857');assert.equal(api.resolveTag({label:'MAS',id:'institutions--mas'},index).light,'#0F766E');
assert.equal(api.count(api.searchTree(taxonomy,'')),515);assert(api.count(api.searchTree(taxonomy,'central bank'))>0);assert.equal(api.count(api.searchTree(taxonomy,'not-present-xyz')),0);assert(api.escape('<img onerror="x">').includes('&lt;img'));
// Render the actual scripts with minimal DOM fixtures to verify every jump target and controls.
function runDOM(failFetch=false){
 const elems=new Map();let focus=null,scrolled=null;const events={};
 const element=id=>{if(!elems.has(id))elems.set(id,{id,value:'',textContent:'',innerHTML:'',dataset:{},children:[],addEventListener(type,fn){events[id+':'+type]=fn;},querySelectorAll(){return [];},focus(){focus=id;},scrollIntoView(){scrolled=id;}});return elems.get(id);};
 element('taxonomy').textContent=JSON.stringify(taxonomy);
 const context={document:{getElementById:element,querySelectorAll:()=>[]},location:{hash:'',search:''},history:{pushState(a,b,hash){context.location.hash=hash;}},URL,URLSearchParams,encodeURIComponent,fetch:()=>failFetch?Promise.reject(new Error('offline')):Promise.resolve({ok:true,json:()=>Promise.resolve(standard)}),window:{addEventListener(type,fn){events['window:'+type]=fn;}},console};
 vm.createContext(context);const inline=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];vm.runInContext(inline,context);vm.runInContext(fs.readFileSync('site/tag-family-tree.js','utf8'),context);
 return {elems,element,events,context,getFocus:()=>focus,getScroll:()=>scrolled};
}
(async()=>{const d=runDOM();await new Promise(resolve=>setImmediate(resolve));
const map=d.element('family-diagram').innerHTML,detail=d.element('tree').innerHTML;
const jumps=[...map.matchAll(/href="#([^"]+)"/g)].map(x=>x[1]);assert.equal(jumps.length,515);assert.equal(new Set(jumps).size,515);for(const id of jumps)assert(detail.includes('id="'+id+'"'),id+' missing atlas target');
assert.equal((map.match(/class="family-icon"/g)||[]).length,516);assert.equal((map.match(/<details[^>]* open/g)||[]).length,0);assert(d.element('family-colour-note').innerHTML.includes('V1.2 Merged'));
d.events['family-expand:click']();assert((d.element('family-diagram').innerHTML.match(/<details[^>]* open/g)||[]).length>50);
d.events['family-overview:click']();assert.equal((d.element('family-diagram').innerHTML.match(/<details[^>]* open/g)||[]).length,0);assert.equal(d.getFocus(),'family-search');
d.element('family-search').value='zz-nomatch';d.events['family-search:input']();assert(d.element('family-diagram').innerHTML.includes('No matching branch'));
d.element('family-search').value='MAS';d.events['family-search:input']();assert(d.element('family-diagram').innerHTML.includes('Monetary Authority of Singapore'));
d.element('q').value='no-match';const id=flat.find(x=>x.label==='CPI').id;const parent={tagName:'DETAILS',open:false,parentElement:null};d.element(id).parentElement=parent;d.events['family-diagram:click']({target:{closest:()=>({getAttribute:()=>'#'+id})},preventDefault(){}});assert.equal(d.element('q').value,'');assert.equal(parent.open,true);assert.equal(d.context.location.hash,'#'+id);assert.equal(d.getFocus(),id);assert.equal(d.getScroll(),id);
const failed=runDOM(true);await new Promise(resolve=>setImmediate(resolve));assert(failed.element('family-colour-note').textContent.includes('could not load'));assert.equal((failed.element('family-diagram').innerHTML.match(/href="#/g)||[]).length,515);
console.log('PASS tag family tree: 515 exact links/icons, 14 roots, '+mapped+' canonical colours, all contrast ≥4.5, preserved taxonomy, search, expand/reset, safe escaping, hash navigation and offline fallback');
})();
