(() => {
  'use strict';
  const fmt = window.AccumulatorFormat;
  const reportUrl = 'https://notwins.github.io/market-intelligence-hub/tools/accumulator-beta';
  const read = selector => document.querySelector(selector)?.textContent.replace(/\s+/g, ' ').trim() || '';
  const date = value => value ? new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
  }).format(new Date(value + 'T00:00:00Z')) : '';
  const risk = 'The commitment to buy at strike can produce losses if NVIDIA falls. Issuer default can cause a total loss.';
  const timing = sim => sim.koDay ? 'Knock-out on day ' + sim.koDay : 'Maturity in month ' + sim.exit.month;

  function capture(sections) {
    const selected = new Set(sections.map(section => section.key));
    const has = (...keys) => keys.some(key => selected.has(key));
    const live = window.AccumulatorMarket.getClientSelection();
    const view = {
      deal: has('setup', 'client-sheet'),
      chart: has('overview', 'chartTitle'),
      capital: has('overview', 'ledger'),
      delivery: has('overview'),
      scenario: has('scenario-returns'),
      compare: has('compare'),
      library: has('library'),
      stress: has('nvda-stress-context'),
      guide: has('accumulator-guide'),
      archive: has('pricing-archive'),
      after: has('after'),
      notes: has('notes-and-terms'),
      live
    };
    if (view.deal) view.setupError = read('#setupError');
    if (view.library || view.compare) view.comparison = window.AccumulatorComparison?.getSnapshot();
    if (view.delivery) {
      view.deliverySummary = read('#delivery-sales-status');
      view.deliveryIssue = !document.getElementById('beta-sale-sensitivity').hidden ? '' : 'Check the selected delivery sale prices.';
    }
    if (view.stress) {
      view.stressResult = read('#nv-stress-result strong');
      view.stressBasis = read('#nv-history-frequency > p').split(' The note uses')[0];
      view.stressFrequency = Array.from(document.querySelectorAll('.nv-frequency-pair > div'), node => ({
        value: node.querySelector('strong').textContent.trim(),
        label: node.querySelector('span').textContent.trim()
      }));
      view.valuation = Array.from(document.querySelectorAll('.nvda-valuation-summary > *'), node => node.textContent.trim()).join('  /  ');
    }
    if (view.archive) view.archiveDate = read('#pricing-archive summary');
    return view;
  }

  function render({doc, colour, view, style, stamp, logo, printText}) {
    const w = doc.internal.pageSize.getWidth();
    const margin = 15;
    const width = w - 2 * margin;
    const bottom = doc.internal.pageSize.getHeight() - 18;
    const {live} = view;
    const sim = live?.simulation;
    let y = 0;
    let first = true;

    function font(size, tone = 'ink', weight = 'normal', family = 'helvetica') {
      doc.setFont(family, weight);
      doc.setFontSize(size);
      doc.setTextColor(colour[tone]);
    }
    function fill(tone, x, top, span, height, radius = 0) {
      doc.setFillColor(colour[tone]);
      if (radius) doc.roundedRect(x, top, span, height, radius, radius, 'F');
      else doc.rect(x, top, span, height, 'F');
    }
    function rule(tone, x, top, end, yEnd = top, stroke = .25) {
      doc.setDrawColor(colour[tone]);
      doc.setLineWidth(stroke);
      doc.line(x, top, end, yEnd);
    }
    function text(value, x, baseline, size, tone, options = {}) {
      const {align = 'left', weight = 'normal', family = 'helvetica'} = options;
      font(size, tone, weight, family);
      doc.text(printText(String(value)), x, baseline, {align});
    }
    function fitted(value, x, baseline, span, size, tone = 'ink', family = 'helvetica') {
      font(size, tone, 'bold', family);
      const label = printText(String(value));
      const adjusted = Math.min(size, size * span / Math.max(span, doc.getTextWidth(label)));
      doc.setFontSize(adjusted);
      doc.text(label, x, baseline);
    }
    function wrap(value, x, top, span, size = 10.5, tone = 'ink', weight = 'normal') {
      if (!value) return top;
      font(size, tone, weight);
      const lines = doc.splitTextToSize(printText(value), span);
      doc.text(lines, x, top + size * .31, {lineHeightFactor: 1.24});
      return top + lines.length * size * .44;
    }
    function page(title, subtitle) {
      if (!first) doc.addPage();
      fill('accent', 0, 0, w * .5, 2.2);
      fill('secondary', w * .5, 0, w * .28, 2.2);
      fill('tertiary', w * .78, 0, w * .22, 2.2);
      const panelHeight = first ? 42 : 31;
      fill('hero', 0, 2.2, w, panelHeight);
      fill('secondaryLight', w - 50, 2.2, 50, panelHeight);
      logo('NVDA', w - 43, first ? 5.5 : 4, first ? 30 : 24);
      if (first) {
        text('NVDA ACCUMULATOR  /  BETA 2', margin, 11.5, 8, 'accent', {weight:'bold'});
        fitted(title, margin, 26.5, width - 39, 28, 'ink', 'times');
        wrap(subtitle || (style + ' colour style  /  ' + stamp), margin, 32, width - 40, 9, 'muted');
      } else fitted(title, margin, 21, width - 39, 27, 'ink', 'times');
      y = first ? 53 : 43;
      first = false;
    }
    function space(height, continuation) {
      if (y + height > bottom) page(continuation);
    }
    function heading(title, description, height = 24) {
      space(height, title);
      text(title, margin, y + 5.5, 19, 'ink', {weight:'bold', family:'times'});
      y += 9;
      y = wrap(description, margin, y, width, 10, 'muted') + 4;
    }
    function cards(items) {
      const gap = 3;
      const span = (width - gap * (items.length - 1)) / items.length;
      const fills = ['soft', 'secondaryLight', 'tertiaryLight'];
      const accents = ['accent', 'secondary', 'tertiary'];
      items.forEach(([label, value, tone], index) => {
        const x = margin + index * (span + gap);
        fill(fills[index], x, y, span, 24, 2);
        fitted(label, x + 4, y + 6, span - 8, 9, 'muted');
        fitted(value, x + 4, y + 17.5, span - 8, 19, tone || accents[index], 'times');
      });
      y += 29;
    }
    function callout(label, body, tone = 'tertiary') {
      space(24, label);
      const height = 20;
      fill(tone + 'Light', margin, y, width, height, 2);
      fill(tone, margin, y, 1.1, height);
      fitted(label, margin + 5, y + 6.2, width - 10, 10, tone);
      wrap(body, margin + 5, y + 8.3, width - 10, 9, 'ink');
      y += height + 5;
    }

    function pricePath(showPathName) {
      heading(showPathName ? 'The price path' : 'Daily closes and deal levels', showPathName ? live.path : '', 89);
      const plotTop = y + 5;
      const plotHeight = 55;
      const plotLeft = margin + 20;
      const plotRight = w - margin - 5;
      const closes = [live.spot, ...sim.daily];
      const levels = [...closes, sim.strike, sim.ko];
      const low = Math.min(...levels);
      const high = Math.max(...levels);
      const padding = Math.max(.01, (high - low) * .11);
      const floor = Math.max(0, low - padding);
      const ceiling = high + padding;
      const x = day => plotLeft + (plotRight - plotLeft) * day / sim.days;
      const v = price => plotTop + (ceiling - price) * plotHeight / (ceiling - floor);
      fill('panel', margin, y - 1, width, 69, 2);
      if (sim.koDay && sim.koDay < sim.days) fill('refundLight', x(sim.koDay), plotTop, plotRight - x(sim.koDay), plotHeight);
      for (let tick = 0; tick <= 4; tick++) {
        const value = floor + (ceiling - floor) * tick / 4;
        rule('line', plotLeft, v(value), plotRight);
        text(value < 10 ? fmt.price(value) : fmt.money(value), plotLeft - 3, v(value) + .9, 8, 'muted', {align:'right'});
      }
      doc.setLineDashPattern([1.7, 1.4], 0);
      rule('tertiary', plotLeft, v(sim.strike), plotRight, v(sim.strike), .45);
      rule('ko', plotLeft, v(sim.ko), plotRight, v(sim.ko), .45);
      doc.setLineDashPattern([], 0);
      const end = sim.koDay || sim.days;
      function drawCloseLine(from, to, tone, stroke) {
        const moves = closes.slice(from + 1, to + 1).map((price, index) => {
          const day = from + index;
          return [x(day + 1) - x(day), v(price) - v(closes[day])];
        });
        doc.setDrawColor(colour[tone]);
        doc.setLineWidth(stroke);
        doc.lines(moves, x(from), v(closes[from]), [1, 1], 'S');
      }
      drawCloseLine(0, end, 'accent', .65);
      if (end < sim.days) {
        doc.setLineDashPattern([1.4, 1.2], 0);
        drawCloseLine(end, sim.days, 'refund', .35);
      }
      doc.setLineDashPattern([], 0);
      doc.setFillColor(colour.accent);
      doc.circle(x(end), v(closes[end]), 1.5, 'F');
      const labels = [{day:0, name:'Start'}, ...sim.monthEnds.map((day, index) => ({day, name:'M' + (index + 1)}))];
      labels.filter((_, i) => sim.monthEnds.length <= 6 || i % 2 === 0 || i === labels.length - 1).forEach(({day, name}) =>
        text(name, x(day), plotTop + plotHeight + 5, 8, 'muted', {align:'center'}));
      y += 72;
      const legend = [['accent','Modelled close'], ['tertiary','Strike'], ['ko','Knock-out level']];
      if (sim.koDay) legend.push(['refund','After knock-out']);
      const gap = width / legend.length;
      legend.forEach(([tone, label], index) => {
        const start = margin + index * gap;
        if (index) doc.setLineDashPattern([1.7, 1.4], 0);
        rule(tone, start, y + 1, start + 7, y + 1, .7);
        doc.setLineDashPattern([], 0);
        text(label, start + 9, y + 2.2, 8, 'muted');
      });
      y += 9;
    }

    function capital() {
      const {exit, payment} = sim;
      heading('Where the payment goes', timing(sim), 58);
      const spentWidth = width * Math.min(1, Math.max(0, exit.spent / payment));
      fill('refundLight', margin, y, width, 8, 1.5);
      if (spentWidth) fill('tertiary', margin, y, spentWidth, 8);
      if (spentWidth < width) fill('refund', margin + spentWidth, y, width - spentWidth, 8);
      y += 12;
      text('Spent buying shares', margin, y + 2, 9, 'muted');
      text('Cash refunded', w - margin, y + 2, 9, 'muted', {align:'right'});
      fitted(fmt.price(exit.spent), margin, y + 10, width / 2 - 3, 16, 'tertiary', 'times');
      text(fmt.price(exit.refunded), w - margin, y + 10, 16, 'refund', {align:'right', weight:'bold', family:'times'});
      y += 16;
      cards([
        ['SHARES ACQUIRED', fmt.shares(exit.shares)], ['VALUE AT EXIT', fmt.money(exit.value)],
        ['P&L ON PAYMENT', fmt.returnMoney(exit.profit), exit.profit < 0 ? 'negative' : 'positive']
      ]);
      if (view.delivery && (view.deliverySummary || view.deliveryIssue)) {
        y = wrap(view.deliveryIssue || view.deliverySummary, margin, y, width, 9.5, 'muted') + 5;
      }
    }

    function scenarios() {
      const results = [...live.scenarioResults].sort((a, b) =>
        ['fall', 'recover', 'rally'].indexOf(a.s.id) - ['fall', 'recover', 'rally'].indexOf(b.s.id));
      if (!results.length) return;
      heading('Three outcomes to compare', 'Gross return on payment. Straight NVDA uses the same starting cash and assumed exit price.', 87);
      const maxRate = Math.max(1, ...results.map(({m}) => Math.abs(m.exit.rate)));
      const left = margin + 54;
      const right = w - margin - 46;
      const zero = (left + right) / 2;
      rule('line', zero, y + 1, zero, y + results.length * 19 - 4, .35);
      results.forEach(({s, m, outright}) => {
        const exit = m.exit;
        const tone = exit.rate < 0 ? 'negative' : 'positive';
        const extent = (right - zero) * Math.abs(exit.rate) / maxRate;
        const name = s.id === 'rally' ? 'Rally' : s.name;
        fitted(name, margin, y + 5, 51, 11, 'ink');
        text(fmt.price(exit.price) + ' exit  /  ' + (m.koDay ? 'KO day ' + m.koDay : 'Maturity'), margin, y + 10, 8.3, 'muted');
        if (extent) fill(tone, exit.rate < 0 ? zero - extent : zero, y + 2, extent, 5);
        text(fmt.signedRate(exit.rate) + '   ' + fmt.returnMoney(exit.profit), w - margin, y + 6, 11, tone, {weight:'bold', align:'right'});
        text('Straight NVDA  ' + fmt.returnMoney(outright.pnl), w - margin, y + 11, 8.3, 'muted', {align:'right'});
        y += 19;
      });
      y += 4;
      const rally = results.find(({s}) => s.id === 'rally')?.m;
      if (rally?.koDay) {
        callout('A rally can end the purchases early', fmt.shares(rally.exit.shares) + ' shares acquired and ' +
          fmt.money(rally.exit.refunded) + ' cash returned in this rally. The note stops buying at knock-out.', 'secondary');
      }
    }

    function comparison() {
      const notes = view.comparison?.notes ?? [];
      const active = view.compare ? view.comparison?.rows.find(row => row.id === view.comparison.active) : null;
      const byRate = view.comparison?.metric === 'rate';
      const quoteDate = [...new Set(notes.map(({quote}) => date(quote.asOf)).filter(Boolean))].join(' / ');
      const issuers = [...new Set(notes.map(({quote}) => quote.product))];
      const singleIssuer = issuers.length === 1 ? issuers[0] : '';
      const description = [singleIssuer, active?.name, quoteDate && 'Quotes ' + quoteDate].filter(Boolean).join('  /  ');
      heading('Selected quote structures', description, 20 + 8 * (notes.length + 1));
      if (!notes.length) {
        y = wrap('No quotes are available in the current comparison.', margin, y, width, 10.5, 'muted') + 6;
        return;
      }
      const headers = [...(singleIssuer ? [] : ['Issuer']), 'Tenor', 'Strike', 'KO', 'Guarantee'];
      const step = (active ? 142 : 170) / headers.length;
      const offsets = headers.map((_, i) => 5 + i * step);
      if (active) { headers.push(byRate ? 'Return' : 'P&L'); offsets.push(175); }
      const resultIndex = active ? headers.length - 1 : -1;
      fill('soft', margin, y, width, 8);
      headers.forEach((label, i) => text(label, margin + offsets[i], y + 5, 8.5, 'accent', {weight:'bold', align:i===resultIndex?'right':'left'}));
      y += 8;
      notes.forEach(({quote}, i) => {
        const val = active?.values[i];
        if (i % 2 === 0 || quote.id === live?.quote.id) fill(quote.id === live?.quote.id ? 'secondaryLight' : 'panel', margin, y, width, 8);
        const row = [...(singleIssuer ? [] : [quote.product]), quote.months + 'M', fmt.quote(quote.strike), fmt.quote(quote.ko), quote.minimum + 'M'];
        if (active) row.push(val ? (byRate ? fmt.signedRate(val.rate) : fmt.returnMoney(val.pnl)) : '-');
        row.forEach((label, col) => text(label, margin + offsets[col], y + 4.9, 9,
          col === resultIndex && val ? (val.pnl < 0 ? 'negative' : 'positive') : 'ink', {align:col===resultIndex?'right':'left',weight:col===0?'bold':'normal'}));
        y += 8;
      });
      y += 7;
    }

    function reference(label, copy, anchor) {
      space(19, label);
      text(label, margin, y + 2.5, 10.5, 'secondary', {weight:'bold'});
      font(10.5, 'secondary', 'bold');
      doc.link(margin, y - 1, doc.getTextWidth(label), 5, {url:reportUrl + '#' + anchor});
      y = wrap(copy, margin, y + 5, width, 9.3, 'muted') + 5;
    }

    const deal = view.deal && sim;
    const path = view.chart && sim;
    const outcomes = sim && (view.capital || view.scenario);
    const evidence = view.compare || view.library || view.stress || view.archive || view.guide || view.after || view.notes;
    if (view.deal || path) {
      const quote = live?.quote;
      page(deal ? 'Buy NVDA at ' + fmt.price(sim.strike) : path ? live.path : 'Pricing & capital',
        deal ? quote.product + '  /  ' + quote.months + ' months  /  ' + quote.minimum + '-month guarantee  /  ' + style + ' colour style  /  ' + stamp : null);
      if (deal) {
        const gap = Math.round((live.spot - sim.strike) * 100) / 100;
        const entry = gap === 0 ? 'Equal to the starting price' :
          fmt.quote(Math.abs(gap / live.spot * 100)) + (gap > 0 ? ' below' : ' above') + ' the starting price';
        text(entry, margin, y + 7, 24, 'secondary', {family:'times', weight:'bold'});
        y += 14;
        cards([['STARTING PRICE', fmt.price(live.spot)], ['DAILY KNOCK-OUT', fmt.price(sim.ko)], ['CASH UPFRONT', fmt.money(sim.payment)]]);
        y = wrap(fmt.shares(sim.maximum) + ' shares per month  /  ' + fmt.money(live.capital) + ' target budget' +
          (quote.asOf ? '  /  Indicative quote ' + date(quote.asOf) : ''), margin, y - 2, width, 10, 'ink', 'bold') + 9;
      } else if (view.deal) {
        y = wrap(view.setupError || 'Enter a valid starting price and budget for a priced illustration.', margin, y, width) + 10;
      }
      if (path) pricePath(Boolean(deal));
      if (deal || path) callout('Capital at risk', risk);
    }
    if (outcomes) {
      page('Follow the money');
      if (view.capital) capital();
      if (view.scenario) scenarios();
      if (!deal && !path) callout('Capital at risk', risk);
    }
    if (evidence) {
      page('Compare the terms and risks');
      if (view.library || view.compare) comparison();
      if (view.stress) {
        heading('Test the downside', view.stressResult || 'No stress result is displayed for the selected inputs.', 49);
        if (view.stressFrequency.length) {
          y = wrap(view.stressBasis && 'Historical comparison: ' + view.stressBasis, margin, y, width, 9.2, 'muted') + 3;
          cards(view.stressFrequency.map(({label,value}) => [label.replace(/^At the end of /,'End of ').replace(/^At any /,'Any '), value]));
        }
        if (view.valuation) y = wrap(view.valuation, margin, y, width, 8.8, 'muted') + 5;
      }
      if (view.after) reference('After shares are delivered', 'Holding keeps the stock exposure. Covered calls or a decumulator add separate terms and trade-offs.', 'after');
      if (view.archive) reference('Earlier pricing', view.archiveDate || 'The archive lists prior indicative terms.', 'pricing-archive');
      if (view.guide) reference('Use the simulator', 'Change the price path to test a purchase schedule or a knock-out date.', 'accumulator-guide');
      if (view.notes) reference('Terms and assumptions', 'Illustrative gross results use the modelled closes. Review the issuer terms, observation schedule and sources.', 'notes-and-terms');
      if (!(deal || path || outcomes)) callout('Capital at risk', risk);
    }
    if (first) page('NVDA structured note');
  }

  window.AccumulatorQuickBrief = {capture, render};
})();
