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

Each statement shows up to three fiscal years, excluding TTM, with five selected
reported totals. Statement currencies and fiscal year ends are retained; amounts
are displayed in millions, with EPS separately labelled per share. Normalized EPS
remains labelled normalized. Missing values remain unavailable. BOS estimates are
identified separately and never fill missing annual statements.

Agency ratings use the existing validated Bloomberg snapshot via ShareEnrichment
and the existing credit summaries via CompanyCreditData. Agency, issuer/debt scope,
withdrawn/not-rated status and source dates are preserved. Bloomberg observation
dates are unavailable and stay explicitly undated. Outlooks, analyst calls and
Morningstar stars are separate concepts. No substitute listing is used.

## Optional 12-month cone

The cone starts at the latest dated historical close and ends twelve calendar months
later. It uses up to 36 completed monthly log returns from that same listing's price
history, sample standard deviation, and zero log drift. At month m the boundaries
are `close * exp(sd * sigma * sqrt(m))` for sd = -2, -1, 0, 1, 2.

At least twelve adjacent-month return pairs are required. Missing months are not
interpolated. A monthly move above a factor of 1.8 in either direction requires price
basis review: the code does not guess whether it is a split or an economic move.
Future observations and the incomplete anchor month cannot enter the estimate.
Shading represents model ranges, not forecasts or barrier-hit probabilities.

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
