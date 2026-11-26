(() => {
  'use strict';
  const accounts = document.getElementById('nv-accounts');
  const template = document.getElementById('nvda-beta-analysis-template');
  if (!accounts || !template) return;
  accounts.before(template.content.cloneNode(true));
  const byId = id => document.getElementById(id);
  const stock = window.StocksBeta2Charts;
  const market = window.AccumulatorMarket;
  const ticker = 'NVDA US';
  const peColour = '#326d9f', pbColour = '#8554a1';
  const ratings = {Buy: '#2766bf', Hold: '#987600', Sell: '#b65464'};
  const date = new Intl.DateTimeFormat('en-GB', {day:'numeric', month:'short', year:'numeric', timeZone:'UTC'});
  const month = new Intl.DateTimeFormat('en-GB', {month:'short', year:'numeric', timeZone:'UTC'});
  const dollars = new Intl.NumberFormat('en-US', {style:'currency', currency:'USD'});
  const ratio = new Intl.NumberFormat('en-GB', {minimumFractionDigits:1, maximumFractionDigits:1});
  const price = value => Number.isFinite(value) ? dollars.format(value) : '—';
  const multiple = value => Number.isFinite(value) ? ratio.format(value) + '×' : '—';
  const asDate = value => new Date(value + 'T00:00:00Z');
  const dateLabel = value => date.format(asDate(value));
  const positive = value => Number.isFinite(value) && value > 0;
  const priceChart = byId('nvda-bos-price');
  const multipleChart = byId('nvda-bos-multiples');
  const slider = byId('nvda-bos-month');
  const stressPrice = byId('nv-stress-price');
  let history, cursor, pricePosition, multiplePosition;
  let previousStress, previousTest;

  const tableRow = (label, values) => {
    const row = document.createElement('tr');
    const head = document.createElement('th');
    head.scope = 'row';
    head.textContent = label;
    row.append(head);
    for (const value of values) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    return row;
  };

  window.StocksBeta2PublicPeers.mount(byId('nvda-analysis-peers'), ticker);

  async function read(path) {
    const response = await fetch('../data/' + path, {signal:AbortSignal.timeout(12000)});
    if (!response.ok) throw Error('NVDA history is unavailable');
    return response.json();
  }

  function displayArchive() {
    const {dates, prices, pe, pb, anchor, basis} = history;
    const first = month.format(asDate(dates[prices[0].index][1]));
    const last = month.format(asDate(dates[anchor.index][1]));
    byId('nvda-bos-dates').textContent = first + ' to ' + last + ' BOS editions · ' + prices.length +
      ' monthly observations · Split-adjusted closes in USD';
    const summary = byId('nvda-chart-valuation');
    if (basis) {
      const edition = dateLabel(dates[basis.index][1]);
      summary.innerHTML = '<div class="nvda-valuation-summary"><strong>NVDA valuation</strong>' +
        '<span>Forward P/E <b>' + multiple(basis.pe) + '</b></span><span>Forward P/B <b>' + multiple(basis.pb) +
        '</b></span><span class="nvda-valuation-date">BOS edition · ' + edition + '</span></div>';
      byId('nvda-multiple-assumptions').textContent =
        'The dashed lines divide each simulated share price by fixed denominators implied by the ' + edition +
        ' BOS edition: ' + price(basis.earnings) + ' forward earnings per share and ' + price(basis.book) +
        ' forward book value per share, based on the ' + dateLabel(basis.quote) + ' close of ' + price(basis.price) +
        '. A custom maturity price keeps the same starting price and scales the preset’s move at each month to reach your test price. Earnings and book value can change in a real decline.';
    } else summary.textContent = 'No BOS edition has a matching price, forward P/E and forward P/B for the simulation.';
    const table = byId('nvda-bos-data');
    table.querySelector('tbody').replaceChildren(...prices.slice().reverse().map(point =>
      tableRow(dateLabel(point.quote), [dateLabel(dates[point.index][1]), price(point.value),
        multiple(pe.get(point.index)), multiple(pb.get(point.index))])));
    table.hidden = false;
    priceChart.hidden = false;
    byId('nvda-bos-inspect').hidden = false;
    multipleChart.hidden = !(pe.size || pb.size);
    byId('nvda-multiple-legend').hidden = multipleChart.hidden;
    slider.min = prices[0].index;
    slider.max = anchor.index;
    cursor = anchor.index;
    if (history.target) {
      const target = history.target;
      const note = byId('nvda-bos-target');
      note.textContent = 'Research target ' + price(target.value) + ' · ' + target.provider + ' · ';
      const link = document.createElement('a');
      link.href = target.source;
      link.textContent = dateLabel(target.date);
      note.append(link);
    }
    repaint();
  }

  function scenario() {
    const context = market.getStressContext();
    const basis = history.basis;
    if (!basis || !context?.downsidePath?.length) return null;
    const value = stressPrice.valueAsNumber;
    if (!stressPrice.checkValidity() || !Number.isSafeInteger(Math.round(value * 100)) || value < 0 ||
        (!context.knockOutDay && value >= context.knockOutPrice)) return null;
    const custom = !context.knockOutDay && Math.abs(value - context.exitPrice) >= .005;
    const originalMove = context.exitPrice - context.spot;
    const path = context.downsidePath.map(({month, price: presetPrice}) => {
      let simulated = presetPrice;
      if (custom) {
        const fraction = originalMove ? (presetPrice - context.spot) / originalMove : month / context.tenor;
        simulated = month === context.tenor ? value :
          Math.round((context.spot + (value - context.spot) * fraction) * 100) / 100;
      }
      return {month, price:simulated, pe:simulated / basis.earnings, pb:simulated / basis.book};
    });
    return {context, path, test:value, custom, months:context.tenor, lines:[
      {color:peColour, points:path.map(point=>({month:point.month, value:point.pe}))},
      {color:pbColour, points:path.map(point=>({month:point.month, value:point.pb}))}
    ]};
  }

  function displayScenario(model) {
    const context = model?.context;
    const test = model?.test;
    if (context === previousStress && test === previousTest) return;
    previousStress = context;
    previousTest = test;
    const summary = byId('nvda-multiple-scenario');
    const details = byId('nvda-model-data');
    const legend = document.querySelector('.nvda-legend-model');
    legend.hidden = !model;
    summary.hidden = details.hidden = !model;
    if (!model) {
      summary.textContent = '';
      return;
    }
    const {path, custom} = model;
    const exit = path.at(-1);
    const exitLabel = context.knockOutDay ? 'Knock-out on trading day ' + context.knockOutDay : 'Month ' + context.tenor + ' maturity';
    const values = point => [price(point.price), multiple(point.pe), multiple(point.pb)];
    const pathName = custom ? 'Maturity test path' : 'Sustained decline';
    legend.textContent = pathName;
    summary.textContent = pathName + ' · ' + exitLabel + ' · ' + price(exit.price) +
      ' · Forward P/E ' + multiple(exit.pe) + ' · Forward P/B ' + multiple(exit.pb);
    const rows = path.map((point,i) => {
      const label = i === 0 ? 'Trade start' : i === path.length - 1 ? exitLabel : 'Month ' + point.month;
      return tableRow(label, values(point));
    });
    details.querySelector('tbody').replaceChildren(...rows);
  }

  function repaint() {
    if (!history) return;
    const {dates, prices, fairValues, byIndex, calls, pe, pb, pePoints, pbPoints, anchor, cone, target} = history;
    const state = {from:prices[0].index, to:anchor.index, cursor, axis:'year'};
    const model = scenario();
    const series = [{color:'#126c66', points:prices}, ...Object.entries(ratings).map(([rating,color]) =>
      ({color, points:fairValues.filter(point => point.rating === rating)}))];
    pricePosition = stock.drawPlot(priceChart, series, dates, state, {cone, bands:[1,2], researchTarget:target, isPrice:true});
    if (!multipleChart.hidden) {
      multiplePosition = stock.drawPlot(multipleChart, [
        {color:peColour,points:pePoints}, {color:pbColour,points:pbPoints}
      ], dates, state, {scenario:model});
    }
    slider.value = cursor;
    const [,,day] = dates[cursor];
    slider.setAttribute('aria-valuetext', dateLabel(day));
    const quote = byIndex.get(cursor);
    const rating = calls.get(cursor);
    byId('nvda-bos-selected').textContent = dateLabel(day) + ' · Close ' + price(quote) +
      (rating ? ' · ' + rating.rating + ' · Fair value ' + price(rating.value) : '');
    byId('nvda-multiple-selected').textContent =
      dateLabel(day) + ' · Historical P/E ' + multiple(pe.get(cursor)) + ' · P/B ' + multiple(pb.get(cursor));
    displayScenario(model);
  }

  function inspect(index) {
    const next = Math.max(Number(slider.min), Math.min(Number(slider.max), index));
    if (cursor === next) return;
    cursor = next;
    repaint();
  }
  slider.addEventListener('input', () => inspect(slider.valueAsNumber));
  for (const canvas of [priceChart, multipleChart]) {
    const point = event => {
      const position = canvas === priceChart ? pricePosition : multiplePosition;
      if (!position || !history) return;
      const x = event.clientX - canvas.getBoundingClientRect().left;
      if (x > position.coneStart) return;
      const nearest = history.prices.reduce((best,item) =>
        Math.abs(position.forIndex(item.index) - x) < Math.abs(position.forIndex(best.index) - x) ? item : best);
      inspect(nearest.index);
    };
    canvas.addEventListener('pointermove', event => {if (event.pointerType !== 'touch') point(event);});
    canvas.addEventListener('click', point);
    canvas.addEventListener('keydown', event => {
      const choices = {ArrowLeft:cursor-1, ArrowRight:cursor+1, Home:Number(slider.min), End:Number(slider.max)};
      if (!Object.hasOwn(choices,event.key) || !history) return;
      event.preventDefault();
      inspect(choices[event.key]);
    });
  }
  stressPrice.addEventListener('input', repaint);
  for (const id of ['nv-use-69','nv-use-path']) byId(id).addEventListener('click', repaint);
  document.addEventListener('accumulator:stress-context', repaint);
  const resize = new ResizeObserver(repaint);
  resize.observe(priceChart);
  resize.observe(multipleChart);

  Promise.all([
    market.getBosArchive(),
    read('stocks-beta2-history-adjustments.json'),
    read('stocks-beta2-morningstar.json?v=20261121.2').catch(() => null),
    read('stocks-beta2-research-briefs.json?v=20261121.full1').catch(() => null)
  ]).then(([archive, adjustments, notes, briefs]) => {
    if (!archive) throw Error('NVDA archive unavailable');
    const {data, company, fairValues} = stock.chartHistory(archive.data, archive.listing, adjustments);
    const points = key => stock.historyPoints(data, company, key, 0, data.months.length-1).filter(p=>positive(p.value));
    const prices = points('price'), pePoints = points('forward_pe'), pbPoints = points('forward_pb');
    const pe = new Map(pePoints.map(p=>[p.index,p.value])), pb = new Map(pbPoints.map(p=>[p.index,p.value]));
    const anchor = prices.at(-1);
    if (!anchor) throw Error('NVDA price history unavailable');
    const paired = prices.findLast(p=>positive(pe.get(p.index)) && positive(pb.get(p.index)));
    const basis = paired && {
      index:paired.index, quote:paired.quote, price:paired.value, pe:pe.get(paired.index), pb:pb.get(paired.index),
      earnings:paired.value / pe.get(paired.index), book:paired.value / pb.get(paired.index)
    };
    const calls = fairValues(notes?.[ticker]) || [];
    const cone = stock.probabilityCone(data, company, anchor);
    const target = stock.researchConeTarget(briefs?.briefs?.[ticker], 'USD');
    history = {dates:data.months, prices, pe, pb, pePoints, pbPoints, basis, anchor, cone:cone.points ? cone : null,
      target:target && Number.isFinite(Date.parse(target.date)) ? target : null,
      fairValues:calls, calls:new Map(calls.map(p=>[p.index,p])), byIndex:new Map(prices.map(p=>[p.index,p.value]))};
    displayArchive();
  }).catch(() => {
    byId('nvda-bos-dates').textContent = 'BOS monthly chart unavailable.';
    byId('nvda-chart-valuation').textContent = 'The BOS valuation archive could not load. Reload to retry.';
  });

  const filings = byId('nvda-analysis-filings');
  const quarterlyStatus = byId('nvda-quarterly-status');
  let quarterlyRequested = false;
  filings.addEventListener('toggle', async () => {
    if (!filings.open || quarterlyRequested) return;
    quarterlyRequested = true;
    quarterlyStatus.textContent = 'Loading quarterly filings…';
    try {
      const core = window.SharesQuarterlyCore;
      const bundle = await core.load();
      const companies = [['NVDA','NVIDIA'],['AMD','AMD'],['AVGO','Broadcom'],['INTC','Intel']].flatMap(([id,name])=>{
        const listing = id + ' US';
        const record = core.listing(bundle, listing);
        const latest = core.view(record);
        if (!latest) return [];
        return [{id,name,ticker:listing,currency:record.currency,periodLabel:latest.period + ' · ' + dateLabel(latest.ended),
          basisLabel:latest.kind,values:latest.values,history:record.observations.slice(-8).flatMap(observation=>{
            const view = core.view(record, {observation});
            return view ? [{label:view.period, end:view.ended, values:view.values}] : [];
          })}];
      });
      if (!companies.some(company=>company.id==='NVDA')) throw Error('NVIDIA quarterly filings unavailable');
      window.SharesQuarterlyCharts.render(byId('nvda-quarterly-charts'), {companies,focus:'NVDA',period:'quarterly',
        periodLabel:'Latest reported quarters · Stocks BETA 3 filings'});
      quarterlyStatus.textContent = '';
    } catch {
      quarterlyRequested = false;
      quarterlyStatus.textContent = 'Quarterly charts could not load. Reopen this section to retry.';
    }
  });
})();
