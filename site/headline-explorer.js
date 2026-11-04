/* Display-only tags: explicit headline terms, not inferred events or recommendations. */
(function(root){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url=s=>{try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password?esc(u.href):'';}catch{return '';}};
const groups={category:'Saved category',country:'Country / region',bank:'Central bank',sector:'Sector',topic:'Topic / subtopic',person:'People / administration',ticker:'Share ticker'};
const rules=[
 ['country','US',/\b(?:US|U\.S|United States|American)\b/],
 ['country','Singapore',/\bSingapore(?:an)?\b/i],['country','China',/\bChina|Chinese\b/i],['country','Japan',/\bJapan(?:ese)?\b/i],['country','UK',/\bUK|U\.K|Britain|British|United Kingdom\b/i],['country','Euro area',/\bEurozone|euro area\b/i],['country','Switzerland',/\bSwitzerland|Swiss\b/i],['country','Taiwan',/\bTaiwan(?:ese)?\b/i],['country','India',/\bIndia(?:n)?\b/i],['country','South Korea',/\bSouth Korea(?:n)?\b/i],
 ['bank','Fed',/\b(?:Fed|Federal Reserve|FOMC)\b/i],['bank','MAS',/\bMAS\b|Monetary Authority of Singapore/],['bank','SNB',/\bSNB\b|Swiss National Bank/i],['bank','ECB',/\bECB\b|European Central Bank/i],['bank','BOE',/\bBOE\b|Bank of England/i],['bank','BOJ',/\bBOJ\b|Bank of Japan/i],['bank','PBOC',/\bPBOC\b|People.s Bank of China/i],
 ['sector','Technology',/\btechnology|tech\b/i],['sector','Semiconductors',/\bsemiconductors?|chips?|chipmakers?\b/i],['sector','Financials',/\bbanks?|banking|insurers?|insurance\b/i],['sector','Real estate',/\breal estate|property|properties|REITs?\b/i],['sector','Healthcare',/\bhealthcare|pharma(?:ceutical)?|drugmakers?\b/i],['sector','Energy',/\boil|gas|energy\b/i],['sector','Consumer',/\bretail|retailers?|consumer|shopping\b/i],['sector','Industrials',/\bmanufacturing|industrial|factory|factories\b/i],
 ['topic','Rates',/\binterest rates?|rate cuts?|rate hikes?|borrowing costs?\b/i],['topic','Government bonds',/\bTreasur(?:y|ies)|government bonds?|sovereign debt\b/i],['topic','Corporate credit',/\bcorporate debt|corporate bonds?|credit spreads?\b/i],['topic','Defaults / stress',/\bdefaults?|delinquenc(?:y|ies)|bankrupt(?:cy|cies)|debt stress\b/i],['topic','Housing / mortgages',/\bmortgages?|housing|MBS|home loans?\b/i],['topic','FX',/\bUSD|SGD|CHF|yen|dollar|currenc(?:y|ies)|foreign exchange|forex\b/i],['topic','Inflation',/\binflation|CPI|consumer prices?\b/i],['topic','Jobs',/\bjobs?|employment|unemployment|payrolls?\b/i],['topic','Growth / GDP',/\bGDP|economic growth|recession\b/i],['topic','Earnings',/\bearnings|quarterly|profits?|revenue|EPS\b/i],['topic','Guidance',/\bguidance|outlook|forecasts?\b/i],['topic','AI',/\bAI\b|artificial intelligence/],['topic','Trade / tariffs',/\btariffs?|trade deal|trade war|export controls?\b/i],['topic','Fiscal policy',/\bbudget|fiscal|government spending|tax cuts?\b/i],['topic','Elections',/\belections?|ballots?|voting|midterms?\b/i],['topic','Regulation / courts',/\bregulat(?:ion|or|ors|ory)|courts?|antitrust|lawsuit\b/i],['topic','M&A',/\bmerger|acquisition|takeover\b/i],['topic','Dividends / buybacks',/\bdividends?|buybacks?|share repurchases?\b/i],
 ['person','Trump',/\bTrump\b/i],['person','US Administration',/\bWhite House|US administration|U\.S\. administration\b/i]
];
for(const r of rules){r[2]=new RegExp('(?<![A-Za-z])(?:'+r[2].source+')(?![A-Za-z])',r[2].flags);}
let filters={},onChange=()=>{};
function tags(item){
 const title=String(item.title||''), result=rules.filter(r=>r[2].test(title)).map(r=>({group:r[0],label:r[1],basis:'Headline keyword'}));
 for(const t of Array.isArray(item.tickers)?item.tickers:[]){const r=root.MorningstarLinks?.resolve(t);if(r&&!result.some(x=>x.group==='ticker'&&x.label===r.ticker))result.push({group:'ticker',label:r.ticker,basis:'Saved ticker metadata'});}
 for(const m of root.MorningstarLinks?.matches(title)||[]){if(!result.some(x=>x.group==='ticker'&&x.label===m.record.ticker))result.push({group:'ticker',label:m.record.ticker,basis:'Explicit headline ticker'});}
 if(item.category)result.unshift({group:'category',label:String(item.category),basis:'Saved category metadata'});
 return result;
}
function filtered(items){return items.filter(x=>Object.entries(filters).every(([g,v])=>!v||tags(x).some(t=>t.group===g&&t.label===v)));}
function highlight(title){
 const re=/\b(?:US|Trump|FED|Fed|MAS|FOMC|ECB|SNB|BOE|BOJ|PBOC)\b/g;let out='',pos=0;
 for(const m of String(title).matchAll(re)){out+=esc(title.slice(pos,m.index));const cls=m[0]==='US'?'country':m[0]==='Trump'?'person':'bank';out+='<span class="hx-key hx-'+cls+'">'+esc(m[0])+'</span>';pos=m.index+m[0].length;}
 return out+esc(title.slice(pos));
}
const lessons={
 bank:{title:'Central banks in plain English',text:'The Fed uses monetary policy to pursue maximum employment and stable prices. MAS centres Singapore monetary policy on the trade-weighted exchange rate. These are different frameworks; a MAS decision is not simply a US-style interest-rate decision.',example:'Illustrative question: is this story about the price of borrowing, the currency policy band, or an official commenting? Check the actual decision before treating a speech as a policy change.',sources:[['Federal Reserve','https://www.federalreserve.gov/monetarypolicy.htm'],['MAS','https://www.mas.gov.sg/monetary-policy']]},
 bonds:{title:'Bonds in plain English',text:'A bond is a loan to an issuer. Coupon payments, the amount repaid at maturity and the price you pay are different things. Default risk and changes in market interest rates can affect the result.',example:'Hypothetical example: a bond paying a fixed coupon can become less attractive when new bonds offer more. Its resale price may fall even though its coupon has not changed.',sources:[['SEC Investor.gov: bonds','https://www.investor.gov/introduction-investing/investing-basics/investment-products/bonds-or-fixed-income-products/bonds']]},
 general:{title:'How to read this headline',text:'A headline is a starting point, not the full evidence. Separate what happened from expectations, and check the date, comparison period and original source.',example:'Reading example: “forecasts higher revenue” describes an expectation. It does not mean that the higher revenue has already been earned.',sources:[]}
};
function lesson(item){const ts=tags(item);return ts.some(t=>t.group==='bank')?lessons.bank:ts.some(t=>['Government bonds','Corporate credit','Defaults / stress'].includes(t.label))?lessons.bonds:lessons.general;}
function verifiedContext(item,ctx={}){
 const extra=Array.isArray(ctx.contextData?.items)?ctx.contextData.items.find(x=>x.id===item.id&&x.title===item.title&&x.published_at===item.published_at):null;
 const candidate=extra||item;
 return candidate.summary_verified===true&&typeof candidate.summary==='string'&&candidate.summary.trim()&&url(candidate.summary_source_url)?candidate:null;
}
function tagButton(t){const selected=filters[t.group]===t.label;return '<button type="button" class="hx-chip hx-'+t.group+'" data-hx-tag="'+t.group+'" data-hx-value="'+esc(t.label)+'" aria-pressed="'+selected+'" aria-label="'+esc((selected?'Remove filter: ':'Filter by ')+groups[t.group]+': '+t.label)+'" title="'+esc(groups[t.group]+': '+t.label+' · '+t.basis)+'">'+esc(t.label)+'</button>';}
function activeControls(){const active=Object.entries(filters).filter(([,v])=>v);if(!active.length)return '';return '<div class="hx-active" aria-label="Selected headline filters"><span>Filtered by</span>'+active.map(([g,v])=>'<button type="button" data-hx-clear="'+g+'" aria-label="'+esc('Remove '+groups[g]+': '+v)+'">'+esc(groups[g]+': '+v)+' <span aria-hidden="true">×</span></button>').join('')+'<button type="button" data-hx-reset>Clear tag filters</button></div>';}
function card(item,ctx){
 const ts=tags(item),saved=verifiedContext(item,ctx),source=url(saved?.canonical_url)||url(item.url)||url(saved?.summary_source_url),context=saved&&typeof saved.context==='string'&&saved.context.trim()!==saved.summary.trim()?saved.context.trim():'';
 const sources=saved?(Array.isArray(saved.sources)?saved.sources:[]).filter(x=>url(x.url)):[];
 const original=source?'<a class="hx-original" href="'+source+'" target="_blank" rel="noopener noreferrer">Read original article <span aria-hidden="true">↗</span><span class="sr-only"> (external, new tab)</span></a>':'<span>Original article link unavailable</span>';
 return '<article class="news-item hx-story"><h3 class="hx-headline"><span class="hx-title">'+highlight(String(item.title||'Untitled record'))+'</span></h3><small class="hx-byline">'+esc(ctx.time(item))+' · '+esc(item.publisher||'Reuters')+'</small>'+
 (saved?'<p class="hx-summary">'+esc(saved.summary)+'</p>':'<p class="hx-unavailable">Summary not yet available for this saved headline. Read the original report below.</p>')+
 '<div class="hx-tags" aria-label="Filter by this story’s tags">'+ts.map(tagButton).join('')+'</div>'+
 (context?'<details class="hx-expand"><summary>Read summary &amp; context</summary><div class="hx-panel"><div class="hx-takeaway"><span>Key takeaway · saved context</span><p><strong>'+esc(context)+'</strong></p></div><p class="hx-source-note">Source-checked summary'+(saved.checked_at?' · checked '+esc(saved.checked_at.slice(0,10)):'')+'. Dated reporting, not live market data.</p>'+sources.map(x=>'<p class="hx-source-note"><a href="'+url(x.url)+'" target="_blank" rel="noopener noreferrer">'+esc(x.title||'Summary source')+' ↗</a></p>').join('')+'</div></details>':'')+
 '<div class="links hx-source-links">'+(item.tickers||[]).map(t=>ctx.stockLink(t)).join('')+original+'</div></article>';
}

function rows(items,limit,ctx){return items.slice(0,limit).map(x=>card(x,ctx)).join('')||'<p class="empty">No matching stored headlines. This does not mean no news occurred.</p>';}
function education(){return '<details class="hx-teach"><summary>News-reading guide &amp; topic background</summary><p><strong>General education, not a summary of any article.</strong></p>'+Object.values(lessons).map(l=>'<section><h4>'+esc(l.title)+'</h4><p>'+esc(l.text)+'</p><p>'+esc(l.example)+'</p>'+l.sources.map(x=>'<a href="'+url(x[1])+'" target="_blank" rel="noopener noreferrer">'+esc(x[0])+' ↗</a>').join(' · ')+'</section>').join('')+'</details>';}
function controls(items){
 const all=items.flatMap(tags);
 return '<section class="hx-controls" aria-label="Expanded headline filters"><p>Filter across groups. Labels and text accompany every color. Counts refer to saved headlines, not live wire coverage.</p><div class="hx-filter-grid">'+Object.entries(groups).map(([g,label])=>{
 const values=[...new Set(all.filter(t=>t.group===g).map(t=>t.label))].sort();if(filters[g]&&!values.includes(filters[g]))values.push(filters[g]);
 return '<label>'+label+'<select data-hx-filter="'+g+'"><option value="">All</option>'+values.map(v=>'<option value="'+esc(v)+'"'+(filters[g]===v?' selected':'')+'>'+esc(v)+' ('+items.filter(x=>tags(x).some(t=>t.group===g&&t.label===v)).length+')</option>').join('')+'</select></label>';}).join('')+'</div><button class="button ghost" type="button" data-hx-reset>Reset expanded filters</button><details class="hx-map"><summary>Full category and subtag map</summary><p>Only explicitly matched tags appear on a story. No country is inferred from an exchange or company name. Missing tags mean not identified, not absent from the article.</p><div class="hx-map-grid">'+Object.entries(groups).map(([g,label])=>'<div><strong>'+label+'</strong><p>'+esc(g==='ticker'?'Exchange-aware Morningstar directory; unknown or ambiguous tickers stay unlinked.':rules.filter(r=>r[0]===g).map(r=>r[1]).join(' · '))+'</p></div>').join('')+'</div></details>'+education()+'</section>';
}
function connect(callback){onChange=callback;if(root.document){document.addEventListener('change',e=>{const g=e.target.dataset.hxFilter;if(!groups[g])return;filters[g]=e.target.value;onChange();document.querySelector('[data-hx-filter="'+g+'"]')?.focus({preventScroll:true});});document.addEventListener('click',e=>{
 const tag=e.target.closest('[data-hx-tag]'),clear=e.target.closest('[data-hx-clear]'),reset=e.target.closest('[data-hx-reset]');
 if(tag&&groups[tag.dataset.hxTag]){const g=tag.dataset.hxTag,v=tag.dataset.hxValue;filters[g]=filters[g]===v?'':v;onChange();(document.querySelector('[data-hx-clear="'+g+'"]')||document.querySelector('[data-news-filter].active')||document.querySelector('[data-hx-filter="'+g+'"]'))?.focus({preventScroll:true});document.querySelector('#headline-page-status')?.scrollIntoView({block:'start'});}
 else if(clear&&groups[clear.dataset.hxClear]){delete filters[clear.dataset.hxClear];onChange();(document.querySelector('[data-hx-clear]')||document.querySelector('[data-news-filter].active'))?.focus({preventScroll:true});}
 else if(reset){filters={};onChange();(document.querySelector('[data-news-filter].active')||document.querySelector('[data-hx-reset]'))?.focus({preventScroll:true});}
 });}}

const api={tags,filtered,highlight,card,rows,controls,activeControls,verifiedContext,connect,lessons,setFilter:(g,v)=>{if(groups[g])filters[g]=v;}};root.HeadlineExplorer=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
