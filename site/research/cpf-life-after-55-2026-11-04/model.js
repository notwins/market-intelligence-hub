(function (root) {
  'use strict';
  const defaults = {capital:100000, entryAge:60, startAge:65, endAge:85, raRate:0.04, payout:650, growth:0, accumulation:0.04, returnRate:0.04, inflation:0.02};
  const day=86400000, origin=Date.UTC(2026,10,1);
  const date=m=>Date.UTC(2026,10+m,1);
  function xirr(flows) {
    const nonzero=flows.filter(x=>Math.abs(x.value)>1e-10);
    if(!nonzero.some(x=>x.value<0)||!nonzero.some(x=>x.value>0)) return null;
    const start=Math.min(...nonzero.map(x=>x.date));
    const f=y=>nonzero.reduce((s,x)=>s+x.value*Math.exp(-y*(x.date-start)/day/365),0);
    let lo=-20, hi=20, flo=f(lo), fhi=f(hi);
    if(!(flo>0&&fhi<0)) return null;
    for(let i=0;i<180;i++){const mid=(lo+hi)/2;if(f(mid)>0)lo=mid;else hi=mid;}
    const r=Math.expm1((lo+hi)/2);
    return Number.isFinite(r)&&Math.abs(f(Math.log1p(r)))<Math.max(0.01,Math.abs(nonzero[0].value)*1e-7)?r:null;
  }
  function validate(p){
    for(const [k,v] of Object.entries(p)) if(!Number.isFinite(v))throw Error('Please enter a valid number for '+k+'.');
    if(p.capital<=0||p.capital>10000000)throw Error('Capital must be between S$1 and S$10 million.');
    if(!Number.isInteger(p.entryAge)||!Number.isInteger(p.startAge)||!Number.isInteger(p.endAge)||p.entryAge<55||p.startAge<p.entryAge||p.startAge>70||p.startAge<65||p.endAge<=p.entryAge||p.endAge>110)throw Error('Use whole ages: entry 55–70, payout start 65–70 and no earlier than entry, death after entry and no later than 110.');
    if(p.payout<0||p.payout>100000||p.growth<0||p.growth>0.10||p.raRate<0||p.raRate>0.10||p.accumulation<=-1||p.accumulation>0.5||p.returnRate<=-1||p.returnRate>0.5||p.inflation<0||p.inflation>0.2)throw Error('Check the rates and payout. Model ranges are intentionally bounded.');
  }
  function run(input,deathAge,sequence) {
    const p={...defaults,...input}; if(deathAge!==undefined)p.endAge=deathAge;validate(p);
    const startM=(p.startAge-p.entryAge)*12, endM=(p.endAge-p.entryAge)*12;
    const premium=p.capital*Math.pow(1+p.raRate,startM/12);
    const annuityFlows=[{date:origin,value:-p.capital}], portfolioFlows=[{date:origin,value:-p.capital}];
    let portfolio=p.capital, cumCPF=0,cumPortfolio=0,depletion=null,rows=[],lastPayout=0;
    for(let m=0;m<=endM;m++){
      if(m>0){
        let rate=m<=startM?p.accumulation:p.returnRate;
        if(sequence&&m>startM){const year=Math.floor((m-startM-1)/12);if(year<sequence.length)rate=sequence[year];}
        portfolio*=Math.pow(1+rate,1/12);
      }
      const eligible=m>=startM&&m<endM;
      const target=eligible?p.payout*Math.pow(1+p.growth,Math.floor((m-startM)/12)):0;
      const withdrawn=Math.min(Math.max(0,portfolio),target);
      portfolio=Math.max(0,portfolio-withdrawn);
      if(eligible&&withdrawn<target-1e-7&&depletion===null)depletion=p.entryAge+m/12;
      if(target){annuityFlows.push({date:date(m),value:target});lastPayout=target;}
      if(withdrawn)portfolioFlows.push({date:date(m),value:withdrawn});
      cumCPF+=target;cumPortfolio+=withdrawn;
      const refund=m<startM?p.capital*Math.pow(1+p.raRate,m/12):Math.max(0,premium-cumCPF);
      rows.push({m,age:p.entryAge+m/12,date:new Date(date(m)).toISOString().slice(0,10),cpf:target,portfolioPaid:withdrawn,cumCPF,cumPortfolio,refund,portfolio,shortfall:target-withdrawn,realPayout:target/Math.pow(1+p.inflation,m/12)});
    }
    const last=rows.at(-1), cpfEstate=[...annuityFlows,{date:date(endM),value:last.refund}],portEstate=[...portfolioFlows,{date:date(endM),value:portfolio}];
    return {params:p,rows,premium,cumCPF,cumPortfolio,refund:last.refund,portfolio,depletion,cpfXirr:xirr(cpfEstate),cpfIncomeXirr:xirr(annuityFlows),portfolioXirr:xirr(portEstate),portfolioIncomeXirr:xirr(portfolioFlows),realLastPayout:lastPayout/Math.pow(1+p.inflation,(endM-1)/12),flows:{cpf:annuityFlows,portfolio:portfolioFlows}};
  }
  const api={defaults,run,xirr,validate};
  if(typeof module!=='undefined')module.exports=api;root.CPFLifeModel=api;
})(typeof window==='undefined'?globalThis:window);
