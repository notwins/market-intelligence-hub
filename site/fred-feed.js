(function(root){'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const FX=['USD/SGD','CHF/SGD','USD/CHF','USD/JPY','SGD/JPY','AUD/SGD','SGD/MYR'];
function validate(d){if(d?.schemaVersion!==1||d.contractVersion!=='fred-daily/1.0.0'||!Array.isArray(d.series)||!d.series.length)throw Error('Invalid daily feed');const ids=new Set();for(const s of d.series){if(ids.has(s.id)||!['fx','ust'].includes(s.family)||s.frequency!=='daily'||!Array.isArray(s.points)||!s.points.length)throw Error('Invalid series');ids.add(s.id);let last='';for(const p of s.points){if(!/^\d{4}-\d{2}-\d{2}$/.test(p[0])||p[0]<=last||!Number.isFinite(p[1])||(s.family==='fx'&&p[1]<=0))throw Error('Invalid dated value');last=p[0];}}return d;}
function selected(s,start,end){return s.points.filter(p=>p[0]>=start&&p[0]<=end);}
function csv(s,start,end,retrieved){return 'series,observation_date,value,unit,derived,retrieved_at\r\n'+selected(s,start,end).map(p=>[s.id,p[0],p[1],s.unit,!!s.derived,retrieved].map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n')+'\r\n';}
function chart(s,start,end){const p=selected(s,start,end);if(p.length<2)return '<p>At least two dated observations are needed for this range.</p>';const W=1120,H=320,L=75,R=25,T=20,B=38,vals=p.map(p=>p[1]),lo=Math.min(...vals),hi=Math.max(...vals),pad=(hi-lo||Math.abs(hi)*.02||.1)*.1,min=lo-pad,max=hi+pad,first=Date.parse(p[0][0]),last=Date.parse(p.at(-1)[0]),x=d=>L+(Date.parse(d)-first)/(last-first)*(W-L-R),y=v=>H-B-(v-min)/(max-min)*(H-T-B);const missing=new Set(s.missing_periods||[]);let segments=[],part=[],previous='';for(const point of p){if(previous&&[...missing].some(d=>d>previous&&d<point[0])){if(part.length)segments.push(part);part=[];}part.push(point);previous=point[0];}if(part.length)segments.push(part);return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(s.id)} historical observations from ${esc(p[0][0])} to ${esc(p.at(-1)[0])}"><defs><linearGradient id="fred-area" x2="0" y2="1"><stop stop-color="#128574" stop-opacity=".25"/><stop offset="1" stop-color="#128574" stop-opacity=".02"/></linearGradient></defs>${[0,.25,.5,.75,1].map(f=>{const v=min+(max-min)*f;return `<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="#dce6ea"/><text x="${L-10}" y="${y(v)+4}" text-anchor="end">${v.toFixed(s.family==='fx'?4:2)}</text>`;}).join('')}${segments.map(a=>`<path d="M ${x(a[0][0])} ${H-B} L ${a.map(p=>x(p[0])+' '+y(p[1])).join(' L ')} L ${x(a.at(-1)[0])} ${H-B} Z" fill="url(#fred-area)"/><polyline points="${a.map(p=>x(p[0])+','+y(p[1])).join(' ')}" fill="none" stroke="#08766a" stroke-width="2.5"/>`).join('')}<text x="${L}" y="${H-8}">${p[0][0]}</text><text x="${W-R}" y="${H-8}" text-anchor="end">${p.at(-1)[0]}</text></svg>`;}
if(typeof module!=='undefined')module.exports={validate,selected,csv,chart};
if(!root.document)return;
const $=id=>document.getElementById(id);let data=null,requestId=0;
function render(){if(!data)return;const s=data.series.find(s=>s.id===$('series').value);if(!s)return;const end=$('end').value||s.latest_observation,start=$('start').value||'1995-01-01';$('history').innerHTML=`<h2>${esc(s.id)} · ${esc(s.unit)}</h2><p class="fine">Latest observation ${esc(s.latest_observation)} · retrieved ${esc(data.retrieved_at)}${s.derived?' · '+esc(s.formula):''}</p>${chart(s,start,end)}<p class="fine">${esc(s.basis)}. Missing source observations remain gaps.</p><p>${(s.source_urls||[s.source_url]).map(u=>`<a href="${esc(u)}">${esc(u.split('/').at(-1))} ↗</a>`).join(' · ')}</p>`;$('download').disabled=!selected(s,start,end).length;}
async function load(event){
 const id=++requestId;
 const button=$('reload');
 const frequency=$('frequency').value;
 button.disabled=true;
 try{
  let next,status;
  if(frequency==='weekly'){
   const parts=await Promise.all(['fx','yields'].map(family=>FredWeekly.load(family,event?.type==='click')));
   next={series:parts.flatMap(p=>p.series),retrieved_at:parts.map(p=>p.data.retrieved_at).sort().at(-1),frequency};
  }else{
   const read=async path=>{
    const response=await fetch(path,{cache:'no-cache',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error('Feed unavailable');
    return response.json();
   };
   const results=await Promise.all([read('data/fred-daily.json'),read('data/fred-daily-status.json').catch(()=>null)]);
   next={...validate(results[0]),frequency};
   status=results[1];
  }
  if(id!==requestId)return;
  const choice=$('series').value;
  const changed=data?.frequency!==frequency;
  data=next;
  const ids=new Set(data.series.map(s=>s.id));
  $('series').innerHTML=[...FX.filter(id=>ids.has(id)),...[...ids].filter(id=>!FX.includes(id))]
    .map(id=>`<option>${esc(id)}</option>`).join('');
  if(ids.has(choice))$('series').value=choice;
  if(changed||!$('end').value)$('end').value=data.series.map(s=>s.latest_observation).sort().at(-1);
  if(changed&&frequency==='weekly')$('start').value=data.series.map(s=>s.points[0][0]).sort()[0];
  $('status').textContent=(status?.status==='failed'?'Latest provider request failed. Saved data is shown. ':'')+
    (frequency==='weekly'?'Friday-ending weeks. Dates show actual observations. ':'Daily observations. ')+
    'FX through '+data.series.find(s=>s.id==='USD/SGD').latest_observation+
    '. US yields through '+data.series.find(s=>s.id==='UST 10Y').latest_observation+'.';
  $('latest').innerHTML=data.series.map(s=>{
   const sources=s.source_url?[s.source_url]:s.source_urls;
   const value=s.points.at(-1)[1].toLocaleString('en-US',{maximumFractionDigits:s.family==='fx'?6:3});
   return `<tr><td>${esc(s.id)}</td><td>${value}</td><td>${esc(s.latest_observation)}</td><td>${esc(s.unit)} · <a href="${esc(sources[0])}">${esc(s.derived?s.formula:s.provider_series)}</a></td></tr>`;
  }).join('');
  render();
 }catch{
  if(id!==requestId)return;
  if(data)$('frequency').value=data.frequency;
  $('status').textContent='Published feed could not be reloaded. '+(data?'The last loaded observations are shown.':'No observations are available.');
 }finally{
  if(id===requestId)button.disabled=false;
 }
}
$('frequency').addEventListener('change',load);
for(const id of ['series','start','end'])$(id).addEventListener('change',render);$('reload').addEventListener('click',load);$('download').addEventListener('click',()=>{const s=data?.series.find(s=>s.id===$('series').value);if(!s)return;const blob=new Blob([csv(s,$('start').value||'1995-01-01',$('end').value||s.latest_observation,data.retrieved_at)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=s.id.replace(/\W/g,'-')+'-history.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});load();
})(typeof window!=='undefined'?window:globalThis);
