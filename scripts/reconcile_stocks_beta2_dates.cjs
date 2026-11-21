// Reconcile dates with the locally supplied Top 110 Browser Price History JSON.
// Only matched dates enter the published file. The daily prices stay local.
const fs = require('node:fs');
const path = require('node:path');

const site = path.resolve(__dirname, '../site/data');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const monthly = read(path.join(site, 'stocks-beta2-monthly-history.json'));
const output = path.join(site, 'stocks-beta2-history-adjustments.json');
const adjustments = read(output);
const archive = read(process.argv[2]);
if (archive.format !== 'mih-stock-price-archive' || archive.source !== 'Yahoo Finance Close') {
  throw new Error('Expected the saved Top 110 daily Close archive.');
}

const tradingDates = {};
const totals = { aligned: 0, corrected: 0, unconfirmed: 0 };
const week = 7 * 86400000;
for (const company of monthly.securities) {
  const listing = archive.listings.find(item => item.listing === company.ticker && item.currency === company.currency);
  const quotes = listing?.closes ?? [];
  const dates = new Map(quotes);
  const actions = adjustments.splits[company.ticker] ?? [];
  const factor = day => actions.reduce((divisor, [exDate, ratio]) => day < exDate ? divisor * ratio : divisor, 1);
  for (const point of company.observations) {
    const [index, price] = point;
    if (!(price > 0)) continue;
    const [, edition, declared] = monthly.months[index];
    const prior = company.previous[point[monthly.metrics.length + 1]];
    if (prior) {
      totals.unconfirmed++;
      continue;
    }
    const matches = (day, close) => Math.abs(close * factor(day) - price) < .005;
    const expected = dates.get(declared);
    if (matches(declared, expected)) {
      totals.aligned++;
      continue;
    }
    const declaredTime = Date.parse(declared);
    const candidates = quotes.filter(([day, close]) => {
      const age = declaredTime - Date.parse(day);
      return age > 0 && age <= week && matches(day, close);
    });
    // On a non-trading date, the most recent close is the natural as-of quote.
    // If that close differs, require a unique earlier price match.
    const latest = !expected ? quotes.findLast(([day]) => day < declared) : null;
    const matched = candidates.some(([day]) => day === latest?.[0]) ? latest
      : candidates.length === 1 ? candidates[0] : null;
    if (matched) {
      const entry = tradingDates[edition] ??= [declared, {}];
      (entry[1][matched[0]] ??= []).push(company.ticker);
      totals.corrected++;
    } else totals.unconfirmed++;
  }
}

// Group the listings that share a corrected date so neither date repeats per listing.
adjustments.tradingDates = Object.fromEntries(Object.entries(tradingDates).sort());
const { tradingDates: grouped, ...basis } = adjustments;
const head = JSON.stringify(basis, null, 2).slice(0, -2);
const entries = Object.entries(grouped).map(([date, entry]) => '    ' + JSON.stringify(date) + ': ' + JSON.stringify(entry));
fs.writeFileSync(output, head + ',\n  "tradingDates": {\n' + entries.join(',\n') + '\n  }\n}\n');
console.log(archive.asOf, totals);
