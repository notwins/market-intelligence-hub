(() => {
  'use strict';
  const G=window.FilingGeography,Marks=window.FilingMarks;
  const regionalGrowth=new Intl.NumberFormat('en-GB',{maximumFractionDigits:1});
  const M=window.FilingComparison, E=window.SharesComparison, $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const D=window.FilingNotes, Notes=window.FilingNotesView, Q=window.SharesQuarterlyCore, USD=window.SharesBeta3Usd;
  const colors=['#176b5a','#41679b','#9a602b','#76558d','#a5455a','#267a89','#646b30','#584c89','#a45132','#3f6b41','#784a66','#4c596f','#966545','#6d497d','#8a752f','#216a80','#a44a64'];
  const defaultFocus=['peTTM','peFY','evEbitda','proxyEvEbitda','forwardPE','qGrowth','qNetMargin','revenue','operatingIncome','netIncome','ebitda','totalDebt','equity','operatingCashFlow','freeCashFlow','revenueGrowth','operatingMargin','roe','fcfMargin'];
  const state={data:null,focus:'',custom:null,size:9,period:'latest',bonus:[],fx:null,supplement:{},quarterEndMarkets:{},growth:'yoy',unit:'bn',filter:'all',stars:new Set(defaultFocus),
    draft:[],quarterly:null,peerQuarterly:{},published:null,privateData:null,details:{},annualSort:{key:'score',ascending:false},quarterSort:{key:'netAssetsRatio',ascending:false},quarterDetails:null,autoFocus:new Set(),dropped:new Set()};
  ['core-revenue','core-netIncome','core-operatingCashFlow','core-freeCashFlow','core-cash','core-totalDebt','core-revenueGrowth','core-netMargin','core-fcfMargin','core-roe','core-roa','core-currentRatio','core-liabAssets','solvency-rank','solvency-score','recent-cash','recent-disclosedCash','recent-cashIncludingRestricted','recent-cashShort','note-cash','note-cashShort','note-treasuries','note-assets','note-ppe','note-totalDebt','note-liabilities','note-leasesTotal','note-interestCover','note-equityAssets','note-debtCoverage','note-cet1','note-firstDebtDue','note-shortDebtShare','note-dueCash','due-debt-y1','due-debt-y2','due-debt-total','due-operatingLease-y1','due-financeLease-y1','due-allLeases-y1'].forEach(k=>state.stars.add(k));
  const highlighted=k=>state.stars.has(k)||(state.autoFocus.has(k)&&!state.dropped.has(k));
  const pct=n=>USD.integer(n,'%');
  const times=n=>USD.integer(n,'×');
  const date=iso=>iso?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(iso+'T00:00:00Z')):'';
  const cmult=new Set(['currentRatio','debtEquity','assetTurnover','cashConversion','interestCover']);
  const quarterFields={
    revenue:'Quarterly revenue / total income',grossProfit:'Quarterly gross profit',operatingIncome:'Quarterly operating profit',
    netIncome:'Quarterly net income',dilutedEps:'Quarterly diluted EPS',cash:'Cash and equivalents',
    operatingCashFlow:'Quarterly operating cash flow',investingCashFlow:'Quarterly investing cash flow',financingCashFlow:'Quarterly financing cash flow',
    capex:'Quarterly capital expenditure',freeCashFlow:'Quarterly free cash flow',equity:'Owners’ equity',
    assets:'Total assets',liabilities:'Total liabilities',totalDebt:'Interest-bearing debt',
    currentAssets:'Current assets',currentLiabilities:'Current liabilities'
  };
  const quarterRatios={
    revenueGrowth:'Revenue growth',profitGrowth:'Net income growth',grossMargin:'Gross margin',
    operatingMargin:'Operating margin',netMargin:'Net margin',fcfMargin:'Free cash flow margin',cashMargin:'Operating cash flow margin',
    roe:'Return on equity · trailing',roa:'Return on assets · trailing',currentRatio:'Current ratio',cashConversion:'Cash conversion',
    cashAssets:'Cash / total assets',cashDebt:'Cash / interest-bearing debt',debtAssets:'Debt / assets',liabAssets:'Liabilities / assets',
    equityAssets:'Owners’ equity / assets',cashCurrent:'Cash / current liabilities',debtCoverage:'Trailing operating cash flow / debt',
    interestCover:'Trailing operating profit / interest expense',assetTurnover:'Asset turnover · trailing'
  };
  const scaleFields={netAssets:'Net assets',workingCapital:'Working capital',cashShort:'Cash and short-term investments',
    netDebt:'Net debt',noncurrentAssets:'Non-current assets',noncurrentLiabilities:'Non-current liabilities'};
  const allLabels={...M.fields,...M.labels,...E.marketLabels,...E.quarterLabels,...E.coreMarketLabels,
    ...Object.fromEntries([...Object.entries(quarterFields),...Object.entries(quarterRatios),...Object.entries(scaleFields)].map(([k,v])=>['core-'+k,v]))};
  function latestValues(c,i){
    return c.current[i]?.values||{};
  }
  const opt=(v,label)=>`<option value="${esc(v)}">${esc(label)}</option>`;
  const amount=n=>Number.isFinite(n)?'USD '+USD.integer(n/(state.unit==='bn'?1000:1),state.unit==='bn'?'bn':'m'):'—';
  const quarterEnd=key=>key?key.slice(0,4)+'-'+['03-31','06-30','09-30','12-31'][Number(key.at(-1))-1]:null;
  const usd=(c,i,n,end,currency)=>USD.convert(state.fx,n,currency||c.companies[i].currency,end);
  function columnEnd(c,i){
    return c.isQuarter?(c.current[i]?.ended||quarterEnd(c.calendar)):c.years[i]?.end;
  }
  function available(n,end,currency){
    return Number.isFinite(n)&&currency!=='USD'&&!USD.rate(state.fx,currency,end)?'No dated USD exchange rate.':null;
  }
  function link(url,text) {
    try {if(new URL(url).protocol!=='https:')return esc(text);}catch{return esc(text);}
    return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>`;
  }
  const lookup=id=>Object.hasOwn(state.data.companies,id)?state.data.companies[id]:undefined;
  const listing=()=>state.data.listings.find(l=>l.ticker===state.focus);
  function getBOS() {
    const l=listing(), aliases=[l.ticker,lookup(l.id).ticker,...state.data.listings.filter(x=>x.id===l.id).map(x=>x.ticker)];
    for(const lib of [state.privateData,state.published])for(const alias of aliases){
      const r=lib?.listings?.[alias]?.peers;if(r)return r;
    }
    return null;
  }
  function comparison() {
    const focus=listing(), report=getBOS(), members=E.reportMembers(state.data,report,focus.id);
    const mapped=members.filter(x=>!x.subject&&x.id).map(x=>x.id);
    const candidates=E.candidates(state.data,focus.id,mapped);
    const peers=state.custom??Array.from(candidates.keys()).slice(0,state.size);
    const direct=[focus.id,...peers], ids=USD.peers(focus.id,peers,state.bonus);
    const companies=ids.map(lookup), bonus=ids.map(id=>!direct.includes(id));
    const ticker=companies.map((co,i)=>i===0?state.focus:bonus[i]&&co.ticker==='GOOG US'?'GOOGL US':co.ticker);
    const periods=M.periods(companies);
    const records=ids.map((id,i)=>USD.mergeRecord(Q.listing(state.quarterly,ticker[i],id)||state.peerQuarterly[id],state.supplement[id]));
    const indexes=records.map((record,i)=>Q.quarterIndex(record,companies[i].period,state.data.asOf));
    const {quarters}=Q.comparisonQuarters(indexes);
    const {latest}=Q.comparisonQuarters(indexes.slice(0,direct.length));
    const explicitQuarter=/^\d{4}-Q[1-4]$/.test(state.period);
    if(state.period!=='latest'&&!explicitQuarter&&!periods.includes(state.period))state.period='latest';
    const isQuarter=state.period==='latest'||explicitQuarter;
    const calendar=explicitQuarter?state.period:latest?.quarter;
    // Annual notes expose the most recent annual report available by the selected calendar quarter.
    const cutoff=quarterEnd(calendar);
    const years=companies.map(co=>isQuarter?co.years.find(y=>!cutoff||y.end<=cutoff):M.yearFor(co,state.period));
    const notes=ids.map((id,i)=>D.yearView(state.details,id,companies[i],years[i]));
    const current=records.map((record,i)=>{
      const observation=isQuarter?indexes[i].get(calendar):null;
      return observation?Q.view(USD.recordForObservation(record,observation),{currency:companies[i].currency,model:companies[i].model,observation,
        balanceFields:USD.matchedBalance(observation,notes[i].current),growthBasis:state.growth}):null;
    });
    const snapshotCalendar=state.data.asOf.slice(0,4)+'-Q'+Math.ceil(Number(state.data.asOf.slice(5,7))/3);
    const views=ids.map((id,i)=>E.valueView(state.data,id,ticker[i],years[i],state.period,current[i],{
      alignedQuarter:isQuarter,quarterMarket:isQuarter&&current[i]?state.quarterEndMarkets[calendar]?.[id]:null,
      useLatestMarket:isQuarter&&(calendar===latest?.quarter||calendar===snapshotCalendar)&&
        Boolean(current[i]&&current[i].observation===records[i]?.observations.at(-1))
    }));
    const quarterNotes=isQuarter?ids.map((id,i)=>{
      const view=D.quarterView(state.quarterDetails,id,companies[i],current[i],calendar);
      const reports=state.quarterDetails?.issuers[id]||{};
      return {...view,geographyBase:G.prior(reports,view.end,view.geo.geography,state.growth)};
    }):[];
    const check=isQuarter?(co,i,key)=>current[i]?.values[key]:undefined;
    const scale=companies.map((co,i)=>USD.scaleRows(isQuarter?current[i]?.values||{}:notes[i].v));
    return {ids,companies,ticker,peers,years,views,periods,quarters,latest,calendar,report,members,candidates,notes,
      isQuarter,current,quarterNotes,records,indexes,scale,bonus,periodLatest:isQuarter&&calendar===latest?.quarter,score:M.checklist(companies.slice(0,direct.length),years.slice(0,direct.length),check)};
  }
  function updateURL() {
    const u=new URL(location.href);
    u.searchParams.set('ticker',state.focus);
    for(const [k,v] of [['peers',state.custom?.join(',')],['count',state.size===9?null:state.size],['year',/^\d{4}$/.test(state.period)?state.period:null],['quarter',/^\d{4}-Q[1-4]$/.test(state.period)?state.period:null],['growth',state.growth==='qoq'?'qoq':null],['bonus',state.bonus.length?state.bonus.join(','):null]]){
      if(v==null)u.searchParams.delete(k);else u.searchParams.set(k,v);
    }
    history.replaceState(null,'',u);
  }
  function value(c,i,key) {
    if(key.startsWith('core-'))return Object.hasOwn(scaleFields,key.slice(5))?c.scale[i][key.slice(5)]:latestValues(c,i)[key.slice(5)];
    if(Object.hasOwn(E.coreMarketLabels,key))return c.views[i].values[key];
    return Object.hasOwn(E.marketLabels,key)||Object.hasOwn(E.quarterLabels,key)?c.views[i].values[key]:M.metric(c.companies[i],c.years[i],key);
  }
  function render() {
    const c=comparison(), cos=c.companies;
    const auto=c.latest?(c.latest.has10Q?'Latest 10-Q quarter · ':'Latest reported quarter · ')+Q.labelQuarter(c.latest.quarter):'Latest 10-Q quarter';
    const offered=c.quarters.map(({quarter,coverage})=>opt(quarter,Q.labelQuarter(quarter)+' · '+coverage+'/'+cos.length+' reporting'));
    if(c.isQuarter&&c.calendar&&!c.quarters.some(item=>item.quarter===c.calendar))offered.unshift(opt(c.calendar,Q.labelQuarter(c.calendar)+' · no filings'));
    $('period').innerHTML=opt('latest',auto)+'<optgroup label="Calendar quarter of period end">'+offered.join('')+'</optgroup>'+
      '<optgroup label="Annual filings">'+c.periods.map(y=>opt(y,'FY ending in '+y)).join('')+'</optgroup>';
    $('period').value=state.period;
    $('quarter-growth').hidden=!c.isQuarter;
    $('quarter-growth').querySelector('input[value="'+state.growth+'"]').checked=true;
    $('quarter-geo-growth').value=state.growth;
    $('peer-count').value=String(state.size);$('comparison').style.setProperty('--columns',cos.length);
    state.autoFocus=new Set(Notes.focusKeys(c));
    updateFocusPicker();
    $('bonus-choices').innerHTML=Object.entries(USD.choices).map(([id,symbol])=>{
      const already=c.ids.includes(id)&&!c.bonus[c.ids.indexOf(id)];
      const label=already?symbol+' is already in the comparison':symbol;
      return '<button type="button" data-bonus="'+id+'" aria-label="'+label+'" aria-pressed="'+(already||state.bonus.includes(id))+'"'+(already?' disabled':'')+'>'+esc(symbol)+'</button>';
    }).join('');
    $('peer-name').textContent=c.peers.length?c.peers.map(id=>lookup(id).name).join(' · '):'Add competitors';
    const reason=id=>c.candidates.get(id)||'Selected peer';
    const tally=new Map();for(const id of c.peers){const name=reason(id);tally.set(name,(tally.get(name)||0)+1);}
    const basis=Array.from(tally,([k,v])=>v+' '+({'BOS report peer':'from the BOS report','Industry peer':'industry','Related industry':'related industry','Selected peer':'manually added'}[k])).join(' · ');
    $('peer-basis').textContent=(state.custom?'Selected comparison':'Automatic comparison')+(basis?' · '+basis:'')+(state.custom===null&&c.peers.length<state.size?' · '+c.peers.length+' available':'');
    $('open-bos').hidden=!c.report;
    $('companies').innerHTML='<div class="column-label"><strong>Comparison item</strong></div>'+
      cos.map((co,i)=>`<div class="company-id" style="--company-color:${colors[i]}">${c.score.winners.includes(i)?'<span class="head-leader" title="Checklist leader" aria-label="Checklist leader">✓</span>':''}<span class="company-brand">${logo(c.ids[i],co.name)}<span class="company-name" title="${esc(co.name)}">${esc(co.name)}</span>${c.bonus[i]?'<small class="bonus-tag">Bonus</small>':''}</span></div>`).join('');
    renderCompanyContext(c,reason);
    renderDashboard(c);drawNotes(c);renderTables(c);renderSources(c);updateURL();
  }
  function renderCompanyContext(c,reason) {
    const labels=['Company','Listing','Reported in','FX used','Fiscal period','Period end','Peer selection','Industry'];
    const rows=c.companies.map((company,i)=>{
      const current=c.current[i], annual=c.years[i];
      const period=current?.period||(c.isQuarter?'No filing this quarter':annual?'Annual':'—');
      const periodEnd=current?.ended || (!c.isQuarter?annual?.end:null);
      const quote=(!c.isQuarter||current)?USD.rate(state.fx,company.currency,columnEnd(c,i)):null;
      const used=company.currency==='USD'||c.isQuarter&&!current?'—':quote?date(quote.date):'Unavailable';
      const cells=[c.ticker[i],company.currency,used,period,periodEnd?date(periodEnd):'—',i===0?'Focus company':c.bonus[i]?'Bonus company':reason(c.ids[i]),company.industry||'—'];
      return '<tr><th scope="row">'+esc(company.name)+'</th>'+cells.map(value=>'<td>'+esc(value)+'</td>').join('')+'</tr>';
    });
    $('company-context').innerHTML='<table><thead><tr>'+labels.map(label=>'<th scope="col">'+label+'</th>').join('')+
      '</tr></thead><tbody>'+rows.join('')+'</tbody></table>';
  }
  function renderDashboard(c){
    $('quarterly-dashboard-title').textContent=c.isQuarter?'Quarterly comparison charts':'Annual comparison charts';
    const companies=c.companies.map((co,i)=>{
      let values;
      if(c.isQuarter){
        values={...latestValues(c,i),peTTM:c.views[i].values.peTTMLatest,
          priceBook:c.views[i].values.priceBookLatest,priceSales:c.views[i].values.priceSalesTTM,
          evEbitda:c.views[i].values.evEbitdaTTM,proxyEvEbitda:c.views[i].values.proxyEvEbitdaTTM};
      }else{
        values={...c.notes[i].v,...Object.fromEntries(Object.keys(M.labels).map(k=>[k,M.metric(co,c.years[i],k)])),
          ...c.views[i].values,peTTM:c.views[i].values.peFY,freeCashFlow:M.metric(co,c.years[i],'freeCashFlow')};
      }
      const current=c.current[i],annual=c.years[i];
      const record=c.records[i];
      const history=c.isQuarter?Array.from(c.indexes[i]).filter(([key])=>key<=c.calendar).sort(([a],[b])=>a.localeCompare(b)).slice(-8).map(([key,observation])=>{
        const view=Q.view(record,{model:co.model,observation,growthBasis:state.growth});
        return {label:Q.labelQuarter(key),end:observation.end,periodLabel:view?.periodLabel,
          values:USD.valuesInUsd(state.fx,view?.values||{},co.currency,observation.end||quarterEnd(key))};
      }):[];
      const translated=USD.valuesInUsd(state.fx,values,co.currency,columnEnd(c,i));
      const missing={};
      for(const key of ['assets','liabilities','cash','netIncome','revenue','fcf','operatingCashFlow','equity','totalDebt']){
        if(Number.isFinite(translated[key]))continue;
        missing[key]=available(values[key],columnEnd(c,i),co.currency)||
          (c.isQuarter&&!current?'No quarterly filing available for this period.':'No comparable '+(c.isQuarter?'quarterly':'annual')+' figure in the source.');
      }
      for(const key of ['peTTM','evEbitda','priceBook'])if(!Number.isFinite(values[key])){
        const view=c.views[i];
        const nmKey=c.isQuarter?({peTTM:'peTTMLatest',evEbitda:'evEbitdaTTM',priceBook:'priceBookLatest'})[key]:key==='peTTM'?'peFY':key;
        missing[key]=c.isQuarter?USD.quarterlyReason(key,current,view.m,co.model):
          view.nm.has(nmKey)?'N/M · Nonpositive valuation inputs.':'No comparable annual valuation inputs.';
      }
      return {id:c.ids[i],name:co.name,ticker:c.ticker[i],model:co.model,currency:'USD',reportingCurrency:co.currency,
        isBonus:c.bonus[i],missing,logo:assetFile(c.ids[i]),
        periodLabel:c.isQuarter?(current?current.period+(current.ended?' · '+date(current.ended):''):'Quarter unavailable'):(annual?date(annual.end):'Annual period unavailable'),
        basisLabel:c.isQuarter?current?.kind:co.form,history,
        values:{...translated,earningsGrowth:values.profitGrowth,freeCashFlowMargin:values.fcfMargin,
          operatingCashFlowMargin:values.cashMargin,revenueTTM:translated.ttmRevenue,fcf:translated.freeCashFlow??translated.fcf}};
    });
    window.SharesQuarterlyCharts.render($('quarterly-charts'),{companies,period:c.isQuarter?'quarterly':'annual',
      periodLabel:c.isQuarter?(Q.labelQuarter(c.calendar)||'No reported quarter')+' · Calendar period end':'FY ending in '+state.period,
      growthBasis:c.isQuarter?state.growth:null,selectedQuarter:Q.labelQuarter(c.calendar),focus:c.ids[0]});
  }

  function head(c,title) {
    return `<caption class="sr-only">${esc(title)}</caption><thead class="sr-only"><tr><th scope="col">Comparison item</th>${c.companies.map(co=>`<th scope="col">${esc(co.name)}</th>`).join('')}</tr></thead>`;
  }
  function best(values,lower=false,digits=0) {
    const r=values.map(n=>Number.isFinite(n)?Number(n.toFixed(digits)):null),usable=r.filter(Number.isFinite);
    if(usable.length<2)return [];
    const lead=lower?Math.min(...usable):Math.max(...usable);
    return r.flatMap((n,i)=>n===lead?[i]:[]);
  }
  function rowCells(key,title,values,fmt,winners=[],interactive=true) {
    const starred=highlighted(key)&&interactive;
    const star=interactive?`<button class="row-star" type="button" data-star="${esc(key)}" aria-pressed="${starred}" aria-label="${esc((starred?'Remove highlight from ':'Highlight ')+title)}" title="${starred?'Remove row highlight':'Highlight row'}">${starred?'★':'☆'}</button>`:'';
    return `<tr data-row="${esc(key)}" class="${starred?'focus-row':''}"><th scope="row">${star}<span class="filing-row-label">${Marks.row(key,title)}<span>${esc(title)}</span></span></th>${values.map((v,i)=>{
      const win=winners.includes(i),formatted=fmt(v,i),detail=formatted&&typeof formatted==='object'?formatted:null,s=detail?detail.main:formatted,mark=win?`<span class="win-mark" title="${winners.length>1?'Joint leader':'Leader'}" aria-label="Leader">✓</span>`:'';
      const cellText=value=>typeof value==='string'&&value.endsWith('%')
        ?'<span class="filing-percent">'+esc(value)+'</span>':esc(value);
      return `<td class="${win?'winner':s==='—'||s==='N/M'?'unavailable':''}"${detail?.tip?' title="'+esc(detail.tip)+'"':''}>${mark}${cellText(s)}${detail?.sub?'<small class="cell-share">'+cellText(detail.sub)+'</small>':''}${detail?.growth?'<small class="cell-growth '+esc(detail.growthClass||'')+'">'+esc(detail.growth)+'</small>':''}</td>`;
    }).join('')}</tr>`;
  }
  function renderTables(c) {
    const display=(key,fmt,rank,lower=false)=>{
      if(state.filter==='focus'&&!highlighted(key))return '';
      const vals=c.ids.map((_,i)=>value(c,i,key));
      const wins=rank?best(vals,lower,0):[];
      const label=allLabels[key]+(c.isQuarter&&['qGrowth','core-revenueGrowth','core-profitGrowth'].includes(key)?' · '+(state.growth==='qoq'?'QoQ':'YoY'):'');
      function format(v,i){
        if(c.views[i].nm.has(key))return 'N/M';
        const market=c.views[i].m;
        const reportDate=key==='cap'||key==='ev'?market?.date:
          key.startsWith('core-')||Object.hasOwn(E.quarterLabels,key)?columnEnd(c,i):c.years[i]?.end;
        if(fmt===amount)return amount(usd(c,i,v,reportDate));
        if(key==='quotePrice')return USD.integer(usd(c,i,v,market?.quoteDate||market?.date,market?.quoteUnit||market?.quoteCurrency),' USD');
        if(key==='core-dilutedEps')return USD.integer(usd(c,i,v,columnEnd(c,i)),' USD');
        return fmt(v,i);
      }
      return rowCells(key,label,vals,format,wins);
    };
    const textRow=(k,title,fn)=>rowCells(k,title,c.ids.map((_,i)=>fn(i)),v=>v||'—',[],false);
    const headers=[
      ['valuation','Market valuation',[
        textRow('market-asof','Market value date',i=>date(c.views[i].m?.date)),
        ...(c.views.some(v=>v.m?.quoteDate&&v.m.quoteDate!==v.m.date)?[textRow('quote-asof','Share price date',i=>date(c.views[i].m?.quoteDate))]:[]),
        display('quotePrice',USD.integer),
        display('cap',amount),display('ev',amount),
        ...['peTTM','peFY','evEbitda','proxyEvEbitda','evEbit','priceBook','priceSales'].map(k=>display(k,times,true,true)),
        ...(c.isQuarter?Object.keys(E.coreMarketLabels).filter(k=>k!=='peTTMLatest'&&c.views.some(v=>Number.isFinite(v.values[k])||v.nm.has(k))).map(k=>display(k,times,true,true)):[]),
        display('earningsYield',pct,true),
        textRow('consensus-date','Consensus price date',i=>date(c.views[i].m?.forwardDate)),
        display('forwardPE',times,true,true)
      ]],
      ['quarterly','Quarterly growth & trailing results',[
        textRow('quarter-period','Fiscal quarter',i=>c.views[i].q.period),
        textRow('quarter-result-source','Quarterly results source',i=>c.current[i]?.kind||c.views[i].q.sourceLabel||(c.views[i].q.source?'Morningstar':null)),
        display('qRevenue',amount),display('qGrowth',pct,true),display('qOperatingMargin',pct,true),display('qNetMargin',pct,true),
        ...(c.isQuarter?[textRow('trailing-period','Trailing period',i=>c.views[i].q.ended?date(c.views[i].q.ended):c.views[i].q.period),display('ttmRevenue',amount),display('ttmNetCommon',amount)]:[])
      ]],
      ...(c.isQuarter&&c.current.some(Boolean)?[
        ['core-statements','Quarterly statements',[
          textRow('quarter-source','Filing source',i=>c.current[i]?.kind),
          textRow('quarter-end','Quarter ended',i=>c.current[i]?.ended?date(c.current[i].ended):c.current[i]?.period),
          ...Object.keys(quarterFields).map(k=>display('core-'+k,k==='dilutedEps'?USD.integer:amount))
        ]],
        ['core-ratios','Quarterly ratios',Object.keys(quarterRatios).map(k=>display('core-'+k,
          cmult.has(k)||k==='interestCover'?times:pct,
          ['revenueGrowth','profitGrowth','grossMargin','operatingMargin','netMargin','fcfMargin','roe','roa','equityAssets','debtAssets','liabAssets'].includes(k),
          ['debtAssets','liabAssets'].includes(k)))]
      ]:[]),
      ['size-metrics','Balance sheet amounts in USD',Object.keys(scaleFields).map(k=>display('core-'+k,amount))],
      ...Notes.groups(c,{row:rowCells,text:textRow,show:k=>state.filter!=='focus'||highlighted(k),
        amount:(v,i,end)=>amount(usd(c,i,v,end||c.years[i]?.end)),currentEnd:i=>columnEnd(c,i),pct,times,best,fmtDate:date,
        quarterPct:v=>Number.isFinite(v)?regionalGrowth.format(v)+'%':'—',growthBasis:state.growth,
        period:c.periodLatest?'latest':state.period==='latest'?'aligned':state.period}),
      ...M.groups.map(([title,keys],i)=>[['income','balance','cash'][i],'Annual '+title.toLowerCase(),keys.map(k=>display(k,amount))]),
      ['ratios','Annual financial ratios',Object.keys(M.labels).map(k=>display(k,cmult.has(k)?times:pct,!cmult.has(k)&&k!=='equityRatio'))]
    ];
    const scrollLeft=$('company-scroll').scrollLeft;
    $('statement-groups').innerHTML=headers.map(([id,title,rows],i)=>{
      if(!rows.some(Boolean))return '';
      return `<section class="matrix-section" data-section="${id}" aria-labelledby="heading-${id}"><h3 class="pinned-section" id="heading-${id}"><span>${esc(title)}</span></h3><div class="horizontal table-panel" data-sync-scroll tabindex="0" id="${i===0?'statement-scroll':'scroll-'+id}" aria-label="${esc(title)} columns"><table id="${i===0?'statement-table':'table-'+id}">${head(c,title)}<tbody>${rows.join('')}</tbody></table></div></section>`;
    }).join('');
    $('jump-table').innerHTML=opt('','Choose table')+headers.filter(([,title,rows])=>rows.some(Boolean)).map(([id,title])=>opt(id,title)).join('')+opt('checklist','Fundamentals checklist');
    const sc=c.score,format=n=>USD.integer(n);
    const names=new Intl.ListFormat('en-GB',{style:'long',type:'conjunction'}).format(sc.winners.map(i=>c.companies[i].name));
    const summary=sc.counted?(names+(sc.winners.length>1?' share the lead':' leads the checklist')):'No comparable score';
    const detail=sc.counted?`${format(sc.scores[sc.winners[0]])} of ${sc.counted} available points · ${sc.counted} of ${sc.rows.length} criteria scored`:
      c.ids.length===1?'Choose a competitor to score the checklist.':'No checklist measure is available for every selected company in this period.';
    $('check-result').innerHTML=`<strong>${esc(summary)}</strong>${esc((c.isQuarter?Q.labelQuarter(c.calendar)+' · '+(state.growth==='qoq'?'QoQ · ':'YoY · '):'Annual · ')+detail)}`;
    $('check-table').innerHTML=head(c,'Fundamentals checklist')+'<tbody>'+sc.rows.map(r=>rowCells(r.key,M.labels[r.key]+(c.isQuarter&&['revenueGrowth','profitGrowth'].includes(r.key)?' · '+(state.growth==='qoq'?'QoQ':'YoY'):''),c.ids.map((_,i)=>r.values[i]),pct,r.winners,false)).join('')+
      rowCells('score','Checklist points',c.ids.map((_,i)=>sc.counted?sc.scores[i]:null),format,sc.winners,false)+'</tbody>';
    for(const el of document.querySelectorAll('[data-sync-scroll],#check-scroll'))el.scrollLeft=scrollLeft;
  }
  function renderSources(c) {
    $('sources').innerHTML=c.companies.map((co,i)=>{
      const y=c.years[i],v=c.views[i],m=v.m,current=c.current[i];
      const sources=current?[current.observation.reconciledSource,current.ttm?.annualSource,current.observation.priorQuarterBalanceSource,current.observation.quarterBridges?.values?.source,c.records[i]?.filing?.source].filter((u,index,all)=>u&&u!==current.source&&all.indexOf(u)===index):[];
      const matched=USD.matchedBalance(current?.observation,c.notes[i].current);
      const currentRef=matched?c.notes[i].current:null;
      if(currentRef&&Object.keys(matched).some(k=>!Object.hasOwn(current.observation.balance||{},k))){
        for(const key of ['source','additionalSource']){
          const url=state.details.sources?.[currentRef[key]];
          if(url&&url!==current.source&&!sources.includes(url))sources.push(url);
        }
      }
      const regional=c.quarterNotes[i];
      const geoLinks=[
        regional?.geo.geography?.source?link(regional.geo.geography.source,'Quarterly revenue geography'):null,
        regional?.geographyBase?link(regional.geographyBase.disclosure.source,'Regional comparison · '+date(regional.geographyBase.end)):null
      ].filter(Boolean);
      const geoRefs=geoLinks.length?'<p>'+geoLinks.join(' · ')+'</p>':'';
      const quarterDetails=sources.length?'<p>'+sources.map((u,index)=>link(u,'Quarterly comparison source '+(index+1))).join(' · ')+'</p>':'';
      const refs=Object.entries(y?.refs||{}).filter(([k])=>M.fields[k]||['preferredEquity','noncontrollingInterest','dilutedEps','bookCommon'].includes(k)).map(([k,ref])=>{
        const raw=String(ref), file=raw.match(/^(R\d+\.htm)\b/i);
        const urls=Array.from(new Set(raw.match(/https:\/\/[^\s;]+/g)||[]));
        if(file&&co.filingUrl.includes('sec.gov/Archives/'))urls.unshift(new URL(file[1],co.filingUrl).href);
        const short=raw.replace(/https:\/\/[^\s;]+/g,'').replace(/\s+;/g,';').trim();
        const content=urls.length?link(urls[0],short||'Filing reference')+urls.slice(1).map((url,n)=>' · '+link(url,'Source '+(n+2))).join(''):esc(short);
        const title=M.fields[k]||({dilutedEps:'Diluted EPS',preferredEquity:'Preferred equity',noncontrollingInterest:'Noncontrolling interest',bookCommon:'Common book equity'}[k]);
        return `<li><b>${esc(title)}</b> · ${content}</li>`;
      }).join('');
      const market=m?`<p><b>Market inputs.</b> ${esc(m.method||'')}${m.date?' · '+esc(date(m.date)):''}${m.anchorDate?' · Anchor '+esc(date(m.anchorDate)):''}${m.shareDate?' · Share count '+esc(date(m.shareDate)):''}${m.fxDate?' · FX '+esc(date(m.fxDate)):''}. ${(m.sources||[]).map(s=>link(s.url,s.label)).join(' · ')}</p>`:'';
      const notes=Array.from(new Set(Object.values(co.notes||{}).flat().filter(s=>typeof s==='string')));
      return `<details class="source-card"><summary>${esc(co.name)} · ${esc(co.form)}</summary><p>Report period ended ${esc(date(co.period))}${co.filed?' · Filed or published '+esc(date(co.filed)):''}.</p><p>${co.sources.map(s=>link(s.url,s.label)).join(' · ')}</p>${market}${v.q.source?`<p>${link(v.q.source,v.q.sourceLabel||'Morningstar financial statements')} · ${v.q.ended?'Filed':'Snapshot'} ${esc(date(v.q.asOf))}.</p>`:''}${quarterDetails}${geoRefs}${refs?`<p><b>Figures for ${esc(date(y.end))}</b></p><ul>${refs}</ul>`:''}${Notes.sourceList(c,i,state.details,link,date)}${notes.length?`<ul>${notes.map(n=>'<li>'+esc(n)+'</li>').join('')}</ul>`:''}</details>`;
    }).join('');
    const r=c.report;
    const bosRef=r?`<p><b>BOS peer comparison.</b> ${link(r.source+'#page='+r.page,'Original comparison, page '+r.page)} · ${esc(date(r.date))}.</p>`:'';
    $('method-text').innerHTML=bosRef+`<p>Filing snapshot checked ${esc(date(state.data.asOf))}. The 110 focus listings represent 97 issuers. Share classes and exchange listings for one issuer share its financial statements. Automatic selection starts with matched companies from the Beta 2 BOS report and continues with industry peers, then related industries. The selection stops when those candidates run out. Editing peers lets you choose up to ten. The BOS comparison preserves the report’s own group and dates. Connected Beta 2 research supplies its detailed table on this browser.</p>
    <p>The financial statement tables show whole numbers. The annual comparison also shows fractional USD amounts for scale. Net assets equal total assets less total liabilities. Amounts are translated into USD at the latest available exchange rate on or before the period end, or the quote date for market values. A fiscal label without an exact date uses its mapped calendar quarter end. Reporting currencies and the rates’ dates are listed under Compared companies. ${link(state.fx?.sourceUrl,'Federal Reserve H.10 exchange rates')}. Bonus companies appear alongside the comparison and do not count toward the direct-peer revenue share or checklist. Market values are estimates where a filed share count is multiplied by a close or an earlier equity value is updated by the change in price and FX. Each company’s source panel identifies its dates and method. Reported forward P/E comes from the dated consensus comparison.</p>
    <p>Trailing P/E divides equity market value by trailing 12-month earnings available to common shareholders. Filed-year P/E uses annual common earnings, or verified matching per-share figures where available. Earnings yield is the inverse of filed-year P/E. Price/sales uses revenue. Price/book uses common book equity. A multiple with nonpositive earnings or enterprise value is shown as N/M. Valuation rows highlight the lowest comparable positive multiple or the highest earnings yield. Valuations carry no fundamentals checklist points.</p>
    <p>Enterprise value includes common equity market value, interest-bearing debt, preferred equity and noncontrolling interests, less cash. The EV proxy uses common equity market value plus debt less cash. EBITDA is filing-reported or operating profit plus verified depreciation and amortisation. For Petrobras, the market value includes common and participating preferred shares at their respective prices. Each multiple uses the named denominator. Banks, financial groups and REITs omit the enterprise multiples.</p>
    <p>Core comparisons use the latest confirmed quarterly data in the 26 November snapshot. Source priority is a Form 10-Q, a verified fiscal fourth-quarter bridge or a current issuer release, followed by the dated Morningstar quarterly statements. Additional peers can use verified SEC interim filing facts. Rows show reporting currencies. The quarter selector groups actual period-end dates by calendar quarter. Where the source provides a fiscal label only, Beta 3 maps it using the issuer’s verified filing calendar. Growth uses the same fiscal quarter a year earlier for YoY and the immediately preceding fiscal quarter for QoQ. A missing period or nonpositive base leaves growth blank. Historical quarter valuations require a matching dated market observation. Quarterly cash flows use standalone quarters or comparable year-to-date differences. Trailing returns use twelve months of earnings and same-quarter year-over-year average balances. Morningstar trailing figures enter core ratios when the last four consecutive quarterly figures reconcile to the vendor total. Valuation ratios require a market observation on or after the relevant source date. Historical fiscal-year selections use audited annual statements and the dated market observations.</p>
    <p>${Object.values(state.quarterly?.archives||{}).map(a=>link('https://notwins.github.io/market-intelligence-content/'+a.path,a.fileName+' (.gz)')).join(' · ')}</p>
    <p>Growth requires a positive prior-year base. Margins divide the measure by revenue. Returns use net income to owners and average opening and closing equity or assets. Free cash flow subtracts cash purchases of PP&amp;E from operating cash flow. Cash conversion divides operating cash flow by net income. Asset turnover uses average assets. A dash marks a missing or inapplicable amount. The Figures panel on valuation charts describes missing inputs and explains when a multiple is not meaningful.</p>
    <p>Stars highlight rows you want to follow. Green checks mark leaders among comparable available values at the displayed precision. Checklist points require a figure for every company. Tied companies split a point. Financial institutions and REITs use revenue growth, profit growth, return on equity and return on assets. Company dates, accounting standards and business mix can differ.</p>
    <p>The share selectors order issuer equity values from largest to smallest in USD. The latest balance sheet identifies the newest verified reporting period in this snapshot. The cash observation has its own reporting date. A cash-flow closing balance follows the issuer’s cash-flow definition and may include restricted cash. Annual cash, securities and maturity schedules use the chosen fiscal year. U.S. Treasury holdings use the portfolio and measurement basis in the filing. Broader government portfolios can include agency or other sovereign securities. Cash equivalents and securities can overlap.</p>
    <p>Quarterly filing comparisons use balance sheet figures from the selected reporting quarter and standalone quarterly operating cash flow. Quarterly revenue amounts are translated at the reported period end or its mapped calendar end. Regional growth compares standalone amounts in the same reporting currency, using matching geographic scope and comparable quarterly periods. A dash in the growth column means there is no comparable quarter or positive base. Revenue breakdowns use that quarter’s primary disclosures. The bar colours identify items within a breakdown. The quarterly solvency measures use the quarter’s reported values where available.</p>
    <p>Revenue shares use the total in the issuer’s disclosure. Displayed shares round to the nearest whole percentage. Grouped geography adds only reported amounts. An Americas total that includes the USA stays in the Americas (USA not split) row. APAC without a country split includes broad Asian and combined Greater China figures. Other / unallocated retains mixed territories and undisclosed markets. The rows below each highlighted subtotal are included in it. As filed shows the original breakdown. Each filing’s geographic basis, such as billing location or customer headquarters, still applies. Signed eliminations and hedges reconcile some totals. The colour strip shows positive components. Maturities run from the date on the filing. Grouped ranges retain their boundaries. Payments within an elapsed or ongoing fiscal year may already have been made.</p>
    <p>Solvency scores compare peers with the focus company’s business model. Capital strength uses owners’ equity divided by assets when all eligible peers report it. Otherwise it uses net assets (assets less liabilities) divided by assets when available across the group. Each shared measure gives 100 points to the strongest and zero to the weakest. Ties receive their average position. The overall score averages at least two shared measures. This comparison uses ${esc(D.ranking(c.notes).common.map(k=>D.labels[k]).join(', ')||'no shared measures')}. Regulatory capital uses the group’s reported basis. The percentages use year-end balance sheet amounts. Interest coverage divides operating profit by positive annual interest expense. First-year coverage divides fiscal year-end cash by disclosed first-year debt payments.</p>
    <p>Sources include SEC 10-K, 20-F and 40-F filings and annual reports from other markets. SpaceX uses its audited IPO prospectus. ${link('https://market-intel-fundamentals-vault.vercel.app/statements-public.json','Public Beta 2 statement snapshot')}</p>`;
  }
  function renderBOS() {
    const c=comparison(),r=c.report;if(!r)return;
    $('bos-title').textContent='BOS comparison · '+c.companies[0].name;
    const covered=c.members.filter(m=>!m.subject&&m.id).length,peers=c.members.filter(m=>!m.subject);
    let content=`<p class="report-date">${esc(date(r.date))} · ${peers.length} report peers · ${covered} with filing coverage</p>`;
    if(r.rows?.length&&r.columns?.length) {
      const cols=r.rows;
      const data=r.columns.map((key,i)=>`<tr><th scope="row">${esc(key)}</th>${cols.map(row=>'<td>'+esc(row[i+1]??'—')+'</td>').join('')}</tr>`).join('');
      content+=`<div class="report-matrix" tabindex="0" aria-label="BOS report table"><table><caption class="sr-only">Source comparison as reported on ${esc(date(r.date))}</caption><thead><tr><th scope="col">Report item</th>${cols.map(row=>'<th scope="col">'+esc(row[0])+'</th>').join('')}</tr></thead><tbody>${data}</tbody></table></div>`;
    } else if(peers.length) {
      content+='<ul class="report-peers">'+peers.map(m=>`<li><b>${esc(m.name)}</b><span>${m.id?'Filing available':'Report only'}</span></li>`).join('')+'</ul>';
    }
    if(r.summary)content+='<p>'+esc(r.summary)+'</p>';
    content+='<p class="report-source">'+link(r.source+'#page='+r.page,'Open BOS comparison, page '+r.page)+(r.analysisPage&&r.analysisPage!==r.page?' · '+link(r.source+'#page='+r.analysisPage,'Competitive analysis'):'')+'</p>';
    $('bos-content').innerHTML=content;
  }


  const assetFile=id=>state.details.issuers?.[id]?.logo;
  function logo(id,name){
    const path=assetFile(id);
    return path?'<img class="note-logo" alt="" title="'+esc(name)+'" src="assets/'+esc(path)+'" width="27" height="27" loading="lazy">':'<span class="note-logo initials" aria-hidden="true">'+esc((name||id).slice(0,2))+'</span>';
  }
  const annualNumbers=[1,2].map(digits=>new Intl.NumberFormat('en-GB',{minimumFractionDigits:digits,maximumFractionDigits:digits}));
  function filingDisplay(c,quarter=false){
    const num=(value,digits)=>annualNumbers[digits-1].format(value);
    const amount=value=>{
      const scaled=value/(state.unit==='bn'?1000:1);
      if(scaled!==0&&Math.abs(scaled)<0.01)return '<0.01';
      return num(scaled,Math.abs(scaled)<10?2:1);
    };
    const share=value=>Number.isFinite(value)?num(value,1)+'%':'—';
    const multiple=value=>Number.isFinite(value)?num(value,2)+'×':'—';
    return {pct:share,times:multiple,amount,fmtDate:date,logo,unit:state.unit,sort:quarter?state.quarterSort:state.annualSort,
      quarter,growthBasis:state.growth,periodLabel:Q.labelQuarter(c.calendar),mappedEnd:quarterEnd(c.calendar),link,
      rate:(currency,end)=>USD.rate(state.fx,currency,end)?.factor,scale:USD.annualScale};
  }
  function drawNotes(c){
    $('quarterly-filings').hidden=!c.isQuarter;
    $('quarterly-filing-link').hidden=!c.isQuarter;
    if(c.isQuarter)Notes.renderQuarter(c,filingDisplay(c,true));
    Notes.renderCharts(c,filingDisplay(c));
  }
  function capLabel(n){if(!Number.isFinite(n))return '';const unit=n>=1e6?'T':n>=1e3?'B':'M';return 'US$'+USD.integer(n/(unit==='T'?1e6:unit==='B'?1e3:1))+unit;}
  const pickerOptions={escape:esc,logoBase:'assets/',allowCustom:false};
  const focusPicker=window.SISharePicker.mount($('focus-picker'),pickerOptions);
  const peersPicker=window.SISharePicker.mount($('peer-picker'),pickerOptions);
  let previousPickerData=null;
  function pickerEntry(id,ticker,name){
    const co=lookup(id),sizes=state.details.sizesUsdM||{},cap=(sizes[ticker]||sizes[id])?.value,words=[ticker,name,co.name,...(ticker===co.ticker?[id]:[])];
    return {ticker,name,cap,aliases:[],logo:assetFile(id),meta:capLabel(cap),search:[...words,...words.map(w=>w.replace(/[^A-Z0-9]/gi,''))].join(' ').toUpperCase()};
  }
  function bySize(rows){
    const sorted=rows.sort((a,b)=>(b.cap??-1)-(a.cap??-1)||a.name.localeCompare(b.name)||a.ticker.localeCompare(b.ticker));
    return [{label:'Largest to smallest · equity value (USD)',entries:sorted.filter(v=>Number.isFinite(v.cap))},{label:'Market value unavailable',entries:sorted.filter(v=>!Number.isFinite(v.cap))}].filter(g=>g.entries.length);
  }
  function updateFocusPicker(){
    $('choose-company').value=state.focus;
    if(previousPickerData!==state.details){
      focusPicker.update(bySize(state.data.listings.map(l=>pickerEntry(l.id,l.ticker,lookup(l.id).name))));
      previousPickerData=state.details;
    }else focusPicker.sync();
    if(!$('peer-editor').hidden)renderPeerEditor();
  }
  function focusCompany(ticker){
    state.focus=ticker;state.custom=null;state.period='latest';$('company-scroll').scrollLeft=0;
  }
  $('choose-company').addEventListener('change',()=>{const t=$('choose-company').value;if(t!==state.focus&&state.data.listings.some(x=>x.ticker===t)){closePeers();focusCompany(t);render();}});
  function renderPeerEditor(){
    const full=state.draft.length>=E.MAX_PEERS;
    const items=Object.entries(state.data.companies).filter(([id])=>id!==listing().id&&!state.draft.includes(id));
    $('peer-add').value='';$('peer-add').disabled=full;$('peer-picker').querySelector('button').disabled=full;
    peersPicker.update(bySize(items.map(([id,co])=>pickerEntry(id,co.ticker,co.name))));
    $('peer-draft').textContent=state.draft.length+' / '+E.MAX_PEERS+' selected';
    $('selected-peers').innerHTML=state.draft.map(id=>'<button type="button" data-remove="'+esc(id)+'" aria-label="Remove '+esc(lookup(id).name)+'">'+logo(id,lookup(id).name)+esc(lookup(id).name)+' <b aria-hidden="true">×</b></button>').join('');
  }
  function closePeers(){peersPicker.close();$('peer-editor').hidden=true;$('choose-peers').setAttribute('aria-expanded','false');}
  $('choose-peers').onclick=()=>{if(!$('peer-editor').hidden){closePeers();return;}state.draft=[...comparison().peers];$('peer-editor').hidden=false;$('choose-peers').setAttribute('aria-expanded','true');renderPeerEditor();};
  $('peer-add').addEventListener('change',()=>{const t=$('peer-add').value,id=Object.keys(state.data.companies).find(k=>lookup(k).ticker===t);
    if(id&&id!==listing().id&&!state.draft.includes(id)&&state.draft.length<E.MAX_PEERS){state.draft.push(id);renderPeerEditor();}});
  $('selected-peers').onclick=event=>{const id=event.target.closest('[data-remove]')?.dataset.remove;if(id){state.draft=state.draft.filter(k=>k!==id);renderPeerEditor();$('peer-add').focus();}};
  $('cancel-peers').onclick=()=>{closePeers();$('choose-peers').focus();};
  $('auto-peers').onclick=()=>{state.custom=null;closePeers();render();};
  $('apply-peers').onclick=()=>{state.custom=[...state.draft];closePeers();render();};
  for(const [id,quarter,sort] of [['rank-diagram',false,'annualSort'],['quarter-rank-diagram',true,'quarterSort']]){
    $(id).addEventListener('click',event=>{
      const target=event.target.closest('button[data-annual-sort]');
      if(!target)return;
      const key=target.dataset.annualSort;
      const before=state[sort];
      state[sort]={key,ascending:key===before.key?!before.ascending:target.dataset.ascending==='true'};
      const c=comparison();
      Notes.renderRanking(c,filingDisplay(c,quarter));
      $(id).querySelector('[data-annual-sort="'+key+'"]')?.focus({preventScroll:true});
    });
  }
  $('mix-units').onchange=()=>renderTables(comparison());
  const geographyControls=['geo-filter','annual-geo-filter','quarter-geo-filter'];
  for(const id of geographyControls)$(id).onchange=event=>{
    for(const control of geographyControls)$(control).value=event.target.value;
    const c=comparison();
    state.autoFocus=new Set(Notes.focusKeys(c));
    drawNotes(c);
    renderTables(c);
  };

  $('bonus-choices').onclick=e=>{
    const option=e.target.closest('[data-bonus]');
    if(!option||option.disabled)return;
    const id=option.dataset.bonus;
    state.bonus=state.bonus.includes(id)?state.bonus.filter(value=>value!==id):[...state.bonus,id];
    render();
    $('bonus-choices').querySelector('[data-bonus="'+id+'"]')?.focus({preventScroll:true});
  };
  $('peer-count').onchange=e=>{state.size=E.count(e.target.value);state.custom=null;render();};
  $('period').onchange=e=>{state.period=e.target.value;render();};
  for(const id of ['quarter-growth','quarter-geo-growth'])$(id).onchange=e=>{state.growth=e.target.value;render();};
  $('units').onchange=e=>{state.unit=e.target.value;const c=comparison();renderTables(c);drawNotes(c);};
  $('row-filter').onchange=e=>{state.filter=e.target.value;renderTables(comparison());};
  $('jump-table').onchange=e=>{
    const choice=e.target.value;if(!choice)return;
    const el=choice==='checklist'?$('checklist'):document.querySelector('[data-section="'+choice+'"]');
    if(el)el.scrollIntoView({block:'start'});e.target.value='';
  };
  $('open-bos').onclick=()=>{renderBOS();$('bos-dialog').showModal();};$('close-bos').onclick=()=>$('bos-dialog').close();
  $('statement-groups').addEventListener('click',e=>{
    const b=e.target.closest('[data-star]');if(!b)return;
    const key=b.dataset.star;
    if(highlighted(key)){state.stars.delete(key);state.dropped.add(key);}else{state.stars.add(key);state.dropped.delete(key);}
    renderTables(comparison());
    const next=Array.from($('statement-groups').querySelectorAll('[data-star]')).find(x=>x.dataset.star===key);
    (next||$('row-filter')).focus({preventScroll:true});
  });
  const scrollerSelector='[data-sync-scroll],#company-scroll,#check-scroll', assigned=new WeakMap();
  document.addEventListener('scroll',e=>{
    const el=e.target;if(!el.matches?.(scrollerSelector))return;
    const x=el.scrollLeft;
    if(assigned.has(el)&&Math.abs(assigned.get(el)-x)<1){assigned.delete(el);return;}
    for(const other of document.querySelectorAll(scrollerSelector))if(other!==el&&Math.abs(other.scrollLeft-x)>1){
      other.scrollLeft=x;assigned.set(other,other.scrollLeft);
    }
  },{capture:true,passive:true});
  const mobile=matchMedia('(max-width:720px)');
  const sizes=[['row-height','--row-height',40,36],['item-width','--metric-width',205,130],['company-width','--company-min',172,145]];
  const customized=new Set();
  function layout(reset=false) {
    for(const [id,prop,desk,phone] of sizes) {
      const el=$(id);if(reset||!customized.has(id))el.value=String(mobile.matches?phone:desk);
      $('comparison').style.setProperty(prop,el.value+'px');$(id+'-value').textContent=el.value+' px';
    }
    $('comparison').classList.toggle('fixed-company-width',customized.has('company-width'));
  }
  sizes.forEach(([id])=>$(id).oninput=()=>{customized.add(id);layout();});
  $('reset-layout').onclick=()=>{customized.clear();layout(true);};mobile.addEventListener('change',()=>layout());
  new ResizeObserver(()=>$('comparison').style.setProperty('--company-head-height',Math.ceil(document.querySelector('.sticky-companies').getBoundingClientRect().height)+'px')).observe(document.querySelector('.sticky-companies'));
  layout(true);
  async function json(name) {
    const res=await fetch(window.ContentDelivery.CONTENT+'data/'+name,{signal:AbortSignal.timeout(30000)});
    if(!res.ok)throw Error('Unavailable '+name);return res.json();
  }
  let generation=0;
  async function load(){
    const current=++generation; $('load-status').hidden=false;$('load-status').textContent='Loading filing and market comparisons…';$('retry').hidden=true;
    try {
      const lib=window.StocksBeta2PeerLibrary;
      const [base,extra,pub,disclosures,quarterly,peers,fx,supplement,quarterDetails,geographyBases]=await Promise.all([M.loadPublished(),json('shares-beta3-comparisons-2026-11-26.json').catch(()=>null),lib?.published().catch(()=>null),json('shares-beta3-disclosures-2026-11-26.json').catch(()=>null),Q.load().catch(()=>null),Q.peerFilings().catch(()=>({})),json('beta3-usd-fx-2026-11-27.json').catch(()=>null),
        json('shares-beta3-semiconductor-interim-2026-11-27-v3.json').catch(()=>null),
        json('shares-beta3-quarterly-revenue-2026-11-27.json').catch(()=>null),
        json('shares-beta3-quarterly-geography-bases-2026-11-27.json').catch(()=>null)]);
      if(current!==generation)return;
      if(extra&&extra.version!==1)throw Error('Invalid comparison data');
      state.quarterDetails=G.mergeData(quarterDetails?.version===1?quarterDetails:null,geographyBases);
      state.fx=fx?.version===1?fx:null;state.supplement=supplement?.issuers||{};state.quarterEndMarkets=supplement?.quarterEndMarkets||{};state.quarterly=quarterly;state.peerQuarterly=peers;state.details=disclosures?.version===1?disclosures:{};state.data=E.prepare(base,extra||{});state.published=pub;state.privateData=lib?.saved()||null;
      const q=new URLSearchParams(location.search),input=(q.get('ticker')||'GOOG US').toUpperCase();
      state.focus=(base.listings.find(l=>l.ticker===input||l.id===input)||base.listings.find(l=>l.ticker==='GOOG US')||base.listings[0]).ticker;
      state.bonus=(q.get('bonus')||'').split(',').filter(id=>Object.hasOwn(USD.choices,id));
      state.size=q.has('count')?E.count(q.get('count')):9;state.custom=q.has('peers')?Array.from(new Set(q.get('peers').split(','))).filter(id=>id!==listing().id&&lookup(id)).slice(0,E.MAX_PEERS):null;
      state.period=q.get('quarter')||q.get('year')||'latest';state.growth=q.get('growth')==='qoq'?'qoq':'yoy';render();$('filing-app').hidden=false;$('load-status').hidden=!!extra&&!!disclosures&&!!quarterly&&!!state.fx&&!!state.quarterDetails;
      if(!extra||!disclosures||!quarterly||!state.fx||!state.quarterDetails){$('load-status').textContent='Some comparison data could not be loaded.';$('retry').hidden=false;}
      const anchor=location.hash.slice(1);
      if(generation===1&&anchor)requestAnimationFrame(()=>$(anchor)?.scrollIntoView({block:'start'}));
      lib?.connected().then(privateData=>{if(current===generation&&privateData){state.privateData=privateData;render();if($('bos-dialog').open)renderBOS();}});
    } catch(error){$('load-status').hidden=false;$('load-status').textContent='Comparison data could not be loaded.';$('retry').hidden=false;console.error('Shares Beta 3',error);}
  }
  $('retry').onclick=load;load();
})();
