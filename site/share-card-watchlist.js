/* Default listings for the Hub's share cards. */
(function(root) {
  'use strict';
  const tickers = Object.freeze(['NVDA', 'TSM', 'BABA', 'GOOGL', 'AAPL', 'MSFT', 'AMZN', 'META', 'D05.SI', 'U11.SI']);

  function listings() {
    const reviewed = root.BOSEquity?.reviewedListings || [];
    return tickers.map(ticker => reviewed.find(row => row.verified === true && row.ticker === ticker)).filter(Boolean);
  }

  const api = { tickers, listings };
  root.ShareCardWatchlist = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
