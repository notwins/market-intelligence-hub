/* Dollar presentation for filings. Native values remain available for ratios and audit. */
(function (root) {
  'use strict';
  const finite = Number.isFinite;
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const names = ['AAPL-US','AMZN-US','MSFT-US','META-US','GOOG-US','TSLA-US'];
  const symbols = ['AAPL','AMZN','MSFT','META','GOOGL','TSLA'];
  const choices = Object.freeze(Object.fromEntries(names.map((id,i)=>[id,symbols[i]])));
  const money = ['revenue','grossProfit','operatingIncome','netIncome','cash','cashShort','assets','liabilities','equity','currentAssets',
    'currentLiabilities','totalDebt','operatingCashFlow','investingCashFlow','financingCashFlow','capex','freeCashFlow','fcf',
    'ttmRevenue','revenueTTM','ttmNetCommon','cap','ev','netAssets','workingCapital','netDebt','noncurrentAssets','noncurrentLiabilities'];
  const fmt = new Intl.NumberFormat('en-US',{maximumFractionDigits:0});
  function integer(value, suffix='') {
    if(!finite(value))return '—';
    return value!==0&&Math.abs(value)<.5?(value<0?'−':'')+'<1'+suffix:fmt.format(value)+suffix;
  }
  function rate(feed,currency,end) {
    const normalized=feed?.quoteUnits?.[currency]||({GBp:['GBP',.01],GBX:['GBP',.01]})[currency]||[currency,1];
    const [code,factor]=normalized;
    if(code==='USD')return {factor:1,date:end};
    const points=feed?.currencies?.[code]?.points;
    if(!iso.test(end||'')||!points?.length)return null;
    let lo=0,hi=points.length;
    while(lo<hi){const mid=(lo+hi)>>>1;if(points[mid][0]<=end)lo=mid+1;else hi=mid;}
    const point=points[lo-1];
    if(!point||!finite(point[1])||point[1]<=0)return null;
    return {factor:point[1]*factor,date:point[0]};
  }
  function convert(feed,value,currency,end) {
    if(!finite(value))return null;
    const quote=rate(feed,currency,end);
    return quote?value*quote.factor:null;
  }
  function matchedBalance(observation, filing) {
    const reported=observation?.balance?.assets, supplemental=filing?.fields?.assets;
    if(!observation?.end||observation.end!==filing?.end||!finite(reported)||!finite(supplemental))return undefined;
    return Math.abs(reported-supplemental)<=Math.max(.01,Math.abs(reported)*.00001)?filing.fields:undefined;
  }
  function scaleRows(values) {
    const difference=(a,b)=>finite(a)&&finite(b)?a-b:null;
    return {
      cashShort:finite(values.cashShort)?values.cashShort:finite(values.cash)&&finite(values.shortInvestments)?values.cash+values.shortInvestments:null,
      netDebt:difference(values.totalDebt,values.cash),
      netAssets:difference(values.assets,values.liabilities),
      workingCapital:difference(values.currentAssets,values.currentLiabilities),
      noncurrentAssets:values.noncurrentAssets??difference(values.assets,values.currentAssets),
      noncurrentLiabilities:values.noncurrentLiabilities??difference(values.liabilities,values.currentLiabilities)
    };
  }
  function valuesInUsd(feed,values,currency,end){
    return {...values,...Object.fromEntries(money.filter(key=>Object.hasOwn(values,key)).map(key=>[key,convert(feed,values[key],currency,end)]))};
  }
  function annualScale(values,factor){
    const dollar=value=>finite(value)&&finite(factor)?value*factor:null;
    return {
      assetsUsd:dollar(values.assets),netAssetsUsd:dollar(scaleRows(values).netAssets),
      cashUsd:dollar(values.cash),debtUsd:dollar(values.totalDebt),
      revenueUsd:dollar(values.revenue),cashFlowUsd:dollar(values.operatingCashFlow)
    };
  }
  function peers(focus,direct,bonus) {
    const main=[...new Set([focus,...direct])];
    return [...main,...names.filter(id=>bonus.includes(id)&&!main.includes(id))];
  }
  function quarterlyReason(metric,observation,market,model) {
    if(!observation)return 'No quarterly filing available for this period.';
    const trailing=observation.ttm?.values||{};
    if(metric==='peTTM'&&finite(trailing.netCommon)&&trailing.netCommon<=0)return 'N/M · Trailing earnings are zero or negative.';
    if(metric==='evEbitda'&&model!=='operating')return 'EV / EBITDA is unavailable for this business model.';
    if(metric==='evEbitda'&&finite(trailing.ebitda)&&trailing.ebitda<=0)return 'N/M · Trailing EBITDA is zero or negative.';
    if(metric==='peTTM'&&!finite(trailing.netCommon))return 'No verified trailing earnings for this quarter.';
    if(metric==='evEbitda'&&!finite(trailing.ebitda))return 'No verified trailing EBITDA for this quarter.';
    if(!market)return 'No matched market observation for this quarter.';
    if(observation.asOf&&market.date<observation.asOf)return 'The market snapshot predates the filing.';
    if(!finite(market.cap)||market.includesPreferred&&metric!=='evEbitda')return 'A comparable common-equity market value is unavailable.';
    if(metric==='priceBook')return 'No positive, verified common book value for this quarter.';
    if(metric==='evEbitda')return 'Enterprise value inputs are incomplete for this quarter.';
    return 'A dated market value and trailing earnings are unavailable on the same basis.';
  }
  function mergeRecord(base,addition) {
    if(!base)return addition;
    if(!addition||addition.currency!==base.currency)return base;
    const observations=new Map(base.observations.map(o=>[o.period,o]));
    for(const row of addition.observations){
      const prior=observations.get(row.period);
      const complete=prior?{...prior,...row}:{...row};
      for(const field of ['values','balance','priorValues','priorQuarterBalance','ytd','priorYtd','refs']){
        if(prior?.[field]||row[field])complete[field]={...prior?.[field],...row[field]};
      }
      observations.set(row.period,complete);
    }
    const order=period=>Number(period.slice(3))*4+Number(period[1]);
    const sorted=[...observations.values()].sort((a,b)=>order(a.period)-order(b.period));
    const trailing={...base.trailingByQuarter};
    for(const record of [base,addition]){
      const ttm=record.ttm;
      if(ttm?.values){
        const observation=ttm.end?record.observations.find(row=>row.end===ttm.end):record.observations.at(-1);
        const key=ttm.period||observation?.period;
        if(key)trailing[key]=ttm;
      }
    }
    return {...base,...addition,observations:sorted,ttm:trailing[sorted.at(-1)?.period],trailingByQuarter:trailing};
  }
  function recordForObservation(record,observation){
    const ttm=record.trailingByQuarter?.[observation.period];
    if(!ttm||record.observations.at(-1)===observation)return record;
    const through=record.observations.indexOf(observation);
    return {...record,observations:record.observations.slice(0,through+1),ttm};
  }
  const api={choices,matchedBalance,mergeRecord,recordForObservation,integer,rate,convert,scaleRows,valuesInUsd,annualScale,peers,quarterlyReason};
  root.SharesBeta3Usd=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
