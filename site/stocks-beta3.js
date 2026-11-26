(() => {
  'use strict';
  const M = window.FilingComparison;
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const colors = ['#176a5a','#446ba2','#9a6330','#79568f'];
  const endpoint = 'data/shares-beta3-annual-filings-2026-11-26.json';
  const state = {data:null,focus:'',custom:null,period:'latest',unit:'bn',bar:'operatingMargin',trend:'netMargin',picker:'',draft:[]};
  const columnColors = colors.map(c => `--company-color:${c}`);
  const date = iso => iso ? new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(iso+'T00:00:00Z')) : '';
  const num = (n,digits=1) => new Intl.NumberFormat('en-GB',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(n);
  const pct = n => Number.isFinite(n) ? num(Number(n.toFixed(1)))+'%' : '—';
  function amount(n) {
    if (!Number.isFinite(n)) return '—';
    const v = n/(state.unit==='bn'?1000:1);
    if (v && Math.abs(v)<.01) return (v<0?'−':'')+'<0.01';
    return num(v, Math.abs(v)<10 ? 2 : 1);
  }
  const company = id => state.data.companies[id];
  const listing = () => state.data.listings.find(item=>item.ticker===state.focus);
  const peers = () => state.custom ?? M.initialPeers(state.data,listing().id);
  const ids = () => [listing().id,...peers()];
  const label = (id,i) => i===0 ? state.focus : company(id).ticker;
  const safeLink = (url,title) => {
    try { if (new URL(url).protocol !== 'https:') return escape(title); }
    catch { return escape(title); }
    return `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(title)} ↗</a>`;
  };
  function setQuery() {
    const url = new URL(location.href);
    url.searchParams.set('ticker',state.focus);
    if (state.custom===null) url.searchParams.delete('peers'); else url.searchParams.set('peers',state.custom.join(','));
    if (state.period==='latest') url.searchParams.delete('year'); else url.searchParams.set('year',state.period);
    history.replaceState(null,'',url);
  }
  function option(value,title) {return `<option value="${escape(value)}">${escape(title)}</option>`;}
  function render() {
    const currentIds=ids(), cos=currentIds.map(company);
    const periods=M.periods(cos);
    if(state.period!=='latest' && !periods.includes(state.period)) state.period='latest';
    $('period').innerHTML=option('latest','Latest reported')+periods.map(y=>option(y,'FY ending in '+y)).join('');
    $('period').value=state.period;
    const years=cos.map(c=>M.yearFor(c,state.period));
    $('comparison').style.setProperty('--columns',cos.length);
    $('focus-name').textContent=cos[0].name+' · '+state.focus;
    $('peer-name').textContent=cos.slice(1).map(c=>c.name).join(' · ') || 'Add competitors';
    const score=M.checklist(cos,years);
    $('companies').innerHTML=`<div class="column-label"><strong>Company</strong><small>${escape(cos[0].industry)}</small></div>`+
      currentIds.map((id,i)=>`<div class="company-id" style="${columnColors[i]}">${score.winners.includes(i)?`<span class="head-leader" title="${score.winners.length>1?'Joint checklist leader':'Checklist leader'}" aria-label="${score.winners.length>1?'Joint checklist leader':'Checklist leader'}">✓</span>`:''}<span class="company-name">${escape(cos[i].name)}</span><small>${escape(label(id,i))} · ${escape(cos[i].currency)}</small><small>${years[i]?escape(date(years[i].end)):'No fiscal year'}</small></div>`).join('');
    const financial=cos.some(M.financial);
    const chartKeys=financial?['roe','roa','revenueGrowth','profitGrowth']:['operatingMargin','netMargin','grossMargin','revenueGrowth','profitGrowth','roe','roa','fcfMargin'];
    for(const [component,defaultMetric] of [['bar',financial?'roe':'operatingMargin'],['trend',financial?'roa':'netMargin']]){
      const available=chartKeys.filter(k=>cos.some(c=>c.years.some(y=>Number.isFinite(M.metric(c,y,k)))));
      const options=available.length?available:chartKeys;
      if(!options.includes(state[component])) state[component]=options.includes(defaultMetric)?defaultMetric:options[0];
      const select=$(component+'-metric');select.innerHTML=options.map(k=>option(k,M.labels[k])).join('');select.value=state[component];
    }
    renderBars(currentIds,years);renderTrend(currentIds);
    renderTables(cos,years,score);
    renderSources(cos,years);
    setQuery();
  }
  function chartScale(values) {
    const lo=Math.min(0,...values), hi=Math.max(0,...values);
    const raw=(hi-lo || 4)/4;
    const order=10**Math.floor(Math.log10(raw));
    const step=([1,2,2.5,5,10].find(k=>k*order>=raw)||10)*order;
    const min=Math.floor(lo/step)*step, max=hi===lo?min+step*4:Math.ceil(hi/step)*step;
    const ticks=Array.from({length:Math.round((max-min)/step)+1},(_,i)=>min+i*step);
    return {min,max,ticks};
  }
  const axisValue=n=>new Intl.NumberFormat('en-GB',{maximumFractionDigits:2}).format(Math.abs(n)<1e-8?0:n)+'%';
  function renderBars(currentIds,years) {
    const key=state.bar, values=currentIds.map((id,i)=>M.metric(company(id),years[i],key));
    const valid=values.filter(Number.isFinite);
    if(!valid.length){$('bars').innerHTML='<p class="chart-empty">No reported values for this period.</p>';return;}
    const scale=chartScale(valid), left=94,right=409;
    const x=v=>left+(v-scale.min)/(scale.max-scale.min)*(right-left);
    const h=170, rowHeight=131/values.length;
    const ticks=scale.ticks.map(v=>`<line class="${v===0?'zero-line':'axis-line'}" x1="${x(v)}" x2="${x(v)}" y1="4" y2="143"/><text x="${x(v)}" y="162" text-anchor="middle">${axisValue(v)}</text>`).join('');
    const bars=values.map((v,i)=>{
      const y=7+(i+.5)*rowHeight,symbol=label(currentIds[i],i);
      const title=company(currentIds[i]).name+' · '+M.labels[key]+' · '+pct(v);
      const bar=Number.isFinite(v)?`<rect x="${Math.min(x(v),x(0))}" y="${y-8}" width="${Math.max(1,Math.abs(x(v)-x(0)))}" height="16" rx="3" fill="${colors[i]}"/>`:'';
      return `<g><title>${escape(title)}</title><text x="0" y="${y+4}">${escape(symbol)}</text>${bar}<text class="bar-value" x="478" y="${y+4}" text-anchor="end">${pct(v)}</text></g>`;
    }).join('');
    $('bars').innerHTML=`<svg viewBox="0 0 480 ${h}" role="img" aria-label="${escape(M.labels[key]+' by company. '+currentIds.map((id,i)=>company(id).name+' '+pct(values[i])).join(', '))}">${ticks}${bars}</svg>`;
  }
  function renderTrend(currentIds) {
    const key=state.trend, end=state.period==='latest'?'9999':state.period;
    const series=currentIds.map(id=>company(id).years.filter(y=>y.end.slice(0,4)<=end).slice(0,3).map(y=>({year:+y.end.slice(0,4),date:y.end,value:M.metric(company(id),y,key)})));
    const xYears=[...new Set(series.flat().map(p=>p.year))].sort((a,b)=>a-b);
    const valid=series.flat().map(p=>p.value).filter(Number.isFinite);
    if(!valid.length){$('trend').innerHTML='<p class="chart-empty">No reported values through this fiscal year.</p>';return;}
    const chart=chartScale(valid), left=54,right=460,top=10,base=135;
    const x=year=>xYears.length<2?(left+right)/2:left+(year-xYears[0])/(xYears.at(-1)-xYears[0])*(right-left);
    const y=v=>base-(v-chart.min)/(chart.max-chart.min)*(base-top);
    const grid=chart.ticks.map(v=>`<line class="${v===0?'zero-line':'axis-line'}" x1="${left}" x2="${right}" y1="${y(v)}" y2="${y(v)}"/><text x="${left-7}" y="${y(v)+4}" text-anchor="end">${axisValue(v)}</text>`).join('');
    const years=xYears.map(year=>`<text x="${x(year)}" y="154" text-anchor="middle">${year}</text>`).join('');
    const lines=series.map((points,i)=>{
      let previous;
      return points.slice().reverse().map(p=>{
        if(!Number.isFinite(p.value)){previous=undefined;return '';}
        const segment=previous && p.year===previous.year+1?`<line x1="${x(previous.year)}" x2="${x(p.year)}" y1="${y(previous.value)}" y2="${y(p.value)}" stroke="${colors[i]}" stroke-width="2.7"/>`:'';
        previous=p;
        const title=company(currentIds[i]).name+' · '+date(p.date)+' · '+pct(p.value);
        return segment+`<circle tabindex="0" aria-label="${escape(title)}" cx="${x(p.year)}" cy="${y(p.value)}" r="4.5" fill="${colors[i]}" stroke="white" stroke-width="1.5"><title>${escape(title)}</title></circle>`;
      }).join('');
    }).join('');
    const legend=currentIds.map((id,i)=>`<span><i class="dot" style="${columnColors[i]}"></i>${escape(label(id,i))}</span>`).join('');
    $('trend').innerHTML=`<svg viewBox="0 0 480 161" role="group" aria-label="${escape(M.labels[key])} by fiscal year">${grid}${years}${lines}</svg><div class="chart-legend">${legend}</div>`;
  }
  function tableHead(companies,title) {
    return `<caption class="sr-only">${title}</caption><thead class="sr-only"><tr><th scope="col">Measure</th>${companies.map(c=>`<th scope="col">${escape(c.name)}</th>`).join('')}</tr></thead>`;
  }
  function row(title,values,formatter,winners=[],css='') {
    const cells=values.map((v,i)=>{
      const win=winners.includes(i);
      const mark=win?`<span class="win-mark" aria-label="${winners.length>1?'Joint leader':'Leader'}">✓</span>`:'';
      return `<td class="${win?'winner':Number.isFinite(v)?'':'unavailable'}">${mark}${escape(formatter(v))}</td>`;
    }).join('');
    return `<tr class="${css}"><th scope="row">${escape(title)}</th>${cells}</tr>`;
  }
  function renderTables(cos,years,score) {
    const valueFor=key=>cos.map((c,i)=>M.metric(c,years[i],key));
    const sections=M.groups.map(([title,keys])=>[title,keys.map(k=>row(M.fields[k],valueFor(k),amount)).join('')]);
    const ratioKeys=cos.some(M.financial)?M.criteria(cos):Object.keys(M.labels);
    sections.push(['Financial ratios',ratioKeys.map(k=>{
      const vals=valueFor(k),format=k==='currentRatio'?v=>Number.isFinite(v)?num(v,2)+'×':'—':pct;
      return row(M.labels[k],vals,format,k==='currentRatio'?[]:M.leaders(vals));
    }).join('')]);
    $('statement-table').innerHTML=tableHead(cos,'Annual financial statements and ratios')+sections.map(([title,rows])=>`<tbody><tr class="group-row"><th scope="rowgroup" colspan="${cos.length+1}">${escape(title)}</th></tr>${rows}</tbody>`).join('');
    const price=v=>Number.isFinite(v)?new Intl.NumberFormat('en-GB',{maximumFractionDigits:2}).format(v):'—';
    const result=new Intl.ListFormat('en-GB',{style:'long',type:'conjunction'}).format(score.winners.map(i=>cos[i].name));
    const count=score.counted, title=count?(result+(score.winners.length>1?' share the lead':' leads the checklist')):'No comparable score';
    const description=count?`${price(score.scores[score.winners[0]])} of ${count} available points · ${count} of ${score.rows.length} criteria scored`:
      cos.length===1?'Choose a competitor to score the checklist.':'The selected period has no checklist measure available for every company.';
    $('check-result').innerHTML=`<strong>${escape(title)}</strong>${escape(description)}`;
    $('check-table').innerHTML=tableHead(cos,'Fundamentals checklist')+'<tbody>'+score.rows.map(r=>row(M.labels[r.key],r.values,pct,r.winners)).join('')+
      row('Checklist points',count?score.scores:cos.map(()=>null),price,score.winners,'total')+'</tbody>';
  }
  function renderSources(cos,years) {
    $('sources').innerHTML=cos.map((c,i)=>{
      const year=years[i],src=c.sources;
      const links=src.map(s=>safeLink(s.url,s.label)).join(' · ');
      const refs=Object.entries(year?.refs||{}).filter(([key])=>M.fields[key]).map(([key,ref])=>{
        const secTable=String(ref).match(/^((?:R|r)\d+\.htm)\b/i);
        const reference=secTable && c.filingUrl && c.filingUrl.includes('sec.gov/Archives/')?safeLink(new URL(secTable[1],c.filingUrl).href,ref):escape(ref);
        return `<li><b>${escape(M.fields[key])}</b> · ${reference}</li>`;
      }).join('');
      const notes=[...new Set(Object.values(c.notes||{}).flat().filter(v=>typeof v==='string'))];
      const noteRows=notes.map(v=>`<li>${escape(v)}</li>`).join('');
      return `<details class="source-card"><summary>${escape(c.name)} · ${escape(c.form)}</summary><p>Report period ended ${escape(date(c.period))}${c.filed?' · Filed or published '+escape(date(c.filed)):''}.</p><p>${links}</p>${refs?`<p><b>Figures for ${escape(date(year.end))}</b></p><ul>${refs}</ul>`:''}${noteRows?`<ul>${noteRows}</ul>`:''}</details>`;
    }).join('');
    $('method-text').innerHTML=`<p>Filing snapshot checked ${escape(date(state.data.asOf))}. The 110 covered listings represent 97 issuers. Cross-listed shares use the same consolidated statements. Automatic competitors share business activities. The picker also includes industry benchmarks outside the 110. You can change the peer group.</p>
      <p>Each column uses the currency shown in its header. Amounts are in the selected units. Fiscal years can end in different months. “Latest reported” uses each issuer’s latest available annual period. Choosing a year compares periods ending in that calendar year. A dash means the filing lacks a comparable figure or the calculation does not apply.</p>
      <p>Revenue and profit growth use the preceding annual period and require a positive starting value. Margins divide the measure by revenue. Returns divide net income to owners by average opening and closing equity or assets. Free cash flow subtracts cash purchases of property, plant and equipment from operating cash flow. Current ratio divides current assets by current liabilities.</p>
      <p>Green checks mark the highest comparable percentage at one decimal place. Every company must have a value for the criterion to count. Tied companies share one point. The checklist sums these points. A check beside a company name marks an overall checklist leader. Financial institutions and REITs use revenue growth, profit growth, return on equity and return on assets. Nominal amounts and current ratios carry no points.</p>
      <p>The filing links include SEC 10-K, 20-F and 40-F filings, annual reports from other markets, and supporting statements where applicable. SpaceX uses the audited annual statements in its final IPO prospectus. Accounting standards, business mix and fiscal calendars can affect comparisons.</p>`;
  }
  function openPicker(mode) {
    state.picker=mode;state.draft=[...peers()];$('picker-title').textContent=mode==='focus'?'Choose a focus company':'Choose competitors';
    $('picker-actions').hidden=mode==='focus';$('peer-draft').hidden=mode==='focus';$('company-search').value='';
    renderPicker();$('picker').showModal();$('company-search').focus();
  }
  function renderPicker() {
    const query=$('company-search').value.trim().toLowerCase(),focusMode=state.picker==='focus',data=state.data;
    let entries=focusMode?data.listings.map(l=>({id:l.id,ticker:l.ticker,name:l.name||company(l.id).name,value:l.ticker})):
      Object.entries(data.companies).filter(([id])=>id!==listing().id).map(([id,c])=>({id,ticker:c.ticker,name:c.name,value:id}));
    const normalize=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
    entries=entries.filter(e=>(e.name+' '+company(e.id).name+' '+e.ticker+' '+e.id).toLowerCase().includes(query)||
      normalize(e.ticker).includes(normalize(query))&&!!normalize(query));
    if(!focusMode) entries.sort((a,b)=>Number(state.draft.includes(b.id))-Number(state.draft.includes(a.id))||
      Number(company(listing().id).peers.includes(b.id))-Number(company(listing().id).peers.includes(a.id))||a.name.localeCompare(b.name));
    $('peer-draft').textContent=state.draft.length+' of 3 selected'+(state.draft.length?' · '+state.draft.map(id=>company(id).name).join(' / '):'');
    $('picker-list').innerHTML=entries.length?entries.map(e=>{
      const selected=focusMode?e.ticker===state.focus:state.draft.includes(e.id), benchmark=!focusMode&&company(e.id).benchmark;
      return `<button type="button" data-value="${escape(e.value)}" class="${selected?'is-selected':''}" ${focusMode?'':'aria-pressed="'+selected+'"'} ${!focusMode&&!selected&&state.draft.length===3?'disabled':''}><span>${selected?'✓ ':''}${escape(e.name)}</span><small>${escape(e.ticker)}${benchmark?' · Peer':''}</small></button>`;
    }).join(''):'<p>No companies match your search.</p>';
  }
  $('picker-list').addEventListener('click',event=>{
    const b=event.target.closest('button[data-value]');if(!b)return;
    const value=b.dataset.value;
    if(state.picker==='focus'){
      state.focus=value;state.custom=null;state.period='latest';state.bar='operatingMargin';state.trend='netMargin';$('picker').close();render();
    } else {
      if(state.draft.includes(value)) state.draft=state.draft.filter(k=>k!==value);
      else if(state.draft.length<3) state.draft.push(value);
      renderPicker();const active=Array.from($('picker-list').querySelectorAll('button')).find(button=>button.dataset.value===value);active?.focus({preventScroll:true});
    }
  });
  $('choose-company').onclick=()=>openPicker('focus');$('choose-peers').onclick=()=>openPicker('peers');
  $('close-picker').onclick=()=>$('picker').close();$('company-search').oninput=renderPicker;
  $('auto-peers').onclick=()=>{state.custom=null;$('picker').close();render();};
  $('apply-peers').onclick=()=>{state.custom=[...state.draft];$('picker').close();render();};
  $('period').onchange=e=>{state.period=e.target.value;render();};
  $('units').onchange=e=>{state.unit=e.target.value;render();};
  $('bar-metric').onchange=e=>{state.bar=e.target.value;renderBars(ids(),ids().map(id=>M.yearFor(company(id),state.period)));};
  $('trend-metric').onchange=e=>{state.trend=e.target.value;renderTrend(ids());};
  const scrollers=['company-scroll','statement-scroll','check-scroll'].map($);
  scrollers.forEach(scroller=>scroller.addEventListener('scroll',()=>{
    for(const other of scrollers) if(Math.abs(other.scrollLeft-scroller.scrollLeft)>1)other.scrollLeft=scroller.scrollLeft;
  },{passive:true}));
  new ResizeObserver(([entry])=>$('comparison').style.setProperty('--company-head-height',Math.ceil(entry.contentRect.height+2)+'px')).observe($('companies'));
  async function load() {
    $('load-status').textContent='Loading annual filings…';$('retry').hidden=true;
    try {
      const response=await fetch(window.ContentDelivery.CONTENT+endpoint,{signal:AbortSignal.timeout(30000)});
      if(!response.ok)throw Error('Unavailable');
      const data=await response.json();
      if(!Array.isArray(data.listings)||!data.companies||data.listings.length!==110)throw Error('Invalid coverage');
      state.data=data;
      const q=new URLSearchParams(location.search), input=(q.get('ticker')||'GOOG US').toUpperCase();
      state.focus=(data.listings.find(l=>l.ticker===input||l.id===input)||data.listings.find(l=>l.ticker==='GOOG US')||data.listings[0]).ticker;
      if(q.has('peers')) state.custom=[...new Set(q.get('peers').split(','))].filter(id=>id!==listing().id&&company(id)).slice(0,3);
      state.period=q.get('year')||'latest';
      render();$('filing-app').hidden=false;$('load-status').hidden=true;
    } catch(error) {
      $('load-status').hidden=false;$('load-status').textContent='Annual filing data could not be loaded.';$('retry').hidden=false;console.error('Shares Beta 3',error);
    }
  }
  $('retry').onclick=load;load();
})();

