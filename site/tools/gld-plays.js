'use strict';
(() => {
  const params = new URLSearchParams(location.search);
  let replayMode = params.get('mode') === 'historical';
  function readRegime(query) {
    const id=query.get('regime'),phase=query.get('phase')??'cycle';
    return XauRegimes.periods.some(p=>p.id===id)&&Object.hasOwn(XauRegimes.phases,phase)?{id,phase}:null;
  }
  let regimeRequest=replayMode?readRegime(params):null, regimeData, gldHistory=[];
  function regimeHref(id,phase) {
    return '?mode=historical&regime='+id+'&phase='+phase+'#path-history-replay';
  }
  if (['strike','ko','guarantee','days','spot'].some(key=>params.has(key))) {
    location.replace('gld-strategy-detail.html'+location.search+location.hash);
    return;
  }

  const $ = id => document.getElementById(id);
  const node = (tag, text, cls) => {
    const e=document.createElement(tag);
    if (text != null) e.textContent=text;
    if (cls) e.className=cls;
    return e;
  };
  const button = (label, action, cls) => {const b=node('button',label,cls); b.type='button'; b.addEventListener('click',action); return b;};
  const whole=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
  const decimals=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2});
  const money=n=>whole.format(n), price=n=>decimals.format(n), num=(id,def=0)=>$(id).value===''?def:$(id).valueAsNumber;
  const pl=n=>(n>0?'+':'')+money(n), pct=n=>(n>0?'+':'')+Number(n.toFixed(2))+'%';
  const setText=(id,text)=>{$(id).textContent=text;};
  const option=(key,label)=>new Option(label,key);
  const keys=['hold','acc','roll','decu','wait','staged'];
  const pre={hold:'Buy GLD outright',acc:'Accu then hold',roll:'Accu then roll on KO',decu:'Accu then covered decu',wait:'Wait in cash',staged:'Buy in stages'};
  const post={acc:'Hold shares and cash',hold:'Add GLD outright',roll:'Roll the refund',decu:'Covered decu',wait:'Wait for a dip',staged:'Add in stages'};
  const short={hold:'Buy GLD',acc:'Accu + hold',roll:'Roll',decu:'Covered decu',wait:'Wait',staged:'Staged buys'};
  const structureKeys=['acc','roll','decu'];
  const units=()=> replayMode?'gld':$('units').value;
  const getY=(p,unit)=>unit==='xau'?p.xau:p.price;
  const unitLabel=()=>units()==='xau'?'XAU equivalent · USD/oz':'GLD · USD/share';
  const quoteId=i=>'Q'+String(i+1).padStart(2,'0');
  const quoteLabel=(q,i)=>quoteId(i)+' · '+q.months+'m · '+q.ko+'% KO · '+q.strike+'% buy · '+q.guarantee+'m guaranteed';
  const panels=new Map();
  let quotes=[], sheet, gld, xau, config, version=0;
  const overrides=new Map();

  const historical = new Map();
  const replays = new Map();
  const dateFormat = new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
  const dateLabel = day => dateFormat.format(new Date(day+'T00:00:00Z'));
  const fixingLabel = (panel,day) => panel.path.dates?dateLabel(panel.path.dates[day]):readableTime(day);
  const actionIcons = {acc:'hold',hold:'buy',roll:'roll',decu:'decu',wait:'wait',staged:'staged'};
  const icon = name => GldPlayVisuals.icon(name);
  const svgNode = (name,attributes,text) => {
    const el=document.createElementNS('http://www.w3.org/2000/svg',name);
    for(const [key,value] of Object.entries(attributes))el.setAttribute(key,value);
    if(text!=null)el.textContent=text;
    return el;
  };
  function iconLabel(text,name) {
    const label=node('span',text,'with-icon');
    label.prepend(icon(name));return label;
  }

  function historicalChart(data) {
    const fig=node('figure',null,'history-chart');
    const chart=svgNode('svg',{viewBox:'0 0 410 145',role:'img',
      'aria-label':'Recorded GLD closes in USD per share from '+dateLabel(data.first.date)+' to '+dateLabel(data.last.date)+'. Lowest subsequent close '+price(data.low.price)+' on '+dateLabel(data.low.date)+'.'});
    const start=Date.parse(data.first.date),end=Date.parse(data.last.date);
    const floor=Math.min(data.first.price,data.low.price),height=(data.high.price-floor)||1;
    const bottom=floor-.09*height,top=data.high.price+.09*height;
    const x=date=>40+355*(Date.parse(date)-start)/(end-start);
    const y=value=>13+95*(top-value)/(top-bottom);
    for(const value of [data.high.price,floor]) {
      chart.append(svgNode('line',{x1:40,x2:395,y1:y(value),y2:y(value),stroke:'#ded8c8'}),
        svgNode('text',{x:35,y:y(value)+3,'text-anchor':'end',fill:'#675f4f','font-size':11},money(value)));
    }
    chart.append(svgNode('line',{x1:40,x2:395,y1:y(data.first.price),y2:y(data.first.price),stroke:'#a19987','stroke-dasharray':'3 3'}));
    const points=data.points.map(row=>x(row.date).toFixed(2)+','+y(row.price).toFixed(2)).join(' ');
    chart.append(svgNode('polyline',{points,fill:'none',stroke:'#826326','stroke-width':2.2,'stroke-linejoin':'round'}));
    for(const [row,r,color] of [[data.first,3,'#756f61'],[data.last,3,'#756f61'],[data.low,4,'#925327']]){
      const dot=svgNode('circle',{cx:x(row.date),cy:y(row.price),r,fill:color,stroke:'#fff','stroke-width':1});
      dot.append(svgNode('title',{},dateLabel(row.date)+' · '+price(row.price)));chart.append(dot);
    }
    chart.append(svgNode('text',{x:40,y:132,fill:'#514d42','font-size':11},dateLabel(data.first.date)),
      svgNode('text',{x:395,y:132,'text-anchor':'end',fill:'#514d42','font-size':11},dateLabel(data.last.date)));
    fig.append(chart,node('figcaption','GLD closes in USD/share. The amber dot marks the period low after entry, '+price(data.low.price)+' on '+dateLabel(data.low.date)+'.'));return fig;
  }

  function historyContext(id,wasOpen) {
    const data=historical.get(id);
    if(!data)return null;
    const box=node('details',null,'history-context');box.open=Boolean(wasOpen);
    const heading=node('summary'),glance=id==='bear'||id==='recovery'?
      pct(data.lowPct)+' from entry at the low':pct(data.terminalPct)+' across the period';
    heading.append(iconLabel('GLD history','history'),node('strong',data.name),node('span','('+glance+')','history-glance'));
    const inside=node('div',null,'history-inside'),copy=node('div',null,'history-copy'),measures=node('dl',null,'history-metrics');
    copy.append(node('p',data.rationale));
    for(const [label,value,dates] of [
      ['Period return',pct(data.terminalPct),price(data.first.price)+' to '+price(data.last.price)],
      ['Deepest drawdown',pct(data.maxDrawdownPct),dateLabel(data.drawdownPeak.date)+' to '+dateLabel(data.drawdownTrough.date)]
    ]){
      const item=node('div');item.append(node('dt',label),node('dd',value),node('small',dates));measures.append(item);
    }
    const link=node('a','Source · GLD daily closes','history-link');link.href='../data/metals/gld.csv';
    const issuer=node('a','SPDR historical archive','history-link');issuer.href='https://www.spdrgoldshares.com/usa/gld/';
    copy.append(measures,link,document.createTextNode(' · '),issuer);
    if(!replayMode){
      const replay=node('a','Replay every quote on these closes','history-link history-launch');
      replay.href='?mode=historical#path-'+id;
      const next=node('p');next.append(replay);copy.append(next);
    }
    inside.append(copy,historicalChart(data));box.append(heading,inside);return box;
  }

  const choices={
    acc:'Keep the delivered GLD and the cash refund. Only the shares continue to move with gold.',
    hold:'Use cash above the reserve to buy whole GLD shares at the eligible re-entry close.',
    wait:'Keep the settled shares and cash. A dip from the KO close signals a purchase at the following close.',
    staged:'Buy a first tranche at re-entry and keep cash for a second purchase if GLD reaches the dip trigger.',
    roll:'Fund a fresh accumulator from available cash. The strike, KO and maximum purchase cost reset at re-entry.',
    decu:'Commit a covered daily sale against the shares available. Shares sold at the fixed strike earn no further GLD upside.'
  };
  let flowKey='acc', flowCase=null;
  function flowReadout(){
    $('flow-options').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.key===flowKey)));
    const output=$('flow-explanation'),link=$('flow-example');
    output.replaceChildren(node('span',choices[flowKey]));
    link.hidden=!flowCase;
    if(!flowCase)return;
    const {panel,index,day}=flowCase,run=panel.runs[index],balance=run.postKo;
    const marked=GldPlays.atDay(run,day,true).outcomes[flowKey];
    const when=panel.path.dates?dateLabel(panel.path.dates[day]):selectedPoint(panel,day).label.toLowerCase();
    const result=marked.eligible?'By '+when+', its P&L since KO is '+pl(marked.pnl)+'.':marked.status;
    const example=node('span',quoteId(index)+' on the '+panel.path.label.toLowerCase()+' path holds '+balance.shares+' shares and '+money(balance.cash)+
      ' cash at KO on '+(panel.path.dates?fixingLabel(panel,balance.day):'fixing '+balance.day)+'. '+result,'flow-numbers');
    output.append(document.createTextNode(' '),example);
    link.href='#'+panel.section.id;
  }
  function updateFlowCase(){
    flowCase=null;
    for(const panel of panels.values()){
      for(const [index,run] of panel.runs.entries()){
        if(!run.postKo)continue;
        const end=panel.path.checkpoints.find(p=>p.day>=Math.max(126,run.postKo.day+config.terms.waitDays+1));
        if(!end)continue;
        const candidate={panel,index,day:end.day};
        if(!flowCase)flowCase=candidate;
        const active=run.postKo.strategies.filter(s=>['roll','decu'].includes(s.key)&&s.events.some(e=>e.type==='open'&&e.leg===s.key&&e.day<=end.day));
        if(active.length===2){flowCase=candidate;break;}
      }
      if(flowCase)break;
    }
    flowReadout();
  }
  function initFlow(){
    for(const el of document.querySelectorAll('[data-icon]'))el.prepend(icon(el.dataset.icon));
    for(const [key,label] of [['acc','Hold GLD'],['hold','Add GLD'],['wait','Wait for a dip'],['staged','Add in stages'],['roll','Roll'],['decu','Covered decu']]){
      const b=button(label,()=>{flowKey=key;flowReadout();},'with-icon');b.prepend(icon(actionIcons[key]));b.dataset.key=key;
      $('flow-options').append(b);
    }
    $('flow-example').addEventListener('click',event=>{
      if(!flowCase)return;
      event.preventDefault();
      const {panel,index,day}=flowCase;panel.selected=index;changeDay(panel,day,true);
      panel.detail.scrollIntoView({block:'start'});panel.detail.focus({preventScroll:true});
    });
    flowReadout();
  }

  function settings() {
    const c={budget:num('budget',100000),openingShares:num('opening'),reserve:num('reserve'),waitDays:num('delay'),
      firstBuyPct:num('first-buy'),dipPct:num('dip'),maxRolls:num('max-roll'),
      decu:{strike:num('sale-strike'),ko:num('sale-ko'),days:num('sale-days'),coveragePct:num('cover'),minEntryPrice:num('trigger'),gear:Number($('gear').value)}};
    if($('roll-mode').value==='custom') c.roll={strike:num('roll-strike'),ko:num('roll-ko'),days:num('roll-days'),guaranteeDays:num('roll-g')};
    const spot=num('spot',gld?.close);
    if(!replayMode&&(!Number.isFinite(spot)||spot<=0)) throw Error('Enter a starting GLD price greater than zero.');
    if(c.reserve>c.budget) throw Error('The cash floor exceeds the starting cash budget.');
    if(c.budget===0 && !c.openingShares) throw Error('Enter a cash budget or an opening GLD holding.');
    if(c.roll && c.roll.guaranteeDays>c.roll.days) throw Error('The rollover guarantee exceeds its number of fixings.');
    return {terms:c,spot,years:Number($('years').value),xauSpot:xau?.usd_per_oz};
  }
  function pricePath(id,changes,cfg=config) {
    if(replayMode) return replays.get(id);
    return GldPlayPaths.build({id,spot:cfg.spot,years:cfg.years,xauSpot:cfg.xauSpot,overrides:changes??{}});
  }
  function simulate(path) {return quotes.map(q=>GldPlays.runQuote(config.terms,q,path.prices));}
  function snapshot(panel,day) {
    if(!panel.cache.has(day)) panel.cache.set(day,panel.runs.map(run=>GldPlays.atDay(run,day)));
    return panel.cache.get(day);
  }
  // Count genuinely shared benchmarks once, while retaining every winning quote/structure pair.
  function leaders(results, wanted) {
    let best=-Infinity;
    const wins=[];
    results.forEach(({outcomes},i)=>wanted.forEach(key=>{
      const s=outcomes[key]; if(!s.eligible) return;
      const cents=Math.round(s.pnl*100);
      if(cents>best){best=cents; wins.length=0;}
      if(cents===best && (structureKeys.includes(key)||!wins.some(w=>w.key===key))) wins.push({key,i});
    }));
    return {value:best/100,wins};
  }
  function winLabel(group,full=false) {
    if(!group.wins.length) return 'No eligible play';
    const list=[...new Set(group.wins.map(w=>w.key))].map(k=>short[k]);
    const ids=[...new Set(group.wins.filter(w=>structureKeys.includes(w.key)).map(w=>quoteId(w.i)))];
    const who=list.length>2&&!full?list[0]+' + '+(list.length-1)+' tied plays':list.join(' / ');
    if(!ids.length) return who;
    return who+' · '+(full?ids.join(', '):ids[0]+(ids.length>1?' + '+(ids.length-1)+' tied quotes':''));
  }
  function selectedPoint(panel,day) {
    if(panel.path.dates){
      const value=panel.path.prices[day];
      return {day,label:dateLabel(panel.path.dates[day]),price:value,xau:null,returnPct:(value/panel.path.prices[0]-1)*100};
    }
    const original=panel.path.checkpoints.find(p=>p.day===day);
    if(original) return original;
    const v=panel.path.prices[day],f=v/panel.path.prices[0];
    return {day,label:'Fixing '+day,price:v,xau:config.xauSpot?config.xauSpot*f:null,returnPct:(f-1)*100};
  }
  function timeline(panel) {
    const days=new Set(panel.path.checkpoints.map(p=>p.day));
    const exit=panel.runs[panel.selected].firstExit;
    if(exit) days.add(exit.day);
    days.add(panel.day);
    return [...days].sort((a,b)=>a-b).map(d=>selectedPoint(panel,d));
  }
  function stepName(panel,point) {
    const exit=panel.runs[panel.selected].firstExit;
    return (exit && exit.day===point.day ? (exit.type==='ko'?'KO · ':'Maturity · '):'')+point.label;
  }
  function changeDay(panel,day,move=false,focus=false) {
    panel.day=day;
    paint(panel);
    if(move){
      const b=panel.strip.querySelector('[aria-pressed="true"]');
      if(b){panel.strip.scrollTo({left:b.offsetLeft-panel.strip.offsetLeft-panel.strip.clientWidth/2+b.offsetWidth/2,behavior:'auto'});if(focus)b.focus({preventScroll:true});}
    }
  }
  function readableTime(day) {return day===0?'Entry':'Fixing '+day;}
  function makeChart(panel,points) {
    const svg=svgNode;
    const unit=units(),raw=panel.path.checkpoints,live=Boolean(panel.path.dates||panel.path.proxy);
    const values=live?panel.path.prices:raw.map(p=>getY(p,unit)),q=quotes[panel.selected];
    const start=values[0], exit=panel.runs[panel.selected].firstExit;
    const levels=[q.strike,q.ko].map(n=>start*n/100);
    const low=Math.max(0,Math.min(...values,...levels)*.97),high=Math.max(...values,...levels)*1.035;
    const x0=56,x1=558,top=13,bottom=111, n=values.length-1;
    const y=v=>bottom-(bottom-top)*(v-low)/(high-low||1);
    const xx=i=>x0+(x1-x0)*i/n;
    const dx=day=>{
      if(live)return xx(day);
      if(day<=0)return xx(0);
      const i=raw.findIndex(p=>p.day>=day); if(i<1)return xx(n);
      return xx(i-1+(day-raw[i-1].day)/(raw[i].day-raw[i-1].day));
    };
    const out=svg('svg',{viewBox:'0 0 578 137',role:'img','aria-label':panel.path.label+' price path in '+unitLabel()+'. Selected '+fixingLabel(panel,panel.day)});
    const textAttrs={'font-family':'system-ui,sans-serif','font-size':10,fill:'#455e51'};
    for(let i=0;i<3;i++) {
      const val=low+(high-low)*i/2;
      out.append(svg('path',{d:'M'+x0+' '+y(val)+'H'+x1,stroke:'#dce5da'}),svg('text',{...textAttrs,x:x0-5,y:y(val)+3,'text-anchor':'end'},money(val)));
    }
    const lastDay=Math.min(exit?.day??q.days,raw.at(-1).day);
    levels.forEach((v,i)=>out.append(svg('path',{d:'M'+x0+' '+y(v)+'H'+dx(lastDay),stroke:i?'#986326':'#397161','stroke-dasharray':i?'4 3':'1.5 2','stroke-width':1.5})));
    const parts=values.map((v,i)=>xx(i)+','+y(v));
    out.append(svg('polygon',{points:x0+','+bottom+' '+parts.join(' ')+' '+x1+','+bottom,fill:'#668b69','fill-opacity':.13}),
      svg('polyline',{points:parts.join(' '),stroke:'#1e654e','stroke-width':2.6,fill:'none','stroke-linejoin':'round'}));
    if(!live)raw.forEach((p,i)=>out.append(svg('circle',{cx:xx(i),cy:y(values[i]),r:2.5,fill:'#286d54'})));
    if(live&&exit?.type==='ko')out.append(svg('circle',{cx:dx(exit.day),cy:y(values[exit.day]),r:3.5,fill:'#986326'}));
    const mark=selectedPoint(panel,panel.day);
    out.append(svg('line',{x1:dx(mark.day),x2:dx(mark.day),y1:top,y2:bottom,stroke:'#536c5b','stroke-dasharray':'3 4'}),
      svg('circle',{cx:dx(mark.day),cy:y(getY(mark,unit)),r:4,fill:'#9a692c',stroke:'white','stroke-width':1.3}));
    for(const i of [0,Math.floor(n/2),n])out.append(svg('text',{...textAttrs,x:xx(i),y:130,'text-anchor':i===0?'start':i===n?'end':'middle'},panel.path.dates?dateLabel(panel.path.dates[i]):panel.path.proxy?'Fixing '+i:raw[i].label));
    panel.chart.replaceChildren(out);
  }
  function makeStrip(panel,points) {
    const left=panel.strip.scrollLeft;
    panel.strip.replaceChildren(...points.map((p,index)=>{
      const l=leaders(snapshot(panel,p.day),keys);
      const b=button('',()=>changeDay(panel,p.day,true,true),'play-step'); b.dataset.day=p.day;
      b.setAttribute('aria-pressed',String(panel.day===p.day));
      const v=getY(p,units());
      b.append(node('span',stepName(panel,p)),node('strong',price(v)),node('small',pct(p.returnPct)+' from entry'),
        node('small',p.day===0?'Starting position':winLabel(l)),node('span',p.day===0?'P&L $0':pl(l.value)+' P&L'));
      b.addEventListener('keydown',e=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
        e.preventDefault();
        const next=e.key==='Home'?0:e.key==='End'?points.length-1:Math.min(points.length-1,Math.max(0,index+(e.key==='ArrowRight'?1:-1)));
        changeDay(panel,points[next].day,true,true);
      }); return b;
    }));
    panel.strip.scrollLeft=left;
    const i=points.findIndex(p=>p.day===panel.day);
    panel.prev.disabled=i===0; panel.next.disabled=i===points.length-1;
    const exit=panel.runs[panel.selected].firstExit;
    panel.toExit.hidden=!exit;
    if(exit) panel.toExit.textContent='Go to '+(exit.type==='ko'?'KO':'maturity')+' · '+(panel.path.dates?fixingLabel(panel,exit.day):exit.day);
    panel.pick.value=String(panel.selected);
  }
  function sorted(rows,mode) {
    if(mode==='sheet')return rows;
    return rows.sort((a,b)=>b.score-a.score||a.i-b.i);
  }
  function pnlCell(s) {
    const td=node('td',pl(s.pnl),s.pnl>0?'pos':s.pnl<0?'neg':'');
    if(!s.eligible)td.append(node('small','Unavailable'));
    td.title=s.status+' Marked value '+price(s.value)+'.'; return td;
  }
  function table(panel,points) {
    const all=snapshot(panel,panel.day), type=panel.view.value, sum=type==='at';
    const columns=sum?['Saved quote','First leg',...keys.map(k=>pre[k]),'Highest P&L']:
      ['Saved quote',...panel.path.checkpoints.map(p=>panel.path.dates?fixingLabel(panel,p.day):p.label)];
    panel.thead.replaceChildren();
    const header=node('tr');
    columns.forEach((v,index)=>{
      const h=node('th');h.scope='col';
      if(sum&&index>=2&&index<2+keys.length)h.append(iconLabel(v,keys[index-2]==='hold'?'buy':keys[index-2]));
      else h.textContent=v;
      header.append(h);
    }); panel.thead.append(header);
    const policy=type==='best'?null:type;
    const rows=all.map((r,i)=>({i,r,score:sum||!policy?leadersOne(r).value:r.outcomes[policy].eligible?r.outcomes[policy].pnl:-Infinity}));
    panel.tbody.replaceChildren(...sorted(rows,panel.sort.value).map(({i,r})=>{
      const q=quotes[i],tr=node('tr'),h=node('th');h.scope='row';
      const pick=button(quoteId(i)+' · '+q.months+'m',()=>{
        panel.selected=i;paint(panel);panel.pick.focus({preventScroll:true});
      });
      pick.setAttribute('aria-pressed',String(i===panel.selected)); pick.setAttribute('aria-label','Inspect '+quoteLabel(q,i));
      h.append(pick,node('small',q.strike+'% strike · '+q.ko+'% KO'),node('small',q.guarantee+'m guaranteed'));tr.append(h);
      if(sum){
        const run=panel.runs[i], exit=run.firstExit;
        const entry=run.strategies.find(s=>s.key==='acc').events[0];
        const state=entry.type==='skip'?'Insufficient funding':exit&&exit.day<=panel.day?
          (exit.type==='ko'?'KO':'Maturity')+' · '+(panel.path.dates?fixingLabel(panel,exit.day):exit.day):'Open';
        tr.append(node('td',state),...keys.map(k=>pnlCell(r.outcomes[k])));
        const cell=node('td',r.leaders.length>1?r.leaders.length+' tied':short[r.leaders[0]]??'—','play-winner');
        cell.append(node('small',pl(leadersOne(r).value)));
        cell.title=r.leaders.map(k=>pre[k]).join(' / '); tr.append(cell);
      } else {
        for(const p of panel.path.checkpoints) {
          const s=snapshot(panel,p.day)[i];
          if(policy)tr.append(pnlCell(s.outcomes[policy]));
          else {const x=leadersOne(s),cell=node('td',pl(x.value),'play-winner');cell.append(node('small',s.leaders.length>1?s.leaders.length+' tied':short[s.leaders[0]]));cell.title=s.leaders.map(k=>pre[k]).join(' / ');tr.append(cell);}
        }
      }
      return tr;
    }));
  }
  function leadersOne(s) {return {value:s.leaders.length?s.outcomes[s.leaders[0]].pnl:0};}
  function reportLeaders(panel) {
    const results=snapshot(panel,panel.day), market=leaders(results,keys), struct=leaders(results,structureKeys);
    const metric=(label,group)=>{
      const d=node('div');d.append(node('dt',label),node('dd',group.wins.length?pl(group.value):'—'),node('small',winLabel(group))); return d;
    };
    const point=selectedPoint(panel,panel.day),mark=node('div');
    mark.append(node('dt',stepName(panel,point)),node('dd',price(point.price)),node('small','GLD per share · '+pct(point.returnPct)));
    panel.kpis.replaceChildren(mark,metric('Highest P&L · all plays',market),metric('Highest P&L · saved structures',struct));
  }
  function koExamples(panel) {
    const count=panel.runs.filter(run=>run.postKo).length, box=panel.examples;
    const heading=node('h3');heading.append(iconLabel('After KO on this path','upKO'));box.replaceChildren(heading);
    if(!count){
      box.append(node('p','None of the '+quotes.length+' initial contracts reaches its upper KO during this simulation. A covered sale can still start at maturity. Compare its P&L with holding the delivered shares in the table.','play-note'));
      return;
    }
    const examples=new Map();
    for(const point of panel.path.checkpoints){
      panel.runs.forEach((run,i)=>{
        if(!run.postKo||point.day<=run.postKo.day)return;
        const result=GldPlays.atDay(run,point.day,true), held=result.outcomes.acc.pnl;
        for(const key of result.leaders){
          if(examples.has(key))continue;
          const s=result.outcomes[key],advantage=s.pnl-held;
          const different=Object.values(result.outcomes).some(x=>x.eligible&&x.pnl<s.pnl-.005);
          if(!different || (key!=='acc'&&advantage<.005)) continue;
          examples.set(key,{i,day:point.day,label:panel.path.dates?fixingLabel(panel,point.day):point.label,advantage,pnl:s.pnl,joint:result.leaders.length>1});
        }
      });
    }
    box.append(node('p',count+' of '+quotes.length+' initial quotes knock out during the full path. '+(examples.size?'Open a case to see the first checkpoint where that action leads or ties and alternatives have different outcomes.':'At these checkpoints the eligible alternatives have no distinct advantage over keeping the settled balance.'),'play-note'));
    const choices=node('div',null,'play-choices');
    for(const [key,e] of examples){
      const b=button(post[key]+' · '+quoteId(e.i)+' · '+e.label,()=>{
        panel.selected=e.i;changeDay(panel,e.day,true);
        panel.detail.scrollIntoView({block:'start'});panel.detail.focus({preventScroll:true});
      });
      b.title=(e.joint?'Joint leader':'Leader')+' on this path. '+pl(e.pnl)+' from KO and '+pl(e.advantage)+' versus holding the KO balance.';
      b.classList.add('with-icon');b.prepend(icon(actionIcons[key]));choices.append(b);
    }
    box.append(choices);
  }
  function decision(panel) {
    const i=panel.selected,q=quotes[i],run=panel.runs[i],exit=run.firstExit,day=panel.day;
    const acc=run.strategies.find(s=>s.key==='acc'),buy=acc.events[0];
    const children=[];
    children.push(node('h3','Inside '+quoteId(i)+' · '+q.months+' months'+(panel.path.dates?' · '+fixingLabel(panel,day):'')));
    children.push(node('p','Buy strike '+price(buy.strike)+' · upper KO '+price(buy.ko)+' · '+q.days+' fixings · '+GldPlays.quoteTerms(q).guaranteeDays+
      ' estimated guaranteed fixings'+(buy.type==='open'?' · '+buy.lot+(buy.lot===1?' share':' shares')+'/fixing · maximum purchase cost '+price(buy.maxPurchaseCost)+'.':'.'),'play-note'));
    if(Number.isFinite(buy.strike)&&Number.isFinite(buy.ko)){
      children.push(GldPlayVisuals.barriers({spot:panel.path.prices[0],strike:buy.strike,ko:buy.ko,
        price:panel.path.prices[day],day,exit,opened:buy.type==='open'}));
    }
    if(buy.type==='skip'){
      children.push(node('p',buy.message+' The direct GLD and cash alternatives remain available according to their own sizing rules.','play-warning'));
    } else if(!exit||day<exit.day){
      const remaining=Math.max(0,q.days-day), del=buy.lot*day, cost=del*buy.strike;
      children.push(node('p','At '+(panel.path.dates?fixingLabel(panel,day):readableTime(day).toLowerCase())+', the first accumulator is open. '+del.toLocaleString('en-US')+' shares have accrued at the buy strike for '+money(cost)+
        '. Up to '+(remaining*buy.lot).toLocaleString('en-US')+' more shares can be bought over '+remaining+' fixings if GLD stays below '+price(buy.ko)+'.','play-summary'));
    } else {
      children.push(node('p',(exit.type==='ko'?'Upper KO':'Ordinary maturity')+' on fixing '+exit.day+(panel.path.dates?' ('+fixingLabel(panel,exit.day)+')':'')+' at GLD '+price(exit.price)+'. This leg bought '+exit.quantity+
        ' shares. Total holdings were '+exit.shares+' shares and cash was '+price(exit.cash)+', including '+price(exit.refund)+' released from funding.','play-summary'));
    }
    const inset=node('div',null,'play-detail');
    if(run.postKo && day>=exit.day){
      const marked=GldPlays.atDay(run,day,true), bench=marked.outcomes.acc;
      inset.append(node('h3','Decision after KO · '+(panel.path.dates?fixingLabel(panel,exit.day):'fixing '+exit.day)),node('p','Every choice starts with '+price(run.postKo.initialWealth)+' at KO. The figures below are additional P&L through '+(panel.path.dates?fixingLabel(panel,day):readableTime(day).toLowerCase())+'.','play-note'));
      if(marked.leaders.length){
        const top=marked.outcomes[marked.leaders[0]], spread=top.pnl-bench.pnl;
        inset.append(node('p',(marked.leaders.length===1?post[marked.leaders[0]]+' leads':marked.leaders.map(k=>post[k]).join(' / ')+' are tied')+
          ' at '+pl(top.pnl)+'. '+(spread>.004?'That is '+price(spread)+' ahead of keeping the delivered shares and cash.':'Keeping the delivered shares and cash earns the same P&L.') ,'play-summary'));
      } else inset.append(node('p','This is the KO fixing. The alternatives share the same starting balance. Move right to compare their subsequent results.','play-note'));
      const box=node('div',null,'play-scroll'),t=node('table',null,'play-table'),head=t.createTHead().insertRow(),body=t.createTBody();
      for(const l of ['Action after KO','P&L since KO','Versus holding','Status at this fixing']){const th=node('th',l);th.scope='col';head.append(th);}
      for(const key of ['acc','hold','roll','decu','wait','staged']){
        const s=marked.outcomes[key],tr=body.insertRow(),h=node('th');h.scope='row';h.append(iconLabel(post[key],actionIcons[key]));
        if(marked.leaders.includes(key))h.append(node('small',marked.leaders.length===1?'Leading play':'Joint leader','play-winner'));
        tr.append(h,pnlCell(s),node('td',pl(s.pnl-bench.pnl)),node('td',s.status));
      }
      box.tabIndex=0;box.setAttribute('aria-label','Post-KO outcome comparison');box.append(t);inset.append(box);
      const roll=run.postKo.strategies.find(s=>s.key==='roll').events.find(e=>e.leg==='roll'&&e.type==='open'&&e.day<=day);
      const sale=run.postKo.strategies.find(s=>s.key==='decu').events.find(e=>e.leg==='decu'&&e.type==='open'&&e.day<=day);
      if(roll)inset.append(node('p','Roll entry on fixing '+roll.day+' resets the strike to '+price(roll.strike)+' and commits up to '+price(roll.maxPurchaseCost)+'.','play-note'));
      if(sale)inset.append(node('p','Covered sale on fixing '+sale.day+' sets a '+price(sale.strike)+' sale strike against the original '+price(buy.strike)+' buy strike. Up to '+sale.quantity+' shares can be delivered.','play-note'));
    }else if(exit?.type==='maturity' && day>=exit.day){
      inset.append(node('p','With no upper KO before maturity, the rollover rule stops. Compare accumulating and holding with the covered-sale strategy in the quote table. A later recovery can favour the shares you retain.','play-note'));
    }else if(buy.type==='open'){
      inset.append(node('p','If the upper barrier is reached, compare holding the delivered shares, adding more, rolling or selling through a covered decumulator from the actual KO balance.','play-note'));
    }
    children.push(inset);
    const ledger=node('details',null,'play-editor');
    ledger.append(node('summary','Trade events and marked value for this quote'));
    const selector=node('select'),label=node('label','Follow a strategy'); keys.forEach(k=>selector.append(option(k,pre[k])));selector.value=panel.ledgerKey||'acc';label.append(selector);
    const toolbar=node('div',null,'play-tools');toolbar.append(label);const events=node('div');
    const displayEvents=()=>{
      panel.ledgerKey=selector.value;
      const s=run.strategies.find(s=>s.key===selector.value),asOf=GldPlays.atDay(run,day).outcomes[s.key];
      const items=s.events.filter(e=>e.day<=day);
      events.replaceChildren(node('p','Portfolio value '+price(asOf.value)+' · cumulative P&L '+pl(asOf.pnl)+'. '+asOf.status,'play-note'));
      const ul=node('ul');
      for(const e of items){ul.append(node('li',fixingLabel(panel,e.day)+' · GLD '+price(e.price)+' · '+e.message+
        ' Cash '+price(e.cash)+' and '+e.shares+' shares at this event.'));}
      events.append(ul);
      if(day===panel.path.prices.length-1)events.append(node('p','End cash '+price(s.cash)+' · GLD shares '+s.shares+' · maximum drawdown '+s.maxDrawdownPct.toFixed(1)+'%.'+
        (s.open?' Open leg has '+s.open.remainingDays+' remaining fixings.':''),'play-note'));
    };
    selector.addEventListener('change',displayEvents);displayEvents();ledger.append(toolbar,events);children.push(ledger);
    panel.detail.replaceChildren(...children);
  }
  function paint(panel) {
    const points=timeline(panel),mark=selectedPoint(panel,panel.day);
    makeChart(panel,points);makeStrip(panel,points);reportLeaders(panel);
    panel.chartCaption.textContent=(panel.path.proxy?'Gold-price proxy in USD/share · elapsed model fixings.':panel.path.dates?'Recorded GLD closes in USD/share, one per trading session.':unitLabel()+' · equally spaced checkpoints.')+' Dashed lines show '+quoteId(panel.selected)+' buy strike and upper KO during its first term.';
    if(panel.board) GldReplayBoard.select(panel.board,panel.selected,panel.day);
    if(panel.slider){
      panel.slider.value=panel.day;
      panel.dateReadout.value=fixingLabel(panel,panel.day)+' · '+price(mark.price);
      panel.slider.setAttribute('aria-valuetext',panel.dateReadout.value);
      panel.backSession.disabled=panel.day===0;
      panel.nextSession.disabled=panel.day===panel.path.prices.length-1;
    }
    panel.caption.textContent=panel.view.value==='at'?
      'Total P&L from entry at '+stepName(panel,mark)+' · '+quotes.length+' quotes. Select a row to inspect its cash, KO and next decisions below.':
      'P&L from entry at each checkpoint · '+quotes.length+' quotes. Scroll right for the later years. Rankings use the currently inspected fixing.';
    table(panel,points);decision(panel);
  }
  function editPrices(panel) {
    const fieldset=panel.editFields,unit=units(),start=unit==='xau'?config.xauSpot:config.spot;
    panel.editHeader.textContent='Edit '+(unit==='xau'?'XAU-equivalent':'GLD')+' checkpoint prices';
    fieldset.replaceChildren(...panel.path.checkpoints.slice(1).map(p=>{
      const l=node('label',p.label+(unit==='xau'?' · USD/oz':' · USD/share')),input=node('input');
      input.type='number';input.min='0';input.max='10000000';input.step='.01';input.required=true;
      input.value=getY(p,unit).toFixed(2);input.dataset.day=p.day;input.dataset.initial=input.value;l.append(input);return l;
    }));
    panel.apply.onclick=()=>{
      const candidate={...overrides.get(panel.id)};
      try {
        fieldset.querySelectorAll('input').forEach(input=>{
          if(!input.reportValidity())throw Error('Enter a valid nonnegative price for every checkpoint.');
          if(input.value!==input.dataset.initial)candidate[input.dataset.day]=100*(input.valueAsNumber/start-1);
        });
        rebuild(panel,candidate);
      }catch(e){panel.warning.hidden=false;panel.warning.textContent=e.message;}
    };
  }
  function rebuild(panel,changes) {
    const path=pricePath(panel.id,changes);
    const runs=simulate(path);
    panel.path=path;panel.runs=runs;panel.cache.clear();overrides.set(panel.id,changes);
    panel.warning.hidden=true;
    panel.desc.textContent=path.description;editPrices(panel);koExamples(panel);paint(panel);updateFlowCase();
  }
  function dailyControls(panel) {
    const bar=node('div',null,'replay-day-controls'),label=node('label',panel.path.proxy?'Inspect a model fixing':'Inspect any trading close');
    const slider=node('input'),output=node('output');
    slider.type='range';slider.min=0;slider.max=panel.path.prices.length-1;slider.step=1;
    slider.id='session-'+panel.id;output.htmlFor=slider.id;
    slider.addEventListener('input',()=>{
      output.value=fixingLabel(panel,Number(slider.value))+' · '+price(panel.path.prices[Number(slider.value)]);
      slider.setAttribute('aria-valuetext',output.value);
    });
    slider.addEventListener('change',()=>changeDay(panel,Number(slider.value),true));
    panel.slider=slider;panel.dateReadout=output;
    panel.backSession=button(panel.path.proxy?'Previous fixing':'Previous close',()=>changeDay(panel,panel.day-1,true));
    panel.nextSession=button(panel.path.proxy?'Next fixing':'Next close',()=>changeDay(panel,panel.day+1,true));
    label.append(slider);bar.append(label,output,panel.backSession,panel.nextSession);return bar;
  }
  function createPanel(path,previous) {
    const id=path.id, section=node('section',null,'play-section'); section.id='path-'+id;section.setAttribute('aria-labelledby',id+'-title');
    const p={id,path,section,runs:simulate(path),cache:new Map(),selected:previous?.selected??0,
      day:Math.min(previous?.day??(path.basis?path.prices.length-1:path.dates?0:21),path.prices.length-1),ledgerKey:previous?.ledgerKey};
    if(path.dates&&!previous&&location.hash==='#path-'+id){
      const request=new URLSearchParams(location.search),quote=request.get('quote');
      const i=quotes.findIndex((_,index)=>quoteId(index)===quote),d=path.dates.indexOf(request.get('date'));
      if(i>=0)p.selected=i;
      if(d>=0)p.day=d;
    }
    const header=node('header',null,'play-header'),box=node('div'),h=node('h2');h.append(iconLabel(path.label,path.basis?'history':id));h.id=id+'-title';
    p.desc=node('p',path.dates?dateLabel(path.dates[0])+' to '+dateLabel(path.dates.at(-1))+' · '+path.dates.length.toLocaleString('en-US')+' recorded closes · '+price(path.prices[0])+' per share at entry. '+path.description:path.description,'play-note');
    box.append(h,p.desc);header.append(box);
    if(path.basis){
      const links=node('nav',null,'play-nav');links.setAttribute('aria-label','Regime replay phases');
      const summary=XauRegimes.summarize(regimeData,regimeRequest.id);
      for(const [phase,window] of Object.entries(summary.windows)){
        const link=node('a',window.label,'history-launch');link.href=regimeHref(regimeRequest.id,phase);
        if(phase===regimeRequest.phase)link.setAttribute('aria-current','page');
        links.append(link);
      }
      const source=node('a','Back to the macro comparison');source.href='../xau-history.html#regimes';links.append(source);
      box.append(links);
    }
    p.chart=node('div',null,'play-chart');p.chartCaption=node('p',null,'play-note');
    p.strip=node('div',null,'play-strip');p.strip.setAttribute('aria-label',path.label+' timeline');
    const move=dir=>{const points=timeline(p),i=points.findIndex(x=>x.day===p.day),next=points[i+dir];if(next)changeDay(p,next.day,true);};
    p.prev=button('Earlier',()=>move(-1));p.next=button('Later',()=>move(1));p.toExit=button('Go to KO',()=>changeDay(p,p.runs[p.selected].firstExit.day,true));
    const controls=node('div',null,'play-actions');
    controls.append(p.prev,p.next,p.toExit,node('small','Swipe or use the arrow keys to move through time.','play-note'));
    const stage=node('div',null,'play-stage');stage.append(p.chart,p.chartCaption,p.strip,controls);
    const edit=node('details',null,'play-editor');p.editHeader=node('summary','Edit checkpoint prices');p.editFields=node('div',null,'play-fields');p.apply=button('Apply prices',()=>{});
    const reset=button('Restore this path',()=>rebuild(p,{}));
    const editControls=node('div',null,'play-actions');editControls.append(p.apply,reset);
    if(id==='bear')editControls.append(button('Stress to zero from month 3',()=>{
      const points=GldPlayPaths.waypoints(id,10),candidate={...overrides.get(id)};
      points.filter(x=>x.day>=63).forEach(x=>{candidate[x.day]=-100;});rebuild(p,candidate);
    }));
    p.warning=node('p',null,'play-warning');p.warning.hidden=true;p.warning.setAttribute('role','alert');
    edit.append(p.editHeader,p.editFields,editControls,p.warning);
    p.kpis=node('dl',null,'play-kpis');
    const tools=node('div',null,'play-tools');
    function selectWithLabel(text,opts) {
      const label=node('label',text),select=node('select');for(const [k,v] of opts)select.append(option(k,v));label.append(select);tools.append(label);return select;
    }
    p.pick=selectWithLabel('Inspect a quote',quotes.map((q,i)=>[i,quoteLabel(q,i)]));
    p.view=selectWithLabel('Table view',[['at','All plays at this fixing'],['best','Best P&L through time'],...keys.map(k=>[k,pre[k]+' through time'])]);
    p.view.value=previous?.view.value??'at';
    p.sort=selectWithLabel('Quote order',[['sheet','Saved sheet order'],['rank','Highest P&L first']]);p.sort.value=previous?.sort.value??'sheet';
    p.pick.addEventListener('change',()=>{p.selected=Number(p.pick.value);paint(p);});
    p.view.addEventListener('change',()=>paint(p));p.sort.addEventListener('change',()=>paint(p));
    p.caption=node('p',null,'play-note');
    const scroller=node('div',null,'play-scroll play-matrix');scroller.tabIndex=0;scroller.setAttribute('aria-label','All saved quotes for '+path.label);
    const tbl=node('table',null,'play-table');tbl.append(node('caption','All saved quotes · '+path.label,'sr-only'));p.thead=tbl.createTHead();p.tbody=tbl.createTBody();scroller.append(tbl);
    p.detail=node('div',null,'play-detail');p.detail.tabIndex=-1;p.examples=node('div',null,'play-ko-examples');
    section.append(header,stage);
    if(path.dates||path.proxy)stage.append(dailyControls(p));
    if(path.dates){
      p.board=GldReplayBoard.render({path,quotes,runs:p.runs,day:p.day,selected:p.selected,onSelect:(index,day)=>{
        p.selected=index;changeDay(p,day,true);
      }});
      const fromEntry=node('details',null,'play-editor');
      fromEntry.append(node('summary','Compare strategies from the original entry'),p.kpis,p.examples,tools,p.caption,scroller);
      section.append(p.board,p.detail,fromEntry);
    }else{
      p.historyBox=historyContext(id,previous?.historyBox?.open);
      if(p.historyBox)section.append(p.historyBox);
      if(!path.proxy){section.append(edit);editPrices(p);}
      section.append(p.kpis,p.examples,tools,p.caption,scroller,p.detail);
    }
    koExamples(p);paint(p);
    return p;
  }
  function refreshControls(){
    const enabled=$('roll-mode').value==='custom';
    $('roll-inputs').hidden=!enabled;
    $('roll-inputs').querySelectorAll('input').forEach(e=>e.disabled=!enabled);
  }
  function replayTotals(list){
    const body=$('replay-totals');body.replaceChildren();
    for(const panel of list){
      const counts={ko:0,maturity:0,open:0,unfunded:0};
      for(const run of panel.runs){
        const entry=run.strategies.find(s=>s.key==='acc').events[0];
        counts[entry.type==='skip'?'unfunded':run.firstExit?.type??'open']++;
      }
      const row=body.insertRow(),title=node('th'),url=node('a',panel.path.label);
      title.scope='row';url.href='#path-'+panel.id;title.append(url);row.append(title);
      for(const key of ['ko','maturity','open','unfunded'])row.append(node('td',String(counts[key])));
    }
  }
  async function renderAll() {
    const seq=++version, old=new Map(panels);
    $('error').hidden=true;$('csv').disabled=true;$('replay-overview').hidden=true;
    try{
      if(!quotes.length)throw Error('The saved pricing did not load. Reload to retry.');
      config=settings();
      setText('run-status',regimeRequest?'Calculating the selected historical window…':'Calculating all five timelines…');
      const next=[],missing=[];
      if(regimeRequest){
        regimeData??=await fetch('../data/metals/xau-research.json').then(r=>{
          if(!r.ok)throw Error('World Bank gold history is unavailable.');return r.json();
        }).then(data=>data.series.pink);
        if(seq!==version)return;
        const path=XauRegimes.replay({gold:regimeData,gld:gldHistory,id:regimeRequest.id,phase:regimeRequest.phase,spot:config.spot});
        if(path.basis==='Gold-price proxy'){
          path.proxy=true;path.proxyDates=path.dates;path.dates=null;
        }
        next.push(createPanel(path,old.get(path.id)));
      }
      for(const p of regimeRequest?[]:GldPlayPaths.plays) {
        await new Promise(resolve=>setTimeout(resolve,0));
        if(seq!==version)return;
        const path=pricePath(p.id,overrides.get(p.id));
        if(!path){missing.push(p.label);continue;}
        const view=createPanel(path,old.get(p.id));next.push(view);
      }
      panels.clear();next.forEach(p=>panels.set(p.id,p));$('plays').replaceChildren(...next.map(p=>p.section));
      if(replayMode&&next.length){replayTotals(next);$('replay-overview').hidden=false;}
      for(const p of next){
        const active=p.strip.querySelector('[aria-pressed="true"]');
        if(active)p.strip.scrollLeft=active.offsetLeft-p.strip.offsetLeft-(p.strip.clientWidth-active.offsetWidth)/2;
      }
      updateFlowCase();
      $('csv').disabled=!next.length;
      if(missing.length){$('error').hidden=false;setText('error','Complete daily GLD history unavailable for '+missing.join(', ')+'. Reload to retry.');}
      setText('run-status',quotes.length+' quotes × '+next.length+(replayMode?(next.length===1?' historical replay':' historical paths'):' price paths · '+config.years+' year'+(config.years===1?'':'s'))+' · '+money(config.terms.budget)+
        ($('budget').value===''?' illustrative cash':' starting cash')+'.');
    }catch(e){panels.clear();updateFlowCase();$('plays').replaceChildren();$('error').hidden=false;setText('error',e.message);setText('run-status','Check the comparison inputs.');}
  }
  function download() {
    const records=[['Price path','Quote ID','Sheet date','Issuer','Tenor months','Buy strike %','KO %','Guaranteed months','Fixing day','Checkpoint','GLD USD/share','Illustrative XAU USD/oz','Basis','Strategy','Starting value USD','Marked value USD','PnL USD','Eligible','Checkpoint leader','Status']];
    if(replayMode){records[0][9]='Trading date or model checkpoint';records[0].splice(11,1);records[0].push('Price basis');}
    for(const panel of panels.values()){
      const gridDays=panel.board?GldReplayBoard.days(panel.board):[];
      panel.runs.forEach((run,i)=>{
        const q=quotes[i],allDays=new Set([...panel.path.checkpoints.map(p=>p.day),...gridDays]);if(run.firstExit)allDays.add(run.firstExit.day);
        for(const day of [...allDays].sort((a,b)=>a-b)){
          const point=selectedPoint(panel,day);
          for(const after of [false,true]){
            if(after&&(!run.postKo||day<run.postKo.day))continue;
            const view=GldPlays.atDay(run,day,after),names=after?post:pre;
            for(const k of keys){
              const s=view.outcomes[k],row=[panel.path.label,quoteId(i),sheet.addedDate??sheet.requestDate,sheet.issuer,q.months,q.strike,q.ko,q.guarantee,day,panel.path.dates?.[day]??panel.path.proxyDates?.[day]??point.label,point.price.toFixed(2)];
              if(!replayMode)row.push(point.xau?.toFixed(2)??'');
              row.push(after?'From KO':'From entry',names[k],after?run.postKo.initialWealth:run.initialWealth,s.value,s.pnl,s.eligible,view.leaders.includes(k),s.status);
              if(replayMode)row.push(panel.path.basis??'Actual GLD daily closes');
              records.push(row);
            }
          }
        }
      });
    }
    const escape=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
    const blob=new Blob(['\ufeff'+records.map(r=>r.map(escape).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download=(replayMode?'GLD-historical-replay-':'GLD-five-plays-')+(sheet.addedDate??sheet.requestDate)+'.csv';
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function init() {
    const [q,g,x]=await Promise.allSettled([fetch('../data/metals/gld-accumulator-pricing.json',{cache:'no-cache'}).then(r=>{
      if(!r.ok)throw Error('Quote sheet unavailable.');return r.json();}),Metals.series('gld'),Metals.series('xau-spot')]);
    const series=g.status==='fulfilled'?g.value.filter(r=>r.close>0):[],gold=x.status==='fulfilled'?x.value.filter(r=>r.usd_per_oz>0):[];
    gld=series.at(-1);
    gldHistory=series.map(r=>[r.date,r.close]);
    for(const path of GldPlayPaths.plays){
      historical.set(path.id,GldPlayHistory.summarize(series,path.id));
      replays.set(path.id,GldPlayHistory.replay(series,path.id));
    }
    if(gld){
      const cutoff=new Date(gld.date+'T00:00:00Z');cutoff.setUTCFullYear(cutoff.getUTCFullYear()-1);
      const from=cutoff.toISOString().slice(0,10);
      if(series[0].date<=from){
        const peak=series.filter(row=>row.date>=from&&row.date<=gld.date).reduce((best,row)=>row.close>best.close?row:best);
        const drop=(1-gld.close/peak.close)*100;
        setText('recent-context',drop<.005?'GLD is at its one-year closing high.':'GLD is '+drop.toFixed(1)+'% below its one-year closing high of '+price(peak.close)+' on '+dateLabel(peak.date)+'.');
        $('recent-context').hidden=false;
      }
    }
    xau=gld?gold.findLast(r=>r.date===gld.date):null;
    if(gld){setText('gld-mark',price(gld.close));$('spot').placeholder=gld.close.toFixed(2);}
    if(xau)setText('xau-mark',price(xau.usd_per_oz));else $('units').options[1].disabled=true;
    setText('market-date',gld?'GLD close '+gld.date+(xau?' · same-date XAU/USD.':'. Same-date spot gold unavailable.'):'GLD reference unavailable. Enter a starting price to run the sheet.');
    if(q.status!=='fulfilled'||q.value?.kind!=='gld-accumulator-pricing'||!Array.isArray(q.value.rows))throw Error('Saved quote sheet unavailable. Reload to retry.');
    sheet=q.value;
    quotes=sheet.rows.filter(r=>r.strike!=null);
    if(!quotes.length)throw Error('The saved sheet contains no priced strikes.');
    const missing=sheet.rows.length-quotes.length, date=sheet.addedDate??sheet.requestDate;
    setText('source-title',sheet.issuer+' · '+date);setText('quote-status',quotes.length+' priced structures · '+[...new Set(quotes.map(r=>r.months))].sort((a,b)=>a-b).join(', ')+
      ' months · '+sheet.issuer+' · saved '+date+'.'+(missing?' '+missing+' unquoted rows have no simulatable strike.':''));
    setText('settlement','The saved sheet specifies '+sheet.settlementFrequency+' settlement, KO+1 '+(sheet.koPlusOne?'enabled':'disabled')+', stated offset '+sheet.offset+
      '. Guaranteed months are estimated into fixings using the quoted term. The model accrues daily, assumes delivery by the configured re-entry date and excludes the quoted offset. Confirm actual settlement and availability before reusing cash or shares.');
    modeLayout();
    await renderAll();
    if(replayMode)scrollToPath();
  }
  const originals=Object.fromEntries(['page-heading','page-lead','price-method'].map(id=>[id,$(id).innerHTML]));
  function modeLayout(){
    const active=replayMode?'history-mode':'scenario-mode',other=replayMode?'scenario-mode':'history-mode';
    $(active).setAttribute('aria-current','page');$(other).removeAttribute('aria-current');
    document.querySelectorAll('.scenario-only').forEach(label=>{
      label.hidden=replayMode;label.querySelector('input,select').disabled=replayMode;
    });
    if(replayMode){
      setText('page-heading','Historical GLD replay');
      setText('page-lead','Replay every saved quote on five recorded GLD price paths. Scroll right to find each knock-out and compare what holding, rolling, selling or adding would have earned afterward.');
      setText('price-method','Replay pricing uses one recorded GLD close per trading session. The first close sets each quote’s dollar strike and KO. Observations begin on the next session and stop at the last available close in the chosen period.');
    }else for(const [id,html] of Object.entries(originals))$(id).innerHTML=html;
    if(regimeRequest){
      setText('page-lead','Apply all saved GLD quotes to the selected XAU regime and compare the results through the chosen historical window.');
      setText('price-method','The opening replay price sets the strike and KO for each quote. Earlier windows can use a monthly gold-price proxy where GLD closes have no coverage.');
    }
    setText('replay-assumptions',regimeRequest?
      'Recorded GLD closes or a labelled monthly gold proxy set the path shown below. The model applies saved quotes and illustrative follow-on terms to that path.':
      'Each replay applies the saved quote percentages to that period’s opening GLD close. Prices are historical. Contracts, follow-on terms and P&L are hypothetical. The market references above show the latest saved closes.');
    document.title=(replayMode?'Historical GLD replay':'GLD game plan · Five price plays')+' | Market Intel';
    const nav=$('timelines');nav.replaceChildren();
    if(regimeRequest){
      const link=node('a','Selected XAU regime');link.href='#path-history-replay';nav.append(link);
    }
    for(const p of regimeRequest?[]:GldPlayPaths.plays){
      if(replayMode&&replays.size&&!replays.get(p.id))continue;
      const a=node('a',replayMode?(replays.get(p.id)?.label??p.label):p.label,'with-icon');a.prepend(icon(p.id));a.href='#path-'+p.id;nav.append(a);
    }
    $('replay-assumptions').hidden=!replayMode;
    setText('replay-period-column',regimeRequest?'Replay window':'Recorded period');
    $('replay-overview').hidden=!replayMode||!panels.size;
    $('decision-map').open=!replayMode||location.hash==='#decision-map';
  }
  function scrollToPath(){
    const id=location.hash.slice(1);
    if(id==='timelines'||id==='replay-overview'||id.startsWith('path-'))$(id)?.scrollIntoView({block:'start'});
  }
  async function changeMode(){
    const query=new URLSearchParams(location.search),requested=query.get('mode')==='historical';
    const regime=requested?readRegime(query):null;
    if(requested!==replayMode||regime?.id!==regimeRequest?.id||regime?.phase!==regimeRequest?.phase){
      replayMode=requested;regimeRequest=regime;panels.clear();modeLayout();
      if(quotes.length)await renderAll();
    }
    scrollToPath();
  }
  document.addEventListener('click',event=>{
    const a=event.target.closest('.play-modes a, a.history-launch');
    if(!a||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();history.pushState(null,'',a.href);changeMode();
  });
  window.addEventListener('popstate',changeMode);
  $('settings').addEventListener('submit',e=>{e.preventDefault();renderAll();});
  $('settings').addEventListener('input',e=>{
    refreshControls();
    if(e.target.id==='years'||e.target.id==='units'){if($('settings').checkValidity())renderAll();return;}
    setText('run-status','Inputs changed. Run all quotes to update the timelines.');
  });
  $('csv').addEventListener('click',download);
  modeLayout();
  refreshControls();
  initFlow();
  init().catch(e=>{$('error').hidden=false;setText('error',e.message);setText('run-status','Comparison unavailable.');setText('quote-status','Pricing status unavailable.');});
})();
