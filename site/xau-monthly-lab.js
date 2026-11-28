'use strict';
(function (root) {
  const goldMonthly = 'gold_usd_mom_pct';
  const goldAnnual = 'gold_usd_yoy_pct';
  const profiles = {
    usd: {label:'Broad dollar', title:'U.S. broad dollar change', unit:'%', field:'usd_broad_mom_pct', source:'https://fred.stlouisfed.org/series/DTWEXBGS', note:'Changes in monthly averages of the Fed broad dollar index.'},
    cny: {label:'USD/CNY', title:'CNY per USD change', unit:'%', field:'cny_per_usd_mom_pct', source:'https://fred.stlouisfed.org/series/DEXCHUS', note:'A positive USD/CNY move means the yuan weakened against the U.S. dollar.'},
    real: {label:'Real yields', title:'U.S. 10-year real yield change', unit:'bp', field:'us_10y_real_yield_mom_bps', source:'https://fred.stlouisfed.org/series/DFII10', note:'Change in the monthly average U.S. 10-year TIPS yield, in basis points.'},
    cpi: {label:'CPI inflation', title:'U.S. headline CPI inflation', unit:'%', field:'us_cpi_yoy_pct', gold:goldAnnual, source:'https://fred.stlouisfed.org/series/CPIAUCSL', note:'Both gold and CPI use overlapping 12-month changes. An absent October 2025 CPI observation also leaves October 2026 inflation unavailable.'},
    pce: {label:'PCE inflation', title:'U.S. PCE inflation', unit:'%', field:'us_pce_yoy_pct', gold:goldAnnual, source:'https://fred.stlouisfed.org/series/PCEPI', note:'Both gold and PCE use overlapping 12-month changes.'},
    spx: {label:'S&P 500', title:'S&P 500 price index change', unit:'%', field:'spx_price_monthly_avg_mom_pct', source:'data/spx/history.csv', note:'Changes in monthly-average S&P 500 closes. The price index excludes dividends.'},
  };
  const physical = [
    {target:'china', field:'china_gold_share_official_reserves_pct', title:'Gold as a share of China’s reserves', unit:'%', gap:1,
      explanation:'The ratio changes with the reported value of monetary gold and total official reserves. Use the physical holdings chart above to isolate changes in tonnes.',
      source:'https://www.safe.gov.cn/en/ForexReserves/index.html', publisher:'China SAFE'},
    {target:'holdings', field:'world_official_gold_purchases_ecb_annual_tonnes', title:'How much did central banks buy?', unit:'t', gap:12,
      explanation:'Net purchases are a calendar-year flow. The country rankings above show physical holdings at a point in time.',
      source:'https://www.ecb.europa.eu/pub/pdf/ire/ecb.ire202606_chartdata.en.xlsx', publisher:'ECB chart data'},
    {target:'mining', field:'world_mine_gold_usgs_annual_tonnes', title:'Long-run world mine output', unit:'t', gap:12,
      explanation:'USGS historical world production through 2022 and Mineral Commodity Summaries from 2023. The 2025 value is an estimate. The country rankings use World Mining Data.',
      source:'https://www.usgs.gov/media/files/gold-historical-statistics-data-series-140', publisher:'USGS historical statistics', extra:'https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-gold.pdf'},
  ];
  const goldSource='https://www.worldbank.org/en/research/commodity-markets';
  const loadedFormat=new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric',timeZone:'UTC'});
  const labelMonth=m=>loadedFormat.format(new Date(m+'-01T00:00:00Z'));
  const monthIndex=m=>12*Number(m.slice(0,4))+Number(m.slice(5,7))-1;
  const indexMonth=i=>Math.floor(i/12)+'-'+String(i%12+1).padStart(2,'0');
  const fmt=new Intl.NumberFormat('en-US',{maximumFractionDigits:2});
  const fixed=(v,unit)=>Number.isFinite(v)?fmt.format(v)+(unit==='%'?'%':unit?' '+unit:''):'—';
  const node=(tag,txt,cls)=>{
    const e=document.createElement(tag);
    if(txt!=null)e.textContent=txt;
    if(cls)e.className=cls;
    return e;
  };
  function svg(tag,attrs,txt) {
    const e=document.createElementNS('http://www.w3.org/2000/svg',tag);
    for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);
    if(txt!=null)e.textContent=txt;
    return e;
  }
  function dataset(file) {
    if(file.schema!==1||!Array.isArray(file.columns)||!Array.isArray(file.rows)||!file.rows.length)throw Error('Invalid monthly chart data.');
    const lookup=new Map(file.columns.map((name,i)=>[name,i+1]));
    const required=new Set([goldMonthly,goldAnnual, ...Object.values(profiles).map(p=>p.field), ...physical.map(p=>p.field)]);
    if([...required].some(k=>!lookup.has(k)))throw Error('Monthly chart data lacks a required series.');
    return {dates:file.rows.map(r=>r[0]), values:name=>file.rows.map(r=>r[lookup.get(name)])};
  }
  function pearson(rows) {
    if(rows.length<3)return null;
    const n=rows.length;
    const mean=[1,2].map(c=>rows.reduce((acc,row)=>acc+row[c],0)/n);
    let xx=0,yy=0,xy=0;
    for(const [,a,b] of rows){
      const x=a-mean[0], y=b-mean[1];
      xx+=x*x;yy+=y*y;xy+=x*y;
    }
    return xx&&yy ? Math.max(-1,Math.min(1,xy/Math.sqrt(xx*yy))) : null;
  }
  const matched=r=>Number.isFinite(r[1])&&Number.isFinite(r[2]);
  function rolling(rows) {
    return rows.map(([d],i)=>{
      const window=rows.slice(Math.max(0,i-35),i+1);
      const contiguous=window.length===36&&window.every((row,j)=>matched(row)&&(!j||monthIndex(row[0])===monthIndex(window[j-1][0])+1));
      return [d,contiguous?pearson(window):null];
    });
  }

  function timePlot(container, label, lanes, {seek,zoom,output,brief} = {}) {
    const lookup=lanes.map(lane=>new Map(lane.points));
    const dates=lanes[0].points.map(p=>p[0]);
    const indexes=new Map(dates.map((date,i)=>[date,i]));
    const first=monthIndex(dates[0]),last=monthIndex(dates.at(-1));
    const tone = lane=>lane.cls==='xm-driver'?'driver':'gold';
    const control=root.XauChartUi.draw(container,width=>{
      const height=lanes.length===2?310:210,left=56,right=width-17,laneHeight=(height-33)/lanes.length;
      const x=m=>left+(right-left)*(monthIndex(m)-first)/(last-first||1);
      const figure=svg('svg',{viewBox:'0 0 '+width+' '+height,role:'img','aria-label':label});
      const scales=lanes.map((lane,i)=>{
        const values=lane.points.map(p=>p[1]).filter(Number.isFinite);
        const min=lane.bounds?.[0] ?? Math.min(0,...values),max=lane.bounds?.[1] ?? Math.max(0,...values);
        const spread=max-min || 1,top=25+i*laneHeight,bottom=(i+1)*laneHeight-10;
        const y=v=>bottom-(bottom-top)*(v-min)/spread;
        figure.append(svg('text',{x:left,y:top-9,class:'xm-series-label '+(tone(lane)==='driver'?'title-driver':'title-gold')},lane.label));
        const ticks=[min,(min+max)/2,max];
        if(min<0&&max>0)ticks[1]=0;
        for(const v of new Set(ticks)){
          figure.append(svg('path',{class:v===0?'xm-zero':'xm-grid',d:'M'+left+' '+y(v)+'H'+right}),
            svg('text',{x:left-7,y:y(v)+4,'text-anchor':'end'},fmt.format(v)));
        }
        let path='',prior;
        for(const [m,v] of lane.points){
          if(!Number.isFinite(v)){prior=undefined;continue;}
          path+=(prior&&monthIndex(m)-monthIndex(prior)<=(lane.gap??1)?'L':'M')+x(m).toFixed(2)+' '+y(v).toFixed(2);
          prior=m;
        }
        if(values.length)figure.append(svg('path',{class:lane.cls||'xm-gold',d:path}));
        if(values.length===1){
          const p=lane.points.find(a=>Number.isFinite(a[1]));
          figure.append(svg('circle',{cx:x(p[0]),cy:y(p[1]),r:4,class:'xau-point xau-point--'+tone(lane)}));
        }
        if(!values.length)figure.append(svg('text',{x:left+6,y:top+26},'No observations in this window'));
        return y;
      });
      const axis=[first,...(last-first>8 && width>345?[Math.floor((first+last)/2)]:[]),...(first!==last?[last]:[])];
      axis.forEach((i,k)=>figure.append(svg('text',{x:x(indexMonth(i)),y:height-10,
        'text-anchor':k===0?'start':k===axis.length-1?'end':'middle'},brief?indexMonth(i).slice(0,4):labelMonth(indexMonth(i)))));
      return {figure,bounds:{left,right,top:18,bottom:height-33},position:m=>({
        x:x(m),points:lanes.flatMap((lane,i)=>!Number.isFinite(lookup[i].get(m)) ? [] :
          [{y:scales[i](lookup[i].get(m)),tone:tone(lane)}])
      })};
    },{
      data:dates,content:m=>({date:brief?m.slice(0,4):labelMonth(m),values:lanes.map((lane,i)=>({
        label:lane.title,value:fixed(lookup[i].get(m),lane.unit),tone:tone(lane)
      }))}),onInspect:seek,onRange:zoom
    },output);
    return {control,set:m=>{if(indexes.has(m))control.set(indexes.get(m));}};
  }

  function scatterPlot(container, points, profile, seek) {
    if(!points.length){
      root.XauChartUi.clear(container);
      container.replaceChildren(node('p','No paired observations in this window.','chart-note'));
      return ()=>{};
    }
    const index=new Map(points.map(([m],i)=>[m,i]));
    const limits=i=>{
      const v=points.map(p=>p[i]),min=Math.min(0,...v),max=Math.max(0,...v),pad=(max-min||1)*.08;
      return [min-pad,max+pad];
    };
    const [minX,maxX]=limits(2),[minY,maxY]=limits(1);
    const graph=root.XauChartUi.draw(container,width=>{
      const height=236,left=53,right=width-17,top=17,bottom=188;
      const x=v=>left+(right-left)*(v-minX)/(maxX-minX),y=v=>bottom-(bottom-top)*(v-minY)/(maxY-minY);
      const figure=svg('svg',{viewBox:'0 0 '+width+' '+height,role:'img','aria-label':'Scatter plot of gold and '+profile.title+' by month'});
      figure.append(svg('path',{class:'xm-zero',d:'M'+x(0)+' '+top+'V'+bottom+'M'+left+' '+y(0)+'H'+right}));
      for(const v of [minX,0,maxX])figure.append(svg('text',{x:x(v),y:bottom+16,'text-anchor':v===minX?'start':v===maxX?'end':'middle'},fmt.format(v)));
      for(const v of [minY,0,maxY])figure.append(svg('text',{x:left-6,y:y(v)+4,'text-anchor':'end'},fmt.format(v)));
      figure.append(svg('text',{x:left,y:12,class:'xm-series-label title-gold'},'Gold change · %'),
        svg('text',{x:(left+right)/2,y:height-10,'text-anchor':'middle'},profile.label+' · '+profile.unit));
      const point = ([,a,b])=>[x(b),y(a)];
      const coordinates=points.map(point);
      for(const [i,[px,py]] of coordinates.entries())figure.append(svg('circle',{cx:px,cy:py,r:3.5,class:'xm-dot','data-month':points[i][0]}));
      return {figure,bounds:{left,right,top,bottom},position:r=>({x:x(r[2]),points:[{y:y(r[1]),tone:'gold'}]}),
        nearest(p){
          let best=-1,distance=20*20;
          coordinates.forEach(([px,py],i)=>{
            const squared=(p.x-px)**2+(p.y-py)**2;
            if(squared<distance){distance=squared;best=i;}
          });
          return best;
        }};
    },{
      data:points,onInspect:row=>seek(row[0]),content:([m,g,d])=>({date:labelMonth(m),values:[
        {label:'Gold',value:fixed(g,'%'),tone:'gold'},
        {label:profile.label,value:fixed(d,profile.unit),tone:'driver'}
      ]})
    });
    return m=>{if(index.has(m))graph.set(index.get(m));};
  }

  function showPhysical(data) {
    for(const def of physical){
      const section=document.getElementById(def.target);
      if(!section)continue;
      const all=data.values(def.field).map((v,i)=>[data.dates[i],v]).filter(r=>Number.isFinite(r[1]));
      if(!all.length)continue;
      const box=node('div',null,'gold-panel xm-physical'), head=node('div',null,'xm-physical-head');
      const info=node('div'), latest=all.at(-1);
      info.append(node('h3',def.title),node('p',def.explanation,'chart-note'));
      const stat=node('p',null,'xm-physical-stat');
      const when=def.gap===12?latest[0].slice(0,4):labelMonth(latest[0]);
      stat.append(node('strong',fixed(latest[1],def.unit)),node('span',when));
      const plot=node('div',null,'chart-frame xm-chart');
      const source=node('div',null,'source-list'), link=node('a',def.publisher);
      link.href=def.source;source.append(link);
      if(def.extra){const recent=node('a','USGS recent summary');recent.href=def.extra;source.append(recent);}
      head.append(info,stat);box.append(head,plot,source);section.append(box);
      timePlot(plot,def.title,[{title:def.title,label:def.unit==='t'?'Metric tonnes':'Share of official reserves · %',
        unit:def.unit,points:all,gap:def.gap}],{brief:def.gap===12});
    }
  }

  async function init() {
    const el=id=>document.getElementById(id);
    const response=await fetch('data/metals/xau-monthly-lab.json?v=1');
    if(!response.ok)throw Error('The compiled monthly extract could not load. Reload to try again.');
    const file=await response.json(), data=dataset(file);
    const {dates}=data, first=dates[0],last=dates.at(-1);
    el('xm-content').hidden=false;
    el('xm-status').textContent=dates.length+' complete calendar months · '+labelMonth(first)+' to '+labelMonth(last)+' · source snapshot '+file.asOf;
    const from=el('xm-from'),to=el('xm-to'),slider=el('xm-month');
    for(const input of [from,to]){input.min=first;input.max=last;}
    let key='real', range='10y', visible=[], active, charts=[];
    const viewport=root.XauChartUi.viewport(el('xm-tools'),()=>[from.value,to.value],([start,end])=>{
      from.value=start;to.value=end;range=null;active=null;render();
    });
    const maps=new Map();
    for(const [id,p] of Object.entries(profiles)){
      const b=node('button',p.label);b.type='button';b.dataset.driver=id;
      root.XauChartUi.addIcon(b,p.unit==='bp'||p.gold?'rates':id==='spx'?'trend':'dollar');
      b.addEventListener('click',()=>{key=id;if(range==='all')setWindow(range);else render();});
      el('xm-drivers').append(b);
    }
    function current() {
      if(!maps.has(key)){
        const spec=profiles[key],g=data.values(spec.gold??goldMonthly),d=data.values(spec.field);
        const history=dates.map((m,i)=>[m,g[i],d[i]]);
        maps.set(key,{spec,history,rolling:rolling(history)});
      }
      return maps.get(key);
    }
    function setWindow(id) {
      viewport.clear();
      range=id;
      const available=current().history.filter(matched);
      to.value=id==='pandemic'?'2021-12':last;
      from.value=id==='all'?(available[0]?.[0]??first):id==='pandemic'?'2020-01':id==='recent'?'2022-01':
        indexMonth(Math.max(monthIndex(first),monthIndex(last)-(id==='5y'?59:119)));
      render();
    }
    function inspection() {
      const row=visible[Number(slider.value)];
      if(!row)return;
      const {spec}=current(),[m,g,d]=row;
      active=m;
      slider.setAttribute('aria-valuetext',labelMonth(m)+' · Gold '+fixed(g,'%')+' · '+spec.label+' '+fixed(d,spec.unit));
      charts.forEach(fn=>fn(m));
    }
    function seek(month) {
      const at=visible.findIndex(row=>row[0]===month);
      if(at>=0){slider.value=at;inspection();}
    }
    function metric(label,value,context) {
      const div=node('div');
      div.append(node('dt',label),node('dd',value),node('small',context));return div;
    }
    function render() {
      const {spec, history, rolling:roll}=current();
      visible=history.filter(r=>r[0]>=from.value&&r[0]<=to.value);
      for(const b of el('xm-drivers').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.driver===key));
      for(const b of el('xm-windows').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.window===range));
      if(!visible.length)return;
      const pairs=visible.filter(matched);
      const goldTitle=spec.gold?'Gold 12-month change':'Gold monthly change';
      const end=visible.at(-1)[0],start=visible[0][0],r=pearson(pairs),pairedRolling=roll.filter(p=>p[0]>=start&&p[0]<=end);
      const lastRolling=pairedRolling.findLast(p=>Number.isFinite(p[1]));
      const percent=spec.gold?'Gold and inflation compare year-over-year changes.':'Gold uses the change in World Bank monthly-average prices.';
      el('xm-kpis').replaceChildren(
        metric('Matched months',String(pairs.length),pairs.length?labelMonth(pairs[0][0])+' – '+labelMonth(pairs.at(-1)[0]):'Choose dates with overlapping history'),
        metric('Correlation in window',r==null?'—':r.toFixed(2),'Pearson correlation · −1 to +1'),
        metric('Latest rolling correlation',lastRolling?lastRolling[1].toFixed(2):'—',lastRolling?labelMonth(lastRolling[0])+' · preceding 36 months':'Needs 36 consecutive matched months')
      );
      el('xm-scatter-note').textContent='Each point shows contemporaneous changes in one month. Select a point to inspect it. Correlation measures co-movement.';
      const method=el('xm-method'), src=node('a','Driver source'),goldRef=node('a','World Bank gold');
      src.href=spec.source;goldRef.href=goldSource;
      method.replaceChildren(document.createTextNode(percent+' '+spec.note+' '),goldRef,document.createTextNode(' · '),src);
      el('xm-download').disabled=!pairs.length;
      slider.max=String(visible.length-1);slider.disabled=visible.length<2;
      const keep=visible.findIndex(p=>p[0]===active);
      slider.value=keep<0?slider.max:String(keep);
      const dots=scatterPlot(el('xm-scatter'),pairs,spec,seek);
      const historyPlot=timePlot(el('xm-history'),'Gold and '+spec.title,[
        {title:goldTitle,label:goldTitle+' · %',unit:'%',points:visible.map(r=>[r[0],r[1]])},
        {title:spec.label,label:'Driver · '+spec.unit,unit:spec.unit,points:visible.map(r=>[r[0],r[2]]),cls:'xm-driver'}
      ],{seek,zoom:(start,end)=>viewport.select(start,end),output:el('xm-readout')});
      const rollingPlot=timePlot(el('xm-rolling'),'Rolling 36-month gold correlation with '+spec.label,[
        {title:'Correlation',label:'Correlation',points:pairedRolling,bounds:[-1,1],cls:'xm-driver'}
      ],{seek});
      charts=[historyPlot.set,dots,rollingPlot.set];
      viewport.bind(historyPlot.control);
      inspection();
    }
    el('xm-form').addEventListener('submit',event=>{
      event.preventDefault();
      to.setCustomValidity(from.value>to.value?'Choose an end month on or after the start month.':'');
      if(!to.reportValidity())return;
      viewport.clear();range=null;active=null;render();
    });
    for(const input of [from,to])input.addEventListener('input',()=>to.setCustomValidity(''));
    for(const b of el('xm-windows').querySelectorAll('button'))b.addEventListener('click',()=>{active=null;to.setCustomValidity('');setWindow(b.dataset.window);});
    slider.addEventListener('input',inspection);
    el('xm-download').addEventListener('click',()=>{
      const spec=current().spec;
      const fields=['month',spec.gold??goldMonthly,spec.field];
      const csv=[fields,...visible.filter(matched)].map(row=>row.join(',')).join('\r\n');
      const url=URL.createObjectURL(new Blob([csv+'\r\n'],{type:'text/csv;charset=utf-8'}));
      const a=node('a');a.href=url;a.download='xau-driver-'+key+'-'+from.value+'-to-'+to.value+'.csv';
      document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
    setWindow(range);
    showPhysical(data);
  }

  function mount() {
    const anchor=document.getElementById('regimes');
    if(!anchor)return;
    const template=document.createElement('template');
    template.innerHTML=`
<section class="gold-section" id="monthly-lab" aria-labelledby="xm-title">
<header class="section-heading"><div><p class="chapter">Paired monthly observations</p><h2 id="xm-title">Gold driver lab</h2></div><p>See whether gold moved with the dollar, rates, inflation or stocks, and how that relationship changed over time.</p></header>
<div class="gold-panel xm-lab">
<p id="xm-status" class="chart-note" role="status">Loading compiled gold history…</p>
<div id="xm-content" hidden>
<div class="chart-presets" id="xm-drivers" role="group" aria-label="Choose a gold driver"></div>
<form class="gold-fields xm-fields" id="xm-form">
<label>From month<input type="month" id="xm-from" required></label>
<label>Through month<input type="month" id="xm-to" required></label>
<button class="action" type="submit">Apply dates</button>
</form>
<div class="chart-presets xm-windows" id="xm-windows" role="group" aria-label="Date presets">
<button type="button" data-window="5y">Last 5 years</button>
<button type="button" data-window="10y">Last 10 years</button>
<button type="button" data-window="pandemic">2020–21</button>
<button type="button" data-window="recent">Since 2022</button>
<button type="button" data-window="all">All shared data</button>
</div>
<dl id="xm-kpis" class="gold-kpis compact"></dl>
<figure class="xm-main"><h3>Gold and the selected driver</h3>
<div id="xm-tools" class="xau-chart-toolbar" aria-label="Driver lab chart controls"><div class="xau-chart-actions"><button type="button" data-chart-zoom aria-pressed="false" disabled>Zoom range</button><button type="button" data-chart-reset disabled>Reset zoom</button></div><p class="xau-chart-hint" data-chart-hint></p></div>
<div class="chart-frame xm-chart" id="xm-history"></div><div class="scrub-row"><label for="xm-month">Inspect month</label><input id="xm-month" type="range" min="0" max="0" value="0"><output id="xm-readout" for="xm-month"></output></div></figure>
<div class="xm-charts">
<figure><h3>One point per month</h3><div class="chart-frame xm-chart" id="xm-scatter"></div><figcaption class="chart-note" id="xm-scatter-note"></figcaption></figure>
<figure><h3>Rolling 36-month correlation</h3><div class="chart-frame xm-chart" id="xm-rolling"></div><figcaption class="chart-note">Each point uses the 36 months ending there. A gap in either series leaves a break in the line.</figcaption></figure>
</div>
<div class="xm-footer"><button type="button" class="action secondary" id="xm-download">Download paired observations</button><p class="chart-note" id="xm-method"></p></div>
</div></div></section>
`;
    anchor.before(template.content);
    const jump=node('a','Driver lab');
    jump.href='#monthly-lab';
    document.querySelector('nav.gold-jump a[href="#compare"]')?.after(jump);
    root.XauChartUi.decorate();
    init().catch(error=>{document.getElementById('xm-status').textContent=error.message;});
  }
  if(typeof module==='object'&&module.exports)module.exports={dataset,pearson,rolling};
  else mount();
})(globalThis);
