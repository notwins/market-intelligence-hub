/* Link-out references only. No publisher tables, ratings or research reproduced. */
(function(root){
'use strict';
const sources=[
{"id":"bos-equities-20261120","kind":"equities","title":"BOS Equity Coverage Universe","edition":"20 November 2026","date":"2026-11-20","url":"https://productgroup.bankofsingapore.com/equities_research/2026-11-20_equity_coverage_universe.pdf","scope":"Original equity coverage document. Publisher opinions and classifications remain in the original PDF."},
{"id":"bos-bonds-20261120","kind":"bonds","title":"BOS multicurrency Bond List","edition":"20 November 2026","date":"2026-11-20","url":"https://productgroup.bankofsingapore.com/fixed_income_research/Daily_Price/Bond_List-20_Nov_2026.pdf","scope":"Multicurrency fixed-income list, including SGD. Check each instrument’s currency and terms in the original PDF."},
{"id":"ocbc-credit-20261120","kind":"bonds","title":"OCBC Credit Research List · BOS-hosted","edition":"20 November 2026","date":"2026-11-20","url":"https://productgroup.bankofsingapore.com/fixed_income_research/Daily_Price/BOS-OCBC%20bond%20list-20_Nov_2026.pdf","scope":"The list has no currency field. It is not labelled here as an exclusively SGD universe."}
];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const companyReports=[
{"ticker":"AAPL","company":"Apple Inc.","url":"https://productgroup.bankofsingapore.com/apollo/assets/reports/morningstar/apollo/2026/Nov/0P000000GY_20261102_RT.pdf","report_date":"2026-11-03","edition":"2026-11-20"},
{"ticker":"MSFT","company":"Microsoft Corporation","url":"https://productgroup.bankofsingapore.com/apollo/assets/reports/morningstar/apollo/2026/Oct/0P000003MH_20261029_RT.pdf","report_date":"2026-10-29","edition":"2026-11-20"},
{"ticker":"NVDA","company":"NVIDIA Corporation","url":"https://productgroup.bankofsingapore.com/apollo/assets/reports/morningstar/apollo/2026/Nov/0P000003RE_20261118_RT.pdf","report_date":"2026-11-18","edition":"2026-11-20"},
{"ticker":"GOOGL","company":"Alphabet Inc.","url":"https://productgroup.bankofsingapore.com/apollo/assets/reports/morningstar/apollo/2026/Oct/0P000002HD_20261029_RT.pdf","report_date":"2026-10-29","edition":"2026-11-11"},
{"ticker":"AMZN","company":"Amazon.com, Inc.","url":"https://productgroup.bankofsingapore.com/apollo/assets/reports/morningstar/apollo/2026/Nov/0P000000B7_20261103_RT.pdf","report_date":"2026-11-04","edition":"2026-11-20"},
{"ticker":"META","company":"Meta Platforms, Inc.","url":"https://productgroup.bankofsingapore.com/apollo/assets/reports/morningstar/apollo/2026/Nov/0P0000W3KZ_20261104_RT.pdf","report_date":"2026-11-04","edition":"2026-11-20"},
{"ticker":"BRK.B","company":"Berkshire Hathaway Inc.","url":"https://productgroup.bankofsingapore.com/apollo/assets/reports/morningstar/apollo/2026/Nov/0P000000RD_20261117_RT.pdf","report_date":"2026-11-17","edition":"2026-11-20"},
{"ticker":"AMD","company":"Advanced Micro Devices, Inc.","url":"https://productgroup.bankofsingapore.com/apollo/assets/reports/morningstar/apollo/2026/Nov/0P0000006A_20261109_RT.pdf","report_date":"2026-11-10","edition":"2026-11-20"},
{"ticker":"AVGO","company":"Broadcom Inc.","url":"https://productgroup.bankofsingapore.com/apollo/assets/reports/morningstar/apollo/2026/Oct/0P0000KU35_20261027_RT.pdf","report_date":"2026-10-27","edition":"2026-11-20"},
{"ticker":"MU","company":"Micron Technology, Inc.","url":"https://productgroup.bankofsingapore.com/apollo/assets/reports/morningstar/apollo/2026/Nov/0P000003MC_20261102_RT.pdf","report_date":"2026-11-03","edition":"2026-11-20"},
{"ticker":"TSLA","company":"Tesla, Inc.","url":"https://productgroup.bankofsingapore.com/apollo/assets/reports/morningstar/apollo/2026/Nov/0P0000OQN8_20261112_RT.pdf","report_date":"2026-11-12","edition":"2026-11-20"},
{"ticker":"TSM","company":"Taiwan Semiconductor Manufacturing Company Limited","url":"https://productgroup.bankofsingapore.com/apollo/assets/reports/morningstar/apollo/2026/Nov/0P000005AR_20261110_RT.pdf","report_date":"2026-11-11","edition":"2026-11-20"},
{"ticker":"BABA","company":"Alibaba Group Holding Limited","edition":"2026-11-20","report_date":"2026-11-10","url":"https://productgroup.bankofsingapore.com/apollo/assets/reports/morningstar/apollo/2026/Nov/0P00013K81_20261110_RT.pdf"}
];
const keys = ['equity', 'bonds', 'credit'];
const feedURL = 'https://raw.githubusercontent.com/notwins/market-intelligence-hub/market-prices/publisher-documents/latest.json';
const publisher = 'https://productgroup.bankofsingapore.com/';
const dateFormat = new Intl.DateTimeFormat('en-GB', {day:'numeric', month:'long', year:'numeric', timeZone:'UTC'});
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
const editionLabel = date => dateFormat.format(new Date(date+'T12:00:00Z'));
const month = new Intl.DateTimeFormat('en-GB', {month:'short', timeZone:'UTC'});
function expectedURL(key, date) {
  if (key === 'equity') return publisher+'equities_research/'+date+'_equity_coverage_universe.pdf';
  const stamp = date.slice(8)+'_'+month.format(new Date(date+'T12:00:00Z')).slice(0,3)+'_'+date.slice(0,4);
  const prefix = key === 'bonds' ? 'Bond_List-' : 'BOS-OCBC%20bond%20list-';
  return publisher+'fixed_income_research/Daily_Price/'+prefix+stamp+'.pdf';
}
let current = {sources, companyReports}, pending;
function decode(data) {
  if (data?.schemaVersion !== 1 || !data.reports || !Object.keys(data.reports).length)
    throw Error('Publisher links unavailable');
  const nextSources = keys.map((key, i) => {
    const doc = data.documents?.[key];
    if (!validDate(doc?.date) || doc.url !== expectedURL(key, doc.date)) throw Error('Invalid publisher edition');
    return {...sources[i], date:doc.date, edition:editionLabel(doc.date), url:doc.url,
      id:sources[i].id.replace(/\d{8}$/, doc.date.replaceAll('-',''))};
  });
  const nextReports = [];
  for (const {ticker, company} of companyReports) {
    const row = data.reports[ticker];
    if (!row) continue;
    if (!validDate(row.report_date) || !validDate(row.edition) || row.report_date > row.edition
      || row.edition > nextSources[0].date || !/^https:\/\/productgroup\.bankofsingapore\.com\/apollo\/assets\/reports\/morningstar\/apollo\/\d{4}\/[A-Za-z]{3}\/[\w.-]+\.pdf$/.test(row.url))
      throw Error('Invalid company report');
    nextReports.push({ticker, company, url:row.url, report_date:row.report_date, edition:row.edition});
  }
  if (!nextReports.length) throw Error('No verified company reports');
  return {sources:nextSources, companyReports:nextReports};
}
function refresh() {
  if (pending) return pending;
  pending = (async () => {
    try {
      const response = await root.fetch(feedURL, {cache:'no-store'});
      if (!response.ok) return;
      const next = decode(await response.json());
      if (JSON.stringify(next) === JSON.stringify(current)) return;
      current = next;
      for (const section of root.document?.querySelectorAll('[data-bos-resources]') || [])
        section.outerHTML = cards(section.dataset.bosResources);
      if (root.document?.getElementById('earnings-desk')) root.EarningsDesk?.mount();
    } catch { /* Retain the last verified editions and their source dates. */ }
  })().finally(() => { pending = null; });
  return pending;
}
function reportFor(ticker) { return current.companyReports.find(row => row.ticker === ticker); }
function priorEdition(report) {
  return report.edition < current.sources[0].date ? ' · from '+editionLabel(report.edition)+' universe' : '';
}
function cards(kind='all'){
 const list=current.sources.filter(s=>kind==='all'||s.kind===kind);
 return '<section class="section" data-bos-resources="'+esc(kind)+'" aria-label="BOS and OCBC original source documents"><div class="eyebrow">Original publisher documents · external PDFs</div><h2>BOS &amp; OCBC source documents</h2><div class="grid">'+list.map(s=>'<article class="card"><div class="tags"><span class="tag">'+esc(s.kind==='equities'?'Equities':'Fixed income')+'</span><span class="tag">PDF edition · '+esc(s.edition)+'</span></div><div class="bos-subject"><h3>'+esc(s.title)+'</h3><a class="button ghost" href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">Open original PDF · External ↗</a></div><p>'+esc(s.scope)+'</p>'+(s.kind==='equities'?'<div class="bos-company-links">'+current.companyReports.map(r=>'<a href="'+esc(r.url)+'" target="_blank" rel="noopener noreferrer"><b>'+esc(r.ticker)+' · '+esc(r.company)+'</b><small>Morningstar / BOS · report '+esc(r.report_date)+esc(priorEdition(r))+' · external PDF ↗</small></a>').join('')+'</div><p class="body-note">Company report dates come from the linked PDFs. Earlier coverage editions are identified where used.</p>':'')+'</article>').join('')+'</div><p class="body-note">Editions checked daily. Prices are indicative previous-business-day observations, not executable quotes. Publisher access conditions apply; no research PDFs or ratings are reproduced.</p></section>';
}
const api={get sources(){return current.sources;},get companyReports(){return current.companyReports;},cards,refresh,reportFor,priorEdition};root.BOSResources=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
