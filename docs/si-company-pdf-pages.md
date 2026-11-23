# SI Beta 2 company pages

The main SI preview now follows the export controls directly. Company fundamentals
are no longer expanded above it. The optional **Include equity research & financials**
checkbox adds one A4 portrait page for each underlying, after its main SI page.
The company previews sit in a collapsed disclosure below the main preview.

With **Include SI terms & KO schedule**, the export adds one A4 page after the
company pages. It shows the local-currency reference and barrier levels, the
entered KO step-down by month, and three payoff illustrations: early KO, maturity
without KI, and maturity after KI with the worst share ending below strike.
The illustration uses a 10,000 notional in the SI currency, assumes coupons are
earned on schedule, and shows a cash-equivalent after KI using final price
divided by strike. It omits amounts when the coupon basis is unknown or a bonus
structure requires its own formula. In **Issuer payoff clauses**, enter the final
term sheet reference and either or both of the coupon and principal clauses for
each scenario. The PDF labels these entries separately from illustrations.
Without company appendices, the schedule follows the main SI. Combined exports
repeat the same order for each SI. Both choices are independent browser options.

## Financials and research

`CompanyFundamentals.snapshot` resolves the exact listing using the existing directory,
reads the public annual and quarterly statement feed used by the stock cards, and
loads the existing BOS research briefs. Refresh data checks the same endpoint and
updates the company profiles in the collection. Private drafts live in the browser.

Equity research and credit research display as two cards above the statements.
Each statement aligns twelve fiscal slots across one A4 table, newest first.
Quarters share year headings and a vertical divider separates each fiscal year. Each
monetary row uses consistent millions or thousands. EPS is per share and
retains its reported basic, diluted or normalized basis. Teal emphasizes key
figures and green/red mark the direction of quarter-over-quarter change.
QoQ uses consecutive comparable fiscal periods and the absolute prior amount,
before FX or display rounding. Half-year and full-year totals identified by
reconciling with annual figures are labelled; mixed-duration changes are omitted.

Net margin is net income divided by revenue. EBITA and EBITDA are distinct
reported lines. FCF uses the reported figure when available, then operating cash
flow less reported capital spending. A separate net PP&E variant includes
disposals when clean capex is unavailable. Missing values stay unavailable.

Statement currency is distinct from listing and SI currency. Exact-listing
overrides correct reviewed vendor labels, for example TSMC's TWD consolidated
amounts, Tencent and Alibaba's CNY figures, and ASML's EUR consolidated figures.
When the currencies differ, the appendix translates all displayed periods at
one dated FRED H.10 reference rate, with both currencies and the rate printed on
the page. The rate uses the latest common observation within 35 days on or
before the statement capture. If FX is unavailable, the report keeps its
reporting currency. The export does not update the archive or restate the
issuer's historical financial statements.

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
