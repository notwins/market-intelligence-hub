(() => {
  'use strict';

  const { sources, publicHistory, readHistory, mergeHistory, annualPriceChanges } = BondsBetaData;
  const feedURL = 'data/Bond%20Prices%20-%20Type%20JSON%20-%2016-Nov-03.10.json';
  const temasek = 'US87973RAW07';
  const get = id => document.getElementById(`bb-${id}`);
  const formatDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const dateLabel = date => date ? formatDate.format(new Date(`${date}T00:00:00Z`)) : '—';
  const decimal = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  const percent = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' });
  const displayNumber = value => Number.isFinite(value) ? decimal.format(value) : '—';
  const noOverlay = () => new Option('No overlay', '');
  let publicBonds = new Map();
  let localBonds = new Map();
  let bonds = new Map();
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
      status = `${publicBonds.size} default bonds · Saved public quotes through ${dateLabel(dates.at(-1))}. Open and remember your CSV once for the full history and ACE rates.`;
    } else if (publicUnavailable) {
      status = 'The public watchlist could not load. Retry or open a Bonds BETA history CSV.';
    }
    get('status').textContent = [status, historyMessage].filter(Boolean).join(' ');
  }

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
    const peer = card.peer?.rows.get(date);
    card.element.querySelector('[data-bb-price]').textContent = displayNumber(own?.bid);
    card.element.querySelector('[data-bb-yield]').textContent = Number.isFinite(own?.yield) ? `${displayNumber(own.yield)}%` : '—';
    const detail = own ? `${dateLabel(date)} · ${sources[own.source].join(' · ')}`
      : date ? `${dateLabel(date)} · No observation` : 'No dated quotes available';
    card.element.querySelector('.bb-point').textContent = detail;
    const legend = card.element.querySelector('.bb-legend');
    legend.hidden = !card.peer;
    if (card.peer) {
      const values = peer ? ` · Bid ${displayNumber(peer.bid)} · Yield ${Number.isFinite(peer.yield) ? `${displayNumber(peer.yield)}%` : '—'} · ${sources[peer.source].join(' · ')}` : '';
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
    return [...lines.values()].map(points => ({ color, points: points.sort((a, b) => a.index - b.index) }));
  }

  function drawCard(card) {
    const axisSpan = Date.parse(dates.at(-1)) - Date.parse(dates[from]);
    const axis = axisSpan < 55 * 86400000 ? 'days' : axisSpan < 4 * 365 * 86400000 ? 'quarter' : 'year';
    for (const canvas of card.element.querySelectorAll('[data-plot]')) {
      const field = canvas.dataset.plot;
      const data = card.series[field];
      const empty = !data.length || !dates.length;
      canvas.hidden = empty;
      canvas.nextElementSibling.hidden = !empty;
      card.positions[field] = empty ? null : StocksBeta2Charts.drawPlot(canvas, data, dateRows,
        { from, to: dates.length - 1, cursor, axis }, { axisGutter: 58 });
    }
  }

  function fillReturns(card) {
    const returns = annualPriceChanges(card.instrument, dates[from], dates.at(-1));
    const body = card.element.querySelector('tbody');
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
    let nearest = from;
    for (let i = from + 1; i < dates.length; i++) {
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
        const next = { ArrowLeft: cursor - 1, ArrowRight: cursor + 1, Home: from, End: dates.length - 1 }[event.key];
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
        bid: [...pointsFor(card.instrument, 'bid', '#147875'), ...pointsFor(card.peer, 'bid', '#ac741d')],
        yield: [...pointsFor(card.instrument, 'yield', '#536aa0'), ...pointsFor(card.peer, 'yield', '#ac741d')],
      };
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

  function applyData() {
    bonds = mergeHistory(publicBonds, localBonds);
    defaultKeys = [...publicBonds.keys()];
    if (!defaultKeys.length) defaultKeys = [...localBonds].filter(([, item]) => item.isin === temasek ||
      [...item.rows.values()].some(quote => ['WSJ_ASK','BSM_YTM','BSM_YTW'].includes(quote.source))).map(([key]) => key);
    defaultKeys.sort((a, b) => Number(b.startsWith(temasek)) - Number(a.startsWith(temasek)));
    selected = [...new Set([...defaultKeys, ...selected.filter(key => bonds.has(key))])];
    const unique = new Set();
    for (const item of bonds.values()) for (const date of item.rows.keys()) unique.add(date);
    dates = [...unique].sort();
    dateIndices = new Map(dates.map((date, index) => [date, index]));
    dateRows = dates.map(date => ['', date, date]);
    cursor = Math.max(0, dates.length - 1);
    get('controls').hidden = !bonds.size;
    get('clear').hidden = !localBonds.size && !remembered;
    populateControls(); dateRange(); renderCards();
    updateStatus();
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
})();
