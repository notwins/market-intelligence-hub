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
 for(const tag of input.tags||[]){const key=data.tag_map[tag]||data.label_map[norm(tag)];if(key)add(key);else if(resolve(tag,data))add(tag);else{const company=data.companies.find(c=>c.names.some(name=>norm(name)===norm(tag)));if(company)add(company.ticker);}}
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
 return '<span class="mih-company-logos" data-logo-group="1" data-no-ticker-links style="--company-logo-size:'+([20,24,28,32,40].includes(size)?size:24)+'px">'+companies.map(c=>'<span class="mih-company-logo" data-logo-company="'+E(c.ticker)+'" role="img" aria-label="'+E(c.name)+' logo" title="'+E(c.name)+'"><img src="'+E(base+c.file)+'" alt="" width="64" height="64" loading="lazy" decoding="async"><span class="mih-logo-fallback" aria-hidden="true" hidden>'+E(c.ticker.slice(0,4))+'</span></span>').join('')+'</span>';
}
const api={canonical,resolve,infer,html};root.CompanyLogos=api;if(typeof module!=='undefined')module.exports=api;
if(!root.document)return;
const doc=root.document,script=doc.currentScript?.src;if(!script)return;
const assetBase=new URL('assets/company-logos/',script).href;
// UI card families, including plain article cards and nested Reuters/timeline rows.
// A card may only use its own identity: never borrow a descendant card's heading.
const selector='article,.card,.news-item,.watch-mini,.instrument[data-company],.latest-quick-card,.featured-research,.company-news-item,.er-company,.mp-card,.publication-entry,.gs-result,.watchlist-teaser,.ci-row,.sl-series-card,.sl-card,.result,.catalog-row,.security-row,tr[data-logo-ticker]';
let data,observer,scheduled=false;const fingerprints=new WeakMap();
const values=(node,key)=>{try{const v=JSON.parse(node.dataset[key]||'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string'):[];}catch{return [];}};
function own(card,query){return Array.from(card.querySelectorAll(query)).filter(n=>n.closest(selector)===card&&!n.closest('[data-logo-group]'));}
const jacketReview = "https://notwins.github.io/market-intelligence-content/research/standalone-risk-inside-the-jacket-2026-11-18/";
function relatedReview(card, names) {
 const footer = card.querySelector(':scope > .mih-related-review');
 if (!names.includes('NVDA') || card.matches('tr,a,button,.news-item,.company-news-item') || card.closest('a,button')) {
  footer?.remove();
  return;
 }
 if (footer) return;
 if (card.parentElement?.closest('article[data-company="NVDA"],article[data-ticker="NVDA"],article[data-stock="NVDA"]')) return;
 const listing = !card.matches('[data-stock],[data-company],[data-ticker],[data-price-symbol],.company-news-card,.watchlist-card');
 if (listing && [...card.querySelectorAll('a[href]')].some(a => a.href.replace(/index\.html$/, '') === jacketReview)) return;
 const box = doc.createElement('div');
 box.className = 'mih-related-review';
 const a = doc.createElement('a');
 a.href = jacketReview;
 a.textContent = 'My Thoughts · The Risk Inside the Jacket';
 box.append(a);
 card.append(box);
}
function enhance(card){
 const heading=own(card,'h1,h2,h3,h4,h5,h6,.company-news-title,.gs-copy>strong,.security-title,.security b,.sl-share strong,.mp-quote>div>strong,.ci-identity>b,.instrument-head strong')[0]||own(card,':scope > a')[0];
 const tags=[...values(card,'mihTags'),card.dataset.mihTag||''];
 for(const node of own(card,'.mu-card-tags [data-mih-tag],.tags [data-mih-tag],.result-tags [data-mih-tag],.search-tags [data-mih-tag],.bs-identity[data-mih-tag],.er-company-chip[data-mih-tag]'))tags.push(node.dataset.mihTag);
 for(const node of own(card,'.mu-card-tag,.tags .tag,.result-tags .tag-button,.search-tags .tag-button'))tags.push(node.textContent);
 const tickers=values(card,'mihTickers');
 for(const key of ['ticker','stock','company','companyTicker','priceSymbol','logoTicker'])if(card.dataset[key])tickers.push(card.dataset[key]);
 for(const node of own(card,'.ticker,.bs-identity,.er-company-chip,[data-quote]'))tickers.push(node.dataset.quote||node.textContent.trim());
 if(card.classList.contains('ed-company')&&card.id.startsWith('earnings-'))tickers.push(card.id.slice(9));
 const companyCard=card.matches('.watchlist-card[data-ticker],.ed-company,.company-news-card,.company-card,.instrument[data-company],.watch-mini,.er-company,.bs-card,.sl-card,.sl-series-card,.catalog-row,.security-row,.mp-card,.ci-row,.er-range-card,tr[data-logo-ticker]');
 const target=companyCard?(own(card,'.watchlist-card-head,header,.company-top,.er-company-heading,.security>div,.sec-name,.mp-quote>div,.ci-identity,:scope > td:first-child')[0]||heading?.parentElement||card):
   own(card,':scope > .meta,:scope > .mu-eyebrow,:scope > .featured-date,:scope > .date,:scope > small,:scope > time,:scope > .eyebrow,:scope > .watchlist-label,.company-news-meta,.publication-meta,.gs-date,.result-date,.sr-card-top')[0]||null;
 const fingerprint=JSON.stringify([tickers,tags,heading?.textContent||'',companyCard]);
 const prior=fingerprints.get(card);
 if(prior?.fingerprint===fingerprint&&prior.target===target&&(!prior.group||prior.group.isConnected)){relatedReview(card,prior.names);return;}
 let names=infer({tickers,tags,title:heading?.textContent||''},data);
 // A chart embedded in an already identified company card needs no repeated badge.
 if(card.matches('.mp-card,.er-range-card')&&card.parentElement?.closest('.watchlist-card,.company-card,.ed-company,.instrument,.er-company'))names=[];
 // Remove only badge groups owned by this card.
 for(const node of card.querySelectorAll('[data-logo-group]'))if(node.closest(selector)===card)node.remove();
 card.classList.toggle('mih-has-company-logo',names.length>0);
 let group=null;
 if(names.length){
  const compact=card.matches('.watch-mini,.company-news-item,.gs-result,.publication-entry,.ci-row,.security-row,.catalog-row,tr[data-logo-ticker]');
  const template=doc.createElement('template');template.innerHTML=html(names,data,{size:compact?24:companyCard?32:28,base:assetBase});
  group=template.content.firstElementChild;
  for(const img of group.querySelectorAll('img'))img.addEventListener('error',()=>{img.hidden=true;img.nextElementSibling.hidden=false;img.parentElement.classList.add('mih-logo-unavailable');},{once:true});
  if(companyCard){group.classList.add('mih-company-avatar');target.prepend(group);}
  else if(target){target.classList.add('mih-logo-metadata');target.append(group);}
  else if(heading){group.classList.add('mih-article-logos');heading.insertAdjacentElement('afterend',group);}
  else{group.classList.add('mih-article-logos');card.prepend(group);}
 }
 if(card.matches('.hourly-story')&&heading&&!card.querySelector(':scope > .mih-logo-source')){
  const source=doc.createElement('span');source.className='mih-logo-source';source.textContent='Reuters';heading.before(source);
 }
 relatedReview(card,names);
 fingerprints.set(card,{fingerprint,target,group,names});
}
function scan(){scheduled=false;observer?.disconnect();try{doc.querySelectorAll(selector).forEach(enhance);}finally{observer?.observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-ticker','data-company','data-price-symbol','data-mih-tag','data-mih-tickers','data-mih-tags']});}}
function schedule(records){if(records?.length&&records.every(r=>r.target.nodeType===1&&r.target.closest?.('[data-logo-group]')))return;if(!scheduled){scheduled=true;root.requestAnimationFrame(scan);}}
async function start(){try{const response=await root.fetch(new URL('company-logos.json',assetBase));if(!response.ok)return;data=await response.json();if(data.schema_version!==1||data.companies.length!==150)return;api.data=data;api.refresh=schedule;observer=new MutationObserver(schedule);scan();}catch{/* Logo failure must never hide cards or interrupt the content reader. */}}
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(typeof window!=='undefined'?window:globalThis);
