(() => {
  'use strict';
  const M=window.FilingComparison, E=window.SharesComparison, $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const colors=['#176b5a','#41679b','#9a602b','#76558d','#a5455a','#267a89','#646b30','#584c89','#a45132','#3f6b41','#784a66'];
  const defaultFocus=['peTTM','peFY','evEbitda','proxyEvEbitda','forwardPE','qGrowth','qNetMargin','revenue','operatingIncome','netIncome','ebitda','totalDebt','equity','operatingCashFlow','freeCashFlow','revenueGrowth','operatingMargin','roe','fcfMargin'];
  const state={data:null,focus:'',custom:null,size:5,period:'latest',unit:'bn',filter:'all',stars:new Set(defaultFocus),hidden:new Set(),
    bar:'operatingMargin',trend:'netMargin',picker:'',draft:[],published:null,privateData:null};
  const num=(n,digits=1)=>new Intl.NumberFormat('en-GB',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(n);
  const pct=n=>Number.isFinite(n)?num(Number(n.toFixed(1)))+'%':'—';
  const times=n=>Number.isFinite(n)?num(n,2)+'×':'—';
  const date=iso=>iso?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(iso+'T00:00:00Z')):'';
  const cmult=new Set(['currentRatio','debtEquity','assetTurnover','cashConversion']);
  const allLabels={...M.fields,...M.labels,...E.marketLabels,...E.quarterLabels};
  const opt=(v,label)=>`<option value="${esc(v)}">${esc(label)}</option>`;
  function amount(n) {
    if(!Number.isFinite(n))return '—';
    const v=n/(state.unit==='bn'?1000:1);
    return v && Math.abs(v)<0.01?(v<0?'−':'')+'<0.01':num(v,Math.abs(v)<10?2:1);
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
    const ids=[focus.id,...peers], companies=ids.map(lookup), ticker=companies.map((c,i)=>i===0?state.focus:c.ticker);
    const periods=M.periods(companies);
    if(state.period!=='latest'&&!periods.includes(state.period))state.period='latest';
    const years=companies.map(c=>M.yearFor(c,state.period));
    const views=ids.map((id,i)=>E.valueView(state.data,id,ticker[i],years[i],state.period));
    return {ids,companies,ticker,peers,years,views,periods,report,members,candidates,score:M.checklist(companies,years)};
  }
  function updateURL() {
    const u=new URL(location.href);
    u.searchParams.set('ticker',state.focus);
    for(const [k,v] of [['peers',state.custom?.join(',')],['count',state.size===5?null:state.size],['year',state.period==='latest'?null:state.period]]){
      if(v==null)u.searchParams.delete(k);else u.searchParams.set(k,v);
    }
    history.replaceState(null,'',u);
  }
  function value(c,i,key) {
    return Object.hasOwn(E.marketLabels,key)||Object.hasOwn(E.quarterLabels,key)?c.views[i].values[key]:M.metric(c.companies[i],c.years[i],key);
  }
  function render() {
    const c=comparison(), cos=c.companies;
    $('period').innerHTML=opt('latest','Latest reported')+c.periods.map(y=>opt(y,'FY ending in '+y)).join('');$('period').value=state.period;
    $('peer-count').value=String(state.size);$('comparison').style.setProperty('--columns',cos.length);
    $('focus-name').textContent=cos[0].name+' · '+state.focus;
    $('peer-name').textContent=c.peers.length?c.peers.map(id=>lookup(id).name).join(' · '):'Add competitors';
    const reason=id=>c.candidates.get(id)||'Selected peer';
    const tally=new Map();for(const id of c.peers){const name=reason(id);tally.set(name,(tally.get(name)||0)+1);}
    const basis=Array.from(tally,([k,v])=>v+' '+({'BOS report peer':'from the BOS report','Industry peer':'industry','Related industry':'related industry','Selected peer':'manually added'}[k])).join(' · ');
    $('peer-basis').textContent=(state.custom?'Selected comparison':'Automatic comparison')+(basis?' · '+basis:'')+(state.custom===null&&c.peers.length<state.size?' · '+c.peers.length+' available':'');
    $('open-bos').hidden=!c.report;
    $('companies').innerHTML=`<div class="column-label"><strong>Comparison item</strong><small>${esc(cos[0].industry)}</small></div>`+
      cos.map((co,i)=>`<div class="company-id" style="--company-color:${colors[i]}">${c.score.winners.includes(i)?'<span class="head-leader" title="Checklist leader" aria-label="Checklist leader">✓</span>':''}<span class="company-name">${esc(co.name)}</span><small>${esc(c.ticker[i])} · ${esc(co.currency)}</small><small>${c.years[i]?esc(date(c.years[i].end)):'No filing for period'}</small><small class="peer-role">${i===0?'Focus company':esc(reason(c.ids[i]))}</small></div>`).join('');
    const financial=cos.some(M.financial), ratioKeys=financial?['roe','roa','revenueGrowth','profitGrowth']:['operatingMargin','netMargin','grossMargin','roe','roa','revenueGrowth','profitGrowth','fcfMargin','cashMargin'];
    const trail=ratioKeys.filter(k=>cos.some(co=>co.years.some(y=>Number.isFinite(M.metric(co,y,k)))));
    const comparisonKeys=[...E.multiples,'earningsYield','qGrowth','qOperatingMargin','qNetMargin']
      .filter(k=>c.views.some(v=>Number.isFinite(v.values[k])));
    for(const [component,options,fallback] of [['bar',[...trail,...comparisonKeys],financial?'roe':'operatingMargin'],['trend',trail,financial?'roa':'netMargin']]) {
      const available=options.length?options:ratioKeys;
      if(!available.includes(state[component]))state[component]=available.includes(fallback)?fallback:available[0];
      const select=$(component+'-metric');select.innerHTML=available.map(k=>opt(k,allLabels[k])).join('');select.value=state[component];
    }
    renderBars(c);renderTrend(c);renderTables(c);renderSources(c);updateURL();
  }
  function scale(values) {
    const lo=Math.min(0,...values),hi=Math.max(0,...values),raw=(hi-lo||4)/4,order=10**Math.floor(Math.log10(raw));
    const step=([1,2,2.5,5,10].find(n=>n*order>=raw)||10)*order;
    const min=Math.floor(lo/step)*step,max=lo===hi?min+4*step:Math.ceil(hi/step)*step;
    return {min,max,ticks:Array.from({length:Math.round((max-min)/step)+1},(_,i)=>min+i*step)};
  }
  const axis=n=>new Intl.NumberFormat('en-GB',{maximumFractionDigits:2,notation:Math.abs(n)>=10000?'compact':'standard'}).format(Math.abs(n)<1e-8?0:n);
  function renderBars(c) {
    const k=state.bar,values=c.ids.map((_,i)=>value(c,i,k)),valid=values.filter(Number.isFinite),multiple=E.multiples.has(k);
    if(!valid.length){$('bars').innerHTML='<p class="chart-empty">No reported values for this period.</p>';return;}
    const s=scale(valid),fmt=multiple?times:pct,left=87,right=405,x=v=>left+(v-s.min)/(s.max-s.min)*(right-left);
    const line=Math.max(18,Math.min(28,132/c.ids.length)),base=12+c.ids.length*line;
    const ticks=s.ticks.map(v=>`<line class="${v===0?'zero-line':'axis-line'}" x1="${x(v)}" x2="${x(v)}" y1="4" y2="${base}"/><text x="${x(v)}" y="${base+18}" text-anchor="middle">${axis(v)}${multiple?'×':'%'}</text>`).join('');
    const bars=values.map((v,i)=>{const y=8+(i+.5)*line;return `<g><title>${esc(c.companies[i].name+' · '+allLabels[k]+' · '+fmt(v))}</title><text x="0" y="${y+4}">${esc(c.ticker[i])}</text>${Number.isFinite(v)?`<rect x="${Math.min(x(0),x(v))}" y="${y-6}" width="${Math.max(1,Math.abs(x(v)-x(0)))}" height="12" rx="3" fill="${colors[i]}"/>`:''}<text class="bar-value" x="477" y="${y+4}" text-anchor="end">${fmt(v)}</text></g>`;}).join('');
    $('bars').innerHTML=`<svg viewBox="0 0 480 ${base+24}" role="img" aria-label="${esc(allLabels[k]+'. '+c.companies.map((co,i)=>co.name+' '+fmt(values[i])).join(', '))}">${ticks}${bars}</svg>`;
  }
  function renderTrend(c) {
    const k=state.trend,end=state.period==='latest'?'9999':state.period;
    const series=c.companies.map((co,i)=>state.hidden.has(c.ids[i])?[]:co.years.filter(y=>y.end.slice(0,4)<=end).slice(0,3).map(y=>({year:+y.end.slice(0,4),end:y.end,v:M.metric(co,y,k)})));
    const years=Array.from(new Set(series.flat().map(p=>p.year))).sort((a,b)=>a-b),valid=series.flat().map(p=>p.v).filter(Number.isFinite);
    let plot='<p class="chart-empty">No visible values for this metric and period.</p>';
    if(valid.length){
      const s=scale(valid),left=55,right=461,base=135,top=10,x=yr=>years.length<2?(left+right)/2:left+(yr-years[0])/(years.at(-1)-years[0])*(right-left),y=v=>base-(v-s.min)/(s.max-s.min)*(base-top);
      const grid=s.ticks.map(v=>`<line class="${v===0?'zero-line':'axis-line'}" x1="${left}" x2="${right}" y1="${y(v)}" y2="${y(v)}"/><text x="${left-7}" y="${y(v)+4}" text-anchor="end">${axis(v)}%</text>`).join('');
      const labels=years.map(yr=>`<text x="${x(yr)}" y="154" text-anchor="middle">${yr}</text>`).join('');
      const lines=series.map((pts,i)=>{let prev;return pts.slice().reverse().map(p=>{
        if(!Number.isFinite(p.v)){prev=null;return '';}
        const seg=prev&&p.year===prev.year+1?`<line stroke="${colors[i]}" stroke-width="2.5" x1="${x(prev.year)}" x2="${x(p.year)}" y1="${y(prev.v)}" y2="${y(p.v)}"/>`:'';
        prev=p;const title=c.companies[i].name+' · '+date(p.end)+' · '+pct(p.v);
        return seg+`<circle tabindex="0" role="button" aria-label="${esc(title)}" cx="${x(p.year)}" cy="${y(p.v)}" r="4.4" fill="${colors[i]}" stroke="white" stroke-width="1.3"><title>${esc(title)}</title></circle>`;}).join('');}).join('');
      plot=`<svg viewBox="0 0 480 161" role="group" aria-label="${esc(allLabels[k])} by fiscal year">${grid}${labels}${lines}</svg>`;
    }
    const legend=c.ids.map((id,i)=>`<button type="button" data-series="${esc(id)}" aria-pressed="${!state.hidden.has(id)}" aria-label="${esc('Show '+c.companies[i].name+' trend')}"><i class="dot" style="--company-color:${colors[i]}"></i>${esc(c.ticker[i])}</button>`).join('');
    $('trend').innerHTML=plot+'<div class="chart-legend">'+legend+'</div><output class="trend-readout" aria-live="polite"></output>';
  }
  function trendPoint(e) {const p=e.target.closest('circle[aria-label]');if(!p||e.type==='keydown'&&!['Enter',' '].includes(e.key))return;if(e.type==='keydown')e.preventDefault();$('trend').querySelector('output').textContent=p.getAttribute('aria-label');}
  for(const e of ['click','focusin','keydown'])$('trend').addEventListener(e,trendPoint);
  $('trend').addEventListener('click',e=>{const b=e.target.closest('[data-series]');if(!b)return;const id=b.dataset.series;if(state.hidden.has(id))state.hidden.delete(id);else state.hidden.add(id);renderTrend(comparison());Array.from($('trend').querySelectorAll('[data-series]')).find(x=>x.dataset.series===id)?.focus({preventScroll:true});});


  function head(c,title) {
    return `<caption class="sr-only">${esc(title)}</caption><thead class="sr-only"><tr><th scope="col">Comparison item</th>${c.companies.map(co=>`<th scope="col">${esc(co.name)}</th>`).join('')}</tr></thead>`;
  }
  function best(values,lower=false,digits=1) {
    const r=values.map(n=>Number.isFinite(n)?Number(n.toFixed(digits)):null),usable=r.filter(Number.isFinite);
    if(usable.length<2)return [];
    const lead=lower?Math.min(...usable):Math.max(...usable);
    return r.flatMap((n,i)=>n===lead?[i]:[]);
  }
  function rowCells(key,title,values,fmt,winners=[],interactive=true) {
    const starred=state.stars.has(key)&&interactive;
    const star=interactive?`<button class="row-star" type="button" data-star="${esc(key)}" aria-pressed="${starred}" aria-label="${esc((starred?'Remove highlight from ':'Highlight ')+title)}" title="${starred?'Remove row highlight':'Highlight row'}">${starred?'★':'☆'}</button>`:'';
    return `<tr data-row="${esc(key)}" class="${starred?'focus-row':''}"><th scope="row">${star}<span>${esc(title)}</span></th>${values.map((v,i)=>{
      const win=winners.includes(i),s=fmt(v,i),mark=win?`<span class="win-mark" title="${winners.length>1?'Joint leader':'Leader'}" aria-label="Leader">✓</span>`:'';
      return `<td class="${win?'winner':s==='—'||s==='N/M'?'unavailable':''}">${mark}${esc(s)}</td>`;
    }).join('')}</tr>`;
  }
  function renderTables(c) {
    const display=(key,fmt,rank,lower=false)=>{
      if(state.filter==='focus'&&!state.stars.has(key))return '';
      const vals=c.ids.map((_,i)=>value(c,i,key));
      const wins=rank?best(vals,lower,E.multiples.has(key)||cmult.has(key)?2:1):[];
      return rowCells(key,allLabels[key],vals,(v,i)=>c.views[i].nm.has(key)?'N/M':fmt(v,i),wins);
    };
    const textRow=(k,title,fn)=>rowCells(k,title,c.ids.map((_,i)=>fn(i)),v=>v||'—',[],false);
    const headers=[
      ['valuation','Market valuation',[
        textRow('market-asof','Market value date',i=>date(c.views[i].m?.date)),
        ...(c.views.some(v=>v.m?.quoteDate&&v.m.quoteDate!==v.m.date)?[textRow('quote-asof','Share price date',i=>date(c.views[i].m?.quoteDate))]:[]),
        display('quotePrice',(v,i)=>Number.isFinite(v)?num(v,2)+' '+(c.views[i].m?.quoteUnit||''):'—'),
        display('cap',amount),display('ev',amount),
        ...['peTTM','peFY','evEbitda','proxyEvEbitda','evEbit','priceBook','priceSales'].map(k=>display(k,times,true,true)),
        display('earningsYield',pct,true),
        textRow('consensus-date','Consensus price date',i=>date(c.views[i].m?.forwardDate)),
        display('forwardPE',times,true,true)
      ]],
      ['quarterly','Morningstar quarterly & trailing results',[
        textRow('quarter-period','Fiscal quarter',i=>c.views[i].q.period),
        display('qRevenue',amount),display('qGrowth',pct,true),display('qOperatingMargin',pct,true),display('qNetMargin',pct,true),
        ...(state.period==='latest'?[display('ttmRevenue',amount),display('ttmNetCommon',amount)]:[])
      ]],
      ...M.groups.map(([title,keys],i)=>[['income','balance','cash'][i],title,keys.map(k=>display(k,amount))]),
      ['ratios','Financial ratios',Object.keys(M.labels).map(k=>display(k,cmult.has(k)?times:pct,!cmult.has(k)&&k!=='equityRatio'))]
    ];
    const scrollLeft=$('company-scroll').scrollLeft;
    $('statement-groups').innerHTML=headers.map(([id,title,rows],i)=>{
      if(!rows.some(Boolean))return '';
      return `<section class="matrix-section" data-section="${id}" aria-labelledby="heading-${id}"><h3 class="pinned-section" id="heading-${id}"><span>${esc(title)}</span></h3><div class="horizontal table-panel" data-sync-scroll tabindex="0" id="${i===0?'statement-scroll':'scroll-'+id}" aria-label="${esc(title)} columns"><table id="${i===0?'statement-table':'table-'+id}">${head(c,title)}<tbody>${rows.join('')}</tbody></table></div></section>`;
    }).join('');
    const sc=c.score,format=n=>Number.isFinite(n)?new Intl.NumberFormat('en-GB',{maximumFractionDigits:2}).format(n):'—';
    const names=new Intl.ListFormat('en-GB',{style:'long',type:'conjunction'}).format(sc.winners.map(i=>c.companies[i].name));
    const summary=sc.counted?(names+(sc.winners.length>1?' share the lead':' leads the checklist')):'No comparable score';
    const detail=sc.counted?`${format(sc.scores[sc.winners[0]])} of ${sc.counted} available points · ${sc.counted} of ${sc.rows.length} criteria scored`:
      c.ids.length===1?'Choose a competitor to score the checklist.':'No checklist measure is available for every selected company in this period.';
    $('check-result').innerHTML=`<strong>${esc(summary)}</strong>${esc(detail)}`;
    $('check-table').innerHTML=head(c,'Fundamentals checklist')+'<tbody>'+sc.rows.map(r=>rowCells(r.key,M.labels[r.key],r.values,pct,r.winners,false)).join('')+
      rowCells('score','Checklist points',sc.counted?sc.scores:c.ids.map(()=>null),format,sc.winners,false)+'</tbody>';
    for(const el of document.querySelectorAll('[data-sync-scroll],#check-scroll'))el.scrollLeft=scrollLeft;
  }
  function renderSources(c) {
    const x=state.data.expansion;
    $('sources').innerHTML=c.companies.map((co,i)=>{
      const y=c.years[i],v=c.views[i],m=v.m;
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
      return `<details class="source-card"><summary>${esc(co.name)} · ${esc(co.form)}</summary><p>Report period ended ${esc(date(co.period))}${co.filed?' · Filed or published '+esc(date(co.filed)):''}.</p><p>${co.sources.map(s=>link(s.url,s.label)).join(' · ')}</p>${market}${v.q.source?`<p>${link(v.q.source,'Morningstar financial statements')} · Snapshot ${esc(date(v.q.asOf))}.</p>`:''}${refs?`<p><b>Figures for ${esc(date(y.end))}</b></p><ul>${refs}</ul>`:''}${notes.length?`<ul>${notes.map(n=>'<li>'+esc(n)+'</li>').join('')}</ul>`:''}</details>`;
    }).join('');
    const r=c.report;
    const bosRef=r?`<p><b>BOS peer comparison.</b> ${link(r.source+'#page='+r.page,'Original comparison, page '+r.page)} · ${esc(date(r.date))}.</p>`:'';
    $('method-text').innerHTML=bosRef+`<p>Filing snapshot checked ${esc(date(state.data.asOf))}. The 110 focus listings represent 97 issuers. Share classes and exchange listings for one issuer share its financial statements. Automatic selection starts with matched companies from the Beta 2 BOS report and continues with industry peers, then related industries. The selection stops when those candidates run out. Editing peers lets you choose up to ten. The BOS comparison preserves the report’s own group and dates. Connected Beta 2 research supplies its detailed table on this browser.</p>
    <p>Each column shows its filing currency and fiscal year-end. Amounts follow the units control. Share prices use the displayed quotation unit. Market values are estimates where a filed share count is multiplied by a close or an earlier equity value is updated by the change in price and FX. Each company’s source panel identifies its dates and method. Reported forward P/E comes from the dated consensus comparison.</p>
    <p>Trailing P/E divides equity market value by trailing 12-month earnings available to common shareholders. Filed-year P/E uses annual common earnings, or verified matching per-share figures where available. Earnings yield is the inverse of filed-year P/E. Price/sales uses revenue. Price/book uses common book equity. A multiple with nonpositive earnings or enterprise value is shown as N/M. Valuation rows highlight the lowest comparable positive multiple or the highest earnings yield. Valuations carry no fundamentals checklist points.</p>
    <p>Enterprise value includes common equity market value, interest-bearing debt, preferred equity and noncontrolling interests, less cash. The EV proxy uses common equity market value plus debt less cash. EBITDA is filing-reported or operating profit plus verified depreciation and amortisation. Each multiple uses the named denominator. Banks, financial groups and REITs omit the enterprise multiples.</p>
    <p>Morningstar’s quarterly figures use fiscal-quarter labels. Year-on-year growth compares the same fiscal quarter one year earlier. Trailing results use the published TTM column. A historical fiscal-year selection shows the associated fourth quarter and dated historical market observations when available. Historical market prices are never paired with earnings from a later filing without a verified publication date.</p>
    <p>Growth requires a positive prior-year base. Margins divide the measure by revenue. Returns use net income to owners and average opening and closing equity or assets. Free cash flow subtracts cash purchases of PP&amp;E from operating cash flow. Cash conversion divides operating cash flow by net income. Asset turnover uses average assets. A dash marks a missing or inapplicable amount.</p>
    <p>Stars highlight rows you want to follow. Green checks mark leaders among comparable available values at the displayed precision. Checklist points require a figure for every company. Tied companies split a point. Financial institutions and REITs use revenue growth, profit growth, return on equity and return on assets. Company dates, accounting standards and business mix can differ.</p>
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


  function openPicker(mode) {
    const c=comparison();state.picker=mode;state.draft=[...c.peers];
    $('picker-title').textContent=mode==='focus'?'Choose a focus company':'Choose competitors';
    $('picker-actions').hidden=mode==='focus';$('peer-draft').hidden=mode==='focus';$('company-search').value='';
    renderPicker();$('picker').showModal();$('company-search').focus();
  }
  function renderPicker() {
    const query=$('company-search').value.trim().toLowerCase(),focusMode=state.picker==='focus',data=state.data,c=comparison();
    let items=focusMode?data.listings.map(l=>({id:l.id,ticker:l.ticker,name:l.name||lookup(l.id).name,value:l.ticker})):
      Object.entries(data.companies).filter(([id])=>id!==listing().id).map(([id,co])=>({id,ticker:co.ticker,name:co.name,value:id}));
    const collapsed=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
    items=items.filter(e=>(e.name+' '+lookup(e.id).name+' '+e.ticker+' '+e.id).toLowerCase().includes(query)||!!collapsed(query)&&collapsed(e.ticker).includes(collapsed(query)));
    if(!focusMode) {
      const priority=new Map(Array.from(c.candidates.keys(),(id,i)=>[id,i]));
      items.sort((a,b)=>Number(state.draft.includes(b.id))-Number(state.draft.includes(a.id))||(priority.get(a.id)??999)-(priority.get(b.id)??999)||a.name.localeCompare(b.name));
    }
    $('peer-draft').textContent=state.draft.length+' of '+E.MAX_PEERS+' peers selected';
    $('picker-list').innerHTML=items.length?items.map(e=>{
      const selected=focusMode?e.ticker===state.focus:state.draft.includes(e.id);
      const source=focusMode?'':c.candidates.get(e.id)||'Additional company';
      return `<button type="button" data-value="${esc(e.value)}" class="${selected?'is-selected':''}" ${focusMode?'':'aria-pressed="'+selected+'"'} ${!focusMode&&!selected&&state.draft.length>=E.MAX_PEERS?'disabled':''}><span>${selected?'✓ ':''}${esc(e.name)}</span><small>${esc(e.ticker)}${source?' · '+esc(source):''}</small></button>`;
    }).join(''):'<p>No companies match your search.</p>';
  }
  function focusCompany(ticker) {
    state.focus=ticker;state.custom=null;state.period='latest';state.bar='operatingMargin';state.trend='netMargin';state.hidden.clear();$('company-scroll').scrollLeft=0;
  }
  $('picker-list').addEventListener('click',event=>{
    const b=event.target.closest('button[data-value]');if(!b)return;
    const v=b.dataset.value;
    if(state.picker==='focus'){focusCompany(v);$('picker').close();render();return;}
    if(state.draft.includes(v))state.draft=state.draft.filter(k=>k!==v);else if(state.draft.length<E.MAX_PEERS)state.draft.push(v);
    renderPicker();Array.from($('picker-list').querySelectorAll('button')).find(a=>a.dataset.value===v)?.focus({preventScroll:true});
  });
  $('choose-company').onclick=()=>openPicker('focus');$('choose-peers').onclick=()=>openPicker('peers');
  $('close-picker').onclick=()=>$('picker').close();$('company-search').oninput=renderPicker;
  $('auto-peers').onclick=()=>{state.custom=null;state.hidden.clear();$('picker').close();render();};
  $('apply-peers').onclick=()=>{state.custom=[...state.draft];state.hidden.clear();$('picker').close();render();};
  $('peer-count').onchange=e=>{state.size=E.count(e.target.value);state.custom=null;state.hidden.clear();render();};
  $('period').onchange=e=>{state.period=e.target.value;render();};
  $('units').onchange=e=>{state.unit=e.target.value;renderTables(comparison());};
  $('row-filter').onchange=e=>{state.filter=e.target.value;renderTables(comparison());};
  $('bar-metric').onchange=e=>{state.bar=e.target.value;renderBars(comparison());};
  $('trend-metric').onchange=e=>{state.trend=e.target.value;renderTrend(comparison());};
  $('open-bos').onclick=()=>{renderBOS();$('bos-dialog').showModal();};$('close-bos').onclick=()=>$('bos-dialog').close();
  $('statement-groups').addEventListener('click',e=>{
    const b=e.target.closest('[data-star]');if(!b)return;
    const key=b.dataset.star;
    if(state.stars.has(key))state.stars.delete(key);else state.stars.add(key);
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
      const [base,extra,pub]=await Promise.all([json('shares-beta3-annual-filings-2026-11-26.json'),json('shares-beta3-comparisons-2026-11-26.json').catch(()=>null),lib?.published()]);
      if(current!==generation)return;
      if(!Array.isArray(base.listings)||base.listings.length!==110||!base.companies)throw Error('Invalid filing coverage');
      if(extra&&extra.version!==1)throw Error('Invalid comparison data');
      state.data=E.prepare(base,extra||{});state.published=pub;state.privateData=lib?.saved()||null;
      const q=new URLSearchParams(location.search),input=(q.get('ticker')||'GOOG US').toUpperCase();
      state.focus=(base.listings.find(l=>l.ticker===input||l.id===input)||base.listings.find(l=>l.ticker==='GOOG US')||base.listings[0]).ticker;
      state.size=E.count(q.get('count'));state.custom=q.has('peers')?Array.from(new Set(q.get('peers').split(','))).filter(id=>id!==listing().id&&lookup(id)).slice(0,E.MAX_PEERS):null;
      state.period=q.get('year')||'latest';render();$('filing-app').hidden=false;$('load-status').hidden=!!extra;
      if(!extra){$('load-status').textContent='Annual filings loaded. Market and expanded peer data could not be loaded.';$('retry').hidden=false;}
      lib?.connected().then(privateData=>{if(current===generation&&privateData){state.privateData=privateData;render();if($('bos-dialog').open)renderBOS();}});
    } catch(error){$('load-status').hidden=false;$('load-status').textContent='Comparison data could not be loaded.';$('retry').hidden=false;console.error('Shares Beta 3',error);}
  }
  $('retry').onclick=load;load();
})();

