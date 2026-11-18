(() => {
  'use strict';
  const host = document.querySelector('[data-breach-app]');
  const replay = document.body.dataset.breachView === 'replay';
  const E = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = (n, digits = 3) => Number.isFinite(n) ? n.toLocaleString('en-US', {maximumFractionDigits: digits}) : '—';
  const signed = (n, digits = 2) => Number.isFinite(n) ? (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toFixed(digits) : '—';
  const B = FredBreaches;
  const archive = FredArchive;
  const base = new URL('../data/', document.currentScript.src);
  const pageSize = 8;
  const state = {years:5, scope:'active', level:'all', group:'', page:0, window:'period', selection:null, items:[], events:[], active:[], byId:new Map(), charts:new Map(), markets:[], marketIds:[], historicalEvents:[], share:'', bond:'', marketToken:0};
  const marketNames = {
    DGS2:'US Treasury 2Y', DGS10:'US Treasury 10Y', DGS30:'US Treasury 30Y',
    DEXSIUS:'USD/SGD', DEXSZUS:'USD/CHF', DTWEXBGS:'Broad US dollar index',
    VIXCLS:'VIX', NASDAQ100:'Nasdaq-100', DCOILWTICO:'WTI crude oil'
  };
  const rates = new Set(['DGS2','DGS10','DGS30']);
  const familyMarkets = {
    'Credit & bonds':['DGS10','SPX','DTWEXBGS'],
    'Banks & lending':['DGS2','SPX','DEXSIUS'],
    'Treasury & government debt':['DGS2','DGS10','SPX','DEXSIUS'],
    'Trade & external accounts':['DTWEXBGS','DEXSIUS','DGS10','SPX'],
    'Equities':['SPX','NASDAQ100','DGS10','DTWEXBGS'],
    'Currencies':['DEXSIUS','DEXSZUS','DTWEXBGS','DGS2'],
    'Commodities':['DCOILWTICO','DGS10','DTWEXBGS','SPX']
  };
  const defaultMarkets = ['DGS2','DGS10','SPX','DEXSIUS'];
  const notes = {
    'Credit & bonds':'Read spreads and yields alongside bond total-return growth. A wider spread, higher yield and slower total-return growth are three different measures.',
    'Banks & lending':'Compare delinquency, charge-offs and lending balances at their published frequencies. Quarterly household data represents a period.',
    'Treasury & government debt':'Separate changes in government yields from changes in debt and ownership. An auction bid-to-cover ratio measures demand at one sale.',
    'Trade & external accounts':'Check trade balances, import and export prices, and external positions alongside the dollar. Country goods trade and aggregate goods-and-services trade have different coverage.',
    'Economy & jobs':'Activity and labour series use different release calendars. Read each breach within its own observation period.',
    'Liquidity & funding':'Funding rates and balance-sheet quantities can move in different directions. Check the heat metric and units before comparing readings.',
    'Currencies':'A rising USD/SGD or USD/CHF reading means the dollar bought more of the quoted currency. The broad dollar index tracks a basket.',
    'Inflation':'Compare the actual price measure and its transform. Breakevens are market-implied compensation, while CPI and PCE are published price indices.'
  };
  const get = id => document.getElementById(id);
  const link = url => {try {const u = new URL(url);return u.protocol === 'https:' ? u.href : '';}catch {return '';}};
  const badge = (z, band = B.tier(z)) => '<span class="event-badge heat-' + band + ' ' + (z < 0 ? 'negative' : 'positive') + '">' + (Number.isFinite(z) ? signed(z) + 'σ' : 'Unavailable') + '</span>';
  const option = (value, name, selected) => '<option value="' + E(value) + '"' + (value === selected ? ' selected' : '') + '>' + E(name) + '</option>';
  const options = (pairs, selected) => pairs.map(([id,name]) => option(id,name,selected)).join('');
  async function json(url) {
    const res = await fetch(url, {cache:'no-cache'});
    if (!res.ok) throw Error('HTTP ' + res.status);
    return res.json();
  }
  const local = file => json(new URL(file,base));
  const eventLabel = event => !event.observed ? 'First scored ≥' + event.threshold + 'σ' : 'Crossed ' + event.threshold + 'σ';
  const marketUnit = series => series.kind === 'yield' ? ' bp' : '%';
  const metricName = metric => metric.label + (metric.transform === 'yoy' ? ' · YoY %' : metric.transform === 'year_change' ? ' · change from year ago' : ' · level');
  function market(entry) {
    const id = entry.id, metric = entry.metrics.find(m => m.field === entry.default_field);
    return {id,name:marketNames[id],kind:rates.has(id)?'yield':'price',unit:metric?.unit || entry.unit,
      source:entry.source_url,basis:'Saved daily FRED observations',points:B.points(entry.default_series.points)};
  }
  function recalculate() {
    state.events = []; state.active = []; state.byId.clear();
    state.items = state.index.datasets.map(entry => {
      const metric = entry.metrics.find(m => m.field === entry.default_field) || entry.metrics[0];
      const ambiguous = entry.sigma_unavailable || entry.default_series.sigma_unavailable;
      const rows = ambiguous ? [] : FredSigma.analyze(entry.default_series.points,{
        years:state.years,frequency:entry.frequency,transform:metric.transform,excludeDates:entry.quality_dates || []
      });
      const item = {...entry,metric,mainGroup:FredOverview.mainGroup(entry),rows,latest:rows.at(-1)};
      const found = B.crossings(rows,entry.frequency,entry.id);
      item.crossing = found.active.get(B.tier(item.latest?.z)) || null;
      state.events.push(...found.events.filter(event => event.observed));
      if (item.crossing) state.active.push(item.crossing);
      state.byId.set(item.id,item);
      return item;
    });
    state.events = B.sortedEvents(state.events);
    state.active = B.sortedEvents(state.active);
    const initial = state.active.filter(e=>e.threshold===2).sort((a,b)=>Math.abs(state.byId.get(b.id).latest.z)-Math.abs(state.byId.get(a.id).latest.z))[0] || state.active[0] || state.events[0];
    const requested = new URLSearchParams(location.search).get('event');
    const current = state.selection?.key || requested;
    setEvent(state.active.find(e=>e.key===current) || state.events.find(e=>e.key===current) || initial);
  }
  function setEvent(event) {
    const previousGroup = state.selection && state.byId.get(state.selection.id)?.mainGroup;
    state.selection = event || null;
    const newGroup = event && state.byId.get(event.id)?.mainGroup;
    if (previousGroup !== newGroup || !state.marketIds.length) state.marketIds = (familyMarkets[newGroup] || defaultMarkets).slice();
  }
  function renderShell() {
    const count = [0,0,0,0];
    for (const item of state.items) count[B.tier(item.latest?.z)+1]++;
    host.innerHTML = `
      <section class="timeline-panel panel" aria-labelledby="timeline-title">
        <div class="panel-head"><div><h2 id="timeline-title">SD breach timeline</h2><p>Saved ${E(state.index.snapshot)} · select an event to inspect the breach and nearby market prices.</p></div></div>
        <div class="breach-controls">
          <label>Timeline <select id="breach-scope">${options([['active','Current breach runs'],['recent','Last 90 days of crossings'],['history','All saved crossings']],state.scope)}</select></label>
          <label>Threshold <select id="breach-level">${options([['all','Both thresholds'],['2','2 SD'],['1','1 SD']],state.level)}</select></label>
          <label>Main group <select id="breach-group">${options([['','All main groups'],...[...new Set(state.items.map(i=>i.mainGroup))].sort().map(g=>[g,g])],state.group)}</select></label>
          <label>SD baseline <select id="breach-years">${options([5,10,15,20].map(y=>[y,'Prior '+y+' years']),state.years)}</select></label>
        </div>
        <div class="event-legend"><span class="event-badge heat-2 positive">≥2σ</span><span class="event-badge heat-1 positive">1σ</span><span>Warm = above prior mean · blue = below</span></div>
        <div id="breach-events"></div>
      </section>
      <div class="breach-totals" aria-label="Archive signal counts"><span><b>${state.items.length}</b> datasets</span><span><b>${count[3]}</b> at or beyond 2σ</span><span><b>${count[2]}</b> 1σ to below 2σ</span><span><b>${count[1]}</b> below 1σ</span><span><b>${count[0]}</b> unavailable</span></div>
      <nav class="panel-jump" aria-label="Page sections"><a href="#grouped-signals">Grouped signals ↓</a><a href="#event-replay">Selected event ↓</a><a href="#method">Method &amp; coverage ↓</a></nav>
      ${replay ? '<div id="event-replay"></div><div id="grouped-signals"></div>' : '<div id="grouped-signals"></div><div id="event-replay"></div>'}
      <details class="panel method" id="method"><summary>How breaches and market windows are measured</summary>
        <p>Each native-frequency reading uses that dataset's recommended measure and the prior ${state.years} calendar years. Sigma is the distance from the prior mean divided by sample SD. The current reading is excluded from the baseline. At least 12 prior readings and a nonzero SD are required. A shorter available history can still contribute.</p>
        <p>A crossing is entry into a threshold band or entry on the opposite side of the mean, compared with the last scorable observation. Missing observations widen that interval. A first scorable reading outside the band is marked separately. Current breach runs show the entry for the latest band. All saved crossings includes re-entries and the 1σ and 2σ steps of the same observation.</p>
        <p>The timeline labels source periods. Monthly and quarterly periods use their end date for alignment to daily markets. Fiscal-year observations use their labelled fiscal-year end. These dates represent the measured interval. Check official release dates before inferring a reaction or using revised histories to test a trading rule.</p>
        <p>Market comparisons use actual dates and source units. For monthly and quarterly readings the default window compares the first and last available market observations within that period. For daily observations the default is ten calendar days on each side. Earlier or later endpoints can be missing. Prices are in local currency, and stock price changes exclude dividends. Yield changes are in basis points. Nearby changes show context and cannot establish a cause.</p>
        <p>Read the <a href="data.html">complete dataset and record tables</a>, <a href="../historical-fred.html">historical market charts</a> and <a href="../v4.html#history">bond, FX and share workspaces</a>.</p>
      </details>`;
    renderTimeline(); renderGroups(); renderSelection();
  }
  function visibleEvents() {
    let list = state.scope === 'active' ? state.active : state.events;
    if (state.scope === 'recent') list = list.filter(e=>e.period.end>=B.offset(state.index.snapshot,-90));
    return list.filter(e=>(state.level==='all'||e.threshold===Number(state.level))&&(!state.group||state.byId.get(e.id).mainGroup===state.group));
  }
  function renderTimeline() {
    const list = visibleEvents();
    const pages = Math.max(1,Math.ceil(list.length/pageSize));
    state.page = Math.min(state.page,pages-1);
    const start = state.page*pageSize;
    get('breach-events').innerHTML = list.length ? `<div class="event-grid">${list.slice(start,start+pageSize).map(event=>{
      const item = state.byId.get(event.id);
      return `<button type="button" class="event heat-${event.threshold} ${event.z<0?'negative':'positive'}" data-event="${E(event.key)}" aria-pressed="${event.key===state.selection?.key}">
        <span class="event-date">${E(event.period.label)} · ${E(eventLabel(event))}</span><strong>${E(item.name)}</strong>
        <span class="event-meta">${E(item.mainGroup)} ${badge(event.z,event.threshold)}</span>
      </button>`;
    }).join('')}</div><div class="event-pages"><span role="status">${start+1}–${Math.min(start+pageSize,list.length)} of ${number(list.length,0)} events</span>
      <button type="button" data-page="-1" ${state.page===0?'disabled':''}>Previous</button><button type="button" data-page="1" ${state.page>=pages-1?'disabled':''}>Next</button></div>` : '<p class="empty">No events in this selection. Change threshold, group or timeline.</p>';
  }
  function groupCard(group, items, threshold, index) {
    const lead = items[0];
    const head = `<strong>${E(group)}</strong><span>${items.length} ${items.length===1?'reading':'readings'} · ${badge(lead.latest.z,threshold)}</span>`;
    const summary = `<p class="group-copy">${E(notes[group] || 'Read each observation against its previous range and open a breach to compare the relevant market history.')}</p>`;
    const context = lead.crossing ? (familyMarkets[group] || defaultMarkets).slice(0,3).flatMap(id=>{
      const series=state.markets.find(m=>m.id===id);
      if(!series)return [];
      const move=B.marketWindow(series,lead.crossing.period,'period',state.index.snapshot);
      return Number.isFinite(move.change)?[`${series.name} ${signed(move.change)}${marketUnit(series)}`]:[];
    }) : [];
    const rows = items.map(item=>{
      const event=item.crossing;
      const text = event ? event.period.label + ' · ' + eventLabel(event) : 'Entry unavailable';
      return `<li><div><strong>${E(item.name)}</strong><small>${E(metricName(item.metric))} · ${E(B.period(item.latest.date,item.frequency).label)}</small><small>${E(text)}</small></div>${badge(item.latest.z,threshold)}
        ${event?`<button type="button" data-event="${E(event.key)}">Replay</button>`:''}</li>`;
    });
    return `<article class="group-card" aria-labelledby="breach-group-card-${index}">
      <h4 class="group-card-head heat-${threshold} ${lead.latest.z<0?'negative':'positive'}" id="breach-group-card-${index}">${head}</h4>
      ${summary}${context.length?`<p class="group-market"><strong>Near the ${E(lead.crossing.period.label)} breach</strong> ${E(context.join(' · '))}</p>`:''}
      <ul class="signal-list">${rows.slice(0,5).join('')}</ul>
      ${items.length>5?`<details class="remaining"><summary>Show ${items.length-5} more</summary><ul class="signal-list">${rows.slice(5).join('')}</ul></details>`:''}
    </article>`;
  }
  function renderGroups() {
    let index = 0;
    get('grouped-signals').innerHTML = '<section class="groups-panel" aria-labelledby="grouped-title"><h2 id="grouped-title">Grouped signals</h2>' +
      [2,1].map(threshold=>{
        const items = state.items.filter(item=>B.tier(item.latest?.z)===threshold&&(!state.group||item.mainGroup===state.group));
        const groups = new Map();
        for(const item of items.sort((a,b)=>Math.abs(b.latest.z)-Math.abs(a.latest.z))) {
          if(!groups.has(item.mainGroup)) groups.set(item.mainGroup,[]);
          groups.get(item.mainGroup).push(item);
        }
        const title = threshold===2?'At or beyond 2σ':'1σ to below 2σ';
        return `<section class="tier-section"><div class="tier-heading"><h3>${title}</h3><small>${items.length} readings · ${groups.size} groups</small></div>
          <div class="research-grid">${[...groups].map(([group,rows])=>groupCard(group,rows,threshold,index++)).join('')||'<p class="empty">No readings in this band for the current selection.</p>'}</div></section>`;
      }).join('')+'</section>';
  }
  function chart(rows, {id, title, unit, anchor, sd=false}) {
    const drawable = rows.filter(r=>Number.isFinite(r.value));
    if (drawable.length < 2) return '<p class="empty">Fewer than two saved observations fall in this chart window.</p>';
    const stats = new Map(sd ? rows.map(row=>[row,FredOverview.guides(row)]) : []);
    const values = drawable.map(r=>r.value);
    for (const guide of stats.values()) if(guide) values.push(guide.lower2,guide.upper2);
    let low=Math.min(...values),high=Math.max(...values);
    const pad=(high-low||Math.max(Math.abs(high)*.1,1))*.09;low-=pad;high+=pad;
    const w=600,h=196,l=57,r=14,t=14,b=29;
    const start=Date.parse(rows[0].date),span=Date.parse(rows.at(-1).date)-start||1;
    const x=date=>l+(Date.parse(date)-start)/span*(w-l-r);
    const y=value=>h-b-(value-low)/(high-low)*(h-b-t);
    const path=(reader)=>{let connected=false;return rows.map(row=>{
      const v=reader(row);
      if(!Number.isFinite(v)){connected=false;return '';}
      const cmd=(connected?'L':'M')+x(row.date).toFixed(2)+','+y(v).toFixed(2);connected=true;return cmd;
    }).join(' ');};
    const grid=Array.from({length:4},(_,i)=>{const v=low+(high-low)*i/3,yy=y(v);return `<line x1="${l}" x2="${w-r}" y1="${yy}" y2="${yy}" class="chart-grid"/><text x="${l-5}" y="${yy+3}" text-anchor="end">${E(number(v,2))}</text>`;}).join('');
    const guides=sd?['lower2','upper2','lower1','upper1','mean'].map(key=>`<path class="guide ${key}" d="${path(row=>stats.get(row)?.[key])}"/>`).join(''):'';
    const marked=anchor && Date.parse(anchor)>=start && Date.parse(anchor)<=start+span;
    const nearest=marked?drawable.reduce((best,row,i)=>Math.abs(Date.parse(row.date)-Date.parse(anchor))<Math.abs(Date.parse(drawable[best].date)-Date.parse(anchor))?i:best,0):drawable.length-1;
    state.charts.set(id,{drawable,x,y,unit,sd});
    const point=drawable[nearest];
    return `<div class="interactive-chart"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${E(title)}">
      ${grid}${guides}${marked?`<line class="event-line" x1="${x(anchor)}" x2="${x(anchor)}" y1="${t}" y2="${h-b}"/>`:''}
      <path class="price-line" d="${path(row=>row.value)}"/><circle id="dot-${id}" cx="${x(point.date)}" cy="${y(point.value)}" r="4"/>
      <text x="${l}" y="${h-8}">${E(rows[0].date)}</text><text x="${w-r}" y="${h-8}" text-anchor="end">${E(rows.at(-1).date)}</text></svg>
      <label class="chart-cursor">Inspect observation <input type="range" min="0" max="${drawable.length-1}" value="${nearest}" data-chart="${id}" aria-label="Inspect ${E(title)}"></label>
      <output id="read-${id}" class="chart-read">${chartRead(point,unit,sd)}</output></div>`;
  }
  function chartRead(point,unit,sd) {
    return E(point.date)+' · '+number(point.value)+' '+E(unit)+(sd&&Number.isFinite(point.z)?' · '+signed(point.z)+'σ · prior N='+number(point.n,0):'');
  }
  function renderSelection() {
    state.charts.clear();
    const event = state.selection;
    const dest = get('event-replay');
    if(!event){dest.innerHTML='<section class="panel"><p>No comparable breach in the saved archive for this baseline.</p></section>';return;}
    const item = state.byId.get(event.id), row=item.rows[event.index], prev=event.previous;
    const extent = item.frequency.startsWith('Daily') ? 45 : item.frequency.startsWith('Weekly') ? 28 : 14;
    const displayRows=item.rows.slice(Math.max(0,event.index-extent),event.index+extent+1);
    const heatUnit = item.metric.transform==='yoy'?'% YoY':item.metric.unit;
    dest.innerHTML = `<section class="panel replay-panel" aria-labelledby="event-title">
      <div class="selected-heading heat-${event.threshold} ${event.z<0?'negative':'positive'}"><div><p>${E(event.period.label)} · ${E(eventLabel(event))}</p><h2 id="event-title" tabindex="-1">${E(item.name)}</h2><p>${E(item.mainGroup)} · ${E(metricName(item.metric))}</p></div>${badge(event.z,event.threshold)}</div>
      <div class="panel-body"><p class="event-explanation">The ${E(event.period.label)} observation was <strong>${number(row.value)} ${E(heatUnit)}</strong>, ${number(Math.abs(row.z),2)} SD ${row.z<0?'below':'above'} its prior mean of ${number(row.mean)}. The sample SD was ${number(row.sd)} from ${number(row.n,0)} prior readings.${prev?` Previous scorable reading: ${E(B.period(prev.date,item.frequency).label)} (${signed(prev.z)}σ).`:' This is the first scorable observation in the run.'} ${event.skipped?number(event.skipped,0)+' unscorable observations sit between the two dated readings.':''}</p>
        <p class="fine">Source observation date ${E(event.date)} · market alignment ${E(event.period.end)} · <a href="data.html#${encodeURIComponent(item.id)}">Full series and records ↗</a>${link(item.source_url)?' · <a href="'+E(link(item.source_url))+'">Official source ↗</a>':''}${!replay?' · <a href="cross-market-replay.html?event='+encodeURIComponent(event.key)+'&years='+state.years+'#event-replay">Open this event in V4 ↗</a>':''}</p>
        <div class="macro-chart"><div class="guide-key"><span>Metric</span><span>Prior mean</span><span>±1 SD</span><span>±2 SD</span></div>${chart(displayRows,{id:'macro',title:item.name,unit:heatUnit,anchor:event.date,sd:true})}</div>
        <div class="market-section"><h3>What markets were pricing</h3><p class="fine">${E(notes[item.mainGroup]||'Compare rates, equities and FX over the same dated window.')}</p>
          <div class="breach-controls market-controls"><label>Market window <select id="market-window">${options([['period','Observation period / ±10 days'],['5','±5 calendar days'],['20','±20 calendar days'],['60','±60 calendar days']],state.window)}</select></label>
          <label>Additional stock <select id="market-share" ${state.shares?'':'disabled'}>${options([['',state.shares?'Choose a saved listing':'Loading saved listings…'],...(state.shares||[]).map(s=>[s.id,s.name+' · '+s.id+' · '+s.currency])],state.share)}</select></label>
          <label>Additional bond <select id="market-bond" ${state.bonds?'':'disabled'}>${options([['',state.bonds?'Choose a saved bond':'Loading saved bonds…'],...(state.bonds?.instruments||[]).map(b=>[b.id,b.name+' · '+b.currency])],state.bond)}</select></label></div>
          <details class="market-picker" ${replay?'open':''}><summary>Choose market series</summary><div class="market-checks">${state.markets.map(m=>`<label><input type="checkbox" value="${E(m.id)}" data-market ${state.marketIds.includes(m.id)?'checked':''}>${E(m.name)}</label>`).join('')}</div></details>
          <div id="market-context" role="status"></div><div id="market-chronology"></div><div id="market-panels" class="market-grid"></div></div>
      </div></section>`;
    renderMarkets();
  }
  async function renderMarkets() {
    const target=get('market-panels');
    if(!target||!state.selection)return;
    const own=++state.marketToken,event=state.selection;
    const chosen=state.markets.filter(m=>state.marketIds.includes(m.id));
    const notes=[];
    if (state.bond && state.bonds) {
      const bond=state.bonds.instruments.find(b=>b.id===state.bond);
      const history=state.bonds.history[state.bond]||[];
      if(bond){
        chosen.push({name:bond.name+' · asked yield',unit:'%',kind:'yield',basis:'Saved quoted yield · '+bond.id,source:bond.source_url,points:B.points(history.map(p=>[p.date,p.yield_pct]))});
        chosen.push({name:bond.name+' · ask price',unit:bond.currency+' per 100',kind:'price',basis:'Saved ask price · '+bond.id,source:bond.source_url,points:B.points(history.map(p=>[p.date,p.ask]))});
      }
    }
    if(state.share){
      target.innerHTML='<p class="empty">Loading saved listing history…</p>';
      try {
        const history=await ShareLabData.historyFor(state.share);
        if(own!==state.marketToken)return;
        const daily=history.metrics.globalPrice.filter(p=>p.currency===history.record?.currency&&p.sourceId==='global-top100-close-2026-11-05');
        if(history.record&&daily.length)chosen.push({name:history.record.name+' · '+history.record.id,unit:history.record.currency,kind:'price',basis:'Saved provider daily close · '+history.record.currency,source:daily[0].sourceUrl,points:B.points(daily.map(p=>[p.date,p.value]))});
        else notes.push('No comparable daily closes for the selected listing.');
      } catch { notes.push('The saved listing history could not be loaded.'); }
    }
    if(own!==state.marketToken)return;
    for(const id of state.charts.keys())if(id.startsWith('market-'))state.charts.delete(id);
    const printed=[];
    const window=B.marketWindow({points:[]},event.period,state.window,state.index.snapshot);
    const related=state.historicalEvents.filter(e=>e.date>=window.start&&e.date<=window.end&&link(e.url)).slice(0,5);
    get('market-chronology').innerHTML=related.length
      ? '<p><strong>Dated developments in this window</strong> '+related.map(e=>`<a href="${E(link(e.url))}">${E(e.date)} · ${E(e.label)} ↗</a>`).join(' · ')+'</p>'
      : '';
    target.innerHTML=chosen.length?chosen.map((series,i)=>{
      const interval=B.marketWindow(series,event.period,state.window,state.index.snapshot);
      const change=Number.isFinite(interval.change)?signed(interval.change)+marketUnit(series):'Change unavailable';
      if(Number.isFinite(interval.change))printed.push(series.name+' '+change+' ('+interval.before[0]+' → '+interval.after[0]+')');
      const endpoints=[interval.before,interval.after].filter(Boolean);
      return `<article class="market-card"><h4>${E(series.name)}</h4><strong>${E(change)}</strong><p>${E(series.basis)} · ${E(series.unit)}</p>
        <p>${E(interval.start)} → ${E(interval.end)}${interval.truncated?' · archive cutoff':''}</p>
        ${endpoints.length?`<p class="price-dates">${endpoints.map(([d,v])=>E(d)+' · '+number(v)+' '+E(series.unit)).join(' → ')}</p>`:''}
        ${chart(interval.eligible.map(([date,value])=>({date,value})),{id:'market-'+i,title:series.name,unit:series.unit,anchor:event.period.end})}
        ${link(series.source)?`<a class="market-source" href="${E(link(series.source))}">Source ↗</a>`:''}</article>`;
    }).join(''):'<p class="empty">Choose market series or select a saved security.</p>';
    get('market-context').innerHTML=(printed.length?'<p><strong>Recorded market moves</strong> '+E(printed.join(' · '))+'.</p>':'<p>Comparable endpoint changes are unavailable for this selection. Dated quotes appear where coverage permits.</p>')+(notes.length?'<p>'+E(notes.join(' '))+'</p>':'');
  }
  function selectByKey(key) {
    const event=state.active.find(e=>e.key===key)||state.events.find(e=>e.key===key);
    if(!event)return;
    setEvent(event);renderTimeline();renderSelection();
    const h=get('event-title');h?.focus({preventScroll:true});h?.scrollIntoView({block:'start'});
  }
  host.addEventListener('click', e=>{
    const event=e.target.closest('[data-event]'),page=e.target.closest('[data-page]');
    if(event)selectByKey(event.dataset.event);
    if(page){state.page+=Number(page.dataset.page);renderTimeline();get('breach-events').querySelector('button')?.focus();}
  });
  host.addEventListener('change',e=>{
    const el=e.target;
    if(el.id==='breach-years'){state.years=Number(el.value);state.page=0;recalculate();renderShell();get('breach-years').focus();}
    if(el.id==='breach-scope'||el.id==='breach-level'||el.id==='breach-group'){
      const key=el.id.slice(7);state[key]=el.value;state.page=0;renderTimeline();if(key==='group')renderGroups();
    }
    if(el.id==='market-window'){state.window=el.value;renderMarkets();}
    if(el.id==='market-share'){state.share=el.value;renderMarkets();}
    if(el.id==='market-bond'){state.bond=el.value;renderMarkets();}
    if(el.matches('[data-market]')){
      state.marketIds=[...host.querySelectorAll('[data-market]:checked')].map(input=>input.value);renderMarkets();
    }
  });
  host.addEventListener('input',e=>{
    const id=e.target.dataset.chart, chart=state.charts.get(id);
    if(!chart)return;
    const point=chart.drawable[Number(e.target.value)],dot=get('dot-'+id);
    dot?.setAttribute('cx',chart.x(point.date));dot?.setAttribute('cy',chart.y(point.value));
    get('read-'+id).innerHTML=chartRead(point,chart.unit,chart.sd);
    e.target.setAttribute('aria-valuetext',point.date+' '+number(point.value)+' '+chart.unit);
  });
  async function init() {
    const catalog=await archive.catalog();
    state.index=await json(archive.resolve(catalog.analytics_url));
    if(state.index.archive_version!==catalog.archive_version)throw Error('Archive version mismatch');
    state.markets=state.index.datasets.filter(e=>Object.hasOwn(marketNames,e.id)).map(market);
    const [spx,chronology,sgs]=await Promise.all(['spx/history.json','historical-fred-events.json','sgs-daily-snapshot.json'].map(file=>local(file).catch(()=>null)));
    state.historicalEvents=Array.isArray(chronology?.events)?chronology.events:[];
    if(spx?.id==='SPX'&&spx.symbol==='^GSPC')state.markets.push({id:'SPX',name:'S&P 500',unit:'index points',kind:'price',source:spx.source_url,basis:'Saved S&P 500 price-index close',points:B.points(spx.points)});
    const sgsTenor=sgs?.tenors?.findIndex(t=>t.label==='10Y') ?? -1;
    if(sgsTenor>=0&&Array.isArray(sgs.observations))state.markets.push({id:'SGS10',name:'Singapore SGS 10Y',unit:'%',kind:'yield',source:sgs.source_url,basis:'MAS benchmark closing bid yield',points:B.points(sgs.observations.map(p=>[p.date,p.values[sgsTenor]]))});
    state.markets.sort((a,b)=>a.name.localeCompare(b.name));
    recalculate();renderShell();
    if(location.hash==='#event-replay')requestAnimationFrame(()=>get('event-replay').scrollIntoView());
    const [shares,bonds]=await Promise.allSettled([ShareLabData.load(),local('Bond Prices - Type JSON - 16-Nov-03.10.json')]);
    const available=shares.status==='fulfilled'&&shares.value?await ShareLabData.metricFor('globalPrice'):new Map();
    state.shares=ShareLabData.records().filter(r=>r.compareEligible&&r.currency&&['exact_ticker_currency','exact_provider_ticker_currency'].includes(r.identityStatus)&&
      available.get(r.id)?.some(p=>p.currency===r.currency&&p.sourceId==='global-top100-close-2026-11-05')).sort((a,b)=>a.name.localeCompare(b.name));
    state.bonds=bonds.status==='fulfilled'&&bonds.value.schema_version===1?bonds.value:{instruments:[],history:{}};
    const stock=get('market-share'),bond=get('market-bond');
    if(stock){stock.innerHTML=options([['',state.shares.length?'Choose a saved listing':'Saved stock history unavailable'],...state.shares.map(s=>[s.id,s.name+' · '+s.id+' · '+s.currency])],state.share);stock.disabled=!state.shares.length;}
    if(bond){bond.innerHTML=options([['',state.bonds.instruments.length?'Choose a saved bond':'Saved bond history unavailable'],...state.bonds.instruments.map(b=>[b.id,b.name+' · '+b.currency])],state.bond);bond.disabled=!state.bonds.instruments.length;}
  }
  const requestedYears=Number(new URLSearchParams(location.search).get('years'));
  if([5,10,15,20].includes(requestedYears))state.years=requestedYears;
  init().catch(error=>{host.innerHTML='<p class="panel empty" role="alert">The saved archive could not load ('+E(error.message)+'). <a href="data.html">Open the dataset directory</a>.</p>';});
})();
