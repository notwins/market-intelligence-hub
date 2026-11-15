/* Shared company identity decoration. Presentation only; no feed/report mutation. */
(function(root){'use strict';
const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=value=>String(value||'').normalize('NFKC').trim().toLowerCase();
const boundary=(text,term)=>new RegExp('(^|[^\\p{L}\\p{N}_])'+term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=$|[^\\p{L}\\p{N}_])','iu').test(text);
function canonical(value,data){const key=String(value||'').trim().toUpperCase();return data.aliases[key]||key;}
function resolve(value,data){const key=canonical(value,data);return data.companies.find(c=>c.ticker===key)||null;}
function infer(input,data){
 const found=[];const add=value=>{const c=resolve(value,data);if(c&&!found.includes(c.ticker))found.push(c.ticker);};
 for(const value of input.tickers||[])add(value);
 for(const tag of input.tags||[]){const key=data.tag_map[tag]||data.label_map[norm(tag)];if(key)add(key);else if(resolve(tag,data))add(tag);}
 const title=String(input.title||'');
 // The local-bank basket is a deliberate editorial mapping, not a generic STI proxy.
 if(/\b(?:STI|Singapore|SG|local)\b.{0,35}\bbanks?\b|\bbanks?\b.{0,35}\b(?:STI|Singapore)\b/i.test(title)||
    (input.tags||[]).some(t=>['sti banks','singapore banks','three local banks'].includes(norm(t))))['D05.SI','O39.SI','U11.SI'].forEach(add);
 for(const c of data.companies){
  if(c.names.some(name=>boundary(title,name)))add(c.ticker);
  // Short ambiguous tickers (C, V, U, SE, MA...) are accepted only as metadata or $/bracket tokens.
  for(const ticker of [c.ticker,...(c.aliases||[])]){
   if(title.includes('$'+ticker)&&boundary(title,'$'+ticker)||new RegExp('\\('+ticker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\)').test(title))add(c.ticker);
   else if(ticker.length>=4&&ticker===ticker.toUpperCase()&&boundary(title,ticker)&&title.includes(ticker))add(c.ticker);
  }
 }
 return found;
}
function html(tickers,data,{size=24,base='assets/company-logos/'}={}){
 const companies=[...new Set(tickers)].map(t=>resolve(t,data)).filter(Boolean);
 if(!companies.length)return '';
 return '<span class="mih-company-logos" data-logo-group="1" style="--company-logo-size:'+([20,24,28,32,40].includes(size)?size:24)+'px">'+companies.map(c=>'<span class="mih-company-logo" data-logo-company="'+E(c.ticker)+'" role="img" aria-label="'+E(c.name)+' logo" title="'+E(c.name)+'"><img src="'+E(base+c.file)+'" alt="" width="64" height="64" loading="lazy" decoding="async"><span class="mih-logo-fallback" aria-hidden="true" hidden>'+E(c.ticker.slice(0,4))+'</span></span>').join('')+'</span>';
}
const api={canonical,resolve,infer,html};root.CompanyLogos=api;if(typeof module!=='undefined')module.exports=api;
if(!root.document)return;
const doc=root.document,script=doc.currentScript?.src;if(!script)return;
const assetBase=new URL('assets/company-logos/',script).href;
const selector='.report-card,.archive-card,.mu-writeup,.hourly-story,.news-card,.watchlist-card,.ed-company,.company-news-card,.instrument[data-company],.watch-mini,.latest-quick-card,.featured-research,.company-news-item,.er-company';
let data,observer,scheduled=false;const fingerprints=new WeakMap();
const values=(node,key)=>{try{const v=JSON.parse(node.dataset[key]||'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string'):[];}catch{return [];}};
function enhance(card){
 const heading=card.querySelector('h2,h3,h4,.company-news-title')||card.querySelector('.instrument-head strong')||card.querySelector('a');
 const tags=[...values(card,'mihTags'),...Array.from(card.querySelectorAll(':scope > .mu-card-tags [data-mih-tag],:scope > .tags [data-mih-tag]'),n=>n.dataset.mihTag),...Array.from(card.querySelectorAll(':scope > .mu-card-tags .mu-card-tag,:scope > .tags .tag'),n=>n.textContent)];
 const ticker=card.dataset.ticker||card.dataset.company||card.dataset.companyTicker;
 const tickers=values(card,'mihTickers');if(ticker)tickers.unshift(ticker);
 if(card.classList.contains('ed-company')&&card.id.startsWith('earnings-'))tickers.unshift(card.id.slice(9));
 if(card.classList.contains('watch-mini')){const q=card.querySelector('[data-quote]');if(q)tickers.unshift(q.dataset.quote);}
 const names=infer({tickers,tags,title:heading?.textContent||''},data);
 const companyCard=card.matches('.watchlist-card[data-ticker],.ed-company,.company-news-card,.instrument[data-company],.watch-mini,.er-company');
 const target=companyCard?(card.querySelector('.watchlist-card-head,header,.er-company-heading')||card):
   card.querySelector(':scope > .meta,:scope > .mu-eyebrow,:scope > .featured-date,:scope > .date,:scope > small,:scope > time,.company-news-meta')||null;
 const fingerprint=JSON.stringify([names,companyCard,!!target]);
 if(fingerprints.get(card)===fingerprint&&(!names.length||card.querySelector('[data-logo-group]')))return;
 for(const node of card.querySelectorAll('[data-logo-group]'))if(node.closest(selector)===card)node.remove();
 card.classList.toggle('mih-has-company-logo',names.length>0);
 if(names.length){
  const template=doc.createElement('template');template.innerHTML=html(names,data,{size:card.matches('.watch-mini,.company-news-item')?24:companyCard?40:28,base:assetBase});
  const group=template.content.firstElementChild;
  for(const img of group.querySelectorAll('img'))img.addEventListener('error',()=>{img.hidden=true;img.nextElementSibling.hidden=false;img.parentElement.classList.add('mih-logo-unavailable');},{once:true});
  if(companyCard){group.classList.add('mih-company-avatar');target.prepend(group);}
  else if(target){target.classList.add('mih-logo-metadata');target.append(group);}
  else{group.classList.add('mih-article-logos');heading?.insertAdjacentElement('afterend',group);}
 }
 if(card.matches('.hourly-story')&&heading&&!card.querySelector(':scope > .mih-logo-source')){
  const source=doc.createElement('span');source.className='mih-logo-source';source.textContent='Reuters';heading.before(source);
 }
 fingerprints.set(card,fingerprint);
}
function scan(){scheduled=false;observer?.disconnect();try{doc.querySelectorAll(selector).forEach(enhance);}finally{observer?.observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-ticker','data-company','data-mih-tickers','data-mih-tags']});}}
function schedule(records){if(records?.length&&records.every(r=>r.target.nodeType===1&&r.target.closest?.('[data-logo-group]')))return;if(!scheduled){scheduled=true;root.requestAnimationFrame(scan);}}
async function start(){try{const response=await root.fetch(new URL('company-logos.json',assetBase));if(!response.ok)return;data=await response.json();if(data.schema_version!==1||data.companies.length!==150)return;api.data=data;api.refresh=schedule;observer=new MutationObserver(schedule);scan();}catch{/* Logo failure must never hide cards or interrupt the content reader. */}}
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(typeof window!=='undefined'?window:globalThis);
