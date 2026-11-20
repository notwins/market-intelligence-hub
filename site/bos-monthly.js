(function () {
  'use strict';

  const byId = id => document.getElementById(id);
  const status = byId('sb2-status');
  const retry = byId('bos-retry');
  const workspace = byId('bos-history');
  const search = byId('bos-search');
  const menu = byId('sb2-securities');
  const body = byId('bos-observations');
  const details = byId('bos-links');
  const equity = window.BOSEquity;

  const number = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 10 });
  const percent = new Intl.NumberFormat('en-GB', {
    style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  let data, selected, dailyChecked = false;

  function validate(archive) {
    if (archive?.kind !== 'mih-bos-monthly-public' || archive.version !== 1
        || !Array.isArray(archive.months) || !archive.months.length
        || !Array.isArray(archive.listings) || !archive.listings.length) {
      throw Error('Invalid BOS monthly archive.');
    }

    let previousMonth = '';
    for (const [month, report, quote] of archive.months) {
      if (!/^\d{4}-\d{2}$/.test(month) || month <= previousMonth || !date(report) || !date(quote) || quote > report) {
        throw Error('Invalid BOS report calendar.');
      }
      previousMonth = month;
    }

    let count = 0;
    const keys = new Set();
    for (const listing of archive.listings) {
      const [ticker, unit, observations, isin] = listing;
      const key = ticker + '|' + unit;
      if (listing.length !== 4 || typeof ticker !== 'string' || !ticker
          || !/^[A-Za-z]{3}$/.test(unit) || keys.has(key)
          || !Array.isArray(observations) || !observations.length
          || (isin !== null && !/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin))) {
        throw Error('Invalid BOS listing.');
      }
      keys.add(key);
      let previous = -1;
      for (const point of observations) {
        const [index, price, eps, call, target, gap, pct] = point;
        if (point.length !== 7 || !Number.isInteger(index) || index <= previous || index >= archive.months.length
            || !finite(price) || price <= 0 || !finite(eps) || eps <= 0 || typeof call !== 'string'
            || (finite(target) ? target < 0 || !finite(gap) || !finite(pct)
              : typeof target !== 'string' || gap !== null || pct !== null)) {
          throw Error('Invalid BOS monthly observation.');
        }
        previous = index;
      }
      count += observations.length;
    }
    if (count !== archive.observationCount) throw Error('BOS observation count does not match.');
    return archive;
  }

  function item(tag, message) {
    const element = document.createElement(tag);
    element.textContent = message;
    return element;
  }

  function display(value, formatter = number) {
    return finite(value) ? formatter.format(value) : value ?? '—';
  }

  function paintList() {
    const q = search.value.trim().toUpperCase();
    const visible = data.listings.filter(([ticker, unit]) => (ticker + ' ' + unit).toUpperCase().includes(q));
    byId('bos-empty').hidden = visible.length > 0;
    menu.replaceChildren(...visible.map(listing => {
      const node = item('li', '');
      const button = item('button', listing[0] + ' · ' + listing[1]);
      button.type = 'button';
      button.className = 'sb2-security';
      button.setAttribute('aria-pressed', String(listing === selected));
      button.addEventListener('click', () => {
        selected = listing;
        menu.querySelector('[aria-pressed="true"]')?.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-pressed', 'true');
        paintTable();
      });
      node.append(button);
      return node;
    }));
  }

  function paintSources() {
    if (!selected) return;
    const [ticker, unit, , isin] = selected;
    const daily = equity?.valuationById(ticker);
    let message = dailyChecked ? 'No verified quote for this ticker and quote unit' : 'Checking published edition…';
    if (daily?.row.currency === unit) {
      const row = daily.row;
      message = daily.reportDate + ' edition, ' + row.priceAsOf + ' quote · '
        + display(row.price) + ' ' + unit + ' · ' + display(row.rating) + ' · '
        + equity.valuationLabel(row) + ' ' + display(row.fairValueOrTargetPrice);
    }
    details.replaceChildren(
      item('li', 'Bloomberg · ' + (isin ? isin + ' · snapshot quote date unverified' : 'No verified listing match')),
      item('li', 'BOS Daily · ' + message)
    );
  }

  function paintTable() {
    const [ticker, unit, observations] = selected;
    byId('bos-listing').textContent = ticker + ' · ' + unit;
    byId('bos-month-count').textContent = observations.length + ' monthly observations';
    paintSources();
    body.replaceChildren(...[...observations].reverse().map(([index, price, eps, call, target, gap, pct]) => {
      const [month, report, quote] = data.months[index];
      const row = document.createElement('tr');
      const key = item('th', month);
      key.scope = 'row';
      key.title = 'Report date ' + report;
      row.append(key, ...[quote, display(price), display(eps), call, display(target), display(gap),
        display(pct, percent)].map(value => item('td', value)));
      return row;
    }));
    body.closest('.sb2-table').scrollTo(0, 0);
  }

  async function load() {
    retry.hidden = true;
    status.textContent = 'Loading BOS monthly history…';
    try {
      const response = await fetch('data/bos-monthly-history.json?v=20261121', { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw Error('BOS monthly archive could not load.');
      data = validate(await response.json());
      selected = data.listings[0];
      search.value = '';
      const count = number.format(data.observationCount);
      status.textContent = count + ' monthly observations · ' + number.format(data.listings.length)
        + ' ticker and quote-unit combinations.';
      workspace.hidden = false;
      paintList();
      paintTable();
    } catch {
      status.textContent = 'BOS monthly archive could not load.';
      retry.hidden = false;
    }
  }

  retry.addEventListener('click', load);
  search.addEventListener('input', paintList);
  Promise.resolve(equity?.refresh()).finally(() => {
    dailyChecked = true;
    paintSources();
  });
  load();
})();
