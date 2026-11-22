(function (root) {
  'use strict';

  const endpoint = 'data/beta2-public-peer-financials-2026-11-22.json';
  const maxPeers = 4;
  const rows = {
    income: [['sales', 'Revenue / total income'], ['salesPrevious', 'Prior-year revenue / total income'], ['operatingProfit', 'Operating profit'], ['netIncome', 'Net income attributable to owners']],
    balance: [['cash', 'Cash and cash equivalents'], ['currentAssets', 'Current assets'], ['currentLiabilities', 'Current liabilities'],
      ['assets', 'Total assets'], ['liabilities', 'Total liabilities'], ['equity', 'Equity attributable to owners']],
    cash: [['operatingCash', 'Operating cash flow'], ['investingCash', 'Investing cash flow'], ['financingCash', 'Financing cash flow'],
      ['capex', 'Cash capital expenditure'], ['freeCash', 'Operating cash flow less capex']]
  };
  const percent = (a, b) => Number.isFinite(a) && Number.isFinite(b) && b > 0 ? 100 * a / b : null;
  const average = (a, b) => Number.isFinite(a) && Number.isFinite(b) ? (a + b) / 2 : null;
  const sub = (a, b) => Number.isFinite(a) && Number.isFinite(b) ? a - b : null;
  const amounts = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
  const ratio = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 2 });

  function financialMetrics(fields, bank) {
    const freeCash = sub(fields.operatingCash, fields.capex);
    const liquidity = bank ? null : percent(fields.currentAssets, fields.currentLiabilities);
    return {
      ...fields, freeCash,
      salesGrowth: percent(sub(fields.sales, fields.salesPrevious), fields.salesPrevious),
      operatingMargin: bank ? null : percent(fields.operatingProfit, fields.sales),
      netMargin: bank ? null : percent(fields.netIncome, fields.sales),
      cashMargin: bank ? null : percent(freeCash, fields.sales),
      roe: percent(fields.netIncome, average(fields.equity, fields.equityPrevious)),
      currentRatio: liquidity === null ? null : liquidity / 100
    };
  }

  function calculateCompany(company) {
    if (!company.financials) return {};
    return financialMetrics(company.financials, company.type === 'bank');
  }

  const keyRows = [
    ['salesGrowth', 'Revenue / income growth', '%'], ['operatingMargin', 'Operating margin', '%'],
    ['netMargin', 'Net margin', '%'], ['roe', 'ROE on average equity', '%'], ['cashMargin', 'Free cash flow margin', '%'],
    ['currentRatio', 'Current ratio', '×'], ['nimReported', 'Reported net interest margin', '%'],
    ['cetReported', 'Reported CET1 ratio', '%'], ['efficiencyReported', 'Reported cost-to-income ratio', '%']
  ];

  function selectedPeers(data, subject, tag) {
    return data.tags[tag].members.filter(id => id !== subject && data.companies[id].financials).slice(0, 3);
  }

  if (typeof module !== 'undefined') module.exports = { financialMetrics, selectedPeers };
  const doc = root.document;
  if (!doc) return;
  let request;

  function getData() {
    request ??= (async () => {
      const response = await fetch(root.ContentDelivery.CONTENT + endpoint, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('The comparison data is unavailable.');
      const data = await response.json();
      if (data?.version !== 1 || !data.listings || !data.companies || !data.tags) throw new Error('Unexpected comparison format.');
      return data;
    })().catch(error => { request = undefined; throw error; });
    return request;
  }

  function node(tag, label, attributes = {}) {
    const result = doc.createElement(tag);
    if (label) result.textContent = label;
    for (const [key, value] of Object.entries(attributes)) result.setAttribute(key, value);
    return result;
  }

  function sourceLink(source, label) {
    if (!source) return null;
    try {
      const url = new URL(source);
      if (url.protocol !== 'https:' || url.username || url.password) return null;
      return node('a', label, { href: url.href, target: '_blank', rel: 'noopener noreferrer' });
    } catch { return null; }
  }

  function makeTable(companies, metrics, fields, title) {
    const wrap = node('div', '', { class: 'sb2-table', role: 'region', 'aria-label': title, tabindex: '0' });
    const table = node('table');
    const headings = node('tr');
    headings.append(node('th', 'Metric', { scope: 'col' }));
    for (const [index, company] of companies.entries()) {
      const heading = node('th', company.name, { scope: 'col' });
      heading.append(node('small', `${company.ticker}${index === 0 ? ' · selected' : ''}`));
      heading.append(node('small', company.period ? `${company.period} · ${company.currency}m` : 'Financials pending'));
      const source = sourceLink(company.source, 'Source filing');
      if (source) heading.append(source);
      const ratioSource = title === 'Key ratios' && sourceLink(company.ratioSource, 'Reported ratios');
      if (ratioSource) heading.append(ratioSource);
      headings.append(heading);
    }
    const head = node('thead');
    head.append(headings);
    const body = node('tbody');
    for (const [field, name, unit] of fields) {
      if (!metrics.some(record => Number.isFinite(record[field]))) continue;
      const line = node('tr');
      line.append(node('th', name, { scope: 'row' }));
      for (const record of metrics) {
        const value = record[field];
        line.append(node('td', Number.isFinite(value) ? (unit ? ratio.format(value) + unit : amounts.format(value)) : '–',
          Number.isFinite(value) ? { 'data-tc-value': String(value) } : { 'aria-label': 'Unavailable' }));
      }
      body.append(line);
    }
    table.append(head, body);
    if (body.children.length) wrap.append(table);
    else wrap.append(node('p', 'Verified figures are pending for these companies.'));
    return wrap;
  }

  function render(panel, data, listing) {
    const subject = data.listings[listing];
    if (!subject) {
      panel.replaceChildren(node('p', 'Public peer coverage is pending for this listing.'));
      return;
    }
    const model = data.companies[subject.issuer];
    let tag = subject.tags[0], peers = selectedPeers(data, subject.issuer, tag);
    const selectTag = node('select', '', { 'aria-label': 'Industry tag' });
    for (const id of subject.tags) selectTag.append(node('option', data.tags[id].label, { value: id }));
    const selectPeer = node('select', '', { 'aria-label': 'Add a company to compare' });
    const remove = node('div', '', { class: 'sb2-peer-selections', 'aria-label': 'Selected peers' });
    const output = node('div');
    const method = node('details', '', { class: 'sb2-peer-method' });
    method.append(node('summary', 'How ratios are calculated'), node('p', 'Margins use reported revenue. ROE divides attributable net income by average opening and closing attributable equity. Free cash flow uses operating cash flow less cash capital expenditure reported in the filing. Banks use total operating income and show reported capital and efficiency ratios where available. Reporting standards and fiscal periods can differ.'));

    function paint() {
      const openSections = [...output.children].map(section => section.open);
      selectPeer.replaceChildren(node('option', 'Add company…', { value: '' }));
      const available = Object.entries(data.companies).filter(([id, company]) => id !== subject.issuer && company.financials && !peers.includes(id));
      const inGroup = new Set(data.tags[tag].members);
      for (const [label, entries] of [['Industry peers', available.filter(([id]) => inGroup.has(id))],
        ['Other companies with verified filings', available.filter(([id]) => !inGroup.has(id))]]) {
        if (!entries.length) continue;
        const group = node('optgroup', '', { label });
        for (const [id, company] of entries.sort(([, a], [, b]) => a.name.localeCompare(b.name))) group.append(node('option', company.name, { value: id }));
        selectPeer.append(group);
      }
      selectPeer.disabled = peers.length >= maxPeers || !available.length;
      remove.replaceChildren(...peers.map(id => {
        const name = data.companies[id].name;
        const button = node('button', `${name} ×`, { type: 'button', 'aria-label': 'Remove ' + name });
        button.addEventListener('click', () => { peers = peers.filter(peer => peer !== id); paint(); selectPeer.focus(); });
        return button;
      }));
      const companies = [{ ...model, ticker: listing }, ...peers.map(id => data.companies[id])];
      const metrics = companies.map(calculateCompany);
      const sections = [
        ['Key ratios', keyRows],
        ['Income statement', rows.income],
        ['Balance sheet', rows.balance], ['Cash flow statement', rows.cash]
      ].map(([heading, fields], index) => {
        const section = node('details', '', { class: 'sb2-peer-section' });
        section.open = openSections[index] ?? (index === 0);
        section.append(node('summary', heading), makeTable(companies, metrics, fields, heading));
        return section;
      });
      output.replaceChildren(...sections);
    }

    selectTag.addEventListener('change', () => { tag = selectTag.value; peers = selectedPeers(data, subject.issuer, tag); paint(); });
    selectPeer.addEventListener('change', () => {
      if (selectPeer.value && peers.length < maxPeers) { peers.push(selectPeer.value); paint(); }
    });
    const controls = node('div', '', { class: 'sb2-peer-controls' });
    const tagLabel = node('label', 'Industry tag');
    tagLabel.append(selectTag);
    const addLabel = node('label', 'Compare with');
    addLabel.append(selectPeer);
    controls.append(tagLabel, addLabel);
    panel.replaceChildren(controls, remove, node('p', 'Each company shows its fiscal year-end and reporting currency. Amounts are in millions.'), output, method);
    paint();
  }

  function mount(details, ticker) {
    if (!details) return;
    const panel = details.querySelector('[data-sb2-peer-body]');
    let ready;
    async function load() {
      if (!details.open || ready) return;
      ready = true;
      panel.replaceChildren(node('p', 'Loading public financial comparisons…', { role: 'status' }));
      try { render(panel, await getData(), ticker); }
      catch {
        ready = false;
        const retry = node('button', 'Retry comparison', { type: 'button' });
        retry.addEventListener('click', load);
        panel.replaceChildren(node('p', 'Public financial comparisons could not load.'), retry);
      }
    }
    details.addEventListener('toggle', load);
    if (details.open) load();
  }

  root.StocksBeta2PublicPeers = { mount };
})(typeof window !== 'undefined' ? window : globalThis);
