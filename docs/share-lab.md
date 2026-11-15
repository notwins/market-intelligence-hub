# Beta 3 and Beta 4 shares

The two native views share one historical dataset and the existing current-price
and valuation services. Their routes are `v4.html#history/beta3-shares` and
`v4.html#history/beta4-shares`. Existing Shares, Beta Shares and Beta 2 remain
available.

## Use

Beta 3 is the share explorer. Search for a company or ticker, narrow the list
with the visible filter chips, sort by a column heading and select shares to
inspect their histories. Market capitalisation in USD is the default descending
sort. Missing capitalisations follow known values. Cards provide a compact
alternative to the table.

Beta 4 is the history pivot. Shares form rows and actual observation dates form
columns. Metric buttons switch the subject without changing the share selection.
The heat scale is optional. The chart view shows each listing separately so
different currencies and scales are not silently combined. Dates with no
observation stay unavailable. Column handles support pointer resizing and
keyboard adjustment.

## Data boundaries

Historical source prices, P/E and implied EPS retain their own dates and bases.
Implied EPS is price divided by the supplied positive forward P/E; it is not
reported earnings. Unspecified forecast horizons remain unspecified. Historical
prices without verified corporate-action treatment are source evidence, not
inputs to a total-return or investment backtest calculation.

Completed-year Bloomberg returns remain local-currency total returns with gross
dividends reinvested. Current BOS YTD uses the published value unchanged and the
owner's dividend-reinvestment site assumption. A frozen September 2026 return
does not replace the current BOS value.

Raw workbooks, private lending terms, concentration limits and local filesystem
paths are excluded from the public release. Exact listing and currency keys
prevent ADRs, ordinary shares, different share classes and currency variants from
being joined by company name.

## Daily updates and retention

The historical CSV is loaded lazily, once per browser session, by both views.
Current values use `MarketPrices`, `BOSEquity` and `ShareEnrichment`. Existing
refresh events update the current columns without regenerating the historical
CSV or making a UI release. Source failures retain the services' existing
validated-data fallback and truthful observation dates.

No schedule, feed branch, existing historical series or operational retention
policy changes in this release. The supplied research archive is distinct from
the daily BOS feed's five successful valuation editions. Future manual history
imports use the importer and data contract; ordinary daily pricing does not.

## Verification and rollback

Importer tests reconcile the compact file to the supplied sources. Browser tests
cover the two routes, filtering, sorting, selection, heat scales, width controls,
charts, missing data and desktop/mobile layout. The new checks enter the existing
Pages suite through `test_v4.cjs`; scheduled workflow definitions stay unchanged.

Rollback must restore only this release's explicit UI paths on current main.
Retain independent content delivery, newer reports, the daily feed branch and
existing histories. A pre-separation whole-site artifact is not a rollback target.
