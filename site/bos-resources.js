/* Link-out references only. No publisher tables, ratings or research reproduced. */
(function(root){
'use strict';
const sources=[
{"id":"bos-equities-20261103","kind":"equities","title":"BOS Equity Coverage Universe","edition":"3 November 2026","date":"2026-11-03","url":"https://productgroup.bankofsingapore.com/equities_research/2026-11-03_equity_coverage_universe.pdf","scope":"Original equity coverage document. Publisher opinions and classifications remain in the original PDF."},
{"id":"bos-bonds-20261104","kind":"bonds","title":"BOS multicurrency Bond List","edition":"4 November 2026","date":"2026-11-04","url":"https://productgroup.bankofsingapore.com/fixed_income_research/Daily_Price/Bond_List-04_Nov_2026.pdf","scope":"Multicurrency fixed-income list, including SGD. Check each instrument’s currency and terms in the original PDF."},
{"id":"ocbc-credit-20261104","kind":"bonds","title":"OCBC Credit Research List · BOS-hosted","edition":"4 November 2026","date":"2026-11-04","url":"https://productgroup.bankofsingapore.com/fixed_income_research/Daily_Price/BOS-OCBC%20bond%20list-04_Nov_2026.pdf","scope":"The list has no currency field. It is not labelled here as an exclusively SGD universe."}
];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function cards(kind='all'){
 const list=sources.filter(s=>kind==='all'||s.kind===kind);
 return '<section class="section" aria-label="BOS and OCBC original source documents"><div class="eyebrow">Original publisher documents · external PDFs</div><h2>BOS &amp; OCBC research references</h2><p class="muted">Dated links, checked against the identified editions. These are not automatically updated daily links. Prices, where shown, are indicative previous-business-day observations, not executable or live quotes. Check each PDF’s price basis and timestamp.</p><div class="grid">'+list.map(s=>'<article class="card"><div class="tags"><span class="tag">'+esc(s.kind==='equities'?'Equities':'Fixed income')+'</span><span class="tag">PDF edition · '+esc(s.edition)+'</span></div><h3>'+esc(s.title)+'</h3><p>'+esc(s.scope)+'</p><a class="button" href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">Open original PDF ↗</a></article>').join('')+'</div><p class="body-note">Opens the publisher’s document in a new tab; access conditions may apply. No PDF copies, tables, MSCI ESG data or publisher opinions are hosted here.</p></section>';
}
const api={sources,cards};root.BOSResources=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
