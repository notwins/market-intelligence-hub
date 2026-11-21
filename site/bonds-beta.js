(() => {
  'use strict';

  const { sources, publicHistory, readHistory, mergeHistory, annualPriceChanges, fredCurves, reconstructedPrices } = BondsBetaData;
  const feedURL = 'data/Bond%20Prices%20-%20Type%20JSON%20-%2016-Nov-03.10.json';
  const temasek = 'US87973RAW07';
  const get = id => document.getElementById(`bb-${id}`);
  const formatDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const dateLabel = date => date ? formatDate.format(new Date(`${date}T00:00:00Z`)) : '—';
  const decimal = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  const shortNumber = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 });
  const percent = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' });
  const displayNumber = value => Number.isFinite(value) ? decimal.format(value) : '—';
  const noOverlay = () => new Option('No overlay', '');
  let publicBonds = new Map();
  let localBonds = new Map();
  let bonds = new Map();
  let curves = [];
  let modeled = new Map();
  let defaultKeys = [];
  let selected = [];
  let group = 'all';
  let dates = [];
  let dateIndices = new Map();
  let dateRows = [];
  let from = 0;
  let cursor = 0;
  let cards = [];
  let redrawPending = false;
  let remembered = false;
  let showingSavedHistory = false;
  let publicUnavailable = false;
  let historyMessage = '';

  function historyStorage(action, content) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('market-intel-bonds-beta', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('history');
      let blocked = false;
      request.onblocked = () => { blocked = true; reject(Error('Browser history storage is busy.')); };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        if (blocked) { db.close(); return; }
        try {
          const tx = db.transaction('history', action === 'get' ? 'readonly' : 'readwrite');
          const store = tx.objectStore('history');
          const key = 'bond-history-csv';
          const operation = action === 'get' ? store.get(key) : action === 'save' ? store.put(content, key) : store.delete(key);
          tx.oncomplete = () => { db.close(); resolve(operation.result); };
          tx.onabort = () => { db.close(); reject(tx.error || Error('Browser history storage was interrupted.')); };
        } catch (error) { db.close(); reject(error); }
      };
    });
  }

  function setHistoryBusy(busy) {
    for (const name of ['open', 'file', 'clear']) get(name).disabled = busy;
  }

  function updateStatus() {
    let status = 'Loading the bond watchlist…';
    if (localBonds.size) {
      status = `Loaded ${localBonds.size.toLocaleString('en-GB')} bond series. ${showingSavedHistory ? 'History and ACE rates are saved in this browser.' : 'History and ACE rates are available for this session.'}`;
      if (publicUnavailable) status += ' The public quote feed is currently unavailable.';
    } else if (publicBonds.size) {
      const lastQuote = [...publicBonds.values()].flatMap(item => [...item.rows.keys()]).sort().at(-1);
      status = `${publicBonds.size} default bonds · Saved public quotes through ${dateLabel(lastQuote)}. Open and remember your CSV once for additional observed history and ACE rates.`;
    } else if (publicUnavailable) {
      status = 'The public watchlist could not load. Retry or open a Bonds BETA history CSV.';
    }
    get('status').textContent = [status, historyMessage].filter(Boolean).join(' ');
  }

  window.ReturnSparks?.register('bond-beta', ({ symbol }) => {
    const item = bonds.get(symbol);
    if (!item) return null;
    const points = [...item.rows].filter(([, quote]) => Number.isFinite(quote.bid))
      .map(([date, quote]) => [date, quote.bid]).sort((a, b) => a[0].localeCompare(b[0]));
    return { points, name: item.name, unit: item.currency + ' per 100 face', label: 'bid price history',
      basis: 'Saved bid prices. Price changes exclude coupons, accrued interest, fees and FX.' };
  });

  const visible = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const card = cards.find(item => item.element === entry.target);
      if (card) card.near = entry.isIntersecting;
    }
    queueRedraw();
  }, { rootMargin: '350px' });
  new ResizeObserver(queueRedraw).observe(get('cards'));

  function queueRedraw() {
    if (redrawPending) return;
    redrawPending = true;
    requestAnimationFrame(() => {
      redrawPending = false;
      for (const card of cards) {
        updatePoint(card);
        if (card.near) drawCard(card);
      }
    });
  }

  function populateControls() {
    const query = get('search').value.toUpperCase().trim().split(/\s+/).filter(Boolean);
    const pool = query.length ? [...bonds.keys()] : defaultKeys;
    const matches = pool.filter(key => {
      const instrument = bonds.get(key);
      return query.every(term => `${instrument.isin} ${instrument.name} ${instrument.currency}`.toUpperCase().includes(term));
    }).slice(0, 100);
    const matchSelect = get('match');
    matchSelect.replaceChildren(...matches.map(key => {
      const item = bonds.get(key);
      return new Option(`${item.name} · ${item.isin}`, key);
    }));
    if (!matches.length) matchSelect.add(new Option('No matching bonds', ''));
    get('add').disabled = !matches.length;
    const overlay = get('overlay');
    const previous = overlay.value;
    const choices = [...new Set([...selected, ...matches])];
    if (bonds.has(previous) && !choices.includes(previous)) choices.push(previous);
    overlay.replaceChildren(noOverlay(), ...choices.map(key => {
      const item = bonds.get(key);
      return new Option(`${item.name} · ${item.currency}`, key);
    }));
    overlay.value = previous && bonds.has(previous) ? previous : '';
  }

  function setCursor(index) {
    cursor = Math.max(from, Math.min(dates.length - 1, index));
    const slider = get('cursor');
    slider.value = String(cursor);
    slider.setAttribute('aria-valuetext', dateLabel(dates[cursor]));
    get('date').textContent = dateLabel(dates[cursor]);
    queueRedraw();
  }

  function dateRange() {
    const months = Number(get('range').value);
    from = 0;
    if (months && dates.length) {
      const last = new Date(`${dates.at(-1)}T00:00:00Z`);
      last.setUTCMonth(last.getUTCMonth() - months);
      from = Math.max(0, dates.findIndex(date => date >= last.toISOString().slice(0, 10)));
    }
    const slider = get('cursor');
    slider.min = String(from);
    slider.max = String(Math.max(from, dates.length - 1));
    slider.disabled = dates.length <= from + 1;
    get('inspect').hidden = !dates.length;
    setCursor(cursor);
  }

  function updatePoint(card) {
    const date = dates[cursor];
    const own = card.instrument.rows.get(date);
    const estimate = !Number.isFinite(own?.bid) ? modeled.get(card.instrument)?.points.get(date) : null;
    const peer = card.peer?.rows.get(date);
    const peerEstimate = !Number.isFinite(peer?.bid) ? modeled.get(card.peer)?.points.get(date) : null;
    card.element.querySelector('[data-bb-price-label]').textContent = estimate ? 'Estimated clean price' : 'Bid price';
    card.element.querySelector('[data-bb-price]').textContent = displayNumber(estimate?.price ?? own?.bid);
    card.element.querySelector('[data-bb-yield]').textContent = Number.isFinite(own?.yield) ? `${displayNumber(own.yield)}%` : '—';
    const tenor = value => value < 1 ? `${Math.round(value * 12)}M` : `${value}Y`;
    const detail = estimate ? `${dateLabel(date)} · ${shortNumber.format(estimate.years)} years left · FRED ${tenor(estimate.lower)}${estimate.lower === estimate.upper ? '' : '–' + tenor(estimate.upper)} · ${displayNumber(estimate.rate)}% model yield`
      : own ? `${dateLabel(date)} · ${sources[own.source].join(' · ')}`
      : date ? `${dateLabel(date)} · No observation` : 'No dated quotes available';
    card.element.querySelector('.bb-point').textContent = detail;
    const legend = card.element.querySelector('.bb-legend');
    legend.hidden = !card.peer;
    if (card.peer) {
      const values = peerEstimate ? ` · Estimated clean price ${displayNumber(peerEstimate.price)}`
        : peer ? ` · Bid ${displayNumber(peer.bid)} · Yield ${Number.isFinite(peer.yield) ? `${displayNumber(peer.yield)}%` : '—'} · ${sources[peer.source].join(' · ')}` : '';
      legend.textContent = `${card.peer.name}${values}`;
    }
  }

  function pointsFor(bond, field, color) {
    if (!bond) return [];
    const lines = new Map();
    for (const [date, quote] of bond.rows) {
      const index = dateIndices.get(date);
      if (index < from || !Number.isFinite(quote[field])) continue;
      const key = field === 'yield' ? sources[quote.source][1] : 'bid';
      if (!lines.has(key)) lines.set(key, []);
      lines.get(key).push({ index, quote: date, value: quote[field] });
    }
    return [...lines.values()].map(points => ({ color, maxGapDays: 45, points: points.sort((a, b) => a.index - b.index) }));
  }

  function priceLines(bond, observedColor, modelColor) {
    const observed = pointsFor(bond, 'bid', observedColor);
    const model = modeled.get(bond);
    const points = model ? [...model.points].flatMap(([quote, { price }]) => {
      const index = dateIndices.get(quote);
      return index >= from ? [{ index, quote, value: price }] : [];
    }) : [];
    if (!points.length) return observed;
    const last = points.at(-1), first = observed[0]?.points[0];
    const handoff = first && first.quote === model.firstBid && Date.parse(first.quote) - Date.parse(last.quote) <= 7 * 86400000;
    return [
      ...(handoff ? [{ color: '#84909e', dash: [2, 3], connector: true, maxGapDays: 7, points: [last, first] }] : []),
      { color: modelColor, dash: [5, 3], maxGapDays: 45, points },
      ...observed
    ];
  }

  function drawCard(card) {
    for (const canvas of card.element.querySelectorAll('[data-plot]')) {
      const field = canvas.dataset.plot;
      const data = card.series[field];
      const empty = !data.length || !dates.length;
      canvas.hidden = empty;
      canvas.nextElementSibling.hidden = !empty;
      if (empty) {
        card.positions[field] = null;
        continue;
      }
      const plotFrom = Math.min(...data.map(line => line.points[0].index));
      const axisSpan = Date.parse(dates.at(-1)) - Date.parse(dates[plotFrom]);
      const axis = axisSpan < 55 * 86400000 ? 'days' : axisSpan < 4 * 365 * 86400000 ? 'quarter' : 'year';
      const plot = StocksBeta2Charts.drawPlot(canvas, data, dateRows,
        { from: plotFrom, to: dates.length - 1, cursor, axis }, { axisGutter: 58 });
      card.positions[field] = plot && { ...plot, from: plotFrom };
    }
  }

  function fillReturns(card) {
    const returns = annualPriceChanges(card.instrument, dates[from], dates.at(-1));
    const table = card.element.querySelector('.bb-table');
    table.dataset.returnSymbol = card.key;
    table.dataset.returnCutoff = dates.at(-1) || '';
    const body = table.tBodies[0];
    body.replaceChildren(...returns.map(row => {
      const tr = document.createElement('tr');
      const title = document.createElement('th');
      title.scope = 'row'; title.textContent = row.year;
      tr.append(title);
      const change = Math.abs(row.change) < .005 ? 0 : row.change;
      [row.first.date, row.last.date, displayNumber(row.first.bid), displayNumber(row.last.bid), `${percent.format(change)}%`]
        .forEach(value => { const cell = tr.insertCell(); cell.textContent = value; });
      tr.lastElementChild.dataset.sign = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
      return tr;
    }));
    card.element.querySelector('.bb-table-wrap').hidden = !returns.length;
    card.element.querySelector('.bb-returns-empty').hidden = !!returns.length;
  }

  function chartPointer(event, card) {
    const position = card.positions[event.currentTarget.dataset.plot];
    if (!position || (event.type === 'pointermove' && event.pointerType === 'touch')) return;
    const x = event.clientX - event.currentTarget.getBoundingClientRect().left;
    let nearest = position.from;
    for (let i = position.from + 1; i < dates.length; i++) {
      if (Math.abs(position.forIndex(i) - x) < Math.abs(position.forIndex(nearest) - x)) nearest = i;
    }
    if (nearest !== cursor) setCursor(nearest);
  }

  function createCard(key) {
    const instrument = bonds.get(key);
    const element = get('template').content.firstElementChild.cloneNode(true);
    element.dataset.isin = instrument.isin;
    element.querySelector('h2').textContent = instrument.name;
    element.querySelector('.bb-id').textContent = `${instrument.isin} · ${instrument.currency}`;
    const margin = element.querySelector('[data-bb-ar]');
    if (instrument.ar !== null) {
      margin.hidden = false;
      margin.querySelector('strong').textContent = `${instrument.ar}%`;
    }
    const remove = element.querySelector('.bb-remove');
    remove.setAttribute('aria-label', `Remove ${instrument.name}`);
    remove.addEventListener('click', () => {
      selected = selected.filter(item => item !== key);
      populateControls(); renderCards(); get('add').focus();
    });
    const card = { key, instrument, element, near: false, positions: {} };
    for (const canvas of element.querySelectorAll('canvas')) {
      for (const event of ['pointermove', 'click']) canvas.addEventListener(event, e => chartPointer(e, card));
      canvas.addEventListener('keydown', event => {
        const start = card.positions[canvas.dataset.plot]?.from ?? from;
        const next = { ArrowLeft: Math.max(start, cursor - 1), ArrowRight: Math.max(start, cursor + 1), Home: start, End: dates.length - 1 }[event.key];
        if (next === undefined) return;
        event.preventDefault(); setCursor(next);
      });
    }
    return card;
  }

  function showSeries() {
    const peer = bonds.get(get('overlay').value);
    for (const card of cards) {
      card.peer = peer?.currency === card.instrument.currency && peer.isin !== card.instrument.isin ? peer : null;
      card.series = {
        bid: [...priceLines(card.instrument, '#147875', '#754298'), ...priceLines(card.peer, '#ac741d', '#a44c31')],
        yield: [...pointsFor(card.instrument, 'yield', '#536aa0'), ...pointsFor(card.peer, 'yield', '#ac741d')],
      };
      const model = modeled.get(card.instrument);
      const modelInRange = card.series.bid.some(line => line.color === '#754298');
      const peerInRange = card.series.bid.some(line => line.color === '#a44c31');
      const key = card.element.querySelector('.bb-price-key');
      key.hidden = !modelInRange && !peerInRange;
      key.querySelector('.bb-model-key').hidden = !modelInRange;
      key.querySelector('.bb-peer-model-key').hidden = !peerInRange;
      key.querySelector('.bb-bid-key').hidden = !card.series.bid.some(line => line.color === '#147875');
      if (modelInRange) key.querySelector('.bb-model-start').textContent = dateLabel(model.start);
      fillReturns(card);
    }
    queueRedraw();
  }

  function visibleInGroup(item) {
    if (group === 'all') return true;
    if (group === 'ust') return item.isTreasury || /^US TREASURY/i.test(item.name);
    if (group === 'temasek') return item.isin === temasek;
    return !item.isTreasury && !/^US TREASURY/i.test(item.name) && item.isin !== temasek;
  }

  function renderCards() {
    const deck = get('cards');
    visible.disconnect();
    cards = selected.filter(key => visibleInGroup(bonds.get(key))).map(createCard);
    deck.replaceChildren(...cards.map(card => card.element));
    for (const { element } of cards) visible.observe(element);
    get('empty').hidden = !!cards.length;
    showSeries();
  }

  function selectGroup(next) {
    group = next;
    document.querySelectorAll('[data-group]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.group === group)));
  }

  function refreshDates() {
    const previous = cursor < dates.length - 1 ? dates[cursor] : undefined;
    const unique = new Set();
    modeled = new Map();
    for (const item of bonds.values()) {
      for (const date of item.rows.keys()) unique.add(date);
      const model = curves.length ? reconstructedPrices(item, curves, window.DailyBondPrices) : null;
      if (!model) continue;
      modeled.set(item, model);
      for (const date of model.points.keys()) unique.add(date);
    }
    dates = [...unique].sort();
    dateIndices = new Map(dates.map((date, index) => [date, index]));
    dateRows = dates.map(date => ['', date, date]);
    cursor = dateIndices.get(previous) ?? Math.max(0, dates.length - 1);
    dateRange();
  }

  function applyData() {
    bonds = mergeHistory(publicBonds, localBonds);
    defaultKeys = [...publicBonds.keys()];
    if (!defaultKeys.length) defaultKeys = [...localBonds].filter(([, item]) => item.isin === temasek ||
      [...item.rows.values()].some(quote => ['WSJ_ASK','BSM_YTM','BSM_YTW'].includes(quote.source))).map(([key]) => key);
    defaultKeys.sort((a, b) => Number(b.startsWith(temasek)) - Number(a.startsWith(temasek)));
    selected = [...new Set([...defaultKeys, ...selected.filter(key => bonds.has(key))])];
    refreshDates();
    get('controls').hidden = !bonds.size;
    get('clear').hidden = !localBonds.size && !remembered;
    populateControls(); renderCards();
    updateStatus();
  }

  async function loadCurve() {
    const status = get('model-status');
    try {
      const response = await fetch('data/fred-daily.json', { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw Error('FRED history unavailable');
      const data = fredCurves(await response.json());
      if (!data.length || !window.DailyBondPrices?.cleanPrice || !window.DailyBondPrices?.offsetMonth) throw Error('FRED history has no usable curves');
      curves = data;
      refreshDates();
      showSeries();
      status.textContent = 'FRED estimates before a Treasury’s issue date are hypothetical. Saved bids are shown where available.';
    } catch {
      status.textContent = 'FRED price reconstruction is unavailable. Saved quotes are shown where available.';
    }
  }

  async function loadWatchlist() {
    get('retry').hidden = true;
    try {
      const response = await fetch(feedURL);
      if (!response.ok) throw Error('Watchlist not reachable');
      publicBonds = publicHistory(await response.json());
      publicUnavailable = false;
      applyData();
    } catch {
      publicUnavailable = true;
      updateStatus();
      get('retry').hidden = false;
    }
  }

  async function restoreHistory() {
    setHistoryBusy(true);
    try {
      const text = await historyStorage('get');
      if (text === undefined) return;
      remembered = true;
      try { localBonds = readHistory(text); showingSavedHistory = true; }
      catch { historyMessage = 'The saved history could not be read. Open a fresh copy of your history CSV.'; }
      applyData();
    } catch {
      // A browser with storage disabled can still open a CSV for this visit.
    } finally {
      setHistoryBusy(false);
    }
  }

  get('retry').addEventListener('click', loadWatchlist);
  get('open').addEventListener('click', () => get('file').click());
  get('file').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    setHistoryBusy(true);
    historyMessage = '';
    try {
      if (file.size > 25_000_000) throw Error('Choose a CSV smaller than 25 MB.');
      const text = await file.text();
      localBonds = readHistory(text);
      showingSavedHistory = false;
      try {
        await historyStorage('save', text);
        remembered = true;
        showingSavedHistory = true;
      } catch {
        historyMessage = remembered ? 'The browser kept its previous saved copy. The new file is open for this session.'
          : 'The browser could not save a copy.';
      }
      applyData();
    } catch (error) {
      historyMessage = error.message;
      updateStatus();
    } finally {
      event.target.value = '';
      setHistoryBusy(false);
    }
  });
  get('clear').addEventListener('click', async () => {
    setHistoryBusy(true);
    try {
      if (remembered) await historyStorage('delete');
      remembered = false;
      showingSavedHistory = false;
      historyMessage = '';
      localBonds.clear();
      applyData();
    } catch {
      historyMessage = 'The browser could not remove the saved history. Try again.';
      updateStatus();
    } finally { setHistoryBusy(false); }
  });
  get('search').addEventListener('input', populateControls);
  get('add').addEventListener('click', () => {
    const key = get('match').value;
    if (!bonds.has(key)) return;
    selected = [...new Set([key, ...selected])];
    selectGroup('all'); populateControls(); renderCards();
    cards[0]?.element.scrollIntoView({ block: 'nearest' });
  });
  get('range').addEventListener('change', () => { dateRange(); showSeries(); });
  get('overlay').addEventListener('change', showSeries);
  get('columns').addEventListener('change', () => { get('cards').dataset.columns = get('columns').value; });
  get('cursor').addEventListener('input', () => setCursor(Number(get('cursor').value)));
  get('reset').addEventListener('click', () => { selected = [...defaultKeys]; selectGroup('all'); populateControls(); renderCards(); });
  document.querySelectorAll('[data-group]').forEach(button => button.addEventListener('click', () => {
    selectGroup(button.dataset.group); renderCards();
  }));
  restoreHistory();
  loadWatchlist();
  loadCurve();
})();
