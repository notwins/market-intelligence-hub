# Company valuation and earnings extension

This release extends `v4.html#history/shares`. The existing share chart and its
selection remain the source of price history and price comparisons. The company
research section adds dated valuation evidence and the existing reported earnings
dataset. The full coverage table remains on the same page below the chart tools.

## Coverage and interpretation

The valuation sample contains 83 observations across 14 exact listings:
`D05.SI`, `U11.SI`, `NVDA`, `MSFT`, `AAPL`, `TSM`, `GOOGL`, `AMZN`,
`META`, `BRK-B`, `AMD`, `AVGO`, `MU` and `TSLA`. This covers the existing
12-company earnings dataset plus DBS and UOB. The six supplied editions are dated
2021-12-01, 2022-11-01, 2023-11-01, 2024-11-01, 2025-11-03 and 2026-11-02.
These are selected observations, not a complete monthly archive.

The third research view, **Valuation ranges**, uses the existing chart selection.
Choose P/E, P/B or dividend yield to inspect the latest supplied edition against
the observed minimum and maximum. Each value retains its source precision and
report date. A range marker is a visual position between those endpoints,
not a percentile, score or investment recommendation. The expandable edition
matrix distinguishes valid values, missing listing rows, missing metric values
and values excluded from the meaningful range.

Thirteen listings have observations in all six editions. META has five: the
2021 extract does not contain the exact `META US` ticker, and this import does
not infer a historical ticker alias. `BRK-B` uses the existing reviewed BOS
mapping to `BRK/B US` and the existing registry alias for earnings ticker `BRK.B`.

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
  and are excluded from meaningful valuation ranges. TSM's 2021 P/B and MU's
  2023 P/E are such observations. A supplied dividend yield of zero is valid;
  a missing yield is not converted to zero.
- The latest value refers to the newest supplied report edition in the selected
  window. A missing listing row or metric in that edition stays missing; an
  older valid observation never replaces it. Minimum and maximum ties retain
  all their report dates.
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

The three views are Company timeline, Valuation ranges and Compare selected.
They remain inside the existing Shares navigation, with detailed tables in
expandable sections and horizontal table scrolling on small screens.

The public additions contain cleaned numerical observations only. Raw uploaded
files, lending terms, MOA/AR fields, holdings, borrowing, account details and
private source paths are excluded. Financing calculations require separately
verified definitions and facility terms and are outside this release.

## Presentation alignment

The research views reuse the Hub's V1.2 Merged company-colour catalogue and
publication-colour helpers. Exact company tokens, reviewed registry aliases and
unambiguous company names supply the identity colour; an unresolved identity
stays neutral. The optional colour catalogue loads independently of financial
evidence, so unavailable styling metadata cannot block a research view.

Company chips, restrained card accents and observation markers use the approved
light/dark colours. Numeric values, range endpoints and axes stay neutral.
Labels and distinct observation, release-event and latest-value shapes preserve
meaning without colour. Identity colour does not indicate investment quality,
price direction or financing eligibility.

Cards, controls and tables inherit the existing Hub font, text/chart scale,
surface, contrast and density settings. Tables scroll within their panels on
small screens. This is a dashboard presentation update: the existing price-chart
palette, source precision, selection state and financial calculations continue
to use their established contracts.

The existing published-fundamentals filters also shrink within their grid at
larger text sizes, preventing a long region option from widening the mobile page.

## Maintaining the sample

`scripts/import_equity_valuation_history.py` accepts the existing raw-row CSV
schema via `--input` and writes the cleaned projection via `--output`. Inputs
remain outside the repository. The importer rejects duplicate editions,
ambiguous listing rows, shifted unknown layouts and invalid source dates.
An absent exact ticker is recorded as a listing gap, distinct from a malformed
or ambiguous row. Global and per-listing coverage metadata reconcile to the
actual observations, including the report-date list and its endpoints.
It is a manual source import, not a new scheduled feed.

The dedicated importer and browser-module tests run with the existing Pages
suite. Existing price normalization, content-reader contracts, frozen report
bytes and market-data schedules continue to be checked by their existing gates.
