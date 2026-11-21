(async function () {
  'use strict';
  const M = window.BondCashflowModel,
    R = window.BondStudioReport,
    market = window.BondCashflowMarket,
    $ = (id) => document.getElementById(id);
  document.querySelector('main').inert = true;
  const D = await market.load();
  document.querySelector('main').inert = false;
  const status = [
    D.quick.length + ' watchlist bonds',
    D.catalogue.length.toLocaleString('en-GB') +
      ' searchable Market Intel bonds'
  ];
  if (D.localCount)
    status.push(
      D.localCount.toLocaleString('en-GB') + ' series from this browser'
    );
  if (D.missing.length)
    status.push('Unavailable: ' + D.missing.join(', ') + '. Reload to retry.');
  $('feedHealth').textContent = status.join(' · ');
  const esc = (s) =>
    String(s ?? '').replace(
      /[&<>"']/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        })[c]
    );
  let watchlist = [],
    selected = null,
    result = null,
    report = null,
    pageIndex = 0,
    dirty = true,
    example = false,
    priceOrigin = 'User entered; date not supplied',
    fxOrigin = 'User entered; date not supplied',
    toastTimer,
    compareMode = false,
    compareYears = [1, 10];
  const utcToday = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
  };
  function stamp() {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Singapore',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      }).formatToParts(new Date()),
      g = (k) => parts.find((p) => p.type === k).value;
    return g('day') + '-' + g('month') + '-' + g('hour') + '.' + g('minute');
  }
  function reportDate() {
    return (
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Singapore',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      })
        .format(new Date())
        .replace(',', '') + ' SGT'
    );
  }
  function toast(message) {
    $('toast').textContent = message;
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ($('toast').hidden = true), 5500);
  }
  function download(name, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type })),
      a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function distinct(rows) {
    const seen = new Set();
    return rows.filter((r) => !seen.has(r.id) && seen.add(r.id));
  }
  const allRows = distinct([...D.catalogue, D.demoBond]);
  const byId = new Map(allRows.map((row) => [row.id, row]));
  const hubBond = () => {
    const row = byId.get(
      $('isin').value.trim().toUpperCase() +
        '|' +
        $('currency').value.toUpperCase()
    );
    return row &&
      (row.coupon == null || row.coupon === getNum('coupon')) &&
      (!row.maturity || row.maturity === $('maturity').value)
      ? row
      : null;
  };
  function rows() {
    const kind = $('list').value;
    return kind === 'watchlist'
      ? watchlist
      : kind === 'catalogue'
        ? D.catalogue
        : kind === 'quick'
          ? D.quick
          : [];
  }
  function populateOptions(keep) {
    const terms = $('search')
      .value.trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const list = rows().filter((r) =>
      terms.every((t) =>
        (r.name + ' ' + r.isin + ' ' + r.currency).toLowerCase().includes(t)
      )
    );
    const shown = list.slice(0, 250);
    const choice = byId.get(keep) || watchlist.find((r) => r.id === keep);
    if (choice && !shown.includes(choice)) shown.unshift(choice);
    const options = [
      new Option('Choose a bond…', ''),
      ...shown.map((r) => new Option(r.name + ' · ' + r.currency, r.id)),
      new Option('Enter another bond', '__custom__')
    ];
    $('bond').replaceChildren(...options);
    $('bond').value = shown.some((r) => r.id === keep)
      ? keep
      : $('list').value === 'custom'
        ? '__custom__'
        : '';
    $('listHint').textContent =
      $('list').value === 'custom'
        ? 'Enter the coupon, maturity and payment terms below.'
        : $('list').value === 'watchlist' && !shown.length
          ? 'Load a Portfolio favourites file to match its bonds by identifier.'
          : list.length.toLocaleString('en-GB') +
            ' matching bonds' +
            (list.length > 250
              ? ' · first 250 shown. Search by issuer, maturity or ISIN.'
              : '.');
  }
  function setValue(id, v) {
    $(id).value = v === null || v === undefined ? '' : String(v);
  }
  function getNum(id) {
    return $(id).value === '' ? null : Number($(id).value);
  }
  const investmentCurrency = () => $('inputs').elements.capitalCurrency.value;
  function currentFxQuote() {
    return market.fxReference(
      D.fx,
      $('currency').value.toUpperCase(),
      $('settlement').value,
      investmentCurrency()
    );
  }
  function applyFxQuote(ref) {
    setValue('fx', ref.value);
    setValue('fxDate', ref.date);
    fxOrigin = ref.source + ' · ' + ref.date;
  }
  function updateCurrencyFields({ restore = false, dateChanged = false } = {}) {
    const capital = investmentCurrency(),
      currency = $('currency').value.toUpperCase();
    const same = currency === capital,
      pair = capital + '/' + currency;
    const changed = $('fx').dataset.pair !== pair;
    $('fx').dataset.pair = pair;
    $('fx').readOnly = same;
    for (const id of ['fx', 'fxDate', 'upFx', 'downFx', 'fxStep']) {
      $(id).closest('label').hidden = same;
      $(id).disabled = same;
    }
    $('fxUnit').textContent = capital + ' per ' + currency;
    $('feeUnit').textContent = $('budgetUnit').textContent = capital;
    $('budget').placeholder = 'Enter ' + capital + ' amount';
    $('constantAssumptions').textContent =
      (same ? 'Purchase yield stays' : 'Purchase yield and FX stay') +
      ' constant.';
    $('gridHint').textContent = same
      ? 'The grid varies bond yield. Interest is received directly in ' +
        capital +
        '.'
      : 'FX runs across the columns. Capital and total value also vary by bond yield.';
    if (same) {
      setValue('fx', 1);
      setValue('fxDate', null);
      fxOrigin = 'Both invested capital and bond are in ' + capital + '.';
    } else if (
      !restore &&
      (changed || (dateChanged && $('fx').dataset.automatic === 'true'))
    ) {
      if (changed && !(getNum('fxStep') > 0)) setValue('fxStep', 5);
      setValue('fx', null);
      setValue('fxDate', null);
      fxOrigin = 'User-entered FX';
      $('fx').dataset.automatic = String(capital === 'USD');
      const quote = capital === 'USD' && currentFxQuote();
      if (quote) applyFxQuote(quote);
    }
  }
  function choose(id) {
    selected = byId.get(id) || watchlist.find((r) => r.id === id) || null;
    const b = selected || {},
      curr = b.currency || 'USD';
    setValue('name', b.name || 'Custom bond');
    for (const key of [
      'isin',
      'coupon',
      'maturity',
      'frequency',
      'minimum',
      'increment'
    ])
      setValue(key, b[key]);
    setValue('currency', curr);
    setValue('structure', b.structure || 'unsupported');
    setValue('dayCount', b.dayCount || 'ACT/ACT');
    for (const key of ['price', 'priceDate', 'accrued']) setValue(key, null);
    updateCurrencyFields();
    $('bondDetails').open =
      id === '__custom__' || Boolean(selected && !selected.structure);
    priceOrigin = 'Enter a purchase price or use a dated Market Intel quote.';
    example = false;
    updateTerms();
    markDirty();
  }
  function matchingReference() {
    return market.reference(hubBond(), $('settlement').value);
  }
  function updateTerms() {
    const currency = $('currency').value.toUpperCase();
    $('bondTerms').textContent = [
      $('isin').value,
      getNum('coupon') === null
        ? 'Coupon unconfirmed'
        : getNum('coupon') + '% yearly interest',
      $('maturity').value
    ]
      .filter(Boolean)
      .join(' · ');
    const special = $('structure').value === 'callable-proxy';
    $('structureNotice').textContent = special
      ? 'Conditional no-call illustration. The issuer may redeem early; make-whole and call terms are not modelled.'
      : $('structure').value === 'unsupported'
        ? 'Confirm the bond terms and supported structure before calculating.'
        : 'Regular fixed-coupon model. Verify dealing minimums and terms before use.';
    const row = hubBond();
    window.BondPriceChart.show(row, D.curves);
    const fxQuote = currentFxQuote();
    $('referenceFx').hidden = currency === investmentCurrency();
    $('referenceFx').disabled = !fxQuote;
    $('referenceFx').textContent = fxQuote
      ? 'Use FRED FX · ' + R.fmt(fxQuote.value, 4) + ' · ' + fxQuote.date
      : 'No dated FX available';
    $('fxHint').textContent = getNum('fx') !== null ? fxOrigin : '';
    const q = matchingReference();
    $('referencePrice').disabled = !q;
    $('referencePrice').textContent = q
      ? 'Use ' + q.priceSource + ' · ' + R.fmt(q.price, 3) + ' · ' + q.priceDate
      : 'No dated quote available';
    $('priceHint').textContent =
      priceOrigin + (getNum('price') !== null ? ' · per 100 face value' : '');
  }
  function read() {
    return {
      bond: {
        id: selected?.id || 'custom',
        name: $('name').value.trim() || 'Custom bond',
        isin: $('isin').value.trim(),
        currency: $('currency').value.toUpperCase(),
        coupon: getNum('coupon'),
        frequency: getNum('frequency'),
        maturity: $('maturity').value,
        structure: $('structure').value,
        dayCount: $('dayCount').value,
        minimum: getNum('minimum'),
        increment: getNum('increment')
      },
      capitalCurrency: investmentCurrency(),
      budget: getNum('budget'),
      fx: getNum('fx'),
      cleanPrice: getNum('price'),
      settlement: $('settlement').value,
      fees: getNum('fees'),
      accruedOverride: getNum('accrued'),
      lotMode: $('lotMode').value,
      path: $('path').value,
      yieldStep: getNum('yieldStep'),
      fxStep: $('fx').readOnly ? 0 : getNum('fxStep'),
      historyYears: Number($('historyYears').value),
      up: {
        yieldBps: getNum('upYield'),
        fxPct: $('fx').readOnly ? 0 : getNum('upFx')
      },
      down: {
        yieldBps: getNum('downYield'),
        fxPct: $('fx').readOnly ? 0 : getNum('downFx')
      },
      priceSource: priceOrigin,
      fxSource: fxOrigin,
      priceDate: $('priceDate').value || null,
      fxDate: $('fxDate').value || null,
      example
    };
  }
  function write(x) {
    const b = x.bond || {};
    const capital = x.capitalCurrency ?? 'SGD';
    if (!['USD', 'SGD'].includes(capital))
      throw Error('Choose an input file with a supported investment currency.');
    $('inputs').elements.capitalCurrency.value = capital;
    selected = byId.get(b.id) || byId.get(b.isin + '|' + b.currency) || null;
    for (const key of [
      'name',
      'isin',
      'currency',
      'coupon',
      'frequency',
      'maturity',
      'structure',
      'dayCount',
      'minimum',
      'increment'
    ])
      setValue(key, b[key]);
    for (const [id, key] of Object.entries({
      budget: 'budget',
      fx: 'fx',
      price: 'cleanPrice',
      settlement: 'settlement',
      fees: 'fees',
      accrued: 'accruedOverride',
      lotMode: 'lotMode',
      path: 'path',
      yieldStep: 'yieldStep',
      fxStep: 'fxStep',
      historyYears: 'historyYears',
      priceDate: 'priceDate',
      fxDate: 'fxDate'
    }))
      setValue(id, x[key]);
    setValue('upYield', x.up?.yieldBps);
    setValue('upFx', x.up?.fxPct);
    setValue('downYield', x.down?.yieldBps);
    setValue('downFx', x.down?.fxPct);
    priceOrigin = x.priceSource || 'Imported user input; date not supplied';
    fxOrigin = x.fxSource || 'Imported user input; date not supplied';
    example = !!x.example;
    $('fx').dataset.automatic = 'false';
    updateCurrencyFields({ restore: true });
    if (selected) {
      $('list').value = D.quick.some((r) => r.id === selected.id)
        ? 'quick'
        : 'catalogue';
      $('search').value = '';
      populateOptions(selected.id);
    } else {
      $('list').value = 'custom';
      populateOptions();
    }
    updateTerms();
    markDirty();
  }
  function markDirty() {
    dirty = true;
    $('capitalSummary').dataset.stale = 'true';
    $('capitalStale').hidden = !report;
    $('dirtyNotice').hidden = !report;
    for (const id of ['pdf', 'present', 'csv', 'comparePdf', 'compareTab'])
      $(id).disabled = true;
    $('validation').textContent = '';
    $('calculate').textContent = report
      ? 'Update 15-page report'
      : 'Build 15-page report';
  }
  function build() {
    try {
      const x = read();
      result = M.run(x);
      report = R.build(
        result,
        D,
        reportDate(),
        window.BondPriceChart.snapshot()
      );
      dirty = false;
      $('validation').textContent = '';
      $('dirtyNotice').hidden = true;
      $('emptyState').hidden = true;
      $('reportFrame').hidden = false;
      $('pageNavigation').hidden = false;
      $('resultNote').hidden = false;
      $('exactData').hidden = false;
      for (const id of ['pdf', 'present', 'csv', 'comparePdf', 'compareTab'])
        $(id).disabled = false;
      const p = result.prepared,
        base = result.series[1].rows[10];
      const cap = R.capitalSummary(p);
      $('capitalSummary').hidden = false;
      $('capitalSummary').dataset.stale = 'false';
      $('capitalStale').hidden = true;
      $('capitalCash').textContent =
        cap.capitalCurrency + ' ' + R.fmt(cap.amount);
      $('capitalNativeLabel').textContent =
        cap.currency === cap.capitalCurrency
          ? 'Cash used at purchase'
          : 'Capital cash · ' + cap.currency + ' equivalent';
      $('capitalNative').textContent =
        cap.currency +
        ' ' +
        R.fmt(
          cap.currency === cap.capitalCurrency ? p.cashUsed : cap.equivalent
        );
      $('capitalFxNote').textContent =
        cap.currency === cap.capitalCurrency
          ? 'Includes accrued interest and upfront fees'
          : cap.capitalCurrency +
            ' ' +
            R.fmt(p.x.fx, 4) +
            ' for ' +
            cap.currency +
            ' 1 · before fees';
      $('maturityValue').textContent =
        cap.currency + ' ' + R.fmt(cap.maturityValue);
      $('maturityDate').textContent =
        'Principal on ' + cap.maturity + ' · assumes repayment';
      $('metricFace').textContent = R.cash(
        base.nav,
        result.prepared.x.capitalCurrency
      );
      $('metricResidual').textContent =
        R.signedCash(base.nav - p.x.budget, result.prepared.x.capitalCurrency) +
        ' capital profit/loss · before received interest';
      $('metricCash').textContent = R.cash(
        base.cumulativeCF,
        result.prepared.x.capitalCurrency
      );
      $('metricTotal').textContent = R.cash(
        base.total,
        result.prepared.x.capitalCurrency
      );
      $('metricGain').textContent =
        (base.gain >= 0 ? '+' : '') +
        R.cash(base.gain, result.prepared.x.capitalCurrency) +
        ' vs original cash';
      $('resultNote').textContent =
        'Capital remaining (NAV) is what your investment is worth, excluding interest already received. Capital profit/loss compares that value with your starting cash. It includes unpaid interest and cash left over. Cashflow is the interest already paid to you. ' +
        (p.b.structure === 'callable-proxy'
          ? 'This illustration assumes the issuer pays in full and does not repay the bond early. '
          : '') +
        (p.x.lotMode === 'fractional'
          ? 'Fractional holding: dealing minimums are not enforced.'
          : 'Minimum denomination and face increments are included.');
      $('calculate').textContent = 'Update 15-page report';
      renderPage();
      renderTables();
      return true;
    } catch (e) {
      $('validation').textContent = e.message;
      for (const id of ['pdf', 'present', 'csv', 'comparePdf', 'compareTab'])
        $(id).disabled = true;
      return false;
    }
  }
  function renderPage() {
    if (!report) return;
    $('compareControls').hidden = !compareMode;
    $('historyControls').hidden = compareMode || pageIndex !== 12;
    $('historyWindow').value = String(result.prepared.x.historyYears);
    $('compareTab').setAttribute('aria-selected', String(compareMode));
    if (compareMode) {
      renderComparison();
      return;
    }
    $('pageNavigation').hidden = false;
    pageIndex = Math.max(0, Math.min(report.pages.length - 1, pageIndex));
    $('pageMount').innerHTML = R.svg(report.pages[pageIndex]);
    $('pageCount').textContent =
      'Page ' +
      (pageIndex + 1) +
      ' of ' +
      report.pages.length +
      ' · ' +
      report.pages[pageIndex].title;
    $('prev').disabled = pageIndex === 0;
    $('next').disabled = pageIndex === report.pages.length - 1;
    $('yearNav').hidden = pageIndex > 9;
    document.querySelectorAll('[data-page]').forEach((b) => {
      const idx = Number(b.dataset.page);
      b.setAttribute(
        'aria-selected',
        String(idx === 0 ? pageIndex < 10 : pageIndex === idx)
      );
    });
    document
      .querySelectorAll('[data-year]')
      .forEach((b) =>
        b.setAttribute(
          'aria-pressed',
          String(Number(b.dataset.year) === pageIndex)
        )
      );
    renderTables();
  }
  function setPage(i) {
    compareMode = false;
    pageIndex = i;
    renderPage();
  }
  function renderTables() {
    if (!result) return;
    if (compareMode) {
      renderCompareTable();
      return;
    }
    const hasFx =
      result.prepared.b.currency !== result.prepared.x.capitalCurrency;
    $('dataTables').innerHTML =
      result.series
        .map(
          (s) =>
            '<div class="table-scroll"><table><caption>' +
            esc(s.label) +
            ' · amounts in ' +
            result.prepared.x.capitalCurrency +
            '</caption><thead><tr>' +
            [
              'Year',
              'Bond yield',
              ...(hasFx ? ['FX'] : []),
              'Interest this year',
              'Interest so far',
              'Bond value',
              'Unpaid interest',
              'Cash left',
              'Principal repaid',
              'Capital value',
              'Total'
            ]
              .map((h) => '<th scope="col">' + h + '</th>')
              .join('') +
            '</tr></thead><tbody>' +
            s.rows
              .map(
                (r) =>
                  '<tr>' +
                  [
                    r.years,
                    R.fmt(r.yield, 3) + '%',
                    ...(hasFx ? [R.fmt(r.fx, 4)] : []),
                    R.fmt(r.annualCF, 2),
                    R.fmt(r.cumulativeCF, 2),
                    R.fmt(r.cleanNAV, 2),
                    R.fmt(r.accruedNAV, 2),
                    R.fmt(r.residual, 2),
                    R.fmt(r.principalCash, 2),
                    R.fmt(r.nav, 2),
                    R.fmt(r.total, 2)
                  ]
                    .map((v) => '<td>' + esc(v) + '</td>')
                    .join('') +
                  '</tr>'
              )
              .join('') +
            '</tbody></table></div>'
        )
        .join('') + matrixTable();
  }
  function matrixTable() {
    if (!result || pageIndex > 9) return '';
    const hasFx =
      result.prepared.b.currency !== result.prepared.x.capitalCurrency;
    const v = R.heatView(result.prepared, pageIndex + 1),
      table = (caption, headers, rows) =>
        '<div class="table-scroll"><table><caption>' +
        caption +
        '</caption><thead><tr>' +
        headers.map((h) => '<th scope="col">' + h + '</th>').join('') +
        '</tr></thead><tbody>' +
        rows
          .map(
            (row) =>
              '<tr>' +
              row.map((value) => '<td>' + value + '</td>').join('') +
              '</tr>'
          )
          .join('') +
        '</tbody></table></div>';
    return (
      table(
        'Interest received - Year ' +
          (pageIndex + 1) +
          (hasFx ? ' - changes with FX only' : ''),
        [
          ...(hasFx ? ['Target FX'] : []),
          'Interest received ' + result.prepared.x.capitalCurrency
        ],
        v.cashflow.map((c) => [
          ...(hasFx ? [R.fmt(c.fx, 4)] : []),
          R.fmt(c.value, 2)
        ])
      ) +
      table(
        'Capital remaining - Year ' +
          (pageIndex + 1) +
          ' - exact ' +
          result.prepared.x.capitalCurrency +
          ' values',
        [
          'Target yield %',
          ...(hasFx ? ['Target FX'] : []),
          'Applied yield %',
          ...(hasFx ? ['Applied FX'] : []),
          'Bond price per 100',
          'Capital value',
          'Capital profit/loss',
          'Interest + capital'
        ],
        v.rows.flatMap((row) =>
          row.cells.map((r, i) => [
            R.fmt(row.yieldTarget, 3),
            ...(hasFx ? [R.fmt(v.columns[i].fx, 4)] : []),
            R.fmt(r.yield, 3),
            ...(hasFx ? [R.fmt(r.fx, 4)] : []),
            row.repaid ? 'Repaid' : R.fmt(r.cleanPrice, 3),
            R.fmt(r.nav, 2),
            R.fmt(r.capitalPnl, 2),
            R.fmt(r.total, 2)
          ])
        )
      )
    );
  }
  function demo() {
    $('inputs').elements.capitalCurrency.value = 'SGD';
    const t = D.demoBond;
    $('list').value = D.quick.includes(t) ? 'quick' : 'catalogue';
    $('search').value = '';
    populateOptions(t.id);
    choose(t.id);
    setValue('budget', 216000);
    setValue('fx', 1.3);
    setValue('price', 50);
    setValue('fees', 0);
    setValue('settlement', '2026-11-16');
    setValue('lotMode', 'round');
    setValue('path', 'gradual');
    setValue('yieldStep', 0.5);
    setValue('fxStep', 5);
    setValue('upYield', -100);
    setValue('upFx', 10);
    setValue('downYield', 100);
    setValue('downFx', -10);
    setValue('historyYears', 99);
    setValue('priceDate', null);
    setValue('fxDate', null);
    priceOrigin = 'Illustrative clean price 50.00, not a dealing quote';
    fxOrigin = 'Illustrative FX 1.3000, not a dealing quote';
    example = true;
    compareMode = false;
    pageIndex = 0;
    updateTerms();
    build();
    toast(
      'Illustration loaded. All purchase and scenario inputs can be changed.'
    );
  }
  function clear() {
    compareMode = false;
    compareYears = [1, 10];
    clearTimeout(toastTimer);
    $('toast').hidden = true;
    $('compareControls').hidden = true;
    $('historyControls').hidden = true;
    $('compareTab').setAttribute('aria-selected', 'false');
    document.body.classList.remove('presentation');
    $('present').textContent = 'Present';
    $('inputs').reset();
    delete $('fx').dataset.pair;
    setValue('budget', null);
    setValue('fx', null);
    setValue('price', null);
    setValue('settlement', utcToday());
    priceOrigin = 'User entered; date not supplied';
    fxOrigin = 'User entered; date not supplied';
    example = false;
    result = report = null;
    pageIndex = 0;
    $('list').value = watchlist.length ? 'watchlist' : 'quick';
    $('search').value = '';
    const t =
      watchlist[0] ||
      D.quick.find((b) => b.isin === 'US87973RAW07') ||
      D.quick[0];
    populateOptions(t?.id);
    choose(t?.id);
    $('emptyState').hidden = false;
    for (const id of [
      'reportFrame',
      'pageNavigation',
      'resultNote',
      'exactData',
      'dirtyNotice',
      'capitalSummary',
      'capitalStale'
    ])
      $(id).hidden = true;
    $('pageMount').innerHTML = '';
    $('dataTables').innerHTML = '';
    $('metricFace').textContent =
      $('metricCash').textContent =
      $('metricTotal').textContent =
        '—';
    $('metricResidual').textContent =
      'Profit/loss compared with your starting cash';
    $('metricGain').textContent = 'No-change scenario';
    $('validation').textContent = '';
  }
  function setWatchlist(rowsIn) {
    watchlist = distinct(
      rowsIn
        .map((r) => byId.get(r.id) || byId.get(r.isin + '|' + r.currency))
        .filter(Boolean)
    );
    $('list').value = 'watchlist';
    $('search').value = '';
    populateOptions(watchlist[0]?.id);
    choose(watchlist[0]?.id);
  }
  async function loadWatch(file) {
    if (!file) return;
    try {
      if (file.size > 25e6) throw Error('Choose a JSON file below 25 MB.');
      const raw = JSON.parse(await file.text()),
        r = window.BondStudioAdapter.fromExport(raw, allRows);
      setWatchlist(r.rows);
      toast(
        'Loaded ' +
          r.matched +
          ' bond favourites. ' +
          r.unmatched.length +
          ' identifiers were unavailable or were not bonds. Holdings and loans were ignored.'
      );
    } catch (e) {
      toast(e.message);
    } finally {
      $('watchFile').value = '';
    }
  }
  function present() {
    if (!report || dirty) return;
    const active = document.body.classList.toggle('presentation');
    $('present').textContent = active ? 'Exit presentation' : 'Present';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function savePDF() {
    if (!report || dirty) return;
    const button = $('pdf'),
      label = button.textContent;
    button.disabled = true;
    button.textContent = 'Generating…';
    try {
      await new Promise((resolve) => setTimeout(resolve, 30));
      const pdf = R.pdf(report, window.jspdf.jsPDF);
      pdf.save('Bond Cashflow Report - Type PDF - ' + stamp() + '.pdf');
      toast('15-page A4 landscape PDF generated.');
    } catch (e) {
      toast('PDF could not be generated: ' + e.message);
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  }
  function sourceHTML() {
    const refs = [
      ['bonds-beta.html', 'Bonds BETA · observed bids and Treasury estimates'],
      ['v4.html#history/fx', 'Market Intel · historical FX'],
      [
        'https://www.treasurydirect.gov/auctions/auction-query/',
        'TreasuryDirect · note and bond terms'
      ],
      [D.temasekSource, 'Temasek · Series 21 terms'],
      [D.callSource, 'Exchange reference · call terms and increment'],
      ...Object.entries(D.seriesSources).map(([k, url]) => [
        url,
        {
          fx: 'FRED · monthly USD/SGD',
          y10: 'FRED · 10-year Treasury',
          y20: 'FRED · 20-year Treasury',
          y30: 'FRED · 30-year Treasury'
        }[k]
      ])
    ];
    return (
      '<p>Prices are quoted per 100 of face value. The chart shows observed bids and available Treasury estimates. Purchase inputs can use a dated ask or, when only a newer bid is available, an explicitly labelled bid. The reference buttons use observations on or before settlement.</p><p>' +
      (D.history.length
        ? esc(D.historySource + ' · ' + D.historyFrom + ' to ' + D.historyTo)
        : 'Monthly benchmark history is unavailable.') +
      '</p><ul>' +
      refs
        .map(
          ([url, label]) =>
            '<li><a href="' + esc(url) + '">' + esc(label) + '</a></li>'
        )
        .join('') +
      '</ul>'
    );
  }
  $('inputs').addEventListener('submit', (e) => {
    e.preventDefault();
    build();
  });
  $('inputs').addEventListener('input', (e) => {
    if (e.target.id === 'search') return;
    if (e.target.id === 'price') {
      setValue('priceDate', null);
      priceOrigin = 'User-entered clean price';
      example = false;
    }
    if (e.target.id === 'fx') {
      $('fx').dataset.automatic = 'false';
      setValue('fxDate', null);
      fxOrigin = 'User-entered FX';
      example = false;
    }
    markDirty();
  });
  $('inputs').addEventListener('change', (e) => {
    if (['list', 'bond', 'search'].includes(e.target.id)) return;
    if (e.target.id === 'currency') {
      $('currency').value = $('currency').value.toUpperCase();
      setValue('price', null);
      setValue('priceDate', null);
      priceOrigin = 'Enter the purchase price for this currency.';
    }
    if (e.target.name === 'capitalCurrency') {
      example = false;
      if (getNum('budget') !== null)
        toast(
          'The entered capital and fees are now in ' +
            investmentCurrency() +
            '.'
        );
    }
    updateCurrencyFields({ dateChanged: e.target.id === 'settlement' });
    if (e.target.id === 'priceDate')
      priceOrigin =
        'User-entered clean price' +
        ($('priceDate').value
          ? ' · ' + $('priceDate').value
          : '; date not supplied');
    if (e.target.id === 'fxDate')
      fxOrigin =
        'User-entered FX' +
        ($('fxDate').value ? ' · ' + $('fxDate').value : '; date not supplied');
    updateTerms();
    markDirty();
  });
  $('list').addEventListener('change', () => {
    $('search').value = '';
    const first = rows()[0]?.id;
    populateOptions(first);
    choose(first || '__custom__');
  });
  $('bond').addEventListener('change', () => choose($('bond').value));
  $('search').addEventListener('input', () => {
    populateOptions(selected?.id);
  });
  $('referenceFx').addEventListener('click', () => {
    const ref = currentFxQuote();
    if (!ref) return;
    applyFxQuote(ref);
    $('fx').dataset.automatic = 'true';
    example = false;
    updateTerms();
    markDirty();
  });
  $('referencePrice').addEventListener('click', () => {
    const q = matchingReference();
    if (!q) return;
    setValue('price', q.price);
    setValue('priceDate', q.priceDate);
    priceOrigin =
      (q.priceSource || q.source || 'Stored reference') +
      ' · ' +
      (q.priceDate || 'quote date unknown') +
      ' · not live';
    example = false;
    updateTerms();
    markDirty();
    toast(
      'Dated reference copied. Confirm a current executable price before a purchase.'
    );
  });
  $('demo').addEventListener('click', demo);
  $('demoEmpty').addEventListener('click', demo);
  $('reset').addEventListener('click', clear);
  $('present').addEventListener('click', present);
  $('pdf').addEventListener('click', savePDF);
  $('prev').addEventListener('click', () => setPage(pageIndex - 1));
  $('next').addEventListener('click', () => setPage(pageIndex + 1));
  document
    .querySelectorAll('[data-page]')
    .forEach((b) =>
      b.addEventListener('click', () => setPage(Number(b.dataset.page)))
    );
  $('yearNav').innerHTML = Array.from(
    { length: 10 },
    (_, i) =>
      '<button data-year="' +
      i +
      '" aria-pressed="' +
      (i === 0) +
      '">Year ' +
      (i + 1) +
      '</button>'
  ).join('');
  $('yearNav').addEventListener('click', (e) => {
    const b = e.target.closest('[data-year]');
    if (b) setPage(Number(b.dataset.year));
  });
  document.addEventListener('keydown', (e) => {
    if (
      !document.body.classList.contains('presentation') ||
      /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)
    )
      return;
    if (e.key === 'Escape') {
      present();
      e.preventDefault();
    }
    if (compareMode && ['ArrowRight', 'ArrowLeft'].includes(e.key)) {
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowRight') {
      setPage(pageIndex + 1);
      e.preventDefault();
    }
    if (e.key === 'ArrowLeft') {
      setPage(pageIndex - 1);
      e.preventDefault();
    }
  });
  $('csv').addEventListener('click', () => {
    if (result && !dirty)
      download(
        'Bond Cashflow Values - Type CSV - ' + stamp() + '.csv',
        M.toCSV(result),
        'text/csv;charset=utf-8'
      );
  });
  $('saveInputs').addEventListener('click', () =>
    download(
      'Bond Cashflow Inputs - Type JSON - ' + stamp() + '.json',
      JSON.stringify(
        {
          schema:
            investmentCurrency() === 'USD'
              ? 'bond-cashflow-studio/2'
              : 'bond-cashflow-studio/1',
          exportedAt: new Date().toISOString(),
          inputs: read()
        },
        null,
        2
      ),
      'application/json'
    )
  );
  $('loadInputs').addEventListener('click', () => $('inputsFile').click());
  $('inputsFile').addEventListener('change', async () => {
    try {
      const f = $('inputsFile').files[0];
      if (!f) return;
      if (f.size > 2e6) throw Error('Input file is too large.');
      const x = JSON.parse(await f.text());
      if (
        !['bond-cashflow-studio/1', 'bond-cashflow-studio/2'].includes(
          x.schema
        ) ||
        !x.inputs
      )
        throw Error('Choose an input file saved by Bond Cashflow Studio.');
      write(x.inputs);
      if (build()) toast('Inputs loaded and report rebuilt.');
      else
        toast('Inputs loaded. Complete the highlighted details to calculate.');
    } catch (e) {
      toast(e.message);
    } finally {
      $('inputsFile').value = '';
    }
  });
  $('importWatchlist').addEventListener('click', () => $('watchFile').click());
  $('watchFile').addEventListener('change', () =>
    loadWatch($('watchFile').files[0])
  );
  $('sources').innerHTML = sourceHTML();

  function renderCompareTable() {
    if (!result) return;
    $('dataTables').innerHTML =
      '<div class="table-scroll"><table><caption>Chosen years · exact values in ' +
      result.prepared.x.capitalCurrency +
      '</caption><thead><tr>' +
      [
        'Scenario',
        'Year',
        'Interest received',
        'Capital remaining',
        'Capital profit/loss',
        'Combined value'
      ]
        .map((t) => '<th scope="col">' + t + '</th>')
        .join('') +
      '</tr></thead><tbody>' +
      result.series
        .flatMap((s) =>
          compareYears.map((y) => {
            const r = s.rows[y];
            return (
              '<tr>' +
              [
                s.label,
                y,
                R.fmt(r.cumulativeCF, 2),
                R.fmt(r.nav, 2),
                R.fmt(r.nav - result.prepared.x.budget, 2),
                R.fmt(r.total, 2)
              ]
                .map((v) => '<td>' + esc(v) + '</td>')
                .join('') +
              '</tr>'
            );
          })
        )
        .join('') +
      '</tbody></table></div>';
  }
  function comparisonReport() {
    return R.comparison(
      result,
      compareYears[0],
      compareYears[1],
      reportDate(),
      window.BondPriceChart.snapshot()
    );
  }
  function renderComparison() {
    renderCompareTable();
    const cr = comparisonReport();
    $('pageMount').innerHTML = R.svg(cr.pages[0]);
    $('yearNav').hidden = true;
    $('pageNavigation').hidden = true;
    document
      .querySelectorAll('[data-page]')
      .forEach((b) => b.setAttribute('aria-selected', 'false'));
    ['compareLeft', 'compareRight'].forEach((id, side) => {
      $(id).innerHTML = Array.from(
        { length: 10 },
        (_, i) =>
          '<button type="button" data-compare-year="' +
          (i + 1) +
          '" aria-pressed="' +
          (compareYears[side] === i + 1) +
          '">' +
          (i + 1) +
          '</button>'
      ).join('');
    });
    const rows = result.series[1].rows,
      a = rows[compareYears[0]],
      b = rows[compareYears[1]];
    $('compareDelta').innerHTML =
      '<strong>Change from Year ' +
      compareYears[0] +
      ' to Year ' +
      compareYears[1] +
      ' · no-change scenario</strong>' +
      [
        ['Interest received', b.cumulativeCF - a.cumulativeCF],
        ['Capital remaining', b.nav - a.nav],
        ['Combined value', b.total - a.total]
      ]
        .map(
          ([label, v]) =>
            '<span>' +
            label +
            '<b>' +
            esc(R.signedCash(v, result.prepared.x.capitalCurrency)) +
            '</b></span>'
        )
        .join('');
  }
  $('compareTab').addEventListener('click', () => {
    if (!report || dirty) return;
    compareMode = true;
    renderPage();
  });
  ['compareLeft', 'compareRight'].forEach((id, side) =>
    $(id).addEventListener('click', (e) => {
      const b = e.target.closest('[data-compare-year]');
      if (b && result) {
        compareYears[side] = Number(b.dataset.compareYear);
        renderComparison();
      }
    })
  );
  $('comparePdf').addEventListener('click', async () => {
    if (!result || dirty) return;
    try {
      const doc = R.pdf(comparisonReport(), window.jspdf.jsPDF);
      doc.save(
        'Bond Year ' +
          compareYears[0] +
          ' vs ' +
          compareYears[1] +
          ' - Type PDF - ' +
          stamp() +
          '.pdf'
      );
    } catch (e) {
      toast('Could not generate comparison PDF: ' + e.message);
    }
  });
  $('priceRange').addEventListener('change', () => {
    if (report && !dirty) build();
  });
  $('historyWindow').addEventListener('change', () => {
    setValue('historyYears', $('historyWindow').value);
    if (dirty) {
      toast(
        'History range selected. Update the report to apply all pending changes.'
      );
      return;
    }
    build();
  });
  window.BondCashflowStudio = {
    version: '1.2.0',
    getInputs: () => JSON.parse(JSON.stringify(read())),
    setInputs: write,
    setWatchlist,
    build,
    getResult: () => result,
    getReport: () => report,
    setPage,
    example: demo,
    clear
  };
  clear();
  const query = new URLSearchParams(window.location.search);
  if (query.has('isin')) {
    const id = query.get('isin') + '|' + query.get('currency');
    if (byId.has(id)) {
      $('list').value = D.quick.some((b) => b.id === id)
        ? 'quick'
        : 'catalogue';
      populateOptions(id);
      choose(id);
    } else {
      $('list').value = 'custom';
      populateOptions();
      choose('__custom__');
      $('feedHealth').textContent +=
        ' · This bond is unavailable in the current browser.';
    }
  }
})();
