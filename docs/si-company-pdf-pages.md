# SI Beta 2 company pages

The main SI preview now follows the export controls directly. Company fundamentals
are no longer expanded above it. The optional **Include equity research & financials**
checkbox adds one A4 portrait page for each underlying, after its main SI page.
The company previews sit in a collapsed disclosure below the main preview.

Three-share SI export order: SI, share 1, share 2, share 3. Combined exports repeat
that order for each saved SI, including repeated underlyings. Button counts and PDF
page numbers describe the resulting physical pages. Existing draft schema and the
30-SI collection limit are unchanged. The appendix choice uses the separate browser
key `market-si-beta2-equity-pages`; chart choices use `market-si-beta2-chart`.

## Financials and research

`CompanyFundamentals.snapshot` resolves the exact listing using the existing directory,
reads the same browser-local Morningstar import as the stock cards, and loads the
existing BOS research briefs. Refresh also reads imports saved in another tab.
No imported statements or private drafts are uploaded or included in the deployment.

The company-page renderer retains the current twelve-quarter financial profiles,
statement currencies and fiscal periods. Amounts are displayed in millions, with
EPS labelled per share and normalized EPS identified separately. Missing periods
and values remain unavailable; BOS estimates never fill missing statements.

Agency ratings use the existing validated Bloomberg snapshot via ShareEnrichment
and the existing credit summaries via CompanyCreditData. Agency, issuer/debt scope,
withdrawn/not-rated status and source dates are preserved. Bloomberg observation
dates are unavailable and stay explicitly undated. Outlooks, analyst calls and
Morningstar stars are separate concepts. No substitute listing is used.

## Optional 12-month cone

The main cone starts at the latest selected dated close (BOS first, Yahoo fallback)
and ends twelve calendar months later. Volatility uses the full available price-only
Yahoo Close history when available, otherwise split-normalised BOS, retaining a valid selected quote even if the Yahoo
history request fails. Each source uses
up to 36 completed monthly log returns, sample standard deviation, and zero log drift.
At month m the boundaries are `close * exp(sd * sigma * sqrt(m))`, sd = -2,-1,0,1,2.

The Yahoo fan, purple BOS outer dashes, and gold supplied-Close outer dashes retain
separate histories and sample counts. Prices are never averaged or spliced across
providers. The saved Global Top 100 Close source retains its unconfirmed adjustment
basis and is diagnostic only. BOS corrections reuse Stocks BETA 2's documented split
calendar and corrected quotation dates; the original data are unchanged.

At least twelve monthly return pairs are required. Intervals must be 20-40 actual
days across adjacent calendar months. Reviews compare at least twelve shared pairs,
with start and end date labels within seven days across sources. Actual daily
sessions take priority over period labels; older weekly/monthly labels may not be
exact session dates. The full primary
sample is never reduced to fit a thinner comparison source. A symmetric max/min
volatility difference of 25%, or a median absolute price-level difference of 10%, flags
review. A difference does not prove an error or identify the correct provider.

MU's old 80%-move block was a false positive: fresh Yahoo data confirmed its May 2026
87.8% rise, all 255 overlapping daily closes matched, and the fetched five-year split
calendar was empty. Verified Yahoo moves are retained. Unlabelled legacy input stays
conservative. Future observations and the incomplete anchor month are excluded.

The collapsed source-check panel distinguishes each source's full-sample volatility
from the common-sample diagnostic. It also exposes dates, counts, starting-price
source, documented split counts, and 12-month ranges. These are model ranges, not
forecasts, guaranteed probabilities, or barrier-hit probabilities.

## Verification and rollback

`scripts/test_si_beta2.cjs` includes the controller and company-page regressions:
export ordering/counts, unchanged saved terms, preference restoration, stale PDF
invalidation, annual periods/units, missing data, scoped ratings and cone math.
Browser checks cover selected and combined PDFs, three/four underlyings, a private
annual-statements import, A4 rendering, source links, desktop and 390px phone layouts.

Rollback only the changed SI UI modules and the additive snapshot/data APIs on
current main. Keep the independent content reader, existing publication bytes,
reference data, navigation and source schedules. No whole-site artifact rollback
or research/data migration is needed.
