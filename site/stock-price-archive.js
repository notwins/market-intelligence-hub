(function (root) {
  'use strict';

  const changed = 'stock-price-archive-updated';
  const store = 'archives';
  const key = 'closing-prices';
  const maxBytes = 32 * 1024 * 1024;
  const identity = (value, currency) => `${value}|${currency}`;

  function parseArchive(data) {
    const dateCache = new Map();
    function validDay(day) {
      if (dateCache.has(day)) return dateCache.get(day);
      const time = typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) ? Date.parse(day) : NaN;
      const valid = Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === day;
      dateCache.set(day, valid);
      return valid;
    }
    if (data?.format !== 'mih-stock-price-archive' || data.version !== 1 ||
        data.source !== 'Yahoo Finance Close' || !validDay(data.asOf) ||
        !Array.isArray(data.listings) || !data.listings.length || data.listings.length > 200) {
      throw new Error('Choose a Market Intel stock price archive JSON.');
    }
    const listings = new Map(), symbols = new Map();
    let count = 0;
    for (const record of data.listings) {
      const { listing, symbol, currency, prior, closes } = record || {};
      if (typeof listing !== 'string' || !/^[A-Z0-9./-]{1,16} [A-Z]{2}$/.test(listing) ||
          typeof symbol !== 'string' || !/^[A-Z0-9.-]{1,20}$/.test(symbol) ||
          typeof currency !== 'string' || !/^(?:[A-Z]{3}|GBp)$/.test(currency) ||
          (prior !== null && (!validDay(prior?.before) || prior.before > data.asOf ||
            typeof prior.label !== 'string' || !prior.label.trim() || prior.label.length > 80)) ||
          !Array.isArray(closes) || !closes.length || closes.length > 8000) {
        throw new Error('The price archive contains an invalid listing.');
      }
      const listingKey = identity(listing, currency), symbolKey = identity(symbol, currency);
      if (listings.has(listingKey) || symbols.has(symbolKey)) throw new Error('The price archive contains a duplicate listing.');
      let previous = '';
      for (const point of closes) {
        if (!Array.isArray(point) || point.length !== 2 || !validDay(point[0]) || point[0] <= previous ||
            point[0] > data.asOf || !Number.isFinite(point[1]) || point[1] <= 0) {
          throw new Error('The price archive contains an invalid close or date.');
        }
        previous = point[0];
      }
      count += closes.length;
      if (count > 1000000) throw new Error('The price archive contains too many closes.');
      listings.set(listingKey, record);
      symbols.set(symbolKey, record);
    }
    return { data, listings, symbols };
  }

  const api = { parseArchive };
  if (typeof module !== 'undefined') module.exports = api;
  if (!root.document) return;

  let snapshot = null, storageError = false, readyPromise, busy = false;
  const doc = root.document;
  const channel = typeof root.BroadcastChannel === 'function' ? new root.BroadcastChannel('mih-stock-price-archive') : null;

  function access(mode, action) {
    return new Promise((resolve, reject) => {
      const request = root.indexedDB.open('mih-stock-price-archive', 1);
      request.onupgradeneeded = () => request.result.createObjectStore(store);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(store, mode);
        const operation = action(transaction.objectStore(store));
        transaction.oncomplete = () => { db.close(); resolve(operation.result); };
        transaction.onabort = () => { db.close(); reject(transaction.error || operation.error); };
      };
    });
  }

  function paint(message) {
    for (const panel of doc.querySelectorAll('[data-price-archive-import]')) {
      panel.querySelector('input').disabled = busy;
      const clear = panel.querySelector('[data-price-archive-clear]');
      clear.hidden = !snapshot;
      clear.disabled = busy;
      panel.querySelector('[data-price-archive-status]').textContent = message || (snapshot
        ? `${snapshot.listings.size} listings loaded · saved closes through ${snapshot.data.asOf}`
        : storageError ? 'Browser storage is unavailable.' : 'No price archive loaded.');
    }
  }

  function publish(next) {
    snapshot = next;
    storageError = false;
    paint();
    doc.dispatchEvent(new root.CustomEvent(changed));
  }

  async function reload() {
    try {
      const saved = await access('readonly', records => records.get(key));
      publish(saved ? parseArchive(saved) : null);
    } catch {
      storageError = true;
      paint();
    }
  }

  function ready() {
    return readyPromise ??= reload();
  }

  root.StockPriceArchive = Object.assign(api, {
    ready, changed,
    byListing: (listing, currency) => snapshot?.listings.get(identity(listing, currency)),
    bySymbol: (symbol, currency) => snapshot?.symbols.get(identity(symbol, currency)),
  });

  channel?.addEventListener('message', () => { if (!busy) reload(); });
  for (const panel of doc.querySelectorAll('[data-price-archive-import]')) {
    const input = panel.querySelector('input');
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file || busy) return;
      busy = true;
      paint('Checking the price archive…');
      try {
        if (file.size > maxBytes) throw new Error('Choose a price archive smaller than 32 MB.');
        let data;
        try { data = JSON.parse(await file.text()); } catch { throw new Error('Choose a valid price archive JSON.'); }
        const next = parseArchive(data);
        await ready();
        await access('readwrite', records => records.put(next.data, key));
        publish(next);
        channel?.postMessage('updated');
      } catch (error) {
        paint(error instanceof Error && error.name === 'Error' ? error.message : 'The archive could not be saved in this browser.');
        return;
      } finally {
        busy = false;
        const message = panel.querySelector('[data-price-archive-status]').textContent;
        paint(message);
        input.value = '';
      }
    });
    panel.querySelector('[data-price-archive-clear]').addEventListener('click', async () => {
      if (busy || !snapshot) return;
      busy = true;
      paint('Removing the browser copy…');
      try {
        await access('readwrite', records => records.delete(key));
        publish(null);
        channel?.postMessage('updated');
      } catch {
        paint('The browser copy could not be removed.');
      } finally {
        busy = false;
        paint(panel.querySelector('[data-price-archive-status]').textContent);
      }
    });
  }
  ready();
})(typeof window !== 'undefined' ? window : globalThis);
