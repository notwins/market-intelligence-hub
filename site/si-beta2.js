(function(){'use strict';
const C=window.SIBetaCore,E=C.escape,$=id=>document.getElementById(id),form=$('si-form'),KEY='market-si-beta2-v1',LIMIT=30;
let pages=[],watch=[],activeId='',dirty=false,list='all',assets={},loading=new Set(),revisions={},busy=false,removed=null,storageOK=true,pdfURL='';
const WATERMARK_KEY='market-si-beta2-logo-watermark',LOGO_BASE='assets/company-logos/';
let showWatermarks=true,logoIndexPromise,chart=C.chartOptions();
const CHART_KEY='market-si-beta2-chart',MOA_KEY='market-si-beta2-moa-v1';
const EQUITY_KEY='market-si-beta2-equity-pages',TERMS_KEY='market-si-beta2-terms-page';
let includeEquity=false,includeTerms=false;
try{
 includeEquity=localStorage.getItem(EQUITY_KEY)==='on';
 includeTerms=localStorage.getItem(TERMS_KEY)==='on';
}catch{/* Session-only options. */}
let moaLibrary=null;
const bosFiles=window.SIBosHistory;
let bosArchive=null,bosWorking=!!bosFiles;
try{const saved=localStorage.getItem(MOA_KEY);if(saved)moaLibrary=C.parseMoa(JSON.parse(saved));}catch{/* Allow a fresh private import. */}
try{chart=C.chartOptions(JSON.parse(localStorage.getItem(CHART_KEY)||'null'));}catch{/* Keep the defaults. */}
const logoImages=new Map();
try{showWatermarks=localStorage.getItem(WATERMARK_KEY)!=='off';}catch{/* The toggle can still work for this session. */}
const active=()=>pages.find(p=>p.id===activeId),id=()=>crypto.randomUUID(),notice=msg=>{$('app-status').textContent=msg;clearTimeout(notice.timer);notice.timer=setTimeout(()=>{$('app-status').textContent='';},9000);};
function bounded(promise,message,ms=20000){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms);})]).finally(()=>clearTimeout(timer));}
function logoIndex(){
 if(!logoIndexPromise){
  logoIndexPromise=bounded(fetch(LOGO_BASE+'company-logos.json').then(async response=>{
   if(!response.ok)throw Error('Logo library unavailable.');
   const data=await response.json();
   if(data.schema_version!==1||!Array.isArray(data.companies))throw Error('Invalid logo library.');
   const index=new Map();
   for(const {ticker,file} of data.companies){
    if(typeof ticker==='string'&&typeof file==='string'&&/^[A-Za-z0-9][A-Za-z0-9.-]*\.webp$/.test(file))index.set(ticker,file);
   }
   for(const [alias,ticker] of Object.entries(data.aliases||{})){
    if(!index.has(alias)&&index.has(ticker))index.set(alias,index.get(ticker));
   }
   return index;
  }), 'Logo library timed out.', 5000).catch(()=>{logoIndexPromise=undefined;return new Map();});
 }
 return logoIndexPromise;
}
async function embedLogo(file){
 const response=await fetch(LOGO_BASE+file);
 if(!response.ok)throw Error('Company logo unavailable.');
 const url=URL.createObjectURL(await response.blob());
 try{
  const img=new Image();
  await bounded(new Promise((resolve,reject)=>{
   img.onload=resolve;
   img.onerror=reject;
   img.src=url;
  }), 'Company logo could not be read.', 5000);
  // SVG is rasterized as an image for PDF export. Embed a PNG so the SVG has no external image dependency.
  const canvas=document.createElement('canvas');
  const scale=Math.min(1,320/Math.max(img.naturalWidth,img.naturalHeight));
  canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
  canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/png');
 }finally{URL.revokeObjectURL(url);}
}
async function companyLogo(...tickers){
 if(typeof fetch!=='function')return '';
 const index=await logoIndex();
 const file=tickers.map(C.symbol).map(ticker=>index.get(ticker)).find(Boolean);
 if(!file)return '';
 if(!logoImages.has(file)){
  logoImages.set(file,bounded(embedLogo(file),'Company logo timed out.',7000).catch(()=>{
   logoImages.delete(file);
   return '';
  }));
 }
 return logoImages.get(file);
}
function renderPage(page,data,number,total,watermarks=showWatermarks,links){
 const withPrivateData=Object.fromEntries(page.shares.map(s=>{
  const info=data[s.symbol]||{};
  return [s.symbol,{...info,
   ...(moaLibrary?{moaPct:C.matchMoa(moaLibrary,info.moaTicker,info.moaCurrency,info.isin),moaSource:moaLibrary.label}:{}),
   bosCalls:bosArchive?.listings.get(info.bosKey)
  }];
 }));
 return C.svg(page,withPrivateData,number,total,{showWatermarks:watermarks,links,chart});
}
function invalidatePDF(){if(pdfURL)URL.revokeObjectURL(pdfURL);pdfURL='';$('pdf-ready').hidden=true;for(const name of ['download-pdf','open-pdf'])$(name).removeAttribute('href');}
function protectEdits(){if(busy)return true;if(!dirty)return false;notice('Apply or discard your changes in Review & export before continuing.');$('pending-edits').scrollIntoView({behavior:'smooth',block:'center'});return true;}
const payoffInput=(key,field)=>form.elements[`payoff_${key}_${field}`];
function fillPayoffTerms(value){
 const terms=C.payoffTerms(value);
 form.elements.payoff_source.value=terms.source;
 for(const [key] of C.payoffCases)for(const field of C.payoffFields)payoffInput(key,field).value=terms.cases[key][field];
}
function readPayoffTerms(){
 return C.payoffTerms({
  source:form.elements.payoff_source.value,
  cases:Object.fromEntries(C.payoffCases.map(([key])=>[key,
   Object.fromEntries(C.payoffFields.map(field=>[field,payoffInput(key,field).value]))]))
 });
}
function normalize(p){if(!p||typeof p!=='object'||!Array.isArray(p.shares)||p.shares.length>4)throw Error('Invalid collection page.');const b=C.blank();for(const k of ['ko','ki','strike','step','months','coupon'])b[k]=C.num(p[k]);for(const k of ['currency','tenorUnit','couponBasis','kiType','date','issuer','notes'])if(typeof p[k]==='string')b[k]=p[k].slice(0,k==='notes'?180:50);b.payoffTerms=C.payoffTerms(p.payoffTerms);b.tenorUnit='months';b.firstStep=p.firstStep===undefined?2:Number(p.firstStep);b.id=typeof p.id==='string'?p.id.slice(0,80):id();b.shares=p.shares.map(s=>({symbol:C.symbol(s.symbol),fixing:C.num(s.fixing),moaPct:C.num(s.moaPct),name:String(s.name||'').slice(0,60),description:String(s.description||'').slice(0,280)}));if(p.source&&/^SI-\d{3,}$/.test(p.source.reference))b.source={reference:p.source.reference,date:/^\d{4}-\d{2}-\d{2}$/.test(p.source.date)?p.source.date:'',rounded:true,review:!!p.source.review,couponAssumed:p.source.couponAssumed===true,bonusEnhanced:p.source.bonusEnhanced===true};return b;}
function persist(){try{localStorage.setItem(KEY,JSON.stringify({version:1,pages,watch,activeId}));storageOK=true;}catch{storageOK=false;notice('Browser storage is unavailable. Use Save collection to keep these pages.');}}
function restore(){try{const raw=localStorage.getItem(KEY);if(!raw)return;if(raw.length>500000)throw Error();const s=JSON.parse(raw);if(s.version!==1||!Array.isArray(s.pages)||s.pages.length>LIMIT)throw Error();pages=s.pages.map(normalize);if(new Set(pages.map(p=>p.id)).size!==pages.length)throw Error();watch=Array.isArray(s.watch)?s.watch.filter(r=>/^SI-\d{3,}$/.test(r)).slice(0,3000):[];activeId=pages.some(p=>p.id===s.activeId)?s.activeId:pages[0]?.id||'';}catch{pages=[];notice('Saved collection could not be read. It has not been overwritten; you can load a collection backup.');}}
$('share-inputs').innerHTML=Array.from({length:4},(_,i)=>`<div class="share-picker">
 <label class="share-number" for="si-share-${i}">Share ${i+1}${i?' · Optional':''}</label>
 <div class="share-picker-field">
  <input id="si-share-${i}" name="share${i}" role="combobox" aria-label="Share ${i+1}" aria-autocomplete="list" aria-expanded="false" aria-controls="si-share-options-${i}" autocomplete="off" maxlength="30" placeholder="${['NVDA','MSFT','939 HK','AMZN'][i]}">
  <button type="button" aria-label="Show share ${i+1} suggestions" aria-controls="si-share-options-${i}" tabindex="-1"><span aria-hidden="true"></span></button>
 </div>
 <div id="si-share-options-${i}" class="share-picker-list" role="listbox" aria-label="Share ${i+1} suggestions" hidden></div>
</div>`).join('');
const picker=window.SISharePicker?.mount($('share-inputs'),{escape:E,logoBase:LOGO_BASE});
let pickerLogos=new Map();
function updateSharePicker(){
 if(!picker)return;
 const prices=window.MarketPrices;
 const bos=window.BOSEquity;
 picker.update(window.SISharePicker.groups({
  instruments:prices.instruments()||[],profiles:window.ShareStaticData?.records()||[],
  watchlist:window.WatchlistMembership?.members||[],resolve:ticker=>prices.resolve(ticker),
  symbol:C.symbol,logos:pickerLogos,
  marketCap(item,profile){
   const match=item&&bos?.recordFor(item);
   const byId=profile&&bos?.valuationById(profile.bbTicker)?.row;
   return match?.marketCapUsdBillions??(byId?.currency===profile?.currency?byId?.marketCapUsdBillions:null);
  }
 }));
}
if(picker){
 updateSharePicker();
 logoIndex().then(index=>{pickerLogos=index;updateSharePicker();renderLibrary();});
 for(const event of ['market-prices-updated','bos-equity-updated','share-static-updated'])
  document.addEventListener(event,updateSharePicker);
}
$('share-details').innerHTML=Array.from({length:4},(_,i)=>`<div class="share-detail"><strong>Share ${i+1} details</strong><label>Manual reference price<input name="fixing${i}" type="number" min="0.000001" step="any" placeholder="Use dated close"></label><label>MOA margin (%)<input name="moa${i}" type="number" min="0" max="100" step="any" placeholder="Use matched private rate"></label><label>Company name<input name="name${i}" maxlength="60" placeholder="From feed when available"></label><label>Company description<textarea name="description${i}" rows="2" maxlength="280" placeholder="Optional override; matched profile used when blank"></textarea></label></div>`).join('');
function fill(p=C.blank()){picker?.close();fillPayoffTerms(p.payoffTerms);for(const k of ['ko','ki','strike','step','months','coupon','currency','tenorUnit','couponBasis','kiType','firstStep','date','issuer','notes'])form.elements[k].value=p[k]??'';for(let i=0;i<4;i++){const s=p.shares[i]||{};form.elements['share'+i].value=s.symbol||'';form.elements['fixing'+i].value=s.fixing??'';form.elements['moa'+i].value=s.moaPct??'';form.elements['name'+i].value=s.name||'';form.elements['description'+i].value=s.description||'';}picker?.sync();dirty=false;$('form-errors').textContent='';$('apply-page').textContent=active()?'Update one-pager':'Create one-pager';$('editor-title').textContent=active()?`Edit one-pager ${pages.indexOf(active())+1}`:'Create a one-pager';$('editor-note').textContent=p.source?`Based on ${p.source.reference}. Imported terms remain rounded and photo-unverified.${p.source.couponAssumed&&p.couponBasis==='per_annum'?' Coupon assumed p.a.':''}`:'Start with one to four shares. All entered terms stay on this device.';}
function read(){const p=active()?structuredClone(active()):C.blank();for(const k of ['ko','ki','strike','step','months','coupon'])p[k]=C.num(form.elements[k].value);for(const k of ['currency','tenorUnit','couponBasis','kiType','date','issuer','notes'])p[k]=form.elements[k].value.trim();p.firstStep=Number(form.elements.firstStep.value);p.payoffTerms=readPayoffTerms();p.shares=[];for(let i=0;i<4;i++){const s=form.elements['share'+i].value.trim();if(s)p.shares.push({symbol:C.symbol(s),fixing:C.num(form.elements['fixing'+i].value),moaPct:C.num(form.elements['moa'+i].value),name:form.elements['name'+i].value.trim(),description:form.elements['description'+i].value.trim()});}return p;}
const pdfPlan=collection=>window.SIEquityPages?.plan(collection,includeEquity,includeTerms)||
 collection.map(page=>({kind:'si',page}));
const pdfCount=collection=>pdfPlan(collection).length;
function renderPDFPage(entry,data,number,total,watermarks,links=[]){
 const {kind,page,share}=entry;
 if(kind==='si')return renderPage(page,data,number,total,watermarks,links);
 if(kind==='terms')return window.SIEquityPages.termsSvg(page,data,number,total);
 return window.SIEquityPages.svg(share,data[share.symbol]||{},number,total,
  {showWatermarks:watermarks,links,source:page.source?.reference});
}
function buttons(){const p=active();
 $('logo-watermark').disabled=busy;
 $('load-moa').disabled=busy;
 $('clear-moa').disabled=busy;
 $('clear-moa').hidden=!moaLibrary;
 $('moa-status').textContent=moaLibrary?`${moaLibrary.rates.size} rates loaded · ${moaLibrary.label} · private to this browser.`:'Load your private MOA file once, or enter a margin on any share.';
 $('chart-display').disabled=busy;
 $('chart-years').value=String(chart.years);
 for(const key of C.overlayKeys)$('chart-'+key).checked=chart[key];
 $('chart-cone').checked=chart.cone;
 $('include-equity').checked=includeEquity;
 $('include-equity').disabled=busy;
 $('include-terms').checked=includeTerms;
 $('include-terms').disabled=busy;
 const extra=[includeEquity&&'one page per share',includeTerms&&'one SI schedule page'].filter(Boolean).join(' + ');
 $('equity-pages-note').textContent=extra&&p?`${pdfCount([p])} A4 pages · main page + ${extra}`:'Add appendices to the selected PDF.';
 $('logo-watermark').setAttribute('aria-pressed',String(showWatermarks));
 $('logo-watermark-state').textContent=showWatermarks?'On':'Off';
$('pdf-one').disabled=!p||dirty||busy||bosWorking||loading.has(p?.id);$('pdf-all').disabled=!pages.length||dirty||busy||bosWorking||loading.size>0;for(const k of ['duplicate-page','remove-page','refresh-page'])$(k).disabled=!p||dirty||busy||(k==='refresh-page'&&loading.has(p?.id));for(const k of ['apply-page','apply-pending','discard-pending','new-page','undo-remove','backup-pages','restore-pages'])$(k).disabled=busy;$('pending-edits').hidden=!dirty;$('apply-pending').textContent=p?'Apply changes':'Create one-pager';$('page-count').textContent=pages.length;$('pdf-all').textContent=busy?'Creating PDF…':`↓ All pages PDF${pages.length?' ('+pdfCount(pages)+')':''}`;}
function preflight(p){const messages=[];if(!p||loading.has(p.id)){$('data-check').hidden=true;return;}const data=assets[p.id]||{},missingPrice=[],missingHistory=[],missingDescription=[];for(const s of p.shares){const d=data[s.symbol]||{};if(C.reference(p,s,d).value===null)missingPrice.push(s.symbol);if(C.chartWindow(d,chart).prices.length<2)missingHistory.push(s.symbol);if(!(s.description||d.description))missingDescription.push(s.symbol);}if(missingPrice.length)messages.push('Reference price unavailable: '+missingPrice.join(', ')+'. Enter a manual reference price or choose a date with a saved close.');if(missingHistory.length)messages.push('Price history unavailable: '+missingHistory.join(', ')+'.');if(missingDescription.length)messages.push('Company description not supplied: '+missingDescription.join(', ')+'. Add it in share details.');$('data-check').hidden=!messages.length;$('data-check-text').textContent=messages.join(' ')+' The PDF will retain these gaps.';}
function renderEquityPreview(){const p=active(),holder=$('equity-preview');
 holder.hidden=!p||!(includeEquity||includeTerms);
 const plan=p&&holder.open?pdfPlan([p]):[];
 $('equity-preview-pages').innerHTML=plan.slice(1).map((entry,i)=>
  renderPDFPage(entry,assets[p.id]||{},i+2,plan.length,showWatermarks)).join('');
}
function render(){const p=active();
 renderEquityPreview();
 renderConeChecks();
 $('page-tabs').innerHTML=pages.map((x,i)=>`<button role="tab" id="tab-${E(x.id)}" aria-controls="preview" aria-selected="${x.id===activeId}" tabindex="${x.id===activeId?0:-1}" data-page="${E(x.id)}" title="${E(x.shares.map(s=>s.symbol).join(' / '))}" aria-label="Page ${i+1}: ${E(x.shares.map(s=>s.symbol).join(' / '))}">${i+1}</button>`).join('');if(p){$('preview').innerHTML=renderPage(p,assets[p.id]||{},pages.indexOf(p)+1,pages.length);$('preview').setAttribute('aria-labelledby','tab-'+p.id);}else{$('preview').removeAttribute('aria-labelledby');$('preview').innerHTML='<div class="empty-preview"><span>▤</span><h3>Your first one-pager starts here</h3><p>Complete the terms above or choose “Add page” from the reference list below.</p></div>';}
 $('preview-status').classList.toggle('dirty',dirty);$('preview-status').textContent=dirty?'The preview shows the last applied terms. Apply changes below before exporting.':p?(loading.has(p.id)?'Loading dated share data…':`Page ${pages.indexOf(p)+1} of ${pages.length} · ${p.shares.map(s=>s.symbol).join(' + ')} · ${storageOK?'saved in this browser':'not saved; download a collection backup'}`):'No pages yet.';preflight(p);buttons();}
function reviewedListing(item){
 if(!item)return null;
 const keys=[item.ticker,...(item.aliases||[])];
 const mappings=(window.BOSEquity?.reviewedListings||[]).filter(m=>m.verified===true&&m.currency===item.currency&&
  (!m.listingId||m.listingId===item.id)&&keys.includes(m.ticker));
 const matches=[...new Set(mappings.map(m=>m.instrumentId))];
 return matches.length===1?{instrumentId:matches[0],currency:item.currency}:null;
}
function renderConeChecks(){
 const p=active(),holder=$('cone-checks');holder.hidden=!p||!chart.cone;
 if(!p||!chart.cone){$('cone-check-rows').innerHTML='';return;}
 $('cone-check-rows').innerHTML=p.shares.map(share=>{
  const d=assets[p.id]?.[share.symbol]||{},check=C.coneAnalysis(d),model=check.primary;
  if(!model?.points)return `<section><h4>${E(share.symbol)}</h4><p>${E(loading.has(p.id)?'Loading source checks…':model?.reason||'History unavailable.')}</p></section>`;
  const anchor=`${d.currency||''} ${C.fmt(model.anchor.close,4)} · ${d.quoteSource||'Saved close'} · ${model.anchor.date}`;
  const rows=check.models.map(m=>`<dl class="cone-source-row" data-cone-source="${E(m.id)}">
   <div><dt>Source</dt><dd>${E(m.label)}${m.id==='bos'?` · ${m.splits} documented split${m.splits===1?'':'s'}`:''}</dd></div>
   <div><dt>Sample</dt><dd>${m.count} monthly returns<small>${E(m.from)} to ${E(m.to)}</small></dd></div>
   <div><dt>Full-sample annual volatility</dt><dd>${E(C.fmt(m.sigma*Math.sqrt(12)*100,1)+"%")}</dd></div>
   <div><dt>12-month ±2 SD range</dt><dd>${E(C.fmt(m.points[12].values[0],2))} – ${E(C.fmt(m.points[12].values[4],2))}</dd></div>
   <div><dt>Shared-date annual volatility</dt><dd>${Number.isFinite(m.matchedSigma)?E(C.fmt(m.matchedSigma*Math.sqrt(12)*100,1)+"%"):"Not comparable"}<small>${m.matchedCount} shared returns</small></dd></div>
   <div><dt>Shared-date check</dt><dd>${m.id===model.id?'Primary volatility source':m.review?'Review differences':`Volatility difference ${Number.isFinite(m.volGap)?(m.volGap<.001?'under 0.1%':C.fmt(m.volGap*100,1)+'%'):'unavailable'}`}</dd></div>
   <div class="cone-source-basis"><dt>Price basis</dt><dd>${E(m.basis||'Source basis unconfirmed')}${!m.splitAdjusted?' · diagnostic only':''}</dd></div>
  </dl>`).join('');
  return `<section><h4>${E(share.symbol)} · ${check.review?'Review source differences':check.matched?'Shared dates checked':check.models.length>1?'Source dates not comparable':'Single-source estimate'}</h4><p>Starts from ${E(anchor)}</p>${rows}${check.excluded?.length?`<p>${E(check.excluded.join('; '))}.</p>`:''}</section>`;
 }).join('');
}
async function chartHistory(item,valuation){
 const listing=valuation?.row||reviewedListing(item);
 if(!listing||listing.currency!==item?.currency)return null;
 const [history,editions]=await Promise.all([
  window.ShareLabData?.historyFor({id:`bb:${listing.instrumentId}|${listing.currency}`,currency:listing.currency}).catch(()=>null),
  window.BOSEquity?.valuationHistoryFor?.(item)?.catch(()=>[]),
 ]);
 return C.valuationPoints(listing,history,[...(editions||[]),...(valuation?[valuation]:[])]);
}
async function enrich(p){
 if(!p)return;
 const revision=(revisions[p.id]||0)+1;
 revisions[p.id]=revision;
 loading.add(p.id);
 render();
 await window.ShareStaticData?.load();
 const result={},wantOverlays=C.overlayKeys.some(key=>chart[key]);
 await Promise.all(p.shares.map(async share=>{
  const ticker=C.symbol(share.symbol);
  const item=window.MarketPrices.resolve(ticker)||window.BOSEquity?.itemFor(ticker);
  const profile=window.ShareStaticData?.find(item||ticker);
  const facts=profile?{name:profile.name,description:window.ShareStaticData.summary(profile),staticProfile:profile,profileImportedOn:window.ShareStaticData.metadata().importedOn}:{};
  const logo=companyLogo(item?.ticker,profile?.publicTicker,ticker);
  let market,valuation=window.BOSEquity?.valuationFor(item);
  const overlays=wantOverlays?bounded(chartHistory(item,valuation),'Valuation history timed out.',15000).catch(()=>null):null;
  try{
   const data=await bounded(window.MarketPrices.series(ticker),'Share data timed out.');
   const selected=window.MarketPrices.currentQuote?.(data.item);
   const quote=Number.isFinite(selected?.close)&&selected.close>0&&selected.date?selected:data.quote;
   const from=C.yearsBefore(quote.date,8);
   valuation=window.BOSEquity?.valuationFor(data.item)||valuation;
   market={
    name:data.item.name||facts.name,currency:data.item.currency,provider:data.item.provider||'Shared historical price feed',
    quote:{close:quote.close,date:quote.date},quoteSource:quote.sourceLabel||data.item.provider||'Saved close',daily:data.daily,
    points:window.MarketPrices.selectPoints(data.base,data.daily,from,quote.date),
    comparisonPrices:[...data.base.monthly,...data.base.weekly,...data.daily].filter(p=>p[0]>=from),
    sourceUrl:window.MarketPrices.sourceUrl(data.item.history_url),basis:data.item.basis||''
   };
  }catch{
   const quote=window.MarketPrices.currentQuote?.(item);
   market={error:'Exact listing history unavailable. No substitute listing is used.',
    ...(Number.isFinite(quote?.close)&&quote.close>0&&quote.date?{
     quote:{close:quote.close,date:quote.date},quoteSource:quote.sourceLabel||'Saved quote',currency:item?.currency,
    }:{})};
  }
  const listing=valuation?.row||reviewedListing(item);
  const moaTicker=listing?.instrumentId||profile?.bbTicker||item?.bbTicker;
  const moaCurrency=item?.currency||listing?.currency||profile?.currency;
  const identity={...(item||{}),ticker:moaTicker||ticker,currency:moaCurrency};
  const coneSources=chart.cone?bounded(Promise.resolve(window.SIConeSources?.histories(identity,market)),'Cone source comparison timed out.',15000).catch(()=>[]):null;
  const fundamentals=await bounded(Promise.resolve(window.CompanyFundamentals?.snapshot(identity)),'Company statements timed out.',12000).catch(()=>null);
  const statementFx=window.SIStatementCurrency?.forListing(fundamentals,market.currency||moaCurrency).catch(()=>({}));
  const bbg=window.ShareEnrichment?.find(identity);
  const creditReports=await bounded(Promise.resolve(window.CompanyCreditData?.load()),'Credit research timed out.',12000).then(rows=>window.CompanyCreditData?.forListing(rows,moaTicker||ticker)||[]).catch(()=>[]);
  const coneHistories=await coneSources;
  if(!market.points?.length&&market.quote){
   const bos=coneHistories?.find(source=>source.id==='bos'&&source.splitAdjusted===true);
   if(bos){
    const from=C.yearsBefore(market.quote.date,8);
    market.points=[...new Map(bos.points.filter(([date,value])=>typeof date==='string'&&date>=from&&date<=market.quote.date&&Number.isFinite(value)&&value>0)).entries()].sort((a,b)=>a[0].localeCompare(b[0]));
    market.comparisonPrices=market.points;market.provider='Bank of Singapore archive';market.basis=bos.basis;
    if(market.points.length)delete market.error;
   }
  }
  result[share.symbol]={...facts,...market,logo:await logo,overlays:await overlays,moaTicker,moaCurrency,isin:item?.isin,
   fundamentals,statementFx:await statementFx,coneHistories,creditRatings:window.SIEquityPages?.ratings(bbg)||[],creditOutlook:bbg?.creditOutlook?.value||'',creditReports,
   bosKey:bosFiles?.listingKey(listing?.instrumentId||profile?.bbTicker,listing?.currency||profile?.currency),
   metrics:valuation?.row||null,metricsDate:valuation?.reportDate||'',metricsBasis:valuation?.basis||''
  };
 }));
 if(revisions[p.id]!==revision)return;
 loading.delete(p.id);
 if(pages.some(x=>x.id===p.id)){assets[p.id]=result;invalidatePDF();}
 render();
}

function select(pageId){if(protectEdits())return;activeId=pageId;fill(active());persist();render();}
function add(p){if(pages.length>=LIMIT){notice(`A collection can contain up to ${LIMIT} pages. Save it before starting another collection.`);return;}invalidatePDF();p.id=id();pages.push(p);activeId=p.id;loading.add(p.id);fill(p);persist();render();enrich(p);$('preview-title').scrollIntoView({behavior:'smooth',block:'start'});}
function changed(event){
 const field=event?.target;
 if(field?.id==='load-moa')return;
 const slot=field?.name?.match(/^share([0-3])$/)?.[1],prior=active()?.shares[slot];
 if(prior&&C.symbol(field.value)!==prior.symbol)form.elements['moa'+slot].value='';
 dirty=true;invalidatePDF();$('editor-note').textContent=active()?'Edited terms will apply when you choose Update one-pager.':'Complete the terms, then create your one-pager.';buttons();$('preview-status').textContent='The preview shows the last applied terms. Apply changes below before exporting.';$('preview-status').classList.add('dirty');
}
form.addEventListener('input',changed);
form.addEventListener('change',changed);
form.addEventListener('submit',e=>{e.preventDefault();if(busy)return;const p=read(),errors=C.validate(p);if(errors.length){$('form-errors').textContent=errors.join(' ');$('form-errors').scrollIntoView({behavior:'smooth',block:'center'});return;}invalidatePDF();if(active()){const index=pages.findIndex(x=>x.id===activeId);p.id=activeId;pages[index]=p;loading.add(p.id);fill(p);persist();render();enrich(p);}else add(p);});
$('apply-pending').addEventListener('click',()=>form.requestSubmit());
$('discard-pending').addEventListener('click',()=>{fill(active());render();});
$('edit-details').addEventListener('click',()=>{document.querySelector('.more-terms').open=true;$('share-details').scrollIntoView({behavior:'smooth',block:'start'});});
$('zoom-preview').addEventListener('click',()=>{const zoom=$('preview').classList.toggle('actual-size');$('zoom-preview').setAttribute('aria-pressed',String(zoom));$('zoom-preview').textContent=zoom?'Fit page':'Enlarge preview';});
$('load-moa').addEventListener('change',async event=>{
 const input=event.target,file=input.files?.[0];
 if(!file||busy)return;
 try{
  if(file.size>1000000)throw Error('Choose a private MOA file under 1 MB.');
  const raw=await file.text(),next=C.parseMoa(JSON.parse(raw));
  if(busy)return;
  localStorage.setItem(MOA_KEY,raw);
  moaLibrary=next;invalidatePDF();render();
 }catch(e){notice(e.message||'The private MOA file could not be loaded.');}
 finally{input.value='';}
});
$('clear-moa').addEventListener('click',()=>{
 if(busy)return;
 try{localStorage.removeItem(MOA_KEY);}catch{notice('The private MOA file could not be cleared.');return;}
 moaLibrary=null;invalidatePDF();render();
});
bosFiles?.read().then(raw=>{
 if(raw){bosArchive=bosFiles.parse(raw);invalidatePDF();}
}).catch(()=>{}).finally(()=>{bosWorking=false;render();});
$('chart-display').addEventListener('change',()=>{
 if(busy)return;
 const wasEnabled=C.overlayKeys.some(key=>chart[key]);
 const wasCone=chart.cone;
 chart=C.chartOptions({years:Number($('chart-years').value),cone:$('chart-cone').checked,...Object.fromEntries(C.overlayKeys.map(key=>[key,$('chart-'+key).checked]))});
 try{localStorage.setItem(CHART_KEY,JSON.stringify(chart));}catch{/* Use the current session setting. */}
 invalidatePDF();
 if(!wasEnabled&&C.overlayKeys.some(key=>chart[key])||!wasCone&&chart.cone)pages.forEach(enrich);
 render();
});
$('include-equity').addEventListener('change',()=>{
 if(busy)return;
 includeEquity=$('include-equity').checked;
 try{localStorage.setItem(EQUITY_KEY,includeEquity?'on':'off');}catch{/* Session-only option. */}
 invalidatePDF();render();
});
$('include-terms').addEventListener('change',()=>{
 if(busy)return;
 includeTerms=$('include-terms').checked;
 try{localStorage.setItem(TERMS_KEY,includeTerms?'on':'off');}catch{/* Session-only option. */}
 invalidatePDF();render();
});
$('equity-preview').addEventListener('toggle',renderEquityPreview);
document.addEventListener('fundamentals-updated',()=>{if(!busy)pages.forEach(enrich);});
$('logo-watermark').addEventListener('click',()=>{
 if(busy)return;
 showWatermarks=!showWatermarks;
 try{localStorage.setItem(WATERMARK_KEY,showWatermarks?'on':'off');}catch{/* Use the current session setting. */}
 invalidatePDF();
 render();
});
$('new-page').addEventListener('click',()=>{if(protectEdits())return;activeId='';fill();render();$('editor-title').scrollIntoView({behavior:'smooth'});});
$('page-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b)select(b.dataset.page);});
$('page-tabs').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();if(dirty)return;let index=pages.findIndex(p=>p.id===activeId);index=e.key==='Home'?0:e.key==='End'?pages.length-1:(index+(e.key==='ArrowRight'?1:-1)+pages.length)%pages.length;select(pages[index].id);document.getElementById('tab-'+activeId)?.focus();});
$('duplicate-page').addEventListener('click',()=>{if(active())add(structuredClone(active()));});
$('remove-page').addEventListener('click',()=>{if(!active()||protectEdits())return;invalidatePDF();removed={page:active(),index:pages.indexOf(active())};loading.delete(activeId);revisions[activeId]=(revisions[activeId]||0)+1;pages=pages.filter(p=>p.id!==activeId);activeId=pages[Math.min(removed.index,pages.length-1)]?.id||'';$('undo-remove').hidden=false;fill(active());persist();render();notice('Page removed. Undo is available.');});
$('undo-remove').addEventListener('click',()=>{if(!removed||protectEdits())return;if(pages.length>=LIMIT){notice('Remove a page before undoing: the collection already has 30 pages.');return;}invalidatePDF();pages.splice(removed.index,0,removed.page);activeId=removed.page.id;removed=null;$('undo-remove').hidden=true;loading.add(activeId);fill(active());persist();render();enrich(active());});
$('refresh-page').addEventListener('click',async()=>{
 const p=active();
 if(!p||protectEdits())return;
 invalidatePDF();
 pages.forEach(page=>loading.add(page.id));
 render();
 try{
  await bounded(Promise.all([
   window.MarketPrices.refresh(true),window.BOSEquity?.refresh(true),window.CompanyFundamentals?.refreshPublic?.(),
   C.overlayKeys.some(key=>chart[key])?window.ShareLabData?.load(true):null
  ]),'Data refresh timed out.');
 }catch{notice('Some data could not refresh. Available saved data will be used.');}
 if(!pages.includes(p))loading.delete(p.id);
 pages.forEach(enrich);
 if(!pages.length)render();
});
const referenceTable=window.SIReferenceTable;
const urlParams=new URLSearchParams(window.location?.search||'');
let refs=[],referenceSteps={},referenceLoading=false,referenceError=false,libraryCurrency='All',libraryCompany=referenceTable?.codeFor(urlParams.get('company'))||'';
const libraryAliases={DBSM:'D05.SI',UOBH:'U11.SI',SGXL:'S68.SI',STEL:'Z74.SI',STEG:'S63.SI',SIAL:'C6L.SI',SKHY:'000660.KS'};
const libraryQuick=window.SIQuickFilters?.create({
 rows:()=>refs,stepDown:reference=>referenceSteps[reference]??null,namespace:'si-b2-q',simple:true,
 getIdentity(code){const ticker=libraryAliases[code]||code,item=window.MarketPrices?.resolve(ticker);return {name:item?.name||code,file:pickerLogos.get(ticker)||pickerLogos.get(code)};}
});
function mountLibraryQuick(){
 if(!libraryQuick||!refs.length)return;
 const holder=$('library-quick-filter');
 if(!holder.dataset.ready){holder.innerHTML=libraryQuick.render({currency:libraryCurrency,query:'',reviewOnly:false});holder.dataset.ready='true';}
}
function libraryShares(row){return `<span class="ticker si-library-shares" aria-label="${E(row.shares.join(' / '))}">${row.shares.map(code=>{const ticker=libraryAliases[code]||code,file=pickerLogos.get(ticker)||pickerLogos.get(code),name=window.MarketPrices?.resolve(ticker)?.name||code;return `<span class="si-library-share" title="${E(name)} (${E(code)})">${file?`<img src="${E(LOGO_BASE+file)}" width="20" height="20" alt="" loading="lazy">`:'<span class="si-library-logo-fallback" aria-hidden="true"></span>'}<span>${E(code)}</span></span>`;}).join('')}</span>`;}
function renderLibrary(){
 const scope=$('library-company-scope');
 if(scope){scope.hidden=!libraryCompany;$('library-company-code').textContent=libraryCompany;}
 const q=$('library-search').value.trim().toLowerCase(),ccy=libraryQuick?libraryCurrency:($('library-currency')?.value||''),filtered=refs.filter(r=>(!libraryCompany||r.shares.includes(libraryCompany))&&(list!=='saved'||watch.includes(r.reference))&&(!ccy||ccy==='All'||r.currency===ccy)&&(!libraryQuick||libraryQuick.matches(r))&&[r.reference,...r.shares,r.source_date||'',...r.shares.map(s=>window.MarketPrices?.resolve(s)?.name||'')].join(' ').toLowerCase().includes(q));$('watch-count').textContent=watch.length;$('library-count').textContent=refs.length?`${filtered.length} of ${refs.length} historical records${list==='saved'?' · your SI watchlist':''}`:referenceLoading?'Loading saved SI references...':'Reference list unavailable. You can still create pages manually.';$('library-retry').hidden=!referenceError;mountLibraryQuick();
 $('library-rows').innerHTML=filtered.map(r=>{
  const step=referenceSteps[r.reference]??null;
  return `<tr data-currency="${E(r.currency)}" data-tc-company-codes="${E(r.shares.join(' '))}"><td><button class="star" data-star="${E(r.reference)}" aria-pressed="${watch.includes(r.reference)}" aria-label="${watch.includes(r.reference)?'Remove':'Save'} ${E(r.reference)} ${watch.includes(r.reference)?'from':'to'} SI watchlist">${watch.includes(r.reference)?'★':'☆'}</button></td>${referenceTable.cells(r,step,libraryShares(r))}<td><button data-add="${E(r.reference)}">＋ Add page</button></td></tr>`;
 }).join('')||'<tr><td colspan="11">'+(list==='saved'?'Save a reference with ☆ to build your SI watchlist.':'No matching references.')+'</td></tr>';
 openRequestedReference();
 if(libraryQuick)libraryQuick.sync(filtered.length);
 else {const select=$('library-currency'),currencies=[...new Set(refs.map(r=>r.currency))].sort();if(select&&select.options.length!==currencies.length+1){select.innerHTML='<option value="">All currencies</option>'+currencies.map(c=>`<option>${E(c)}</option>`).join('');select.value=ccy;}}}
let requestedReference=urlParams.get('reference');
function addReference(row){
 const page=C.fromReference(row,referenceSteps[row.reference]??null);
 if(page.couponBasis==='unconfirmed'&&!C.isBonusEnhanced(row)){
  page.couponBasis='per_annum';
  page.source.couponAssumed=true;
 }
 add(page);
}
function openRequestedReference(){
 if(!requestedReference||!refs.length)return;
 const reference=requestedReference;
 requestedReference=null;
 const row=refs.find(record=>record.reference===reference);
 if(!row){notice('SI reference unavailable. Check the reference library.');return;}
 const existing=pages.find(page=>page.source?.reference===reference);
 if(existing){
  select(existing.id);
  $('preview-title').scrollIntoView({block:'start'});
 }else addReference(row);
}
async function loadReferenceLibrary(force=false){
 if(referenceLoading)return;
 referenceLoading=true;referenceError=false;
 renderLibrary();
 try{
  const data=await C.loadReferences(force);
  refs=data.rows;referenceSteps=data.ko_step_down_pp||{};
 }catch{referenceError=true;}
 finally{referenceLoading=false;renderLibrary();}
}
function clearLibraryCompany(){
 libraryCompany='';
 if(!urlParams.has('company'))return;
 urlParams.delete('company');
 const query=urlParams.toString();
 window.history.replaceState(window.history.state,'',window.location.pathname+(query?'?'+query:'')+window.location.hash);
}
$('library-clear-company')?.addEventListener('click',()=>{clearLibraryCompany();renderLibrary();$('library-search').focus();});
const quickHolder=$('library-quick-filter');
quickHolder?.addEventListener('input',event=>{if(libraryQuick?.handle(event.target))renderLibrary();});
quickHolder?.addEventListener('change',event=>{
 if(!libraryQuick)return;
 if(event.target.id===libraryQuick.id('si-currency')){libraryCurrency=event.target.value;renderLibrary();}
 else if(libraryQuick.handle(event.target))renderLibrary();
});
quickHolder?.addEventListener('click',event=>{
 if(!libraryQuick||!event.target.closest('[data-si-b2-q-reset]'))return;
 window.MarketTableControls?.clearSiFilters($('library-rows').closest('table'));
 libraryQuick.reset();libraryCurrency='All';clearLibraryCompany();$('library-search').value='';
 const currency=$(libraryQuick.id('si-currency'));if(currency)currency.value='All';renderLibrary();
});
for(const event of ['market-prices-updated','bos-equity-updated','share-static-updated'])document.addEventListener(event,()=>{if(refs.length)renderLibrary();});
$('library-rows').addEventListener('click',e=>{const star=e.target.closest('[data-star]'),button=e.target.closest('[data-add]');if(star){const ref=star.dataset.star;watch=watch.includes(ref)?watch.filter(x=>x!==ref):[...watch,ref];persist();renderLibrary();}if(button){if(protectEdits())return;const row=refs.find(r=>r.reference===button.dataset.add);if(row)addReference(row);}});
document.querySelectorAll('[data-list]').forEach(b=>b.addEventListener('click',()=>{list=b.dataset.list;document.querySelectorAll('[data-list]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));renderLibrary();}));$('library-search').addEventListener('input',renderLibrary);$('library-currency')?.addEventListener('change',renderLibrary);$('library-retry').addEventListener('click',()=>loadReferenceLibrary(true));
function download(bytes,type,name){const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
let pdfLibrary;
async function getPDFLib(){if(window.PDFLib)return window.PDFLib;if(!pdfLibrary){const s=document.createElement('script');pdfLibrary=bounded(new Promise((resolve,reject)=>{s.src='vendor/pdf-lib-1.17.1.min.js';s.onload=()=>window.PDFLib?resolve(window.PDFLib):reject(Error('PDF exporter is unavailable.'));s.onerror=()=>reject(Error('PDF exporter could not load. Try again.'));document.head.append(s);}), 'PDF exporter timed out. Try again.').catch(e=>{pdfLibrary=null;s.remove();throw e;});}return pdfLibrary;}
async function imageBytes(svg){const blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob);try{const img=new Image();await new Promise((ok,no)=>{img.onload=ok;img.onerror=()=>no(Error('Preview could not be converted to a PDF page.'));img.src=url;});const canvas=document.createElement('canvas');canvas.width=C.W*2;canvas.height=C.H*2;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);const png=await new Promise(ok=>canvas.toBlob(ok,'image/png'));if(!png)throw Error('PDF image creation failed.');return new Uint8Array(await png.arrayBuffer());}finally{URL.revokeObjectURL(url);}}
async function exportPDF(all){if(busy||dirty||bosWorking)return;const selected=all?pages:[active()];if(!selected[0]||selected.some(p=>loading.has(p.id)))return;const errors=selected.flatMap((p,i)=>C.validate(p).map(v=>`Page ${i+1}: ${v}`));if(errors.length){notice(errors.join(' '));return;}const snapshot=structuredClone(selected),data=structuredClone(assets),watermarks=showWatermarks,plan=pdfPlan(snapshot);invalidatePDF();busy=true;buttons();$('export-progress').hidden=false;try{const lib=await getPDFLib(),images=[],linksByPage=[];for(let i=0;i<plan.length;i++){$('export-progress').textContent=`Preparing PDF page ${i+1} of ${plan.length}…`;const links=[],entry=plan[i],page=entry.page;linksByPage.push(links);
 const svg=renderPDFPage(entry,data[page.id]||{},i+1,plan.length,watermarks,links);
 images.push(await bounded(imageBytes(svg),'This page could not render. Please try again.'));}const bytes=await C.pdfFromImages(images,lib,linksByPage),name=all?'SI-one-pagers.pdf':'SI-'+snapshot[0].shares.map(s=>s.symbol).join('-').replace(/[^A-Z0-9.-]/g,'-')+'.pdf';
 // Explicit links keep the generated file usable when a browser blocks automatic downloads.
 if(dirty){$('export-progress').textContent='Terms changed during export. Apply your changes and generate a new PDF.';return;}
 pdfURL=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));$('download-pdf').href=pdfURL;$('download-pdf').download=name;$('open-pdf').href=pdfURL;$('pdf-ready-text').textContent=`${plan.length}-page PDF ready · ${name}`;$('pdf-ready').hidden=false;$('export-progress').hidden=true;$('download-pdf').click();notice('PDF ready. Use Download PDF or Open PDF below if it did not save.');
 }catch(e){$('export-progress').textContent=e.message||'PDF export failed. Your pages are retained. Select PDF to try again.';notice($('export-progress').textContent);}finally{busy=false;buttons();}}
$('pdf-one').addEventListener('click',()=>exportPDF(false));$('pdf-all').addEventListener('click',()=>exportPDF(true));
$('backup-pages').addEventListener('click',()=>{if(protectEdits())return;download(JSON.stringify({version:1,pages,watch},null,2),'application/json','SI-beta2-collection.json');});
$('restore-pages').addEventListener('click',e=>{if(protectEdits())e.preventDefault();});
$('restore-pages').addEventListener('change',async e=>{try{if(protectEdits())return;const file=e.target.files?.[0];if(!file)return;if(file.size>500000)throw Error('Collection file is too large.');const input=JSON.parse(await file.text());if(protectEdits())return;if(input.version!==1||!Array.isArray(input.pages)||pages.length+input.pages.length>LIMIT)throw Error('Invalid collection or too many pages.');const added=input.pages.map(normalize);if(added.some(p=>C.validate(p).length))throw Error('Collection includes invalid terms. No pages were imported.');invalidatePDF();for(const p of added){p.id=id();pages.push(p);loading.add(p.id);}watch=[...new Set([...watch,...(Array.isArray(input.watch)?input.watch.filter(x=>/^SI-\d{3,}$/.test(x)):[])])];activeId=added[0]?.id||activeId;fill(active());persist();render();renderLibrary();added.forEach(enrich);notice(`Added ${added.length} pages. Your existing collection was preserved.`);}catch(error){notice(error.message||'Collection could not be loaded.');}finally{e.target.value='';}});
restore();pages.forEach(p=>loading.add(p.id));fill(active());render();loadReferenceLibrary();bounded(Promise.all([window.MarketPrices.refresh(),window.BOSEquity?.refresh(),window.ShareStaticData?.load(),window.ShareEnrichment?.load()]),'Initial data load timed out.').catch(()=>notice('Some share data is unavailable. You can use manual prices and retry Refresh data.')).finally(()=>{updateSharePicker();renderLibrary();pages.forEach(enrich);});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
})();
