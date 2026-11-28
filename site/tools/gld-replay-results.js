/* Account comparisons from the original entry, including actions begun after a KO. */
(function (root) {
  'use strict';

  const labels = Object.freeze({
    acc:'Accumulate and hold', roll:'Accumulate → roll on KO', decu:'Accumulate → covered decumulator',
    add:'Accumulate → buy more GLD after KO', dipwait:'Accumulate → wait for a dip after KO',
    dipstaged:'Accumulate → add in stages after KO', hold:'Buy and hold GLD',
    wait:'Wait in cash', staged:'Buy GLD in stages'
  });
  const order = ['hold','wait','staged','acc','decu','roll','add','dipwait','dipstaged'];
  const quoted = Object.freeze(order.slice(3));
  const extra = {add:'hold',dipwait:'wait',dipstaged:'staged'};
  const quoteId = i => 'Q' + String(i+1).padStart(2,'0');
  const fixingLabel = (path, day, format) => path.dates[day] ? format(path.dates[day]) : 'Model fixing ' + day;
  const pnl = (value, initial) => (Math.round(value*100) - Math.round(initial*100))/100;

  function account(run) {
    const accumulator = run.strategies.find(s=>s.key==='acc');
    const funded = accumulator.events[0]?.type==='open';
    const plays = new Map();
    for (const strategy of run.strategies) plays.set(strategy.key,{strategy,series:strategy.series});
    for (const [key,postKey] of Object.entries(extra)) {
      const post = run.postKo;
      const strategy = post?.strategies.find(s=>s.key===postKey);
      const activation = strategy?.events.find(e=>e.type==='buy')?.day ?? Infinity;
      const series = strategy ? accumulator.series.slice(0,post.day).concat(strategy.series) : accumulator.series;
      plays.set(key,{strategy,series,activation});
    }
    const drawdowns = new Map();
    function at(key, day) {
      const {strategy,series,activation} = plays.get(key);
      const isFollowOn = activation!==undefined;
      const state = strategy?.states.findLast(s=>s.day<=day);
      if (!drawdowns.has(series)) {
        let peak = run.initialWealth, worst = 0;
        drawdowns.set(series,Float64Array.from(series,value=>{
          peak = Math.max(peak,value);
          if(peak) worst = Math.max(worst,100*(peak-value)/peak);
          return worst;
        }));
      }
      const pending = isFollowOn && day<activation;
      const eligible = (!quoted.includes(key)||funded) && Boolean(state?.eligible) && !pending;
      return {key,eligible,pending,status:state?.status ?? 'Waiting for the first knock-out.',
        pnl:pnl(series[day],run.initialWealth),drawdown:drawdowns.get(series)[day]};
    }
    function best(day, keys = quoted) {
      return keys.map(key=>at(key,day)).filter(play=>play.eligible).sort(compare)[0];
    }
    return {funded,exit:run.firstExit,at,best};
  }

  function compare(a,b) {
    return b.pnl-a.pnl || a.drawdown-b.drawdown || order.indexOf(a.key)-order.indexOf(b.key)
      || (a.index??0)-(b.index??0);
  }
  function summarize(runs, last) {
    const accounts = runs.map(account);
    const winners = accounts.flatMap((a,index)=>{
      const best=a.best(last);
      return best?[{...best,index,exit:a.exit}]:[];
    }).sort(compare);
    const benchmark=accounts[0]?.best(last,order.slice(0,3));
    const quote=winners[0];
    const overall=[quote,benchmark].filter(Boolean).sort(compare)[0];
    return {quote,overall};
  }

  const api = Object.freeze({account,summarize,labels,quoted,quoteId,fixingLabel});
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GldReplayResults = api;
})(globalThis);

