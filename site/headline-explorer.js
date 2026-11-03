/* Display-only tags: explicit headline terms, not inferred events or recommendations. */
(function(root){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url=s=>{try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password?esc(u.href):'';}catch{return '';}};
const groups={country:'Country / region',bank:'Central bank',sector:'Sector',topic:'Topic / subtopic',person:'People / administration',ticker:'Share ticker'};
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
function card(item,ctx){
 const ts=tags(item), l=lesson(item), source=url(item.url), summary=typeof item.summary==='string'&&item.summary_verified===true&&url(item.summary_source_url)?item.summary:null;
 return '<article class="news-item hx-story"><div class="hx-tags"><span class="hx-chip hx-category">Saved category: '+esc(item.category||'Markets')+'</span>'+ts.map(t=>'<span class="hx-chip hx-'+t.group+'" title="'+esc(t.basis)+'">'+esc(groups[t.group])+': '+esc(t.label)+'</span>').join('')+'</div>'+
 '<a class="hx-title" href="'+(source||'#')+'" target="_blank" rel="noopener noreferrer">'+highlight(String(item.title||'Untitled record'))+'</a><small>'+esc(ctx.time(item))+' · '+esc(item.publisher||'Reuters')+'</small>'+
 '<details class="hx-expand"><summary>Story details &amp; Teach Me</summary><div class="hx-panel"><h4>Plain-English story summary</h4>'+
 (summary?'<p>'+esc(summary)+'</p><a href="'+url(item.summary_source_url)+'" target="_blank" rel="noopener noreferrer">Saved summary source ↗</a>':'<p class="hx-missing">No verified article summary is stored for this headline. Open the original source for details. The headline has not been expanded into invented facts.</p>')+
 '<p><strong>Source coverage:</strong> '+esc(item.verification||'Stored headline metadata; article body not reproduced or newly verified.')+'</p><p><strong>Tags:</strong> navigation aids from explicit headline terms or saved ticker metadata, not a complete article classification or market conclusion.</p>'+
 '<div class="links">'+(item.tickers||[]).map(t=>ctx.stockLink(t)).join('')+(source?'<a href="'+source+'" target="_blank" rel="noopener noreferrer">Open original article ↗</a>':'<span>Source link unavailable</span>')+'</div>'+
 '<details class="hx-teach"><summary>Teach Me: '+esc(l.title)+'</summary><p><strong>General education, not a summary of this article.</strong></p><p>'+esc(l.text)+'</p><p>'+esc(l.example)+'</p>'+l.sources.map(s=>'<a href="'+url(s[1])+'" target="_blank" rel="noopener noreferrer">'+esc(s[0])+' ↗</a>').join(' · ')+'</details></div></details></article>';
}
function rows(items,limit,ctx){return items.slice(0,limit).map(x=>card(x,ctx)).join('')||'<p class="empty">No matching stored headlines. This does not mean no news occurred.</p>';}
function controls(items){
 const all=items.flatMap(tags);
 return '<section class="hx-controls" aria-label="Expanded headline filters"><p>Filter across groups. Labels and text accompany every color. Counts refer to saved headlines, not live wire coverage.</p><div class="hx-filter-grid">'+Object.entries(groups).map(([g,label])=>{
 const values=[...new Set(all.filter(t=>t.group===g).map(t=>t.label))].sort();if(filters[g]&&!values.includes(filters[g]))values.push(filters[g]);
 return '<label>'+label+'<select data-hx-filter="'+g+'"><option value="">All</option>'+values.map(v=>'<option value="'+esc(v)+'"'+(filters[g]===v?' selected':'')+'>'+esc(v)+' ('+items.filter(x=>tags(x).some(t=>t.group===g&&t.label===v)).length+')</option>').join('')+'</select></label>';}).join('')+'</div><button class="button ghost" type="button" data-hx-reset>Reset expanded filters</button><details class="hx-map"><summary>Full category and subtag map</summary><p>Only explicitly matched tags appear on a story. No country is inferred from an exchange or company name. Missing tags mean not identified, not absent from the article.</p><div class="hx-map-grid">'+Object.entries(groups).map(([g,label])=>'<div><strong>'+label+'</strong><p>'+esc(g==='ticker'?'Exchange-aware Morningstar directory; unknown or ambiguous tickers stay unlinked.':rules.filter(r=>r[0]===g).map(r=>r[1]).join(' · '))+'</p></div>').join('')+'</div></details></section>';
}
function connect(callback){onChange=callback;if(root.document){document.addEventListener('change',e=>{const g=e.target.dataset.hxFilter;if(!groups[g])return;filters[g]=e.target.value;onChange();const el=document.querySelector('[data-hx-filter="'+g+'"]');el?.focus();});document.addEventListener('click',e=>{if(e.target.closest('[data-hx-reset]')){filters={};onChange();document.querySelector('[data-hx-reset]')?.focus();}});}}
const api={tags,filtered,highlight,card,rows,controls,connect,lessons,setFilter:(g,v)=>{if(groups[g])filters[g]=v;}};root.HeadlineExplorer=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
