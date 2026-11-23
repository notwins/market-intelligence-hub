/* The SI Beta 2 reference table, shared by the library and company cards. */
(function (root) {
  'use strict';
  const C = root.SIBetaCore;
  const E = C.escape;
  const listingCodes = { 'D05.SI': 'DBSM', 'U11.SI': 'UOBH', 'O39.SI': 'OCBC', 'S68.SI': 'SGXL',
    'Z74.SI': 'STEL', 'S63.SI': 'STEG', 'C6L.SI': 'SIAL', '000660.KS': 'SKHY' };

  function codeFor(listing) {
    const ticker = String(listing || '').trim().toUpperCase()
      .replace(/ US$/, '').replace(/ HK$/, '.HK').replace(/ SP$/, '.SI');
    if (Object.hasOwn(listingCodes, ticker)) return listingCodes[ticker];
    if (/^\d{1,4}\.HK$/.test(ticker)) return ticker.split('.')[0].padStart(4, '0');
    return /^[A-Z0-9]{1,8}(?:[.-][A-Z]{1,3})?$/.test(ticker) ? ticker : '';
  }

  function libraryHref(listing) {
    const code = codeFor(listing);
    return 'si-beta2.html' + (code ? '?company=' + encodeURIComponent(code) : '') + '#si-library';
  }
  const onePagerHref = reference => 'si-beta2.html?reference=' + encodeURIComponent(reference);
  const headers = ['Shares / reference', 'Date', 'CCY', 'Tenor', 'Coupon', 'KO', 'KO Step-down', 'KI', 'Strike'];
  const fields = ['stocks', 'date', 'currency', 'tenor', 'coupon', 'ko', 'step', 'ki', 'strike'];

  function cells(row, step, basket) {
    const stepDisplay = step == null ? '—' : `<span class="si-step-display" data-si-step-short="${step} pp">${step.toFixed(2)} pp</span>`;
    const barrier = (term, value) => `<td data-tc-value="${value}"><span class="si-term-value" data-si-barrier-band="${C.barrierBand(term, value)}">${value}%</span></td>`;
    return `<td class="si-library-basket" data-tc-value="${E(row.shares.join(' / '))}"><span class="si-basket-line">${basket}<small class="si-reference-meta"><a href="${onePagerHref(row.reference)}" aria-label="Open ${E(row.reference)} one-pager">${E(row.reference)}</a>${row.additional_review ? ' · review' : ''}</small></span></td>
      <td data-tc-value="${E(row.source_date || '')}">${E(row.source_date || 'Not shown')}</td>
      <td>${E(row.currency)}</td>
      <td data-tc-value="${row.tenor_source_value}">${row.tenor_source_value} <small class="si-inline-unit">months</small></td>
      <td data-tc-value="${row.coupon_pct}"><strong class="si-term-value" data-si-coupon-band="${C.referenceCouponBand(row)}">${row.coupon_pct}%</strong> <small class="si-inline-unit">p.a.</small></td>
      ${barrier('ko', row.ko_pct)}<td data-tc-value="${step ?? ''}">${stepDisplay}</td>${barrier('ki', row.ki_pct)}${barrier('strike', row.strike_pct)}`;
  }

  function basket(row, logos) {
    return `<span class="si-library-shares">${row.shares.map(code => `<span class="si-library-share">${logos ? root.CompanyLogos.html([code], logos, { size: 20 }) : ''}${E(code)}</span>`).join('')}</span>`;
  }

  function cardCells(row, step, logos) {
    let index = 0;
    return cells(row, step, basket(row, logos)).replace(/<td(?=[\s>])/g, () => {
      const field = fields[index], label = headers[index++];
      return `<td role="cell" data-si-field="${field}" data-label="${E(label)}"`;
    });
  }

  function section(listing, { open = false } = {}) {
    return `<details class="si-card-references" data-si-card-listing="${E(listing)}"${open ? ' open' : ''}>
      <summary>SI Beta 2 references</summary>
      <div><p><a href="${libraryHref(listing)}">Open in SI Beta 2 →</a></p>
      <div data-si-card-body></div></div>
    </details>`;
  }

  async function mount(detail) {
    if (!detail?.open || detail.dataset.siCardState) return;
    detail.dataset.siCardState = 'loading';
    const body = detail.querySelector('[data-si-card-body]');
    body.innerHTML = '<p role="status">Loading saved SI references…</p>';
    try {
      const data = await C.loadReferences();
      const logos = root.CompanyLogos?.data;
      if (!detail.isConnected) return;
      const code = codeFor(detail.dataset.siCardListing);
      const rows = data.rows.filter(row => row.shares.includes(code));
      detail.querySelector('summary').textContent = `SI Beta 2 references · ${rows.length}`;
      body.innerHTML = rows.length ? `<div class="si-card-scroll" tabindex="0" role="region" aria-label="${E(detail.dataset.siCardListing)} SI Beta 2 references">
        <table role="table" data-table-controls="on" data-tc-layout="si-card-references" data-tc-companies="${E(code)}">
          <caption>Rounded historical references · select a reference to open its one-pager</caption>
          <thead role="rowgroup"><tr role="row">${headers.map((name, index) => `<th role="columnheader" scope="col" data-tc-field="${fields[index]}"${index === 0 ? ' data-tc-company-column' : ''}${index === 6 ? ' data-table-unit="pp"' : ''}${['ki', 'ko', 'strike'].includes(fields[index]) ? ' data-tc-default-heat data-tc-heat-preference="lower"' : ''}>${name}</th>`).join('')}</tr></thead>
          <tbody role="rowgroup">${rows.map(row => '<tr role="row" data-tc-company-codes="' + E(row.shares.join(' ')) + '">' + cardCells(row, data.ko_step_down_pp?.[row.reference], logos) + '</tr>').join('')}</tbody>
        </table></div>` : '<p>No saved SI references for this listing.</p>';
      detail.dataset.siCardState = 'loaded';
      if (!logos && root.CompanyLogos && rows.length) root.document.addEventListener('mih-logo-catalogue', () => {
        if (!detail.isConnected) return;
        detail.querySelectorAll('.si-library-shares').forEach((node, index) => {
          node.outerHTML = basket(rows[index], root.CompanyLogos.data);
        });
      }, { once: true });
    } catch {
      body.innerHTML = '<p role="status">SI references could not load. Reopen this section to retry.</p>';
      delete detail.dataset.siCardState;
    }
  }

  root.SIReferenceTable = { codeFor, libraryHref, cells, section, mount };
  root.document?.addEventListener('toggle', event => {
    if (event.target.matches?.('[data-si-card-listing]')) mount(event.target);
  }, true);
})(typeof window !== 'undefined' ? window : globalThis);
