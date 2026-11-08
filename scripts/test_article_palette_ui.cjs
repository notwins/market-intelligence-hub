const fs=require('fs'),vm=require('vm'),assert=require('assert');
const path=require('path'),root=path.resolve(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'site/data/colour-templates-v3.json'),'utf8'));
const inventory=JSON.parse(fs.readFileSync(path.join(root,'site/data/article-palettes.json'),'utf8'));
const source=fs.readFileSync(path.join(root,'site/colour-templates-v3/reference.js'),'utf8');
class Element{constructor(){this.value='';this.innerHTML='';this.textContent='';this.hidden=false;this.listeners={};this.style={setProperty(){}};}addEventListener(t,f){this.listeners[t]=f;}insertAdjacentHTML(_p,s){this.innerHTML+=s;}setAttribute(){}scrollIntoView(){}}
const nodes=new Map(),get=id=>nodes.get(id)||nodes.set(id,new Element()).get(id);
const cards=inventory.articles.map(a=>({dataset:{articleTheme:a.recommended_theme,articleStatus:a.status,articleSearch:a.title+' '+a.date+' '+a.edition},hidden:false}));
const context={document:{getElementById:get,querySelectorAll:s=>s==='[data-article-search]'?cards:[]},fetch:async()=>({ok:true,json:async()=>data}),URLSearchParams,location:{search:''},navigator:{},console};
vm.createContext(context);vm.runInContext(source,context);
setImmediate(async()=>{try{
 assert.equal(cards.filter(c=>!c.hidden).length,12);get('article-query').value='gold';get('article-query').listeners.input();assert(cards.filter(c=>!c.hidden).every(c=>c.dataset.articleSearch.toLowerCase().includes('gold')));
 get('article-query').value='not-a-real-match';get('article-query').listeners.input();assert.equal(cards.filter(c=>!c.hidden).length,0);assert.equal(get('article-empty').hidden,false);
 get('article-query').value='';get('article-query').listeners.input();get('article-more').listeners.click();assert.equal(cards.filter(c=>!c.hidden).length,36);
 get('company-all').listeners.click();assert.equal((get('company-results').innerHTML.match(/class="identity-icon"/g)||[]).length,212);
 get('tag-all').listeners.click();assert.equal((get('tag-results').innerHTML.match(/class="identity-icon"/g)||[]).length,437);
 for(const c of data.companies){const p=data.semanticPalettes.find(p=>p['Colour name']===c.colourName);assert(p);assert.equal(p['Light text'],c.light);assert.equal(p['Dark text'],c.dark);assert(get('company-results').innerHTML.includes('background:'+p['Light chip']));}
 for(const t of data.tags){assert(get('tag-results').innerHTML.includes(t.lightChip));assert(get('tag-results').innerHTML.includes(t.darkChip));}
 get('company-query').value='GOOGL';get('company-query').listeners.input();assert(get('company-results').innerHTML.includes('Alphabet'));assert(!get('company-results').innerHTML.includes('NVIDIA'));
 get('tag-query').value='United States';get('tag-query').listeners.input();assert(get('tag-results').innerHTML.includes('#1D4ED8'));
 get('unified-prompt-source').textContent=JSON.stringify('Exact full research prompt');let copied='';context.navigator.clipboard={writeText:async t=>{copied=t;}};await get('copy-unified-prompt').listeners.click();assert.equal(copied,'Exact full research prompt');assert(get('unified-copy-status').textContent.includes('copied'));delete context.navigator.clipboard;await get('copy-unified-prompt').listeners.click();assert(get('unified-copy-status').textContent.includes('Download'));
 console.log('Article filters, pagination, 212 company icons, 437 keyword icons, exact semantic pairs and searches passed.');
 }catch(e){console.error(e);process.exitCode=1;}});
