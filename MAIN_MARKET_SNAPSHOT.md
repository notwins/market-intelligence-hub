# Main-page market comparison desk

Initial delivery uses existing saved public-site datasets, without making a new provider request or changing a schedule. It adds one self-contained `MarketSnapshot` module and four narrow V4 hooks: CSS, module script, overview shell, and overview-only mount. Preserve simultaneous layout/reading changes when integrating.

## Coverage and actual basis

- 12 stock/ADR identities and source links are retained, but quote and change figures are withheld: the current Yahoo-linked source has no verified public-display permission. The arithmetic implementation distinguishes ordinary and adjusted differences for future licensed data; this does not authorize displaying them.
- SPY, QQQ, TLT, IEI and IEF: watch-only rows with unavailable prices/history. No holding is implied.
- 11 Fed FX pairs/crosses: completed monthly observations from the existing verified provider file. Month/year differences compare those periods. Days/weeks are unavailable; no spot quote is implied. CHF/SGD remains a ratio of monthly averages.
- XAU/USD: explicit unavailable row. Spot gold, futures and the licensed LBMA benchmark are not substituted for each other.
- 11 US Treasury tenors: official daily constant-maturity par yields from the existing Treasury archive, with daily/week/month/year changes. These are benchmark yields, not the uploaded WSJ bond list. Changes show basis points and relative yield percent, not bond returns.
- 9 daily Singapore tenors: official MAS benchmark closing bid yields for 28 October–4 November 2026, plus latest source-table issue code/maturity/clean price details. A separate dated snapshot, with no intraday quote time. Source licence and attribution are visible. Only available daily/week baselines are calculated; no long-term daily history is invented.
- 9 Singapore monthly-archive rows: the existing supplied MAS-labelled workbook, conspicuously labelled as historical, with the averaging method not independently verified. It remains a separate series, never spliced into the daily SGS snapshot. Daily/week changes stay unavailable.

The source files include US Treasury and equity observations through 3 November 2026 (equity values withheld in this module), Fed monthly observations through October 2026, daily Singapore observations through 4 November 2026, and supplied Singapore monthly observations through August 2026. The rendering derives dates and values from files, rather than hardcoding these dates. The UI shows two separately labelled historical curves; tenor positions are categorical, not proportional to maturity.

## Baselines and missing data

Days mean prior source trading observations; weeks use calendar weeks; month/year anniversaries clamp month ends and use the preceding available source session. Monthly series require the exact comparison month. A source-null tenor on the selected session remains unavailable rather than moving to an earlier quote. Current and baseline values must be finite, and a zero denominator never generates an infinite percentage. Dates, source frequency and baseline date are accessible with each row/cell. No forward filling, fabricated quote times or conversion from monthly averages to daily observations.

The initial fetch loads recent Treasury years, then loads the remaining five-year window only for Years. Source errors retain missing-state wording rather than invented values. No third-party API key is placed in browser code.

## Automation and rights

No schedule changes. Existing Fed refresh is weekly and supplies monthly series; Reuters refresh is not a market quote feed. Existing saved equity observations are not reproduced by the new module; stock identities/source links alone are shown. No automated Yahoo scraper is added. A licensed business feed with anonymous-public-display, cache/history and derived-data rights is needed before broader equity/ETF quote automation. The official MAS six-session snapshot is supplied with dataset attribution and the licence link. A repeatable daily SGS adapter/backfill remains future work; this release does not install a recurring job. Gold and live/delayed market feeds require separate review.

## Verification

`node scripts/test_market_snapshot.cjs` covers 58-row scope, missing ETF/gold quotes, frequency boundaries, equity-rights withholding and separate ordinary/adjusted arithmetic fixtures, yield arithmetic across 20 requested horizons, holidays/month ends/leap years, missing tenor observations, narrow HTML hooks, local-only data fetches, filtering and lazy history. V4 and existing Treasury checks pass. Managed Chrome 390px and 200% global/chart settings passed, including responsive controls, filters, daily/monthly SGS separation, month/year calculations, expanded source/licence details and withheld stock figures. Physical Safari was not certified. Independent financial review passed the date/frequency boundaries and change arithmetic. All 54 daily MAS yields and all latest issue identifiers, maturities, coupons and clean prices independently matched the official source. The final rebased candidate passed 118 Python tests plus focused market snapshot, V4, credit and mobile suites. No publication is claimed in this file.
