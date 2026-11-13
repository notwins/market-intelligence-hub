const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('site/mobile-navigation.js','utf8').split('/* Mirror the existing subsection controls')[0];
class El {
 constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attributes={};this.listeners={};this.value='';}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=[...nodes];this.value='';}
 set textContent(v){this.value=v;this.children=[];} get textContent(){return this.value+this.children.map(x=>x.textContent).join('');}
 setAttribute(k,v){this.attributes[k]=v;}
 addEventListener(k,v){this.listeners[k]=v;}
 querySelector(sel){return sel==='span'?this.children.find(x=>x.tagName==='SPAN'):null;}
}
function boot(hasWatchlist=true){
 const head=new El('div'),title=new El('b'),rail=new El('nav'),lang=new El('select'),root={lang:'en'},events={},observers=[];
 const bottom=['overview','earnings','credit','hourly'].map(view=>{const n=new El('button'),icon=new El('span');n.dataset.view=view;icon.textContent='◫';n.append(icon);return n;});
 let active='overview';
 const document={documentElement:root,createElement:tag=>new El(tag),createTextNode:text=>({textContent:text}),getElementById:id=>id==='language'?lang:null,querySelector:sel=>sel==='.topbar>div:first-child'?head:sel==='.topbar b'?title:sel==='.rail nav'?rail:sel==='.rail [data-view].active'?{dataset:{view:active}}:sel==='.rail [data-view="tools"]'?{}:sel==='.rail [data-view="watchlist"]'&&hasWatchlist?{}:null,querySelectorAll:sel=>sel==='.bottom-nav [data-view]'?bottom:[]};
 const ctx={document,location:{hash:'#overview'},window:{addEventListener:(name,fn)=>events[name]=fn},MutationObserver:class{constructor(fn){observers.push(fn)}observe(){}},queueMicrotask:fn=>fn()};vm.createContext(ctx);vm.runInContext(code,ctx);
 return {head,title,lang,root,bottom,events,observers,next:head.children[0],setActive:v=>active=v};
}
const x=boot();assert.equal(x.next.dataset.view,'watchlist');assert.equal(x.next.children[0].textContent,'Next:');assert.equal(x.next.children[1].textContent,'Bonds & shares watchlist');assert.equal(x.next.children[2].attributes['aria-hidden'],'true');assert.equal(x.next.attributes['aria-label'],undefined);
x.setActive('watchlist');x.observers[0]();assert.equal(x.title.textContent,'Bonds & shares watchlist');assert.equal(x.next.dataset.view,'calls');assert.equal(x.next.children.length,3);
x.setActive('history');x.events.hashchange();assert.equal(x.next.dataset.view,'ust');x.setActive('overview');x.events.hashchange();assert.equal(x.next.dataset.view,'watchlist');
for(const [lang,label] of [['zh-Hans','债券与股票观察'],['zh-Hant','債券與股票觀察']]){x.root.lang=lang;x.setActive('watchlist');x.lang.listeners.change();assert.equal(x.title.textContent,label);assert.equal(x.next.children.length,3);}
x.root.lang='en';x.lang.listeners.change();for(const b of x.bottom){assert.equal(b.children.filter(n=>n.tagName==='SPAN').length,1);assert.equal(b.children[0].textContent,'◫');}
assert.equal(boot(false).next.dataset.view,'earnings');
const css=fs.readFileSync('site/mobile-navigation.css','utf8');for(const rule of css.matchAll(/\.section-next\{([^}]+)\}/g)){const font=rule[1].match(/font-size:([^;]+)/)?.[1];if(font)assert.equal(font,'calc(14px * var(--text-scale,1))');}
assert(css.includes('.section-next-name{flex:1 1 auto;min-width:0;white-space:normal;overflow-wrap:normal;word-break:normal}'));
assert(css.includes('.topbar b{white-space:normal;overflow-wrap:normal;word-break:normal;hyphens:none}'));
assert(css.includes('grid-template-columns:minmax(0,1fr);row-gap:2px'));
assert(css.includes('grid-column:1;grid-row:2;justify-self:end'));
assert(!/\.topbar b\{[^}]*white-space:nowrap/.test(css));
for(const width of [320,390])for(const scale of [1,2]){const available=width-24,font=14*scale,prefix=5*font*.65,arrow=font*.8,gaps=font*.7;assert(available-prefix-arrow-gaps>8*font*.6,`${width}px/${scale*100}% has room for the longest watchlist word`);}
const html=fs.readFileSync('site/v4.html','utf8');for(const asset of ['mobile-navigation.js','mobile-navigation.css'])assert(html.includes(asset+'?v=20261113.readability1'));
assert(!code.includes('localStorage'));assert(!code.includes('pushState'));assert(!code.includes('fetch('));
console.log('PASS readable 14/28px next labels, word-preserving mobile header rows, watchlist identity in three languages, route changes, V2 fallback, stable icons and cache versions');
