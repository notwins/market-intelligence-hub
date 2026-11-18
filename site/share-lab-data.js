/* Validated compact public history. No current quotes or portfolio state. */
(function(root){'use strict';
const CSV=root.document?.currentScript?.dataset.shareHistory || 'data/share-history.csv',BASE_METRICS=['price','globalPrice','sourcePrice','pe','pb','dividendYield','impliedEps','trr'];
const numeric=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
let state=null,pending=null,error='';
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
function rows(text,receive){
 let row=[],cell='',quoted=false,closed=false,count=0;
 const field=()=>{row.push(cell);cell='';closed=false;};
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
  if(c==='"'){if(cell||closed)throw Error('Malformed quoted history cell.');quoted=true;}
  else if(c===','){field();}
  else if(c==='\n'){field();receive(row,count++);row=[];if(count>2000000)throw Error('Historical file exceeds row limit.');}
  else if(c==='\r'){if(text[i+1]!=='\n')throw Error('Malformed history line ending.');}
  else{if(closed)throw Error('Characters after quoted history cell.');cell+=c;}
 }
 if(quoted||cell||row.length)throw Error('Historical file is incomplete.');
}
function integer(v){if(!/^\d+$/.test(String(v)))throw Error('Invalid history integer.');return Number(v);}
function json(text){try{return JSON.parse(text);}catch{throw Error('Invalid history dictionary.');}}
async function parse(text){
 if(typeof text!=='string'||text.length>80000000)throw Error('Historical file exceeds size limit.');
 const next={sources:new Map(),records:[],byId:new Map(),entries:new Map(),contexts:[],enums:new Map(),metadata:null,version:''};
 let context=null,entryCount=0,valueCount=0,trailer=null,started=false;
 rows(text,(row,line)=>{
  if(line===0){if(JSON.stringify(row)!==JSON.stringify(['Date','Type','Key','Data']))throw Error('Unsupported history CSV header.');return;}
  if(trailer)throw Error('Unexpected data after history trailer.');
  const [day,type,key]=row;
  if(type==='V'){
   if(next.metadata||key!=='1'||day||row.length!==4||line!==1)throw Error('Unsupported history version.');
   next.metadata=json(row[3]);if(next.metadata.schemaVersion!==1||next.metadata.kind!=='public-share-history')throw Error('Unsupported history schema.');
  }else if(type==='S'){
   if(started||day||row.length!==4||next.sources.has(key))throw Error('Invalid history source order.');
   const source=json(row[3]);if(source.id!==key||typeof source.label!=='string'||typeof source.file!=='string'||/[\\/]/.test(source.file)||!/^[a-f0-9]{64}$/.test(source.sha256)||!source.metrics)throw Error('Invalid history source.');next.sources.set(key,freeze(source));
  }else if(type==='I'){
   if(started||day||row.length!==4)throw Error('Invalid security dictionary order.');
   const n=integer(key),record=json(row[3]);
   if(n!==next.records.length||typeof record.id!=='string'||!record.id||next.byId.has(record.id)||typeof record.name!=='string'||!record.name||record.currency!==null&&typeof record.currency!=='string')throw Error('Invalid history security identity.');
   if(record.identityStatus==='conflict'&&(record.currentEligible!==false||record.compareEligible!==false))throw Error('Conflicting identity cannot be eligible.');
   next.records.push(freeze(record));next.byId.set(record.id,record);next.entries.set(record.id,[]);
  }else if(type==='E'){
   if(started||day||row.length!==4)throw Error('Invalid text dictionary order.');
   const n=integer(key),value=json(row[3]);if(n!==next.enums.size||typeof value!=='string')throw Error('Invalid history text dictionary.');next.enums.set(n,value);
  }else if(type==='D'){
   started=true;if(row.length!==4||day&&!date(day)||!next.sources.has(key))throw Error('Invalid history date context.');
   const data=json(row[3]);if(data.reportDate&&!date(data.reportDate)||day&&data.reportDate&&day>data.reportDate||data.archiveMonth&&!/^\d{4}-\d{2}$/.test(data.archiveMonth)||!Array.isArray(data.metrics)||!data.metrics.length||new Set(data.metrics).size!==data.metrics.length||data.metrics.some(m=>typeof m!=='string'||!m)||!data.meta||typeof data.meta!=='object')throw Error('Invalid history metric context.');
   context=freeze({...data,date:day||null,sourceId:key});next.contexts.push(context);
  }else if(type==='O'){
   if(!context||day||row.length<7||row.length>context.metrics.length+6)throw Error('Invalid history observation width.');
   const n=integer(key),record=next.records[n];if(!record)throw Error('Unknown history listing.');
   const values=row.slice(6);let present=0;
   for(const value of values){if(value==='')continue;if(value[0]==='@'){if(!next.enums.has(integer(value.slice(1))))throw Error('Unknown history text code.');}else if(!numeric.test(value)||!Number.isFinite(Number(value)))throw Error('Invalid historical numeric value.');present++;}
   if(!present)throw Error('Empty historical observation.');
   next.entries.get(record.id).push([context,values,row[3],row[4],row[5]]);entryCount++;valueCount+=present;
  }else if(type==='Z'){
   if(day||row.length!==7)throw Error('Invalid history trailer.');trailer=row;
  }else throw Error('Unknown historical record type.');
 });
 if(!next.metadata||!trailer||integer(trailer[2])!==entryCount||integer(trailer[3])!==valueCount||integer(trailer[4])!==next.records.length||integer(trailer[5])!==next.sources.size||next.metadata.rows!==entryCount||next.metadata.observations!==valueCount||next.metadata.listings!==next.records.length||next.metadata.sources!==next.sources.size||!next.records.length||next.records.length>20000)throw Error('Historical file counts do not reconcile.');
 const position=text.lastIndexOf('\n,Z,')+1;
 if(position<=0||!/^[a-f0-9]{64}$/.test(trailer[6])||!root.crypto?.subtle)throw Error('Historical integrity check unavailable.');
 const bytes=new TextEncoder().encode(text.slice(0,position));
 const hash=[...new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
 if(hash!==trailer[6])throw Error('Historical file checksum mismatch.');
 next.version=hash;next.metadata=freeze({...next.metadata,bytes:new TextEncoder().encode(text).length,csvUrl:CSV,downloadUrl:CSV,metricKeys:[...new Set(next.contexts.flatMap(c=>c.metrics))].sort(),firstDate:next.contexts.map(c=>c.date).filter(Boolean).sort()[0]||null,lastDate:next.contexts.map(c=>c.date).filter(Boolean).sort().at(-1)||null});
 return next;
}
function announce(){if(root.document?.dispatchEvent&&root.CustomEvent)root.document.dispatchEvent(new root.CustomEvent('share-lab-data-updated'));}
async function fetchText(){
 if(typeof root.DecompressionStream==='function'){
  try{const response=await root.fetch(CSV+'.gz',{cache:'no-cache'});if(!response.ok)throw Error('Compressed history unavailable.');const bytes=await response.arrayBuffer();const stream=new Blob([bytes]).stream().pipeThrough(new root.DecompressionStream('gzip'));return await new Response(stream).text();}catch{}
 }
 const response=await root.fetch(CSV,{cache:'no-cache'});if(!response.ok)throw Error('Historical share data unavailable.');return response.text();
}
async function load(force=false){
 if(state&&!force)return metadata();if(pending)return pending;
 pending=(async()=>{try{const text=await fetchText(),next=await parse(text);state=next;error='';return metadata();}catch(e){error=e?.message||'Historical share data unavailable.';return state?metadata():null;}finally{pending=null;announce();}})();return pending;
}
function records(){return state?state.records.slice():[];}
function metadata(){return state?state.metadata:null;}
function resolve(item){const record=state?.byId.get(typeof item==='string'?item:item?.id);if(!record)return null;if(item&&typeof item==='object'&&(item.currency&&item.currency!==record.currency||item.isin&&record.isin&&item.isin!==record.isin))return null;return record;}
function observation(record,entry,index){
 const [context,values,page,row,column]=entry,metric=context.metrics[index],raw=values[index];if(raw===undefined||raw==='')return null;
 const source=state.sources.get(context.sourceId),definition=source.metrics[metric]||{},text=raw[0]==='@'?state.enums.get(Number(raw.slice(1))):raw;
 const value=raw[0]==='@'?text:Number(raw);
 return {metric,date:context.date,value,rawValue:text,sourceId:context.sourceId,source:source.label,sourceUrl:source.url||(context.sourceId==='global-top100-close-2026-11-05'?record.priceSourceUrl:null)||null,sourceFile:source.file,sourcePage:page||null,sourceRow:row||null,sourceColumn:column||definition.sourceColumn||null,sourceSheet:context.sheet||null,reportDate:context.reportDate,priceAsOf:definition.dateBasis?null:context.date,archiveMonth:context.archiveMonth,grain:context.meta.grain||definition.grain||source.grain||(context.date?'observation':'snapshot'),basis:definition.basis||source.semantics||'Source methodology unspecified',unit:definition.unit||null,derived:definition.derived===true,currency:Object.hasOwn(definition,'currency')?definition.currency:record.currency,adjustment:definition.adjustment||source.adjustment||null,periodStart:definition.periodStart||null,dateBasis:definition.dateBasis||null,cutoffInferred:String(definition.dateBasis||'').startsWith('inferred'),...context.meta};
}
function calendarReturns(metrics){
 const result=[];
 for(let year=2019;year<=2025;year++){
  const a=metrics['trrHolding'+year]?.[0],b=metrics['trrHolding'+(year+1)]?.[0];
  if(!a||!b||typeof a.value!=='number'||typeof b.value!=='number'||a.value<=-100||b.value<=-100)continue;
  result.push({...a,metric:'trr',year,label:String(year),date:year+'-12-31',priceAsOf:null,value:((1+a.value/100)/(1+b.value/100)-1)*100,rawValue:null,derived:true,grain:'year',periodType:'calendar_year',periodStart:year+'-01-01',basis:'Derived calendar total return · local currency · gross dividends reinvested',dateBasis:'calendar_year_derived_from_holding_returns'});
 }
 return result;
}
async function historyFor(item){
 if(!state)await load();const record=resolve(item),metrics=Object.fromEntries(BASE_METRICS.map(k=>[k,[]])),snapshots=[];
 if(!record)return {record:null,metrics,snapshots};
 for(const entry of state.entries.get(record.id))for(let i=0;i<entry[1].length;i++){
  const point=observation(record,entry,i);if(!point)continue;
  if(point.date)(metrics[point.metric]??=[]).push(point);else snapshots.push(point);
 }
 for(const points of Object.values(metrics))points.sort((a,b)=>a.date.localeCompare(b.date)||a.sourceId.localeCompare(b.sourceId));
 metrics.trr=calendarReturns(metrics);metrics.price=metrics.globalPrice;return {record,metrics,snapshots};
}
async function metricFor(metric,options={}){
 if(!state)await load();const result=new Map();if(!state)return result;
 if(metric==='price')metric='globalPrice';
 if(metric==='trr'){for(const record of state.records){const holdings={};for(const entry of state.entries.get(record.id))for(let i=0;i<entry[0].metrics.length;i++)if(/^trrHolding\d{4}$/.test(entry[0].metrics[i])){const p=observation(record,entry,i);if(p)(holdings[p.metric]??=[]).push(p);}const points=calendarReturns(holdings);if(points.length)result.set(record.id,points);}return result;}
 for(const record of state.records){const points=[];for(const entry of state.entries.get(record.id)){const index=entry[0].metrics.indexOf(metric);if(index<0)continue;const point=observation(record,entry,index);if(point&&(point.date||options.includeSnapshots))points.push(point);}if(points.length)result.set(record.id,points.sort((a,b)=>(a.date||'').localeCompare(b.date||'')||a.sourceId.localeCompare(b.sourceId)));}return result;
}
const api={load,records,metadata,stats:metadata,historyFor,metricFor,version:()=>state?.version||'unloaded',status:()=>({loaded:!!state,error}),parse};
root.ShareLabData=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
