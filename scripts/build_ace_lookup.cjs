// Build a function from the approved BOS listing universe and a local ACE workbook.
const fs = require('node:fs');
const path = require('node:path');
require('../site/v3-source-engine.js');
require('../site/ace-listing-match.js');

const [workbookPath, workbookDate, outputPath] = process.argv.slice(2);
if (!workbookPath || !/^\d{4}-\d{2}-\d{2}$/.test(workbookDate ?? '') || !outputPath
    || fs.existsSync(outputPath) || path.extname(outputPath) !== '.mjs'
    || path.relative(path.resolve(__dirname, '..'), path.resolve(outputPath)).split(path.sep)[0] !== '..') {
  throw Error('Usage: node scripts/build_ace_lookup.cjs WORKBOOK.xlsx YYYY-MM-DD NEW_EXTERNAL_FILE.mjs');
}

const archive = JSON.parse(fs.readFileSync(path.join(__dirname, '../site/data/bos-monthly-history.json'), 'utf8'));
const workbook = globalThis.AceListingMatch.open(fs.readFileSync(workbookPath));
const results = Object.create(null);
const counts = Object.create(null);
for (const [, unit, , isin] of archive.listings) {
  const match = globalThis.AceListingMatch.match(workbook, isin, unit);
  counts[match.state] = (counts[match.state] ?? 0) + 1;
  if (match.state !== 'matched' && match.state !== 'currency') continue;

  const currency = unit.toUpperCase() === 'GBX' ? 'GBP' : unit.toUpperCase();
  const key = isin + '|' + currency;
  results[key] = match.state === 'matched'
    ? { state: 'matched', rows: match.rows.map(row => ({
        name: row.name, type: row.type, currency: row.currency, row: row.row,
      })) }
    : { state: 'currency', currencies: match.currencies };
}
if (!counts.matched) throw Error('The workbook has no matches in the published listing universe.');
const snapshot = JSON.stringify({ sheet: workbook.sheet, workbookDate, results });
const handler = fs.readFileSync(path.join(__dirname, 'ace_lookup_function.mjs'), 'utf8');
const marker = '/* ACE_SNAPSHOT */ null';
if (handler.split(marker).length !== 2) throw Error('Missing or duplicate ACE data marker.');
fs.writeFileSync(outputPath, handler.replace(marker, () => snapshot), { flag: 'wx' });
console.log(JSON.stringify({ workbookDate, sheet: workbook.sheet, listings: archive.listings.length, counts }));
