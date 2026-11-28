/* World Bank gold regime windows and GLD replay paths. Shared by research and simulator. */
(function (root) {
  'use strict';
  const periods = [
    {id:'1980-1999',from:1980,to:1999,icon:'≋',name:'Inflation era and long decline',note:'The 1980 gold spike gave way to a long decline. Follow the dollar and inflation through the subsequent drawdown.'},
    {id:'2001-2011',from:2001,to:2011,icon:'↗',name:'The 2000s gold bull market',note:'The full period spans the 2008 crisis and the climb into 2011. Compare the crisis fall with the rebound that followed.'},
    {id:'2011-2020',from:2011,to:2020,icon:'⌁',name:'The slow recovery after 2011',note:'Gold’s return to its prior high took years. Track what changed from the 2011 peak to the 2015 trough and from the trough to recovery.'},
    {id:'2020-2022',from:2020,to:2022,icon:'◈',name:'Pandemic to tightening',note:'Compare the 2020 gold high and 2022 repricing alongside the moves in inflation and real yields.'},
    {id:'2022-2026',from:2022,to:2026,icon:'◉',name:'Gold, rates and reserves',note:'Compare the rally and its pullback against the dollar, U.S. yields and the change in official gold holdings.'}
  ];
  const phases = {cycle:'Full period',fall:'Peak to trough',rebound:'After the trough'};
  const months = date=>Number(date.slice(0,4))*12+Number(date.slice(5,7))-1;
  const stamp = n=>String(Math.floor(n/12)).padStart(4,'0')+'-'+String(n%12+1).padStart(2,'0')+'-01';
  const clean = rows=>rows.filter(([d,v])=>typeof d==='string'&&Number.isFinite(v)&&v>0).sort(([a],[b])=>a.localeCompare(b));

  function dateWindow(id) {
    const match=/^dates:(\d{4}-(?:0[1-9]|1[0-2])):(\d{4}-(?:0[1-9]|1[0-2]))$/.exec(id);
    if(!match)return null;
    const [,start,end]=match, elapsed=months(end)-months(start);
    return elapsed>=1&&elapsed<=36?{start:start+'-01',end:end+'-01',label:'Selected calendar window'}:null;
  }

  function summarize(rows, id) {
    const selected=dateWindow(id);
    if(selected){
      const points=clean(rows).filter(([d])=>d>=selected.start&&d<=selected.end);
      if(points[0]?.[0]!==selected.start||points.at(-1)?.[0]!==selected.end)return null;
      return {period:{id,name:'Gold drawdown analog'},points,windows:{cycle:selected}};
    }
    const period=periods.find(p=>p.id===id);
    if(!period)return null;
    const points=clean(rows).filter(([d])=>d>=period.from+'-01-01'&&d<=period.to+'-12-31');
    if(points.length<2)return null;
    let high=points[0], peak=high, low=high, drop=0;
    for(const p of points){
      if(p[1]>high[1])high=p;
      const move=p[1]/high[1]-1;
      if(move<drop){drop=move;peak=high;low=p;}
    }
    const first=points[0],last=points.at(-1);
    const recovery=drop<0 ? points.find(p=>p[0]>low[0]&&p[1]>=peak[1]) : undefined;
    const windows={cycle:{start:first[0],end:last[0],label:phases.cycle}};
    if(drop<0)windows.fall={start:peak[0],end:low[0],label:phases.fall};
    if(drop<0&&low[0]<last[0])windows.rebound={start:low[0],end:(recovery??last)[0],label:recovery?'Trough to recovery':phases.rebound};
    return {period,points,windows,drop:drop*100,peak,low,recovery};
  }
  function replay({gold, gld, id, phase, spot, xauSpot}) {
    const summary=summarize(gold,id), window=summary?.windows[phase];
    if(!window)throw Error('Choose a period and replay window with recorded gold history.');
    const end = stamp(months(window.end)+1);
    const rows=clean(gld);
    const actual=rows.length>1 && months(rows[0][0])<=months(window.start) && months(rows.at(-1)[0])>=months(window.end);
    const firstMonthEnd=stamp(months(window.start)+1);
    const entry=actual?rows.findLast(([d])=>d>=window.start&&d<firstMonthEnd):null;
    const recorded=entry?rows.filter(([d])=>d>=entry[0]&&d<end):[];
    const canUseActual=recorded.length>1&&months(recorded[0][0])===months(window.start)&&months(recorded.at(-1)[0])===months(window.end);
    let prices, dates;
    if(canUseActual){
      dates=recorded.map(p=>p[0]);prices=recorded.map(p=>p[1]);
    }else{
      if(dateWindow(id))throw Error('GLD daily closes are unavailable at a boundary of this selected window.');
      if(window.start>=rows[0]?.[0] && rows.at(-1)?.[0]>=window.end)
        throw Error('GLD history is incomplete at one of the replay boundaries.');
      if(!Number.isFinite(spot)||spot<.01)throw Error('Enter a GLD starting price to use the gold-price proxy.');
      const points=summary.points.filter(p=>p[0]>=window.start&&p[0]<=window.end);
      prices=[spot];dates=[window.start];
      for(let i=1;i<points.length;i++){
        const interval=months(points[i][0])-months(points[i-1][0]);
        if(interval!==1)throw Error('Gold monthly history has a gap in the selected replay.');
        const past=spot*points[i-1][1]/points[0][1], next=spot*points[i][1]/points[0][1];
        for(let step=1;step<=21;step++){
          prices.push(past+(next-past)*step/21);dates.push(step===21?points[i][0]:null);
        }
      }
    }
    const mark = new Map([[0,'Entry'],[prices.length-1,'End']]);
    for(const day of [5,21,63,126,252,504,756,1260,2520,3780]){
      if(day<prices.length-1)mark.set(day,day===5?'Week 1':day<252?'Month '+day/21:'Year '+day/252);
    }
    // The replay series may have different extrema from the underlying monthly gold.
    const minimum=prices.indexOf(Math.min(...prices)),maximum=prices.indexOf(Math.max(...prices));
    for(const [day,label] of [[minimum,'Lowest close'],[maximum,'Highest close']]){
      if(!mark.has(day))mark.set(day,label);
    }
    const checkpoints=[...mark].sort(([a],[b])=>a-b).map(([day,label])=>({
      day,label,price:prices[day],returnPct:100*(prices[day]/prices[0]-1),
      xau:Number.isFinite(xauSpot)?xauSpot*prices[day]/prices[0]:null
    }));
    return {
      id:'history-replay', label:summary.period.name+' · '+window.label, prices, dates, checkpoints, window, phase, replay:true,
      basis:canUseActual?'Actual GLD daily closes':'Gold-price proxy',
      description:canUseActual?'Actual GLD closes from '+dates[0]+' to '+dates.at(-1)+'. The last closes of the boundary months set the entry and exit. Saved quotes are tested hypothetically at entry.':
        'World Bank gold monthly averages from '+window.start.slice(0,7)+' to '+window.end.slice(0,7)+' scaled to a GLD entry price of $'+spot.toFixed(2)+'. The model interpolates 21 fixings per month. Any KO occurs on a model fixing.'
    };
  }

  const api={periods,phases,dateWindow,summarize,replay};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.XauRegimes=api;
})(globalThis);
