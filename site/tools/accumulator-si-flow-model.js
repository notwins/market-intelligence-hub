'use strict';
function calculate(c,prices){
 const n=c.months,q=c.shares,k=c.strike,capital=n*q*k,barrier=c.spot*c.ko/100,rate=c.interest?Math.max(0,c.rate-c.spread/100):0,idx=prices.slice(0,n).findIndex(p=>p>=barrier-1e-9),hit=idx>=0,exit=hit?idx+1:n;
 let cash=capital,totalShares=0,refund=0,interest=0,potential=0,cost=0;
 const tranches=Array.from({length:n},(_,i)=>({m:i+1,shares:0,duration:Math.min(i+1,exit)})),rows=[];
 for(let m=1;m<=n;m++){
  if(m>exit){rows.push({m,event:"After KO",price:prices[m-1],open:0,shares:0,cost:0,refund:0,close:0,interest:0});continue;}
  const open=cash,credit=open*rate/1200,indicative=open*Math.max(0,c.rate-c.spread/100)/1200;
  let shares=q,event=m===n?"Maturity":"Accumulate";
  if(hit&&m===exit){shares=Math.min((n-m+1)*q,Math.max(Math.floor(q*c.fraction/100),Math.min(n,c.guarantee)*q-totalShares,0));event=shares>Math.floor(q*c.fraction/100)?"KO + minimum":"KO";}
  let left=shares;
  for(let i=m-1;i<n&&left>0;i++){const take=Math.min(q-tranches[i].shares,left);tranches[i].shares+=take;left-=take;}
  const paid=shares*k;cash-=paid;const back=m===exit?Math.max(0,cash):0;cash-=back;if(Math.abs(cash)<1e-7)cash=0;
  totalShares+=shares;refund+=back;cost+=paid;interest+=credit;potential+=indicative;
  rows.push({m,event,price:prices[m-1],open,shares,cost:paid,refund:back,close:cash,interest:credit});
 }
 for(const t of tranches)t.interest=q*k*rate*t.duration/1200;
 const result={capital,barrier,rate,hit,exit,totalShares,refund,interest,potential,cost,rows,tranches,exposure:tranches.reduce((s,t)=>s+q*k*t.duration,0)};
 return {...result,...valueAtSale(result,c.valuation==="manual"?c.sale:prices[exit-1])};
}

function valueAtSale(result, price) {
 const shareValue = result.totalShares * price;
 const equityPnL = shareValue - result.cost;
 return {
  price, shareValue, equityPnL,
  pnl: equityPnL + result.interest,
  finalValue: shareValue + result.refund + result.interest
 };
}

function exitSensitivity(result, step, initialPrice) {
 const zeroBase = result.price === 0;
 return (zeroBase ? [0, 1, 2, 3, 4] : [-2, -1, 0, 1, 2]).map(index => {
  const change = index * step;
  const price = zeroBase ? initialPrice * change / 100 : result.price * (1 + change / 100);
  return {change, ...valueAtSale(result, price)};
 });
}

if(typeof module==='object'&&module.exports)module.exports={calculate,exitSensitivity};
