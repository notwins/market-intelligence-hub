/* Private, browser-local SI drafts. Price levels are illustrations, never a payoff engine. */
(function(root){'use strict';
const W=800,H=1132,navy='#122b43',blue='#3879ad',muted='#526477',border='#ccd6df';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>v===''||v===null||v===undefined?null:Number.isFinite(Number(v))?Number(v):null;
const fmt=(v,d=2)=>num(v)===null?'Not supplied':Number(v).toLocaleString('en-US',{maximumFractionDigits:d});
const validMoa=v=>Number.isFinite(v)&&v>=0&&v<=100;
const pct=v=>num(v)===null?'Not supplied':fmt(v,4)+'%';
const clean=(v,n=160)=>String(v??'').trim().slice(0,n);
function moaListing(ticker,currency){
 const id=String(ticker||'').trim().toUpperCase().replace(/\s+EQUITY$/,'').replace(/\s+/g,' ').replace(/^0+(\d+ HK)$/,'$1');
 return /^[A-Z0-9.\/-]{1,16} [A-Z]{2}$/.test(id)&&/^[A-Z]{3}$/.test(currency||'')?id+'|'+currency:'';
}
function moaIsin(isin,currency){
 const id=String(isin||'').trim().toUpperCase();
 return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(id)&&/^[A-Z]{3}$/.test(currency||'')?id+'|'+currency:'';
}
function parseMoa(source){
 if(source?.version!==1||typeof source.source!=='string'||!source.source.trim()||source.source.length>80||
  !Array.isArray(source.records)||!source.records.length||source.records.length>10000)throw Error('Choose a valid private MOA file.');
 const rates=new Map(),byIsin=new Map();
 for(const record of source.records){
  const key=moaListing(record?.ticker,record?.currency);
  const isinKey=moaIsin(record?.isin,record?.currency);
  if(!key||rates.has(key)||!validMoa(record.moaPct)||(record?.isin!=null&&!isinKey))
   throw Error('The MOA file contains an invalid or duplicate listing.');
  const entry={rate:record.moaPct,isinKey};
  rates.set(key,entry);
  if(isinKey)byIsin.set(isinKey,byIsin.has(isinKey)?null:entry);
 }
 return {label:source.source.trim(),rates,byIsin};
}
function matchMoa(library,ticker,currency,isin){
 const key=moaListing(ticker,currency),isinKey=moaIsin(isin,currency);
 if(key){
  const entry=library.rates.get(key);
  return entry&&(!isinKey||!entry.isinKey||entry.isinKey===isinKey)?entry.rate:undefined;
 }
 return library.byIsin.get(isinKey)?.rate;
}
const fields=['reference','shares','source_date','currency','tenor_source_value','coupon_pct','strike_pct','ko_pct','ki_pct','additional_review'];
const quoteFields=['source_kind','tenor_unit','coupon_basis'];
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
function acceptable(d){
 if(!(d?.schema_version===1&&d.classification==='rounded_historical_reference'&&d.live_quotes===false&&d.source_verification==='photo_transcribed_unverified'&&d.tenor_unit==='unconfirmed'&&d.coupon_basis==='unconfirmed'&&d.rounding?.unit==='whole_percentage_point'&&d.rounding.strike==='up'&&d.rounding.ko==='up'&&d.rounding.ki==='up'&&d.rounding.coupon==='down'))return false;
 if(!Number.isInteger(d.record_count)||d.record_count<1||!Number.isInteger(d.additional_review_count)||d.additional_review_count<0||!Array.isArray(d.rows)||d.rows.length!==d.record_count||!Array.isArray(d.source_date_range)||d.source_date_range.length!==2||!d.source_date_range.every(validDate)||d.source_date_range[0]>d.source_date_range[1]||!validDate(d.source_capture_date)||d.source_capture_date<d.source_date_range[1])return false;
 if(!d.rows.every(r=>{
  if(!r||typeof r!=='object'||Array.isArray(r))return false;
  const quote=r.source_kind==='indicative_pricing',allowed=quote?[...fields,...quoteFields]:[...fields];
  if(Object.hasOwn(r,'product_type')){
   if(r.product_type!=='bonus_enhanced')return false;
   allowed.push('product_type');
  }
  return Object.keys(r).length===allowed.length&&allowed.every(k=>Object.hasOwn(r,k))&&(!quote||(r.tenor_unit==='months'&&r.coupon_basis==='per_annum'))&&/^SI-\d{3,}$/.test(r.reference)&&Array.isArray(r.shares)&&r.shares.length>=2&&r.shares.length<=4&&r.shares.every(t=>/^[A-Z0-9]{1,8}$/.test(t))&&((r.source_date===null&&quote&&r.additional_review===true)||(validDate(r.source_date)&&d.source_date_range[0]<=r.source_date&&r.source_date<=d.source_date_range[1]))&&/^[A-Z]{3}$/.test(r.currency)&&Number.isInteger(r.tenor_source_value)&&r.tenor_source_value>0&&['coupon_pct','strike_pct','ko_pct','ki_pct'].every(k=>Number.isInteger(r[k])&&r[k]>=0&&r[k]<=200)&&typeof r.additional_review==='boolean';
 }))return false;
 const references=new Set(d.rows.map(r=>r.reference)),steps=d.ko_step_down_pp;
 if(steps!==undefined){
  if(!steps||typeof steps!=='object'||Array.isArray(steps)||!Object.entries(steps).every(([reference,value])=>references.has(reference)&&Number.isFinite(value)&&value>=0&&value<=100))return false;
 }
 const dates=d.rows.map(r=>r.source_date).filter(Boolean).sort();
 return references.size===d.record_count&&d.rows.filter(r=>r.additional_review).length===d.additional_review_count&&dates[0]===d.source_date_range[0]&&dates.at(-1)===d.source_date_range[1];
}
let catalogue, pendingCatalogue;
function loadReferences(force=false){
 if(pendingCatalogue)return pendingCatalogue;
 if(catalogue&&!force)return Promise.resolve(catalogue);
 const controller=typeof AbortController==='function' ? new AbortController() : null;
 const timer=controller ? setTimeout(()=>controller.abort(),15000) : null;
 pendingCatalogue=root.fetch('data/si-pricing-reference.json',{cache:'no-store',signal:controller?.signal}).then(async response=>{
  if(!response.ok)throw Error('Historical SI reference could not load.');
  const data=await response.json();
  if(!acceptable(data))throw Error('Historical SI reference did not pass its data checks.');
  catalogue=data;
  return data;
 }).finally(()=>{if(timer!==null)clearTimeout(timer);pendingCatalogue=null;});
 return pendingCatalogue;
}
function isBonusEnhanced(row){
 return row?.product_type==='bonus_enhanced';
}
function referenceCouponLabel(row){
 if(isBonusEnhanced(row))return row.coupon_basis==='per_annum'?'Bonus-enhanced · p.a. (screen)':'Bonus-enhanced · basis unconfirmed';
 return row.coupon_basis==='per_annum'?'p.a. (screen)':'p.a. (assumed)';
}
function couponBand(coupon){
 if(coupon>12)return 'above-12';
 if(coupon>=10)return '10-12';
 if(coupon>=8)return '8-10';
 if(coupon>=6)return '6-8';
 return '';
}
const barrierRanges={strike:[60,70,80],ki:[50,60,70],ko:[95,100,105]};
function barrierBand(term,value){
 const bounds=barrierRanges[term];
 if(!bounds||!Number.isFinite(value))return '';
 const index=bounds.findIndex(max=>value<=max);
 return index<0?'high':['low','mid-low','mid-high'][index];
}
function referenceCouponBand(row){
 return isBonusEnhanced(row)&&row.coupon_basis!=='per_annum'?'':couponBand(row.coupon_pct);
}
function symbol(v){v=clean(v,30).toUpperCase();if(/^\d{1,4}\s+HK$/.test(v))return v.split(/\s/)[0].padStart(4,'0')+'.HK';return v.replace(/\s+(?:UQ|UN|US)$/,'');}
function blank(){return {id:'',shares:[],ko:null,ki:null,strike:null,step:null,months:null,coupon:null,currency:'SGD',tenorUnit:'months',couponBasis:'per_annum',kiType:'European at maturity',firstStep:2,date:'',issuer:'',notes:'',source:null};}
function fromReference(r,step=null){return {...blank(),step,shares:r.shares.map(t=>({symbol:t,fixing:null,name:'',description:''})),ko:r.ko_pct,ki:r.ki_pct,strike:r.strike_pct,months:r.tenor_source_value,coupon:r.coupon_pct,currency:r.currency,tenorUnit:'months',couponBasis:r.coupon_basis||'unconfirmed',kiType:'Unconfirmed',source:{reference:r.reference,date:r.source_date||'',rounded:true,review:!!r.additional_review,...(isBonusEnhanced(r)?{bonusEnhanced:true}:{})},date:''};}
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
function axisScale(values,{wholeTicks=false}={}){
 const min=Math.min(...values),max=Math.max(...values);
 const spread=max-min;
 const padding=spread?Math.max(spread*.035,max*1e-12):max*.05||.05;
 const low=Math.max(0,min-padding),high=max+padding;
 // Choose rounded interior grid positions without using them as the domain edges.
 const raw=(high-low)/5.25,unit=10**Math.floor(Math.log10(raw))/2;
 const rounded=Math.floor(raw/unit)*unit;
 const step=wholeTicks&&rounded>=1?Math.floor(rounded):rounded;
 const center=Math.round((low+(high-low)/2)/step);
 const ticks=Array.from({length:5},(_,i)=>Number(((center+i-2)*step).toPrecision(15)));
 return {low,high,ticks};
}
function priceExtrema(prices){
 if(!prices.length)return null;
 let high=0,low=0;
 for(let i=1;i<prices.length;i++){
  if(prices[i][1]>prices[high][1])high=i;
  if(prices[i][1]<prices[low][1])low=i;
 }
 return {high,low};
}
function extremaLabel(value,spread){
 const separation=spread>0?-Math.floor(Math.log10(spread)):0;
 const decimals=Math.min(10,Math.max(2,1-Math.floor(Math.log10(value)),separation));
 return fmt(value,decimals);
}
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
function peLabelPosition(points,{left,right,top,bottom},paths,barriers){
 for(let i=points.length-1;i>=0;i--){
  const [px,py]=points[i],x=Math.max(left+15,Math.min(right-15,px));
  for(const offset of [-12,12,-21,21]){
   const y=py+offset,box={left:x-13,right:x+13,top:y-7,bottom:y+7};
   if(box.top<top||box.bottom>bottom||barriers.some(b=>b.y>=box.top&&b.y<=box.bottom))continue;
   if(!paths.some(path=>priceHitsBox(path,box)))return {x,y,px,py};
  }
 }
 return null;
}
function priceFlagPosition([px,py],half,{left,right,top,bottom},paths,barriers,occupied){
 const fit=x=>Math.max(left+half+2,Math.min(right-half-2,x));
 const centers=[...new Set([half+12,-half-12,0,half+27,-half-27,half+42,-half-42].map(dx=>fit(px+dx)))];
 const edges=[top,...barriers.map(bar=>bar.y).sort((a,b)=>a-b),bottom];
 const gaps=edges.slice(1).map((edge,i)=>(edges[i]+edge)/2).filter(y=>Math.abs(y-py)<=36);
 const rows=[py,py-12,py+12,py-22,py+22,py-33,py+33,...gaps].sort((a,b)=>Math.abs(a-py)-Math.abs(b-py));
 for(const row of rows){
  const y=Math.max(top+7,Math.min(bottom-7,row));
  if(barriers.some(bar=>Math.abs(bar.y-y)<8))continue;
  for(const x of centers){
   const box={left:x-half,right:x+half,top:y-6,bottom:y+6};
   if(x-half<left||x+half>right||paths.some(path=>priceHitsBox(path,box)))continue;
   if(occupied.some(a=>a.left<box.right&&a.right>box.left&&a.top<box.bottom&&a.bottom>box.top))continue;
   return {x,y,box};
  }
 }
 return null;
}
const priceCurrencyMarks={USD:'$',SGD:'S$',HKD:'HK$',AUD:'A$',CAD:'C$',JPY:'¥',CNY:'CN¥',EUR:'€',GBP:'£'};
const overlayKeys=['pe','pb','target'];
const overlayColors={pe:'#006c61',pb:'#a04f13',target:'#744299',archive:'#586779'};
const overlayNames={pe:'Fwd P/E',pb:'Fwd P/B',target:'Morningstar fair value',archive:'BOS fair value / target'};
const ms=date=>Date.parse(date+'T12:00:00Z');
const validDay=date=>/^\d{4}-\d{2}-\d{2}$/.test(date||'')&&Number.isFinite(ms(date))&&new Date(ms(date)).toISOString().slice(0,10)===date;
function chartOptions(value){
 return {years:Number.isInteger(value?.years)&&value.years>=1&&value.years<=8?value.years:1,
  pe:value?.pe===true,pb:value?.pb===true,target:value?.target===true,cone:value?.cone===true};
}
function monthsAfter(date,months){
 const d=new Date(ms(date)),last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+months+1,0));
 return new Date(Date.UTC(last.getUTCFullYear(),last.getUTCMonth(),Math.min(d.getUTCDate(),last.getUTCDate()))).toISOString().slice(0,10);
}
// Compare source returns on common months; never average prices across providers.
function coneMonths(source,anchor){
 const monthly=new Map(),earliest=monthsAfter(anchor.date,-37),cutoff=anchor.date.slice(0,7)+'-01';
 for(const p of (source.points||[]).filter(p=>Array.isArray(p)&&validDay(p[0])&&Number.isFinite(p[1])&&p[1]>0).slice().sort((a,b)=>a[0].localeCompare(b[0]))){
  if(p[0]>=earliest&&p[0]<cutoff)monthly.set(p[0].slice(0,7),p);
 }
 // Prefer actual daily session dates over a later weekly/monthly period label.
 for(const p of (source.daily||[]).filter(p=>Array.isArray(p)&&validDay(p[0])&&Number.isFinite(p[1])&&p[1]>0).slice().sort((a,b)=>a[0].localeCompare(b[0]))){
  if(p[0]>=earliest&&p[0]<cutoff)monthly.set(p[0].slice(0,7),p);
 }
 const observations=[...monthly.values()].sort((a,b)=>a[0].localeCompare(b[0])),returns=new Map();
 for(let i=1;i<observations.length;i++){
  const before=observations[i-1],after=observations[i],days=(ms(after[0])-ms(before[0]))/86400000;
  if(monthsAfter(before[0].slice(0,7)+'-01',1).slice(0,7)!==after[0].slice(0,7)||days<20||days>40)continue;
  returns.set(after[0].slice(0,7),{value:Math.log(after[1]/before[1]),before,after});
 }
 return {...source,monthly,returns};
}
function commonConePairs(sources){
 return [...sources[0].returns.keys()].filter(key=>{
  const rows=sources.map(source=>source.returns.get(key));if(rows.some(row=>!row))return false;
  return ['before','after'].every(which=>{
   const days=rows.map(row=>ms(row[which][0]));return Math.max(...days)-Math.min(...days)<=7*86400000;
  });
 }).slice(-36);
}
function coneModel(source,keys,anchor){
 const rows=keys.map(key=>source.returns.get(key)),values=rows.map(row=>row.value),count=values.length;
 const mean=values.reduce((a,b)=>a+b,0)/count;
 const sigma=Math.sqrt(values.reduce((sum,r)=>sum+(r-mean)**2,0)/(count-1));
 const points=Array.from({length:13},(_,month)=>({date:monthsAfter(anchor.date,month),values:[-2,-1,0,1,2].map(sd=>anchor.close*Math.exp(sd*sigma*Math.sqrt(month)))}));
 if(!points.every(p=>p.values.every(Number.isFinite)))return {reason:'Model range exceeds numeric limits'};
 return {id:source.id,label:source.label,basis:source.basis||'',splitAdjusted:source.splitAdjusted===true,splits:source.splits||0,
  availableCount:source.returns.size,count,sigma,points,anchor,end:points.at(-1).date,from:rows[0].before[0],to:rows.at(-1).after[0]};
}
function coneAnalysis(d){
 const anchor=d.quote;
 if(!validDay(anchor?.date)||!Number.isFinite(anchor.close)||anchor.close<=0)return {primary:{reason:'No dated anchor close'},models:[]};
 const fallback={id:d.provider==='Yahoo Finance'?'yahoo':'history',label:d.provider==='Yahoo Finance'?'Yahoo':'Saved history',
  splitAdjusted:d.provider==='Yahoo Finance',daily:d.daily,points:d.comparisonPrices||d.points||[]};
 const inputs=d.coneHistories?.length?d.coneHistories:[fallback];
 const sources=inputs.map(source=>coneMonths(source,anchor)),eligible=sources.filter(source=>source.returns.size>=12);
 const first=eligible.find(s=>s.id==='yahoo'&&s.splitAdjusted===true)||eligible.find(s=>s.id==='bos'&&s.splitAdjusted===true)||eligible.find(s=>s.id==='history');
 if(!first)return {primary:{reason:eligible.length?'No split-checked primary source':'Need 12 monthly return pairs'},models:[],sources};
 // Unlabelled legacy input remains conservative. A verified Yahoo rally is not evidence of a split.
 if(first.id==='history'&&!first.splitAdjusted&&[...first.returns.values()].some(row=>Math.abs(row.value)>Math.log(1.8)))return {primary:{reason:'Price-basis review needed'},models:[],sources};
 const fullModels=eligible.map(source=>coneModel(source,[...source.returns.keys()].slice(-36),anchor)).filter(model=>model.points);
 const primary=fullModels.find(model=>model.id===first.id);
 if(!primary)return {primary:{reason:'Model range unavailable'},models:[],sources};
 const selected=[first],excluded=[];
 for(const source of eligible.filter(source=>source!==first)){
  if(commonConePairs([...selected,source]).length>=12)selected.push(source);else excluded.push(source.label+' lacks common dates');
 }
 const keys=commonConePairs(selected),matchedModels=selected.map(source=>coneModel(source,keys,anchor)).filter(model=>model.points);
 const reference=matchedModels[0];let review=false;
 for(const model of fullModels){
  const matched=matchedModels.find(m=>m.id===model.id);model.matchedCount=matched?.count||0;model.matchedSigma=matched?.sigma;
  if(model.id===primary.id||!matched)continue;
  const smallest=Math.min(reference.sigma,matched.sigma),largest=Math.max(reference.sigma,matched.sigma);
  model.volGap=smallest>1e-12?largest/smallest-1:largest>1e-12?Infinity:0;
  const source=selected.find(source=>source.id===model.id);
  const gaps=keys.map(key=>Math.abs(source.returns.get(key).after[1]/first.returns.get(key).after[1]-1)).sort((a,b)=>a-b);
  model.priceGap=gaps[Math.floor(gaps.length/2)];model.review=model.volGap>=.25||model.priceGap>=.10;review ||= model.review;
 }
 return {primary,models:[primary,...fullModels.filter(m=>m.id!==primary.id)],matchedModels,sources,excluded,review,matched:matchedModels.length>1};
}
function probabilityCone(d){return coneAnalysis(d).primary;}

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
function svg(p,enrichment={},page=1,total=1,{showWatermarks=true,links,chart:options}={}){const chart=chartOptions(options),four=p.shares.length===4,small=p.shares.length>=3,out=[];const rect=(x,y,w,h,fill,stroke=border)=>out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}"/>`);const text=(x,y,t,size=10,color=navy,bold=false,anchor='start')=>out.push(`<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${size}" fill="${color}" font-weight="${bold?700:400}" text-anchor="${anchor}">${escape(t)}</text>`);const line=(x,y,x2,y2,color=border,dash='')=>out.push(`<line x1="${x}" y1="${y}" x2="${x2}" y2="${y2}" stroke="${color}" ${dash?`stroke-dasharray="${dash}"`:''}/>`);const paragraph=(x,y,value,max,rows,size=10,color=muted)=>{const lines=wrap(value,max);lines.slice(0,rows).forEach((s,i)=>text(x,y+i*(size+3),s+(i===rows-1&&lines.length>rows?'…':''),size,color));};
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
 const pairs=[['Tenor',`${fmt(p.months)} months`,'Coupon',`${pct(p.coupon)}${basis}`],['Currency',p.currency,'Initial KO',pct(p.ko)],['KI',pct(p.ki),'Strike',pct(p.strike)],['Monthly step',num(p.step)===null?'Not supplied':fmt(p.step,4)+' pp','Final KO',finalKO(p)===null?'Not calculated':pct(finalKO(p))]];
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
 const start=four?216:hasOverlays?287:270,foot=small?1054:1044,available=foot-8-start,gap=small?6:8;
 const block=(available-gap*(p.shares.length-1))/Math.max(1,p.shares.length),header=small?18:23,shift=23-header;
 const marginSources=new Set(),metricsDates=new Set();
 p.shares.forEach((s,i)=>{const d=enrichment[s.symbol]||{},y=start+i*(block+gap),r=reference(p,s,d),ls=levels(p,r.value),name=s.name||d.name||s.symbol;
 rect(28,y,744,block,'#fff');rect(28,y,744,header,navy,navy);
 const titleY=y+(small?13:16);
 fitted(37,titleY,clean(name,69),445,11,'#fff',true);fitted(762,titleY,s.symbol,110,10,'#fff',false,'end');
 const margin=validMoa(s.moaPct)?s.moaPct:d.moaPct;
 if(validMoa(margin))marginSources.add(validMoa(s.moaPct)?'manual entry':d.moaSource||'private lookup');
 fitted(635,titleY,'MOA margin '+(validMoa(margin)?pct(margin):'—'),132,9,'#fff',true,'end');
 const {end,from,selected,series,prices:pts,calls:ratingHistory,incompatibleArchive}=chartWindow(d,chart);
 const coneCheck=chart.cone?coneAnalysis(d):null,cone=coneCheck?.primary;
 const bounds=priceExtrema(pts),ratios=[...(series.pe||[]),...(series.pb||[])].map(p=>p.value);
 const flatPrice=!!bounds&&bounds.low===bounds.high,ratioAxis=ratios.length>0&&!flatPrice;
 const showCoverage=chart.cone||hasOverlays&&(!small||incompatibleArchive>0||(flatPrice&&ratios.length>0)||selected.some(key=>!series[key].length));
 const chartX=36,chartY=y+29-shift,plotLeft=chartX+17,plotTop=chartY+13;
 const plotBottom=y+block-(showCoverage?32:22)-(ratingHistory.length?14:0);
 const plotRight=ratioAxis?417:427;
 text(plotLeft-5,chartY+4,'Price',7,navy,true,'end');
 text(plotLeft+5,chartY+4,`${chart.years}-year price history${d.currency?' · '+d.currency:''}`,8,navy,true);
 if(pts.length>1){
  const fk=finalKO(p),bars=[['KO',ls.ko,'#699645','7 3'],['KI',ls.ki,'#b94a57','3 3'],['Strike',ls.strike,'#8261a8','9 3 2 3'],...(p.step>0&&fk!==null?[['Final KO',num(r.value)===null?null:r.value*fk/100,'#c07821','2 3']]:[])].filter(x=>x[1]!==null);
  const priceHigh=pts[bounds.high][1],priceLow=pts[bounds.low][1],spread=priceHigh-priceLow;
  const values=[priceLow,priceHigh,...bars.map(b=>b[1]),...(series.target||[]).map(p=>p.value),...(series.archive||[]).map(p=>p.value),...(coneCheck?.models.flatMap(model=>model.points.flatMap(p=>p.values))||[])];
  const {low,high,ticks}=axisScale(values,{wholeTicks:true}),t0=ms(from),t1=ms(cone?.end||end);
  const px=date=>plotLeft+(ms(date)-t0)/(t1-t0)*(plotRight-plotLeft);
  const py=v=>plotBottom-(v-low)/(high-low)*(plotBottom-plotTop);
  const conePaths=[],pricePoints=pts.map(([date,value])=>[px(date),py(value)]),pointList=points=>points.map(p=>p.map(n=>n.toFixed(2)).join(',')).join(' ');
  if(cone?.points){
   out.push(`<g class="si-probability-cone" data-anchor="${cone.anchor.date}" data-end="${cone.end}" aria-label="12-month model ranges, not forecasts">`);
   for(const [lower,upper,color] of [[0,4,'#e4edf4'],[1,3,'#bdd6e7']]){
    const coords=[...cone.points.map(p=>[px(p.date),py(p.values[upper])]),...cone.points.toReversed().map(p=>[px(p.date),py(p.values[lower])])];
    out.push(`<polygon fill="${color}" points="${pointList(coords)}"/>`);
   }
   line(px(cone.anchor.date),plotTop,px(cone.anchor.date),plotBottom,'#6b879a','2 3');
   line(px(cone.anchor.date),py(cone.anchor.close),px(cone.end),py(cone.anchor.close),'#55768d','4 3');
   text(px(cone.end)-3,plotTop+8,'+12m',7,muted,true,'end');
   for(const alternate of coneCheck.models.slice(1)){
    const color=alternate.id==='bos'?'#8052a0':'#ae711b';
    for(const index of [0,4]){const coords=alternate.points.map(p=>[px(p.date),py(p.values[index])]);conePaths.push(coords);out.push(`<polyline class="si-cone-comparison" data-source="${escape(alternate.id)}" fill="none" stroke="${color}" stroke-width="1.1" stroke-dasharray="${alternate.id==='bos'?'5 3':'2 3'}" points="${pointList(coords)}"><title>${escape(alternate.label+' ±2 SD · '+alternate.count+' monthly returns; common-sample check is separate')}</title></polyline>`);}
   }
   out.push('</g>');
  }
  if(hasOverlays)out.push(`<polygon class="si-price-area" fill="#dceaf7" points="${pricePoints[0][0]},${plotBottom} ${pointList(pricePoints)} ${pricePoints.at(-1)[0]},${plotBottom}"/>`);
  out.push('<g class="si-price-grid">');
  for(const tick of ticks)line(plotLeft,py(tick),plotRight,py(tick),'#dde3e9');
  out.push('</g>');
  out.push('<g class="si-price-axis">');
  for(const tick of ticks)fitted(plotLeft-5,py(tick)+2.5,fmt(tick,6),19,7.5,navy,true,'end');
  out.push('</g>');
  for(let j=0;j<5;j++){const epoch=t0+(t1-t0)*j/4,xx=plotLeft+(plotRight-plotLeft)*j/4;line(xx,plotTop,xx,plotBottom,'#edf0f3');text(xx,y+block-(showCoverage?19:9),monthLabel(epoch),7.5,muted,false,j===0?'start':j===4?'end':'middle');}
  let ry=py;
  if(ratioAxis){
   // Keep multiples inside the vertical range occupied by the visible closes.
   const scale=axisScale(ratios),ratioTop=py(priceHigh),ratioBottom=py(priceLow);
   ry=v=>ratioBottom-(v-scale.low)/(scale.high-scale.low)*(ratioBottom-ratioTop);
   const ratioInk=series.pe?.length?'#14532d':muted;
   line(plotRight,ratioTop,plotRight,ratioBottom,'#9caec0');
   out.push('<g class="si-ratio-axis">');
   text(plotRight+3,chartY+4,series.pe?.length&&!series.pb?.length?'P/E ×':'Ratios ×',7,ratioInk,true);
   let previous=Infinity;
   for(const tick of scale.ticks){
    const yy=ry(tick);
    if(previous-yy<9)continue;
    line(plotRight,yy,plotRight+3,yy,'#9caec0');
    text(plotRight+5,yy+2,fmt(tick,6),6.5,ratioInk,true);
    previous=yy;
   }
   out.push('</g>');
  }
  const overlayPaths=[];
  for(const key of selected){
   const multiple=key==='pe'||key==='pb';
   if(multiple&&!ratioAxis)continue;
   const scale=multiple?ry:py,points=series[key],color=overlayColors[key];
   const xy=p=>[px(p.date),scale(p.value)];
   for(const run of observationRuns(points)){
    const coords=run.map(xy);
    overlayPaths.push(coords.length===1?[coords[0],coords[0]]:coords);
    if(coords.length<2)continue;
    out.push(`<polyline class="si-overlay si-overlay-${key}" fill="none" stroke="${color}" stroke-width="1.2" ${key==='pb'?'stroke-dasharray="4 2"':key==='archive'?'stroke-dasharray="2 2"':''} points="${pointList(coords)}"/>`);
   }
   for(const point of points){
    const [xx,yy]=xy(point),rating=/^(buy|hold|sell)$/i.test(point.rating||'')?point.rating.toUpperCase():'';
    out.push(`<circle class="si-observation si-observation-${key}" cx="${xx.toFixed(2)}" cy="${yy.toFixed(2)}" r="${key==='target'||key==='archive'?2.2:1.35}" fill="${key==='archive'?'#fff':color}" stroke="${color}"><title>${escape(`${overlayNames[key]} · ${point.date} · ${fmt(point.value,4)}${rating?' · '+rating:''}`)}</title></circle>`);

   }
  }
  const barriers=bars.map(([label,value])=>({label,y:py(value)}));
  const labels=inlineBarrierLabels(barriers,pricePoints,plotLeft,plotRight,[...overlayPaths,...conePaths]);
  const fallback=barrierLabels(labels.filter(l=>!l.inline).map(l=>l.y),plotTop+5,plotBottom-5),rail=ratioAxis?29:1;
  let fallbackIndex=0;
  out.push(`<g class="si-barriers" data-plot-right="${plotRight}">`);
  bars.forEach(([label,v,c,dash],j)=>{const yy=py(v),placement=labels[j];line(plotLeft,yy,plotRight,yy,c,dash);if(placement.inline){out.push(`<g class="si-inline-barrier-label" data-clearance="4">`);rect(placement.x-placement.width/2,yy-5,placement.width,10,'#fff','#fff');text(placement.x,yy+2.5,label,7,c,true,'middle');out.push('</g>');}else{const labelY=fallback[fallbackIndex++].y;out.push(`<path d="M ${plotRight+rail} ${yy} L ${plotRight+rail+4} ${yy} L ${plotRight+rail+8} ${labelY} L ${plotRight+rail+11} ${labelY}" fill="none" stroke="${c}" stroke-width="0.7"/>`);text(plotRight+rail+14,labelY+2.5,label,7,c,true);}});
  out.push('</g>');
  out.push(`<polyline class="si-price-line" fill="none" stroke="${blue}" stroke-width="1.5" points="${pointList(pricePoints)}"/>`);
  const plot={left:plotLeft,right:plotRight,top:plotTop,bottom:plotBottom};
  const paths=[pricePoints,...overlayPaths,...conePaths],occupied=[];
  const peMark=ratioAxis&&series.pe?.length?
   peLabelPosition(series.pe.map(point=>[px(point.date),ry(point.value)]),plot,paths,barriers):null;
  if(peMark)occupied.push({left:peMark.x-12,right:peMark.x+12,top:peMark.y-7,bottom:peMark.y+7});
  out.push('<g class="si-price-extrema" aria-label="Highest and lowest displayed closes">');
  const flags=flatPrice?[[bounds.high,'High / Low']]:[[bounds.high,'High'],[bounds.low,'Low']];
  for(const [index,label] of flags){
   const xy=pricePoints[index],[xx,yy]=xy,[date,price]=pts[index];
   const amount=extremaLabel(price,spread),caption=label+': '+(priceCurrencyMarks[d.currency]||'')+amount;
   const half=Math.max(24,caption.length*2.25+10);
   const flag=priceFlagPosition(xy,half,plot,paths,barriers,occupied);
   if(flag){
    const {x,y,box}=flag,edge=xx<x?x-half:x+half;
    const end=xx>=box.left&&xx<=box.right?[xx,yy<y?box.top:box.bottom]:[edge,y];
    line(xx,yy,...end,'#617a95');
    rect(box.left,box.top,2*half,box.bottom-box.top,'#fff','#fff');
    line(x-half,y,x-half+8,y,navy,'2 2');
    line(x+half-8,y,x+half,y,navy,'2 2');
    text(x,y+2.5,caption,7.5,navy,true,'middle');
    occupied.push(box);
   }else{
    const end=plotRight-(label==='High'?82:3),headY=chartY+1.5;
    line(end-74,headY,end-68,headY,navy,'2 2');
    fitted(end-37,chartY+4,caption,57,7.5,navy,true,'middle');
    line(end-6,headY,end,headY,navy,'2 2');
    line(Math.max(plotLeft,xx-9),yy,Math.min(plotRight,xx+9),yy,navy,'2 2');
   }
   out.push(`<circle class="si-price-extreme" cx="${xx.toFixed(2)}" cy="${yy.toFixed(2)}" r="2.2" fill="#fff" stroke="${blue}" stroke-width="1.1"><title>${escape(label+' · '+date+' · '+amount)}</title></circle>`);
  }
  out.push('</g>');
  if(ratioAxis&&series.pe?.length){
   const color=overlayColors.pe;
   out.push('<g class="si-pe-label" aria-label="Forward P/E on the right axis">');
   if(peMark){
    line(peMark.px,peMark.py,peMark.x,peMark.y+(peMark.y<peMark.py?5:-5),color);
    rect(peMark.x-10,peMark.y-5,20,10,'#fff','#fff');
    text(peMark.x,peMark.y+2.5,'P/E',7.5,color,true,'middle');
   }else{
    line(chartX+145,chartY+1,chartX+155,chartY+1,color);
    text(chartX+159,chartY+4,'P/E',7.5,color,true);
   }
   out.push('</g>');
  }
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
 if(showCoverage){
  const names={pe:'P/E',pb:'P/B',target:'Morningstar',archive:'BOS archive'};
  const coverage=selected.map(key=>`${names[key]}: ${series[key].length||'unavailable'}`);
  if(chart.target)coverage.push(`Calls: ${ratingHistory.length||'unavailable'}`);
  if(flatPrice&&ratios.length)coverage.push('Ratios hidden on flat prices');
  if(incompatibleArchive)coverage.push(`${incompatibleArchive} archive off scale`);
  if(chart.cone)coverage.push(cone?.points?`Cone: ${cone.label} ${cone.count} months${coneCheck.models.find(m=>m.id==='bos'&&m.id!==cone.id)?' · purple BOS '+coneCheck.models.find(m=>m.id==='bos'&&m.id!==cone.id).count:''}${coneCheck.models.find(m=>m.id==='saved')?' · gold Saved '+coneCheck.models.find(m=>m.id==='saved').count:''}${coneCheck.review?' · REVIEW':coneCheck.matched?' · shared-date check OK':''}`:'Cone: '+cone.reason);
  fitted(chartX+4,y+block-6,(hasOverlays?'Observations · ':'')+coverage.join(' · '),446,7.5,muted);
 }
 const rx=496,rw=266,description=s.description||d.description||'Company description not supplied. Add a short description in share details.';
 // Keep artwork behind the entire info panel and outside the price plot and label rail.
 if(showWatermarks && typeof d.logo==='string' && /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(d.logo)){
  out.push(`<image class="si-company-watermark" x="${rx}" y="${y+27-shift}" width="${rw}" height="${block-31+shift}" href="${d.logo}" preserveAspectRatio="xMidYMid meet" opacity="0.12" aria-hidden="true"/>`);
 }
 // Show the complete entered description, including on four-share pages.
 const descriptionLines=wrap(description.length> (small?340:500)?description.slice(0,small?337:497).replace(/\s+\S*$/,'')+'…':description,small?60:49),descriptionHeight=small?65:90,descriptionSize=Math.min(small?8.5:10,descriptionHeight/descriptionLines.length-1.5);
 descriptionLines.slice(0,small?6:9).forEach((value,j)=>fitted(rx,y+37-shift+j*(descriptionSize+1.5),value+(j===(small?5:8)&&descriptionLines.length>(small?6:9)?"…":""),rw,Math.max(7.5,descriptionSize),muted));
 const research=bosResearch(d.metrics);
 const my=y+(four?94:small?96:135),spacing=four?10:small?10.5:16;
 const metrics=[['Historical close',d.quote?`${fmt(d.quote.close,4)} ${d.currency||''}`:'Unavailable'],['Observation date',d.quote?.date||'Unavailable'],...(!four?[['Reference basis',r.basis],['Reference price',num(r.value)===null?'Unavailable':fmt(r.value,4)]]:[]),['Forward P/E',fmt(d.metrics?.pe)],['Forward P/B',fmt(d.metrics?.pb)],['Dividend yield',d.metrics?.dividendYieldPct==null?'Unavailable':pct(d.metrics.dividendYieldPct)],...(!four?[['Employees · snapshot',fmt(d.staticProfile?.employees,0)],['Incorporated',d.staticProfile?.yearIncorporated??'Not supplied']]:[])];
 metrics.forEach(([k,v],j)=>{const yy=my+j*spacing;out.push('<g class="si-company-metric">');fitted(rx,yy,k,125,small?8:9,muted);fitted(rx+rw,yy,v,135,small?8:9,navy,true,'end');out.push('</g>');});
 if(research){
  const yy=my+metrics.length*spacing+5,size=small?8:9,x=rx+78;
  text(rx,yy,'BOS research',size,muted,true);
  if(research.url){
   const box={left:x-2,top:yy-size-2,right:x+33,bottom:yy+3};
   links?.push({...box,url:research.url});
   out.push(`<a class="si-bos-report" href="${escape(research.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escape(`Open ${name} research PDF, ${research.call}`)}"><rect x="${box.left}" y="${box.top}" width="${box.right-box.left}" height="${box.bottom-box.top}" fill="transparent"/>`);
   text(x,yy,research.call,size,'#174e88',true);
   line(x,yy+1,x+research.call.length*size*.64,yy+1,'#174e88');out.push('</a>');
  }else if(research.call){text(x,yy,research.call,size,navy,true);}
  const label=[research.provider,research.target].filter(Boolean).join(' · ');
  fitted(rx,yy+(small?11:15),label,rw,size,navy,true);
 }
 const credit=root.SIEquityPages?.summary(d.creditRatings)||[];
 if(credit.length){
  const yy=my+metrics.length*spacing+(research?(four?26:small?31:42):12),size=four?7.5:small?8:9;
  text(rx,yy,'Agency credit · BBG snapshot, undated',size,muted,true);
  credit.forEach((row,j)=>{const yy2=yy+(j+1)*(four?9:small?10:13);fitted(rx,yy2,row.label,170,size,muted);fitted(rx+rw,yy2,row.value,92,size,navy,true,'end');});
 }
 if(validDay(d.metricsDate))metricsDates.add(d.metricsDate);
 if(!small&&d.metricsBasis)paragraph(rx,y+block-26,d.metricsBasis,61,2,8,muted);
 });
 line(28,foot,772,foot);
 const sourceNote=p.source?`Source ${p.source.reference} · ${p.source.date||'date unavailable'} · Rounded, photo-unverified terms.${p.source.bonusEnhanced?' Bonus-enhanced note.':''}${p.source.couponAssumed && p.couponBasis==='per_annum'?' Coupon assumed p.a.':''}`:'User-entered terms require verification.';
 const dates=[...metricsDates].sort();
 const metricsNote=dates.length?`BOS metrics · ${dates[0]}${dates.length>1?' to '+dates.at(-1):''}`:'';
 const profileNote=p.shares.some(share=>enrichment[share.symbol]?.staticProfile)?' Company profiles: shortened excerpts.':'';
 const footerCopy=[
  'Indicative reference. Capital is at risk. Refer to the issuer’s final terms. Charts show historical closes.'+profileNote,
  ...(chart.cone?['Cone: zero log drift; up to 36 monthly returns/source; same anchor, no averaging. ±1 and ±2 SD (~68/95%): not a forecast or barrier-hit probability.']:[]),
  [sourceNote,metricsNote].filter(Boolean).join('  '),
  ...(marginSources.size?['MOA margin source · '+[...marginSources].join(' / ')]:[]),
  ...(p.notes?[p.notes]:[]),
 ];
 let footerY=foot+12;
 for(const [i,copy] of footerCopy.entries()){
  for(const value of wrap(copy,161)){
   text(28,footerY,value,small?7.5:8,i===0?navy:muted);
   footerY+=small?9:10;
  }
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
   const uri=pdfLinkUrl(url);
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
function pdfLinkUrl(raw){
 if(bosReportUrl(raw))return bosReportUrl(raw);
 try{const url=new URL(raw);return !url.username&&!url.password&&url.protocol==='https:'&&
  (url.hostname==='www.morningstar.com'&&/^\/stocks\/[a-z]+\/[^/]+\/financials$/.test(url.pathname)||
   ['www.apple.com','www.fitchratings.com','www.spglobal.com','ratings.moodys.com'].includes(url.hostname))?url.href:'';}catch{return '';}
}
const api={inlineBarrierLabels,priceHitsBox,segmentHitsBox,barrierLabels,axisScale,monthLabel,blank,fromReference,validate,finalKO,levels,reference,symbol,svg,pdfFromImages,escape,fmt,pct,num,validMoa,parseMoa,matchMoa,acceptable,loadReferences,isBonusEnhanced,referenceCouponLabel,referenceCouponBand,couponBand,barrierBand,chartOptions,chartWindow,valuationPoints,yearsBefore,monthsAfter,probabilityCone,coneAnalysis,coneMonths,commonConePairs,overlayKeys,W,H};root.SIBetaCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
