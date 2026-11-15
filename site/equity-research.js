/* Dated valuation evidence and issuer actuals. Selection and prices belong to the shared workbench. */
(function(root){'use strict';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const number=value=>finite(value)?String(value):'Unavailable';
const usdBillions=value=>finite(value)?'US$'+String(value)+'bn':'Unavailable';
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
const safeUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}};
const instances=new WeakMap(),views=new Map(),colourEntries=new Set();
let colourCatalogue=null,colourTags={},colourRequest=null,colourAttempted=false;
const initialView=()=>({mode:'timeline',focus:'',window:'all',edition:'',metric:'pe'});
const rangeMetrics={pe:{label:'Forward P/E',unit:'times'},pb:{label:'Forward P/B',unit:'times'},dividend_yield_pct:{label:'Forward dividend yield',unit:'%'}};
function viewState(key){if(!key)return initialView();if(!views.has(key)){views.set(key,initialView());while(views.size>8)views.delete(views.keys().next().value);}return views.get(key);}
const unavailable=message=>`<p class="er-empty">${esc(message)}</p>`;
const sourceNumber=(row,key)=>row&&finite(row[key])?esc(row.source_values?.[key]??number(row[key])):'Unavailable';
function sourceLink(source){const href=safeUrl(source?.url);return href?`<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(source.title||'Original issuer source')} ↗</a>`:esc(source?.title||'Source unavailable');}
// Reuse the Hub's approved identity catalogue. An absent or ambiguous match stays neutral.
function companyIdentity(symbol,listing,catalogue=colourCatalogue){
 try{
  const C=root.PublicationColour;if(!C||typeof symbol!=='string'||!symbol||!catalogue)return null;
  const tags=catalogue===colourCatalogue?colourTags:C.index(catalogue),tokens=catalogue.explicit_company_tokens||{};
  const identity=id=>{const tag=tags[id];return tag?.category==='Companies / tickers'&&C.valid(tag)?{id,style:C.style(tag)}:null;};
  if(Object.hasOwn(tokens,symbol))return identity(tokens[symbol]);
  const registered=root.MarketPrices?.resolve?.(symbol),aliases=Array.isArray(registered?.aliases)?registered.aliases:[];
  const ids=[...new Set(aliases.filter(alias=>typeof alias==='string'&&Object.hasOwn(tokens,alias)).map(alias=>tokens[alias]))];
  if(ids.length)return ids.length===1?identity(ids[0]):null;
  const names=[...new Set([listing?.symbol===symbol?listing.name:null,registered?.name].filter(name=>typeof name==='string'&&name.trim()))];
  const matches=[...new Set(names.flatMap(name=>C.matches(name+' shares',catalogue)).filter(match=>tags[match.id]?.category==='Companies / tickers').map(match=>match.id))];
  return matches.length===1?identity(matches[0]):null;
 }catch{return null;}
}
function identityAttributes(identity){return identity?` data-mih-tag="${esc(identity.id)}" style="${esc(identity.style)}"`:'';}
function companyChip(symbol,listing,identity=companyIdentity(symbol,listing)){
 return `<span class="er-company-identity" data-no-ticker-links><a class="er-company-chip"${identityAttributes(identity)} href="search.html?q=${esc(encodeURIComponent(symbol))}" aria-label="Search the Hub for ${esc(symbol)}">${esc(symbol)}</a></span>`;
}
function loadColours(force=false){
 if(colourRequest)return colourRequest;
 if((colourAttempted&&!force)||!root.PublicationColour?.index||!root.fetch)return Promise.resolve();
 colourAttempted=true;
 // Identity styling is optional; neither a slow catalogue nor its failure blocks the evidence.
 colourRequest=Promise.resolve().then(async()=>{
  try{
   const response=await root.fetch('data/publication-colour-catalogue.json',force?{cache:'reload'}:undefined);
   if(!response.ok)throw Error('Identity catalogue unavailable');
   const catalogue=await response.json(),tags=root.PublicationColour.index(catalogue);
   colourCatalogue=catalogue;colourTags=tags;
   for(const entry of colourEntries){
    if(entry.container.isConnected===false||instances.get(entry.container)!==entry){colourEntries.delete(entry);continue;}
    if(entry.bundle)paint(entry);
   }
  }catch{/* Keep the existing checked palette, or readable neutral identities on first load. */}
 }).finally(()=>{colourRequest=null;});
 return colourRequest;
}
function commonEditions(series){
 const available=series.filter(item=>Array.isArray(item?.observations)&&item.observations.length);
 if(!available.length)return [];
 const sets=available.slice(1).map(item=>new Set(item.observations.map(row=>row.report_date)));
 return [...new Set(available[0].observations.map(row=>row.report_date))].filter(date=>validDate(date)&&sets.every(set=>set.has(date))).sort();
}
function chartOptions(options,state){return state.window==='chart'?{...(validDate(options.from)?{from:options.from}:{}),...(validDate(options.to)?{to:options.to}:{})}:{};}
function inWindow(date,options){return validDate(date)&&(!validDate(options.from)||date>=options.from)&&(!validDate(options.to)||date<=options.to);}
function timelineSvg(series,earnings,options={}){
 const rows=(series?.observations||[]).filter(row=>inWindow(row.report_date,options));
 const events=(earnings?.events||[]).filter(event=>inWindow(event.date,options));
 const dates=[...new Set([...rows.map(row=>row.report_date),...events.map(event=>event.date)])].sort();
 if(!dates.length)return unavailable('No dated valuation observation or original earnings release is available in this window.');
 const first=Date.parse(dates[0]+'T12:00:00Z'),last=Date.parse(dates.at(-1)+'T12:00:00Z'),span=last-first||86400000;
 const x=date=>last===first?470:146+(Date.parse(date+'T12:00:00Z')-first)/span*650;
 const lanes=[{key:'pe',label:'Forward P/E',top:26},{key:'pb',label:'Forward P/B',top:148}];
 let svg='';
 for(const lane of lanes){
  const observations=rows.filter(row=>finite(row[lane.key])&&row[lane.key]>0),values=observations.map(row=>row[lane.key]);
  const min=values.length?Math.min(...values):0,max=values.length?Math.max(...values):0;
  const y=value=>max===min?lane.top+56:lane.top+88-(value-min)/(max-min)*58;
  svg+=`<g><text x="8" y="${lane.top+28}" class="er-lane-label">${lane.label}</text><text x="8" y="${lane.top+48}" class="er-axis-label">Own scale · times</text><line x1="140" x2="810" y1="${lane.top+96}" y2="${lane.top+96}" class="er-rule"/>`;
  if(!observations.length)svg+=`<text x="160" y="${lane.top+58}" class="er-axis-label">No meaningful observations</text>`;
  for(const row of observations){const px=x(row.report_date),py=y(row[lane.key]);svg+=`<circle cx="${px}" cy="${py}" r="5" class="er-dot"><title>${esc(row.report_date)} · ${lane.label} ${sourceNumber(row,lane.key)} · source price date ${esc(row.price_date)}</title></circle><text x="${px}" y="${py-12}" text-anchor="middle" class="er-point-label">${sourceNumber(row,lane.key)}</text>`;}
  svg+='</g>';
 }
 svg+='<g><text x="8" y="290" class="er-lane-label">Earnings</text><text x="8" y="309" class="er-axis-label">Release dates</text><line x1="140" x2="810" y1="296" y2="296" class="er-rule"/>';
 if(!events.length)svg+='<text x="160" y="287" class="er-axis-label">No dated release in this window</text>';
 events.forEach((event,index)=>{const px=x(event.date),py=282-(index%2)*10;svg+=`<path d="M ${px} ${py-5} l 5 9 h -10 Z" class="er-event"><title>${esc(event.date)} · ${esc(event.label)} · announcement time unavailable</title></path>`;});
 svg+='</g>';
 const ticks=rows.length?rows.map(row=>row.report_date):[dates[0],...(dates.length>1?[dates.at(-1)]:[])];
 for(const date of [...new Set(ticks)])svg+=`<text x="${x(date)}" y="337" text-anchor="middle" class="er-date">${esc(date)}</text>`;
 return `<div class="er-chart-scroll" tabindex="0" role="region" aria-label="Dated valuation lanes; scroll horizontally on a small screen"><svg class="er-timeline" viewBox="0 0 846 358" role="img" aria-label="${esc(series?.symbol||earnings?.symbol||'Share')} selected forward P/E and P/B observations on separate scales, with known earnings release dates"><title>Selected valuation observations and reported earnings release dates. Exact values are in the source and earnings tables below.</title>${svg}</svg></div>`;
}
function rangeCard(range,label){
 if(!range?.count)return `<div class="er-range"><span>${esc(label)}</span><strong>Unavailable</strong><small>No positive source observations</small></div>`;
 return `<div class="er-range"><span>${esc(label)} · observed range</span><strong>${number(range.min)}–${number(range.max)} <small>times</small></strong><small>${range.count} observation${range.count===1?'':'s'}${range.excluded_count?' · '+range.excluded_count+' excluded':''}</small><small>Latest edition: ${number(range.latest)} · ${esc(range.latest_date)}</small></div>`;
}
function rangeSvg(range,metric,symbol){
 if(!range?.count)return '';
 const info=rangeMetrics[metric],spread=range.max-range.min,x=value=>spread?18+(value-range.min)/spread*244:140;
 const sourceValue=row=>row?.source_values?.[metric]??number(row?.[metric]);
 const title=`${symbol} ${info.label}. Observed low ${sourceValue(range.min_observations?.[0])} ${info.unit}; observed high ${sourceValue(range.max_observations?.[0])} ${info.unit}. Latest supplied edition ${range.latest_date||'unavailable'}: ${finite(range.latest)?sourceValue(range.latest_observation)+' '+info.unit:'no usable value'}. Each share uses its own observed range.`;
 const minX=x(range.min),maxX=x(range.max),latest=finite(range.latest)?`<path class="er-range-latest" d="M ${x(range.latest)} 20 l 7 10 l -7 10 l -7 -10 Z"><title>Latest supplied edition ${esc(range.latest_date)} · ${sourceNumber(range.latest_observation,metric)} ${info.unit}</title></path>`:'';
 return `<svg class="er-range-plot" viewBox="0 0 280 58" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title><line class="er-range-axis" x1="18" x2="262" y1="30" y2="30"/><line class="er-range-span" x1="${minX}" x2="${maxX}" y1="30" y2="30"/><path class="er-range-cap" d="M ${minX} 23 v 14 M ${maxX} 23 v 14"/>${latest}</svg>`;
}
function rangeDates(rows){return rows?.length?rows.map(row=>esc(row.report_date)).join(' · '):'No supplied value';}
function latestRangeValue(range,metric){
 const row=range.latest_observation,status=range.latest_status;
 const note=!range.edition_count?'No supplied edition in this window':status==='nonmeaningful'?'Source value excluded from range':status==='missing_value'?'Metric not supplied':status==='missing_observation'?'No exact listing row in this edition':'';
 return `<dd>${sourceNumber(row,metric)}${row&&finite(row[metric])?` <span>${rangeMetrics[metric].unit}</span>`:''}<small>${esc(range.latest_date||'No supplied report date')}${note?' · '+esc(note):''}</small></dd>`;
}
function rangeListingCard(series,range,metric){
 const info=rangeMetrics[metric],low=range.min_observations?.[0],high=range.max_observations?.[0],identity=companyIdentity(series.symbol,series.listing);
 return `<article class="er-range-card"${identityAttributes(identity)}><header data-no-ticker-links><h5>${companyChip(series.symbol,series.listing,identity)}</h5><span class="er-unit">${esc(series.listing?.currency||'Listing unavailable')}</span><p>${esc(series.listing?.name||'No matching valuation evidence')}</p></header><div class="er-range-card-summary"><span>${info.label} · supplied sample</span><strong>${range.count?`${sourceNumber(low,metric)}–${sourceNumber(high,metric)} <small>${info.unit}</small>`:'Unavailable'}</strong></div>${rangeSvg(range,metric,series.symbol)}<dl class="er-range-facts"><div class="er-range-latest-fact"><dt>Latest supplied edition</dt>${latestRangeValue(range,metric)}</div><div><dt>Observed low</dt><dd>${sourceNumber(low,metric)}${low?` <span>${info.unit}</span>`:''}<small>${rangeDates(range.min_observations)}</small></dd></div><div><dt>Observed high</dt><dd>${sourceNumber(high,metric)}${high?` <span>${info.unit}</span>`:''}<small>${rangeDates(range.max_observations)}</small></dd></div></dl><p class="er-range-counts"><b>${range.count} valid</b> · ${range.excluded_count} excluded · ${range.missing_count} missing rows<small>${range.edition_count} supplied edition${range.edition_count===1?'':'s'} in this window</small></p></article>`;
}
function coverageMatrix(items,metric){
 const dates=items[0]?.range.report_dates||[],info=rangeMetrics[metric];
 if(!dates.length)return unavailable('No supplied valuation edition falls within this report-date window.');
 return `<details class="er-evidence er-coverage"><summary>Coverage and exact source values · ${dates.length} supplied editions</summary><p>Counts refer to the supplied editions in this window. They do not measure completeness of the monthly archive. Missing listing rows and excluded metric values are shown separately.</p><div class="er-table-scroll er-coverage-scroll" tabindex="0" role="region" aria-label="Valuation coverage by listing and edition; scroll horizontally for every edition"><table class="er-table"><caption>${info.label} (${info.unit}) · exact source precision. Report dates are column headings; underlying price dates and extract locations are shown in each supplied row.</caption><thead><tr><th scope="col">Share</th>${dates.map(date=>`<th scope="col">${esc(date)}</th>`).join('')}</tr></thead><tbody>${items.map(({series,range,coverage})=>`<tr><th scope="row" data-no-ticker-links>${companyChip(series.symbol,series.listing)}<small>${esc(series.listing?.currency||'Listing unavailable')}</small></th>${dates.map(date=>{const row=coverage.editions?.find(item=>item.report_date===date)?.observation||null,excluded=range.excluded_observations?.find(item=>item.report_date===date),gap=series.listing?.missing_editions?.find(item=>item.report_date===date);if(!row)return `<td class="er-coverage-missing">No exact row<small>${esc(gap?.note||'No matched observation in this supplied edition')}</small></td>`;const status=excluded?.exclusion_reason==='missing_value'?'Metric not supplied':excluded?'Excluded from range':'Valid';return `<td>${sourceNumber(row,metric)}<small>${status} · price ${esc(row.price_date)}</small><small>PDF p. ${esc(row.source_page)} · extract row ${esc(row.source_row)}</small></td>`;}).join('')}</tr>`).join('')}</tbody></table></div><p class="er-note">Zero yield is a valid supplied value. Negative yield, and P/E or P/B at or below zero, remain source evidence and are excluded from ranges. Numerical extracts were checked against the supplied CSV rows and page headings; original PDFs are not verified here.</p></details>`;
}
function valuationRanges(bundle,options,state,adapter,windowOptions){
 const metric=rangeMetrics[state.metric]?state.metric:'pe',info=rangeMetrics[metric];
 const items=options.symbols.map(symbol=>({series:adapter.valuationSeries(symbol,bundle,windowOptions),range:adapter.observedRange(symbol,bundle,metric,windowOptions),coverage:adapter.coverageFor(symbol,bundle,windowOptions)}));
 return `<section class="er-valuation-ranges"><h4>Valuation ranges</h4><p class="er-note">Compare the latest supplied ${info.label} with the observed low and high for each selected share. These ranges describe selected editions only. Consensus forward estimates; forecast horizon unspecified.</p><p class="er-range-legend"><span class="er-legend-span" aria-hidden="true"></span> Observed low–high <span class="er-legend-latest" aria-hidden="true"></span> Latest supplied edition <small>Each share uses its own observed range. A missing or excluded latest value has no marker. Company colours identify the share.</small></p><div class="er-range-grid">${items.map(item=>rangeListingCard(item.series,item.range,metric)).join('')}</div>${coverageMatrix(items,metric)}<p class="er-note">Historical valuation percentiles are unavailable for this incomplete sample. Ranges alone do not establish investment quality, fair value or a trading signal. Archived source prices do not enter the shared return calculation.</p></section>`;
}
function valuationEvidence(series){
 if(!series.observations.length)return '';
 return `<details class="er-evidence"><summary>Valuation source evidence · ${series.observations.length} editions</summary><p>Report dates show the publication edition. The price date is the underlying quote date. P/E, P/B and dividend yield are supplied consensus forward estimates with an unspecified forecast horizon. Source prices are unadjusted observations, shown here only; they do not calculate returns.</p><div class="er-table-scroll" tabindex="0" role="region" aria-label="Valuation source evidence, scroll for all fields"><table class="er-table"><caption>${esc(series.symbol)} · selected source values in ${esc(series.listing?.currency||'listing currency')}. Fair value / target is an analyst reference, not market price; provider and value type are unresolved where not supplied.</caption><thead><tr><th scope="col">Report date</th><th scope="col">Price date</th><th scope="col">Source price<br>${esc(series.listing?.currency||'')}</th><th scope="col">Forward P/E</th><th scope="col">Forward P/B</th><th scope="col">Forward yield %</th><th scope="col">Analyst fair value / target<br>${esc(series.listing?.currency||'')}</th><th scope="col">Evidence</th></tr></thead><tbody>${series.observations.map(row=>`<tr><th scope="row">${esc(row.report_date)}</th><td>${esc(row.price_date)}</td><td>${sourceNumber(row,'price')}</td><td>${sourceNumber(row,'pe')}${finite(row.pe)&&row.pe<=0?'<small>Non-meaningful; excluded from range</small>':''}</td><td>${sourceNumber(row,'pb')}${finite(row.pb)&&row.pb<=0?'<small>Source review; excluded from range</small>':''}</td><td>${sourceNumber(row,'dividend_yield_pct')}</td><td>${sourceNumber(row,'fair_value_or_target')}<small>Source label unresolved</small></td><td>${esc(row.source?.publisher||'Bank of Singapore')}<small>PDF page ${esc(row.source_page)} · extract row ${esc(row.source_row)}</small></td></tr>`).join('')}</tbody></table></div><p class="er-note">Numerical extracts checked against supplied CSV rows and page headings. Original PDFs were not retrieved for this release. Zero or negative P/E/P/B values remain visible as source evidence and are excluded from the plotted positive-ratio ranges.</p></details>`;
}
function earningsPanel(earnings,windowOptions={}){
 if(!earnings.company)return `<section class="er-earnings"><h4>Reported earnings</h4>${unavailable(earnings.reason||'Reported earnings have not been indexed for this exact listing.')}</section>`;
 const dated=earnings.observations.filter(row=>inWindow(row.report_date,windowOptions));
 const undated=earnings.observations.filter(row=>!validDate(row.report_date));
 const datedRows=dated.slice().sort((a,b)=>b.report_date.localeCompare(a.report_date));
 const rows=[...datedRows,...undated];
 const latest=datedRows[0];
 return `<section class="er-earnings"><h4>Reported earnings</h4>${latest?`<p class="er-latest"><strong>${esc(latest.period)}</strong> · revenue <b>${usdBillions(latest.revenue_usd_bn)}</b> · EPS <b>${number(latest.eps)}</b><small>${esc(latest.eps_basis)} · released ${esc(latest.report_date)} · period ended ${esc(latest.period_end||'not indexed')}</small></p>`:unavailable('No original earnings release is dated within this window. Undated comparatives remain in the evidence below.')}<p class="er-note">${esc(earnings.coverage||'Selected actuals only.')} Earnings use original release dates where supplied. Later-release comparatives are kept out of the release timeline.</p><details class="er-evidence"><summary>Reported results and source dates · ${rows.length} observations</summary><div class="er-table-scroll" tabindex="0" role="region" aria-label="Reported earnings actuals and publication evidence"><table class="er-table"><caption>${esc(earnings.company.name||earnings.symbol)} · revenue in US$bn; EPS basis shown per row. Missing periods are not filled.</caption><thead><tr><th scope="col">Fiscal period</th><th scope="col">Period end</th><th scope="col">Revenue<br>US$bn</th><th scope="col">EPS</th><th scope="col">Original release</th><th scope="col">Source evidence</th></tr></thead><tbody>${rows.map(row=>`<tr><th scope="row">${esc(row.period)}</th><td>${esc(row.period_end||'Not indexed')}</td><td>${number(row.revenue_usd_bn)}${row.precision_note?`<small>${esc(row.precision_note)}</small>`:''}</td><td>${number(row.eps)}<small>${esc(row.eps_basis)}</small>${finite(row.ordinary_eps_ntd)?`<small>NT$${number(row.ordinary_eps_ntd)} / ordinary share</small>`:''}</td><td>${esc(row.report_date||'Not indexed')}<small>${esc(row.evidence_basis||'')}</small></td><td>${sourceLink(row.source_details)}<small>Source published ${esc(row.source_details?.published_at||'not indexed')}</small></td></tr>`).join('')||'<tr><td colspan="6">No reported observations are available in this window.</td></tr>'}</tbody></table></div><p class="er-note">Publication times are unavailable, so a same-day share close may precede an after-market release. These actuals do not establish historical consensus estimates, earnings surprises or a trading backtest.</p></details>${cashflowPanel(earnings,windowOptions)}</section>`;
}
function cashflowPanel(earnings,windowOptions={}){
 const all=earnings.cashflows||[],rows=all.filter(row=>!windowOptions.from&&!windowOptions.to||inWindow(row.source_details?.published_at,windowOptions));
 if(!rows.length)return `<p class="er-note"><b>Quarterly cash generation:</b> ${esc(all.length?'No reconciled cash-flow observation is published within this window.':earnings.cashflow_note||'No reconciled operating cash flow / capex / FCF observation is indexed here for this listing.')}</p>`;
 return `<details class="er-evidence"><summary>Quarterly cash generation · ${rows.length} observation${rows.length===1?'':'s'}</summary><p class="er-note">Selected periods only; no multi-year cash-flow trend has been established. Definitions and adjustments remain specific to the issuer.</p>${rows.map(row=>`<div class="er-cashflow"><h5>${esc(row.period)} · ended ${esc(row.period_end||'not indexed')}</h5><dl><div><dt>Operating cash flow</dt><dd>${number(row.operating_cash_flow_usd_bn)} ${esc(row.unit)}</dd></div><div><dt>Capital expenditure</dt><dd>${number(row.capex_usd_bn)} ${esc(row.unit)}</dd></div><div><dt>Other stated adjustment</dt><dd>${number(row.other_adjustment_usd_bn)} ${esc(row.unit)}</dd></div><div><dt>Reported / reconciled FCF</dt><dd>${number(row.fcf_usd_bn)} ${esc(row.unit)}</dd></div></dl><p>${esc(row.definition||'Definition not indexed')}</p><p>${esc(row.note||row.reason||'')}</p><p>${sourceLink(row.source_details)}</p></div>`).join('')}</details>`;
}
function quoteCell(symbol){
 try{const item=root.MarketPrices?.resolve?.(symbol)||root.BOSEquity?.itemFor?.(symbol),quote=root.MarketPrices?.currentQuote?.(item||symbol);if(!finite(quote?.close))return 'Unavailable';return `<b>${number(quote.close)} ${esc(item?.currency||'')}</b><small>${esc(quote.date||'Date unavailable')} · ${esc(quote.sourceLabel||'Selected price source')}${quote.current===false?' · dated reference':''}</small>`;}catch{return 'Unavailable';}
}
function latestActual(earnings){return (earnings.observations||[]).filter(row=>validDate(row.report_date)).slice().sort((a,b)=>b.report_date.localeCompare(a.report_date))[0]||null;}
function comparison(bundle,options,state,adapter,windowOptions){
 const symbols=options.symbols,all=symbols.map(symbol=>adapter.valuationSeries(symbol,bundle,windowOptions)),dates=commonEditions(all),available=all.filter(series=>series.observations.length),missing=all.filter(series=>!series.observations.length);
 const date=dates.includes(state.edition)?state.edition:dates.at(-1)||'';
 return `<section class="er-comparison"><h4>Compare selected shares</h4><p>The selection is shared with the price chart above. Source ratios use one common report edition. Current quotes and latest reported earnings retain their own dates; this is a descriptive comparison, not a historical strategy test.</p>${dates.length?`<label class="er-edition">Common valuation edition<select data-er-edition>${dates.slice().reverse().map(value=>`<option value="${esc(value)}" ${value===date?'selected':''}>${esc(value)}</option>`).join('')}</select></label><p class="er-note">${available.length} of ${symbols.length} selected shares have valuation evidence in this window.${missing.length?' Unavailable: '+missing.map(item=>esc(item.symbol)).join(', ')+'.':''} Forward forecast horizon: unspecified. ${symbols.length===1?'Add shares using the existing “Add to chart” control above.':''}</p>`:unavailable('No common supplied valuation edition is available for the selected shares in this window. All selected shares remain listed below.')}<div class="er-table-scroll er-comparison-scroll" tabindex="0" role="region" aria-label="Selected-share comparison; scroll horizontally for all fields"><table class="er-table"><caption>${date?'Common source report: '+esc(date)+'. ':''}Compare within matching metric bases and sectors. Current price, source valuation and issuer results have separate dates.</caption><thead><tr><th scope="col">Share</th><th scope="col">Current selected price<br>listing currency</th><th scope="col">Source forward P/E</th><th scope="col">Source forward P/B</th><th scope="col">Source forward yield %</th><th scope="col">Latest reported revenue / EPS<br>separate release date</th><th scope="col">Quarterly FCF<br>selected period</th><th scope="col">Valuation evidence</th></tr></thead><tbody>${all.map(series=>{const row=series.observations.find(point=>point.report_date===date),earnings=adapter.earningsFor(series.symbol,bundle),actual=latestActual(earnings),cash=(earnings.cashflows||[])[0];return `<tr><th scope="row" data-no-ticker-links>${companyChip(series.symbol,series.listing)}<small>${esc(series.listing?.name||earnings.company?.name||'Listing evidence unavailable')}</small></th><td>${quoteCell(series.symbol)}</td><td>${sourceNumber(row,'pe')}${row&&finite(row.pe)&&row.pe<=0?'<small>Non-meaningful</small>':''}</td><td>${sourceNumber(row,'pb')}${row&&finite(row.pb)&&row.pb<=0?'<small>Source review</small>':''}</td><td>${sourceNumber(row,'dividend_yield_pct')}</td><td>${actual?`${usdBillions(actual.revenue_usd_bn)} / ${number(actual.eps)}<small>${esc(actual.eps_basis)}</small><small>${esc(actual.period)} · released ${esc(actual.report_date)}</small>`:'Not indexed'}</td><td>${cash?`${number(cash.fcf_usd_bn)} ${esc(cash.unit)}<small>${esc(cash.period)} · ${esc(cash.definition||'Definition not indexed')}</small>`:'Not reconciled'}</td><td>${row?`Price date ${esc(row.price_date)}<small>PDF page ${esc(row.source_page)} · extract row ${esc(row.source_row)}</small>`:esc(series.reason||'No matching edition')}</td></tr>`;}).join('')}</tbody></table></div><p class="er-note">Historical valuation percentiles are unavailable for this incomplete supplied sample. A high or low source multiple alone does not establish investment quality.</p></section>`;
}
function renderContent(bundle,options={},state={},adapter=root.EquityResearchData){
 const symbols=[...new Set((options.symbols||[]).filter(symbol=>typeof symbol==='string'&&symbol))].slice(0,6);
 if(!symbols.length)return unavailable('Select a share in the existing price-chart controls above.');
 if(!adapter?.valuationSeries||!adapter?.earningsFor||!adapter?.observedRange)return unavailable('The valuation and earnings reader is unavailable. The price chart remains available above.');
 const opts={...options,symbols},s={...initialView(),focus:symbols[0],...state};if(!symbols.includes(s.focus))s.focus=symbols[0];if(!['timeline','ranges','comparison'].includes(s.mode))s.mode='timeline';if(!rangeMetrics[s.metric])s.metric='pe';
 const windowOptions=chartOptions(opts,s),series=adapter.valuationSeries(s.focus,bundle,windowOptions),earnings=adapter.earningsFor(s.focus,bundle),coverage=bundle?.valuation?.coverage;
 const status=Object.entries(bundle?.status||{}).filter(([,value])=>value?.refresh_failed||value?.state==='unavailable').map(([key,value])=>`<p class="er-status" role="status"><b>${key==='valuation'?'Valuation':'Earnings'}:</b> ${esc(value.message)}</p>`).join('');
 const title=series.listing?.name||earnings.company?.name||s.focus,identity=companyIdentity(s.focus,series.listing);
 const header=`<header class="er-header"><div><span class="er-eyebrow">Company research · selected evidence</span><h3>Valuation &amp; earnings</h3><p>Follow the shares selected in the price chart. ${coverage?`${coverage.edition_count} supplied valuation editions across ${coverage.listing_count} exact listings.`:'Valuation coverage is currently unavailable.'}</p></div><button type="button" class="button ghost" data-er-retry>Refresh evidence</button></header>${status}<div class="er-controls"><div class="er-modes" role="group" aria-label="Research view"><button type="button" data-er-mode="timeline" aria-pressed="${s.mode==='timeline'}">Company timeline</button><button type="button" data-er-mode="ranges" aria-pressed="${s.mode==='ranges'}">Valuation ranges</button><button type="button" data-er-mode="comparison" aria-pressed="${s.mode==='comparison'}">Compare selected (${symbols.length})</button></div><label>Valuation window<select data-er-window><option value="all" ${s.window!=='chart'?'selected':''}>All supplied editions</option><option value="chart" ${s.window==='chart'?'selected':''}>Price-chart window${opts.range?' · '+esc(opts.range):''}</option></select></label>${s.mode==='ranges'?`<label>Valuation metric<select data-er-metric>${Object.entries(rangeMetrics).map(([key,info])=>`<option value="${key}" ${s.metric===key?'selected':''}>${info.label}</option>`).join('')}</select></label>`:''}${s.mode==='timeline'?`<label>Company in current selection<select data-er-focus>${symbols.map(symbol=>`<option value="${esc(symbol)}" ${symbol===s.focus?'selected':''}>${esc(symbol)}</option>`).join('')}</select></label>`:''}</div><p class="er-window-note">${s.window==='chart'?(validDate(opts.from)&&validDate(opts.to)?`Report-date window: <b>${esc(opts.from)} → ${esc(opts.to)}</b>.`:'The price-chart dates are loading; available source observations are shown until the window is known.'):`All supplied report dates${coverage?' · '+esc(coverage.first_report_date)+' → '+esc(coverage.last_report_date):''}.`} The price chart keeps its own range and return basis.</p>`;
 if(s.mode==='comparison')return header+comparison(bundle,opts,s,adapter,windowOptions);
 if(s.mode==='ranges')return header+(adapter.coverageFor?valuationRanges(bundle,opts,s,adapter,windowOptions):unavailable('The valuation coverage reader is unavailable. Refresh evidence to retry.'));
 return header+`<section class="er-company"${identityAttributes(identity)}><div class="er-company-heading"><div data-no-ticker-links>${companyChip(s.focus,series.listing,identity)}<h4>${esc(title)}</h4></div><span class="er-count">${series.observations.length} valuation observations · ${(earnings.events||[]).filter(event=>inWindow(event.date,windowOptions)).length} dated releases</span></div>${series.observations.length?`<div class="er-ranges">${rangeCard(adapter.observedRange(s.focus,bundle,'pe',windowOptions),'P/E')}${rangeCard(adapter.observedRange(s.focus,bundle,'pb',windowOptions),'P/B')}</div><p class="er-note">Ranges describe only these supplied editions. They are not continuous historical ranges or valuation percentiles. Consensus forward estimates; forecast horizon unspecified.</p>`:unavailable(series.reason||'No supplied valuation observation is available for this listing.')}<p class="er-chart-guide">Price history is in the shared chart above. Below, P/E and P/B use separate scales; each circle is a source report, with no values filled between editions. Triangles mark original earnings release dates. Company colours identify the share; values stay neutral.</p>${timelineSvg(series,earnings,windowOptions)}${valuationEvidence(series)}${earningsPanel(earnings,windowOptions)}</section>`;
}
function paint(entry){
 if(entry.container.isConnected===false)return;
 const active=root.document?.activeElement,selector=active&&entry.container.contains?.(active)?['data-er-window','data-er-focus','data-er-edition','data-er-metric','data-er-mode'].find(key=>active.hasAttribute?.(key)):null,value=selector?active.getAttribute(selector):null;
 try{entry.container.innerHTML=renderContent(entry.bundle,entry.options,entry.state);}
 catch{entry.container.innerHTML=unavailable('The research panel could not be displayed. Refresh evidence to retry. The shared price chart is unchanged.')+'<button type="button" class="button ghost" data-er-retry>Refresh evidence</button>';}
 if(selector){const candidates=entry.container.querySelectorAll?.('['+selector+']')||[];const next=[...candidates].find(node=>node.getAttribute(selector)===value);next?.focus?.({preventScroll:true});}
}
async function mount(container,options={}){
 if(!container)return {ok:false};
 for(const mounted of colourEntries)if(mounted.container.isConnected===false||instances.get(mounted.container)!==mounted)colourEntries.delete(mounted);
 let entry=instances.get(container);
 const viewKey=typeof options.selectionKey==='string'&&options.selectionKey?options.selectionKey:entry?.viewKey||null;
 if(!entry){entry={container,options:{},state:viewState(viewKey),viewKey,bundle:null,revision:0};
  entry.click=event=>{const retry=event.target.closest?.('[data-er-retry]');if(retry){mount(container,{...entry.options,force:true});return;}const button=event.target.closest?.('[data-er-mode]');if(button&&['timeline','ranges','comparison'].includes(button.dataset.erMode)){entry.state.mode=button.dataset.erMode;paint(entry);}};
  entry.change=event=>{const target=event.target;if(target.matches?.('[data-er-window]'))entry.state.window=target.value==='chart'?'chart':'all';else if(target.matches?.('[data-er-focus]')&&entry.options.symbols.includes(target.value))entry.state.focus=target.value;else if(target.matches?.('[data-er-edition]'))entry.state.edition=target.value;else if(target.matches?.('[data-er-metric]')&&rangeMetrics[target.value])entry.state.metric=target.value;else return;paint(entry);};
  container.addEventListener?.('click',entry.click);container.addEventListener?.('change',entry.change);instances.set(container,entry);colourEntries.add(entry);
 }
 if(entry.viewKey!==viewKey){entry.viewKey=viewKey;entry.state=viewState(viewKey);}
 entry.options={...entry.options,...options,symbols:[...new Set((options.symbols||entry.options.symbols||[]).filter(value=>typeof value==='string'&&value))].slice(0,6)};
 if(!entry.options.symbols.includes(entry.state.focus))entry.state.focus=entry.options.symbols[0]||'';
 container.classList?.add('equity-research');container.setAttribute?.('aria-busy','true');
 const revision=++entry.revision;
 if(entry.bundle)paint(entry);else container.innerHTML='<p class="er-status" role="status">Loading dated valuation and earnings evidence…</p>';
 loadColours(options.force===true);
 try{if(!root.EquityResearchData?.load)throw Error('Reader unavailable');const bundle=await root.EquityResearchData.load({force:options.force===true});if(entry.revision!==revision||container.isConnected===false)return {ok:false,stale:true};entry.bundle=bundle;paint(entry);return {ok:true};}
 catch{if(entry.revision===revision&&container.isConnected!==false){if(entry.bundle)paint(entry);else container.innerHTML=unavailable('Valuation and earnings evidence could not load. The shared price chart remains available above.')+'<button type="button" class="button ghost" data-er-retry>Retry evidence</button>';}return {ok:false};}
 finally{if(entry.revision===revision)container.setAttribute?.('aria-busy','false');}
}
function unmount(container){const entry=instances.get(container);if(!entry)return;entry.revision++;container.removeEventListener?.('click',entry.click);container.removeEventListener?.('change',entry.change);instances.delete(container);colourEntries.delete(entry);}
const api={mount,unmount,renderContent,commonEditions,timelineSvg,companyIdentity};root.EquityResearch=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
