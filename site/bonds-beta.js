(() => {
  'use strict';

  const { sources, publicHistory, readHistory, mergeHistory, treasuryCatalogue, mergeCatalogue,
    annualPriceChanges, loadFredCurves, reconstructedPrices } = BondsBetaData;
  const feedURL = 'data/Bond%20Prices%20-%20Type%20JSON%20-%2016-Nov-03.10.json';
  const temasek = 'US87973RAW07';
  const get = id => document.getElementById(`bb-${id}`);
  const formatDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const dateLabel = date => date ? formatDate.format(new Date(`${date}T00:00:00Z`)) : '—';
  const decimal = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  const shortNumber = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 });
  const percent = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' });
  const displayNumber = value => Number.isFinite(value) ? decimal.format(value) : '—';
  const displayYield = value => Number.isFinite(value) ? `${displayNumber(value)}%` : '—';
  const tenor = value => value < 1 ? `${Math.round(value * 12)}M` : `${value}Y`;
  const quoteColors = { bid: '#147875', yield: '#536aa0' };
  const modelColor = '#754298', peerColor = '#ac741d', peerModelColor = '#a44c31';
  const noOverlay = () => new Option('No overlay', '');
  let publicBonds = new Map();
  let localBonds = new Map();
  let catalogue = new Map();
  let bonds = new Map();
  let curves = [];
  let modeled = new WeakMap();
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
  let pendingFocus;

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
      for (const card of cards) if (card.near) drawCard(card);
      for (const card of cards) {
        if (card.near || !card.pointReady) {
          updatePoint(card);
          card.pointReady = true;
        }
      }
    });
  }

  function populateControls() {
    const query = get('search').value.toUpperCase().trim().split(/\s+/).filter(Boolean);
    const pool = query.length ? [...bonds.keys()] : [...new Set([...defaultKeys, ...catalogue.keys()])];
    const matches = pool.filter(key => {
      const instrument = bonds.get(key);
      return query.every(term => `${instrument.isin} ${instrument.name} ${instrument.type ?? ''} ${instrument.currency}`.toUpperCase().includes(term));
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
    const model = modeled.get(card.instrument);
    const price = model?.points.get(date);
    const yieldEstimate = model?.yields.get(date);
    const priceLabel = card.element.querySelector('[data-bb-price-label]');
    const priceValue = card.element.querySelector('[data-bb-price]');
    priceLabel.textContent = price ? 'Theoretical price' : 'Bid price';
    priceLabel.toggleAttribute('data-theoretical', !!price);
    priceValue.textContent = displayNumber(price?.price ?? own?.bid);
    priceValue.toggleAttribute('data-theoretical', !!price);
    card.element.querySelector('[data-bb-yield-label]').textContent = yieldEstimate ? 'Modeled FRED yield' : 'Yield';
    card.element.querySelector('[data-bb-yield]').textContent = displayYield(yieldEstimate?.rate ?? own?.yield);
    const estimate = price ?? yieldEstimate;
    const detail = [date ? dateLabel(date) : 'No dated quotes available'];
    if (estimate) {
      const bracket = estimate.lower === estimate.upper ? tenor(estimate.lower) : `${tenor(estimate.lower)}–${tenor(estimate.upper)}`;
      detail.push(`${shortNumber.format(estimate.years)} years left`, `FRED ${bracket}`,
        `${displayYield(estimate.rate)} ${price ? 'applied yield' : 'modeled yield'}`);
      if (card.instrument.issueDate && date < card.instrument.issueDate) detail.push('Before issuance');
    }
    if (own) detail.push(...sources[own.source]);
    if (date && !own && !estimate) detail.push('No observation');
    card.element.querySelector('.bb-point').textContent = detail.join(' · ');
    const legend = card.element.querySelector('.bb-legend');
    legend.hidden = !card.peer;
    if (card.peer) {
      const peer = card.peer.rows.get(date), peerModel = modeled.get(card.peer);
      const peerPrice = peerModel?.points.get(date), peerYield = peerModel?.yields.get(date);
      const values = [card.peer.name];
      if (peerPrice) values.push(`Theoretical price ${displayNumber(peerPrice.price)}`);
      else if (Number.isFinite(peer?.bid)) values.push(`Bid ${displayNumber(peer.bid)}`);
      if (peerYield) values.push(`Modeled FRED yield ${displayYield(peerYield.rate)}`);
      else if (Number.isFinite(peer?.yield)) values.push(`Yield ${displayYield(peer.yield)}`);
      if (peer) values.push(...sources[peer.source]);
      legend.textContent = values.join(' · ');
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

  function historyLines(bond, field, observedColor, estimateColor) {
    const observed = pointsFor(bond, field, observedColor);
    const model = modeled.get(bond);
    if (!model) return observed;
    const isPrice = field === 'bid';
    const estimates = isPrice ? model.points : model.yields;
    const points = [...estimates].flatMap(([quote, estimate]) => {
      const index = dateIndices.get(quote);
      return index >= from ? [{ index, quote, value: isPrice ? estimate.price : estimate.rate }] : [];
    });
    if (!points.length) return observed;
    const firstSaved = isPrice ? model.firstBid : model.firstYield;
    const last = points.at(-1), first = observed.find(line => line.points[0].quote === firstSaved)?.points[0];
    const handoff = first && Date.parse(first.quote) - Date.parse(last.quote) <= 7 * 86400000;
    return [
      ...(handoff ? [{ color: '#84909e', dash: [2, 3], connector: true, maxGapDays: 7, points: [last, first] }] : []),
      { color: estimateColor, dash: [5, 3], maxGapDays: 45, points },
      ...observed
    ];
  }

  function drawCard(card) {
    for (const canvas of card.element.querySelectorAll('[data-plot]')) {
      const field = canvas.dataset.plot;
      const data = card.series[field];
      const empty = !data.length || !dates.length;
      const container = canvas.parentElement;
      container.hidden = empty;
      container.nextElementSibling.hidden = !empty;
      if (empty) {
        card.positions[field] = null;
        continue;
      }
      const width = canvas.clientWidth, height = canvas.clientHeight;
      let position = card.positions[field];
      if (!position || position.data !== data || position.width !== width || position.height !== height) {
        const plotFrom = Math.min(...data.map(line => line.points[0].index));
        const plotTo = Math.max(...data.map(line => line.points.at(-1).index));
        const axisSpan = Date.parse(dates[plotTo]) - Date.parse(dates[plotFrom]);
        const axis = axisSpan < 55 * 86400000 ? 'days' : axisSpan < 4 * 365 * 86400000 ? 'quarter' : 'year';
        // Plot the series once. The shared date marker updates independently.
        const plot = StocksBeta2Charts.drawPlot(canvas, data, dateRows,
          { from: plotFrom, to: plotTo, cursor: -1, axis }, { axisGutter: 58 });
        if (!plot) {
          card.positions[field] = null;
          continue;
        }
        const markers = new Map();
        for (const line of data) {
          if (line.connector) continue;
          for (const point of line.points) {
            if (!markers.has(point.index)) markers.set(point.index, []);
            markers.get(point.index).push({ y: plot.forValue(point.value) - plot.top, color: line.color });
          }
        }
        position = { ...plot, from: plotFrom, to: plotTo, data, width, height, markers };
        card.positions[field] = position;
        const indicator = canvas.nextElementSibling;
        indicator.style.top = plot.top + 'px';
        indicator.style.height = plot.bottom - plot.top + 'px';
      }
      if (position.cursor === cursor) continue;
      position.cursor = cursor;
      const indicator = canvas.nextElementSibling;
      indicator.hidden = cursor < position.from || cursor > position.to;
      if (indicator.hidden) continue;
      indicator.style.transform = `translateX(${position.forIndex(cursor)}px)`;
      indicator.replaceChildren(...(position.markers.get(cursor) ?? []).map(({ y, color }) => {
        const dot = document.createElement('span');
        dot.style.top = y + 'px';
        dot.style.backgroundColor = color;
        return dot;
      }));
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
    let low = position.from, high = position.to;
    while (high - low > 1) {
      const middle = Math.floor((low + high) / 2);
      if (position.forIndex(middle) < x) low = middle;
      else high = middle;
    }
    const nearest = Math.abs(position.forIndex(high) - x) < Math.abs(position.forIndex(low) - x) ? high : low;
    if (nearest !== cursor) setCursor(nearest);
  }

  function createCard(key) {
    const instrument = bonds.get(key);
    const element = get('template').content.firstElementChild.cloneNode(true);
    element.dataset.isin = instrument.isin;
    element.querySelector('h2').textContent = instrument.name;
    element.querySelector('.bb-id').textContent = [instrument.isin, instrument.currency,
      instrument.issueDate ? `Issued ${dateLabel(instrument.issueDate)}` : ''].filter(Boolean).join(' · ');
    const margin = element.querySelector('[data-bb-ar]');
    if (instrument.ar !== null) {
      margin.hidden = false;
      margin.querySelector('strong').textContent = `${instrument.ar}%`;
    }
    const remove = element.querySelector('.bb-remove');
    remove.setAttribute('aria-label', `Remove ${instrument.name}`);
    remove.addEventListener('click', () => {
      selected = selected.filter(item => item !== key);
      populateControls(); refreshDates(); renderCards(); get('add').focus();
    });
    const card = { key, instrument, element, near: false, positions: {} };
    for (const canvas of element.querySelectorAll('canvas')) {
      for (const event of ['pointermove', 'click']) canvas.addEventListener(event, e => chartPointer(e, card));
      canvas.addEventListener('keydown', event => {
        const position = card.positions[canvas.dataset.plot];
        if (!position) return;
        const { from: start, to: end } = position;
        const next = { ArrowLeft: Math.min(end, Math.max(start, cursor - 1)),
          ArrowRight: Math.min(end, Math.max(start, cursor + 1)), Home: start, End: end }[event.key];
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
      card.series = {};
      for (const key of card.element.querySelectorAll('[data-series-key]')) {
        const field = key.dataset.seriesKey;
        const lines = [...historyLines(card.instrument, field, quoteColors[field], modelColor),
          ...historyLines(card.peer, field, peerColor, peerModelColor)];
        card.series[field] = lines;
        const modelInRange = lines.some(line => line.color === modelColor);
        const peerInRange = lines.some(line => line.color === peerModelColor);
        key.hidden = !modelInRange && !peerInRange;
        key.querySelector('.bb-model-key').hidden = !modelInRange;
        key.querySelector('.bb-peer-model-key').hidden = !peerInRange;
        key.querySelector('.bb-observed-key').hidden = !lines.some(line => line.color === quoteColors[field]);
      }
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
    const previous = new Map(cards.map(card => [card.key, card]));
    cards = selected.filter(key => visibleInGroup(bonds.get(key))).map(key => {
      const card = previous.get(key);
      return card?.instrument === bonds.get(key) ? card : createCard(key);
    });
    const present = new Set(cards);
    for (const card of previous.values()) {
      if (present.has(card)) continue;
      visible.unobserve(card.element);
      card.element.remove();
    }
    cards.forEach((card, index) => {
      if (deck.children[index] !== card.element) deck.insertBefore(card.element, deck.children[index] ?? null);
      if (!present.has(previous.get(card.key))) visible.observe(card.element);
    });
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
    for (const key of new Set([...selected, get('overlay').value])) {
      const item = bonds.get(key);
      if (!item) continue;
      for (const date of item.rows.keys()) unique.add(date);
      if (curves.length && !modeled.has(item)) modeled.set(item, reconstructedPrices(item, curves, window.DailyBondPrices));
      const model = modeled.get(item);
      if (!model) continue;
      for (const date of model.points.keys()) unique.add(date);
      for (const date of model.yields.keys()) unique.add(date);
    }
    dates = [...unique].sort();
    dateIndices = new Map(dates.map((date, index) => [date, index]));
    dateRows = dates.map(date => ['', date, date]);
    cursor = dateIndices.get(previous) ?? Math.max(0, dates.length - 1);
    dateRange();
  }

  function applyData() {
    bonds = mergeCatalogue(mergeHistory(publicBonds, localBonds), catalogue);
    const previousDefaults = new Set(defaultKeys);
    defaultKeys = [...publicBonds.keys()];
    if (!defaultKeys.length) defaultKeys = [...localBonds].filter(([, item]) => item.isin === temasek ||
      [...item.rows.values()].some(quote => ['WSJ_ASK','BSM_YTM','BSM_YTW'].includes(quote.source))).map(([key]) => key);
    defaultKeys.sort((a, b) => Number(b.startsWith(temasek)) - Number(a.startsWith(temasek)));
    selected = [...new Set([...selected.filter(key => bonds.has(key)), ...defaultKeys.filter(key => !previousDefaults.has(key))])];
    get('controls').hidden = !bonds.size;
    get('clear').hidden = !localBonds.size && !remembered;
    populateControls(); refreshDates(); renderCards();
    updateStatus();
  }

  function inspectLatest(key) {
    const bond = bonds.get(key);
    if (!bond) return false;
    const model = modeled.get(bond);
    // Prefer a price date so a newly added Treasury opens with its latest theoretical price or saved bid.
    const prices = [...bond.rows].filter(([, quote]) => quote.bid > 0).map(([date]) => date);
    if (model) prices.push(...model.points.keys());
    const latest = (prices.length ? prices : [...bond.rows.keys(), ...(model?.yields.keys() ?? [])]).sort().at(-1);
    const index = dateIndices.get(latest);
    if (index === undefined) return false;
    if (index < from) {
      get('range').value = 'all';
      dateRange();
      showSeries();
    }
    setCursor(index);
    return true;
  }

  async function loadCatalogue() {
    const status = get('catalogue-status');
    try {
      const response = await fetch('data/treasury-catalogue.json', { cache: 'no-cache', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw Error('Treasury catalogue unavailable');
      const data = await response.json();
      const verified = treasuryCatalogue(data);
      const asOf = data.latest_auction_date;
      catalogue = new Map([...verified].sort(([, a], [, b]) => {
        const activeA = a.maturity > asOf, activeB = b.maturity > asOf;
        return Number(activeB) - Number(activeA) ||
          (activeA ? a.maturity.localeCompare(b.maturity) : b.maturity.localeCompare(a.maturity));
      }));
      applyData();
      status.textContent = `${catalogue.size.toLocaleString('en-GB')} fixed-rate U.S. Treasury notes and bonds · Auction data through ${dateLabel(asOf)}.`;
    } catch {
      status.textContent = 'The TreasuryDirect catalogue could not load. Watchlist and imported bonds are still available.';
    }
  }

  function readCurveInBackground() {
    if (!window.Worker) return loadFredCurves();
    let worker;
    try {
      worker = new Worker('bonds-beta-curves-worker.js?v=20261122.performance1');
    } catch {
      return loadFredCurves();
    }
    return new Promise((resolve, reject) => {
      worker.onmessage = ({ data }) => {
        worker.terminate();
        if (data.error) reject(Error(data.error));
        else resolve(data.curves);
      };
      worker.onerror = () => {
        worker.terminate();
        resolve(loadFredCurves());
      };
    });
  }

  async function loadCurve() {
    const status = get('model-status');
    try {
      const data = await readCurveInBackground();
      if (!data.length || !window.DailyBondPrices?.cleanPrice || !window.DailyBondPrices?.offsetMonth) throw Error('FRED history has no usable curves');
      curves = data;
      modeled = new WeakMap();
      refreshDates();
      showSeries();
      if (pendingFocus) inspectLatest(pendingFocus);
      pendingFocus = undefined;
      status.textContent = 'FRED estimates before a Treasury’s issue date are hypothetical. The charts show saved bids and reported yields where available.';
    } catch {
      status.textContent = 'FRED price and yield reconstruction is unavailable. Saved quotes are shown where available.';
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
    selectGroup('all'); populateControls(); refreshDates(); renderCards();
    pendingFocus = !inspectLatest(key) && !curves.length ? key : undefined;
    cards[0]?.element.scrollIntoView({ block: 'nearest' });
  });
  get('range').addEventListener('change', () => { dateRange(); showSeries(); });
  get('overlay').addEventListener('change', () => { refreshDates(); showSeries(); });
  get('columns').addEventListener('change', () => { get('cards').dataset.columns = get('columns').value; });
  get('cursor').addEventListener('input', () => setCursor(Number(get('cursor').value)));
  get('reset').addEventListener('click', () => { selected = [...defaultKeys]; selectGroup('all'); populateControls(); refreshDates(); renderCards(); });
  document.querySelectorAll('[data-group]').forEach(button => button.addEventListener('click', () => {
    selectGroup(button.dataset.group); renderCards();
  }));
  restoreHistory();
  loadWatchlist();
  loadCatalogue();
  loadCurve();
})();
