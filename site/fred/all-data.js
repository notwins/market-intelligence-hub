/* Single-page, read-only explorer. Analytics and native source rows load separately. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const E = value => String(value ?? '').replace(/[&<>"']/g,char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const number = value => finite(value) ? value.toLocaleString('en-US',{maximumFractionDigits:4}) : '—';
  const integer = value => Number(value || 0).toLocaleString('en-US');
  const signed = value => finite(value) ? `${value>0?'+':value<0?'−':''}${Math.abs(value).toFixed(2)}σ` : 'Unavailable';
  const safeSource = value => { try { const u=new URL(value);return /^https?:$/.test(u.protocol)?u.href:'';}catch{return '';} };
  const text = (id,value) => { $(id).textContent=value ?? ''; };
  const state = {entries:[],overview:[],sort:'group',direction:1,selected:null,groups:null,groupKey:null,records:[],recordPage:0,raw:null,nativePage:0,nativeCache:new Map(),nativeToken:0,selectionToken:0};
  const PAGE=50;
  const transformName = mode => ({level:'Native level',yoy:'Year-over-year change (%)',year_change:'Change from year ago (native units)'}[mode] || mode);
  const metricFor = (entry,field) => (entry.metrics || []).find(metric => metric.field===field) || {field:field || entry.default_field,label:entry.unit || 'Native value',unit:entry.unit || '',transform:'level'};
  const modeFor = metric => $('detail-transform').value==='recommended' ? metric.transform || 'level' : $('detail-transform').value;
  const unitFor = (metric,mode) => mode==='yoy'?'% year over year':metric.unit || '';
  async function loadJSON(path) {
    const response=await fetch(FredArchive.resolve(path),{cache:'no-store'});
    if(!response.ok) throw Error(`Archive HTTP ${response.status}`);
    const data=await response.json();
    if(Array.isArray(data.columns)&&Array.isArray(data.values)&&!Array.isArray(data.rows))data.rows=data.values.map(values=>Object.fromEntries(data.columns.map((name,i)=>[name,values[i]])));
    return data;
  }
  function badge(row) {
    const z=row?.z, band=FredSigma.band(z), direction=finite(z)?z>0?'positive':z<0?'negative':'':'';
    return `<span class="sigma-badge ${band} ${direction}" title="${E(row?.reason || `${row.n} prior native-frequency values; sample SD ${number(row.sd)}`)}">${signed(z)}</span>`;
  }
  function unavailableReason(source) {
    return source?.sigma_unavailable ? (typeof source.sigma_unavailable==='string'?source.sigma_unavailable:source.note || 'Source identity is ambiguous; sigma unavailable') : '';
  }
  function calculate(points,entry,metric,mode,years,group) {
    const reason=unavailableReason(group) || unavailableReason(entry);
    const result=FredSigma.analyze(points || [],{frequency:entry.frequency,transform:mode,years,excludeDates:entry.quality_dates || []});
    return reason ? result.map(row => ({...row,z:null,mean:null,sd:null,reason,band:'unavailable'})) : result;
  }
  function linePath(rows,x,y,getValue) {
    let pen=false,path='';
    rows.forEach((row,i) => { const v=getValue(row);if(!finite(v)){pen=false;return;} path+=`${pen?'L':'M'}${x(row,i).toFixed(2)},${y(v).toFixed(2)} `;pen=true; });
    return path;
  }
  function sample(rows,max=1000) {
    if(rows.length<=max) return rows;
    const result=[],step=Math.ceil(rows.length/max);
    for(let i=0;i<rows.length;i+=step) {
      const chunk=rows.slice(i,i+step),valid=chunk.filter(row=>finite(row.value));
      if(valid.length) {
        const low=valid.reduce((a,b)=>a.value<b.value?a:b),high=valid.reduce((a,b)=>a.value>b.value?a:b);
        const selected=[chunk[0],low,high,chunk[chunk.length-1]];
        if(chunk.some(row=>!finite(row.value))) selected.push(chunk.find(row=>!finite(row.value)));
        result.push(...[...new Set(selected)].sort((a,b)=>a.date.localeCompare(b.date)));
      } else result.push(chunk[0]);
    }
    return result;
  }
  function sparkline(rows) {
    const shown=rows.slice(-60),valid=shown.filter(row=>finite(row.value));
    if(valid.length<2)return '<p class="chart-limit">Not enough observations for a chart or SD guides.</p>';
    const guides=new Map(shown.map(row=>[row,FredOverview.guides(row)])),values=valid.map(row=>row.value);
    for(const guide of guides.values())if(guide)values.push(guide.lower2,guide.upper2);
    let lo=Math.min(...values),hi=Math.max(...values),span=hi-lo||Math.max(Math.abs(hi)*.1,1);lo-=span*.07;hi+=span*.07;
    const w=340,h=92,p={left:38,right:8,top:8,bottom:17},first=Date.parse(shown[0].date),duration=Date.parse(shown.at(-1).date)-first||1;
    const x=row=>p.left+(Date.parse(row.date)-first)/duration*(w-p.left-p.right),y=value=>h-p.bottom-(value-lo)/(hi-lo)*(h-p.top-p.bottom);
    const chunks=[];let chunk=[];
    for(const row of shown){if(guides.get(row))chunk.push(row);else if(chunk.length){chunks.push(chunk);chunk=[];}}if(chunk.length)chunks.push(chunk);
    const bands=chunks.map(part=>`<path class="sd-band" d="${part.map((row,i)=>`${i?'L':'M'}${x(row).toFixed(2)},${y(guides.get(row).upper1).toFixed(2)}`).join(' ')} ${part.slice().reverse().map(row=>`L${x(row).toFixed(2)},${y(guides.get(row).lower1).toFixed(2)}`).join(' ')} Z" fill="#edf1ed"/>`).join('');
    const path=(field,color,dash,sd)=>`<path ${sd?`data-sd="${sd}"`:''} d="${linePath(shown,x,y,row=>guides.get(row)?.[field])}" fill="none" stroke="${color}" stroke-width="1" vector-effect="non-scaling-stroke" stroke-dasharray="${dash}"/>`;
    let grid='';for(let i=0;i<3;i++){const value=lo+(hi-lo)*i/2,yy=y(value),label=value.toLocaleString('en-US',{notation:'compact',maximumFractionDigits:1});grid+=`<line x1="${p.left}" y1="${yy}" x2="${w-p.right}" y2="${yy}" stroke="#e3e9e2"/><text x="${p.left-5}" y="${yy+3}" text-anchor="end" fill="#6b7d75" font-size="7.8">${E(label)}</text>`;}
    const available=chunks.length>0;
    return `<svg class="sparkline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" data-sd-guides="${available?'available':'unavailable'}" aria-label="Last ${shown.length} native-frequency heat observations with rolling prior mean, plus and minus one and two sample standard deviations; prior ${$('overview-baseline').value} years. Missing observations and unavailable baselines leave gaps.">${grid}${bands}${path('lower2','#95a3b1','3 3',2)}${path('upper2','#95a3b1','3 3',2)}${path('lower1','#879a8b','2 2',1)}${path('upper1','#879a8b','2 2',1)}${path('mean','#9a8062','5 3',0)}<path class="metric-line" d="${linePath(shown,x,y,row=>row.value)}" fill="none" stroke="#3f6c64" stroke-width="1.7" vector-effect="non-scaling-stroke"/><text x="${p.left}" y="${h-2}" fill="#6b7d75" font-size="7.5">${E(shown[0].date)}</text><text x="${w-p.right}" y="${h-2}" text-anchor="end" fill="#6b7d75" font-size="7.5">${E(shown.at(-1).date)}</text></svg>${available?'':'<p class="chart-limit">SD guides unavailable in this window: insufficient or constant prior history.</p>'}`;
  }
  function overviewCalculations() {
    const years=Number($('overview-baseline').value);
    state.overview=state.entries.map(entry => {
      const metric=metricFor(entry,entry.default_field),mode=metric.transform || 'level';
      let rows=[],error='';
      try{ rows=calculate(entry.default_series?.points,entry,metric,mode,years,entry.default_series); }catch(err){error=err.message;}
      const latest=rows.at(-1) || {date:entry.last,raw:null,value:null,z:null,n:0,reason:error || 'No analytical series available'};
      return {entry,metric,mode,rows,latest};
    });
    renderOverview();
  }
  function filterSigma(item) {
    const filter=$('dataset-sigma').value,z=item.latest.z;
    return !filter || (filter==='positive'?finite(z)&&z>0:filter==='negative'?finite(z)&&z<0:FredSigma.band(z)===filter);
  }
  function renderOverview() {
    const words=$('dataset-search').value.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean),grouped=$('keep-grouping').checked;
    const filtered=state.overview.filter(item=>{
      const e=item.entry;
      return (!$('dataset-source').value||e.provider===$('dataset-source').value)&&(!$('dataset-group').value||e.main_group===$('dataset-group').value)&&(!$('dataset-frequency').value||e.frequency===$('dataset-frequency').value)&&filterSigma(item)&&words.every(word=>[e.id,e.name,e.title,e.provider,e.main_group,e.group,e.unit,e.frequency].join(' ').toLocaleLowerCase().includes(word));
    });
    const shown=FredOverview.order(filtered,{sort:state.sort,direction:state.direction,grouped});
    const card=({entry:e,metric,mode,rows,latest:r})=>{
      const band=FredSigma.band(r.z),direction=finite(r.z)?r.z>0?'positive':r.z<0?'negative':'':'',heading=grouped?'h3':'h2';
      return `<article role="listitem" aria-labelledby="card-title-${E(e.id)}" data-dataset="${E(e.id)}" data-main-group="${E(e.main_group)}" data-z="${finite(r.z)?r.z:''}" class="dataset-card ${band} ${direction} ${state.selected?.id===e.id?'selected':''}">
        <div class="card-top sigma-heat ${band} ${direction}"><div class="dataset-card-heading"><div class="card-heading-copy"><${heading} id="card-title-${E(e.id)}"><button type="button" class="dataset-open" data-open="${E(e.id)}">${E(e.name||e.title)}</button></${heading}><p class="card-id">${E(e.id)} · ${E(e.provider)} · ${E(e.main_group)}</p>${e.group!==e.main_group?`<p class="card-topic">${E(e.group)}</p>`:''}</div><div class="card-sigma">${badge(r)}<small>${finite(r.z)?`N=${integer(r.n)} · prior ${$('overview-baseline').value}Y`:E(r.reason||'Unavailable')}</small></div></div>
        ${e.series_count>1?`<p class="card-series">${integer(e.series_count)} series · default: ${E(e.default_series?.label||e.default_group)}</p>`:''}
        <div class="card-value"><span>Latest native value</span><strong class="numeric">${number(r.raw)}</strong><small>${E(metric.unit||e.unit)}</small></div>
        <dl class="card-facts"><div><dt>Observation date</dt><dd>${E(r.date||e.last||'Unavailable')}<small>${E(e.frequency)}${e.last&&r.date&&e.last!==r.date?` · source table through ${E(e.last)}`:''}</small></dd></div><div><dt>Native records</dt><dd>${integer(e.rows)}<small>${integer(e.observations)} nonmissing</small></dd></div></dl></div>
        <div class="card-heat"><div><span>Heat metric</span><strong class="numeric">${number(r.value)} <small>${E(unitFor(metric,mode))}</small></strong></div><p>${E(metric.label||metric.field)} · ${E(transformName(mode))}</p>${sparkline(rows)}</div>
        <div class="card-links"><a href="${E(FredArchive.resolve(e.csv_url))}" download>CSV ↓</a><a href="${E(FredArchive.resolve(e.json_url))}">JSON</a>${safeSource(e.source_url)?`<a href="${E(safeSource(e.source_url))}" target="_blank" rel="noopener noreferrer">Source ↗</a>`:''}<button class="cite" data-cite="${E(e.id)}" type="button">Copy citation</button></div>
      </article>`;
    };
    $('dataset-rows').innerHTML=!shown.length?'<p class="empty-row">No datasets match these filters. Try a broader search or another σ band.</p>':grouped?FredOverview.partition(shown).map((group,i)=>`<section class="dataset-group-section" aria-labelledby="main-group-${i}"><h2 class="dataset-group-heading" id="main-group-${i}">${E(group.name)} <span>${integer(group.items.length)} ${group.items.length===1?'dataset':'datasets'}</span></h2><div class="dataset-grid" role="list" aria-label="${E(group.name)} datasets">${group.items.map(card).join('')}</div></section>`).join(''):`<div class="dataset-grid" role="list" aria-label="All saved datasets">${shown.map(card).join('')}</div>`;
    document.querySelectorAll('[data-sort]').forEach(button=>{const active=button.dataset.sort===state.sort;button.setAttribute('aria-pressed',String(active));button.title=active?(state.sort==='extreme'?'Most extreme absolute sigma first':`${state.direction===1?'Ascending':'Descending'}; select again to reverse`):'Select to sort';button.querySelector('.sort-direction').textContent=active?(state.direction===1?'↑':'↓'):'↕';});
    const orderNote=state.sort==='extreme'?'Most extreme |σ| first, positive or negative':state.sort==='z'?`${state.direction===1?'Lowest':'Highest'} signed σ first`:'Ordered by the selected field';
    text('sort-note',`${orderNote}${grouped?' within each main group.':' across all main groups.'}`);
    text('catalog-status',`${shown.length} of ${state.entries.length} datasets · ${grouped?'main groups retained':'one combined list'} · recommended heat metric · prior ${$('overview-baseline').value}-year SD baseline`);
  }
  function fillOptions(id,values) {
    const select=$(id);
    values.filter(Boolean).sort().forEach(value=>{const option=document.createElement('option');option.value=value;option.textContent=value;select.append(option);});
  }
  function renderGroupOptions() {
    const groups=state.groups?.groups || [],query=$('detail-series-search').value.trim().toLocaleLowerCase();
    const matches=groups.filter(group=>!query || `${group.label} ${group.key}`.toLocaleLowerCase().includes(query));
    const shown=matches.slice(0,100),selected=groups.find(group=>group.key===state.groupKey),defaultGroup=groups.find(group=>group.key===state.selected.default_group);
    for(const group of [selected,defaultGroup]) if(group && !shown.includes(group)) shown.unshift(group);
    $('detail-series').innerHTML=shown.map(group=>`<option value="${E(group.key)}">${E(group.label || group.key)}</option>`).join('');
    $('detail-series').value=state.groupKey;
    text('series-search-status',`${integer(matches.length)} matching series${matches.length>100?' · showing first 100 plus selection/default':''}`);
    $('detail-series-search').disabled=groups.length<2;
  }
  async function selectDataset(id,{focus=true}={}) {
    const entry=state.entries.find(entry=>entry.id===id);
    if(!entry) return;
    const token=++state.selectionToken;
    state.selected=entry;state.groups=null;state.groupKey=null;state.raw=null;state.nativeCache=new Map();state.nativePage=0;state.nativeToken++;
    $('dataset-detail').hidden=false;
    text('detail-id',`${entry.id} · ${entry.provider} · ${entry.group}`);
    text('detail-title',entry.name || entry.title);text('detail-description',entry.title);
    text('detail-provenance',`Observation coverage: ${entry.first || 'unavailable'} to ${entry.last || 'unavailable'} · ${entry.frequency || 'As published'} · ${entry.adjustment || 'As published'}. Source update: ${entry.source_updated || 'not supplied'}. Retrieved: ${entry.retrieved_at || 'not supplied'}. Last check: ${entry.last_checked_at || entry.retrieved_at || 'not supplied'} · ${entry.refresh_status || 'saved'}.`);
    const sourceNotes=Array.isArray(entry.notes)?entry.notes.join(' '):entry.notes || '';
    $('detail-source-notes').innerHTML=`${E(sourceNotes)}${entry.quality_dates?.length?` <span class="sigma-badge unavailable">Source quality flags: ${E(entry.quality_dates.join(', '))}</span> Flagged observations and any growth calculation using them as a year-ago base are excluded from heat and sigma baselines. Their original native values remain available.`:''}`;
    $('detail-links').innerHTML=`<a class="button" href="${E(FredArchive.resolve(entry.csv_url))}" download>Native CSV ↓</a><a class="button secondary" href="${E(FredArchive.resolve(entry.json_url))}">Native JSON</a>${safeSource(entry.source_url)?`<a class="button secondary" href="${E(safeSource(entry.source_url))}" target="_blank" rel="noopener noreferrer">Original source ↗</a>`:''}<button class="button secondary" data-cite="${E(entry.id)}" type="button">Copy citation</button>`;
    $('detail-series').innerHTML='<option>Loading series…</option>';$('detail-field').innerHTML='';$('detail-series-search').value='';$('detail-transform').value='recommended';$('detail-baseline').value=$('overview-baseline').value;
    $('detail-summary').innerHTML='';$('detail-chart').innerHTML='';$('series-record-rows').innerHTML='';$('series-pagination').innerHTML='';text('detail-note','');text('native-status','');$('native-rows').innerHTML='';$('native-head').innerHTML='';$('native-pagination').innerHTML='';
    setTab('series');text('detail-status','Loading this dataset’s series and measures…');renderOverview();
    if(focus){$('dataset-detail').scrollIntoView({behavior:'auto',block:'start'});$('dataset-detail').focus({preventScroll:true});}
    try {
      const groups=entry.groups_url?await loadJSON(entry.groups_url):{metrics:entry.metrics,default_field:entry.default_field,default_group:entry.default_group,groups:[{...entry.default_series,points:{[entry.default_field]:entry.default_series?.points || []}}]};
      if(token!==state.selectionToken) return;
      state.groups=groups;
      const choices=groups.groups || [];
      state.groupKey=(choices.find(group=>group.key===(groups.default_group || entry.default_group)) || choices[0])?.key;
      renderGroupOptions();
      const metrics=groups.metrics || entry.metrics || [];
      $('detail-field').innerHTML=metrics.map(metric=>`<option value="${E(metric.field)}">${E(metric.label || metric.field)}${metric.unit?` (${E(metric.unit)})`:''}</option>`).join('');
      $('detail-field').value=groups.default_field || entry.default_field || metrics[0]?.field;
      renderDetail();
    } catch(error) { if(token===state.selectionToken) {text('detail-status',`Series could not load: ${error.message}. The native CSV and JSON remain available above.`);$('detail-status').setAttribute('role','alert');} }
  }
  function renderChart(rows,metric,mode) {
    const label=`${metric.label || metric.field} · ${transformName(mode)} (${unitFor(metric,mode)})`;
    text('chart-title',label);
    const latest=rows.at(-1),z=latest?.z,band=FredSigma.band(z),direction=finite(z)?z>0?'positive':z<0?'negative':'':'';
    $('detail-chart-heading').className=`chart-heading sigma-heat ${band} ${direction}`;
    $('chart-sigma').innerHTML=badge(latest)+`<small>Prior ${$('detail-baseline').value}Y · N=${integer(latest?.n)}</small>`;
    const finiteRows=rows.filter(row=>finite(row.value));
    if(!finiteRows.length){$('detail-chart').innerHTML='<p class="fine">No valid observations for this heat calculation. Try native level or another series.</p>';return;}
    const shown=sample(rows),allValues=[];
    rows.forEach(row=>{if(finite(row.value))allValues.push(row.value);if(row.n>=12 && finite(row.sd) && row.sd>0 && finite(row.mean)){allValues.push(row.mean-2*row.sd,row.mean+2*row.sd);}});
    let lo=Infinity,hi=-Infinity;for(const v of allValues){lo=Math.min(lo,v);hi=Math.max(hi,v);}const span=hi-lo || Math.max(Math.abs(hi)*.1,1);lo-=span*.06;hi+=span*.06;
    const w=1000,h=290,p={left:72,right:18,top:15,bottom:35},start=Date.parse(rows[0].date),end=Date.parse(rows.at(-1).date),duration=end-start || 1;
    const x=row=>p.left+(Date.parse(row.date)-start)/duration*(w-p.left-p.right),y=value=>h-p.bottom-(value-lo)/(hi-lo)*(h-p.top-p.bottom);
    const eligible=row=>!!FredOverview.guides(row);
    const getBand=(row,k)=>eligible(row)?row.mean+k*row.sd:null;
    const line=(get,stroke,dash='')=>`<path d="${linePath(shown,x,y,get)}" fill="none" stroke="${stroke}" stroke-width="1.3" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
    const chunks=[];let chunk=[];shown.forEach(row=>{if(eligible(row)){chunk.push(row);}else if(chunk.length){chunks.push(chunk);chunk=[];}});if(chunk.length)chunks.push(chunk);
    const bands=chunks.map(part=>`<path d="${part.map((row,i)=>`${i?'L':'M'}${x(row).toFixed(2)},${y(row.mean+row.sd).toFixed(2)}`).join(' ')} ${part.slice().reverse().map(row=>`L${x(row).toFixed(2)},${y(row.mean-row.sd).toFixed(2)}`).join(' ')} Z" fill="#e3e9e0" opacity=".8"/>`).join('');
    let grid='';for(let i=0;i<5;i++){const value=lo+(hi-lo)*i/4,yy=y(value);grid+=`<line x1="${p.left}" y1="${yy}" x2="${w-p.right}" y2="${yy}" stroke="#e0e6df"/><text x="${p.left-8}" y="${yy+4}" text-anchor="end" fill="#6b7d75" font-size="11">${E(number(value))}</text>`;}
    $('detail-chart').innerHTML=`<svg class="detail-chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="history-chart-title history-chart-desc"><title id="history-chart-title">${E(label)}</title><desc id="history-chart-desc">${rows.length} native-frequency observations, ${E(rows[0].date)} through ${E(rows.at(-1).date)}. Green line: selected heat metric. Shaded band: prior mean plus or minus one sample standard deviation. Dotted lines: plus or minus two. Missing observations and unavailable baselines create gaps. Full values are in the records table below.</desc>${grid}${bands}${line(row=>getBand(row,-1),'#879a8b','2 3')}${line(row=>getBand(row,1),'#879a8b','2 3')}${line(row=>getBand(row,-2),'#9cabb4','3 4')}${line(row=>getBand(row,2),'#9cabb4','3 4')}${line(row=>eligible(row)?row.mean:null,'#9a8062','6 4')}${line(row=>row.value,'#3f6c64')}<text x="${p.left}" y="${h-10}" fill="#6b7d75" font-size="11">${E(rows[0].date)}</text><text x="${w-p.right}" y="${h-10}" text-anchor="end" fill="#6b7d75" font-size="11">${E(rows.at(-1).date)}</text></svg>`;
  }
  function renderDetail() {
    if(!state.groups || !state.selected) return;
    const entry=state.selected,group=state.groups.groups.find(group=>group.key===state.groupKey),field=$('detail-field').value;
    const metric=(state.groups.metrics || entry.metrics || []).find(metric=>metric.field===field) || metricFor(entry,field),mode=modeFor(metric),years=Number($('detail-baseline').value);
    let rows=[];
    try{rows=calculate(group?.points?.[field] || [],entry,metric,mode,years,group);}catch(error){text('detail-status',error.message);state.records=[];$('detail-summary').innerHTML='';$('detail-chart').innerHTML='';renderRecords();return;}
    state.records=rows;state.recordPage=0;
    const latest=rows.at(-1),valid=rows.filter(row=>finite(row.value)).length;
    text('detail-status',`${group?.label || 'Selected series'} · ${metric.label || field} · ${transformName(mode)} · ${unitFor(metric,mode)} · ${entry.frequency} · prior ${years} calendar years · ${integer(rows.length)} observations (${integer(valid)} usable heat values).`);
    $('detail-status').setAttribute('role','status');
    const summary=(label,value,note)=>`<div class="summary-item"><span>${E(label)}</span><strong>${value}</strong><small>${E(note)}</small></div>`;
    $('detail-summary').innerHTML=latest?summary('Latest native value',number(latest.raw),`${metric.unit || entry.unit} · ${latest.date}`)+summary('Latest heat metric',number(latest.value),`${transformName(mode)} · ${unitFor(metric,mode)}`)+summary('Signed distance',badge(latest),latest.reason || 'Above (+) or below (−) its prior mean')+summary('Prior mean / sample SD',`${number(latest.mean)} / ${number(latest.sd)}`,`N=${integer(latest.n)} · minimum 12 prior usable values`)+summary('Baseline window',E(latest.baselineStart),`through before ${latest.date}; up to ${years} years`):'<p>No dated analytical values are available for this selection. All native records remain available in the next tab.</p>';
    text('detail-note',[group?.note,entry.metadata_note,entry.refresh_error,'The selected observation is excluded from its baseline. Missing values are not zero. Calculations use unrounded numeric values; displayed values are rounded. Very large native decimal source strings are preserved in the CSV and native-records tab.'].filter(Boolean).join(' '));
    renderChart(rows,metric,mode);renderRecords();
  }
  function pagination(id,page,total,onPage) {
    const count=Math.max(1,Math.ceil(total/PAGE));
    $(id).innerHTML=`<span>${total?`${integer(page*PAGE+1)}–${integer(Math.min((page+1)*PAGE,total))} of ${integer(total)} records`:'No records'}</span><button type="button" data-step="-1" ${page===0?'disabled':''}>Previous</button><label>Page <input type="number" min="1" max="${count}" value="${page+1}" aria-label="Page number"></label><span>of ${integer(count)}</span><button type="button" data-step="1" ${page>=count-1?'disabled':''}>Next</button>`;
    $(id).querySelectorAll('[data-step]').forEach(button=>button.addEventListener('click',()=>onPage(page+Number(button.dataset.step))));
    const input=$(id).querySelector('input');
    const go=()=>{const next=Number(input.value)-1;if(Number.isInteger(next)&&next>=0&&next<count)onPage(next);else input.value=page+1;};
    input.addEventListener('change',go);
    input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();go();}});
  }
  function renderRecords() {
    const rows=state.records.slice().reverse(),page=state.recordPage;
    $('series-record-rows').innerHTML=rows.slice(page*PAGE,(page+1)*PAGE).map(row=>`<tr><td>${E(row.date)}${row.baseDate?`<small>Year-ago base: ${E(row.baseDate)}</small>`:''}</td><td class="numeric">${number(row.raw)}</td><td class="numeric">${number(row.value)}</td><td class="numeric">${number(row.mean)}</td><td class="numeric">${number(row.sd)}</td><td class="numeric">${integer(row.n)}</td><td>${badge(row)}${row.reason?`<small>${E(row.reason)}</small>`:''}</td></tr>`).join('') || '<tr><td colspan="7" class="empty-row">No analytical records for this series and measure.</td></tr>';
    pagination('series-pagination',page,rows.length,next=>{state.recordPage=next;renderRecords();});
  }
  function setTab(name) {
    for(const key of ['series','native']) { const active=name===key;$(key+'-tab').setAttribute('aria-selected',String(active));$(key+'-tab').tabIndex=active?0:-1;$(key+'-records').hidden=!active; }
    if(name==='native' && state.selected) renderNative();
  }
  async function renderNative() {
    const token=++state.nativeToken,entry=state.selected,page=state.nativePage;
    text('native-status','Loading original source rows…');
    $('native-rows').innerHTML='';$('native-head').innerHTML='';$('native-pagination').innerHTML='';
    try {
      if(!state.raw)state.raw=FredArchive.load(entry.id);
      const raw=await state.raw;
      if(token!==state.nativeToken)return;
      const total=raw.total_rows ?? entry.rows ?? raw.rows.length,start=page*PAGE,end=Math.min(start+PAGE,total),sourceSize=raw.page_size || 500;
      let columns=raw.columns || [],rows=[],download='';
      if(raw.row_pages?.length) {
        const first=Math.floor(start/sourceSize),last=Math.floor(Math.max(start,end-1)/sourceSize);
        for(let sourcePage=first;sourcePage<=last;sourcePage++){
          let payload;
          if(sourcePage===0 && Array.isArray(raw.rows)) payload={columns:raw.columns,rows:raw.rows};
          else {
            if(!state.nativeCache.has(sourcePage))state.nativeCache.set(sourcePage,loadJSON(raw.row_pages[sourcePage]));
            payload=await state.nativeCache.get(sourcePage);
          }
          if(token!==state.nativeToken)return;
          columns=payload.columns || columns;
          const offset=sourcePage*sourceSize;
          rows.push(...payload.rows.slice(Math.max(0,start-offset),Math.min(sourceSize,end-offset)));
        }
        download=raw.row_pages[first];
      } else rows=(raw.rows || []).slice(start,end);
      $('native-head').innerHTML=`<tr>${columns.map(column=>`<th scope="col">${E(typeof column==='object'?column.label || column.name || column.field:column)}</th>`).join('')}</tr>`;
      $('native-rows').innerHTML=rows.map(row=>`<tr>${columns.map((column,index)=>{const key=typeof column==='object'?column.name || column.field:column;const value=Array.isArray(row)?row[index]:row[key];return `<td>${value===null?'<span title="Original JSON null">null</span>':E(value)}</td>`;}).join('')}</tr>`).join('') || `<tr><td colspan="${columns.length || 1}" class="empty-row">No native records on this page.</td></tr>`;
      text('native-status',`${integer(total)} original native records · original source order · ${integer(columns.length)} columns. Missing markers remain as published.`);
      pagination('native-pagination',page,total,next=>{state.nativePage=next;renderNative();});
      if(download){const link=document.createElement('a');link.href=FredArchive.resolve(download);link.download='';link.textContent='Download this source JSON page ↓';$('native-pagination').append(link);}
    }catch(error){if(token===state.nativeToken){state.raw=null;state.nativeCache.clear();text('native-status',`Native rows could not load: ${error.message}. Use the CSV or JSON link above, or reopen this tab to retry.`);}}
  }
  async function copyCitation(id) {
    const entry=state.entries.find(row=>row.id===id);if(!entry)return;
    const citation=`${entry.citation || `${entry.provider}, ${entry.title || entry.name} (${entry.id}), saved archive.`} Archived CSV: ${FredArchive.resolve(entry.csv_url)}`;
    try{await navigator.clipboard.writeText(citation);text('copy-status',`Copied citation for ${entry.id}.`);}catch{text('copy-status',citation);}
  }
  document.addEventListener('click',event=>{
    const open=event.target.closest('[data-open]'),cite=event.target.closest('[data-cite]'),sort=event.target.closest('[data-sort]');
    if(open){if(location.hash===`#${encodeURIComponent(open.dataset.open)}`)selectDataset(open.dataset.open);else location.hash=encodeURIComponent(open.dataset.open);}
    if(cite)copyCitation(cite.dataset.cite);
    if(sort){const key=sort.dataset.sort,previous=state.sort;state.direction=key==='extreme'?-1:state.sort===key?-state.direction:['name','group'].includes(key)?1:-1;state.sort=key;if(key==='group')$('keep-grouping').checked=true;else if((key==='extreme'||key==='z')&&key!==previous)$('keep-grouping').checked=false;renderOverview();}
  });
  for(const id of ['dataset-search','dataset-source','dataset-group','dataset-frequency','dataset-sigma']) $(id).addEventListener('input',renderOverview);
  $('keep-grouping').addEventListener('change',renderOverview);
  function changeBaseline(value){$('overview-baseline').value=value;$('detail-baseline').value=value;overviewCalculations();if(state.selected&&state.groups)renderDetail();}
  $('overview-baseline').addEventListener('change',()=>changeBaseline($('overview-baseline').value));
  $('detail-baseline').addEventListener('change',()=>changeBaseline($('detail-baseline').value));
  $('detail-series-search').addEventListener('input',renderGroupOptions);
  $('detail-series').addEventListener('change',()=>{state.groupKey=$('detail-series').value;renderDetail();});
  for(const id of ['detail-field','detail-transform']) $(id).addEventListener('change',renderDetail);
  for(const key of ['series','native']) {
    $(key+'-tab').addEventListener('click',()=>setTab(key));
    $(key+'-tab').addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?'series':event.key==='End'?'native':key==='native'?'series':'native';setTab(next);$(next+'-tab').focus();}});
  }
  $('close-detail').addEventListener('click',event=>{event.preventDefault();history.pushState(null,'',location.pathname+location.search);state.selectionToken++;state.nativeToken++;state.selected=null;$('dataset-detail').hidden=true;renderOverview();$('dataset-search').focus();$('catalog-status').scrollIntoView({behavior:'auto',block:'center'});});
  function readHash(){let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}if(state.entries.some(entry=>entry.id===id))selectDataset(id);}
  window.addEventListener('hashchange',readHash);
  window.AllFredData=Object.freeze({get datasetCount(){return state.entries.length;},get selectedID(){return state.selected?.id || null;},get selectedSeries(){return state.groupKey;},get records(){return state.records.slice();},get overview(){return state.overview.map(item=>({id:item.entry.id,latest:{...item.latest},mode:item.mode}));}});
  FredArchive.catalog().then(async catalog=>{
    if(!catalog.analytics_url)throw Error('This snapshot has no analytical index');
    const index=await loadJSON(catalog.analytics_url);
    if(index.schema_version!==1 || !Array.isArray(index.datasets))throw Error('Unsupported analytical index');
    state.entries=index.datasets.map(entry=>({...entry,main_group:FredOverview.mainGroup(entry)}));
    text('snapshot-date',index.snapshot || catalog.snapshot);
    const total=index.record_count ?? state.entries.reduce((sum,entry)=>sum+(entry.rows || 0),0),providers=new Set(state.entries.map(entry=>entry.provider));
    $('collection-facts').innerHTML=`<span><b>${integer(state.entries.length)}</b> datasets</span><span><b>${integer(total)}</b> native records</span><span><b>${integer(providers.size)}</b> sources</span><span>Full supporting histories · native frequencies</span>`;
    for(const [id,key] of [['dataset-source','provider'],['dataset-group','main_group'],['dataset-frequency','frequency']])fillOptions(id,[...new Set(state.entries.map(entry=>entry[key]))]);
    for(const [id,key] of [['archive-download','archive_url'],['coverage-link','notes_url']])if(catalog[key]){$(id).href=FredArchive.resolve(catalog[key]);$(id).hidden=false;}
    overviewCalculations();readHash();
  }).catch(error=>{text('catalog-status',`The collection could not load: ${error.message}. Reload or use the JSON catalogue to find the native files.`);$('catalog-status').setAttribute('role','alert');});
})();
