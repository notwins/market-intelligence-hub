/* Opt-in price history for tables with historical security returns. */
(function (root) {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const years = [1, 2, 3, 4, 5];
  const dateOK = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '');
  function instrument(symbol, currency = '', cutoff = '', provider = '') {
    return symbol ? `data-return-symbol="${escape(symbol)}" data-return-currency="${escape(currency)}"${
      dateOK(cutoff) ? ` data-return-cutoff="${escape(cutoff)}"` : ''
    }${provider ? ` data-return-provider="${escape(provider)}"` : ''}` : '';
  }
  function listing(item, cutoff = '') {
    const price = root.ShareEnrichment?.priceItemFor?.(item);
    return instrument(price?.id || price?.ticker || item?.marketTicker || item?.instrumentId ||
      item?.ticker || (typeof item === 'string' ? item : ''), price?.currency || item?.currency, cutoff);
  }
  function windowPoints(points, range, cutoff) {
    const end = dateOK(cutoff) && Number.isFinite(Date.parse(cutoff)) ? cutoff : points.at(-1)?.[0];
    if (!end) return { points: [], from: '' };
    const start = new Date(end + 'T12:00:00Z');
    const month = start.getUTCMonth();
    start.setUTCFullYear(start.getUTCFullYear() - range);
    if (start.getUTCMonth() !== month) start.setUTCDate(0);
    const from = start.toISOString().slice(0, 10);
    return { from, points: points.filter(([date]) => date >= from && date <= end) };
  }

  const providers = new Map();
  function register(name, load) {
    providers.set(name, load);
  }

  async function marketHistory(info) {
    const market = root.MarketPrices;
    if (!market) return null;
    const { item, base, daily } = await market.series(info.symbol);
    if (info.currency && item.currency !== info.currency) return null;
    return {
      points: market.selectPoints(base, daily, '0001-01-01', '9999-12-31'),
      name: item.ticker, unit: market.displayUnit(item), basis: market.priceBasis(item),
      source: item.history_url, note: base.period_note, label: 'closing prices'
    };
  }

  root.ReturnSparks = { instrument, listing, register, windowPoints };
  if (typeof module !== 'undefined') module.exports = root.ReturnSparks;
  const doc = root.document;
  if (!doc) return;

  const selector = 'table[data-return-sparks]';
  const settings = new Map();
  const mounted = new Map();
  const buttons = new WeakMap();
  const number = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 4 });
  let dialog, opener, pending = false;

  function node(tag, className, text) {
    const element = doc.createElement(tag);
    element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  function label(info) {
    return info.symbol + (info.currency ? ' · ' + info.currency : '');
  }

  function sparkline(points) {
    const values = points.map(p => p[1]);
    const min = Math.min(...values), max = Math.max(...values);
    const first = Date.parse(points[0][0]), span = Date.parse(points.at(-1)[0]) - first || 1;
    const step = Math.max(1, Math.ceil(points.length / 104));
    const selected = points.filter((_, index) => index % step === 0 || index === points.length - 1);
    const path = selected.map(([date, value]) => {
      const x = 4 + 104 * (Date.parse(date) - first) / span;
      const y = max === min ? 16 : 28 - 24 * (value - min) / (max - min);
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    return `<svg class="rs-spark" viewBox="0 0 112 32" aria-hidden="true" focusable="false"><polyline points="${path}"/></svg>`;
  }

  async function paintSpark(button) {
    const entry = buttons.get(button);
    if (!entry || !button.isConnected) return;
    try {
      const load = entry.info.provider ? providers.get(entry.info.provider) : marketHistory;
      const data = await load?.(entry.info);
      const points = data?.points?.filter(p => dateOK(p[0]) && Number.isFinite(p[1])) || [];
      const range = windowPoints(points, entry.range, entry.info.cutoff);
      if (!button.isConnected) return;
      if (range.points.length < 2) throw Error('Insufficient dated prices');
      entry.data = { ...data, points };
      button.title = `${data.name || label(entry.info)} · ${range.points[0][0]} to ${range.points.at(-1)[0]} · ${data.unit || 'Price'}`;
      button.setAttribute('aria-label', 'Open ' + (data.name || label(entry.info)) + ' price history · ' + entry.range + ' years');
      button.setAttribute('aria-haspopup', 'dialog');
      button.innerHTML = sparkline(range.points);
      button.disabled = false;
    } catch {
      if (!button.isConnected) return;
      button.textContent = 'Unavailable';
      button.title = 'Fewer than two validated price observations for ' + label(entry.info) + ' in this window.';
      button.setAttribute('aria-label', button.title);
    }
  }

  const visible = root.IntersectionObserver ? new root.IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      visible.unobserve(entry.target);
      void paintSpark(entry.target);
    }
  }, { rootMargin: '100px' }) : null;

  function clearSparks(state) {
    for (const button of state.sparks.values()) {
      visible?.unobserve(button);
      button.remove();
    }
    state.sparks.clear();
  }

  function readInstrument(owner, table) {
    return {
      symbol: owner.dataset.returnSymbol,
      currency: owner.dataset.returnCurrency || '',
      cutoff: owner.dataset.returnCutoff || table.dataset.returnCutoff || '',
      provider: owner.dataset.returnProvider || table.dataset.returnProvider || ''
    };
  }

  function addSpark(table, state, owner, target) {
    if (!target || state.sparks.has(owner)) return;
    const info = readInstrument(owner, table);
    const button = node('button', 'rs-button', 'Loading…');
    button.type = 'button';
    button.disabled = true;
    button.dataset.returnUi = '';
    button.dataset.tcUi = '';
    button.setAttribute('aria-label', 'Loading ' + label(info) + ' price history');
    buttons.set(button, { info, range: state.options.range });
    target.append(button);
    state.sparks.set(owner, button);
    if (visible) visible.observe(button);
    else void paintSpark(button);
  }

  function update(table, state) {
    state.bar.hidden = table.hidden || table.parentElement?.hidden;
    state.toggle.checked = state.options.enabled;
    state.period.hidden = !state.options.enabled;
    state.period.querySelector('select').value = state.options.range;
    state.note.hidden = !state.options.enabled;
    for (const [owner, button] of state.sparks) {
      const old = buttons.get(button).info;
      const next = readInstrument(owner, table);
      if (button.isConnected && table.contains(owner) && Object.keys(old).every(key => old[key] === next[key])) continue;
      visible?.unobserve(button);
      button.remove();
      state.sparks.delete(owner);
    }
    if (!state.options.enabled) return;
    if (table.dataset.returnSymbol) {
      addSpark(table, state, table, state.single);
      return;
    }
    for (const row of table.querySelectorAll(':scope > tbody > tr[data-return-symbol]')) {
      addSpark(table, state, row, row.querySelector('th[scope="row"]') || row.cells[0]);
    }
  }

  function mount(table) {
    const current = mounted.get(table);
    const key = [table.dataset.returnSparks, table.dataset.returnSymbol || '', table.dataset.returnCurrency || ''].join('|');
    const signature = JSON.stringify(table.dataset);
    if (current?.signature === signature) return update(table, current);
    if (current) { clearSparks(current); current.bar.remove(); }
    const options = { ...(settings.get(key) || { enabled: false, range: 1 }) };
    const bar = node('div', 'rs-tools');
    bar.dataset.returnUi = '';
    bar.innerHTML = `<div class="rs-controls"><label><input type="checkbox"> Price sparklines</label>
      <label class="rs-period" hidden>Price history <select aria-label="Sparkline period">${years.map(year =>
        `<option value="${year}">${year}Y</option>`).join('')}</select></label><span class="rs-single"></span></div>
      <p class="rs-note" hidden>Click a price sparkline to expand it. The table retains its own return basis.</p>`;
    const toggle = bar.querySelector('input'), period = bar.querySelector('.rs-period');
    const state = { bar, toggle, period, options, note: bar.querySelector('.rs-note'), single: bar.querySelector('.rs-single'), sparks: new Map(), signature };
    mounted.set(table, state);
    bar.addEventListener('change', () => {
      options.enabled = toggle.checked;
      options.range = Number(period.querySelector('select').value);
      settings.set(key, options);
      clearSparks(state);
      update(table, state);
    });
    const wrapper = table.parentElement;
    if (wrapper?.parentElement) wrapper.before(bar);
    update(table, state);
  }

  function scan() {
    pending = false;
    for (const [table, state] of mounted) {
      if (table.isConnected && table.matches(selector)) continue;
      clearSparks(state);
      state.bar.remove();
      mounted.delete(table);
    }
    doc.querySelectorAll(selector).forEach(mount);
  }

  function schedule(records) {
    if (pending || !records.some(({target, addedNodes, removedNodes}) =>
      !target.closest?.('[data-return-ui]') && (mounted.has(target) || target.closest?.(selector) ||
        [...addedNodes, ...removedNodes].some(n => n.matches?.(selector) || n.querySelector?.(selector))
      ))) return;
    pending = true;
    root.requestAnimationFrame(scan);
  }

  function showHistory(entry, origin) {
    if (!dialog) {
      dialog = node('dialog', 'mp-chart-dialog rs-dialog');
      dialog.setAttribute('aria-labelledby', 'rs-title');
      dialog.dataset.returnUi = '';
      dialog.addEventListener('close', () => { if (opener?.isConnected) opener.focus({ preventScroll: true }); });
      doc.body.append(dialog);
    }
    opener = origin;
    const data = entry.data, name = data.name || label(entry.info);
    dialog.innerHTML = `<form method="dialog" class="mp-dialog-head"><h2 id="rs-title">${escape(name)} · ${escape(data.label || 'price history')}</h2>
      <button value="close" aria-label="Close price history">Close ×</button></form>
      <label class="rs-dialog-period">Price history <select aria-label="Price history period">${years.map(year =>
        `<option value="${year}" ${year === entry.range ? 'selected' : ''}>${year}Y</option>`).join('')}</select></label><div class="rs-chart"></div>`;
    const select = dialog.querySelector('select'), chart = dialog.querySelector('.rs-chart');
    function render() {
      const { points, from } = windowPoints(data.points, Number(select.value), entry.info.cutoff);
      if (points.length < 2) {
        chart.innerHTML = '<p role="status">Price history is unavailable for this window.</p>';
        return;
      }
      const first = points[0], last = points.at(-1);
      const source = root.MarketPrices.sourceUrl(data.source);
      chart.innerHTML = `<p><strong>${first[0]} to ${last[0]}</strong> · ${escape(data.unit || 'Price')}${first[0] > from ? ' · available history' : ''}</p>
        ${root.MarketPrices.svg([{ name, points }], [], [], { expanded: true, width: dialog.clientWidth, seriesLabel: data.label })}
        <p>${number.format(first[1])} → ${number.format(last[1])} ${escape(data.unit || '')}. ${escape(data.basis || '')}</p>
        ${data.note ? `<p>${escape(data.note)}</p>` : ''}
        ${source ? `<p><a href="${escape(source)}" target="_blank" rel="noopener noreferrer">Price source</a></p>` : ''}`;
    }
    select.addEventListener('change', render);
    if (!dialog.open) dialog.showModal();
    render();
  }

  doc.addEventListener('click', event => {
    const button = event.target.closest('.rs-button');
    const entry = buttons.get(button);
    if (entry?.data) showHistory(entry, button);
  });
  function start() {
    scan();
    new root.MutationObserver(schedule).observe(doc.body, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ['data-return-symbol', 'data-return-currency', 'data-return-cutoff', 'data-return-sparks', 'data-return-provider']
    });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(typeof window !== 'undefined' ? window : globalThis);
