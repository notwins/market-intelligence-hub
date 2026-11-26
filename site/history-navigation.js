/* One history directory for the rail, chart toolbar and home shortcuts. */
(function(root){'use strict';
const paths={curve:'M3 17c4 0 4-10 8-10s4 6 10 6M3 3v18h18',shares:'M4 19V9m5 10V5m5 14v-7m5 7V3',table:'M3 4h18v16H3zM3 9h18M8 4v16',event:'M4 5h16v15H4zM8 3v4m8-4v4M4 10h16m-11 5 2 2 4-4',search:'M15 15l6 6M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',pivot:'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18m6-18v18',fx:'M3 7h17l-4-4m5 14H4l4 4',trend:'m3 17 6-6 4 3 8-10m-6 0h6v6',bond:'M5 3h14v18H5zM8 8h8m-8 4h8m-8 4h5',fred:'M3 20V4m0 16h18M6 15l4-6 4 3 6-8',replay:'m9 6 10 6-10 6zM4 5v14',network:'M12 3v6M5 15V9h14v6M2 15h6v6H2zm14 0h6v6h-6zM9 1h6v5H9z'};
function icon(key){return '<svg class="history-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="'+(paths[key]||paths.fred)+'"/></svg>';}
const groups=[
 {id:'bonds',label:'Bonds, curves & FX',icon:'curve',items:[
  ['bonds-beta','Bonds BETA','bond','bonds-beta.html'],
  ['bonds-credit','Bonds &amp; credit','bond','v4.html#credit'],
  ['ust-selection','UST selection desk','curve','v4.html#ust'],
  ['yield','Yield history','curve'],
  ['curves','Historical curves','curve'],
  ['fx','FX history','fx']
 ]},
 {id:'shares',label:'Shares',icon:'shares',items:[
  ['stocks-beta','Stocks BETA','shares','stocks-beta.html'],
  ['stocks-beta2','Stocks BETA 2','shares','stocks-beta2.html'],
  ['stocks-beta3','Shares Beta 3 · 10-K filings','bond','stocks-beta3.html'],
  ['nvda-history','NVIDIA Historical','trend','nvda-history.html'],
  ['shares','Share prices','shares'],
  ['si','SI pricing','bond'],
  ['beta2-shares','Event studies','event'],
  ['beta4-shares','History pivot','pivot'],
  ['spx','SPX index','trend'],
  ['si-beta2','SI beta 2','bond','si-beta2.html']
 ]},
 {id:'gold',label:'Gold',icon:'trend',items:[
  ['gold-prices','Gold price history','trend','tools/gold-charts.html']
 ]},
 {id:'fred',label:'Historical FRED',icon:'fred',items:[
  ['fred-dashboard','FRED dashboard','fred','fred/'],
  ['fred-market-desk','V1 Market Desk','fred','fred/market-desk.html'],
  ['fred-risk-observatory','V2 Risk Observatory','trend','fred/risk-observatory.html'],
  ['fred-signal-review','V3 Signal Review','table','fred/signal-review.html'],
  ['fred-cross-market-replay','V4 Cross-Market Replay','replay','fred/cross-market-replay.html'],
  ['fred-data','All tables · σ','pivot','fred/data.html'],
  ['fred-history','FRED history','fred','historical-fred.html'],
  ['fred-1','Fred-1 · Event Replay','replay','fred-1.html'],
  ['fred-2','Fred-2 · Response Matrix','table','fred-2.html'],
  ['fred-3','Fred-3 · Transmission Desk','network','fred-3.html']
 ]}
];
const items=groups.flatMap(g=>g.items.filter(i=>!i[3]).map(i=>[i[0],i[2],i[1]]));
const featured='<a class="history-nav-item history-featured" href="cross-market-history.html" data-history-id="cross-market">'+icon('event')+'<span class="history-link-label">UST, SGS &amp; Stock Market · Beta</span></a>';
function itemHTML(item,current,where){const [id,label,key,external]=item,inside=!external,selected=id===current,attrs=inside&&where!=='home'?'data-tool="tab" data-key="historyTab" data-tab="'+id+'" aria-pressed="'+selected+'"':'';
 const body=icon(key)+'<span class="history-link-label">'+label+'</span>';
 const tone=id==='fx'?' data-nav-tone="blue"':'';
 if(where==='rail')return '<a class="history-nav-item'+(selected?' active':'')+'" href="'+(external||'#history/'+id)+'"'+(inside?' data-view="history/'+id+'"':'')+' data-history-id="'+id+'"'+tone+'>'+body+'</a>';
 if(inside&&where==='toolbar')return '<button type="button" class="history-nav-item'+(selected?' active':'')+'" '+attrs+tone+'>'+body+'</button>';
 return '<a class="history-nav-item" href="'+(external||'v4.html#history/'+id)+'" data-history-id="'+id+'"'+tone+'>'+body+'</a>';
}
function html(){return '<nav class="history-shortcuts history-directory" aria-label="Historical charts">'+featured+groups.map(g=>'<section class="history-directory-group" data-history-group="'+g.id+'"><h3>'+icon(g.icon)+g.label+'</h3><div>'+g.items.map(i=>itemHTML(i,'','home')).join('')+'</div></section>').join('')+'</nav>';}
function sidebar(){return '<div class="rail-group rail-history" role="group" aria-labelledby="rail-group-history"><div class="rail-group-label" id="rail-group-history"><a href="#history" data-view="history">History</a></div>'+featured+groups.map(g=>'<details class="rail-history-section" data-history-group="'+g.id+'"'+(g.id==='bonds'?' open':'')+'><summary>'+icon(g.icon)+'<span>'+g.label+'</span><span class="rail-history-count">'+g.items.length+'</span><svg class="history-menu-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></summary>'+g.items.map(i=>itemHTML(i,'','rail')).join('')+'</details>').join('')+'</div>';}
function toolbar(current){return featured+groups.map(g=>'<details class="history-menu-group" data-history-group="'+g.id+'"'+(g.items.some(i=>i[0]===current)?' data-active-group="true"':'')+'><summary>'+icon(g.icon)+'<span>'+g.label+'</span><svg class="history-menu-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></summary><div class="history-menu-links">'+g.items.map(i=>itemHTML(i,current,'toolbar')).join('')+'</div></details>').join('');}
let lastRoute;
function decorate(){
 for(const slot of document.querySelectorAll('[data-history-shortcuts]'))if(!slot.children.length)slot.innerHTML=html();
 for(const source of document.querySelectorAll('#view .history-tabs:not(.history-menu)')){const current=source.querySelector('[aria-pressed="true"]')?.dataset.tab||'yield';source.classList.add('history-menu');source.innerHTML=toolbar(current);}
 for(const node of document.querySelectorAll('.rail nav a,.rail nav button')){if(node.closest('.rail-group-label'))continue;if(!node.querySelector('.history-nav-icon,.nav-glyph')){const text=[...node.childNodes].find(n=>n.nodeType===3&&n.textContent.trim());if(text){const glyph=document.createElement('span');glyph.className='nav-glyph';glyph.setAttribute('aria-hidden','true');glyph.textContent=text.textContent.trim();text.replaceWith(glyph);}}}
 const active=location.hash.replace(/^#history\/?/,'')||'yield';
 if(lastRoute!==location.hash){const selectedGroup=groups.find(g=>g.items.some(i=>i[0]===active))?.id||'bonds';for(const d of document.querySelectorAll('.rail-history-section'))d.open=d.dataset.historyGroup===selectedGroup;lastRoute=location.hash;}
 for(const a of document.querySelectorAll('.rail-history [data-history-id]')){const yes=location.hash.startsWith('#history')&&a.dataset.historyId===active;a.classList.toggle('active',yes);if(yes)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
}
if(root.document){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',decorate);else decorate();new MutationObserver(decorate).observe(document.documentElement,{childList:true,subtree:true});root.addEventListener('hashchange',decorate);
 document.addEventListener('toggle',e=>{const d=e.target;if(!d.matches?.('.history-menu-group[open]'))return;for(const other of d.parentElement.querySelectorAll('.history-menu-group[open]'))if(other!==d)other.open=false;},true);
 document.addEventListener('click',e=>{for(const d of document.querySelectorAll('.history-menu-group[open]'))if(!d.contains(e.target)||e.target.closest('.history-menu-links a'))d.open=false;});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){const d=document.querySelector('.top-subsections .history-menu-group[open]');if(d){d.open=false;d.querySelector('summary').focus();e.preventDefault();}}});
}
const api={html,items,groups,sidebar,toolbar,icon};root.HistoryNavigation=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
