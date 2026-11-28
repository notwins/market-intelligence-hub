/* Dated fixing grid for the GLD historical replay. The pricing engine owns all results. */
(function (root) {
  'use strict';
  const boards = new WeakMap();
  const asUSD = new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',minimumFractionDigits:0,maximumFractionDigits:2});
  const dayFormat = new Intl.DateTimeFormat('en-GB', {day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
  const actionKeys = ['acc','hold','roll','decu','wait','staged'];
  const preNames = {acc:'Accumulate and hold',hold:'Buy GLD outright',roll:'Roll after KO',decu:'Accumulate then sell',wait:'Keep cash',staged:'Buy in stages'};
  const postNames = {acc:'Keep GLD and cash',hold:'Buy more GLD',roll:'Roll the refund',decu:'Covered decumulator',wait:'Wait for a dip',staged:'Add in stages'};
  const short = {acc:'Keep GLD',hold:'Buy more',roll:'Roll',decu:'Covered sale',wait:'Wait for dip',staged:'Staged buys'};
  const quoteId = index => 'Q' + String(index + 1).padStart(2,'0');
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

  function milestones(dates, runs, checkpoints) {
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
    const times = dates.map(dateValue);
    const start = new Date(times[0]);
    const span = (times[last] - times[0]) / 86400000;
    const weekly = span < 95, step = weekly || span <= 731 ? 1 : 3;
    let cursor = 0;
    for (let unit = step; ; unit += step) {
      const target = weekly ? times[0] + unit * 7 * 86400000 : anniv(start,unit);
      if (!Number.isFinite(target) || target >= times[last]) break;
      // Use the same most recent close on or before the calendar anniversary
      // as the historical path. The path's labels take precedence when shared.
      while (cursor < last && times[cursor+1] <= target) cursor++;
      if (cursor > 0 && !marks.has(cursor)) add(cursor, weekly ? 'Week ' + unit : 'Month ' + unit);
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
    return {run, entry, last: (acc?.series?.length ?? 0) - 1};
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

  function fullOutcome(info, dates) {
    if (!info.entry) return 'Insufficient data';
    if (info.entry.type === 'skip') return 'Unfunded at entry';
    const exit = info.run.firstExit;
    if (exit && dates[exit.day] && exit.day <= info.last) {
      return (exit.type === 'ko' ? 'KO ' : 'No KO · matured ') + labelDate(dates[exit.day]);
    }
    return info.last < dates.length-1 ? 'Incomplete account data' : 'No KO · open at sample end';
  }

  function outcome(state, index, day, post) {
    const info = state.accounts[index];
    if (!info.run || day > info.last || !info.entry) return {leaders:[],outcomes:{}};
    return root.GldPlays.atDay(info.run,day,post);
  }
  function buttonFor(state, index, day) {
    const info = state.accounts[index], status = stateAt(info, day, state.last);
    const button = el('button','replay-cell'), date = state.dates[day];
    button.type = 'button'; button.tabIndex = -1;
    button.dataset.index = index; button.dataset.day = day; button.dataset.state = status;
    button.setAttribute('aria-pressed','false');
    let label = statusText[status], value = '', description = label, pnl = 0;
    if (status === 'post') {
      const snap = outcome(state,index,day,true);
      const leaders = snap.leaders;
      if (leaders.length) {
        label = leaders.length === 1 ? short[leaders[0]] : leaders.length + '-way tie';
        pnl = snap.outcomes[leaders[0]].pnl;
        value = signed(pnl);
        if (leaders.length > 1) button.dataset.tied='true';
        description = leaders.map(k=>postNames[k]).join(', ') + ' · ' + value + ' since KO';
      } else { label = 'No eligible comparison'; description = label; }
    }
    if (status === 'ko') {
      label = 'KO'; value = asUSD.format(info.run.firstExit.price);
      description = 'First knock-out at ' + value + ' per GLD share. Post-KO comparisons begin from this close.';
    }
    button.append(el('span','replay-cell-label',label));
    if (value) {
      const mark=el('span','replay-cell-value',value);
      if (pnl) mark.dataset.sign=pnl>0?'positive':'negative';
      button.append(mark);
    }
    const full = quoteId(index) + ', ' + labelDate(date) + ', fixing ' + day + '. ' + description;
    button.setAttribute('aria-label',full); button.title = full;
    return button;
  }

  function addColumn(state, day, reasons) {
    const idx = state.days.findIndex(d=>d>day), position = idx < 0 ? state.days.length : idx;
    const head = el('th'); head.scope='col'; head.dataset.day=day;
    head.append(el('span','replay-col-date',labelDate(state.dates[day])),
      el('span','replay-col-elapsed','D'+day + (reasons?.size ? ' · '+[...reasons].join(' · ') : '')));
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
    const {index, day, dates, accounts, prices} = state;
    const info = accounts[index], type = stateAt(info,day,state.last);
    const post = type === 'ko' || type === 'post';
    const snap = outcome(state,index,day,post);
    const date = labelDate(dates[day]), quote = quoteId(index);
    const title = el('h4','',quote + ' · ' + date + ' · fixing ' + day);
    const mark = Number.isFinite(prices[day]) ? 'GLD closed at ' + asUSD.format(prices[day]) + '. ' : '';
    let description = statusText[type] + '. ';
    if (post) {
      const ko = info.run.firstExit, when = labelDate(dates[ko.day]);
      description = 'On ' + when + ', the first KO left ' + ko.shares.toLocaleString('en-US') + ' GLD shares and ' +
        asUSD.format(ko.cash) + ' in cash. P&L below starts at that KO close.';
      if (type === 'ko') description += ' Each action starts from that same balance.';
    } else if (type === 'missing') description = 'Account results are unavailable at this fixing.';
    else description += 'P&L below starts at the entry close.';
    if (day === state.last) description += ' This is the last observed session in this replay.';
    const nodes = [title,el('p','replay-readout-note',mark+description)];
    const list = el('dl','replay-actions'), names = post ? postNames : preNames;
    if (snap.leaders.length) {
      const amount=signed(snap.outcomes[snap.leaders[0]].pnl);
      const winners=snap.leaders.map(k=>names[k]).join(', ');
      nodes.push(el('p','replay-readout-lead',snap.leaders.length === 1 ?
        'Highest eligible P&L · '+winners+' at '+amount+'.' : 'Tied at '+amount+' · '+winners+'.'));
    }
    for (const key of actionKeys) {
      const item = snap.outcomes[key];
      if (!item) continue;
      const tile = el('div');tile.dataset.strategy=key;
      tile.dataset.eligible = item.eligible; tile.dataset.leader = snap.leaders.includes(key);
      const detail = el('dd');
      const amount=el('span','replay-action-pnl',signed(item.pnl));
      if (item.pnl) amount.dataset.sign=item.pnl>0?'positive':'negative';
      detail.append(amount,el('span','replay-action-status',
        (item.eligible ? '' : 'Ineligible. ') + item.status));
      tile.append(el('dt','',names[key]),detail); list.append(tile);
    }
    if (list.childElementCount) nodes.push(list);
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

  function render({path,quotes,runs,day=0,selected=0,onSelect}) {
    const section = el('section','replay-board');
    section.append(el('h3','','Historical KO leaderboard'));
    const dates = path?.dates, prices = path?.prices;
    if (!Array.isArray(dates) || !dates.length || dates.length !== prices?.length || !Array.isArray(quotes) || !quotes.length) {
      section.append(el('p','replay-board-note','Dated GLD closes and priced accumulator rows are needed for the leaderboard.'));
      return section;
    }
    section.append(el('p','replay-board-note','Each column uses GLD closes through its date. After a KO it shows the highest eligible P&L in USD since that KO. The frozen quote column gives the outcome over the full replay.'));
    const legend = el('div','replay-board-legend');
    for (const [kind,text] of [['ko','KO · first trigger'],['post','After KO · leading action'],['maturity','Maturity · no KO'],['future','Later than selected date']]) {
      const key = el('span','replay-key',text); key.dataset.state=kind; legend.append(key);
    }
    section.append(legend);
    const scroller=el('div','replay-grid-scroll');
    scroller.setAttribute('role','region');scroller.setAttribute('aria-label','Historical quotes by fixing date');
    const table=el('table','replay-grid');
    table.createCaption().textContent='All quotes in USD. Use arrow keys to move between dates and quotes, then press Enter to inspect.';
    const head = table.createTHead().insertRow();
    const first=el('th','','Quote · full replay');first.scope='col';head.append(first);
    const accounts=quotes.map((_,i)=>account(runs?.[i]));
    const body=table.createTBody();
    const rows=quotes.map((q,i)=>{
      const row=body.insertRow();row.dataset.index=i;
      const th=el('th','replay-quote');th.scope='row';
      th.append(el('span','replay-quote-id',quoteId(i)),
        el('span','replay-quote-terms',q.months+'m · strike '+q.strike+'% · KO '+q.ko+'% · '+q.guarantee+'m guarantee'),
        el('span','replay-quote-outcome',fullOutcome(accounts[i],dates)));row.append(th);return row;
    });
    scroller.append(table);section.append(scroller);
    const read=el('div','replay-readout');section.append(read);
    const state={dates,prices,accounts,last:dates.length-1,days:[],columns:new Map(),rows,head,scroller,readout:read,
      index:null,day:null,transient:null,tabCell:null};
    boards.set(section,state);
    const marks=milestones(dates,runs || [],path.checkpoints);
    for (const d of [...marks.keys()].sort((a,b)=>a-b)) addColumn(state,d,marks.get(d));
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
  root.GldReplayBoard = Object.freeze({render,select,days});
})(globalThis);
