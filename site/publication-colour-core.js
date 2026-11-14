/* Publication colour rules v1. Pure functions; no network, storage or overlays. */
(function(root){'use strict';
const HUB='https://notwins.github.io/market-intelligence-hub/';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rx=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const word=c=>!!c&&/[\p{L}\p{N}_]/u.test(c);
const financial=/\b(?:shares?|stocks?|bonds?|equity|equities|earnings|revenue|issuer|investors?|dividend|securities|market capitalisation|market capitalization|NASDAQ|NYSE|SGX|HKEX)\b/i;
const valid=t=>t&&typeof t.label==='string'&&t.label.length<=240&&['text','background','dark_text','dark_background'].every(k=>/^#[0-9a-f]{6}$/i.test(t[k]));
function index(c){if(c?.version!==1||!Array.isArray(c.tags))throw Error('Unsupported colour rules');return Object.fromEntries(c.tags.filter(valid).map(t=>[t.id,t]));}
function searchHref(t){return HUB+'search.html?q='+encodeURIComponent('tag:"'+t.label.replace(/["\\]/g,'\\$&')+'"');}
function link(t,token,c){
 const u=c?.securities?.[token];
 if(u&&/^(NASDAQ|NYSE|SGX|HKEX):[A-Z0-9.]+$/.test(token)&&/^https:\/\/www\.morningstar\.com\/stocks\/[a-z0-9/.-]+$/i.test(u))return u;
 return searchHref(t);
}
function matches(text,c){
 const candidates=[];
 for(const t of Object.values(index(c)))for(const a of t.aliases||[]){
  if(!a.text)continue;
  const re=new RegExp(rx(a.text),a.case_sensitive?'gu':'giu');let m;
  while((m=re.exec(text))){
   const start=m.index,end=start+m[0].length;
   if(word(text[start-1])||word(text[end]))continue;
   if(t.category==='Companies / tickers'&&!/^(NASDAQ|NYSE|SGX|HKEX):/.test(m[0])&&!financial.test(text.slice(Math.max(0,start-100),end+100)))continue;
   candidates.push({id:t.id,start,end,text:m[0],priority:t.priority||0});
  }
 }
 candidates.sort((a,b)=>(b.end-b.start)-(a.end-a.start)||b.priority-a.priority||a.start-b.start||a.id.localeCompare(b.id));
 const chosen=[];
 for(const m of candidates){
  if(candidates.some(n=>n.id!==m.id&&n.start===m.start&&n.end===m.end&&n.priority===m.priority))continue;
  if(!chosen.some(n=>m.start<n.end&&n.start<m.end))chosen.push(m);
 }
 return chosen.sort((a,b)=>a.start-b.start||b.end-a.end);
}
function infer(text,c,existing=[]){
 const tags=index(c),ids=[...new Set(existing)].filter(id=>tags[id]);
 for(const m of matches(text,c))if(ids.length<5&&!ids.includes(m.id))ids.push(m.id);
 return ids;
}
function style(t){return `--tag-text:${t.text};--tag-bg:${t.background};--tag-dark-text:${t.dark_text};--tag-dark-bg:${t.dark_background}`;}
function chip(id,t){return `<a class="mu-card-tag mih-colour-chip" data-mih-tag="${escape(id)}" style="${style(t)}" href="${escape(searchHref(t))}">${escape(t.label)}</a>`;}
function chips(ids,tags){
 const values=[...new Set(ids)].filter(id=>valid(tags[id]));
 const first=values.slice(0,5).map(id=>chip(id,tags[id])).join('');
 return first+(values.length>5?`<details class="mih-more-tags"><summary>+${values.length-5} tags</summary>${values.slice(5).map(id=>chip(id,tags[id])).join('')}</details>`:'');
}
function highlighted(text,ids,c,limit=3){
 const tags=index(c),seen=new Set();let html='',last=0,n=0;
 for(const m of matches(text,c)){
  if(n>=limit||!ids.includes(m.id)||seen.has(m.id))continue;
  const t=tags[m.id];html+=escape(text.slice(last,m.start))+`<a class="mih-colour-term" data-mih-tag="${escape(m.id)}" style="${style(t)}" href="${escape(link(t,m.text,c))}">${escape(m.text)}</a>`;
  seen.add(m.id);last=m.end;n++;
 }
 return html+escape(text.slice(last));
}
const api={version:1,HUB,escape,valid,index,searchHref,link,matches,infer,style,chip,chips,highlighted};
root.PublicationColour=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
