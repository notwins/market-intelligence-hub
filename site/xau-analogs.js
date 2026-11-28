'use strict';
(function (root) {
  const rankNames = {macro:'Macro changes', beta:'Beta profile'};
  const horizons = [1,3,6,12];
  const key = d=>d.slice(0,7);
  const ordinal = d=>Number(d.slice(0,4))*12+Number(d.slice(5,7))-1;
  const shift = (date,n)=>{
    const target=ordinal(date)+n;
    return Math.floor(target/12)+'-'+String(target%12+1).padStart(2,'0');
  };
  const valid = Number.isFinite;
  const pct = (a,b)=>a>0&&valid(b)?100*(b/a-1):null;
  const average = vals=>vals.reduce((sum,v)=>sum+v,0)/vals.length;

  function monthlyAverage(points) {
    const months=new Map();
    for(const [date,value] of points){
      const month=key(date);
      if(!valid(value))continue;
      if(!months.has(month))months.set(month,[]);
      months.get(month).push(value);
    }
    return new Map([...months].map(([date,values])=>[date,average(values)]));
  }

  function factors({snapshot, labor}) {
    const monthly=points=>new Map(points.map(([date,value])=>[key(date),value]));
    const fred=snapshot.fred;
    const define=(id,label,short,unit,weight,points,url)=>({
      id,label,short,unit,weight,points,url,delta:unit==='%'?pct:(a,b)=>valid(a)&&valid(b)?b-a:null
    });
    const cpiLevel=monthly(fred.CPIAUCSL);
    const inflation=new Map([...cpiLevel].flatMap(([month,value])=>{
      const before=cpiLevel.get(shift(month,-3));
      const rate=before>0?100*((value/before)**4-1):null;
      return valid(rate)?[[month,rate]]:[];
    }));
    return [
      define('dollar','Broad U.S. dollar','Dollar','%',.2,monthlyAverage(fred.DTWEXBGS),'https://fred.stlouisfed.org/series/DTWEXBGS'),
      define('fed','Effective fed funds rate','Fed funds','pp',.2,monthlyAverage(fred.EFFR),'https://fred.stlouisfed.org/series/EFFR'),
      define('nominal','U.S. 10Y nominal yield','10Y nominal','pp',.1,monthly(fred.GS10),'https://fred.stlouisfed.org/series/GS10'),
      define('real','U.S. 10Y real yield','10Y real','pp',.1,monthlyAverage(fred.DFII10),'https://fred.stlouisfed.org/series/DFII10'),
      define('cpi','U.S. CPI inflation, 3-month annualized','CPI','pp',.2,inflation,'https://fred.stlouisfed.org/series/CPIAUCSL'),
      define('jobs','U.S. unemployment rate','Unemployment','pp',.1,monthly(labor?.UNRATE??[]),'https://fred.stlouisfed.org/series/UNRATE'),
      define('payroll','U.S. nonfarm payrolls','Payrolls','%',.1,monthly(labor?.PAYEMS??[]),'https://fred.stlouisfed.org/series/PAYEMS')
    ];
  }

  function fit(gold, spec, end) {
    const points=Array.from({length:36},(_,i)=>shift(end,i-35)).flatMap(month=>{
      const before=shift(month,-1);
      const x=spec.delta(spec.points.get(before),spec.points.get(month));
      const y=pct(gold.get(before),gold.get(month));
      return valid(x)&&valid(y)?[[x,y]]:[];
    });
    const n=points.length;
    if(n<24)return {n,beta:null,r:null};
    const [mx,my]=[0,1].map(i=>average(points.map(p=>p[i])));
    let xx=0,yy=0,xy=0;
    for(const [x,y] of points){xx+=(x-mx)**2;yy+=(y-my)**2;xy+=(x-mx)*(y-my);}
    return {n,beta:xx>1e-12?xy/xx:null,r:xx*yy>1e-12?Math.max(-1,Math.min(1,xy/Math.sqrt(xx*yy))):null};
  }

  function next(gold,end,peak) {
    const base=gold.get(end);
    const path=Array.from({length:12},(_,i)=>gold.get(shift(end,i+1)));
    const low=path.filter(valid);
    const recovery=path.findIndex(v=>v>=peak);
    return {returns:horizons.map(n=>pct(base,path[n-1])),lowest:low.length?Math.min(0,pct(base,Math.min(...low))):null,
      recovery:recovery<0?null:recovery+1};
  }

  function spotDrawdown(spot) {
    const closes=spot.filter(([d,v])=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&valid(v)&&v>0);
    const last=closes.at(-1);
    if(!last)return null;
    const floor=new Date(last[0]+'T00:00:00Z');
    floor.setUTCFullYear(floor.getUTCFullYear()-1);
    const peak=closes.filter(([date])=>date>=floor.toISOString().slice(0,10)).reduce((a,b)=>b[1]>=a[1]?b:a);
    return {peak,last,move:pct(peak[1],last[1])};
  }

  function study({snapshot,labor,spot=[]}) {
    const source=snapshot.series.pink, gold=new Map(source.map(([d,v])=>[key(d),v]));
    const specs=factors({snapshot,labor});
    const endOfGold=key(source.at(-1)[0]);
    const deltas=(start,end)=>specs.map(s=>s.delta(s.points.get(start),s.points.get(end)));
    const full=month=>specs.every(s=>valid(s.points.get(month)));
    const end=source.findLast(([d])=>full(key(d)));
    if(!end)return null;
    const peak=source.filter(([d])=>ordinal(end[0])-ordinal(d)<24&&d<=end[0]).reduce((a,b)=>b[1]>=a[1]?b:a);
    const elapsed=ordinal(end[0])-ordinal(peak[0]), recentFrom=key(peak[0]), recentTo=key(end[0]);
    const recent={start:recentFrom,end:recentTo,move:pct(peak[1],end[1]),changes:deltas(recentFrom,recentTo),
      fits:specs.map(s=>fit(gold,s,recentTo))};
    if(elapsed<1||!recent.changes.every(valid))return null;
    const lowBound=Math.max(8,-recent.move*.55), highBound=-recent.move+15;
    const shortest=Math.max(2,elapsed-1),longest=elapsed+1;
    const historicalWindows=[], episodes=[];
    const oldest=[...specs[0].points.keys()][0];
    for(let i=3;i<source.length-shortest;i++){
      const [d,startPrice]=source[i],start=key(d);
      if(start<oldest)continue;
      for(let length=shortest;length<=longest;length++){
        const endpoint=shift(start,length),endPrice=gold.get(endpoint);
        if(endpoint>=recentFrom||!valid(endPrice))continue;
        const changes=deltas(start,endpoint);
        if(!changes.every(valid))continue;
        historicalWindows.push(changes);
        const window=source.slice(i,i+length+1);
        if(window.length!==length+1||key(window.at(-1)[0])!==endpoint)continue;
        const decline=-pct(startPrice,endPrice),low=Math.min(...window.map(p=>p[1]));
        const hasHigher=source.slice(i-3,i+length+1).some(p=>p[1]>startPrice);
        if(decline<lowBound||decline>highBound||hasHigher||100*(endPrice-low)/startPrice>3||!gold.has(shift(endpoint,12)))continue;
        episodes.push({start,end:endpoint,length,move:-decline,changes,fits:specs.map(s=>fit(gold,s,endpoint)),
          aftermath:next(gold,endpoint,startPrice)});
      }
    }
    if(historicalWindows.length<24)return null;
    const scales=specs.map((_,i)=>{
      const values=historicalWindows.map(row=>row[i]),mean=average(values);
      return Math.sqrt(average(values.map(v=>(v-mean)**2)))||1;
    });
    function distance(a,b,divisors) {
      let total=0,weight=0;
      for(const [i,s] of specs.entries()){
        if(!valid(a[i])||!valid(b[i]))continue;
        total+=s.weight*((a[i]-b[i])/divisors[i])**2;
        weight+=s.weight;
      }
      return weight>=.75?Math.sqrt(total/weight):null;
    }
    for(const episode of episodes){
      episode.macro=distance(episode.changes,recent.changes,scales);
      episode.beta=distance(episode.fits.map(f=>f.r),recent.fits.map(f=>f.r),specs.map(()=>1));
    }
    return {recent,episodes,specs,gold,elapsed,shortest,longest,lowBound,highBound,endOfGold,spot:spotDrawdown(spot),calibration:historicalWindows.length};
  }

  function ranked(episodes, measure) {
    const results=[];
    for(const row of episodes.filter(e=>valid(e[measure])).sort((a,b)=>a[measure]-b[measure]||a.end.localeCompare(b.end))){
      if(results.some(item=>item.start<=row.end&&item.end>=row.start))continue;
      results.push(row);
    }
    return results;
  }

  function mount(container, sources) {
    const result=study(sources);
    const body=container.querySelector('#xa-results'), headline=container.querySelector('#xa-status');
    if(!result){
      headline.textContent='The analog comparison needs the monthly gold, rates, inflation and labor archives.';
      return;
    }
    const {recent,episodes,specs,gold,elapsed,shortest,longest,lowBound,highBound,spot,calibration}=result;
    const fmt=new Intl.NumberFormat('en-US',{maximumFractionDigits:2});
    const monthFmt=new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric',timeZone:'UTC'});
    const dateFmt=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
    const month=d=>monthFmt.format(new Date(d+'-01T00:00:00Z'));
    const date=d=>dateFmt.format(new Date(d+'T00:00:00Z'));
    const signed=(value,digits=2)=>!valid(value)?'—':(value>=.5*10**-digits?'+':'')+(Math.abs(value)<.5*10**-digits?0:value).toFixed(digits);
    const percent=value=>valid(value)?signed(value)+'%':'—';
    const make=(tag,text,cls)=>{
      const n=document.createElement(tag);
      if(text!=null)n.textContent=text;
      if(cls)n.className=cls;
      return n;
    };
    const link=(label,href)=>{const a=make('a',label);a.href=href;return a;};
    const svg=(tag,attrs,text)=>{
      const n=document.createElementNS('http://www.w3.org/2000/svg',tag);
      for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);
      if(text!=null)n.textContent=text;
      return n;
    };
    const range=row=>month(row.start)+' – '+month(row.end);
    const replay=(label,from,to)=>{
      const params=new URLSearchParams({mode:'historical',regime:'dates:'+from+':'+to,phase:'cycle'});
      return link(label,'tools/gld-strategy.html?'+params+'#path-history-replay');
    };
    const valueText=(v,unit)=>valid(v)?signed(v)+(unit==='%'?'%':' '+unit):'—';
    headline.textContent='Matched monthly window '+range(recent)+' · '+elapsed+' months. The comparison uses dates with the full macro basket.';
    const latest=container.querySelector('#xa-latest'), cards=[];
    const stat=(label,value,note)=>{
      const card=make('div');card.append(make('dt',label),make('dd',value),make('small',note));return card;
    };
    cards.push(stat('Monthly gold move',percent(recent.move),'World Bank monthly averages · '+range(recent)));
    if(spot)cards.push(stat('Latest spot drawdown',percent(spot.move),'From '+date(spot.peak[0])+' to '+date(spot.last[0])+' · daily closes'));
    cards.push(stat('Historical candidates',String(episodes.length),'Before overlap removal · common modern macro coverage'));
    latest.replaceChildren(...cards);
    container.querySelector('#xa-reference-link').replaceChildren(replay('Replay the recent matched window in GLD',recent.start,recent.end));
    container.querySelector('#xa-method-range').textContent=
      'We use the highest monthly gold price in the last 24 months of shared data as the reference peak. Eligible historical falls span '+shortest+' to '+longest+
      ' months and lose '+fmt.format(lowBound)+'% to '+fmt.format(highBound)+
      '%. They begin at a high versus the prior three months and the match window. The endpoint must be within 3% of its starting price above the lowest price inside the window. We keep the closer match where windows overlap. The macro scale comes from '+calibration+' past windows of comparable lengths.';

    function label(row,i){
      return i===0?'Recent fall':range(row);
    }

    function table(parent, rows, definitions, caption) {
      const t=make('table');
      t.createCaption().textContent=caption;
      const top=t.createTHead().insertRow();
      for(const [i,item] of ['Indicator / result',...rows.map(label)].entries()){
        const th=make('th',item);th.scope='col';
        if(i>0&&i===1)th.classList.add('xa-reference');
        top.append(th);
      }
      const b=t.createTBody();
      for(const def of definitions){
        const row=b.insertRow(),th=make('th',def.title);th.scope='row';row.append(th);
        rows.forEach((item,i)=>{
          const interpretation=def.read(item,i);
          const cell=row.insertCell();
          if(i===0)cell.classList.add('xa-reference');
          if(interpretation instanceof Node)cell.append(interpretation);else cell.textContent=interpretation;
        });
      }
      parent.replaceChildren(t);
    }

    function aftermath(rows) {
      const stats=rows.map(row=>row.aftermath??next(gold,row.end,gold.get(row.start)));
      table(container.querySelector('#xa-after'),rows,[
        ...horizons.map((n,j)=>({title:'Gold after '+n+' month'+(n===1?'':'s'),read:(r,i)=>percent(stats[i].returns[j])})),
        {title:'Deepest further dip · next 12 months',read:(r,i)=>percent(stats[i].lowest)},
        {title:'Prior peak within 12 months',read:(r,i)=>stats[i].recovery?stats[i].recovery+' months':valid(stats[i].returns.at(-1))?'Still below at 12 months':'—'},
        {title:'Open GLD game plan',read:(row,i)=>{
          const actions=make('div',null,'xa-links');
          actions.append(replay('Replay the fall',row.start,row.end));
          if(i>0)actions.append(replay('Replay the next 12 months',row.end,shift(row.end,12)));
          return actions;
        }}
      ],'Returns from each matched endpoint');
    }

    const colors=['#9b6929','#14746a','#315e93','#873b65','#7a4b2e','#545480','#496137','#945044'];
    const color=i=>colors[i]??'hsl('+((i*137)%360)+' 44% 35%)';
    function chart(rows) {
      const dates=Array.from({length:longest+13},(_,i)=>i-longest);
      const lanes=rows.map((r,i)=>({
        row:r,i,points:new Map(dates.flatMap(m=>{
          const point=m<-(r.length??elapsed)?undefined:gold.get(shift(r.end,m));
          return valid(point)?[[m,100*point/gold.get(r.end)]]:[];
        }))
      }));
      const min=Math.floor(Math.min(...lanes.flatMap(s=>[...s.points.values()]))/10)*10;
      const max=Math.ceil(Math.max(...lanes.flatMap(s=>[...s.points.values()]))/10)*10;
      const legend=container.querySelector('#xa-legend');
      legend.replaceChildren(...lanes.map(l=>{
        const tag=make('span',l.i===0?'Recent fall':month(l.row.end),'xa-key');
        tag.style.setProperty('--xa-color',color(l.i));
        return tag;
      }));
      root.XauChartUi.draw(container.querySelector('#xa-chart'),width=>{
        const left=46,right=width-19,top=20,bottom=width<500?215:275;
        const x=m=>left+(right-left)*(m+longest)/(longest+12),y=v=>bottom-(bottom-top)*(v-min)/(max-min||1);
        const figure=svg('svg',{viewBox:'0 0 '+width+' '+(bottom+34),role:'img','aria-label':'Gold before and after each match month, indexed to 100 at the match'});
        figure.append(svg('rect',{x:x(0),y:top,width:right-x(0),height:bottom-top,fill:'#edf5f1'}));
        for(const t of [...new Set([100,...Array.from({length:Math.floor((max-min)/20)+1},(_,i)=>min+i*20)])].sort((a,b)=>a-b)){
          figure.append(svg('path',{class:'grid',d:'M'+left+' '+y(t)+'H'+right}),
            svg('text',{x:left-7,y:y(t)+4,'text-anchor':'end'},String(t)));
        }
        figure.append(svg('line',{x1:x(0),x2:x(0),y1:top,y2:bottom,class:'xa-match-line'}));
        for(const lane of lanes){
          let d='',last;
          for(const [i,value] of lane.points){
            d+=(last+1===i?'L':'M')+x(i).toFixed(2)+' '+y(value).toFixed(2);last=i;
          }
          figure.append(svg('path',{class:'xa-series',stroke:color(lane.i),'stroke-width':lane.i===0?3:1.9,d}));
        }
        for(const tick of [-longest,0,...(width>480?[3,6]:[]),12]){
          figure.append(svg('text',{x:x(tick),y:bottom+21,'text-anchor':tick===-longest?'start':tick===12?'end':'middle'},tick===0?'Match month':signed(tick,0)+' mo'));
        }
        return {figure,bounds:{left,right,top,bottom},position:offset=>({x:x(offset),points:lanes.flatMap(l=>
          l.points.has(offset)?[{y:y(l.points.get(offset)),tone:'analog-'+l.i}]:[])})};
      },{
        data:dates,content:offset=>({date:offset===0?'Match month':signed(offset,0)+' months',values:lanes.flatMap(l=>{
          const point=l.points.get(offset);
          return valid(point)?[{label:(l.i?month(l.row.end):'Recent fall')+' · '+month(shift(l.row.end,offset)),value:percent(point-100),tone:'analog-'+l.i}]:[];
        })})
      });
    }

    function render(measure) {
      const list=ranked(episodes,measure), rows=[recent,...list];
      body.hidden=false;
      container.querySelectorAll('[data-analog-rank]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.analogRank===measure)));
      container.querySelector('#xa-ranking').textContent=list.length+' non-overlapping matches · ranked by '+rankNames[measure].toLowerCase()+'. Lower distance means closer.';
      const trend=(row,i)=>i===0?'Reference':null;
      table(container.querySelector('#xa-deltas'),rows,[
        {title:'Gold over the match window',read:r=>percent(r.move)},
        {title:'Months from peak to match',read:r=>String(r.length??elapsed)},
        ...specs.map((spec,i)=>({title:spec.label,read:r=>valueText(r.changes[i],spec.unit)})),
        {title:'Macro change distance',read:(r,i)=>trend(r,i)??(valid(r.macro)?r.macro.toFixed(2):'—')},
        {title:'Beta profile distance',read:(r,i)=>trend(r,i)??(valid(r.beta)?r.beta.toFixed(2):'—')}
      ],'Peak to match month · aligned macro changes');
      table(container.querySelector('#xa-betas'),rows,specs.map((spec,i)=>({title:spec.label,read:r=>{
        const f=r.fits[i],box=make('div');
        box.append(make('strong',signed(f.beta)),make('small',(valid(f.r)?'r '+signed(f.r)+' · ':'')+f.n+' months'));
        return box;
      }})),'Gold return beta and correlation · trailing 36 months');
      aftermath(rows);
      chart(rows);
    }

    const summary=container.querySelector('#xa-summary');
    for(const [mode,heading] of [['macro','Closest macro changes'],['beta','Closest gold beta profile']]){
      const match=ranked(episodes,mode)[0];
      if(!match)continue;
      const card=make('article',null,'gold-panel xa-summary-card');
      const tag=make('p',heading,'chapter');
      root.XauChartUi.addIcon(tag,mode==='macro'?'table':'trend');
      const description=make('p',mode==='macro'?
        'This window had the closest change across the seven macro readings. Gold fell '+fmt.format(Math.abs(match.move))+'%'+' and was '+percent(match.aftermath.returns[3])+' from its matched level a year later.':
        'Gold had the closest pattern of monthly sensitivity to those drivers. Gold fell '+fmt.format(Math.abs(match.move))+'%'+' and was '+percent(match.aftermath.returns[3])+' from its matched level a year later.');
      const links=make('div',null,'xa-links');
      links.append(replay('Open the fall in GLD',match.start,match.end));
      card.append(tag,make('h3',range(match)),description,links);
      summary.append(card);
    }
    const sourceList=container.querySelector('#xa-sources');
    sourceList.append(link('World Bank gold','https://www.worldbank.org/en/research/commodity-markets'),
      ...specs.map(s=>link(s.short+' · FRED',s.url)));
    for(const button of container.querySelectorAll('[data-analog-rank]')){
      button.addEventListener('click',()=>render(button.dataset.analogRank));
    }
    render('macro');
  }

  const api={study,ranked,factors,fit,next,shift,spotDrawdown};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.XauAnalogs={...api,mount};
})(globalThis);
