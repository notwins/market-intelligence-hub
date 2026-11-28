'use strict';
(function (root) {
  const chapters = [
    {id:'bretton', dates:['1960-01','1971-12'], label:'1960–71', title:'When gold was part of the monetary system',
      focus:['cpi','nominal'], event:['1971-08','U.S. suspends official gold convertibility'],
      context:'Under Bretton Woods, foreign official holders could convert dollars into gold at the official price. The U.S. suspended that link in August 1971. This institutional change matters when comparing early gold prices with inflation or interest rates.',
      read:'Look at the break in the gold price path around the end of convertibility. The early regime gives the macro correlation table a different economic starting point.',
      source:['Federal Reserve History','https://www.federalreservehistory.org/essays/gold-convertibility-ends'], papers:[12,8]},
    {id:'inflation', dates:['1972-01','1979-12'], label:'1972–79', title:'Oil shocks and the Great Inflation',
      focus:['cpi','risk'], event:['1973-10','First oil shock'],
      context:'The 1973–74 oil shock and a second energy disruption around 1979 pushed against an economy already experiencing rising prices. Gold, headline CPI and geopolitical risk give three views of that period.',
      read:'Compare the gold rally with the bursts of inflation and risk. The CPI line measures realized inflation. Expected inflation and the policy response can move earlier.',
      source:['Federal Reserve History · The Great Inflation','https://www.federalreservehistory.org/essays/great-inflation'], papers:[1,2,5]},
    {id:'disinflation', dates:['1980-01','1999-12'], label:'1980–99', title:'Volcker, disinflation and a long decline',
      focus:['cpi','nominal'], event:['1981-07','Start of the 1981–82 recession'],
      context:'Tight monetary policy and two early-1980s recessions helped bring inflation down. The long gold decline also spans the later recovery in employment and changes in the dollar.',
      read:'The chart separates the price of gold from the inflation rate. Watch how the inflation backdrop changed even as gold remained below its early-1980 high.',
      source:['Federal Reserve History · Anti-inflation measures','https://www.federalreservehistory.org/essays/anti-inflation-measures'], papers:[1,2]},
    {id:'early2000s', dates:['2000-01','2007-12'], label:'2000–07', title:'A weaker dollar and a new gold cycle',
      focus:['legacy','nominal'], event:['2001-03','Start of the 2001 recession'],
      context:'The dot-com downturn and easier monetary policy opened a different backdrop. The historical major-currency dollar index supplies the long comparison, and Treasury inflation-protected yields join the record in 2003.',
      read:'Compare the direction of gold and the dollar across this long upswing. The Chicago Fed study also examines declining expected real rates and pessimism in the early 2000s.',
      source:['Chicago Fed · What Drives Gold Prices?','https://www.chicagofed.org/publications/chicago-fed-letter/2021/464'], papers:[1,3]},
    {id:'financial-crisis', dates:['2008-01','2009-12'], label:'2008–09', title:'The financial crisis had two phases',
      focus:['stocks','stress'], event:['2008-09','Lehman Brothers bankruptcy'],
      context:'The 2008 crisis brought equity losses, strained credit markets and worsening employment. The recovery phase began before every economic indicator had turned.',
      read:'Follow the gold, stock and financial conditions lines through the crisis month by month. The end-to-end return compresses the initial selloff and later recovery into one number.',
      source:['Federal Reserve History · The Great Recession','https://www.federalreservehistory.org/essays/great-recession-and-its-aftermath'], papers:[19,11]},
    {id:'recovery', dates:['2010-01','2019-12'], label:'2010–19', title:'The gold peak, drawdown and slow recovery',
      focus:['real','dollar'], event:['2011-09','2011 gold high in the monthly series'],
      context:'Gold reached a monthly high in 2011, declined through 2015 and recovered slowly as the U.S. expansion continued. Rates, the dollar and rising equities offer separate views of that cycle.',
      read:'Start around the 2011 marker, then compare changes in the dollar and inflation-adjusted yields through the trough. The chapter’s total move includes the months before the peak.',
      source:['Chicago Fed · Real rates and pessimism','https://www.chicagofed.org/publications/chicago-fed-letter/2021/464'], papers:[1,3,4]},
    {id:'pandemic', dates:['2020-01','2021-12'], label:'2020–21', title:'The dash for cash and the reopening',
      focus:['jobs','stress','real'], event:['2020-03','Global dash for cash'],
      context:'March 2020 brought severe liquidity pressure. April’s employment report showed an extraordinary loss of payroll jobs. Reopening and policy support later changed the backdrop again.',
      read:'Read financial conditions alongside unemployment and gold. A spike in stress can coincide with a demand for cash first, while easier conditions and lower yields become important later.',
      source:['Federal Reserve · Treasury market stress','https://www.federalreserve.gov/monetarypolicy/fomcminutes20200429.htm'], papers:[19,22]},
    {id:'tightening', dates:['2022-01','2023-12'], label:'2022–23', title:'High CPI met higher real yields',
      focus:['cpi','real','dollar'], event:['2022-06','U.S. inflation near its 2022 peak'],
      context:'Inflation surged and the Fed tightened. Geopolitical risk also jumped around Russia’s invasion of Ukraine. Gold faced several simultaneous developments, including rising real yields and shifts in demand for reserve assets.',
      read:'Compare the CPI line with the direction of real yields. The two are different measurements, and either can lead a different reading of the same gold price window.',
      source:['Federal Reserve · June 2023 Monetary Policy Report','https://www.federalreserve.gov/monetarypolicy/2023-06-mpr-summary.htm'], papers:[1,2,13]},
    {id:'recent', dates:['2024-01',null], label:'2024 onward', title:'Official buying, geopolitical risk and the pullback',
      focus:['risk','real','dollar'], event:['2026-02','Gold high in the February 2026 monthly average'],
      context:'The recent rally and pullback overlapped changes in yields, the dollar, geopolitical risk and reported central-bank demand. The World Gold Council estimated stronger official buying in Q3 2026, even as the monthly gold price remained below its early-2026 high.',
      read:'Compare September and October with the February marker. Then use the central-bank holdings and purchases charts to distinguish changes in physical stocks from estimates of new buying.',
      source:['World Gold Council · Q3 2026 demand','https://www.gold.org/goldhub/research/gold-demand-trends/gold-demand-trends-q3-2026'], papers:[13,14,28]},
  ];

  const paperGuides = [
    {id:1, topic:'Rates & inflation', icon:'rates', finding:'The authors distinguish inflation expectations, expected real long-term rates and pessimism about the economy. They find the importance of these relationships shifted across their historical sample.',
      reading:'Compare the 1970s with the 2000s. Use the Treasury yield and CPI lanes for the older era, then the observed TIPS yield where it exists.', target:'chapter-early2000s'},
    {id:2, topic:'Purchasing power', icon:'bars', finding:'Erb and Harvey examine popular reasons to own gold and find that purchasing-power protection can be unreliable over ordinary investment horizons.',
      reading:'Look at the multi-year decline after the early-1980 peak, then switch to the inflation-adjusted gold benchmark in the detailed chart.', target:'chapter-disinflation'},
    {id:3, topic:'Opportunity cost', icon:'rates', finding:'Jermann models gold as an investment that pays no cash yield and also has non-investment uses. The model studies why changes in real interest rates can matter to its price.',
      reading:'Follow gold and actual U.S. 10-year TIPS yields from 2003 onward. A month’s yield change and a long holding period answer different questions.', target:'chapter-recovery'},
    {id:19, topic:'Stocks & stress', icon:'trend', finding:'Baur and Lucey distinguish ordinary portfolio diversification from protection in the worst stock-market conditions. Their results allow the safe-haven relationship to vary over time.',
      reading:'Compare 2008–09 with the broad S&P 500 sample. The downside summary below uses the worst tenth of matched stock months and counts how often gold rose.', target:'chapter-financial-crisis'},
    {id:22, topic:'Pandemic liquidity', icon:'lab', finding:'This paper studies gold and bonds in episodes of epidemic uncertainty. Its question is about behavior in stress episodes, where sample dates and observation frequency matter.',
      reading:'Use the pandemic chapter’s monthly sequence. The stock rebound, April labor shock, and the later easing in financial conditions happened on different clocks.', target:'chapter-pandemic'},
    {id:13, topic:'Central-bank reserves', icon:'bank', finding:'The IMF working paper links reserve diversification partly to relative returns, geopolitical factors and sanctions exposure in its cross-country sample.',
      reading:'Use holdings in tonnes for the physical stock and the separate net-purchases chart for flows. A rise in the market value of existing gold can raise its reserve share by itself.', target:'holdings'},
    {id:14, topic:'Geopolitical risk', icon:'globe', finding:'The BIS study finds a positive gold response to geopolitical risk in its sample and a stronger response under looser financial conditions. These are results from the authors’ model.',
      reading:'Compare the separate AI-GPR and Chicago Fed conditions lanes. Here they measure news-based geopolitical risk and U.S. financial conditions, respectively.', target:'chapter-recent'},
    {id:23, topic:'China & local pricing', icon:'globe', finding:'The LBMA report describes the structure of mainland China’s gold market and its trading, investment and physical demand channels.',
      reading:'Compare the SAFE holdings figures with the CNY gold translation and Shanghai market context. Exchange-rate translation and a local market premium are distinct.', target:'china'},
  ];

  const recessions = [
    ['1960-04','1961-02'],['1969-12','1970-11'],['1973-11','1975-03'],
    ['1980-01','1980-07'],['1981-07','1982-11'],['1990-07','1991-03'],
    ['2001-03','2001-11'],['2007-12','2009-06'],['2020-02','2020-04']
  ];
  const ordinal = d => Number(d.slice(0,4))*12+Number(d.slice(5,7))-1;
  const monthKey = n => Math.floor(n/12)+'-'+String(n%12+1).padStart(2,'0');
  const monthDate = d => d.slice(0,7)+'-01';
  const previous = d => monthKey(ordinal(d)-1)+'-01';
  const monthFormat = new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric',timeZone:'UTC'});
  const when = d => monthFormat.format(new Date(monthDate(d)+'T00:00:00Z'));
  const fmt = new Intl.NumberFormat('en-US',{maximumFractionDigits:2});
  const signed = v => (v>0?'+':'')+fmt.format(Math.abs(v)<1e-10?0:v);
  const valid = Number.isFinite;
  const fred = id => 'https://fred.stlouisfed.org/series/'+id;

  function assemble(model, snapshot, older, spx, macro) {
    const cols=macro?.schema===1?macro.series:{};
    const fromFed=id=>snapshot.fred[id]??[];
    const definition=(key,label,unit,points,kind,source,short=label)=>({
      key,label,unit,points:new Map(model.monthly(points)),kind,source,short
    });
    return {
      gold:definition('gold','Gold','USD/oz',snapshot.series.pink,'level',snapshot.sources.gold,'Gold'),
      stocks:definition('stocks','S&P 500 close','pts',spx?.points??[],'level',['Hub S&P 500 daily close archive','data/spx/history.json'],'Stocks'),
      dollar:definition('dollar','Broad U.S. dollar','index',fromFed('DTWEXBGS'),'level',['Federal Reserve via FRED',fred('DTWEXBGS')],'Dollar'),
      legacy:definition('dollar','Major-currency U.S. dollar','index',older.legacyDollar??[],'level',['Federal Reserve via FRED',fred('TWEXMMTH')],'Dollar'),
      nominal:definition('rates','U.S. 10Y nominal yield','%',fromFed('GS10'),'rate',['Federal Reserve via FRED',fred('GS10')],'10Y yield'),
      real:definition('rates','U.S. 10Y real yield','%',fromFed('DFII10'),'rate',['Federal Reserve via FRED',fred('DFII10')],'10Y yield'),
      cpi:definition('cpi','U.S. CPI inflation','% YoY',model.yearOnYear(fromFed('CPIAUCSL')),'rate',['BLS via FRED',fred('CPIAUCSL')],'CPI'),
      jobs:definition('jobs','U.S. unemployment','%',cols.UNRATE??[],'rate',['BLS via FRED',fred('UNRATE')],'Jobs'),
      payroll:definition('jobs','U.S. nonfarm payrolls','thousand',cols.PAYEMS??[],'difference',['BLS via FRED',fred('PAYEMS')]),
      stress:definition('stress','Chicago Fed financial conditions','index',cols.NFCI??[],'difference',['Chicago Fed via FRED',fred('NFCI')],'Financial conditions'),
      risk:definition('risk','Geopolitical risk · AI-GPR','index',cols.GPR_AI??[],'difference',['Iacoviello and Tong · CC BY','https://www.matteoiacoviello.com/ai_gpr.html'],'Geopolitical risk')
    };
  }

  function datesBetween(from,to) {
    return Array.from({length:Math.max(0,ordinal(to)-ordinal(from)+1)},(_,i)=>monthKey(ordinal(from)+i)+'-01');
  }

  function values(series, dates) {
    return dates.flatMap(date=>series.points.has(date)?[[date,series.points.get(date)]]:[]);
  }

  function changes(model, dates, gold, driver) {
    // Starting values come from consecutive observations within the window.
    return dates.slice(1).flatMap(d=>{
      const before=previous(d);
      const records=[gold.points.get(before),gold.points.get(d),driver.points.get(before),driver.points.get(d)];
      if(!records.every(valid))return [];
      const x=model.change(records[0],records[1],gold.kind),y=model.change(records[2],records[3],driver.kind);
      return valid(x)&&valid(y)?[[d,x,y]]:[];
    });
  }

  function correlation(pairs) {
    if(pairs.length<18)return null;
    const means=[1,2].map(i=>pairs.reduce((sum,r)=>sum+r[i],0)/pairs.length);
    let a=0,b=0,c=0;
    for(const [,gold,driver] of pairs){
      const x=gold-means[0],y=driver-means[1];
      a+=x*x;b+=y*y;c+=x*y;
    }
    return a*b>0?Math.max(-1,Math.min(1,c/Math.sqrt(a*b))):null;
  }

  function summarize(model, series, dates, gold) {
    const observations=values(series,dates), pairs=changes(model,dates,gold,series);
    return {
      series, observations, pairs, r:correlation(pairs), first:observations[0], last:observations.at(-1),
      change:observations.length>1?model.change(observations[0][1],observations.at(-1)[1],series.kind):null
    };
  }

  function eraDrivers(series, start) {
    return [series.stocks,series.cpi,series.jobs,start<'2003-01'?series.nominal:series.real,
      start<'2006-01'?series.legacy:series.dollar,series.stress,series.risk];
  }

  function tailStats(pairs) {
    const count=Math.floor(pairs.length*.10);
    const worst=[...pairs].sort((a,b)=>a[2]-b[2]).slice(0,count);
    const up=worst.filter(r=>r[1]>0).length;
    return {count,up,mean:count?worst.reduce((sum,r)=>sum+r[1],0)/count:null};
  }

  function mount({snapshot, older={}, spx, macro, library}) {
    const model=root.XauHistory,ui=root.XauChartUi;
    const byId=id=>document.getElementById(id);
    const all=assemble(model,snapshot,older,spx,macro);
    const dates=[...all.gold.points.keys()];
    const last=dates.at(-1),first=dates[0];
    const make=(tag,content,cls)=>{
      const n=document.createElement(tag);
      if(content!=null)n.textContent=content;
      if(cls)n.className=cls;
      return n;
    };
    const link=(label,url)=>{
      const a=make('a',label);a.href=url;return a;
    };
    const svg=(tag,attrs,text)=>{
      const n=document.createElementNS('http://www.w3.org/2000/svg',tag);
      for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);
      if(text!=null)n.textContent=text;
      return n;
    };
    const amount=(v,s)=>!valid(v)?'—':fmt.format(v)+(s.unit.startsWith('%')?s.unit:' '+s.unit);
    const movement=(v,s)=>!valid(v)?'—':signed(v)+(s.kind==='rate'?' pp':s.kind==='level'?'%':s.key==='jobs'?'k jobs':' index pts');
    const over=(spec,range)=>summarize(model,spec,range,all.gold);
    const span=(a,b)=>when(a)+' – '+when(b);

    function sourceLinks(container,series) {
      const seen=new Set();
      for(const item of series){
        const [label,url]=item.source;
        if(!seen.has(url)){seen.add(url);container.append(link(label,url));}
      }
    }

    function plot(container,title,range,lanes,{event,logGold=false,compact=false}={}) {
      const start=ordinal(range[0]),end=ordinal(range.at(-1));
      const draw=ui.draw(container,width=>{
        const left=width<430?55:79,right=width-19,top=9,laneHeight=compact?90:105,height=top+lanes.length*laneHeight+27;
        const x=d=>left+(right-left)*(ordinal(d)-start)/(end-start||1);
        const figure=svg('svg',{viewBox:'0 0 '+width+' '+height,role:'img','aria-label':title});
        const clipStart=(date)=>Math.max(left,x(date));
        const clipEnd=(date)=>Math.min(right,x(date));
        for(const [a,b] of recessions){
          if(ordinal(b)<start || ordinal(a)>end)continue;
          const from=clipStart(a),to=clipEnd(monthKey(ordinal(b)+1));
          figure.append(svg('rect',{x:from,y:top,width:Math.max(2,to-from),height:height-top-30,class:'xo-recession'}));
        }
        const scales=lanes.map((series,i)=>{
          const found=values(series,range);
          const y0=top+i*laneHeight+24,y1=top+(i+1)*laneHeight-13;
          const t=logGold&&series.key==='gold'?Math.log:v=>v;
          const points=found.map(p=>t(p[1]));
          const min=points.length?Math.min(...points):0,max=points.length?Math.max(...points):1;
          const pad=(max-min||Math.abs(max)||1)*.065,safeMin=min-pad,safeMax=max+pad;
          const y=v=>y1-(y1-y0)*(t(v)-safeMin)/(safeMax-safeMin);
          for(const v of new Set([min,max])){
            const native=t===Math.log?Math.exp(v):v;
            const row=y(native);
            figure.append(svg('path',{class:'grid',d:'M'+left+' '+row+'H'+right}),
              svg('text',{x:left-8,y:row+4,'text-anchor':'end',class:'xo-tick'},fmt.format(native)));
          }
          figure.append(svg('text',{x:left,y:y0-7,class:'xo-lane xo-ink-'+series.key},(width<430?series.short:series.label)+' · '+series.unit+(t===Math.log?' · log':'')));
          if(!points.length){
            figure.append(svg('text',{x:left+3,y:y0+20,class:'xo-tick'},'No observations in this period'));
          }
          let commands='',lastMonth;
          for(const [d,v] of found){
            commands+=(lastMonth!=null&&ordinal(d)-lastMonth===1?'L':'M')+x(d).toFixed(2)+' '+y(v).toFixed(2);
            lastMonth=ordinal(d);
          }
          if(commands)figure.append(svg('path',{class:'xo-line xo-ink-'+series.key,d:commands}));
          return y;
        });
        if(event && ordinal(event[0])>=start && ordinal(event[0])<=end){
          figure.append(svg('line',{x1:x(event[0]),x2:x(event[0]),y1:top,y2:height-28,class:'xo-event'}));
        }
        const ticks=new Set([range[0],...(width>430?[range[Math.floor((range.length-1)/2)]]:[]),range.at(-1)]);
        for(const d of ticks){
          figure.append(svg('text',{x:x(d),y:height-6,'text-anchor':d===range[0]?'start':d===range.at(-1)?'end':'middle',class:'xo-tick'},when(d)));
        }
        return {figure,bounds:{left,right,top,bottom:height-28},position:d=>({
          x:x(d),points:lanes.flatMap((series,i)=>series.points.has(d)?[{y:scales[i](series.points.get(d)),tone:series.key}]:[])
        })};
      },{
        data:range,content:d=>({date:when(d),values:lanes.map(series=>({label:series.label,value:amount(series.points.get(d),series),tone:series.key}))})
      });
      return draw;
    }

    function readCard(summary, dates) {
      const {series,first,last,change,r,pairs}=summary;
      const card=make('div',null,'xo-metric xo-ink-'+series.key);
      const label=make('dt',series.label);
      ui.addIcon(label,({gold:'bars',stocks:'trend',cpi:'rates',jobs:'trend',rates:'rates',dollar:'dollar',stress:'lab',risk:'globe'})[series.key]);
      const figure=make('dd',first?movement(change,series):'—');
      const coverage=first&&last ? amount(first[1],series)+' → '+amount(last[1],series) : 'Series unavailable in this period';
      const detail=make('small',coverage);
      if(first&&last&&(first[0]!==dates[0]||last[0]!==dates.at(-1)))detail.append(make('span',span(first[0],last[0])));
      const fit=make('small',r==null?'':('r '+signed(r)+' · '+pairs.length+' months'),'xo-fit');
      card.append(label,figure,detail,fit);
      return card;
    }

    const story=chapters.map(chapter=>{
      const [from,end]=chapter.dates;
      const through=end??last;
      const dates=datesBetween(from,through);
      const sample=eraDrivers(all,from);
      const metrics=sample.map(series=>over(series,dates));
      const leading=metrics.filter(r=>r.r!=null&&r.pairs.length>=Math.ceil((dates.length-1)*.80))
        .sort((a,b)=>Math.abs(b.r)-Math.abs(a.r))[0];
      return {chapter,dates,metrics,leading,gold:over(all.gold,dates)};
    });
    function overview() {
      byId('xo-status').textContent=fmt.format(dates.length)+' monthly World Bank gold observations · '+span(first,last)+'. Compare lanes by date. Shaded bands mark U.S. recessions.';
      byId('xo-jump').replaceChildren(...story.map(({chapter})=>link(chapter.label,'#chapter-'+chapter.id)));
      const full=[all.gold,all.nominal,all.real,all.legacy,all.dollar,all.stocks,all.cpi,all.jobs,all.stress,all.risk];
      plot(byId('xo-full-plot'),'Full gold history and macro indicators',dates,full,{logGold:true,compact:true});
      sourceLinks(byId('xo-full-sources'),full);
      const down=tailStats(changes(model,dates,all.gold,all.stocks));
      if(down.count){
        byId('xo-tail').textContent='Gold rose in '+down.up+' of the '+down.count+' weakest matched S&P 500 months. Its average return in those months was '+signed(down.mean)+'%. The Hub equity history starts in 2006.';
      }
    }

    function buildMatrix() {
      const table=make('table'),header=table.createTHead().insertRow();
      for(const label of ['Period','Stocks','CPI','Jobs','10Y yields','Dollar','Financial conditions','Geopolitical risk']){
        const th=make('th',label);th.scope='col';header.append(th);
      }
      const tbody=table.createTBody();
      for(const row of story){
        const tr=tbody.insertRow(),th=make('th');th.scope='row';
        th.append(link(row.chapter.label,'#chapter-'+row.chapter.id));tr.append(th);
        for(const metric of row.metrics){
          const td=tr.insertCell();
          td.append(make('strong',metric.r==null?'—':signed(metric.r)),make('small',metric.pairs.length?metric.pairs.length+' months':'No overlap'));
          td.title=metric.series.label;
          if(metric.r!=null){
            td.classList.add(metric.r<0?'xo-negative':'xo-positive');
            td.style.setProperty('--xo-strength',String(Math.min(.26,.06+.28*Math.abs(metric.r))));
          }
        }
      }
      byId('xo-correlation').replaceChildren(table);
      const examples=[
        ['financial-crisis','cpi','stocks','The financial crisis'],
        ['pandemic','rates','stocks','The pandemic'],
        ['tightening','dollar','cpi','The inflation and hiking cycle'],
      ];
      byId('xo-examples').replaceChildren(...examples.flatMap(([id,main,other,label])=>{
        const record=story.find(item=>item.chapter.id===id);
        const drivers=[main,other].map(key=>record.metrics.find(item=>item.series.key===key));
        if(drivers.some(item=>item?.r==null))return [];
        const card=make('article',null,'xo-example');
        card.append(link(label,'#chapter-'+id),...drivers.map(metric=>make('p',
          metric.series.label+' · r '+signed(metric.r)+' ('+metric.pairs.length+' months)')));
        return [card];
      }));
    }

    function buildChapters() {
      const papers=new Map((library?.papers??[]).map(p=>[p.id,p]));
      const articles=[];
      for(const {chapter,dates,metrics,leading,gold} of story){
        const article=make('article',null,'gold-panel xo-period');
        article.id='chapter-'+chapter.id;
        const header=make('header',null,'xo-period-head'), copy=make('div');
        const kicker=make('p',span(dates[0],dates.at(-1)),'chapter');
        ui.addIcon(kicker,'clock');
        copy.append(kicker,make('h3',chapter.title),make('p',chapter.context));
        const result=make('div',null,'xo-result');
        result.append(make('span','Gold over this period'),make('strong',movement(gold.change,all.gold)));
        const drawdown=model.drawdown(gold.observations);
        if(drawdown?.value<0)result.append(make('small','Peak to trough '+movement(drawdown.value,all.gold)));
        header.append(copy,result);
        const figures=make('div',null,'xo-period-figures'), graph=make('figure');
        const plotArea=make('div',null,'chart-frame'),foreground=[all.gold,...chapter.focus.map(k=>all[k])];
        plotArea.style.setProperty('--xo-plot-height',(36+90*foreground.length)+'px');
        const annotation=make('figcaption',when(chapter.event[0])+' · '+chapter.event[1],'xo-annotation');
        graph.append(make('h4','Gold and the indicators to watch'),plotArea,annotation);
        const interpretation=make('div',null,'xo-reading');
        interpretation.append(make('h4','How to read this period'),make('p',chapter.read));
        if(leading){
          const data=make('p',null,'xo-observed');
          const heading=Math.abs(leading.r)<.20?'Co-movement was weak across the measured drivers':leading.series.label+' had the largest measured co-movement';
          data.append(make('strong',heading),make('span',leading.series.label+' · r '+signed(leading.r)+' · '+
            leading.pairs.length+' paired months. The ranking includes drivers with at least 80% of the window.'));
          interpretation.append(data);
        }
        const pay=over(all.payroll,dates),jobNote=make('p',null,'xo-payroll');
        if(pay.pairs.length&&pay.first&&pay.last){
          jobNote.append(make('strong','Employment'),make('span',movement(pay.change,all.payroll)+' net payroll change from '+when(pay.first[0])+' to '+when(pay.last[0])+'.'));
          interpretation.append(jobNote);
        }
        interpretation.append(link(chapter.source[0],chapter.source[1]));
        figures.append(graph,interpretation);
        const drivers=make('dl',null,'xo-metrics');
        drivers.append(...metrics.map(metric=>readCard(metric,dates)));
        const reading=make('p',null,'xo-refs');
        const references=chapter.papers.flatMap(id=>papers.has(id)?[papers.get(id)]:[]);
        if(references.length){
          reading.append(make('strong','Related papers'));
          for(const paper of references)reading.append(link(paper.title,paperGuides.some(guide=>guide.id===paper.id)?'#xo-paper-'+paper.id:paper.url));
        }
        article.append(header,figures,drivers);
        if(references.length)article.append(reading);
        articles.push({article,title:chapter.title,plotArea,dates,foreground,event:chapter.event});
      }
      byId('xo-periods').replaceChildren(...articles.map(view=>view.article));
      // Draw just ahead of scrolling. The text and figures remain open in the document.
      const draw=view=>plot(view.plotArea,view.title,view.dates,view.foreground,{event:view.event,compact:true});
      if (!('IntersectionObserver' in root)) { articles.forEach(draw); return; }
      const observer=new IntersectionObserver(entries=>{
        for(const entry of entries)if(entry.isIntersecting){
          const view=articles.find(item=>item.article===entry.target);
          draw(view);
          pending.delete(view);
          observer.unobserve(entry.target);
        }
      },{rootMargin:'900px 0px'});
      const pending=new Set(articles);
      articles.forEach(view=>observer.observe(view.article));
      root.addEventListener('beforeprint',()=>{
        for(const view of pending){draw(view);observer.unobserve(view.article);}
        pending.clear();
      });
    }

    function buildPaperNotes() {
      const lookup=new Map((library?.papers??[]).map(p=>[p.id,p]));
      const cards=paperGuides.flatMap(guide=>{
        const paper=lookup.get(guide.id);
        if(!paper)return [];
        const card=make('article',null,'xo-paper');
        card.id='xo-paper-'+guide.id;
        const tag=make('p',guide.topic+' · '+paper.year,'chapter');
        ui.addIcon(tag,guide.icon);
        const read=make('p');read.append(make('strong','Read it with the charts'),make('span',guide.reading));
        const links=make('div',null,'xo-paper-links');
        links.append(link('Open the study',paper.url),link('Jump to chart','#'+guide.target));
        card.append(tag,make('h3',paper.title),make('p',guide.finding),read,links);
        return [card];
      });
      byId('xo-papers').replaceChildren(...cards);
    }

    overview();
    buildMatrix();
    buildChapters();
    buildPaperNotes();
    const anchor=root.location.hash.slice(1);
    if (/^(chapter-|xo-paper-)/.test(anchor)) {
      root.requestAnimationFrame(()=>byId(anchor)?.scrollIntoView({block:'start'}));
    }
    if(!macro?.series)byId('xo-status').append(document.createTextNode(' The jobs and risk archive is temporarily unavailable.'));
  }

  const api={assemble,datesBetween,changes,correlation,eraDrivers,tailStats,chapters,mount};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.XauOpenHistory=api;
})(globalThis);
