'use strict';
(() => {
  const el = id => document.getElementById(id);
  const model = XauHistory;
  const fmt = new Intl.NumberFormat('en-US', {maximumFractionDigits: 2});
  const whole = new Intl.NumberFormat('en-US', {maximumFractionDigits: 0});
  const monthFormat = new Intl.DateTimeFormat('en-GB', {month:'short',year:'numeric',timeZone:'UTC'});
  const dayFormat = new Intl.DateTimeFormat('en-GB', {day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
  const date = d => dayFormat.format(new Date(d + 'T00:00:00Z'));
  const month = d => monthFormat.format(new Date(d + 'T00:00:00Z'));
  const signed = value => Number.isFinite(value) ? (value > 0 ? '+' : '') + fmt.format(value) : '—';
  const movement = (value, kind) => Number.isFinite(value) ? signed(value) + (kind === 'rate' ? ' pp' : '%') : '—';
  const make = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text != null) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  const svg = (tag, attrs, text) => {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key,val] of Object.entries(attrs)) n.setAttribute(key, val);
    if (text != null) n.textContent = text;
    return n;
  };
  const text = (id, value) => {el(id).textContent = value;};
  const option = (id, label) => new Option(label, id);
  const describe = (label, points, unit, {kind = 'level', annual = false, source, precision} = {}) => ({label, points, unit, kind, annual, source, precision});
  const fixed = (v, series) => {
    if (!Number.isFinite(v)) return '—';
    const value = series.precision ? v.toFixed(series.precision) : fmt.format(v);
    return series.unit === '%' ? value + '%' : value + ' ' + series.unit;
  };
  let dataset, gold, drivers, selected, chartMarker, chartPosition, dataMissing = [];

  async function json(url) {
    const response = await fetch(url);
    if (!response.ok) throw Error(url + ' returned ' + response.status);
    return response.json();
  }
  async function csv(url, name) {
    const response = await fetch(url);
    if (!response.ok) throw Error(url + ' returned ' + response.status);
    const [header, ...lines] = (await response.text()).trim().split(/\r?\n/);
    const index = header.split(',').indexOf(name);
    if (index < 0) throw Error('Missing ' + name);
    return lines.map(line => line.split(',')).filter(row => row[index] && Number.isFinite(Number(row[index])))
      .map(row => [row[0], Number(row[index])]);
  }
  const byId = (file, id) => file?.series.find(s => s.id === id)?.points ?? [];
  const fredLink = id => ['FRED • ' + id, 'https://fred.stlouisfed.org/series/' + id];

  function metric(label, value, context) {
    const box = make('div');
    box.append(make('dt', label), make('dd', value), make('small', context));
    return box;
  }
  function table(container, headers) {
    const t = make('table'), row = t.createTHead().insertRow();
    for (const h of headers) {
      const th = make('th', h); th.scope = 'col'; row.append(th);
    }
    container.replaceChildren(t);
    return t.createTBody();
  }
  function dateTableRow(body, values, heading) {
    const tr = body.insertRow();
    if (heading != null) {const th=make('th',heading);th.scope='row';tr.append(th);}
    for (const value of values) {
      const cell = tr.insertCell();
      if (value instanceof Node) cell.append(value); else cell.textContent = value;
    }
    return tr;
  }
  function fillSelect(select, entries, defaultId) {
    select.replaceChildren(...entries.map(([id, label]) => option(id,label)));
    if (defaultId) select.value = defaultId;
  }

  function plot(container, label, lanes, time, dateLabel) {
    const width = 900, left = 84, right = 879, laneHeight = lanes.length === 1 ? 220 : 145, top = 16;
    const height = top + lanes.length * laneHeight + 33;
    const x = d => left + (right-left) * (Date.parse(d)-Date.parse(time[0])) / (Date.parse(time.at(-1))-Date.parse(time[0]) || 1);
    const figure = svg('svg', {viewBox:'0 0 '+width+' '+height, role:'img','aria-label':label});
    lanes.forEach((lane,index) => {
      const all = lane.lines.flatMap(line => line.points.map(p=>p[1]).filter(Number.isFinite));
      const minimum = Math.min(...all), maximum = Math.max(...all);
      const padding = (maximum-minimum || Math.abs(maximum) || 1) * .08;
      const min = minimum-padding, max=maximum+padding;
      const t = top + index*laneHeight + 20, b = top + (index+1)*laneHeight - 7;
      const y = value => b - (b-t)*(value-min)/(max-min);
      figure.append(svg('text',{x:left,y:t-9,class:'series-label'},lane.label));
      for(let i=0;i<3;i++){
        const value = min+(max-min)*i/2, row=y(value);
        figure.append(svg('path',{class:'grid',d:'M'+left+' '+row+'H'+right}),
          svg('text',{x:left-8,y:row+4,'text-anchor':'end'},Math.abs(value)>1000?whole.format(value):fmt.format(value)));
      }
      for(const line of lane.lines){
        let path='', previous='';
        for(const [date,value] of line.points){
          if (!Number.isFinite(value)) {previous='';continue;}
          const discontinuity = previous && Date.parse(date)-Date.parse(previous)>line.maxGap;
          path += (previous && !discontinuity ? 'L':'M')+x(date).toFixed(2)+' '+y(value).toFixed(2);
          previous=date;
        }
        figure.append(svg('path',{class:line.className,d:path}));
        if(line.points.filter(p=>Number.isFinite(p[1])).length === 1){
          const p=line.points.find(p=>Number.isFinite(p[1]));
          figure.append(svg('circle',{cx:x(p[0]),cy:y(p[1]),r:3,fill:'#9b6929'}));
        }
      }
    });
    const indexes = [...new Set([0,Math.floor((time.length-1)/2),time.length-1])];
    for (const i of indexes) figure.append(svg('text',{x:x(time[i]),y:height-7,'text-anchor':i===0?'start':i===time.length-1?'end':'middle'},dateLabel(time[i])));
    const marker = svg('line',{class:'marker',y1:top+18,y2:height-29,visibility:'hidden'});
    figure.append(marker);
    container.replaceChildren(figure);
    return {figure, marker, x};
  }
  function optionsDisabled() {
    for(const opt of el('gold-series').options) opt.disabled = !gold[opt.value]?.points.length;
    if (el('gold-series').selectedOptions[0]?.disabled) el('gold-series').value = 'pink';
  }
  function renderComparison() {
    const goldSeries = gold[el('gold-series').value], driver = drivers[el('driver').value];
    if (!goldSeries || !driver) return;
    const start = el('from').value + '-01-01', end = el('to').value + '-12-31';
    const annual = driver.annual, labels = annual ? d => d.slice(0,4) : month;
    document.querySelectorAll('#presets button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.series===el('driver').value)));
    el('observations').replaceChildren(); el('window-kpis').replaceChildren();
    selected = {goldSeries,driver,rows:model.pairs(goldSeries.points, driver.points, start, end, annual), annual, labels};
    const {rows} = selected;
    el('download').disabled = el('inspect-month').disabled = rows.length === 0;
    if (!rows.length) {
      el('comparison-chart').replaceChildren(make('p','There are no matched observations in this window. Try a wider date range or another driver.'));
      text('chart-note','');text('inspect-value','');
      renderMatrix(goldSeries,start,end);
      return;
    }
    const first=rows[0], last=rows.at(-1), byChange=el('view').value==='change', time=rows.map(p=>p[0]);
    const gap=(annual ? 370 : 35)*86400000;
    const lines=[{series:goldSeries,column:1,className:'plot-main'},{series:driver,column:2,className:'plot-driver'}].map(l=>({
      label:l.series.label+' · '+(byChange ? (l.series.kind==='rate'?'percentage points':'% change') : l.series.unit),
      lines:[{points:rows.map(row=>[row[0],byChange ? model.change(first[l.column],row[l.column],l.series.kind) : row[l.column]]),
        className:l.className,maxGap:gap}]
    }));
    const chart = plot(el('comparison-chart'),goldSeries.label+' and '+driver.label,lines,time,labels);
    chartMarker=chart.marker;chartPosition=chart.x;
    const slider=el('inspect-month');
    slider.max=rows.length-1;slider.value=slider.max;
    slider.previousElementSibling.textContent=annual?'Inspect year':'Inspect month';
    chart.figure.addEventListener('click', e=>{
      const p=chart.figure.createSVGPoint();p.x=e.clientX;p.y=e.clientY;
      const x=p.matrixTransform(chart.figure.getScreenCTM().inverse()).x;
      let closest=0;
      rows.forEach((r,i)=>{if(Math.abs(chart.x(r[0])-x)<Math.abs(chart.x(rows[closest][0])-x))closest=i;});
      slider.value=closest;inspect();
    });
    const drawdown=model.drawdown(rows.map(r=>r.slice(0,2)));
    const stats=model.correlation(rows,driver.kind);
    el('window-kpis').replaceChildren(
      metric(goldSeries.label+' move',movement(model.change(first[1],last[1],'level'),'level'),labels(first[0])+' to '+labels(last[0])),
      metric(driver.label+' move',movement(model.change(first[2],last[2],driver.kind),driver.kind),labels(first[0])+' to '+labels(last[0])),
      metric('Gold peak-to-trough',drawdown?movement(drawdown.value,'level'):'—',drawdown?.value<0?labels(drawdown.peak[0])+' to '+labels(drawdown.trough[0]):'Within matched periods'),
      metric(annual?'Matched annual periods':'Monthly correlation',annual?String(rows.length):stats.value==null?'—':fmt.format(stats.value),annual?'Calendar years with both observations':stats.count+' monthly change pairs'));
    text('chart-note',annual?'Each year pairs the annual observation with December gold. The table retains each underlying observation date.':
      'Both charts share the same months. Market series use the last available observation in each series. The selected values and their dates are listed below.');
    if(el('obs-details').open) renderObservations();
    renderMatrix(goldSeries,start,end);inspect();
  }
  function inspect() {
    const row=selected?.rows[Number(el('inspect-month').value)];
    if(!row || !chartMarker) return;
    text('inspect-value',selected.labels(row[0])+' · '+fixed(row[1],selected.goldSeries)+' · '+fixed(row[2],selected.driver)+' '+selected.driver.label);
    chartMarker.setAttribute('x1',chartPosition(row[0]));chartMarker.setAttribute('x2',chartPosition(row[0]));chartMarker.setAttribute('visibility','visible');
  }
  function renderObservations() {
    if(!selected?.rows.length) return;
    const {goldSeries,driver,labels,rows}=selected;
    el('observations').classList.add('obs-table');
    const body=table(el('observations'),['Period',goldSeries.label,'Gold observation',driver.label,'Driver observation']);
    for(const r of [...rows].reverse()) dateTableRow(body,[fixed(r[1],goldSeries),date(r[3]),fixed(r[2],driver),date(r[4])],labels(r[0]));
  }
  function renderMatrix(base,start,end) {
    text('matrix-window',base.label+' · '+start.slice(0,4)+'–'+end.slice(0,4)+' · paired monthly changes');
    const body=table(el('matrix'),['Driver','First shared month','Last shared month','Change pairs','Correlation','Driver change']);
    for(const series of Object.values(drivers).filter(s=>!s.annual)){
      const rows = model.pairs(base.points,series.points,start,end,false);
      const {value,count}=model.correlation(rows,series.kind);
      const band=make('span',value==null?'—':value.toFixed(2),value==null?'':('band '+(value>=0?'band-positive':'band-negative')));
      const last=rows.at(-1);
      dateTableRow(body,[rows.length?month(rows[0][0]):'—',last?month(last[0]):'—',count,band,
        rows.length>=2?movement(model.change(rows[0][2],last[2],series.kind),series.kind):'—'],series.label);
    }
  }
  function download() {
    const {goldSeries,driver,rows}=selected;
    const content=[['Period',goldSeries.label+' ('+goldSeries.unit+')',driver.label+' ('+driver.unit+')','Gold observation','Driver observation'],...rows]
      .map(row=>row.map(value=>'"'+String(value).replaceAll('"','""')+'"').join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob(['\ufeff',content],{type:'text/csv;charset=utf-8'}));
    const a=make('a');a.href=url;a.download='gold-macro-comparison.csv';document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  let regimeContext={};
  const purchaseReferences={
    '2001-2011':[['2008',-235],['2011',457]],
    '2011-2020':[['2020',272.9]],
    '2020-2022':[['2020',272.9],['2022',1136]],
    '2022-2026':[['2022',1136],['2025',863],['Jan–Sep 2026',675]]
  };
  const replayHref=(id,phase)=>'tools/gld-strategy.html?mode=historical&regime='+id+'&phase='+phase+'#path-history-replay';

  function measure(base, window, candidates, kind) {
    const ranked=candidates.filter(Boolean).map(series=>({series,rows:model.pairs(base,series.points,window.start,window.end,false)}));
    const complete=ranked.find(({rows})=>rows.length>=2&&rows[0][0]===window.start&&rows.at(-1)[0]===window.end);
    const observed=complete??ranked.sort((a,b)=>b.rows.length-a.rows.length)[0];
    const box=make('div',null,'regime-movement');
    if(!observed||observed.rows.length<2){
      box.append(make('strong','—'),make('small','No comparable endpoints'));
      return box;
    }
    const {series,rows}=observed,first=rows[0],last=rows.at(-1);
    const value=kind==='tonnes'?signed(last[2]-first[2])+' t':movement(model.change(first[2],last[2],kind),kind);
    const periods=month(first[0])+' – '+month(last[0]);
    const unit=kind==='tonnes'?' t':kind==='rate'?'%':'';
    box.append(make('strong',value),make('small',fmt.format(first[2])+unit+' to '+fmt.format(last[2])+unit),
      make('small',periods+(complete?'':' · partial')));
    if(series.hint)box.append(make('small',series.hint));
    return box;
  }

  function showRegimeMatrix(phase) {
    document.querySelectorAll('#regime-phases button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.phase===phase)));
    const base=gold.pink.points;
    const olderDollar={points:regimeContext.legacyDollar??[],hint:'Fed legacy major-currency index'};
    const olderSpx={points:regimeContext.legacySpx??[],hint:'Shiller monthly averages'};
    const broad=drivers.dollar?{...drivers.dollar,hint:'Fed broad dollar index'}:null;
    const body=table(el('regime-matrix'),['Regime and replay','Gold · USD/oz','U.S. dollar','U.S. 10Y real yield','U.S. CPI inflation · YoY','S&P 500 · price','Central banks · tonnes']);
    for(const p of XauRegimes.periods){
      const summary=XauRegimes.summarize(base,p.id),window=summary?.windows[phase];
      const first=make('div',null,'regime-row-title');
      first.append(make('strong',p.name));
      if(!window){
        first.append(make('small','This phase falls outside the period.'));
        dateTableRow(body,[first,'—','—','—','—','—','—']);
        continue;
      }
      first.append(make('small',window.label+' · '+month(window.start)+' – '+month(window.end)));
      const link=make('a','Replay in GLD');link.href=replayHref(p.id,phase);first.append(link);
      const banks=measure(base,window,[drivers.official],'tonnes');
      banks.prepend(make('small','IMF official holdings change'));
      if(phase==='cycle'&&purchaseReferences[p.id]){
        const reference=purchaseReferences[p.id].map(([when,amount])=>when+' '+signed(amount)+' t').join(' · ');
        banks.append(make('small','WGC net purchases by reporting period'),make('small',reference,'bank-reference'));
      }
      const goldMove=measure(base,window,[{points:base}],'level');
      dateTableRow(body,[first,goldMove,measure(base,window,[broad,olderDollar],'level'),
        measure(base,window,[drivers.real10],'rate'),measure(base,window,[drivers.cpi],'rate'),
        measure(base,window,[drivers.spx,olderSpx],'level'),banks]);
    }
  }

  function showRegimes() {
    const list=el('regime-list');
    list.replaceChildren(...XauRegimes.periods.map(p=>{
      const card=make('article',null,'regime-card'), icon=make('span',p.icon,'section-icon');
      icon.setAttribute('aria-hidden','true');
      const series=model.within(gold.pink.points,p.from+'-01-01',p.to+'-12-31');
      const start=series[0],end=series.at(-1),dd=model.drawdown(series);
      const b=make('button','Open in comparison','secondary');b.type='button';
      b.addEventListener('click',()=>{
        el('from').value=p.from;el('to').value=p.to;el('gold-series').value='pink';
        el('driver').value=p.from<2000?'cpi':'real10';
        if(!drivers[el('driver').value]) el('driver').selectedIndex=0;
        renderComparison();
        el('compare').scrollIntoView({block:'start'});
        el('gold-series').focus({preventScroll:true});
      });
      card.append(icon,make('p',p.from+'–'+p.to,'chapter'),make('h3',p.name),make('p',p.note));
      if(start&&end){
        plot(makeChartContainer(card),p.name,[{label:'Gold · USD/oz',lines:[{points:series,className:'plot-main',maxGap:35*86400000}]}],
          series.map(x=>x[0]),d=>d.slice(0,4));
        card.append(make('p',movement(model.change(start[1],end[1],'level'),'level')+' over '+month(start[0])+'–'+month(end[0])+'.'));
      }
      if(dd?.value<0){
        const p=make('p');
        p.append(make('strong',movement(dd.value,'level')+' maximum drawdown'),document.createTextNode(' · '+month(dd.peak[0])+' to '+month(dd.trough[0])+'. '+
          (dd.recovered?'Earlier high regained '+month(dd.recovered[0])+'.':'Earlier high remained unrecovered by period end.')));
        card.append(p);
      }
      card.append(b);
      const replay=make('a','Replay this period','action secondary');replay.href=replayHref(p.id,'cycle');card.append(replay);
      return card;
    }));
  }
  function makeChartContainer(parent) {
    const plotContainer=make('div',null,'chart-frame');
    parent.append(plotContainer);
    return plotContainer;
  }
  function showChina() {
    const {series,chinaLatest}=dataset;
    const from=series.safeGold[0],goldEnd=series.safeGold.at(-1),fx=series.safeFx.at(-1);
    const entries=[
      ['Consumer prices',chinaLatest.cpi.value+'% YoY','China NBS · October 2026. The comparison history uses World Bank annual CPI inflation.','cpicn','nbsCpi'],
      ['Real GDP growth',chinaLatest.gdp.value+'% YoY','China NBS · Q3 2026 preliminary. The comparison history uses World Bank annual real GDP growth.','gdpcn','nbsGdp'],
      ['Official gold volume',fmt.format(goldEnd[1])+' t',month(goldEnd[0])+' · '+signed(goldEnd[1]-from[1])+' t since '+month(from[0])+'. The graph uses China SAFE’s monthly volume.','safeGold','safe'],
      ['Foreign currency reserves',fmt.format(fx[1])+' USD bn','China SAFE · '+month(fx[0])+'. Foreign currency reserves exclude monetary gold.','safeFx','safe']
    ];
    el('china-cards').replaceChildren(...entries.map(([label,value,note,key,id])=>{
      const card=make('article',null,'china-card');
      const h=make('h3',label), strong=make('strong',value);
      card.append(h,strong,make('p',note));
      if(['safeGold','safeFx'].includes(key)) {
        const c=makeChartContainer(card),ps=series[key];
        plot(c,label,[{label:key==='safeGold'?'Tonnes':'USD billions',lines:[{points:ps,className:'plot-main',maxGap:35*86400000}]}],ps.map(p=>p[0]),month);
      }
      const a=make('a',dataset.sources[id][0]);a.href=dataset.sources[id][1]; card.append(a);
      if(drivers[key]){
        const btn=make('button','Compare with gold','secondary');btn.type='button';
        btn.addEventListener('click',()=>{
          el('gold-series').value='pink';el('driver').value=key;renderComparison();el('compare').scrollIntoView();el('driver').focus({preventScroll:true});
        });card.append(btn);
      }
      return card;
    }));
  }

  function selectionTable(container, rows, selectedName, headings, apply) {
    const body=table(container,headings), maximum=rows[0]?.value || 1;
    for(const [i,r] of rows.entries()){
      const select=make('button',r.name,'pick-country');select.type='button';select.setAttribute('aria-pressed',String(r.name===selectedName));
      select.addEventListener('click',()=>apply(r.name));
      const amount=make('div',fmt.format(r.value)),bar=make('span',null,'rank-bar'),inner=make('i');
      bar.setAttribute('aria-hidden','true');inner.style.width=(100*r.value/maximum)+'%';bar.append(inner);amount.append(bar);
      const row=dateTableRow(body,[select,amount,...r.extras],String(i+1));row.classList.toggle('picked',r.name===selectedName);
    }
  }
  function showReserves() {
    const {aggregates,countries}=dataset.reserves,end=el('reserve-period').value;
    const fallback = new Date(end+'T00:00:00Z'); fallback.setUTCFullYear(fallback.getUTCFullYear()-1);
    const rank=model.ranked(countries,end,fallback.toISOString().slice(0,10));
    const selectedName=el('reserve-trend').value, series=aggregates[selectedName]??countries[selectedName];
    const rows=rank.map(r=>({name:r.name,value:r.last[1],extras:[month(r.last[0])]}));
    selectionTable(el('reserve-table'),rows,selectedName,['Rank','Country','Gold tonnes','Reported period'],name=>{
      el('reserve-trend').value=name;showReserves();el('reserve-trend').focus({preventScroll:true});
    });
    const points=series.filter(p=>p[0]<=end), last=points.at(-1);
    text('reserve-title',selectedName+' official gold');
    if(last){
      const chart=plot(el('reserve-chart'),selectedName+' official gold in tonnes',
        [{label:'Official holdings · tonnes',lines:[{points,className:'plot-main',maxGap:35*86400000}]}],points.map(p=>p[0]),d=>d.slice(0,4));
      chart.figure.append(svg('title',{},'Last reported '+fmt.format(last[1])+' tonnes in '+month(last[0])));
      text('reserve-note',fmt.format(last[1])+' tonnes in '+month(last[0])+'. History begins '+month(points[0][0])+'. Gaps follow the source.');
    }else{
      el('reserve-chart').replaceChildren(make('p','No observations before this snapshot.'));
      text('reserve-note','');
    }
    text('reserve-foot','The historical ranking uses the same 30 currently selected country reporters. It omits values more than 12 months old at the selected cutoff. Individual reporting dates and reserve definitions vary. IMF gold volume converted from fine troy ounces. ');
    const a=make('a','IMF International Liquidity');a.href=dataset.sources.reserves[1];el('reserve-foot').append(a);
  }
  function showMines() {
    const {countries,world,years}=dataset.mining, year=Number(el('mine-year').value), idx=years.indexOf(year), selectedName=el('mine-trend').value;
    const status={r:'Reported',e:'Estimated',p:'Provisional'};
    const rows=Object.entries(countries).filter(([,r])=>r.values[idx]>0).map(([name,r])=>({
      name,value:r.values[idx],extras:[fmt.format(r.values[idx]/world[idx]*100)+'%',status[r.status]??'—']
    })).sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name)).slice(0,30);
    selectionTable(el('mine-table'),rows,selectedName,['Rank','Country','Gold tonnes','World share','Source flag'],name=>{
      el('mine-trend').value=name;showMines();el('mine-trend').focus({preventScroll:true});
    });
    const data=selectedName==='World'?world:countries[selectedName].values;
    text('mine-title',selectedName+' mine production');
    const points=years.map((y,i)=>[y+'-12-31',data[i]]);
    if(points.some(p=>Number.isFinite(p[1]))){
      plot(el('mine-chart'),selectedName+' mine production',
        [{label:'Mine output · tonnes',lines:[{points,className:'plot-main',maxGap:370*86400000}]}],points.map(p=>p[0]),d=>d.slice(0,4));
    }else el('mine-chart').replaceChildren(make('p','No production observations in this edition.'));
    text('mine-note',year+' · '+(Number.isFinite(data[idx])?fmt.format(data[idx])+' tonnes':'No reported value')+
      (selectedName==='World'?' globally.':' · '+(Number.isFinite(data[idx])?fmt.format(data[idx]/world[idx]*100)+'% of world production.':'Coverage varies by year.')));
    text('mine-foot','World total uses the source aggregate, including countries outside the top 30. Country flags follow the workbook. ');
    const a=make('a','World Mining Data 2026');a.href=dataset.sources.mining[1];el('mine-foot').append(a);
  }
  function setupRanks() {
    const periods=[...new Set(dataset.reserves.aggregates.World.filter(([d])=>d.slice(5,7)==='12'&&Number(d.slice(0,4))>=1995).map(([d])=>d))].reverse();
    fillSelect(el('reserve-period'),[[dataset.asOf,'Latest eligible reports'],...periods.map(d=>[d,d.slice(0,4)+' year end'])],dataset.asOf);
    const ordered=Object.keys(dataset.reserves.countries).sort();
    fillSelect(el('reserve-trend'),[...Object.keys(dataset.reserves.aggregates),...ordered].map(s=>[s,s]),'World');
    fillSelect(el('mine-year'),dataset.mining.years.slice().reverse().map(y=>[y,y]),String(dataset.mining.years.at(-1)));
    fillSelect(el('mine-trend'),['World',...Object.keys(dataset.mining.countries).sort()].map(s=>[s,s]),'World');
    ['reserve-period','reserve-trend'].forEach(id=>el(id).addEventListener('change',showReserves));
    ['mine-year','mine-trend'].forEach(id=>el(id).addEventListener('change',showMines));
    showReserves();showMines();
  }

  async function init() {
    const sources = [
      ['research dataset',json('data/metals/xau-research.json')],
      ['spot gold',csv('data/metals/xau-spot.csv','usd_per_oz')],
      ['GLD',csv('data/metals/gld.csv','close')],
      ['gold and silver mining equities',csv('data/metals/xau-index.csv','close')],
      ['S&P 500',json('data/spx/history.json')],
      ['FRED daily FX and yields',json('data/fred-daily.json')],
      ['historical dollar and equity benchmarks',json('data/metals/xau-regime-context.json')],
    ];
    const loaded=await Promise.allSettled(sources.map(pair=>pair[1]));
    const [snapshot,spot=[],gld=[],miningEquities=[],spx,daily,older={} ]=loaded.map((r,i)=>{
      if(r.status==='fulfilled')return r.value;
      dataMissing.push(sources[i][0]);return undefined;
    });
    if(!snapshot)throw Error('The gold research dataset could not load. Reload to try again.');
    dataset=snapshot;
    regimeContext=older;
    const fred = dataset.fred;
    const source=dataset.sources,s=dataset.series;
    const fed=(id)=>byId(daily,id);
    const m = model.monthly, prices=spot.filter(([d])=>{
      const dow=new Date(d+'T00:00:00Z').getUTCDay();
      return dow>0&&dow<6;
    });
    const local=(id,inverse)=>m(model.multiply(prices,fed(id),inverse));
    const spxSource=['Hub S&P 500 close history','data/spx/history.json'];
    gold={
      pink:describe('World Bank monthly gold',m(s.pink),'USD/oz',{source:source.gold}),
      spot:describe('Spot gold',m(prices),'USD/oz',{source:['Hub XAU/USD close history','data/metals/xau-spot.csv']}),
      gld:describe('SPDR Gold Shares',m(gld),'USD/share',{source:['Hub GLD close history','data/metals/gld.csv']}),
      sgdgold:describe('Gold in SGD',local('USD/SGD'),'SGD/oz',{source:fredLink('DEXSIUS')}),
      cnygold:describe('Gold in CNY',local('USD/CNY'),'CNY/oz',{source:fredLink('DEXCHUS')}),
      eurgold:describe('Gold in EUR',local('EUR/USD',true),'EUR/oz',{source:fredLink('DEXUSEU')}),
      realgold:describe('Real gold price',m(model.realGold(s.pink,fred.CPIAUCSL??[])),'USD/oz',{source:fredLink('CPIAUCSL')})
    };
    const dailyDriver=(name,id,unit,kind='level')=>describe(name,m(fed(id)),unit,{kind,source:fredLink(daily?.series.find(s=>s.id===id)?.provider_series??id),precision:kind==='rate'?2:4});
    const rate=(name,id)=>describe(name,m(fred[id]??[]),'%',{kind:'rate',source:fredLink(id),precision:2});
    const inflation=(name,id)=>describe(name,m(model.yearOnYear(fred[id]??[])),'%',{kind:'rate',source:fredLink(id),precision:2});
    const annual=(name,key,unit,kind='rate')=>describe(name,s[key],unit,{annual:true,kind,source:source[key]});
    drivers={
      dollar:describe('Broad U.S. dollar',m(fred.DTWEXBGS??[]),'index',{source:fredLink('DTWEXBGS')}),
      real10:rate('U.S. 10Y real yield','DFII10'),
      spx:describe('S&P 500',m(spx?.points??[]),'index points',{source:spxSource}),
      usdsgd:dailyDriver('USD/SGD','USD/SGD','SGD per USD'),
      usdcny:dailyDriver('USD/CNY','USD/CNY','CNY per USD'),
      usdjpy:dailyDriver('USD/JPY','USD/JPY','JPY per USD'),
      eurusd:dailyDriver('EUR/USD','EUR/USD','USD per EUR'),
      usdchf:dailyDriver('USD/CHF','USD/CHF','CHF per USD'),
      us10:dailyDriver('U.S. 10Y nominal yield','UST 10Y','%','rate'),
      us10long:rate('U.S. 10Y yield · monthly average','GS10'),
      us2:dailyDriver('U.S. 2Y nominal yield','UST 2Y','%','rate'),
      effr:rate('Effective fed funds rate','EFFR'),
      bei:rate('U.S. 10Y breakeven inflation','T10YIE'),
      cpi:inflation('U.S. CPI YoY','CPIAUCSL'),
      core:inflation('U.S. core CPI YoY','CPILFESL'),
      pce:inflation('U.S. PCE inflation YoY','PCEPI'),
      miners:describe('Nasdaq gold and silver equity index',m(miningEquities),'index points',{source:['Nasdaq PHLX Gold/Silver Sector','https://indexes.nasdaqomx.com/Index/Overview/XAU']}),
      gdpcn:annual('China real GDP growth','gdpcn','%'),
      cpicn:annual('China CPI inflation','cpicn','%'),
      cpiworld:annual('World CPI inflation','cpiworld','%'),
      official:describe('World official gold holdings',m(snapshot.reserves.aggregates.World),'tonnes',{source:source.reserves}),
      safeGold:describe('China official gold · SAFE',m(s.safeGold),'tonnes',{source:source.safe}),
      safeFx:describe('China foreign currency reserves · SAFE',m(s.safeFx),'USD bn',{source:source.safe}),
      mine:describe('World mine production',snapshot.mining.years.map((y,i)=>[y+'-12-31',snapshot.mining.world[i]]),'tonnes',{annual:true,source:source.mining})
    };
    drivers=Object.fromEntries(Object.entries(drivers).filter(([,v])=>v.points.length));
    optionsDisabled();
    fillSelect(el('driver'),Object.entries(drivers).map(([id,v])=>[id,v.label]),drivers.dollar?'dollar':Object.keys(drivers)[0]);
    for(const [id,label] of [['dollar','Broad dollar'],['real10','Real yields'],['cpi','Inflation'],['spx','S&P 500'],['usdcny','China FX'],['official','Official holdings'],['mine','Mine supply']]){
      if(!drivers[id])continue;
      const b=make('button',label);b.type='button';b.dataset.series=id;
      b.addEventListener('click',()=>{el('driver').value=id;renderComparison();});el('presets').append(b);
    }
    const headline = [];
    if(prices.length){
      const actual=prices.at(-1), cutoff=actual[0].slice(0,4)-1+actual[0].slice(4);
      const peak=prices.filter(p=>p[0]>=cutoff).reduce((a,b)=>a[1]>=b[1]?a:b);
      headline.push(metric('Spot gold · USD/oz',fmt.format(actual[1]),date(actual[0])+' · '+movement(model.change(peak[1],actual[1],'level'),'level')+' from trailing one-year high'));
    }
    for(const key of ['real10','cpi','spx']){
      const d=drivers[key],last=d?.points.at(-1);if(!last)continue;
      headline.push(metric(d.label,key==='spx'?fmt.format(last[1]):fixed(last[1],d),(key==='cpi'?month:date)(last[2])+(key==='spx'?' · price index':'')));
    }
    const official=drivers.official.points.at(-1);
    headline.push(metric('World official gold',fmt.format(official[1])+' t',month(official[0])),
      metric('World mine output',fmt.format(snapshot.mining.world.at(-1))+' t',String(snapshot.mining.years.at(-1))));
    el('gold-kpis').replaceChildren(...headline);
    text('load-status',dataMissing.length?'Some feeds could not load. Available history is shown. Missing: '+dataMissing.join(', ')+'.':
      'Market feeds and dated research extracts · '+date(dataset.asOf));
    const linkPairs=[...Object.values(source),fredLink('SP500'),...Object.values(gold).map(x=>x.source),...Object.values(drivers).map(x=>x.source)];
    for(const [label,url] of new Map(linkPairs.map(([label,url])=>[url,[label,url]])).values()){
      const a=make('a',label);a.href=url;el('source-list').append(a);
    }
    el('filters').addEventListener('submit',e=>{
      e.preventDefault();const from=el('from'),to=el('to');
      if(Number(from.value)>Number(to.value)){to.setCustomValidity('Use a year on or after the start year.');to.reportValidity();return;}
      renderComparison();
    });
    ['from','to'].forEach(id=>el(id).addEventListener('input',()=>el('to').setCustomValidity('')));
    ['gold-series','driver','view'].forEach(id=>el(id).addEventListener('change',()=>{if(el('filters').checkValidity()&&Number(el('from').value)<=Number(el('to').value))renderComparison();}));
    el('inspect-month').addEventListener('input',inspect);
    el('obs-details').addEventListener('toggle',()=>{if(el('obs-details').open)renderObservations();});
    el('download').addEventListener('click',download);
    const phaseButtons=el('regime-phases');
    for(const [id,label] of [['cycle','Full periods'],['fall','Drawdowns'],['rebound','After the trough']]){
      const b=make('button',label);b.type='button';b.dataset.phase=id;
      b.addEventListener('click',()=>showRegimeMatrix(id));phaseButtons.append(b);
    }
    renderComparison();showRegimes();showRegimeMatrix('cycle');showChina();setupRanks();
  }
  init().catch(e=>text('load-status',e.message));
})();
