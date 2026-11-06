const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class E{
 constructor(name){this.tagName=name;this.children=[];this.events={};this.attributes={};this.hidden=false;this.open=false;this.textContent='';this._value='';this.style={setProperty:(k,v)=>{this.attributes[k]=v}};}
 append(...nodes){this.children.push(...nodes)}
 replaceChildren(...nodes){this.children=[...nodes]}
 setAttribute(k,v){this.attributes[k]=v}
 addEventListener(k,fn){this.events[k]=fn}
 focus(){this.focused=true}
 get value(){return this._value||(this.tagName==='select'?this.children[0]?.value:'')||''}
 set value(v){this._value=v}
 querySelectorAll(tag){return this.children.flatMap(c=>[...(c.tagName===tag?[c]:[]),...c.querySelectorAll(tag)])}
}
const data=JSON.parse(fs.readFileSync('site/data/research-register.json')),standard=JSON.parse(fs.readFileSync('site/data/external-source-standard.json'));
async function main(){
 const nodes={};for(const id of ['controls','results','count','checked','totals','pending-note','loading'])nodes[`[data-research-${id}]`]=new E('div');
 const host={querySelector:q=>nodes[q]};
 const context={URL,URLSearchParams,Intl,Date,Map,Set,location:{search:'?research-status=pending'},document:{currentScript:{src:'https://example.test/hub/research-register.js'},getElementById:id=>id==='my-research'?host:null,createElement:name=>new E(name)},fetch:async url=>({ok:true,json:async()=>String(url).endsWith('research-register.json')?data:standard})};
 context.globalThis=context;vm.createContext(context);vm.runInContext(fs.readFileSync('site/research-register.js','utf8'),context);
 await new Promise(r=>setTimeout(r,10));
 const controls=nodes['[data-research-controls]'],results=nodes['[data-research-results]'];
 assert.equal(results.children.length,data.entries.filter(x=>x.state==='pending').length);
 const selectors=controls.querySelectorAll('select'),query=controls.querySelectorAll('input')[0],buttons=controls.querySelectorAll('button');
 assert.equal(selectors[0].value,'pending');assert.equal(nodes['[data-research-pending-note]'].hidden,false);
 buttons[0].events.click();assert(results.querySelectorAll('details').every(d=>d.open));assert.equal(buttons[0].attributes['aria-pressed'],'true');
 buttons[1].events.click();assert.equal(selectors[0].value,'published');assert.equal(results.children.length,data.entries.filter(x=>x.state==='published').length);assert(nodes['[data-research-pending-note]'].hidden);
 query.value='SPX collar';query.events.input();assert.equal(results.children.length,1);
 const tags=results.querySelectorAll('button');assert(tags.length>0);assert(/^#[0-9a-f]{6}$/i.test(tags[0].attributes['--tag-text']));
 tags[0].events.click();assert(selectors[1].focused);assert(selectors[1].value);
 query.value='<script>';query.events.input();assert.equal(results.children[0].className,'rr-empty');
 const links=results.querySelectorAll('a');assert(links.every(a=>a.href.startsWith('https://example.test/hub/')));
 console.log('PASS research register UI: pending deep link, descriptions, reset, search, tag selection and canonical colours');
}
main().catch(e=>{console.error(e);process.exit(1)});
