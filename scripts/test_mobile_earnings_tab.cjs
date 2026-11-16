'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('site/Primary Navigation - Type JS - 16-Nov-16.06.js','utf8');
class El{
 constructor(tag){this.tagName=tag;this.children=[];this.attrs={};this.events={};this.className='';this.offsetLeft=80;this.scrollLeft=0;this.style={setProperty(){}};this.classList={add:(name)=>this.className+=' '+name};}
 append(...items){this.children.push(...items);}
 prepend(...items){this.children.unshift(...items);}
 replaceChildren(...items){this.children=items;}
 set textContent(v){this.text=v;this.children=[];}
 get textContent(){return (this.text||'')+this.children.map(n=>n.textContent).join('');}
 setAttribute(k,v){this.attrs[k]=v;}
 removeAttribute(k){delete this.attrs[k];}
 addEventListener(k,v){this.events[k]=v;}
 querySelectorAll(sel){return this.children.flatMap(n=>(sel==='a'&&n.tagName==='a'?[n]:[]).concat(n.querySelectorAll?.(sel)||[]));}
 querySelector(sel){return this.children.find(n=>sel==='.more-grid'&&n.className==='more-grid')||null;}
 getBoundingClientRect(){return {height:54};}
 focus(){}
 close(){}
}
function boot(pathname='/market-intelligence-hub/v4.html',hash='#overview'){
 const bar=new El('nav'),more=new El('button'),menu=new El('dialog'),grid=new El('div'),root=new El('html'),body=new El('body');grid.className='more-grid';menu.id='more';menu.append(grid);
 const location={pathname,hash},events={},document={currentScript:{src:'https://example.com/market-intelligence-hub/Primary%20Navigation%20-%20Type%20JS%20-%2016-Nov-16.06.js'},documentElement:root,body,createElement:t=>new El(t),createTextNode:t=>({textContent:t}),querySelector:s=>s==='.bottom-nav'?bar:null,getElementById:id=>id==='more-btn'?more:id==='more'?menu:null};
 vm.runInNewContext(source,{document,location,URL,window:{addEventListener:(k,v)=>events[k]=v},ResizeObserver:class{constructor(f){this.f=f;}observe(){this.f();}},requestAnimationFrame:f=>f()});
 return {scroll:bar.children[0],bar,more,menu,location,events};
}
for(const path of ['v4.html','desk.html','fred/index.html','market-understanding/index.html']){
 const x=boot('/market-intelligence-hub/'+path),links=x.scroll.querySelectorAll('a');
 assert.deepEqual(links.map(a=>a.textContent),['⌂Home','◈US Earnings','⌁FRED','▦Master Pivot','↗Historical charts','▤My Blog','◫Markets']);
 const earnings=links[1];assert.equal(String(earnings.href),'https://example.com/market-intelligence-hub/v4.html#earnings');
 assert.equal(earnings.className,'hub-mobile-earnings');assert.equal(x.bar.children[1],x.more);
 assert.equal(links.filter(a=>a.className==='hub-mobile-earnings').length,1);
 if(path==='v4.html'){
  x.location.hash='#earnings';x.events.hashchange();assert.equal(earnings.attrs['aria-current'],'page');
  x.location.hash='#overview';x.events.hashchange();assert.equal(earnings.attrs['aria-current'],undefined);
  x.location.hash='#earnings';x.events.hashchange();x.events.resize();assert.equal(earnings.attrs['aria-current'],'page');
 }
}
const css=fs.readFileSync('site/Primary Navigation - Type CSS - 16-Nov-16.06.css','utf8');
assert(css.includes('.hub-primary .hub-primary-scroll>a.hub-mobile-earnings{display:none}'));
assert(css.slice(css.indexOf('@media(max-width:760px)')).includes('.hub-primary .hub-primary-scroll>a.hub-mobile-earnings{display:inline-flex}'));
assert(css.includes('min-height:44px'));assert(css.includes('overflow-x:auto'));
const injector=fs.readFileSync('scripts/inject_legal_footer.cjs','utf8');assert.equal((injector.match(/v=20261116\.earnings-tab/g)||[]).length,2);
console.log('PASS mobile-only earnings tab after Home, existing section order preserved, fixed More, nested paths, hashchange active state, desktop hiding and versioned asset injection');
