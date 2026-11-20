/* Match locally supplied workbook rows using verified listing identities. */
(function (root) {
  'use strict';

  const reader = root.USTDecisionImport;
  const preferred = ['ACE', 'ACE snapshot', 'ftb_ACE', 'Master', 'ftb_Bonds'];
  const columnNames = {
    isin: ['isin', 'securityisin', 'isinsecurityidentifier'],
    currency: ['securitycurrency', 'currency', 'currencycode', 'ccy', 'quotecurrency', 'tradingcurrency'],
    name: ['securityname', 'acename', 'bondname', 'companyname', 'name', 'shortdescription'],
    type: ['typebondssharesetfsut', 'securitytype', 'instrumenttype', 'type', 'category'],
  };
  const text = value => typeof value === 'string' ? value.trim() : '';
  const header = value => text(value).toLowerCase().replace(/[^a-z0-9]/g, '');

  function currency(value) {
    const code = text(value).toUpperCase();
    if (code === 'GBX') return 'GBP';
    return /^[A-Z]{3}$/.test(code) ? code : '';
  }

  function findColumn(row, keys) {
    for (const key of keys) {
      const index = row.indexOf(key);
      if (index !== -1) return index;
    }
    return -1;
  }

  function findHeaders(rows) {
    for (const [index, row] of rows.slice(0, 25).entries()) {
      const names = row.map(header);
      const columns = Object.fromEntries(Object.entries(columnNames)
        .map(([field, keys]) => [field, findColumn(names, keys)]));
      if (columns.isin >= 0 && columns.currency >= 0) return { index, ...columns };
    }
    return null;
  }

  function open(bytes) {
    const book = reader.openWorkbook(bytes);
    const named = preferred.map(name => book.sheets.find(sheet => sheet.toLowerCase() === name.toLowerCase()))
      .filter(Boolean);
    const candidates = [...new Set([...named, ...book.sheets])];
    for (const sheet of candidates) {
      const rows = book.readSheet(sheet);
      const columns = findHeaders(rows);
      if (!columns) continue;
      const identities = new Map();
      for (const row of rows.slice(columns.index + 1)) {
        const isin = reader.canonicalIsin(row[columns.isin]);
        const sourceCurrency = text(row[columns.currency]);
        const code = currency(sourceCurrency);
        if (!isin || !code) continue;
        if (!identities.has(isin)) identities.set(isin, new Map());
        const units = identities.get(isin);
        if (!units.has(code)) units.set(code, []);
        units.get(code).push({
          name: text(row[columns.name]).slice(0, 160),
          type: text(row[columns.type]).slice(0, 80),
          currency: sourceCurrency,
          row: row.sourceRow,
        });
      }
      if (identities.size) return { sheet, identities };
    }
    throw Error('No worksheet contains usable ISIN and currency columns.');
  }

  function match(workbook, isin, quoteUnit) {
    if (!isin) return { state: 'unverified' };
    const matches = workbook.identities.get(isin);
    if (!matches) return { state: 'missing' };
    const rows = matches.get(currency(quoteUnit));
    if (!rows) return { state: 'currency', currencies: [...matches.keys()].sort() };
    return { state: 'matched', rows };
  }

  root.AceListingMatch = Object.freeze({ open, match });
})(globalThis);
