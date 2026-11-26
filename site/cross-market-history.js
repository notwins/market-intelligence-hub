(function () {
  'use strict';
  const D = window.HistoricalFredData, M = window.CrossMarketModel, notes = window.CrossMarketNotes;
  const status = document.querySelector('#market-status');
  if (window.self !== window.top && new URLSearchParams(location.search).get('embed') === '1') {
    document.body.classList.add('embedded-history');
    // The main desk owns the outer scroll. Refit after images, tables and disclosures resize.
    const frame = window.frameElement;
    if (frame?.id === 'full-history-frame') {
      const fit = () => {
        const height = Math.ceil(document.body.getBoundingClientRect().height);
        if (height > 0 && frame.style.height !== height+'px') frame.style.height = height+'px';
      };
      new ResizeObserver(fit).observe(document.body);
    }
    document.querySelector('main').addEventListener('click', event => {
      const link = event.target.closest('a[href]');
      if (link && !link.getAttribute('href').startsWith('#')) link.target = '_top';
    });
  }
  const guide = document.querySelector('#reading-guide');
  const guideButton = document.querySelector('#open-reading-guide');
  guideButton.hidden = false;
  guideButton.addEventListener('click', () => {
    const frame = window.frameElement;
    if (frame?.id === 'full-history-frame') {
      const top = Math.max(0,-frame.getBoundingClientRect().top);
      guide.style.setProperty('--guide-top',top+16+'px');
      guide.style.setProperty('--guide-height',Math.max(120,frame.ownerDocument.documentElement.clientHeight-32)+'px');
    }
    guide.showModal();
  });
  guide.querySelectorAll('[data-guide-jump]').forEach(anchor => anchor.addEventListener('click', () => guide.close()));
  const colors = ['#114fa9', '#087e72', '#6843a6', '#b66a08', '#b63d56', '#676f87', '#233044'];
  const equityColors = ['#086b58', '#247821', '#007398', '#2354ac', '#4a50a4',
    '#be2d36', '#a02d64', '#a84d10', '#806018', '#754b7e'];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const num = (v, dp = 1) => Number.isFinite(v) ? v.toFixed(dp) : '—';
  const signed = (v, dp = 1) => Number.isFinite(v) ? (v > 0 ? '+' : '') + num(v, dp) : '—';
  const fdate = new Intl.DateTimeFormat('en-GB', {day:'numeric', month:'short', year:'numeric', timeZone:'UTC'});
  const short = new Intl.DateTimeFormat('en-GB', {month:'short', year:'2-digit', timeZone:'UTC'});
  const day = d => d ? fdate.format(new Date(d + 'T00:00:00Z')) : 'unavailable';
  const tail = p => p.at(-1)?.date;
  const ticker = r => r.ticker || r.bbTicker.replace(/ US$/, '');
  const calc = (points, card) => M.windowPoints(points || [], card.start, card.end);
  const link = (url, label) => '<a href="' + esc(url) + '">' + esc(label) + '</a>';
  const chartLine = (label, points, color, gap = 7, dash = '') => ({label, points, color, gap, dash});
  const singaporeToday = () => {
    const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Singapore', year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(new Date());
    return ['year', 'month', 'day'].map(key => parts.find(p => p.type === key).value).join('-');
  };

  async function json(path) {
    const response = await fetch(path, {cache:'no-cache'});
    if (!response.ok) throw Error('HTTP ' + response.status + ' · ' + path);
    return response.json();
  }

  function figure(card, series, unit, title, opts = {}) {
    const prepared = series.map(s => ({...s, points:calc(s.points, card)}));
    const values = prepared.flatMap(s => s.points.map(p => p.value));
    if (opts.reference) values.push(...opts.reference);
    const plot = {x:72, y:27, w:674, h:121};
    const span = M.days(card.start, card.end);
    const x = date => plot.x + M.days(card.start, date) / span * plot.w;
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 1;
    const pad = (max - min || Math.abs(max) || 1) * 0.09;
    const low = min - pad, high = max + pad;
    const y = v => plot.y + (high - v) / (high - low) * plot.h;
    const grid = Array.from({length:4}, (_, i) => {
      const v = high - (high - low) * i / 3;
      return '<line class="gridline" x1="72" x2="746" y1="' + y(v) + '" y2="' + y(v) + '"/><text x="64" y="' + (y(v) + 5) + '" text-anchor="end">' + num(v, unit === 'index' ? 0 : 1) + '</text>';
    }).join('');
    const xTicks = Array.from({length:5}, (_, i) => {
      const date = new Date(Date.parse(card.start) + i / 4 * span * 86400000);
      const label = short.format(date);
      return '<text x="' + (plot.x + i / 4 * plot.w) + '" y="174" text-anchor="' + (i === 0 ? 'start' : i === 4 ? 'end' : 'middle') + '">' + label + '</text>';
    }).join('');
    const marks = card.events.map((e, i) => ({date:e.date, label:String(i+1), title:e.label}));
    if (card.current) marks.push({date:card.end,label:'Now',title:'Current in Singapore'});
    const eventLines = marks.map((mark, i) => {
      const pos = x(mark.date);
      return '<g class="event-marker" data-event-date="' + mark.date + '"><title>' + esc(mark.title) + ' · ' + mark.date + '</title><line x1="' + pos + '" x2="' + pos + '" y1="23" y2="148"/><text text-anchor="middle" x="' + Math.min(pos, 731) + '" y="' + (i % 2 ? 25 : 14) + '">' + mark.label + '</text></g>';
    }).join('');
    const guides = (opts.reference || []).map(v => '<line class="reference" x1="72" x2="746" y1="' + y(v) + '" y2="' + y(v) + '"/>').join('');
    const paths = prepared.map(s => {
      let previous = null;
      const path = s.points.map(p => {
        const move = !previous || M.days(previous.date, p.date) > s.gap;
        previous = p;
        return (move ? 'M' : 'L') + x(p.date).toFixed(2) + ',' + y(p.value).toFixed(2);
      }).join('');
      const dots = s.points.filter((p,i) => (!i || M.days(s.points[i-1].date,p.date) > s.gap) &&
        (!s.points[i+1] || M.days(p.date,s.points[i+1].date) > s.gap));
      if (s.peak) dots.push(s.peak);
      return '<path class="series-path" d="' + path + '" stroke="' + s.color + '" stroke-dasharray="' + s.dash + '"/>' +
        dots.map(p => '<circle cx="' + x(p.date) + '" cy="' + y(p.value) + '" r="4" fill="' + s.color + '"><title>' +
          esc(s.label) + ' · ' + p.date + ' · ' + num(p.value,2) + ' ' + esc(unit) + '</title></circle>').join('');
    }).join('');
    const legend = prepared.map(s => {
      const last = s.points.at(-1);
      return '<li><i style="--key:' + s.color + '" class="' + (s.dash ? 'dashed' : '') + '"></i><span>' + esc(s.label) +
        (last ? ' <b>' + num(last.value,2) + '</b><small> · ' + day(last.date) + '</small>' : ' <small>· unavailable</small>') + '</span></li>';
    }).join('');
    return '<svg class="plot" role="img" aria-label="' + esc(title + ', ' + unit + ', ' + card.start + ' through ' + card.end) +
      '" viewBox="0 0 760 183" data-start="' + card.start + '" data-end="' + card.end + '">' +
      grid + guides + paths + eventLines + xTicks + '</svg>' +
      (prepared.some(s => s.points.length) ? '' : '<p class="gap">No saved values for this window.</p>') +
      (legend ? '<ul class="legend" aria-label="Last observation in this chart">' + legend + '</ul>' : '');
  }

  function panel(card, title, unit, series, description, opts) {
    return '<section class="panel" data-subject="'+esc(opts?.subject || 'macro')+'"><h3>' + esc(title) + ' <small>' + esc(unit) + '</small></h3><p class="caption">' + description +
      '</p>' + figure(card, series, unit, title, opts) + '</section>';
  }

  function heat(value, threshold) {
    if (!Number.isFinite(value)) return '';
    if (Math.abs(value) < threshold) return 'flat';
    return value > 0 ? 'higher' : 'lower';
  }

  function yieldLines(card, tenor, sources) {
    const {us, sg} = sources.month[tenor];
    const weekly = sources.weeklyTreasuries.get('UST ' + tenor);
    const lines = [
      weekly ? chartLine('UST ' + tenor + ' weekly', weekly, colors[0], 10)
        : chartLine('UST ' + tenor + ' month-end', us, colors[0], 33),
      chartLine('SGS ' + tenor + ' month-end', sg, colors[1], 33)
    ];
    if (card.current) {
      const sgDaily = sources.daily[tenor].sg;
      const first = sgDaily[0]?.date;
      lines.push(chartLine('UST ' + tenor + ' daily', sources.daily[tenor].us.filter(p => p.date >= first), colors[0], 7, '4 4'));
      lines.push(chartLine('SGS ' + tenor + ' daily', sgDaily, colors[1], 7, '4 4'));
    }
    return lines;
  }

  function yieldTable(event, sources) {
    const rows = M.eventYieldRows(event, sources.month);
    const ten = rows.find(r => r.tenor === '10Y');
    const two = rows.find(r => r.tenor === '2Y');
    const focus = ten.from && two.from
      ? '<strong>Focus on the 10Y spread move of ' + signed(ten.spread,0) + ' bp and the 2Y spread move of ' + signed(two.spread,0) + ' bp.</strong> Positive means UST rose more or fell less than SGS.'
      : '<strong>Matched month-end coverage is incomplete.</strong>';
    return '<p class="focus">' + focus + '</p><div class="table-wrap"><table><caption>From last matched month-end before the event to the last at or before +12 months</caption>' +
      '<thead><tr><th scope="col">Tenor</th><th scope="col">Matched months</th><th scope="col">UST Δ bp</th><th scope="col">SGS Δ bp</th><th scope="col">Spread Δ bp</th></tr></thead><tbody>' +
      rows.map(r => '<tr><th scope="row">' + r.tenor + '</th><td>' + (r.from ? short.format(new Date(r.from.date)) + ' → ' + short.format(new Date(r.to.date)) : '—') + '</td>' +
        ['us','sg','spread'].map(k => '<td class="' + heat(r[k],10) + '">' + signed(r[k],0) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  }

  function latestYield(card, source) {
    const pairs = Object.fromEntries(M.tenors.map(t => [t, M.matched(source.daily[t].us, source.daily[t].sg)]));
    const date = tail(calc(pairs['10Y'],card));
    if (!date) return '<p class="gap">No same-date UST and SGS close is saved in this window.</p>';
    const rows = M.tenors.flatMap(tenor => {
      const p = pairs[tenor].find(p => p.date === date);
      return p ? [{tenor, ...p, spread:(p.us-p.sg)*100}] : [];
    });
    const ten = rows.find(r => r.tenor === '10Y');
    const two = rows.find(r => r.tenor === '2Y');
    return '<p class="focus"><strong>Focus on the ' + signed(ten.spread,0) + ' bp 10Y spread' +
      (two ? ' and the ' + signed(two.spread,0) + ' bp 2Y spread' : '') +
      '.</strong> Latest matched closes on ' + day(date) + '. The individual latest dates may differ.</p><div class="table-wrap"><table><caption>Matched daily benchmark yields</caption>' +
      '<thead><tr><th scope="col">Tenor</th><th scope="col">UST (%)</th><th scope="col">SGS (%)</th><th scope="col">UST–SGS (bp)</th></tr></thead><tbody>' +
      rows.map(r => '<tr><th scope="row">' + r.tenor + '</th><td>' + num(r.us,2) + '</td><td>' + num(r.sg,2) + '</td><td class="' + heat(r.spread,10) + '">' + signed(r.spread,0) + '</td></tr>').join('') +
      '</tbody></table></div>';
  }

  function equitySection(card, source) {
    const rank = M.chooseStockRanking(card, source.spx, source.weekly, source.bos);
    const ranks = rank ? [...rank.winners, ...rank.losers] : [];
    const index = calc(source.spx, card);
    const spx = index.find(p => p.date === rank?.from) || index[0];
    const rebase = (points, base) => base ? points.map(p => ({...p, value:p.value / base.value * 100})) : [];
    const lines = [chartLine('SPX', rebase(index, spx), colors[6])];
    const winners = rank?.winners.length ?? 0;
    ranks.forEach((r,i) => lines.push(chartLine(ticker(r.record), rebase(r.points, r.from),
      equityColors[i < winners ? i : 5 + i - winners], rank.basis.startsWith('BOS') ? 45 : 10, i >= winners ? '6 4' : '')));
    const ranked = rank ? '<p class="focus"><strong>' + esc(ticker(rank.winners[0].record)) + ' led at ' + signed(rank.winners[0].change) +
      '% and ' + esc(ticker(rank.losers[0].record)) + ' trailed at ' + signed(rank.losers[0].change) + '%.</strong> ' +
      esc(rank.basis) + ' · ' + rank.count + ' comparable listings from the ' + source.watchlistSize + '-listing watchlist · ' + day(rank.from) + ' to ' + day(rank.to) +
      ' · ' + rank.jumps + ' paths flagged for possible price discontinuities.</p><div class="table-wrap"><table data-return-sparks="cross-market-' + esc(card.id) + '"><caption>Top and bottom USD share price changes on the common ranking dates</caption><thead>' +
      '<tr><th scope="col">Group</th><th scope="col">Listing</th><th scope="col">Price Δ (%)</th><th scope="col">vs SPX (pp)</th></tr></thead><tbody>' +
      ranks.map((r,i) => {
        const benchmark = index.find(p => p.date === rank.to);
        const excess = r.change - M.pct(spx.value,benchmark.value);
        const provider = rank.basis.startsWith('BOS') ? 'cross-bos' : 'cross-weekly';
        const attrs = window.ReturnSparks?.instrument(r.record.id,r.record.currency,rank.to,provider) || '';
        return '<tr ' + attrs + '><td>' + (i < winners ? 'Top ' + (i+1) : 'Bottom ' + (i-winners+1)) + '</td><th scope="row">' + esc(r.record.bbTicker) +
          '</th><td class="' + heat(r.change,5) + '">' + signed(r.change) + '</td><td class="' + heat(excess,5) + '">' + signed(excess) + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="gap">' + (source.watchlistSize ?
        'Too few watchlist shares have comparable price history for this period.' : 'The stock watchlist could not load.') + '</p>';
    const valuationRecords = source.records.filter(r => ['pe','pb'].some(metric =>
      calc(source.valuations[metric].get(r.id),card).length > 0));
    const best = ranks.find(r => valuationRecords.some(v => v.id === r.record.id))?.record.id ||
      valuationRecords.find(r => r.ticker === 'MSFT')?.id || valuationRecords[0]?.id;
    const valuation = valuationRecords.length ? '<details class="valuation"><summary>Open share price, P/E and P/B comparison</summary>' +
      '<p><strong>Compare the selected share’s own price and valuation below.</strong> Forward P/E and P/B use dated BOS values where present and may cover fewer names than the ranking.</p>' +
      '<label>Listing <select class="valuation-select">' + valuationRecords.map(r => '<option value="' + esc(r.id) + '"' +
        (r.id === best ? ' selected' : '') + '>' + esc(r.bbTicker + ' · ' + r.name) + '</option>').join('') +
      '</select></label><div class="valuation-charts"></div></details>' : '<p class="gap">No dated P/E or P/B observations in Shares Historical for this window.</p>';
    return '<section class="panel equity"><h3>SPX and watchlist performance <small>base 100</small></h3><p class="caption">' +
      (spx ? 'Base 100 on ' + day(spx.date) + '. ' : '') + 'Ranked share paths use a single source. SPX shows the saved index through its latest available session.</p>' +
      figure(card, lines, 'index', 'SPX and ranked shares', {reference:[100]}) + ranked + valuation + '</section>';
  }

  function fillValuation(detail, card, source) {
    const id = detail.querySelector('select').value;
    const record = source.records.find(r => r.id === id);
    const inWindow = rows => calc(rows,card);
    const price = inWindow(source.weeklyById.get(id));
    const bos = inWindow(source.bosById.get(id));
    const pe = inWindow(source.valuations.pe.get(id)), pb = inWindow(source.valuations.pb.get(id));
    detail.querySelector('.valuation-charts').innerHTML =
      panel(card, ticker(record) + ' share price', 'USD', [
        chartLine('Weekly provider close',price,colors[0],10),
        chartLine('BOS source price',bos,colors[1],45,'4 4')
      ], 'Provider closes and BOS reference prices are shown separately.') +
      panel(card, ticker(record) + ' valuation', '×', [
        chartLine('Forward P/E',pe,colors[2],45), chartLine('P/B',pb,colors[3],45,'4 4')
      ], 'Dated BOS observations. Forecast horizon and P/B availability vary by listing.');
  }

  function eventNotes(card, sources) {
    if (card.current) return latestYield(card,sources);
    return card.events.map((e,i) => {
      const n = notes[e.id];
      return '<section class="event-note" id="marker-' + esc(e.id) + '"><h3><span class="marker-number">' + (i+1) +
        '</span> ' + esc(e.label) + ' <small>' + day(e.date) + '</small></h3><p><strong>' + esc(n?.lead || e.context) +
        '</strong> ' + esc(n?.detail || e.rationale) + ' ' + link(e.url,'Original announcement') + '</p>' +
        yieldTable(e,sources) + '</section>';
    }).join('');
  }

  function plotMacro(card, sources) {
    const {macro} = sources;
    const F = (id,i,gap,dash) => chartLine(macro[id].label,macro[id].points,colors[i],gap,dash);
    const anomalies = M.anomalySeries(Object.values(macro).filter(s => s.scan),card);
    const notable = anomalies.filter(s => Math.abs(s.peak.value) >= 2);
    const signal = notable.length ? '<strong>' + notable.map(s => esc(s.label) + ' reached ' + signed(s.peak.value) + 'σ on ' +
      day(s.peak.date) + ' (' + num(s.peak.raw,2) + ' ' + esc(s.unit) + ')').join(' · ') + '.</strong>' :
      '<strong>' + (anomalies.length ? 'No screened series reached ±2σ in the review period.' : 'Too little baseline history to calculate a comparable deviation.') + '</strong>';
    const stats = anomalies.map(s => esc(s.label) + ' baseline ' + day(s.first) + '–' + day(s.last) + ' · n=' + s.n).join(' / ');
    const extra = macro[notes[card.events[0]?.id]?.extra || 'USD/SGD'];
    return [
      panel(card,'US employment','%',[F('UNRATE',0,33),F('PAYEMS',1,33,'4 4')],
        'Unemployment rate and payroll growth from the same month a year earlier.', {subject:'jobs'}),
      panel(card,'US inflation','% YoY',[F('CPIAUCSL',0,33),F('PCEPI',1,33,'4 4', {subject:'inflation'}),F('PCEPILFE',2,33,'2 4')],
        'Headline CPI, headline PCE and core PCE.'),
      panel(card,'US credit stress','%',[F('DRCRELEXFACBS',0,96),F('BAMLH0A0HYM2',4,7,'4 4')],
        'Quarterly bank CRE delinquency and daily high-yield spreads. These measure different kinds of stress.', {subject:'credit'}),
      panel(card,'What’s out of the norm?','σ',anomalies.map((s,i) => ({
        ...chartLine(s.label,s.points,colors[i],s.grain === 'quarterly' ? 96 : 33,i ? '4 4' : ''),peak:s.peak
      })), signal + ' ' + stats, {reference:[-2,0,2],subject:'signal'}),
      panel(card,extra.label,extra.unit,[chartLine(extra.label,extra.points,colors[2],extra.grain === 'weekly' ? 9 : 7)],
        extra.caption + ' ' + link(extra.source,'Source'))
    ].join('');
  }

  function renderCard(card,sources,next) {
    const title = card.current ? 'Current market' : notes[card.events[0].id]?.title || card.events[0].label;
    const markers = card.current ? '<span class="tag">Today · Singapore</span>' : card.events.map((e,i) =>
      '<a class="tag" href="#marker-' + esc(e.id) + '"><b>' + (i+1) + '</b> ' + day(e.date) + ' · ' + esc(e.label) + '</a>').join('');
    return '<article class="episode" id="' + esc(card.id) + '"><header class="episode-head"><div class="eyebrow">' +
      day(card.start) + ' – ' + day(card.end) + (card.events.length > 1 ? ' · ' + card.events.length + ' events' : '') +
      '</div><h2>' + esc(title) + '</h2><div class="markers">' + markers + '</div>' +
      (card.current ? '<p class="caption"><strong>Compare the latest saved observations with the prior twelve months.</strong> Each source retains its observation date so the daily quotes and lagged economic releases are easy to distinguish.</p>' : '') + '</header>' +
      '<div class="core"><section class="panel"><div class="panel-heading"><h3>UST and SGS bond yields <small>% p.a.</small></h3>' +
      '<label>Tenor <select class="tenor"><option>2Y</option><option>5Y</option><option selected>10Y</option></select></label></div>' +
      '<p class="caption">Matched maturities. ' +
      (sources.weeklyTreasuries.size ? 'UST uses weekly FRED observations. SGS uses month-end yields.' : 'Solid lines show month-end yields.') +
      (card.current ? ' Dashed lines show recent daily closes.' : '') +
      '</p><div class="yield-plot">' + figure(card,yieldLines(card,'10Y',sources),'% p.a.','UST and SGS 10Y yields') + '</div>' +
      (card.current ? eventNotes(card,sources) : '') + '</section>' + equitySection(card,sources) + '</div>' +
      (card.current ? '' : '<div class="event-notes">' + eventNotes(card,sources) + '</div>') +
      '<div class="macro">' + plotMacro(card,sources) + '</div><nav class="episode-turn" aria-label="Episode navigation">' +
      link('#episode-index','Episode list') + (next ? link('#'+next.id,'Next episode · '+next.events[0].date.slice(0,4)) : link('#sgs-report','SGS research report')) + '</nav></article>';
  }

  function assemble(events, fed, sgs, mas, spx, monitor, history, today, weekly) {
    const month = M.monthlyYields(fed,sgs);
    const daily = Object.fromEntries(M.tenors.map(tenor => [tenor,{
      us:D.points(fed.series.find(s => s.id === 'UST ' + tenor)?.points,'daily'),
      sg:D.points(mas.observations.map(o => [o.date,o.values[mas.tenors.findIndex(t => t.label === tenor)]]),'daily')
    }]));
    const config = {
      UNRATE:['Unemployment rate','%',true], PAYEMS:['Payroll growth','% YoY',true,'yoy'],
      CPIAUCSL:['Headline CPI','% YoY',true,'yoy'], PCEPI:['Headline PCE','% YoY',true,'yoy'],
      PCEPILFE:['Core PCE','% YoY',true,'yoy'], DRCRELEXFACBS:['Bank CRE delinquency','%',true],
      BAMLH0A0HYM2:['US high-yield OAS','%',true], NFCI:['Chicago Fed financial conditions','index',true],
      STLFSI4:['St Louis Fed financial stress','index',true], VIXCLS:['VIX','index',true],
      WALCL:['Federal Reserve assets','USD tn',false,'trillions','Weekly Fed balance sheet total. Purchases, redemptions and liquidity facilities can all change the size.']
    };
    const macro = Object.fromEntries(Object.entries(config).map(([id,[label,unit,scan,transform,caption]]) => {
      const s = monitor.series[id];
      const grain = D.grain(s?.frequency), raw = D.points(s?.points,grain).filter(p => p.date <= today);
      const points = transform === 'yoy' ? M.yoy(raw) : transform === 'trillions' ? raw.map(p => ({...p,value:p.value/1e6})) : raw;
      return [id,{label,unit,scan,points,grain,caption,source:'https://fred.stlouisfed.org/series/'+id}];
    }));
    for (const id of ['USD/SGD','CHF/SGD']) {
      const sourced = weekly[1].find(s => s.id === id);
      if (sourced) {
        macro[id] = {label:id,unit:sourced.unit,grain:'weekly',points:D.points(sourced.points,'weekly'),
          caption:sourced.formula ? 'Weekly cross from ' + sourced.formula + ' on the same source date.'
            : 'Last available H.10 observation each Friday-ending week.',
          source:sourced.source_url || sourced.source_urls[0]};
        continue;
      }
      const quote = fed.series.find(s => s.id === id.replace('CHF/SGD','USD/CHF'));
      const usd = fed.series.find(s => s.id === 'USD/SGD');
      const points = id === 'USD/SGD' ? D.points(usd?.points,'daily') : M.matched(D.points(usd?.points,'daily'),D.points(quote?.points,'daily'))
        .filter(p => p.sg > 0).map(p => ({date:p.date,value:p.us/p.sg}));
      macro[id] = {label:id,unit:'SGD per '+id.slice(0,3),grain:'daily',points,caption:id === 'USD/SGD' ? 'Daily Fed H.10 exchange rate.' :
        'Derived cross from the same-date USD/SGD and USD/CHF Fed H.10 observations.',source:quote?.source_url || 'https://www.federalreserve.gov/releases/h10/'};
    }
    const weeklyTreasuries = new Map(weekly[0].map(s => [s.id, D.points(s.points, 'weekly')]));
    return {events,month,daily,macro,weeklyTreasuries,spx:D.points(spx.points,'daily'),...history};
  }

  async function shareData() {
    const S = window.ShareLabData;
    const [loaded, coverage] = await Promise.all([
      S.load(), json('data/stocks-beta2-monthly-history.json?v=20261121').catch(() => null)
    ]);
    const watchlist = coverage?.version === 1 && Array.isArray(coverage.securities) ? coverage.securities.slice(0, 110) : [];
    const records = M.stockUniverse(S.records(), watchlist);
    const [global,bos,pe,pb] = await Promise.all(['globalPrice','sourcePrice','pe','pb'].map(k => S.metricFor(k)));
    const make = (map, grain, prefix) => new Map(records.flatMap(r => {
      const points = M.uniquePoints((map.get(r.id) || []).filter(p =>
        p.grain === grain && p.sourceId.startsWith(prefix) && p.currency === r.currency && p.value > 0 && !p.dateBasis));
      return points.length ? [[r.id,points]] : [];
    }));
    const weeklyById = make(global,'weekly','global-top100-close-'), bosById = make(bos,'month','bos:');
    const entries = map => records.flatMap(record => map.has(record.id) ? [{record,points:map.get(record.id)}] : []);
    return {loaded,watchlistSize:watchlist.length,records,weeklyById,bosById,weekly:entries(weeklyById),bos:entries(bosById),
      valuations:{pe:make(pe,'month','bos:'),pb:make(pb,'month','bos:')}};
  }

  function report(sources,cards) {
    const events = sources.events.filter(e => e.date <= cards[0].end);
    const rows = events.map(e => ({e,r:M.eventYieldRows(e,sources.month).find(r => r.tenor === '10Y')})).filter(x => x.r.from);
    const same = rows.filter(x => Math.sign(x.r.us) === Math.sign(x.r.sg)).length;
    const top = [...rows].sort((a,b) => Math.abs(b.r.spread)-Math.abs(a.r.spread))[0];
    if (!top) return '<p><strong>Matched yield comparisons are unavailable.</strong> Review the source coverage before drawing conclusions.</p>';
    const example = x => '<span class="us">' + signed(x.r.us,0) + ' bp UST</span> and <span class="sg">' + signed(x.r.sg,0) +
      ' bp SGS</span> from ' + day(x.r.from.date) + ' to ' + day(x.r.to.date);
    const evidence = '<p><strong>The two 10-year yields moved in the same direction around ' + same + ' of ' + rows.length +
      ' covered events.</strong> This compares the last matched month-end before each event with the last matched month-end at or before +12 months. Some windows overlap and describe the same cycle.</p>' +
      '<p><strong>The largest 10-year spread change was ' + signed(top.r.spread,0) + ' bp around the ' + day(top.e.date) +
      ' event.</strong> The comparison was ' + example(top) + '. For an investor comparing SGD and USD duration, the difference in direction matters as much as the change in the spread. ' +
      link('#marker-'+top.e.id,'Open event context') + '</p>';
    const examples = [
      ['event-2008-11-25', 'In the global financial crisis, both ten-year yields fell.', 'The fall was larger in Treasuries. Watch how the result changes at the December marker as the starting month shifts.'],
      ['event-2022-03-16', 'Both ten-year yields rose after the start of the 2022 hiking cycle.', 'The US repricing was larger. Compare the 2Y and 10Y rows to see how much more the US front end moved.']
    ].map(([id,lead,detail]) => {
      const row = rows.find(x => x.e.id === id);
      return row ? '<p><strong>' + lead + '</strong> The change was ' + example(row) + '. ' + detail +
        ' ' + link('#marker-'+id,'Open event context') + '</p>' : '';
    }).join('');
    return evidence + examples;
  }

  async function start() {
    const paths = ['historical-fred-events.json','fred-daily.json','cross-market-sgs-month-end.json','sgs-daily-snapshot.json',
      'spx/history.json','fred/catalog.json'];
    const weekly = Promise.all(['yields','fx'].map(family => FredWeekly.load(family).then(r => r.series).catch(() => [])));
    const parts = await Promise.all([...paths.map(path => json('data/'+path)),shareData(),weekly]);
    const [eventData,fed,sgs,mas,spx,catalog,history,weeklyParts] = parts;
    const monitor = await json('data/fred/'+catalog.monitor_url);
    const today = singaporeToday();
    const sources = assemble(eventData.events,fed,sgs,mas,spx,monitor,history,today,weeklyParts);
    for (const [provider, map, basis] of [
      ['cross-weekly', sources.weeklyById, 'Saved weekly provider closes in the listing currency.'],
      ['cross-bos', sources.bosById, 'BOS monthly reference prices in the listing currency.']
    ]) {
      window.ReturnSparks?.register(provider, ({ symbol, currency }) => {
        const record = sources.records.find(r => r.id === symbol);
        if (!record || record.currency !== currency) return null;
        const series = map.get(symbol) || [];
        return { points: series.map(p => [p.date,p.value]), name: ticker(record), unit: currency,
          basis: basis + ' Price paths exclude dividends.', source: series.at(-1)?.sourceUrl, label: 'price history' };
      });
    }
    const cards = M.groupEvents(sources.events,today);
    const container = document.querySelector('#market-episodes');
    container.innerHTML = cards.map((c,i) => renderCard(c,sources,cards[i+1])).join('');
    document.querySelector('#episode-index').innerHTML = cards.map(c =>
      link('#'+c.id,c.current ? 'Current market' : c.events[0].date.slice(0,4)+' · '+(notes[c.events[0].id]?.title || c.events[0].label))).join('');
    document.querySelector('#report-evidence').innerHTML = report(sources,cards);
    status.innerHTML = '<strong>' + (cards.length-1) + ' historical episodes · ' + cards.reduce((n,c) => n+c.events.length,0) +
      ' event markers.</strong> Latest saved SGS ' + day(tail(sources.daily['10Y'].sg)) + ' · UST ' +
      day(tail(sources.daily['10Y'].us)) + ' · SPX ' + day(tail(sources.spx)) + '.' +
      (history.loaded ? '' : ' Shares Historical could not load.');
    cards.forEach(card => {
      const el = document.getElementById(card.id);
      el.querySelector('.tenor').addEventListener('change', e => {
        const tenor = e.target.value;
        el.querySelector('.yield-plot').innerHTML = figure(card,yieldLines(card,tenor,sources),'% p.a.','UST and SGS '+tenor+' yields');
      });
      const detail = el.querySelector('.valuation');
      if (!detail) return;
      detail.addEventListener('toggle', () => {
        if (detail.open && !detail.querySelector('.valuation-charts').children.length) fillValuation(detail,card,sources);
      });
      detail.querySelector('select').addEventListener('change', () => fillValuation(detail,card,sources));
    });
    if (location.hash.length > 1) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }

  start().catch(error => {
    status.textContent = 'The cross-market view could not load its sources. Reload or open the original Historical workspaces above.';
    status.classList.add('gap');
    console.error(error);
  });
})();
