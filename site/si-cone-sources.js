/* Source-separated cone inputs. Never merge price levels from different providers. */
(function(root){'use strict';
let archiveRequest;
async function archive(){
 return archiveRequest??=Promise.all(['data/stocks-beta2-monthly-history.json','data/stocks-beta2-history-adjustments.json'].map(async url=>{
  const response=await root.fetch(url,{signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('Cone comparison archive unavailable.');return response.json();
 })).then(([data,adjustments])=>{
  if(data.version!==1||!Array.isArray(data.months)||!Array.isArray(data.securities)||adjustments.version!==1)throw Error('Invalid cone comparison archive.');
  return {data,adjustments};
 }).catch(error=>{archiveRequest=null;throw error;});
}
function bosHistory(data,adjustments,ticker,currency){
 const rows=data.securities.filter(row=>row.ticker===ticker&&row.currency===currency);
 if(rows.length!==1||!root.StocksBeta2Charts?.chartHistory)return null;
 const original=rows[0],history=root.StocksBeta2Charts.chartHistory(data,original,adjustments),column=data.metrics.findIndex(([key])=>key==='price')+1;
 if(!column)return null;
 const points=history.company.observations.filter(point=>!original.previous?.[point[data.metrics.length+1]])
  .map(point=>[history.data.months[point[0]]?.[2],point[column]]);
 return {id:'bos',label:'BOS',basis:'BOS prices adjusted for documented splits; corrected quotation dates',
  splitAdjusted:true,splits:history.splits.length,points};
}
async function histories(item,market){
 const sources=[];
 if(market.provider==='Yahoo Finance')sources.push({id:'yahoo',label:'Yahoo',splitAdjusted:true,
  basis:'Yahoo Close: provider split-adjusted prices, not dividend-reinvested returns; older dates may be period labels',daily:market.daily,points:market.comparisonPrices||market.points||[]});
 const [saved,compact]=await Promise.all([
  archive().catch(()=>null),
  root.ShareLabData?.historyFor({id:`bb:${item.ticker}|${item.currency}`,currency:item.currency}).catch(()=>null),
 ]);
 if(saved){const bos=bosHistory(saved.data,saved.adjustments,item.ticker,item.currency);if(bos)sources.push(bos);}
 if(compact?.record?.bbTicker===item.ticker&&compact.record.currency===item.currency&&compact.record.currentEligible!==false&&compact.record.compareEligible!==false){
  const points=(compact.metrics.globalPrice||[]).filter(p=>p.currency===item.currency&&p.sourceId==='global-top100-close-2026-11-05').map(p=>[p.date,p.value]);
  if(points.length)sources.push({id:'saved',label:'Saved Close',splitAdjusted:false,
   basis:'Supplied Global Top 100 Close; adjustment convention unconfirmed; older dates may be period labels',daily:(compact.metrics.globalPrice||[]).filter(p=>p.currency===item.currency&&p.sourceId==='global-top100-close-2026-11-05'&&p.grain==='daily').map(p=>[p.date,p.value]),points});
 }
 return sources;
}
const api={histories,bosHistory};root.SIConeSources=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
