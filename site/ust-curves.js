/* Daily constant-maturity benchmarks. Kept separate from the individual-bond workbook. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.USTCurves=api;})(typeof window!=='undefined'?window:globalThis,()=>{
'use strict';
const COLORS=['#12696b','#9b4380','#b75c12','#356ab1','#7754a1','#397842','#a34242','#5c6674','#87700b'];
const DASHES=['','8 4','3 4','12 4 3 4','2 3','10 3','6 3 2 3','14 5','5 5'];
const MAX_OVERLAYS=8;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
const validNumber=n=>typeof n==='number'&&Number.isFinite(n)&&n>=-5&&n<=30;
const safeURL=u=>{try{const x=new URL(u);return x.protocol==='https:'?x.href:'';}catch{return'';}};
const link=(url,text)=>safeURL(url)?`<a href="${esc(safeURL(url))}" target="_blank" rel="noopener noreferrer">${esc(text)} ↗</a>`:esc(text);
function validate(data){
 if(data?.schema_version!==1||data.frequency!=='daily'||!Array.isArray(data.tenors)||data.tenors.length<4||!Array.isArray(data.observations)||!data.observations.length)throw Error('Daily curve dataset is invalid.');
 const ids=new Set();let years=-1;
 for(const t of data.tenors){if(!t.id||!t.label||ids.has(t.id)||!Number.isFinite(t.years)||t.years<=years||!safeURL(t.source_url))throw Error('Daily curve maturities are invalid.');ids.add(t.id);years=t.years;}
 let previous='';const today=new Date().toISOString().slice(0,10);
 for(const r of data.observations){if(!validDate(r.date)||r.date<=previous||r.date>today||!Array.isArray(r.values)||r.values.length!==data.tenors.length||r.values.some(v=>v!==null&&!validNumber(v))||r.values.filter(validNumber).length<2)throw Error('Daily curve observations are invalid.');previous=r.date;}
 if(!data.source||!safeURL(data.source_url)||!data.basis||!data.retrieved_at||Number.isNaN(Date.parse(data.retrieved_at)))throw Error('Daily curve provenance is incomplete.');
 for(const event of data.events||[]){if(!validDate(event.date)||!event.label||!event.significance||!safeURL(event.source_url)||!data.observations.some(r=>r.date===event.date))throw Error('Historical curve context is invalid.');}
 return data;
}
function buildModel(data,market){
 validate(data);
 const rows=data.observations.map(r=>{const raw=data.raw_sources?.find(s=>s.year===Number(r.date.slice(0,4)));return {...r,values:[...r.values],source:r.source||data.source,source_url:r.source_url||raw?.source_url||data.source_url,retrieved_at:r.retrieved_at||raw?.retrieved_at||data.retrieved_at};});
 let warning='';
 if(market&&validDate(market.as_of)&&market.as_of<=new Date().toISOString().slice(0,10)&&Array.isArray(market.labels)&&Array.isArray(market.values)&&market.labels.length===market.values.length&&safeURL(market.source_url)){
  const values=data.tenors.map(t=>{const i=market.labels.indexOf(t.label);return i>=0&&validNumber(market.values[i])?market.values[i]:null;});
  if(values.filter(validNumber).length>=2){
   const latest=rows.at(-1);
   if(market.as_of>latest.date)rows.push({date:market.as_of,values,source:market.source,source_url:market.source_url,retrieved_at:market.checked_at});
   else if(market.as_of===latest.date&&values.some((v,i)=>v!==null&&latest.values[i]!==null&&Math.abs(v-latest.values[i])>.000001))warning='The daily feed and archived snapshot disagree for the same date. The sourced archive is shown; compare the source records before relying on it.';
  }
  if(market.status!=='ok')warning+=(warning?' ':'')+'The latest daily feed refresh failed; the last dated observation is retained.';
 }
 return {data,rows,current:rows.at(-1),warning};
}
function addDate(model,selected,date){
 if(!validDate(date)||!model.rows.some(r=>r.date===date))return{selected,error:'No observation exists for that exact date. Choose a business day in the available range; weekends and holidays are not substituted.'};
 if(date===model.current.date)return{selected,error:'The latest curve is already shown and always stays on the chart.'};
 if(selected.includes(date))return{selected,error:'That historical curve is already shown.'};
 if(selected.length>=MAX_OVERLAYS)return{selected,error:`Up to ${MAX_OVERLAYS} historical curves can be compared. Remove one to add another.`};
 return{selected:[...selected,date],error:''};
}
function linesFor(model,selected){return[model.current,...selected.map(d=>model.rows.find(r=>r.date===d)).filter(Boolean)].map((row,i)=>({...row,color:COLORS[i],dash:DASHES[i],number:i+1,current:i===0,event:(model.data.events||[]).find(e=>e.date===row.date)}));}
function segments(values,x,y){const out=[];let part=[];for(let i=0;i<values.length;i++){if(values[i]===null){if(part.length)out.push(part);part=[];}else part.push([x(i),y(values[i]),i,values[i]]);}if(part.length)out.push(part);return out;}
function chart(lines,tenors,compact=false){
 const W=compact?400:680,H=335,L=42,R=45,T=24,B=45;
 const all=lines.flatMap(r=>r.values).filter(validNumber),lo=Math.floor((Math.min(...all)-.25)*2)/2,hi=Math.ceil((Math.max(...all)+.25)*2)/2;
 const x=i=>L+i*(W-L-R)/(tenors.length-1),y=v=>T+(hi-v)*(H-T-B)/(hi-lo);
 const ticks=Array.from({length:6},(_,i)=>lo+(hi-lo)*i/5);
 const ends=lines.map(l=>({number:l.number,y:y(l.values.findLast(validNumber))})).sort((a,b)=>a.y-b.y);
 for(let i=0;i<ends.length;i++)ends[i].labelY=Math.max(ends[i].y,i?ends[i-1].labelY+22:T);
 for(let i=ends.length-1;i>=0;i--)ends[i].labelY=Math.min(ends[i].labelY,i<ends.length-1?ends[i+1].labelY-22:H-B);
 const labelY=number=>ends.find(p=>p.number===number).labelY;
 return `<svg class="uc-chart" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="uc-chart-title uc-chart-desc"><title id="uc-chart-title">Daily U.S. Treasury yield curves</title><desc id="uc-chart-desc">${esc(lines.map(l=>`${l.number}: ${l.date}${l.current?', latest available':''}`).join('; '))}. Yields in percent per annum. Maturities are equally spaced. Missing values break the lines. Exact numbers are in the table below.</desc>${ticks.map(v=>`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" class="uc-grid"/><text x="${L-10}" y="${y(v)+4}" text-anchor="end">${v.toFixed(1)}</text>`).join('')}<text x="${L}" y="14">Yield %</text>${tenors.map((t,i)=>`<text x="${x(i)}" y="${H-(compact&&i%2?3:21)}" text-anchor="middle">${esc(t.label)}</text>`).join('')}${[...lines].reverse().map(l=>{const parts=segments(l.values,x,y),end=parts.at(-1)?.at(-1);return`<g data-curve-date="${l.date}">${parts.map(p=>p.length>1?`<polyline points="${p.map(v=>v.slice(0,2).join(',')).join(' ')}" fill="none" stroke="${l.color}" stroke-width="${l.current?3.5:2.5}" stroke-dasharray="${l.dash}"/>`:'').join('')}${parts.flat().map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="${l.color}"><title>${l.date} · ${esc(tenors[p[2]].label)} · ${p[3].toFixed(2)}%</title></circle>`).join('')}${end?`<path d="M ${end[0]+4} ${end[1]} L ${W-25} ${labelY(l.number)}" fill="none" stroke="${l.color}" stroke-width="1" opacity=".65"/><circle cx="${W-12}" cy="${labelY(l.number)}" r="10" fill="${l.color}" stroke="var(--panel,#fff)" stroke-width="2"/><text x="${W-12}" y="${labelY(l.number)+4}" text-anchor="middle" class="uc-end-number">${l.number}</text>`:''}</g>`;}).join('')}</svg>`;
}
function labels(lines){return`<ol class="uc-labels" aria-label="Curve dates and significance">${lines.map(l=>`<li class="uc-label" style="--uc-color:${l.color}"><div class="uc-label-top"><svg width="32" height="12" aria-hidden="true"><line x1="0" y1="6" x2="32" y2="6" stroke="${l.color}" stroke-width="3" stroke-dasharray="${l.dash}"/></svg><strong>${l.number}. ${l.date}</strong>${l.current?'<span class="uc-badge">Latest</span>':`<button type="button" class="uc-remove" data-uc-remove="${l.date}" aria-label="Remove curve ${l.date}">×</button>`}</div><p>${esc(l.current?'Latest available daily observation; not a live quote.':l.event?.significance||'Selected historical comparison. No specific event is assigned to this date.')}</p>${l.event&&!l.current?`<small>${link(l.event.source_url,'Why this date')}</small>`:''}<small>${l.values.filter(validNumber).length}/${l.values.length} maturities · ${link(l.source_url,'Yield source')}</small></li>`).join('')}</ol>`;}
function table(lines,tenors){return`<details class="uc-table"><summary>Exact yields and source details</summary><div class="table-scroll" tabindex="0" role="region" aria-label="Daily yield comparison table"><table><caption>Daily observations (% p.a.); — means unavailable, never zero.</caption><thead><tr><th scope="col">Observation</th>${tenors.map(t=>`<th scope="col">${esc(t.label)}</th>`).join('')}</tr></thead><tbody>${lines.map(l=>`<tr><th scope="row">${l.number}. ${l.date}${l.current?' · latest':''}</th>${l.values.map(v=>`<td>${v===null?'—':v.toFixed(2)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><ul class="uc-sources">${lines.map(l=>`<li>${l.date}: ${esc(l.source)}. Retrieved ${esc(l.retrieved_at||'time unavailable')}.</li>`).join('')}</ul></details>`;}
let state={model:null,selected:[],loading:null,error:'',date:'',preset:''};
function render(el){
 if(!state.model){el.innerHTML=`<section class="chart-panel uc-panel"><h2>Compare daily Treasury yield curves</h2><p role="status">${esc(state.error||'Loading sourced daily curves…')}</p>${state.error?'<button class="button" type="button" data-uc-retry>Retry loading curves</button>':''}</section>`;return;}
 const m=state.model,lines=linesFor(m,state.selected),first=m.rows[0].date,last=m.current.date,events=(m.data.events||[]).filter(r=>r.date!==last);
 const preset=state.preset||events.at(-1)?.date||'';
 el.innerHTML=`<section class="chart-panel uc-panel" aria-labelledby="uc-title"><div class="uc-heading"><div><div class="eyebrow">Daily benchmark comparison</div><h2 id="uc-title">Treasury yield curves</h2><p>Keep the latest curve and layer historical dates in different colors.</p></div><div class="uc-asof">Latest available<strong>${last}</strong><small>Daily observation · not live</small></div></div><div class="uc-controls"><label><span>Significant date</span><select id="uc-preset">${events.map(r=>`<option value="${r.date}" ${preset===r.date?'selected':''}>${r.date} · ${esc(r.label)}</option>`).join('')}</select></label><button type="button" class="button" data-uc-add-preset ${!events.length?'disabled':''}>Add historical curve</button><label><span>Or exact observation date</span><input type="date" id="uc-date" min="${first}" max="${last}" value="${esc(state.date)}" aria-describedby="uc-date-help"></label><button type="button" class="button ghost" data-uc-add-date>Add date</button><button type="button" class="button ghost" data-uc-clear ${!state.selected.length?'disabled':''}>Clear historical curves</button></div><p id="uc-date-help" class="uc-help">Available ${first}–${last} · add up to ${MAX_OVERLAYS} historical curves. Exact dates only; no weekend or holiday substitution.</p><p id="uc-status" role="status" aria-live="polite">${esc(state.error||`${state.selected.length} historical curve${state.selected.length===1?'':'s'} added. The latest curve stays visible.`)}</p>${m.warning?`<p class="source-notice">${esc(m.warning)}</p>`:''}<div class="uc-visual"><div class="uc-plot">${chart(lines,m.data.tenors,typeof matchMedia==='function'&&matchMedia('(max-width:600px)').matches)}<p class="uc-help">Maturity tenors are equally spaced. Missing maturities stay blank; no values are estimated.</p></div>${labels(lines)}</div>${table(lines,m.data.tenors)}<p class="source-line">${esc(m.data.basis)} ${link(m.data.source_url,m.data.source)}. Historical context is not evidence that an announcement caused a yield move. This benchmark comparison is separate from the supplied individual-bond observations below.</p></section>`;
}
async function load(){
 if(state.loading)return state.loading;
 state.error='';
 state.loading=(async()=>{try{const a=await fetch('data/ust-curves-daily.json',{cache:'no-store'});if(!a.ok)throw Error('Historical daily curves could not be loaded.');let data=await a.json();if(data.history_files){if(!Array.isArray(data.history_files)||data.history_files.length>100||data.history_files.some(f=>!/^ust-curves-history\/\d{4}\.json$/.test(f.path)))throw Error('Historical file index is invalid.');const years=await Promise.all(data.history_files.map(async f=>{const r=await fetch('data/'+f.path);if(!r.ok)throw Error('Historical year '+f.year+' could not be loaded.');const rows=(await r.json()).observations;if(!Array.isArray(rows)||rows.length!==f.count||rows.some(row=>!row.date.startsWith(String(f.year)+'-')))throw Error('Historical year '+f.year+' failed validation.');return rows;}));const observations=years.flat().sort((a,b)=>a.date.localeCompare(b.date));if(observations.length!==data.observation_count)throw Error('Historical observation count is incomplete.');data={...data,observations};}let market=null;try{const r=await fetch('data/market.json',{cache:'no-store'});if(r.ok)market=await r.json();}catch{}
 state.model=buildModel(data,market);state.selected=state.selected.filter(d=>state.model.rows.some(r=>r.date===d)&&d!==state.model.current.date);
 }catch(e){state.error='Daily comparison unavailable: '+e.message+' Existing bond data is unchanged.';}finally{state.loading=null;const el=document.getElementById('ust-curves');if(el)render(el);}})();return state.loading;
}
function mount(el){if(!el)return;render(el);if(!el.dataset.ucBound){el.dataset.ucBound='true';el.addEventListener('change',event=>{if(event.target.id==='uc-date')state.date=event.target.value;if(event.target.id==='uc-preset')state.preset=event.target.value;});el.addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;
 if(b.hasAttribute('data-uc-retry')){load();render(el);return;}
 if(!state.model)return;
 if(b.hasAttribute('data-uc-add-preset')||b.hasAttribute('data-uc-add-date')){const field=el.querySelector(b.hasAttribute('data-uc-add-preset')?'#uc-preset':'#uc-date');const result=addDate(state.model,state.selected,field?.value||'');state.selected=result.selected;state.error=result.error;render(el);el.querySelector(b.hasAttribute('data-uc-add-preset')?'[data-uc-add-preset]':'[data-uc-add-date]')?.focus();}
 else if(b.hasAttribute('data-uc-remove')){state.selected=state.selected.filter(d=>d!==b.dataset.ucRemove);state.error='';render(el);el.querySelector('[data-uc-add-preset]')?.focus();}
 else if(b.hasAttribute('data-uc-clear')){state.selected=[];state.error='';render(el);el.querySelector('[data-uc-add-preset]')?.focus();}
 });}if(!state.model&&!state.error)load();}
return{mount,validate,buildModel,addDate,linesFor,segments,chart,labels,table,MAX_OVERLAYS};
});
