/* Market context shared by both NVDA accumulator pages. */
(() => {
  'use strict';

  const ticker = 'NVDA US';
  const day = date => Date.parse(date + 'T00:00:00Z');
  const dateFormat = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
  });
  const dateLabel = date => dateFormat.format(day(date));
  const money = window.AccumulatorFormat.price;
  const escape = value => String(value).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const marketLink = '<a href="../stocks-beta2.html">Shares Beta 2</a>';
  const ratings = {Buy: '#156653', Hold: '#8a550d', Sell: '#a03551'};

  async function read(file) {
    const response = await fetch('../data/' + file, {signal: AbortSignal.timeout(12000)});
    if (!response.ok) throw Error('Archive unavailable');
    return response.json();
  }

  function pricingTerms(quote, simulation, path) {
    const fields = [
      ['product', quote.product],
      ['term', quote.months + ' months'],
      ['term', quote.minimum + '-month guarantee']
    ];
    if (quote.id === 'nv9086') fields.push(['term', 'Earlier quote']);
    const percent = window.AccumulatorFormat.quote;
    fields.push(
      ['strike', 'Quoted strike ' + percent(quote.strike) + ' (' + money(simulation.strike) + ')'],
      ['ko', 'Daily KO ' + percent(quote.ko) + ' (' + money(simulation.ko) + ')']
    );
    if (path) fields.push(['path', path]);
    return fields.map(([style, text]) =>
      '<span class="nvda-term-' + style + '">' + escape(text) + '</span>'
    ).join('<span class="nvda-term-divider"> · </span>');
  }

  function mount(redraw) {
    const controls = [...document.querySelectorAll('[data-nvda-overlay]')];
    const valuation = document.getElementById('nvda-chart-valuation');
    const details = document.getElementById('nvda-overlay-details');
    const enabled = {prices: true, earnings: false, calls: false, target: false};
    let archive, calls, target, callRequest, targetRequest;
    let detailsContent = '';

    const archiveRequest = read('stocks-beta2-monthly-history.json?v=20261121').then(data => {
      const listing = data.securities.find(item => item.ticker === ticker && item.currency === 'USD');
      if (!listing) throw Error('NVDA archive unavailable');
      archive = {data, listing};
      if (valuation) showValuation();
      return archive;
    }).catch(() => {
      if (valuation) valuation.innerHTML = '<p>Forward P/E and P/B are unavailable. ' + marketLink + '</p>';
      return null;
    });

    function showValuation() {
      const {data, listing} = archive;
      const pe = data.metrics.findIndex(([key]) => key === 'forward_pe') + 1;
      const pb = data.metrics.findIndex(([key]) => key === 'forward_pb') + 1;
      const rows = listing.observations.slice(-12).reverse();
      const multiple = value => Number.isFinite(value) && value > 0 ? value.toFixed(1) + '×' : '—';
      const latest = rows[0];
      const asOf = dateLabel(data.months[latest[0]][1]);
      valuation.innerHTML =
        '<div class="nvda-valuation-summary"><strong>NVDA valuation</strong>' +
        '<span>Forward P/E <b>' + multiple(latest[pe]) + '</b></span>' +
        '<span>Forward P/B <b>' + multiple(latest[pb]) + '</b></span>' +
        '<span class="nvda-valuation-date">BOS edition · ' + asOf + '</span></div>' +
        '<details><summary>Monthly P/E and P/B</summary><div class="nvda-valuation-table">' +
        '<table aria-label="NVDA monthly forward valuation multiples"><thead><tr><th scope="col">BOS report date</th>' +
        '<th scope="col">Forward P/E</th><th scope="col">Forward P/B</th></tr></thead><tbody>' +
        rows.map(row => '<tr><th scope="row">' + dateLabel(data.months[row[0]][1]) + '</th><td>' +
          multiple(row[pe]) + '</td><td>' + multiple(row[pb]) + '</td></tr>').join('') +
        '</tbody></table><p>Consensus forward estimates archived by ' + marketLink + '.</p></div></details>';
    }

    function loadCalls() {
      callRequest = Promise.all([archiveRequest, read('stocks-beta2-morningstar.json?v=20261121.2')])
        .then(([saved, data]) => {
          if (!saved || !data[ticker]) throw Error('House calls unavailable');
          calls = data[ticker].flatMap(([index, , rating]) => {
            const date = saved.data.months[index]?.[1];
            return date && Object.hasOwn(ratings, rating) ? [{date, rating}] : [];
          });
        }).catch(() => { calls = null; }).finally(() => { callRequest = null; redraw(); });
    }

    function loadTarget() {
      targetRequest = read('stocks-beta2-research-briefs.json?v=20261121.full1').then(data => {
        const brief = data.briefs[ticker];
        const value = window.StocksBeta2Charts.researchConeTarget(brief, 'USD');
        if (!value || !Number.isFinite(day(brief.target.date))) throw Error('Fair value unavailable');
        target = {...value, date: brief.target.date};
      }).catch(() => { target = null; }).finally(() => { targetRequest = null; redraw(); });
    }

    for (const input of controls) {
      input.addEventListener('change', () => {
        const key = input.dataset.nvdaOverlay;
        enabled[key] = input.checked;
        for (const peer of controls) {
          if (peer.dataset.nvdaOverlay === key) peer.checked = input.checked;
        }
        if (input.checked && key === 'calls' && !calls && !callRequest) loadCalls();
        if (input.checked && key === 'target' && !target && !targetRequest) loadTarget();
        redraw();
      });
    }

    function overlays(compact, first, last, pricesVisible) {
      const area = document.getElementById(compact ? 'overviewPlot' : 'plot').closest('section');
      const inRange = item => first && item.date >= first && item.date <= last;
      const earnings = enabled.earnings && first
        ? (window.AccumulatorNvdaFinancialData?.earningsQuarters || []).flatMap(quarter =>
          quarter.published && inRange({date: quarter.published})
            ? [{date: quarter.published, label: quarter.quarter, url: quarter.releaseUrl || quarter.url}] : []) : [];
      const house = enabled.calls && first ? (calls || []).filter(inRange) : [];
      const fairValue = enabled.target ? target : undefined;
      const legend = area.querySelector('[data-nvda-legend="target"]');
      legend.textContent = fairValue ? fairValue.provider + ' fair value · ' + money(fairValue.value) : '';
      legend.hidden = !fairValue;
      area.querySelector('.legend .hist').hidden = !pricesVisible || !first;
      area.querySelector('[data-nvda-legend="earnings"]').hidden = !earnings.length;
      area.querySelector('[data-nvda-legend="calls"]').hidden = !house.length;

      const notes = [];
      if (enabled.calls && first && callRequest) notes.push('Loading house calls…');
      if (enabled.calls && first && calls === null && !callRequest) notes.push('House calls unavailable. Toggle to retry.');
      if (enabled.calls && first && calls && !house.length) notes.push('No saved house calls in this window.');
      if (enabled.earnings && first && !earnings.length) notes.push('No verified earnings dates in this window.');
      if (enabled.target && targetRequest) notes.push('Loading the analyst price target…');
      if (enabled.target && target === null && !targetRequest) notes.push('Price target unavailable. Toggle to retry.');
      if ((enabled.earnings || enabled.calls) && !first) notes.push('Select a history window to see past events.');
      const status = area.querySelector('[data-nvda-overlay-status]');
      const message = notes.join(' ');
      if (status.textContent !== message) status.textContent = message;
      status.hidden = !message;

      if (compact) {
        const sections = [];
        if (earnings.length) sections.push('<p><strong>Earnings releases</strong> ' +
          earnings.map(event => '<a href="' + escape(event.url) + '">' + escape(event.label) +
            ' · ' + dateLabel(event.date) + '</a>').join(' · ') + '</p>');
        if (house.length) sections.push('<p><strong>BOS monthly calls</strong> ' +
          house.map(({date, rating}) => dateLabel(date) + ' · ' + rating).join(' / ') +
          ' · ' + marketLink + '</p>');
        if (fairValue) sections.push('<p><strong>' + escape(fairValue.provider) + ' fair value</strong> ' +
          money(fairValue.value) + ' · ' + dateLabel(fairValue.date) + ' · ' +
          (fairValue.source ? '<a href="' + escape(fairValue.source) + '">Analyst report</a>' : marketLink) + '</p>');
        const content = sections.join('');
        if (detailsContent !== content) {
          details.querySelector('div').innerHTML = content;
          detailsContent = content;
        }
        details.hidden = !content;
      }
      return {earnings, house, fairValue};
    }

    return {enabled, overlays, archive: archiveRequest};
  }

  function markers(events, x, top, bottom, line, label) {
    let svg = '';
    const earningsY = bottom + 41;
    const callsY = bottom + (events.earnings.length ? 60 : 41);
    for (const {date, label: quarter} of events.earnings) {
      const cx = x(date);
      svg += '<g data-nvda-earnings><title>' + escape(quarter) + ' earnings · ' + dateLabel(date) +
        '</title>' + line(cx, top, cx, bottom, '#23639e', 'stroke-dasharray="2 4" opacity=".55"') +
        label(cx, earningsY, 'E', 'text-anchor="middle" font-size="12" font-weight="750" fill="#23639e"') + '</g>';
    }
    for (const {date, rating} of events.house) {
      const cx = x(date);
      svg += '<g data-nvda-call><title>BOS · ' + rating + ' · ' + dateLabel(date) + '</title>' +
        label(cx, callsY, rating[0], 'text-anchor="middle" font-size="12" font-weight="750" fill="' +
          ratings[rating] + '"') + '</g>';
    }
    return svg;
  }

  window.AccumulatorNvdaChart = {mount, pricingTerms, markers, day};
})();
