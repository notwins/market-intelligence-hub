/* Dated fixing grid for the GLD historical replay. The pricing engine owns all results. */
(function (root) {
  'use strict';
  const boards = new WeakMap();
  const asUSD = new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',minimumFractionDigits:0,maximumFractionDigits:2});
  const dayFormat = new Intl.DateTimeFormat('en-GB', {day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
  const {labels,quoted,quoteId,fixingLabel} = root.GldReplayResults;
  const short = {acc:'Accumulate and hold',roll:'Roll after KO',decu:'Covered decumulator',
    add:'Buy more after KO',dipwait:'Wait for dip after KO',dipstaged:'Add in stages after KO'};
  const drawText = n => n.toFixed(2) + '%';
  const signed = value => (value < 0 ? '−' : value > 0 ? '+' : '') + asUSD.format(Math.abs(value));
  const dateValue = iso => Date.parse(iso + 'T00:00:00Z');
  function labelDate(iso) {
    const time = dateValue(iso);
    return Number.isFinite(time) ? dayFormat.format(time) : 'Date unavailable';
  }
  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function anniv(start, months) {
    const lastDay = new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+months+1,0));
    lastDay.setUTCDate(Math.min(start.getUTCDate(),lastDay.getUTCDate()));
    return lastDay.getTime();
  }

  function milestones(path, runs) {
    const {dates,checkpoints,proxy} = path;
    const last = dates.length - 1, marks = new Map();
    function add(day, label) {
      if (!Number.isInteger(day) || day < 0 || day > last) return;
      if (!marks.has(day)) marks.set(day, new Set());
      marks.get(day).add(label);
    }
    add(0,'Entry'); add(last,'Sample end');
    for (const point of checkpoints || []) {
      if (point.label && point.day > 0 && point.day < last) add(point.day,point.label);
    }
    if (proxy) {
      const step = last < 750 ? 1 : 3;
      for (let month=step; month*21<last; month+=step) add(month*21,'Month '+month);
    } else {
      const times = dates.map(dateValue), start = new Date(times[0]);
      const span = (times[last] - times[0]) / 86400000;
      const weekly = span < 95, step = weekly || span <= 731 ? 1 : 3;
      let cursor = 0;
      for (let unit = step; ; unit += step) {
        const target = weekly ? times[0] + unit * 7 * 86400000 : anniv(start,unit);
        if (!Number.isFinite(target) || target >= times[last]) break;
        while (cursor < last && times[cursor+1] <= target) cursor++;
        if (cursor > 0 && !marks.has(cursor)) add(cursor, weekly ? 'Week ' + unit : 'Month ' + unit);
      }
    }
    for (const run of runs) {
      const exit = run?.firstExit;
      if (exit?.type === 'ko') add(exit.day,'KO');
      if (exit?.type === 'maturity') add(exit.day,'Maturity');
    }
    return marks;
  }

  function account(run) {
    const acc = run?.strategies?.find(s => s.key === 'acc');
    const entry = acc?.events?.find(e => e.leg === 'acc' && (e.type === 'open' || e.type === 'skip'));
    return {run, entry, results: root.GldReplayResults.account(run), last: (acc?.series?.length ?? 0) - 1};
  }
  function stateAt(info, day, last) {
    if (!info.entry || day > info.last) return 'missing';
    if (info.entry.type === 'skip') return 'unfunded';
    const exit = info.run.firstExit;
    if (exit && day >= exit.day) {
      if (exit.type === 'ko') return day === exit.day ? 'ko' : 'post';
      if (exit.type === 'maturity') return day === exit.day ? 'maturity' : 'ended';
    }
    if (day === 0) return 'entry';
    return day === last ? 'open-end' : 'live';
  }
  const statusText = {entry:'Opened',live:'No KO yet',ko:'Knock-out',post:'After KO',maturity:'Maturity',
    ended:'Matured · no KO',unfunded:'Unfunded',missing:'Insufficient data','open-end':'Open at sample end'};

  function fullOutcome(info, path) {
    if (!info.entry) return 'Insufficient data';
    if (info.entry.type === 'skip') return 'Unfunded at entry';
    const exit = info.run.firstExit;
    if (exit && exit.day <= info.last) {
      return (exit.type === 'ko' ? 'KO ' : 'No KO · matured ') + fixingLabel(path,exit.day,labelDate);
    }
    return info.last < path.dates.length-1 ? 'Incomplete account data' : 'No KO · open at sample end';
  }

  function refreshCell(state, button) {
    const {index, day} = button.dataset;
    const d = Number(day), i = Number(index);
    const info = state.accounts[i], status = stateAt(info,d,state.last);
    const result = info.results.funded ? (state.play === 'best' ? info.results.best(d) : info.results.at(state.play,d)) : null;
    const exit = info.run.firstExit;
    const firstStatus = status === 'post' ? 'KO ' + fixingLabel(state.path,exit.day,labelDate) : statusText[status];
    const detail = result?.eligible ? short[result.key] : (result?.pending ? 'Action pending' : 'Follow-on unavailable');
    const parts = [el('span','replay-cell-status',firstStatus)];
    if (result) {
      parts.push(el('span','replay-cell-label',detail));
      const amount=el('span','replay-cell-value',signed(result.pnl));
      amount.dataset.sign=result.pnl>0?'positive':result.pnl<0?'negative':'flat';
      parts.push(amount,el('span','replay-cell-draw','Max DD '+drawText(result.drawdown)));
    }
    button.replaceChildren(...parts);
    button.setAttribute('aria-label',quoteId(i)+', '+fixingLabel(state.path,d,labelDate)+'. '+parts.map(p=>p.textContent).join('. '));
    button.title = result?.status ?? firstStatus;
  }

  function buttonFor(state, index, day) {
    const button = el('button','replay-cell');
    button.type = 'button'; button.tabIndex = -1;
    button.dataset.index = index; button.dataset.day = day;
    button.dataset.state = stateAt(state.accounts[index],day,state.last);
    button.setAttribute('aria-pressed','false');
    refreshCell(state,button);
    return button;
  }

  function addColumn(state, day, reasons) {
    const idx = state.days.findIndex(d=>d>day), position = idx < 0 ? state.days.length : idx;
    const head = el('th'); head.scope='col'; head.dataset.day=day;
    head.append(el('span','replay-col-date',fixingLabel(state.path,day,labelDate)),
      el('span','replay-col-elapsed','Fixing '+day + (reasons?.size ? ' · '+[...reasons].join(' · ') : '')),
      el('span','replay-col-price',asUSD.format(state.prices[day])));
    state.head.insertBefore(head,state.head.children[position+1] || null);
    const cells = state.rows.map((row, index) => {
      const td = row.insertCell(position+1), btn = buttonFor(state,index,day);
      td.dataset.state=btn.dataset.state;
      td.append(btn);
      return btn;
    });
    state.days.splice(position,0,day);
    state.columns.set(day,{head,cells});
  }
  function removeColumn(state, day) {
    const col = state.columns.get(day);
    col.head.remove();
    for (const cell of col.cells) cell.parentElement.remove();
    state.columns.delete(day);
    state.days.splice(state.days.indexOf(day),1);
  }

  function readout(state) {
    const {index, day, path, accounts, prices} = state;
    const info = accounts[index], type = stateAt(info,day,state.last);
    const date = fixingLabel(path,day,labelDate), quote = quoteId(index);
    const exit = info.run.firstExit;
    const book = path.proxy ? 'Gold-price proxy' : 'GLD close';
    const status = type === 'ko' || type === 'post' ?
      'First KO on ' + fixingLabel(path,exit.day,labelDate) + ' at ' + asUSD.format(exit.price) + '.' : statusText[type] + '.';
    const nodes = [el('h4','',quote + ' · ' + date),
      el('p','replay-readout-note',book + ' ' + asUSD.format(prices[day]) + '. ' + status + ' P&L and max drawdown are from the original entry.')];
    if (info.results.funded) {
      const list = el('dl','replay-actions'), best = info.results.best(day);
      for (const key of quoted) {
        const item = info.results.at(key,day), tile = el('div'), detail = el('dd');
        tile.dataset.eligible = item.eligible; tile.dataset.leader = key === best?.key;
        const amount=el('span','replay-action-pnl',signed(item.pnl));
        if (item.pnl) amount.dataset.sign=item.pnl>0?'positive':'negative';
        detail.append(amount);
        detail.append(el('span','replay-action-draw','Max drawdown '+drawText(item.drawdown)));
        detail.append(el('span','replay-action-status',(item.pending?'Action pending. ':item.eligible?'':'Follow-on unavailable. ')+item.status));
        tile.append(el('dt','',labels[key]),detail); list.append(tile);
      }
      nodes.push(list);
    }
    state.readout.replaceChildren(...nodes);
  }

  function keepVisible(state, button) {
    if (!button?.isConnected) return;
    const viewport = state.scroller.getBoundingClientRect(), box = button.getBoundingClientRect();
    if (!viewport.width || !viewport.height) return;
    const edge = viewport.left + state.head.children[0].getBoundingClientRect().width;
    const top = viewport.top + state.head.getBoundingClientRect().height;
    if (box.left < edge) state.scroller.scrollLeft -= edge - box.left + 3;
    else if (box.right > viewport.right) state.scroller.scrollLeft += box.right-viewport.right+3;
    if (box.top < top) state.scroller.scrollTop -= top-box.top+3;
    else if (box.bottom > viewport.bottom) state.scroller.scrollTop += box.bottom-viewport.bottom+3;
  }
  function setPressed(state, index, day, on) {
    const col = state.columns.get(day), cell = col?.cells[index];
    if (!cell) return;
    col.head.dataset.selected = on;
    state.rows[index].dataset.selected = on;
    state.rows[index].children[0].dataset.selected = on;
    cell.setAttribute('aria-pressed',String(on)); cell.parentElement.dataset.selected = on;
    if (on) {
      if (state.tabCell) state.tabCell.tabIndex = -1;
      cell.tabIndex = 0; state.tabCell = cell;
    }
  }
  function select(section, index, day, options = {}) {
    const state = boards.get(section);
    if (!state || !Number.isInteger(index) || !state.rows[index] || !Number.isInteger(day) || day < 0 || day > state.last) return;
    if (state.index === index && state.day === day) {
      if (options.scroll !== false) keepVisible(state,state.columns.get(day).cells[index]);
      return;
    }
    if (state.day !== null) setPressed(state,state.index,state.day,false);
    if (state.transient !== null && day !== state.transient) {
      removeColumn(state,state.transient);
      state.transient = null;
    }
    if (!state.columns.has(day)) { addColumn(state,day,null); state.transient = day; }
    for (const [d,col] of state.columns) {
      const later = String(d>day);
      if (col.head.dataset.future !== later) {
        col.head.dataset.future = later;
        for (const btn of col.cells) btn.parentElement.dataset.future = later;
      }
    }
    state.index = index; state.day = day;
    setPressed(state,index,day,true);
    readout(state);
    if (options.scroll !== false) keepVisible(state,state.columns.get(day).cells[index]);
  }

  function addScrollButtons(controls, scroller, labels=['‹ Scroll left','Scroll right ›'], frozen=()=>0) {
    labels.forEach((text,i)=>{
      const nav=el('button','',text);nav.type='button';
      nav.addEventListener('click',()=>scroller.scrollBy({left:(i?1:-1)*Math.max(120,scroller.clientWidth-frozen())}));
      controls.append(nav);
    });
  }

  function render({path,quotes,runs,day=0,selected=0,play='best',onSelect}) {
    const section = el('section','replay-board');
    section.append(el('h3','','All '+quotes.length+' quotes through time'));
    const dates = path?.dates, prices = path?.prices;
    if (!Array.isArray(dates) || !dates.length || dates.length !== prices?.length || !Array.isArray(quotes) || !quotes.length) {
      section.append(el('p','replay-board-note','A historical price path and priced accumulator rows are needed for the replay.'));
      return section;
    }
    section.append(el('p','replay-window-label',labelDate(dates[0])+' – '+labelDate(dates.at(-1))+' · '+(path.proxy?'Monthly gold proxy':'GLD daily closes')));
    section.append(el('p','replay-board-note','Scroll right through the checkpoints. Each cell shows the first accumulator’s status, total P&L and max drawdown through that fixing. Select a play to apply it to every quote. Select a cell to compare all follow-on choices.'));
    const legend = el('div','replay-board-legend');
    for (const [kind,text] of [['ko','KO · first trigger'],['post','After KO'],['maturity','Maturity · no KO'],['future','Later than selected date']]) {
      const key = el('span','replay-key',text); key.dataset.state=kind; legend.append(key);
    }
    section.append(legend);
    const scroller=el('div','replay-grid-scroll');
    scroller.setAttribute('role','region');scroller.setAttribute('aria-label','Historical quotes by fixing date');
    const table=el('table','replay-grid');
    table.createCaption().textContent='P&L in USD. Max DD is the largest drop from an account peak through that fixing. Use arrow keys and Enter to inspect.';
    const head = table.createTHead().insertRow();
    const first=el('th','','Quote · full replay');first.scope='col';head.append(first);
    const accounts=quotes.map((_,i)=>account(runs?.[i]));
    const body=table.createTBody();
    const rows=quotes.map((q,i)=>{
      const row=body.insertRow();row.dataset.index=i;
      const th=el('th','replay-quote');th.scope='row';
      th.append(el('span','replay-quote-id',quoteId(i)),
        el('span','replay-quote-terms',q.months+'m · strike '+q.strike+'% · KO '+q.ko+'% · '+q.guarantee+'m guarantee'),
        el('span','replay-quote-outcome',fullOutcome(accounts[i],path)));row.append(th);return row;
    });
    const controls=el('div','replay-grid-controls');
    const playTitle=el('p','replay-control-label','Play in each cell');
    const choices=el('div','replay-play-choices');
    choices.setAttribute('role','group');choices.setAttribute('aria-label','Play in each cell');
    controls.append(playTitle,choices);
    const navigation=el('div','replay-scroll-tools');
    addScrollButtons(navigation,scroller,['‹ Earlier dates','Later dates ›'],()=>head.cells[0].offsetWidth);
    controls.append(navigation);
    section.append(controls);scroller.append(table);section.append(scroller);
    const read=el('div','replay-readout');section.append(read);
    const state={path,prices,accounts,play,last:dates.length-1,days:[],columns:new Map(),rows,head,scroller,readout:read,
      index:null,day:null,transient:null,tabCell:null};
    boards.set(section,state);
    const marks=milestones(path,runs || []);
    for (const d of [...marks.keys()].sort((a,b)=>a-b)) addColumn(state,d,marks.get(d));
    for (const [key,label] of [['best','Best play by fixing'],...quoted.map(key=>[key,short[key]])]) {
      const choice=el('button','',label);choice.type='button';choice.dataset.play=key;
      choice.setAttribute('aria-pressed',String(key===state.play));
      choices.append(choice);
    }
    choices.addEventListener('click',event=>{
      const choice=event.target.closest('button[data-play]');
      if (!choice || state.play===choice.dataset.play) return;
      state.play=choice.dataset.play;
      for (const control of choices.children) control.setAttribute('aria-pressed',String(control===choice));
      for (const {cells} of state.columns.values()) for (const cell of cells) refreshCell(state,cell);
    });
    table.addEventListener('click',event=>{
      const button=event.target.closest('button.replay-cell');
      if (!button || !table.contains(button)) return;
      const i=Number(button.dataset.index), d=Number(button.dataset.day);
      select(section,i,d,{scroll:false});onSelect?.(i,d);
    });
    table.addEventListener('keydown',event=>{
      const btn=event.target.closest('button.replay-cell');
      if (!btn || !table.contains(btn) || event.altKey || event.metaKey) return;
      let i=Number(btn.dataset.index), c=state.days.indexOf(Number(btn.dataset.day));
      switch(event.key) {
        case 'ArrowRight': c++; break;
        case 'ArrowLeft': c--; break;
        case 'ArrowDown': i++; break;
        case 'ArrowUp': i--; break;
        case 'Home': c=0;if(event.ctrlKey)i=0;break;
        case 'End': c=state.days.length-1;if(event.ctrlKey)i=rows.length-1;break;
        default:return;
      }
      event.preventDefault();
      i=Math.max(0,Math.min(i,rows.length-1));c=Math.max(0,Math.min(c,state.days.length-1));
      const target=state.columns.get(state.days[c]).cells[i];
      if(state.tabCell)state.tabCell.tabIndex=-1;
      state.tabCell=target;target.tabIndex=0;target.focus({preventScroll:true});keepVisible(state,target);
    });
    const initialDay=Number.isInteger(day) && day>=0 && day<=state.last?day:0;
    select(section,rows[selected]?selected:0,initialDay,{scroll:false});
    if (initialDay || selected) requestAnimationFrame(()=>keepVisible(state,state.tabCell));
    return section;
  }
  function days(section) {
    const state=boards.get(section);
    return state ? [...state.days] : [];
  }
  root.GldReplayBoard = Object.freeze({render,select,days,addScrollButtons});
})(globalThis);
