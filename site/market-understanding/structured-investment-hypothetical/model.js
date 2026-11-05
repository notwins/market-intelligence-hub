'use strict';
/* Independently authored teaching examples. No source trade records are used. */
(function(root){
  const seeds = [
    ['HYP-01','2026-01-06',['MSFT','AMZN'],'SGD',6,5.9,72.2,99.2,57.4],
    ['HYP-02','2026-01-09',['NVDA','META'],'USD',9,11.6,81.2,104.2,61.4],
    ['HYP-03','2026-01-12',['GOOGL','WMT'],'SGD',12,6.4,76.3,97.5,51.2],
    ['HYP-04','2026-01-15',['JPM','MSFT'],'USD',6,7.7,84.4,98.1,66.2],
    ['HYP-05','2026-01-20',['AMZN','META','WMT'],'SGD',9,8.5,78.1,96.2,62.7],
    ['HYP-06','2026-01-23',['NVDA','GOOGL','JPM'],'USD',12,10.3,86.2,101.8,69.1],
    ['HYP-07','2026-01-26',['WMT','MSFT'],'SGD',9,4.8,71.5,95.2,50.8],
    ['HYP-08','2026-01-29',['META','JPM'],'USD',6,9.6,82.8,102.1,65.8],
    ['HYP-09','2026-02-03',['AMZN','GOOGL'],'SGD',12,7.8,77.6,99.1,58.9],
    ['HYP-10','2026-02-06',['NVDA','WMT','MSFT'],'USD',9,12.5,88.1,106.1,73.1],
    ['HYP-11','2026-02-10',['META','MSFT','GOOGL'],'SGD',12,9.4,80.3,100.4,64.3],
    ['HYP-12','2026-02-13',['JPM','AMZN','WMT'],'USD',6,6.9,74.8,96.8,54.7]
  ];
  const roundTerms = x => ({coupon_pct:Math.floor(x.coupon_pct),strike_pct:Math.ceil(x.strike_pct),ko_pct:Math.ceil(x.ko_pct),ki_pct:Math.ceil(x.ki_pct)});
  const rows = seeds.map(s => Object.freeze({id:s[0],example_trade_date:s[1],shares:Object.freeze(s[2]),ccy:s[3],tenor_months:s[4],...roundTerms({coupon_pct:s[5],strike_pct:s[6],ko_pct:s[7],ki_pct:s[8]}),hypothetical:true,pricing_enabled:false}));
  const filterRows = (data, f={}) => data.filter(r => (!f.shares?.length || (f.mode==='all' ? f.shares.every(t=>r.shares.includes(t)) : f.shares.some(t=>r.shares.includes(t)))) && (!f.ccy||r.ccy===f.ccy) && (!f.tenor||r.tenor_months===Number(f.tenor)) && (!f.dateFrom||r.example_trade_date>=f.dateFrom) && (!f.dateTo||r.example_trade_date<=f.dateTo) && (f.couponMin==null||r.coupon_pct>=f.couponMin));
  const api = {rows:Object.freeze(rows),roundTerms,filterRows};
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.SIHypothetical=api;
})(typeof window!=='undefined'?window:globalThis);
