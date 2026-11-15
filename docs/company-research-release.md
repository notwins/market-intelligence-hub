# Company valuation and earnings extension

This release extends `v4.html#history/shares`. The existing share chart and its
selection remain the source of price history and price comparisons. The company
research section adds dated valuation evidence and the existing reported earnings
dataset. The full coverage table remains on the same page below the chart tools.

## Coverage and interpretation

The initial valuation sample contains 36 observations: six supplied editions for
`D05.SI`, `U11.SI`, `NVDA`, `MSFT`, `AAPL` and `TSM`. The editions are dated
2021-12-01, 2022-11-01, 2023-11-01, 2024-11-01, 2025-11-03 and 2026-11-02.
These are selected observations, not a complete monthly archive.

- P/E, P/B and dividend yield retain the source's consensus-forward heading.
  The forecast year or rolling horizon is unspecified. No trailing multiple is
  manufactured from these fields or from the reported earnings sample.
- Report dates and underlying price dates remain separate. Original source
  strings preserve the displayed precision.
- Archived source prices remain evidence only. They are not reconciled for
  corporate actions and never enter a price chart or return calculation.
- Fair values and analyst targets are not market prices. Where the extracted
  row does not establish the provider or concept, the reference stays unresolved.
- Zero or negative multiples remain in the source evidence, with a review note,
  and are excluded from meaningful valuation ranges. TSM's 2021 P/B is such a
  source observation.
- Observed minima and maxima describe only the supplied sample. Historical
  percentiles and strategy signals remain unavailable. Backtesting requires a
  separate point-in-time dataset, including publication availability, corporate
  actions and a historically accurate universe.
- Earnings reuse `data/earnings-history.json`. Fiscal periods, EPS bases,
  reporting currencies and company-specific cash-flow definitions are retained.
  A comparative value with no original release date is not an earnings event.
  This release does not introduce a historical consensus or surprise series.

## Integration

`share-chart-workbench.js` mounts `EquityResearch` only in the shared history
workbench. It passes the existing selected symbols and chart window; no extra
watchlist, security master or price service is created. Research evidence loads
independently so a failed dataset cannot replace the price chart or its returns.

`EquityResearchData` validates the two source files independently, retains a
previously loaded valid dataset when a refresh fails, and permits retry. Exact
listing and currency matching is required. A missing observation remains missing.

The public additions contain cleaned numerical observations only. Raw uploaded
files, lending terms, MOA/AR fields, holdings, borrowing, account details and
private source paths are excluded. Financing calculations require separately
verified definitions and facility terms and are outside this release.

## Maintaining the sample

`scripts/import_equity_valuation_history.py` accepts the existing raw-row CSV
schema via `--input` and writes the cleaned projection via `--output`. Inputs
remain outside the repository. The importer rejects duplicate editions,
ambiguous listing rows, shifted unknown layouts and invalid source dates.
It is a manual source import, not a new scheduled feed.

The dedicated importer and browser-module tests run with the existing Pages
suite. Existing price normalization, content-reader contracts, frozen report
bytes and market-data schedules continue to be checked by their existing gates.
