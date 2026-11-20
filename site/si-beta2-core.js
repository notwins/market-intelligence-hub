/* Private, browser-local SI drafts. Price levels are illustrations, never a payoff engine. */
(function(root){'use strict';
const W=800,H=1132,navy='#122b43',blue='#3879ad',muted='#526477',border='#ccd6df';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>v===''||v===null||v===undefined?null:Number.isFinite(Number(v))?Number(v):null;
const fmt=(v,d=2)=>num(v)===null?'Not supplied':Number(v).toLocaleString('en-US',{maximumFractionDigits:d});
const validMoa=v=>Number.isFinite(v)&&v>=0&&v<=100;
const pct=v=>num(v)===null?'Not supplied':fmt(v,4)+'%';
const clean=(v,n=160)=>String(v??'').trim().slice(0,n);
function symbol(v){v=clean(v,30).toUpperCase();if(/^\d{1,4}\s+HK$/.test(v))return v.split(/\s/)[0].padStart(4,'0')+'.HK';return v.replace(/\s+(?:UQ|UN|US)$/,'');}
function blank(){return {id:'',shares:[],ko:null,ki:null,strike:null,step:null,months:null,coupon:null,currency:'SGD',tenorUnit:'months',couponBasis:'per_annum',kiType:'European at maturity',firstStep:2,date:'',issuer:'',notes:'',source:null};}
function fromReference(r){return {...blank(),shares:r.shares.map(t=>({symbol:t,fixing:null,name:'',description:''})),ko:r.ko_pct,ki:r.ki_pct,strike:r.strike_pct,months:r.tenor_source_value,coupon:r.coupon_pct,currency:r.currency,tenorUnit:'months',couponBasis:r.coupon_basis||'unconfirmed',kiType:'Unconfirmed',source:{reference:r.reference,date:r.source_date||'',rounded:true,review:!!r.additional_review},date:''};}
function validate(p){const issues=[];if(!p||typeof p!=='object')return ['Invalid page'];if(!Array.isArray(p.shares)||p.shares.length<1||p.shares.length>4)issues.push('Enter one to four shares.');
 const shares=p.shares||[];if(shares.some(s=>!s||!/^[-A-Z0-9.^ ]{1,30}$/.test(s.symbol||'')))issues.push('Use a valid ticker for each share.');if(new Set(shares.map(s=>symbol(s.symbol))).size!==shares.length)issues.push('Each share should appear once.');
 if(shares.some(s=>s?.moaPct!=null&&!validMoa(s.moaPct)))issues.push('Each MOA margin must be blank or between 0% and 100%.');
 for(const [key,label,lo,hi] of [['ko','KO',0.01,200],['ki','KI',0.01,200],['strike','Strike',0.01,200],['coupon','Coupon',0,100],['months','Months / tenor',1,120]])if(num(p[key])===null||p[key]<lo||p[key]>hi)issues.push(`${label} must be between ${lo} and ${hi}.`);
 if(num(p.months)!==null&&!Number.isInteger(Number(p.months)))issues.push('Enter a whole number of months / tenor units.');
 if(p.step!==null&&(num(p.step)===null||p.step<0||p.step>100))issues.push('Step-down must be blank or between 0 and 100 percentage points.');
 if(!Number.isInteger(p.firstStep)||p.firstStep<1||p.firstStep>120)issues.push('First step-down month must be between 1 and 120.');
 if(finalKO(p)!==null&&finalKO(p)<=0)issues.push('The step-down makes the final KO zero or negative.');
 if(shares.some(s=>s.fixing!==null&&(num(s.fixing)===null||s.fixing<=0)))issues.push('Manual reference prices must be positive.');
 if(!['months','unconfirmed'].includes(p.tenorUnit)||!['per_annum','per_month','total','unconfirmed'].includes(p.couponBasis))issues.push('Select a supported tenor unit and coupon basis.');
 if(!/^[A-Z]{3}$/.test(p.currency||''))issues.push('Select a currency.');
 if(p.date&&(!/^\d{4}-\d{2}-\d{2}$/.test(p.date)||!Number.isFinite(Date.parse(p.date))||new Date(p.date).toISOString().slice(0,10)!==p.date))issues.push('Choose a valid reference date.');return issues;}
function finalKO(p){return p.tenorUnit==='months'&&[p.ko,p.step,p.months,p.firstStep].every(v=>num(v)!==null)?p.ko-p.step*Math.max(0,p.months-p.firstStep+1):null;}
function levels(p,reference){return Object.fromEntries(['ko','ki','strike'].map(k=>[k,num(reference)!==null&&num(p[k])!==null?reference*p[k]/100:null]));}
function reference(p,share,data){if(num(share.fixing)!==null)return {value:Number(share.fixing),date:p.date||'Date not supplied',basis:'Manual reference'};if(p.date){const v=data?.daily?.find(x=>x[0]===p.date);return {value:v?.[1]??null,date:p.date,basis:'Exact daily close'};}return {value:data?.quote?.close??null,date:data?.quote?.date||'',basis:'Latest saved close'};}
function wrap(value,max){const words=clean(value,1800).split(/\s+/),lines=[];let line='';for(let word of words){while(word.length>max){if(line){lines.push(line);line='';}lines.push(word.slice(0,max));word=word.slice(max);}if((line+' '+word).trim().length>max){lines.push(line);line=word;}else line=(line+' '+word).trim();}if(line)lines.push(line);return lines;}
function axisTicks(values){let lo=Math.min(...values),hi=Math.max(...values);const span=hi-lo||Math.max(Math.abs(hi)*.1,1),raw=span/3.6,power=10**Math.floor(Math.log10(raw));let step=[1,2,2.5,5,10].map(n=>n*power).find(n=>n>=raw)||10*power;for(let n=0;n<20;n++){const low=Math.floor((lo-span*.025)/step)*step;if(low+4*step>=hi+span*.025)return Array.from({length:5},(_,i)=>Number((low+i*step).toPrecision(12)));step=step===power?2*power:step*1.25;step=[1,2,2.5,5,10,20,25,50,100].map(n=>n*power).find(n=>n>=step)||step;}return Array.from({length:5},(_,i)=>lo+i*span/4);}
const monthLabel=ms=>new Date(ms).toLocaleDateString('en-US',{month:'short',year:'numeric',timeZone:'UTC'}).replace(' ','-');
// Labels live in a separate rail; only their leaders enter that rail.
// Spread coincident barriers vertically without moving the actual barrier levels.
function barrierLabels(positions,top,bottom,gap=11){const rows=positions.map((target,index)=>({target,index,y:Math.max(top,Math.min(bottom,target))})).sort((a,b)=>a.y-b.y||a.index-b.index);for(let i=1;i<rows.length;i++)rows[i].y=Math.max(rows[i].y,rows[i-1].y+gap);if(rows.length&&rows.at(-1).y>bottom){rows.at(-1).y=bottom;for(let i=rows.length-2;i>=0;i--)rows[i].y=Math.min(rows[i].y,rows[i+1].y-gap);}return rows.sort((a,b)=>a.index-b.index);}
function segmentHitsBox(a,b,box){let enter=0,leave=1;for(let axis=0;axis<2;axis++){const delta=b[axis]-a[axis],lo=axis?box.top:box.left,hi=axis?box.bottom:box.right;if(!delta){if(a[axis]<lo||a[axis]>hi)return false;continue;}let t0=(lo-a[axis])/delta,t1=(hi-a[axis])/delta;if(t0>t1)[t0,t1]=[t1,t0];enter=Math.max(enter,t0);leave=Math.min(leave,t1);if(enter>leave)return false;}return true;}
function priceHitsBox(points,box){return points.some((point,i)=>i>0&&segmentHitsBox(points[i-1],point,box));}
function inlineBarrierLabels(bars,points,left,right,overlays=[]){const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top,rows=bars.map(({label,y},index)=>{const width=label.length*4.1+10,half=width/2,preferred=left+30+index*(right-left-60)/Math.max(1,bars.length-1),options=[];for(let x=left+half+4;x<=right-half-4;x+=3){const box={left:x-half-4,right:x+half+4,top:y-9,bottom:y+9};if(!priceHitsBox(points,box)&&!overlays.some(path=>priceHitsBox(path,box)))options.push({inline:true,x,y,width,box});}options.sort((a,b)=>Math.abs(a.x-preferred)-Math.abs(b.x-preferred));return {index,y,width,options};}).sort((a,b)=>a.options.length-b.options.length||b.width-a.width),result=Array(bars.length);let attempts=0;
 // Fit the most constrained words first and backtrack to leave room for the others.
 function fit(i,placed){if(i===rows.length)return true;if(++attempts>20000)return false;const row=rows[i];for(const option of row.options){if(placed.some(p=>overlap(option.box,p.box)))continue;result[row.index]=option;if(fit(i+1,[...placed,option]))return true;}return false;}
 if(fit(0,[]))return result;const placed=[];for(const row of rows){const option=row.options.find(o=>!placed.some(p=>overlap(o.box,p.box)));result[row.index]=option||{inline:false,y:row.y,width:row.width};if(option)placed.push(option);}return result;}
const overlayKeys=['pe','pb','target'];
const overlayColors={pe:'#006c61',pb:'#a04f13',target:'#744299',archive:'#586779'};
const overlayNames={pe:'Fwd P/E',pb:'Fwd P/B',target:'Morningstar fair value',archive:'BOS fair value / target'};
const ms=date=>Date.parse(date+'T12:00:00Z');
const validDay=date=>/^\d{4}-\d{2}-\d{2}$/.test(date||'')&&Number.isFinite(ms(date))&&new Date(ms(date)).toISOString().slice(0,10)===date;
function chartOptions(value){
 return {years:Number.isInteger(value?.years)&&value.years>=1&&value.years<=8?value.years:1,
  pe:value?.pe===true,pb:value?.pb===true,target:value?.target===true};
}
function yearsBefore(date,years){
 const d=new Date(ms(date)),year=d.getUTCFullYear()-years,month=d.getUTCMonth(),day=d.getUTCDate();
 return new Date(Date.UTC(year,month,Math.min(day,new Date(Date.UTC(year,month+1,0)).getUTCDate()))).toISOString().slice(0,10);
}
function valuationPoints(listing,history,editions){
 const series={pe:new Map(),pb:new Map(),target:new Map(),archive:new Map()};
 const pos=v=>Number.isFinite(v)&&v>0;
 const set=(key,date,value,rating,reference)=>{if(validDay(date)&&pos(value))series[key].set(date,{date,value,rating,reference});};
 const record=history?.record;
 if(record?.bbTicker===listing.instrumentId&&record.currency===listing.currency&&record.compareEligible!==false&&record.currentEligible!==false){
  const archived=key=>(history.metrics?.[key]||[]).filter(p=>p.currency===listing.currency&&/^bos:/.test(p.sourceId||''));
  for(const key of ['pe','pb'])for(const p of archived(key))set(key,p.reportDate,p.value);
  const ratings=new Map(archived('rating').map(p=>[p.reportDate,p.value]));
  const sourceKey=p=>p.sourceId+'|'+p.reportDate+'|'+p.date;
  const references=new Map(archived('sourcePrice').map(p=>[sourceKey(p),{date:p.date,value:p.value}]));
  for(const p of archived('fairValueOrTarget'))set('archive',p.reportDate,p.value,ratings.get(p.reportDate),references.get(sourceKey(p)));
 }
 for(const {row,reportDate} of editions){
  if(row?.instrumentId!==listing.instrumentId||row.currency!==listing.currency)continue;
  set('pe',reportDate,row.pe);set('pb',reportDate,row.pb);
  if(row.researchProvider==='Morningstar'&&row.fairValueOrTargetKind==='fair_value'){
   set('target',reportDate,row.fairValueOrTargetPrice,row.rating);
   if(series.target.has(reportDate))series.archive.delete(reportDate);
  }else set('archive',reportDate,row.fairValueOrTargetPrice,row.rating,{date:row.priceAsOf,value:row.price});
 }
 return Object.fromEntries(Object.entries(series).map(([key,points])=>[key,[...points.values()].sort((a,b)=>a.date.localeCompare(b.date))]));
}
function chartWindow(d,chart){
 const selected=[...overlayKeys.filter(key=>chart[key]),...(chart.target?['archive']:[])];
 const all=(d.points||[]).filter(p=>Array.isArray(p)&&validDay(p[0])&&Number.isFinite(p[1])&&p[1]>0);
 const imported=chart.target?d.bosCalls||[]:[];
 const overlays={...d.overlays};
 if(chart.target&&imported.length){
  const archival=new Map((overlays.archive||[]).map(p=>[p.date,p]));
  const attributed=new Set((overlays.target||[]).map(p=>p.date));
  for(const p of imported)if(Number.isFinite(p.value)&&!attributed.has(p.date))archival.set(p.date,p);
  overlays.archive=[...archival.values()].sort((a,b)=>a.date.localeCompare(b.date));
 }
 const end=[d.quote?.date,all.at(-1)?.[0],imported.at(-1)?.date,...selected.map(key=>overlays[key]?.at(-1)?.date)].filter(validDay).sort().at(-1);
 const from=end?yearsBefore(end,chart.years):null;
 const inWindow=p=>p.date>=from&&p.date<=end;
 const series=Object.fromEntries(selected.map(key=>[key,(overlays[key]||[]).filter(inWindow)]));
 const byDate=new Map();
 if(chart.target)for(const point of [...(series.archive||[]),...imported,...(series.target||[])]){
  if(inWindow(point)&&/^(Buy|Hold|Sell)$/i.test(point.rating||''))byDate.set(point.date,point);
 }
 const calls=[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
 let incompatibleArchive=0;
 if(series.archive?.length){
  const closes=new Map(d.comparisonPrices||all),count=series.archive.length;
  // Compare same-date source closes before sharing a price scale with older per-share values.
  series.archive=series.archive.filter(({reference})=>{
   const close=closes.get(reference?.date),source=reference?.value;
   return Number.isFinite(close)&&Number.isFinite(source)&&source>0&&Math.abs(close/source-1)<=.05;
  });
  incompatibleArchive=count-series.archive.length;
 }
 return {end,from,selected,prices:all.filter(p=>p[0]>=from&&p[0]<=end),series,calls,incompatibleArchive};
}
function observationRuns(points){
 const runs=[];
 for(const p of points){
  const last=runs.at(-1);
  if(!last||ms(p.date)-ms(last.at(-1).date)>50*86400000)runs.push([p]);else last.push(p);
 }
 return runs;
}
function bosReportUrl(raw){
 try{
  const url=new URL(raw);
  return url.origin==='https://productgroup.bankofsingapore.com'&&!url.username&&!url.password&&/\.pdf$/i.test(url.pathname)?url.href:'';
 }catch{return '';}
}
function bosResearch(row){
 const rating=clean(row?.rating,12).toUpperCase();
 const call=['BUY','SELL','HOLD'].includes(rating)?rating:'';
 const value=row?.fairValueOrTargetPrice;
 const target=Number.isFinite(value)&&value>0
  ? [row.fairValueOrTargetKind==='fair_value'||row.researchProvider==='Morningstar'?'Fair value':row.fairValueOrTargetKind==='target_price'?'Target price':'Fair value / target',clean(row.currency,4),fmt(value,4)].join(' ')
  : '';
 return call||target?{call,target,provider:clean(row.researchProvider,45),url:call?bosReportUrl(row.researchReportUrl):''}:null;
}
function svg(p,enrichment={},page=1,total=1,{showWatermarks=true,links,chart:options}={}){const chart=chartOptions(options),four=p.shares.length===4,out=[];const rect=(x,y,w,h,fill,stroke=border)=>out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}"/>`);const text=(x,y,t,size=10,color=navy,bold=false,anchor='start')=>out.push(`<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${size}" fill="${color}" font-weight="${bold?700:400}" text-anchor="${anchor}">${escape(t)}</text>`);const line=(x,y,x2,y2,color=border,dash='')=>out.push(`<line x1="${x}" y1="${y}" x2="${x2}" y2="${y2}" stroke="${color}" ${dash?`stroke-dasharray="${dash}"`:''}/>`);const paragraph=(x,y,value,max,rows,size=10,color=muted)=>{const lines=wrap(value,max);lines.slice(0,rows).forEach((s,i)=>text(x,y+i*(size+3),s+(i===rows-1&&lines.length>rows?'…':''),size,color));};
 out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="group" aria-label="Structured investment one-pager for ${escape(p.shares.map(s=>s.symbol).join(', '))}">`);rect(0,0,W,H,'#fff','#fff');
 text(28,four?31:39,'FOR REFERENCE ONLY',17,navy,true);text(772,four?30:38,'MARKET INTEL  /  SI BETA 2',11,muted,true,'end');
 text(28,four?45:58,'Indicative terms. Capital is at risk. Refer to the issuer’s final terms for conditions and observation rules.',9,muted);
 rect(28,four?54:74,744,four?26:32,navy,navy);text(42,four?72:96,'Structured investment',18,'#fff',true);text(758,four?71:95,`${page} / ${total}`,11,'#fff',true,'end');
 const fitted=(x,y,value,width,size=10,color=navy,bold=false,anchor='start')=>{const valueText=String(value??'');const estimated=valueText.length*size*.56;text(x,y,valueText,size,color,bold,anchor);if(estimated>width)out[out.length-1]=out.at(-1).replace('<text ',`<text textLength="${width}" lengthAdjust="spacingAndGlyphs" `);};
 fitted(28,four?98:126,p.shares.map(s=>s.symbol).join('  +  '),535,15,navy,true);text(772,four?97:125,p.source?`Based on ${p.source.reference}`:'Manually entered terms',10,muted,false,'end');
 const left=28,top=four?107:139,rowHeight=four?15:19,rowText=four?11:13,tableWidth=365,columns=[left,left+105,left+176,left+239,left+302,left+365];
 rect(left,top,tableWidth,rowHeight,blue,blue);['Underlying','Reference','KO','KI','Strike'].forEach((v,i)=>text(columns[i]+5,top+rowText,v,9,'#fff',true));
 const count=Math.max(p.shares.length,2);for(let i=0;i<count;i++){const y=top+(i+1)*rowHeight,s=p.shares[i];rect(left,y,tableWidth,rowHeight,i%2?'#f5f8fb':'#fff');if(!s)continue;const r=reference(p,s,enrichment[s.symbol]),l=levels(p,r.value);[s.symbol,fmt(r.value,4),fmt(l.ko,4),fmt(l.ki,4),fmt(l.strike,4)].forEach((v,j)=>fitted(columns[j]+5,y+rowText,v==='Not supplied'?'—':v,columns[j+1]-columns[j]-10,9,j===2?'#497c31':j===3?'#ae3b49':j===4?'#7652a3':navy,j===0));}
 const basis={per_annum:'PA',per_month:' per month',total:' total',unconfirmed:' (basis unconfirmed)'}[p.couponBasis];
 const pairs=[['Tenor',`${fmt(p.months)} months`,'Coupon',`${pct(p.coupon)}${basis}`],['Currency',p.currency,'Initial KO',pct(p.ko)],['KI',pct(p.ki),'Strike',pct(p.strike)],['Monthly step',num(p.step)===null?'Not supplied':fmt(p.step,4)+'%','Final KO',finalKO(p)===null?'Not calculated':pct(finalKO(p))]];
 pairs.forEach((row,i)=>{const y=top+i*rowHeight;rect(408,y,364,rowHeight,i%2?'#fff':'#f5f8fb');text(414,y+rowText,row[0]+':',9,muted);fitted(487,y+rowText,row[1],96,9,navy,true);text(590,y+rowText,row[2]+':',9,muted);fitted(655,y+rowText,row[3],111,9,navy,true);});
 fitted(408,four?176:228,`KI: ${p.kiType||'Not supplied'}${p.issuer?' · Issuer: '+p.issuer:''}`,364,8,muted);
 const referenceNote=p.date?`Reference: ${p.date}; manual prices override closes.`:'Reference: saved close or manual price. Levels = reference × %.';
 fitted(28,four?193:244,referenceNote,365,8,muted);
 const stepNote=p.step!==null?`Monthly step-down: ${fmt(p.step,4)} percentage points from month ${p.firstStep}; final KO ${pct(finalKO(p))}.`:'Step-down not supplied; initial KO shown.';
 fitted(four?408:28,four?193:257,stepNote,four?364:370,8,muted);
 const levelsLegend=[['Price',blue,''],[four?'KO':'Initial KO','#699645','7 3'],['KI','#b94a57','3 3'],['Strike','#8261a8','9 3 2 3'],...(p.step>0?[['Final KO','#c07821','2 3']]:[])];
 const seriesLegend=overlayKeys.filter(key=>chart[key]).flatMap(key=>key==='target'?['target','archive']:[key]);
 const hasOverlays=seriesLegend.length>0;
 const ratingLegend='B/H/S = Buy/Hold/Sell · archive values require matching share basis';
 if(four){
  const short={pe:'P/E',pb:'P/B',target:'MS fair value',archive:'BOS archive'};
  let x=28;
  out.push('<g class="si-compact-legend">');
  for(const [label,color,dash] of [...levelsLegend,...seriesLegend.map(key=>[short[key],overlayColors[key],key==='archive'?'2 2':key==='pb'?'4 2':''])]){
   line(x,204,x+11,204,color,dash);
   text(x+15,207,label,7.5,muted);
   x+=24+label.length*4.4;
  }
  if(chart.target)fitted(x,207,ratingLegend,772-x,7.5,muted);
  out.push('</g>');
 }else{
  levelsLegend.forEach(([label,color,dash],j)=>{line(410+j*73,255,423+j*73,255,color,dash);text(427+j*73,258,label,7.5,muted);});
  if(hasOverlays){
   let x=31;
   for(const key of seriesLegend){
    line(x,272,x+13,272,overlayColors[key],key==='archive'?'2 2':'');
    text(x+17,275,overlayNames[key],8,muted);
    x+=key==='target'||key==='archive'?133:74;
   }
   if(chart.target)text(x,275,ratingLegend,8,muted);
  }
 }
 const start=four?216:hasOverlays?287:270,foot=four?1037:1010,available=(four?foot-8:998)-start,gap=four?7:8,block=(available-gap*(p.shares.length-1))/Math.max(1,p.shares.length);
 const marginSources=new Set();
 p.shares.forEach((s,i)=>{const d=enrichment[s.symbol]||{},y=start+i*(block+gap),r=reference(p,s,d),ls=levels(p,r.value),name=s.name||d.name||s.symbol;
 rect(28,y,744,block,'#fff');rect(28,y,744,23,navy,navy);fitted(37,y+16,clean(name,69),445,11,'#fff',true);fitted(762,y+16,s.symbol,110,10,'#fff',false,'end');
 const margin=validMoa(s.moaPct)?s.moaPct:d.moaPct;
 if(validMoa(margin))marginSources.add(validMoa(s.moaPct)?'manual entry':d.moaSource||'private lookup');
 fitted(635,y+16,'MOA margin '+(validMoa(margin)?pct(margin):'—'),132,9,'#fff',true,'end');
 const {end,from,selected,series,prices:pts,calls:ratingHistory,incompatibleArchive}=chartWindow(d,chart);
 const chartX=36,chartY=y+29,plotLeft=chartX+35,plotTop=chartY+13,plotBottom=y+block-(ratingHistory.length?46:hasOverlays?32:22);
 const ratios=[...(series.pe||[]),...(series.pb||[])].map(p=>p.value);
 const plotRight=ratios.length?417:427;
 text(chartX+4,chartY+4,`${chart.years}-year price history${d.currency?' · '+d.currency:''}`,8,navy,true);
 if(pts.length>1){
  const fk=finalKO(p),bars=[['KO',ls.ko,'#699645','7 3'],['KI',ls.ki,'#b94a57','3 3'],['Strike',ls.strike,'#8261a8','9 3 2 3'],...(p.step>0&&fk!==null?[['Final KO',num(r.value)===null?null:r.value*fk/100,'#c07821','2 3']]:[])].filter(x=>x[1]!==null);
  const values=[...pts.map(p=>p[1]),...bars.map(b=>b[1]),...(series.target||[]).map(p=>p.value),...(series.archive||[]).map(p=>p.value)];
  let ticks=axisTicks(values);
  if(ticks[0]<0){
   const raw=Math.max(...values)/4,power=10**Math.floor(Math.log10(raw));
   const step=[1,2,2.5,5,10].map(n=>n*power).find(n=>n>=raw);
   ticks=Array.from({length:5},(_,i)=>Number((i*step).toPrecision(12)));
  }
  const low=ticks[0],high=ticks[4],t0=ms(from),t1=ms(end);
  const px=date=>plotLeft+(ms(date)-t0)/(t1-t0)*(plotRight-plotLeft);
  const py=v=>plotBottom-(v-low)/(high-low)*(plotBottom-plotTop);
  const pricePoints=pts.map(([date,value])=>[px(date),py(value)]),pointList=points=>points.map(p=>p.map(n=>n.toFixed(2)).join(',')).join(' ');
  if(hasOverlays)out.push(`<polygon class="si-price-area" fill="#dceaf7" points="${pricePoints[0][0]},${plotBottom} ${pointList(pricePoints)} ${pricePoints.at(-1)[0]},${plotBottom}"/>`);
  ticks.forEach(v=>{const yy=py(v);line(plotLeft,yy,plotRight,yy,'#dde3e9');text(plotLeft-5,yy+3,fmt(v,6),7.5,muted,false,'end');});
  for(let j=0;j<5;j++){const epoch=t0+(t1-t0)*j/4,xx=plotLeft+(plotRight-plotLeft)*j/4;line(xx,plotTop,xx,plotBottom,'#edf0f3');text(xx,y+block-(hasOverlays?19:9),monthLabel(epoch),7.5,muted,false,j===0?'start':j===4?'end':'middle');}
  let ry=py;
  if(ratios.length){
   const rt=axisTicks(ratios),base=Math.max(0,rt[0]),top=rt.at(-1);
   ry=v=>plotBottom-(v-base)/(top-base)*(plotBottom-plotTop);
   line(plotRight,plotTop,plotRight,plotBottom,'#9caec0');
   text(plotRight+3,chartY+4,'Ratios ×',7,muted,true);
   rt.filter(v=>v>=base).forEach(v=>{line(plotRight,ry(v),plotRight+3,ry(v),'#9caec0');text(plotRight+5,ry(v)+2,fmt(v,4),6.5,muted);});
  }
  const overlayPaths=[];
  for(const key of selected){
   const scale=key==='pe'||key==='pb'?ry:py,points=series[key],color=overlayColors[key];
   const xy=p=>[px(p.date),scale(p.value)];
   for(const run of observationRuns(points)){
    const coords=run.map(xy);if(coords.length<2)continue;
    overlayPaths.push(coords);
    out.push(`<polyline class="si-overlay si-overlay-${key}" fill="none" stroke="${color}" stroke-width="1.2" ${key==='pb'?'stroke-dasharray="4 2"':key==='archive'?'stroke-dasharray="2 2"':''} points="${pointList(coords)}"/>`);
   }
   for(const point of points){
    const [xx,yy]=xy(point),rating=/^(buy|hold|sell)$/i.test(point.rating||'')?point.rating.toUpperCase():'';
    out.push(`<circle class="si-observation si-observation-${key}" cx="${xx.toFixed(2)}" cy="${yy.toFixed(2)}" r="${key==='target'||key==='archive'?2.2:1.35}" fill="${key==='archive'?'#fff':color}" stroke="${color}"><title>${escape(`${overlayNames[key]} · ${point.date} · ${fmt(point.value,4)}${rating?' · '+rating:''}`)}</title></circle>`);

   }
  }
  const labels=inlineBarrierLabels(bars.map(b=>({label:b[0],y:py(b[1])})),pricePoints,plotLeft,plotRight,overlayPaths);
  const fallback=barrierLabels(labels.filter(l=>!l.inline).map(l=>l.y),plotTop+5,plotBottom-5),rail=ratios.length?29:1;
  let fallbackIndex=0;
  out.push(`<g class="si-barriers" data-plot-right="${plotRight}">`);
  bars.forEach(([label,v,c,dash],j)=>{const yy=py(v),placement=labels[j];line(plotLeft,yy,plotRight,yy,c,dash);if(placement.inline){out.push(`<g class="si-inline-barrier-label" data-clearance="4">`);rect(placement.x-placement.width/2,yy-5,placement.width,10,'#fff','#fff');text(placement.x,yy+2.5,label,7,c,true,'middle');out.push('</g>');}else{const labelY=fallback[fallbackIndex++].y;out.push(`<path d="M ${plotRight+rail} ${yy} L ${plotRight+rail+4} ${yy} L ${plotRight+rail+8} ${labelY} L ${plotRight+rail+11} ${labelY}" fill="none" stroke="${c}" stroke-width="0.7"/>`);text(plotRight+rail+14,labelY+2.5,label,7,c,true);}});
  out.push('</g>');
  out.push(`<polyline class="si-price-line" fill="none" stroke="${blue}" stroke-width="1.5" points="${pointList(pricePoints)}"/>`);
  if(ratingHistory.length){
   const tracks={B:[plotBottom+5,'#006955'],H:[plotBottom+10,'#536d8c'],S:[plotBottom+15,'#a63445']};
   out.push('<g class="si-call-history" aria-label="BOS Buy, Hold and Sell observations">');
   for(const [key,[yy,color]] of Object.entries(tracks)){
    line(plotLeft,yy,plotRight,yy,'#e5ebf0');
    text(plotLeft-5,yy+2,key,6.5,color,true,'end');
   }
   for(const point of ratingHistory){
    const [yy,color]=tracks[point.rating[0].toUpperCase()];
    const value=Number.isFinite(point.value)?` · published value ${fmt(point.value,4)} ${d.currency||''}`:'';
    out.push(`<circle class="si-bos-call" cx="${px(point.date).toFixed(2)}" cy="${yy}" r="1.7" fill="${color}"><title>${escape(`BOS · ${point.date} · ${point.rating.toUpperCase()}${value}`)}</title></circle>`);
   }
   out.push('</g>');
  }
 }else{rect(plotLeft,plotTop,plotRight-plotLeft,Math.max(10,plotBottom-plotTop),'#f5f8fb');text((plotLeft+plotRight)/2,(plotTop+plotBottom)/2,'Price history unavailable',11,muted,false,'middle');}
 if(hasOverlays){
  const names={pe:'P/E',pb:'P/B',target:'Morningstar',archive:'BOS archive'};
  const coverage=selected.map(key=>`${names[key]}: ${series[key].length||'unavailable'}`);
  if(chart.target)coverage.push(`Calls: ${ratingHistory.length||'unavailable'}`);
  if(incompatibleArchive)coverage.push(`${incompatibleArchive} archive off scale`);
  fitted(chartX+4,y+block-6,'Observations · '+coverage.join(' · '),446,7.5,muted);
 }
 const rx=496,rw=266,small=p.shares.length>=3,description=s.description||d.description||'Company description not supplied. Add a short description in share details.';
 // Keep artwork behind the entire info panel and outside the price plot and label rail.
 if(showWatermarks && typeof d.logo==='string' && /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(d.logo)){
  out.push(`<image class="si-company-watermark" x="${rx}" y="${y+27}" width="${rw}" height="${block-31}" href="${d.logo}" preserveAspectRatio="xMidYMid meet" opacity="0.12" aria-hidden="true"/>`);
 }
 // Show the complete entered description, including on four-share pages.
 const descriptionLines=wrap(description.length> (small?340:500)?description.slice(0,small?337:497).replace(/\s+\S*$/,'')+'…':description,small?60:49),descriptionHeight=small?65:90,descriptionSize=Math.min(small?8.5:10,descriptionHeight/descriptionLines.length-1.5);
 descriptionLines.slice(0,small?6:9).forEach((value,j)=>fitted(rx,y+37+j*(descriptionSize+1.5),value+(j===(small?5:8)&&descriptionLines.length>(small?6:9)?"…":""),rw,Math.max(7.5,descriptionSize),muted));
 const research=bosResearch(d.metrics),compact=small&&!!research;
 const my=y+(compact?97:small?105:135),metrics=[['Historical close',d.quote?`${fmt(d.quote.close,4)} ${d.currency||''}`:'Unavailable'],['Observation date',d.quote?.date||'Unavailable'],['Reference basis',r.basis],['Reference price',num(r.value)===null?'Unavailable':fmt(r.value,4)],['Shown high / low',pts.length?`${fmt(Math.max(...pts.map(x=>x[1])))} / ${fmt(Math.min(...pts.map(x=>x[1])))}`:'Unavailable'],['Forward P/E',fmt(d.metrics?.pe)],['Forward P/B',fmt(d.metrics?.pb)],['Dividend yield',d.metrics?.dividendYieldPct==null?'Unavailable':pct(d.metrics.dividendYieldPct)],['Employees · snapshot',fmt(d.staticProfile?.employees,0)],['Incorporated',d.staticProfile?.yearIncorporated??'Not supplied']];
 metrics.forEach(([k,v],j)=>{const col=small?j%2:0,row=small?Math.floor(j/2):j,x=rx+col*137,yy=my+row*(compact?9:small?10:16);fitted(x,yy,k,small?64:125,small?7:9,muted);fitted(x+(small?129:rw),yy,v,small?62:130,small?7:9,navy,true,'end');});
 if(research){
  const yy=my+(compact?50:small?56:162),size=small?7.5:9,x=rx+(small?59:70);
  text(rx,yy,'BOS research',size,muted,true);
  if(research.url){
   const box={left:x-2,top:yy-size-2,right:x+33,bottom:yy+3};
   links?.push({...box,url:research.url});
   out.push(`<a class="si-bos-report" href="${escape(research.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escape(`Open ${name} research PDF, ${research.call}`)}"><rect x="${box.left}" y="${box.top}" width="${box.right-box.left}" height="${box.bottom-box.top}" fill="transparent"/>`);
   text(x,yy,research.call,size,'#174e88',true);
   line(x,yy+1,x+research.call.length*size*.64,yy+1,'#174e88');out.push('</a>');
  }else if(research.call){text(x,yy,research.call,size,navy,true);}
  const label=[research.provider,research.target].filter(Boolean).join(' · ');
  fitted(rx+rw,yy,label,rx+rw-x-39,size,navy,true,'end');
 }
 const source=`${d.provider||'Price feed unavailable'}${d.metricsDate?' · BOS metrics '+d.metricsDate:''}`;text(rx,y+block-17,clean(source,65),8,muted);if(d.sourceUrl)text(rx,y+block-6,clean(d.sourceUrl.replace(/^https:\/\//,''),78),7,muted);if(!small)paragraph(rx,y+block-(hasOverlays?40:48),d.metricsBasis||'Valuations unavailable. No estimates are inferred.',61,2,8,muted);
 });
 line(28,foot,772,foot);
 const footerCopy=[
  p.notes||'Indicative reference only. This sheet is not an issuer term sheet, offer or investment recommendation.',
  p.source?`Draft based on ${p.source.reference}, source date ${p.source.date||'not shown'}. Imported levels are rounded and photo-unverified; edited terms require verification. Coupon basis and tenor units remain as labelled.`:'Manual terms are user-entered and unverified. Confirm coupon basis, KO observations, step-down timing, KI conditions, settlement and issuer terms.',
  'Charts show source closes, not product returns. Barriers are illustrative; capital loss is possible. Company profiles are shortened excerpts from supplied Excel snapshot; observation date unavailable. Full descriptions are on share cards.',
 ];
 if(marginSources.size)footerCopy.push('MOA margin source · '+[...marginSources].join(' / '));
 if(four){
  let y=foot+12;
  for(const [i,copy] of footerCopy.entries()){
   const lines=wrap(copy,163);
   for(const lineText of lines){text(28,y,lineText,8,i===0?navy:muted);y+=10;}
   y+=3;
  }
 }else{
  [15,44,71,94].slice(0,footerCopy.length).forEach((offset,i)=>paragraph(28,foot+offset,footerCopy[i],i===0?140:155,2,i===0?9:8,i===0?navy:muted));
 }
 out.push('</svg>');return out.join('');}
async function pdfFromImages(images,PDFLib,linksByPage=[]){
 if(!images.length)throw Error('Create a page first.');
 const doc=await PDFLib.PDFDocument.create(),width=595.28,height=841.89;
 doc.setTitle('Structured investment one-pagers');doc.setProducer('Market Intel SI beta 2');
 for(const [index,bytes] of images.entries()){
  const img=await doc.embedPng(bytes),page=doc.addPage([width,height]);
  page.drawImage(img,{x:0,y:0,width,height});
  for(const {left,top,right,bottom,url} of linksByPage[index]||[]){
   const uri=bosReportUrl(url);
   if(!uri)continue;
   // The preview uses a top-left origin. PDF annotation coordinates start at the bottom left.
   const annotation=doc.context.obj({
    Type:'Annot',Subtype:'Link',Border:[0,0,0],
    Rect:[left/W*width,(H-bottom)/H*height,right/W*width,(H-top)/H*height],
    A:{Type:'Action',S:'URI',URI:PDFLib.PDFString.of(uri)},
   });
   page.node.addAnnot(doc.context.register(annotation));
  }
 }
 return doc.save();
}
const api={inlineBarrierLabels,priceHitsBox,segmentHitsBox,barrierLabels,axisTicks,monthLabel,blank,fromReference,validate,finalKO,levels,reference,symbol,svg,pdfFromImages,escape,fmt,pct,num,validMoa,chartOptions,chartWindow,valuationPoints,yearsBefore,overlayKeys,W,H};root.SIBetaCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
