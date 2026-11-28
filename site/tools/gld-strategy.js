'use strict';
(() => {
  const byId = id => document.getElementById(id);
  const form = byId('sim-form');
  const num = (id, fallback = 0) => byId(id).value === '' ? fallback : byId(id).valueAsNumber;
  const money = (n, digits = 0) => n.toLocaleString('en-US', {style:'currency', currency:'USD', minimumFractionDigits:digits, maximumFractionDigits:digits});
  const signed = n => (n > 0 ? '+' : '') + money(n);
  const percent = n => (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  const count = n => n.toLocaleString('en-US');
  const colors = {hold:'#2c6099', acc:'#167359', decu:'#a05b20', roll:'#804d82', price:'#966c25'};
  const preNames = {hold:'Buy and hold GLD', acc:'Accumulate and hold', decu:'Accu then covered decu', roll:'Roll after KO'};
  const postNames = {hold:'Buy GLD with spare cash', acc:'Hold shares and cash', decu:'Covered decumulator', roll:'Roll into accumulator'};
  let history = [], quotes = [], quoteDate = '', lastRun, chartMode = 'wealth', ready = false;
  let carried = false;
  const names = () => lastRun.config.startAfterKo ? postNames : preNames;
  const dateOrDay = (path, day) => path.dates?.[day] ?? (day === 0 ? 'Entry' : 'Day ' + count(day));
  const field = (tag, content, className) => {
    const e = document.createElement(tag);
    if (content != null) e.textContent = content;
    if (className) e.className = className;
    return e;
  };
  const svgElement = (tag, attrs, label) => {
    const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k,v] of Object.entries(attrs)) e.setAttribute(k,v);
    if (label != null) e.textContent = label;
    return e;
  };
  const setText = (id,t) => { byId(id).textContent = t; };
  const opt = (value, label) => new Option(label, value);
  const isReplay = () => byId('scenario').value === 'history';
  const accInputs = prefix => ({
    strike:num(prefix+'-strike'), ko:num(prefix+'-ko'), days:num(prefix+'-days'), guaranteeDays:num(prefix+'-g'),
    dailyShares:prefix === 'acc' ? num('acc-lot') : 0
  });

  function syncFields() {
    const after = byId('stage').value === 'ko';
    const custom = byId('scenario').value === 'custom';
    for (const [id, visible] of [['date-field',isReplay()],['spot-field',!isReplay()],
      ['yearone-field',custom && numYears() > 1],['final-field',custom]]) {
      byId(id).hidden = !visible;
      byId(id).querySelector('input').disabled = !visible;
    }
    byId('acc-terms').hidden = after;
    byId('acc-terms').querySelectorAll('input,select').forEach(input => { input.disabled = after; });
    byId('budget').placeholder = after ? 'Enter closing cash' : '100,000 illustration';
    setText('cash-label', after ? 'Total cash after KO (USD)' : 'Cash budget (USD)');
    setText('basis-note', after ? 'Enter total cash after settlement, including the refund once, and all GLD shares held. Use 0 if you have no cash.' :
      'A blank budget runs a USD 100,000 illustration. Personal inputs stay in this tab.');
  }
  const numYears = () => Number(byId('years').value);

  function getConfig() {
    const startAfterKo = byId('stage').value === 'ko';
    if (startAfterKo && byId('budget').value === '') throw Error('Enter the total cash after KO, including the refund once. Use 0 if all your value is in shares.');
    return {startAfterKo, budget:num('budget',100000), reserve:num('reserve'), openingShares:num('opening'),
      acc:startAfterKo ? accInputs('roll') : accInputs('acc'), roll:accInputs('roll'),
      decu:{strike:num('decu-strike'), ko:num('decu-ko'), days:num('decu-days'), gear:Number(byId('gear').value),
        coveragePct:num('cover'), minEntryPrice:num('min-entry')}, maxRolls:num('roll-max'), waitDays:num('wait')};
  }
  function getPath(config) {
    if (isReplay()) return GldPaths.replay(history,byId('replay-date').value,numYears());
    const spot = num('spot', history.at(-1)?.close);
    if (!spot) throw Error('Enter a starting GLD price in USD per share to run a scenario.');
    return GldPaths.scenario({id:byId('scenario').value,spot,years:numYears(),koPct:config.acc.ko,
      yearOnePct:num('year-one'),finalPct:num('final-return')});
  }
  function render() {
    syncFields();
    if (!ready) return;
    try {
      if (!form.checkValidity()) {
        const input = form.querySelector(':invalid');
        throw Error('Check ' + (input?.labels?.[0]?.textContent.trim() || 'the highlighted input') + '. ' + (input?.validationMessage || ''));
      }
      const config = getConfig(), path = getPath(config), result = GldStrategy.run(config,path.prices);
      lastRun = {config,path,result};
      byId('report-content').hidden = false;
      byId('error').hidden = true;
      const sc = GldPaths.scenarios.find(x => x.id === byId('scenario').value);
      const setup = byId('budget').value === '' ? 'Illustrative cash budget' : 'Entered starting position';
      setText('run-caption', setup + ' · ' + money(result.initialWealth) + ' starting value · ' + (isReplay() ? 'Historical GLD replay' : sc.label) +
        ' · ' + count(path.prices.length-1) + ' fixings');
      setText('path-caption', isReplay() ? path.startDate + ' to ' + path.endDate + '. ' + (path.truncated ?
        'Partial replay. Available history ends before the requested horizon.' : 'Each fixing uses the recorded GLD close.') :
        sc.description + ' This is a scenario, with no probability assigned.');
      document.querySelectorAll('[data-preset]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.preset === byId('scenario').value &&
        (b.dataset.preset !== 'history' || (byId('replay-date').value === '2011-08-22' && numYears() === 10)))));
      const p0 = path.prices[0], end = path.prices.at(-1), min = Math.min(...path.prices);
      const metrics = [['Starting GLD',money(p0,2)],['Lowest GLD',money(min,2)],['Ending GLD',money(end,2)],['GLD return',percent(100*(end/p0-1))]];
      byId('path-metrics').replaceChildren(...metrics.map(([label,value]) => {
        const box = field('div'); box.append(field('dt',label),field('dd',value)); return box;
      }));
      renderComparison(); renderGuide(); renderStress();
      const active = byId('focus').value || 'roll';
      byId('focus').replaceChildren(...Object.entries(names()).map(([key,label]) => opt(key,label)));
      byId('focus').value = active;
      byId('scrub').max = path.prices.length - 1;
      byId('scrub').value = byId('scrub').max;
      renderLedger(); renderChart();
    } catch(e) {
      lastRun = null;
      byId('report-content').hidden = true;
      byId('error').hidden = false; setText('error',e.message);
    }
  }
  function renderComparison() {
    const {result} = lastRun;
    byId('comparison').replaceChildren(...result.strategies.map(s => {
      const row = field('tr'), h = field('th',names()[s.key]); h.scope = 'row';
      const label = s.open ? 'Contract open' : s.pending ? 'Waiting for entry' :
        s.events.at(-1)?.type === 'skip' ? 'Entry skipped' : '';
      if (label) h.append(field('small', label));
      const pl = field('td',signed(s.pnl),s.pnl < 0 ? 'neg' : s.pnl > 0 ? 'pos' : '');
      pl.append(field('small',percent(s.returnPct)));
      row.append(h,field('td',money(s.value)),pl,field('td',money(s.cash)),field('td',count(s.shares)),field('td',s.maxDrawdownPct.toFixed(1)+'%'));
      return row;
    }));
  }
  function renderGuide() {
    const {config,path,result} = lastRun;
    const [,acc,decu,roll] = result.strategies, entry = acc.events.find(e => e.type === 'open'),
      exit = acc.events.find(e => e.type === 'ko'), sale = decu.events.find(e=>e.leg === 'decu' && e.type === 'open'),
      rolled = roll.events.find(e=>e.leg === 'roll' && e.type === 'open');
    const card = (title,body) => { const c = field('article'); c.append(field('h3',title),field('p',body)); return c; };
    const first = card(config.startAfterKo ? 'At your KO' : 'If GLD knocks out early',
      config.startAfterKo ? 'You start with ' + count(config.openingShares) + ' GLD shares and ' + money(config.budget) + ' cash. Set aside the cash you want to keep before comparing new trades.' :
      exit ? dateOrDay(path,exit.day) + ' hits the upper KO. The contract releases ' + money(exit.refund,2) + ' and leaves you with ' +
        count(exit.shares) + ' total shares and ' + money(exit.cash) + ' total cash. The refund is included in that cash.' :
        'The selected path has no first-leg KO' + (acc.open ? ' before the last fixing.' : '.') + ' An upper KO stops new purchases. Keep the shares delivered and confirm how much cash is released.');
    if (exit && !config.startAfterKo) {
      const b=field('button','Explore from this KO'); b.type='button';
      b.addEventListener('click',() => {
        byId('stage').value='ko'; byId('budget').value=exit.cash.toFixed(2); byId('opening').value=exit.shares;
        byId('spot').value=exit.price.toFixed(2);
        if (path.dates) byId('replay-date').value=path.dates[exit.day];
        render(); byId('stage').focus(); byId('stage').scrollIntoView({block:'center'});
      }); first.append(b);
    }
    const second=card('If gold keeps falling',entry ? 'At ' + money(entry.strike,2) + ' per share, every fixing below KO still buys ' +
      count(entry.lot) + ' shares. A full first leg buys ' + count(entry.quantity) + ' shares for ' + money(entry.maxPurchaseCost,2) +
      '. Compare that amount with the cash you can leave invested through a long drawdown.' :
      'Holding leaves your existing GLD exposed to further losses. A fresh accumulator adds daily purchases even below strike. Keep the cash floor high enough to fund other commitments.');
    const third=card('If you want to sell on a recovery',sale ? 'The covered sale opens on ' + dateOrDay(path,sale.day) + ' at a ' + money(sale.strike,2) +
      ' sale strike. Maximum delivery is ' + count(sale.quantity) + ' shares. A rally above strike gives up further upside on the shares sold. A lower KO leaves unsold shares with you.' :
      'Set the lowest GLD entry price at which you would consider a sale. Size the entire term against deliverable shares. If the holding is too small, the covered sale is skipped and the shares stay invested.');
    if (entry && sale) {
      const spread = sale.strike - entry.strike;
      const distance = Math.abs(spread) < .001 ? 'matches' : 'is ' + money(Math.abs(spread),2) + ' per share ' + (spread < 0 ? 'below' : 'above');
      third.append(field('p','The sale strike ' + distance + ' the first accumulator strike. This comparison applies to shares bought on that leg.'));
    }
    const fourth=card('If you want to roll',rolled ? 'The first roll enters on ' + dateOrDay(path,rolled.day) + ' and resets the buy strike to ' + money(rolled.strike,2) +
      '. Its maximum purchase costs ' + money(rolled.maxPurchaseCost,2) + '. Compare that new obligation with keeping the refund in cash. This path opens ' + roll.rolls + ' roll' + (roll.rolls === 1 ? '.' : 's.') :
      'A new quote, a settled cash balance and room above the cash floor are needed for a roll. The model opens ' + roll.rolls + ' rolls on this path. Ordinary maturity ends the rollover sequence.');
    byId('game-plan').replaceChildren(first,second,third,fourth);
  }
  function renderLedger() {
    if (!lastRun) return;
    const {path,result} = lastRun, s = result.strategies.find(x=>x.key===byId('focus').value);
    let state = money(s.freeCash) + ' cash outside contracts · ' + money(s.deployableCash) + ' above the cash floor · ' + count(s.shares) + ' shares held.';
    if (s.open) state += ' Open contract with ' + s.open.remainingDays + ' fixings left. ' +
      (s.open.leg==='decu' ? count(s.reservedShares) + ' shares reserved for delivery.' : money(s.open.committedCash,2) + ' remains committed for up to ' + count(s.open.maxRemainingShares) + ' more shares.');
    if (s.pending) state += ' Still waiting for the next eligible ' + (s.pending.leg==='roll'?'roll':'sale') + ' entry' + (s.pending.minEntryPrice ? ' at or above '+money(s.pending.minEntryPrice,2) : '') + '.';
    setText('end-state',state);
    byId('ledger').replaceChildren(...s.events.map(e => {
      const li = field('li'), head=field('strong',dateOrDay(path,e.day) + ' · GLD ' + money(e.price,2));
      const detail=[];
      if (e.type==='open' && e.strike) {
        detail.push('Strike '+money(e.strike,2), 'KO '+money(e.ko,2), count(e.lot)+' shares/fixing',
          (e.leg==='decu' ? 'Up to '+count(e.quantity)+' shares for sale' : 'Funding '+money(e.payment)));
      } else if (e.refund!=null) detail.push(count(e.quantity)+' shares traded on this leg', 'Cash released '+money(e.refund,2));
      if (e.type==='wait') detail.push('Entry trigger '+money(e.minEntryPrice,2));
      detail.push('Total cash '+money(e.cash),count(e.shares)+' shares held');
      li.append(head,field('p',e.message),field('small',detail.join(' · '))); return li;
    }));
  }
  function renderStress() {
    const {config,path} = lastRun, years=numYears(), p0=path.prices[0];
    const head=field('tr'); head.append(field('th','GLD path'),...Object.values(names()).map(label=>field('th',label)));
    byId('stress-head').replaceChildren(head);
    setText('stress-caption','Profit or loss in USD over ' + years + (years===1?' year':' years') + ', with identical cash, holdings and terms. Each row changes only the sequence of GLD closes.');
    const rows=[];
    for (const sc of GldPaths.scenarios.filter(x=>x.id!=='custom')) {
      const alt=GldPaths.scenario({id:sc.id,spot:p0,years,koPct:config.acc.ko});
      const sims=GldStrategy.run(config,alt.prices).strategies;
      const row=field('tr'), h=field('th',sc.label); h.scope='row'; row.append(h);
      h.append(field('small','GLD '+percent((alt.prices.at(-1)/p0-1)*100)));
      for (const s of sims) row.append(field('td',signed(s.pnl),s.pnl<0?'neg':s.pnl>0?'pos':''));
      rows.push(row);
      if (sc.id==='zero') {
        const s=sims[1];
        setText('zero-readout','At a permanent GLD price of $0, '+names().acc.toLowerCase()+' ends with '+money(s.cash)+' cash and '+count(s.shares)+
          ' worthless shares. Portfolio loss is '+money(-s.pnl)+'. '+(s.open ? 'The remaining contract still commits '+money(s.open.committedCash)+'. ' : '')+
          'This tests the funded position. Issuer default and borrowing require separate loss estimates.');
      }
    }
    byId('stress-body').replaceChildren(...rows);
  }

  function renderChart() {
    if (!lastRun) return;
    const {path,result}=lastRun;
    byId('wealth-chart').setAttribute('aria-pressed', String(chartMode==='wealth'));
    byId('price-chart').setAttribute('aria-pressed', String(chartMode==='price'));
    const tracks = chartMode==='wealth' ? result.strategies.map(s=>({key:s.key,label:names()[s.key],values:s.series})) :
      [{key:'price',label:'GLD · USD/share',values:path.prices}];
    const width=700,height=248,left=63,right=680,top=16,bottom=210,n=path.prices.length-1;
    let low=Math.min(...tracks.map(t=>Math.min(...t.values))), high=Math.max(...tracks.map(t=>Math.max(...t.values)));
    const padding=(high-low || Math.max(high*.04,1))*.09;
    low=Math.max(0,low-padding); high+=padding;
    const x=i=>left+(right-left)*i/n, y=v=>bottom-(bottom-top)*(v-low)/(high-low);
    const svg=svgElement('svg',{viewBox:'0 0 '+width+' '+height,role:'img','aria-label':chartMode==='wealth'?'Marked portfolio value in USD across four strategies':'GLD price per share in USD'});
    const textStyle={'font-family':'system-ui,sans-serif','font-size':'13',fill:'#4a6158'};
    for(let i=0;i<=3;i++) {
      const v=low+(high-low)*i/3, y0=y(v);
      svg.append(svgElement('path',{d:'M'+left+' '+y0+'H'+right,stroke:'#d8e1db',fill:'none'}));
      svg.append(svgElement('text',{...textStyle,x:left-8,y:y0+4,'text-anchor':'end'},
        v>=1000000 ? (v/1000000).toFixed(2)+'m' : v>=1000 ? (v/1000).toFixed(1)+'k' : v.toFixed(chartMode==='price'||high-low<5?2:0)));
    }
    for(const day of [0,Math.round(n/2),n]) {
      svg.append(svgElement('text',{...textStyle,x:x(day),y:bottom+24,'text-anchor':day===0?'start':day===n?'end':'middle'},dateOrDay(path,day)));
    }
    tracks.forEach((t,idx) => {
      const points=t.values.map((v,i)=>x(i).toFixed(2)+','+y(v).toFixed(2)).join(' ');
      svg.append(svgElement('polyline',{points,fill:'none',stroke:colors[t.key],'stroke-width':2.1,
        'stroke-dasharray':['none','7 3','2 3','10 3 2 3'][idx],'stroke-linejoin':'round'}));
    });
    const marker = svgElement('line',{id:'fixing-marker',y1:top,y2:bottom,stroke:'#51695e','stroke-dasharray':'3 4'});
    svg.append(marker); byId('chart').replaceChildren(svg);
    svg.addEventListener('click',e=>{
      const pt=svg.createSVGPoint(); pt.x=e.clientX; pt.y=e.clientY;
      const local=pt.matrixTransform(svg.getScreenCTM().inverse());
      byId('scrub').value=Math.max(0,Math.min(n,Math.round(n*(local.x-left)/(right-left))));
      renderReadout();
    });
    byId('legend').replaceChildren(...tracks.map(t=>{
      const item=field('span'), line=field('i',null,'swatch'); line.style.backgroundColor=colors[t.key];
      item.append(line,document.createTextNode(t.label)); return item;
    }));
    renderReadout();
  }
  function renderReadout() {
    if(!lastRun) return;
    const {path,result} = lastRun, day=Number(byId('scrub').value);
    const lines=[dateOrDay(path,day),'GLD '+money(path.prices[day],2)];
    if(chartMode==='wealth') for (const s of result.strategies) lines.push(names()[s.key]+' '+money(s.series[day]));
    setText('inspect',lines.join(' · '));
    const line=byId('fixing-marker'), x=63+617*day/(path.prices.length-1);
    if(line){line.setAttribute('x1',x);line.setAttribute('x2',x);}
  }

  function showContext(xau) {
    const context=GldPaths.marketContext(history,xau);
    const latest=history.at(-1);
    if(latest) byId('spot').placeholder=latest.close.toFixed(2);
    if(!context) {
      if(latest) { setText('asof',' · '+latest.date); setText('gld-mark',money(latest.close,2)); }
      setText('market-note','A shared GLD and spot gold observation is unavailable.'); return;
    }
    setText('asof',' · '+context.date); setText('gld-mark',money(context.gld.price,2)); setText('xau-mark',money(context.xau.price,2));
    setText('market-note','Below their trailing one-year closing highs: GLD '+percent(context.gld.drawdownPct)+', spot gold '+percent(context.xau.drawdownPct)+'. Line shows recent GLD closes.');
    const r=history.filter(row=>row.date<=context.date).slice(-63).map(row=>row.close);
    if(r.length>1) {
      const low=Math.min(...r), high=Math.max(...r), y=v=>40-34*(v-low)/(high-low||1);
      const pts=r.map((v,i)=>(2+296*i/(r.length-1)).toFixed(2)+','+y(v).toFixed(2)).join(' ');
      const svg=svgElement('svg',{viewBox:'0 0 300 45',role:'img','aria-label':'GLD daily closes over up to 63 recent trading sessions',preserveAspectRatio:'none'});
      svg.append(svgElement('polygon',{points:'2,44 '+pts+' 298,44',fill:'#d6e2d2'}),svgElement('polyline',{points:pts,stroke:colors.acc,'stroke-width':1.7,fill:'none'}));
      byId('spark').replaceChildren(svg);
    }
  }
  function setQuote() {
    const selected = byId('quote').value;
    if (selected === '') {
      setText('quote-note','Custom terms. Verify the daily quantity, fixing schedule and guarantee with the bank.'); return;
    }
    const q=quotes[Number(selected)];
    const schedule=AccumulatorModel.observationSchedule({months:q.months,days:q.days,minimum:q.guarantee});
    for(const [id,v] of [['acc-strike',q.strike],['acc-ko',q.ko],['acc-days',q.days],['acc-g',schedule.guaranteeDay]]) byId(id).value=v;
    setText('quote-note','Hub pricing dated '+quoteDate+'. Estimated guarantee of '+schedule.guaranteeDay+' fixings from '+q.guarantee+' guaranteed month(s). Confirm the actual schedule and obtain a fresh quote.');
  }
  async function loadQuotes() {
    const response = await fetch('../data/metals/gld-accumulator-pricing.json',{cache:'no-cache'});
    if(!response.ok) throw Error('Quote file unavailable.');
    const data = await response.json();
    if(data.kind!=='gld-accumulator-pricing'||!Array.isArray(data.rows)) return;
    quoteDate=data.addedDate||data.requestDate||'unknown date';
    quotes=data.rows.filter(q=>Number.isFinite(q.strike) && Number.isFinite(q.ko) && Number.isInteger(q.months) && Number.isInteger(q.days) && Number.isInteger(q.guarantee));
    const group=document.createElement('optgroup'); group.label='Hub terms · '+quoteDate;
    quotes.forEach((q,i)=>group.append(opt(i,q.months+'m · buy '+q.strike+'% · KO '+q.ko+'% · '+q.guarantee+'m guaranteed')));
    byId('quote').append(group);
  }
  function readHandoff() {
    const params=new URLSearchParams(location.search);
    const mapping={spot:'spot',strike:'acc-strike',ko:'acc-ko',days:'acc-days',guarantee:'acc-g'};
    for(const [param,id] of Object.entries(mapping)) {
      const raw=params.get(param); if(raw===null || !raw.trim()) continue;
      const n=Number(raw), el=byId(id);
      if(!Number.isFinite(n) || n<Number(el.min) || n>Number(el.max) || (el.step==='1'&&!Number.isInteger(n))) continue;
      el.value=param==='spot' ? Math.round((n+Number.EPSILON*Math.abs(n))*100)/100 : n;
      carried=true;
    }
    if(carried) { byId('quote').options[0].textContent='From GLD accumulator'; setText('quote-note','Starting terms carried from the GLD accumulator. Confirm the fixing schedule. Set the cash budget and daily quantity for this comparison.'); }
  }
  GldPaths.scenarios.forEach(s=>byId('scenario').append(opt(s.id,s.label)));
  byId('scenario').append(opt('history','Replay historical GLD closes'));
  byId('replay-date').value='2011-08-22';
  readHandoff();
  form.addEventListener('submit',e=>{e.preventDefault();render();if(lastRun) byId('compare-label').scrollIntoView({block:'start',behavior:'smooth'});});
  form.addEventListener('input',e=>{
    if(e.target.id==='quote') setQuote();
    if(['acc-strike','acc-ko','acc-days','acc-g'].includes(e.target.id)) {
      byId('quote').value=''; byId('quote').options[0].textContent='Custom terms'; setQuote();
    }
    render();
  });
  byId('focus').addEventListener('change',renderLedger);
  byId('scrub').addEventListener('input',renderReadout);
  for (const [id,mode] of [['wealth-chart','wealth'],['price-chart','price']]) byId(id).addEventListener('click',()=>{chartMode=mode;renderChart();});
  document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>{
    byId('scenario').value=b.dataset.preset;
    if(isReplay()) {byId('replay-date').value='2011-08-22';byId('years').value='10';}
    render();
  }));
  syncFields();
  loadQuotes().catch(()=>{if(!carried) setText('quote-note','The Hub pricing file is unavailable. Use illustrative terms or enter your quote.');});
  Promise.allSettled([Metals.series('gld'),Metals.series('xau-spot')]).then(([g,x])=>{
    history=g.status==='fulfilled'?g.value.filter(r=>r.close>0):[];
    if(history.length){byId('replay-date').min=history[0].date;byId('replay-date').max=history.at(-1).date;}
    showContext(x.status==='fulfilled'?x.value:[]); ready=true;render();
  });
})();
