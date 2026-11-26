/* Shared quarterly observations, ratios and statement adapters. Values are in reporting millions. */
(function(root){
  'use strict';
  const file='shares-quarterly-core-2026-11-26.json';
  const base='https://notwins.github.io/market-intelligence-content/';
  const finite=Number.isFinite;
  const iso=/^\d{4}-\d{2}-\d{2}$/;
  const periodPattern=/^Q([1-4]) (\d{4})$/;
  const validSource=source=>typeof source==='string'&&/^https:\/\//i.test(source);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ratio=(x,y,scale=1)=>finite(x)&&finite(y)&&y>0?scale*x/y:null;
  const growth=(x,y)=>finite(x)&&finite(y)?ratio(x-y,y,100):null;
  const average=(a,b)=>finite(a)&&finite(b)&&a>0&&b>0?(a+b)/2:null;
  // Statement periods identified as cumulative by reconciling the supplied Morningstar series.
  const cumulativeVendorRows={
    "TSM US":{"Q3 2022":["financingCashFlow"]},
    "SKHY US":{"Q2 2022":["operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2023":["operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2024":["operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2025":["operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2022":["operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2023":["operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2024":["operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2025":["operatingCashFlow","investingCashFlow","financingCashFlow"]},
    "SMSN LI":{"Q2 2022":["revenue","netIncome","grossProfit","operatingIncome"],"Q2 2023":["revenue","netIncome","grossProfit","operatingIncome"],"Q2 2024":["revenue","netIncome","grossProfit","operatingIncome"],"Q2 2025":["revenue","netIncome","grossProfit","operatingIncome"],"Q4 2022":["revenue","netIncome","grossProfit","operatingIncome"],"Q4 2023":["revenue","netIncome","grossProfit","operatingIncome"],"Q4 2024":["revenue","netIncome","grossProfit","operatingIncome"],"Q4 2025":["revenue","netIncome","grossProfit","operatingIncome"]},
    "1398 HK":{"Q4 2023":["revenue","netIncome","netCommon","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2024":["revenue","netIncome","netCommon","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2025":["netIncome","netCommon","operatingCashFlow","investingCashFlow","financingCashFlow"]},
    "601398 CH":{"Q4 2023":["revenue","netIncome","netCommon","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2024":["revenue","netIncome","netCommon","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2025":["netIncome","netCommon","operatingCashFlow","investingCashFlow","financingCashFlow"]},
    "ROP SW":{"Q2 2024":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2025":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2026":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2024":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2025":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"]},
    "1288 HK":{"Q2 2022":["operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2023":["operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2024":["operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2025":["operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2022":["operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2023":["operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2024":["operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2025":["operatingCashFlow","investingCashFlow","financingCashFlow"]},
    "601288 CH":{"Q2 2022":["operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2023":["operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2024":["operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2025":["operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2022":["operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2023":["operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2024":["operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2025":["operatingCashFlow","investingCashFlow","financingCashFlow"]},
    "857 HK":{"Q2 2022":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2023":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2024":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2025":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2022":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2023":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2024":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2025":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"]},
    "601857 CH":{"Q2 2022":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2023":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2024":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2025":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2022":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2023":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2024":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2025":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"]},
    "939 HK":{"Q2 2022":["revenue","netIncome","netCommon"],"Q2 2023":["revenue","netIncome","netCommon"],"Q2 2024":["revenue","netIncome","netCommon"],"Q2 2025":["revenue","netIncome","netCommon"],"Q4 2022":["revenue","netIncome","netCommon"],"Q4 2023":["revenue","netIncome","netCommon"],"Q4 2024":["revenue","netIncome","netCommon"],"Q4 2025":["revenue","netIncome","netCommon"]},
    "601939 CH":{"Q2 2022":["revenue","netIncome","netCommon"],"Q2 2023":["revenue","netIncome","netCommon"],"Q2 2024":["revenue","netIncome","netCommon"],"Q2 2025":["revenue","netIncome","netCommon"],"Q4 2022":["revenue","netIncome","netCommon"],"Q4 2023":["revenue","netIncome","netCommon"],"Q4 2024":["revenue","netIncome","netCommon"],"Q4 2025":["revenue","netIncome","netCommon"]},
    "3988 HK":{"Q2 2022":["revenue","netIncome","netCommon","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2023":["revenue","netIncome","netCommon","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2024":["revenue","netIncome","netCommon","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2025":["revenue","netIncome","netCommon","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2026":["investingCashFlow","financingCashFlow"],"Q4 2022":["revenue","netIncome","netCommon","operatingCashFlow"],"Q4 2023":["revenue","netIncome","netCommon","operatingCashFlow"],"Q4 2024":["revenue","netIncome","netCommon","operatingCashFlow"],"Q4 2025":["revenue","netIncome","netCommon","operatingCashFlow"]},
    "601988 CH":{"Q2 2022":["revenue","netIncome","netCommon","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2023":["revenue","netIncome","netCommon","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2024":["revenue","netIncome","netCommon","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2025":["revenue","netIncome","netCommon","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2026":["investingCashFlow","financingCashFlow"],"Q4 2022":["revenue","netIncome","netCommon","operatingCashFlow"],"Q4 2023":["revenue","netIncome","netCommon","operatingCashFlow"],"Q4 2024":["revenue","netIncome","netCommon","operatingCashFlow"],"Q4 2025":["revenue","netIncome","netCommon","operatingCashFlow"]},
    "600519 CH":{"Q2 2021":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2022":["revenue","netIncome","netCommon","grossProfit","operatingIncome","investingCashFlow"],"Q2 2023":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow"],"Q2 2024":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow"],"Q2 2025":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2021":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow"],"Q4 2022":["revenue","netIncome","netCommon","grossProfit","operatingIncome"],"Q4 2023":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow"],"Q4 2024":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow"],"Q4 2025":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow"]},
    "NESN SW":{"Q2 2024":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2025":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2026":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow","capex"],"Q4 2024":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2025":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow","capex"]},
    "OR FP":{"Q2 2024":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2025":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2026":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2024":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2025":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"]},
    "941 HK":{"Q2 2023":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2023":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"]},
    "MC FP":{"Q2 2024":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2025":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2026":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2024":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2025":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"]},
    "BHP LN":{"Q2 2025":["revenue","netIncome","netCommon","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2026":["revenue","netIncome","netCommon","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2025":["revenue","netIncome","netCommon","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2026":["revenue","netIncome","netCommon","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"]},
    "BHP AU":{"Q2 2025":["revenue","netIncome","netCommon","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2026":["revenue","netIncome","netCommon","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2025":["revenue","netIncome","netCommon","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2026":["revenue","netIncome","netCommon","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"]},
    "ITX SM":{"Q4 2025":["revenue","netIncome","netCommon","grossProfit"],"Q4 2026":["revenue","netIncome","netCommon","grossProfit"]},
    "DBS SP":{"Q4 2023":["netIncome"],"Q4 2024":["netIncome"],"Q4 2025":["revenue","netIncome"]},
    "ST SP":{"Q2 2025":["revenue","netIncome","netCommon","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2026":["revenue","netIncome","netCommon","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2027":["revenue","netIncome","netCommon","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2025":["revenue","netIncome","netCommon","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2026":["revenue","netIncome","netCommon","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"]},
    "UOB SP":{"Q2 2024":["netIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2025":["netIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2026":["revenue","netIncome","netCommon","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2024":["netIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2025":["revenue","netIncome","netCommon","operatingCashFlow","investingCashFlow","financingCashFlow"]},
    "STE SP":{"Q2 2025":["revenue","netIncome","netCommon","grossProfit","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2026":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2025":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"]},
    "SGX SP":{"Q2 2025":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2026":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2025":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2026":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"]},
    "WIL SP":{"Q2 2025":["revenue","netIncome","netCommon","grossProfit","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2026":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2025":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"]},
    "CICT SP":{"Q2 2024":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2025":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2026":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow","capex"],"Q4 2024":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2025":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow","capex"]},
    "YZJSGD SP":{"Q2 2024":["revenue","netIncome","netCommon","grossProfit","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2025":["revenue","netIncome","netCommon","grossProfit","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2026":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2024":["revenue","netIncome","netCommon","grossProfit","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2025":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"]},
    "KEP SP":{"Q2 2025":["netIncome","netCommon","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q2 2026":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"],"Q4 2025":["revenue","netIncome","netCommon","grossProfit","operatingIncome","operatingCashFlow","investingCashFlow","financingCashFlow"]}
  };
  let request,data,peerRequest;
  function peerFilings(){
    const path='data/shares-quarterly-peer-filings-2026-11-26.json';
    if(!peerRequest)peerRequest=root.fetch((root.ContentDelivery?.CONTENT||base)+path,{signal:AbortSignal.timeout(12000)})
      .then(res=>{if(!res.ok)throw new Error('Quarterly peer filings unavailable');return res.json();})
      .then(doc=>doc.version===1?doc.issuers:{})
      .catch(error=>{peerRequest=null;throw error;});
    return peerRequest;
  }
  function screenVendorPeriods(record,ticker){
    const exclusions=cumulativeVendorRows[ticker];
    if(!exclusions)return record;
    const omit=(values,keys)=>{
      if(!keys?.length||!values)return values;
      const excluded=new Set(keys);
      if(keys.includes('netIncome'))excluded.add('netCommon');
      if(keys.some(k=>['operatingCashFlow','capex'].includes(k)))excluded.add('freeCashFlow');
      if(keys.some(k=>['operatingIncome','depreciationAmortization'].includes(k)))excluded.add('ebitda');
      return Object.fromEntries(Object.entries(values).filter(([key])=>!excluded.has(key)));
    };
    const observations=record.observations.map(o=>{
      const vendor=o.kind==='Morningstar';
      const excluded=vendor?exclusions[o.period]:null;
      const prior=o.period.slice(0,3)+(Number(o.period.slice(3))-1);
      const priorExcluded=vendor?exclusions[prior]:null;
      return {...o,values:omit(o.values,excluded),priorValues:omit(o.priorValues,priorExcluded),
        excluded:excluded?Object.keys(o.values||{}).filter(key=>!Object.hasOwn(omit(o.values,excluded),key)):[]};
    });
    return {...record,observations};
  }
  function load(retry=false){
    if(retry)request=null;
    if(!request)request=root.fetch((root.ContentDelivery?.CONTENT||base)+'data/'+file,{signal:AbortSignal.timeout(20000)})
      .then(response=>{if(!response.ok)throw new Error('Quarterly filings unavailable');return response.json();})
      .then(payload=>{
        if(payload?.version!==1||!iso.test(payload.asOf)||!payload.listings||Object.keys(payload.listings).length!==110)
          throw new Error('Incomplete quarterly filing snapshot');
        const issuers=new Map(),listings={};
        for(const [ticker,original] of Object.entries(payload.listings)){
          const rec=screenVendorPeriods(original,ticker);
          listings[ticker]=rec;
          if(!rec.issuer||!Array.isArray(rec.observations))continue;
          const current=rec.observations.at(-1),old=issuers.get(rec.issuer)?.observations.at(-1);
          const priority=obs=>Number(obs?.kind==='10-Q'||obs?.kind==='10-K bridge');
          if(!old||priority(current)>priority(old))issuers.set(rec.issuer,rec);
        }
        data={...payload,listings,issuers};return data;
      }).catch(error=>{request=null;throw error;});
    return request;
  }
  function listing(bundle,ticker,issuer){
    return (ticker&&Object.hasOwn(bundle?.listings||{},ticker)?bundle.listings[ticker]:null)||bundle?.issuers?.get(issuer);
  }
  function fiscalOrdinal(period){
    const match=periodPattern.exec(period||'');
    return match?4*Number(match[2])+Number(match[1])-1:NaN;
  }
  function calendarQuarter(end){
    return iso.test(end||'')?end.slice(0,4)+'-Q'+Math.ceil(Number(end.slice(5,7))/3):null;
  }
  function labelQuarter(key){
    return key?'Q'+key.slice(-1)+' '+key.slice(0,4):'';
  }
  function quarterIndex(record,annualEnd,asOf){
    const result=new Map();
    if(!record)return result;
    const observations=record.observations.filter(item=>periodPattern.test(item.period)&&validSource(item.source));
    const anchors=observations.filter(item=>iso.test(item.end||'')).map(item=>[fiscalOrdinal(item.period),item.end]);
    if(iso.test(annualEnd||'')&&!anchors.length)anchors.push([fiscalOrdinal('Q4 '+annualEnd.slice(0,4)),annualEnd]);
    const priority={'10-Q':4,'6-K':3,'Issuer quarterly results':3,'10-K bridge':2,Morningstar:1};
    for(const item of observations){
      let end=item.end;
      if(!iso.test(end||'')){
        const target=fiscalOrdinal(item.period);
        const nearest=anchors.reduce((best,anchor)=>!best||Math.abs(anchor[0]-target)<Math.abs(best[0]-target)?anchor:best,null);
        if(!nearest)continue;
        const month=Number(nearest[1].slice(5,7))-1+3*(target-nearest[0]);
        const estimate=new Date(Date.UTC(Number(nearest[1].slice(0,4)),month+1,0));
        end=estimate.toISOString().slice(0,10);
      }
      if(asOf&&end>asOf)continue;
      const calendar=calendarQuarter(end), previous=result.get(calendar);
      if(!previous||(priority[item.kind]??0)>(priority[previous.kind]??0))result.set(calendar,item);
    }
    return result;
  }
  function comparisonQuarters(indexes){
    const entries=new Map();
    for(const index of indexes)for(const [quarter,obs] of index){
      const item=entries.get(quarter)||{quarter,coverage:0,has10Q:false};
      item.coverage++;item.has10Q ||= obs.kind==='10-Q';entries.set(quarter,item);
    }
    const quarters=[...entries.values()].sort((a,b)=>b.quarter.localeCompare(a.quarter));
    const latest=quarters.find(item=>item.has10Q)||quarters[0];
    return {quarters,latest};
  }
  function verifyTrailing(trailing,observation,observations){
    if(trailing?.kind!=='Morningstar')return trailing;
    const key=period=>{const match=periodPattern.exec(period||'');return match?4*Number(match[2])+Number(match[1]):NaN;};
    const end=key(observation.period);
    const periods=[3,2,1,0].map(offset=>observations.find(item=>key(item.period)===end-offset));
    if(periods.some(item=>!item)||(trailing.period&&trailing.period!==observation.period))return null;
    const values={};
    for(const [field,reported] of Object.entries(trailing.values||{})){
      const amounts=periods.map(item=>item.values?.[field]);
      if(!finite(reported)||!amounts.every(finite))continue;
      const combined=amounts.reduce((sum,amount)=>sum+amount,0);
      if(Math.abs(combined-reported)<=Math.max(.05,Math.abs(reported)*.005))values[field]=reported;
    }
    return Object.keys(values).length?{...trailing,values}:null;
  }
  function view(record,{currency,period='latest',year,model,observation,growthBasis='yoy'}={}){
    if(!record||(currency&&record.currency!==currency))return null;
    const observations=record.observations;
    const o=observation||(period==='latest'?observations.at(-1):observations.find(v=>v.period==='Q4 '+year));
    if(!o||!periodPattern.test(o.period)||!validSource(o.source))return null;
    const [,q,fy]=periodPattern.exec(o.period);
    const prev=observations.find(v=>v.period==='Q'+q+' '+(Number(fy)-1));
    const trailingRecord=period==='latest'&&o===observations.at(-1)&&(!record.ttm?.end||!o.end||record.ttm.end===o.end)?record.ttm:null;
    const ttm=verifyTrailing(trailingRecord,o,observations);
    const values=o.values||{}, balance=o.balance||{};
    const preceding=observations.find(v=>fiscalOrdinal(v.period)===fiscalOrdinal(o.period)-1);
    const gap=o.end&&preceding?.end?(Date.parse(o.end)-Date.parse(preceding.end))/86400000:null;
    const prior=growthBasis==='qoq'?(gap===null||(gap>=75&&gap<=106)?preceding?.values||{}:{}):
      {...prev?.values,...o.priorValues};
    const endBalance={...balance,equity:balance.equity??balance.totalEquity};
    const sameQuarterEnd=o.priorQuarterBalanceEnd||o.priorBalanceEnd;
    const comparisonGap=o.end&&sameQuarterEnd?(Date.parse(o.end)-Date.parse(sameQuarterEnd))/86400000:null;
    const comparableBalance=comparisonGap>=350&&comparisonGap<=380?o.priorQuarterBalance||o.priorBalance:!o.end&&prev?o.priorBalance:null;
    const priorBalance={...prev?.balance,...comparableBalance,...o.priorYearBalance};
    const trailing=ttm?.values||{};
    const financial=['bank','insurer','broker','asset-manager','reit'].includes(model);
    const net=values.netIncome??values.netCommon;
    const cashFlow=values.operatingCashFlow;
    const fcf=values.freeCashFlow??(finite(cashFlow)&&finite(values.capex)?cashFlow-values.capex:null);
    const pct=(x,y)=>ratio(x,y,100);
    const operatingRevenue=financial?null:values.revenue;
    const trailingIncome=trailing.netIncome??trailing.netCommon;
    const cash=balance.cash, debt=balance.totalDebt, assets=balance.assets, liabilities=balance.liabilities;
    const netAssets=finite(assets)&&finite(liabilities)?assets-liabilities:null;
    const raw={
      ...values,...endBalance, netIncome:net, freeCashFlow:fcf, fcf,
      model,revenueGrowth:growth(values.revenue,prior.revenue),profitGrowth:growth(net,prior.netIncome??prior.netCommon),
      operatingMargin:pct(values.operatingIncome,operatingRevenue),netMargin:pct(net,values.revenue),
      grossMargin:pct(values.grossProfit,operatingRevenue),fcfMargin:pct(fcf,operatingRevenue),
      cashMargin:pct(cashFlow,operatingRevenue),cashFlowMargin:pct(cashFlow,operatingRevenue),
      cashConversion:financial?null:ratio(cashFlow,net),
      currentRatio:financial?null:ratio(balance.currentAssets,balance.currentLiabilities),
      cashCurrent:financial?null:pct(cash,balance.currentLiabilities),
      cashAssets:pct(cash,assets),cashDebt:financial?null:pct(cash,debt),
      cashFlowAssets:pct(cashFlow,assets),debtCoverage:financial?null:pct(trailing.operatingCashFlow,debt),
      debtAssets:pct(debt,assets),liabAssets:pct(liabilities,assets),equityAssets:pct(endBalance.equity,assets),
      equityRatio:pct(endBalance.equity,assets),netAssetsRatio:pct(netAssets,assets),
      debtEquity:financial?null:ratio(debt,endBalance.equity),
      interestCover:financial?null:ratio(trailing.operatingIncome,trailing.interestExpense),
      roe:pct(trailingIncome,average(endBalance.equity,priorBalance.equity??priorBalance.totalEquity)),
      roa:pct(trailingIncome,average(assets,priorBalance.assets)),
      assetTurnover:financial?null:ratio(trailing.revenue,average(assets,priorBalance.assets)),
      ttmRevenue:trailing.revenue,ttmNetCommon:trailing.netCommon
    };
    return {observation:o,values:raw,currency:record.currency,ttm,period:o.period,periodLabel:o.period+(o.end?' · '+o.end:''),
      kind:o.kind,source:o.source,asOf:o.filed||record.asOf||'2026-11-22',ended:o.end,
      reportBalance:balance,ytd:o.ytd,priorYtd:o.priorYtd,growthBasis};
  }
  const line=(f,...p)=>[f,p];
  const statementRows={
    income:[
      line('revenue','Total Revenue','Revenue','Revenue / Total Income','Operating Revenue','Total Revenue, as Reported','Total Revenue as Reported, Supplemental'),
      line('grossProfit','Gross Profit'),
      line('operatingIncome','Operating Income','Operating Profit','Operating Profit/Loss','Total Operating Profit/Loss'),
      line('netIncome','Net Income Attributable to Parent','Net Income to Parent','Net Income after Non-Controlling/Minority Interests'),
      line('netCommon','Net Income Available to Common Stockholders','Net Income Available to Common Shareholders'),
      line('dilutedEps','Diluted EPS','Diluted EPS, as Reported','Reported Diluted EPS','Diluted Earnings Per Share')
    ],balance:[
      line('cash','Cash and Cash Equivalents'),
      line('cashShort','Cash, Cash Equivalents and Short Term Investments'),
      line('shortInvestments','Short Term Investments'),line('restrictedCash','Restricted Cash and Cash Equivalents'),
      line('assets','Total Assets'),line('liabilities','Total Liabilities'),
      line('equity','Equity Attributable to Parent Stockholders','Stockholders’ Equity','Stockholders Equity'),
      line('totalEquity','Total Equity','Total Stockholders’ Equity'),
      line('currentAssets','Total Current Assets'),line('currentLiabilities','Total Current Liabilities'),
      line('ppe','Net Property, Plant and Equipment'),line('inventory','Inventories'),
      line('receivables','Trade and Other Receivables, Current'),line('totalDebt','Total Debt')
    ],cash:[
      line('operatingCashFlow','Cash Flow from Operating Activities','Cash Flow from/Used in Operating Activities',
        'Cash Flow from Operating Activities, Indirect','Cash Flow from/Used in Operating Activities, Direct',
        'Cash Generated from Operating Activities','Net Cash Provided by Operating Activities'),
      line('investingCashFlow','Cash Flow from Investing Activities','Cash Flow from/Used in Investing Activities'),
      line('financingCashFlow','Cash Flow from Financing Activities','Cash Flow from/Used in Financing Activities'),
      line('capex','Capital Expenditure','Capital Expenditure, Reported','Purchase of Property, Plant and Equipment'),
      line('cashFlowClosingCash','Cash and Cash Equivalents, End of Period'),line('freeCashFlow','Free Cash Flow')
    ]
  };
  function overlay(company,record){
    const latest=view(record);
    if(!latest||!company)return company;
    const stringQuarter=key=>Number(key.slice(3))*4+Number(key[1]);
    const reports={};
    for(const [kind,mapping] of Object.entries(statementRows)){
      const prior=company.quarterly?.[kind];
      const same=prior?.currency===record.currency;
      const observations=record.observations.filter(o=>periodPattern.test(o.period));
      const byKey=new Map(observations.map(o=>[o.period,o]));
      const periods=[...new Set([...(same?prior.periods.filter(p=>periodPattern.test(p)):[]),...byKey.keys()])]
        .sort((a,b)=>stringQuarter(a)-stringQuarter(b));
      const ttm=kind!=='balance'&&latest.ttm?.values;
      if(ttm&&mapping.some(([key])=>finite(ttm[key])))periods.push('TTM');
      if(!periods.length){reports[kind]=prior;continue;}
      const native=new Map(mapping.flatMap(([field,labels])=>labels.map(label=>[label.toLowerCase(),field])));
      const assigned=new Set();
      function value(o,key){
        const raw=(kind==='balance'?o?.balance:o?.values)?.[key];
        if(kind==='income'&&key==='dilutedEps')return finite(raw)?raw:null;
        return finite(raw)?raw*1e6:null;
      }
      function rowValues(series,key){
        return periods.map(p=>{
          const index=same?prior.periods.indexOf(p):-1;
          const o=p==='TTM'?{values:ttm}:byKey.get(p);
          let authoritative=key?value(o,key):null;
          if(authoritative!==null&&kind==='cash'&&key==='capex'&&series?.some(n=>n<0)&&!series.some(n=>n>0))
            authoritative=-Math.abs(authoritative);
          // Never fill the current trailing period with a conflicting historical provider observation.
          return authoritative??(p==='TTM'?null:series?.[index]??null);
        });
      }
      const rows=(same?prior.rows:[]).map(([depth,label,series])=>{
        const key=native.get(label.toLowerCase());if(key)assigned.add(key);
        return [depth,label,rowValues(series,key)];
      });
      for(const [key,labels] of mapping){
        if(assigned.has(key))continue;
        const values=rowValues(null,key);if(values.some(finite))rows.push([0,labels[0],values]);
      }
      reports[kind]=rows.length?{...prior,currency:record.currency,normalizedCurrency:true,fiscalEnd:prior?.fiscalEnd||'issuer fiscal year',periods,rows}:prior;
    }
    return {...company,quarterly:reports,coreQuarter:latest};
  }
  function card(record){
    const v=view(record);
    if(!v)return '';
    const values=v.values,n=new Intl.NumberFormat('en-SG',{maximumFractionDigits:1});
    const pct=x=>n.format(x)+'%';
    const amt=x=>v.currency+' '+n.format(x/1000)+'bn';
    const rows=[['Revenue',values.revenue,amt],['Revenue YoY',values.revenueGrowth,pct],['Net income',values.netIncome,amt],
      ['Cash and equivalents',values.cash,amt],['Liabilities / assets',values.liabAssets,pct],['Net margin',values.netMargin,pct]];
    return '<section class="fund-core-quarter" aria-label="Latest quarterly fundamentals"><h4>Latest quarterly fundamentals</h4>'
      +'<p>'+esc(v.periodLabel)+' · <a href="'+esc(v.source)+'" target="_blank" rel="noopener noreferrer">'+esc(v.kind)+'</a></p><dl>'
      +rows.filter(([,value])=>finite(value)).map(([label,value,fmt])=>'<div><dt>'+esc(label)+'</dt><dd>'+esc(fmt(value))+'</dd></div>').join('')
      +'</dl></section>';
  }
  const api={load,peerFilings,listing,view,quarterIndex,comparisonQuarters,labelQuarter,overlay,card,get data(){return data;}};
  root.SharesQuarterlyCore=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);

