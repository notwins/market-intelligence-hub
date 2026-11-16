# Historical FRED and Prices — developer handoff

The full architecture and original implementation prompt are in
`historical-fred-prices-implementation.md`. These are buildless root-level pages
in the existing UI repository, independent of the original FRED Observatory.

## Routes and source ownership

* `site/historical-fred.html`: overview and full saved-data library.
* `site/fred-1.html`: warm-paper event replay with rates, inflation compensation,
  selected share closes, dated P/E, financial context and response evidence.
* `site/fred-2.html`: sage response matrix, episode comparison and largest fixed
  pre-event baseline deviations.
* `site/fred-3.html`: slate transmission hypotheses, rates/credit/equities,
  lending and matched monthly-change relationships.
* `site/historical-fred-data.js`: immutable adapters, fetch caches and pure
  analytical functions; also exports CommonJS for tests.
* `site/historical-fred.js`: shared controls/state, SVGs, provenance tables,
  native 74-dataset explorer and full-precision CSV downloads.
* `site/historical-fred.css`: scoped light-only responsive visual system.
* `site/data/historical-fred-events.json`: versioned editorial registry preserving
  all 12 existing event dates plus the three explicitly sourced additions.

The current `FredArchive.catalog()` resolves its own monitor and raw JSON/CSV
paths. No dated snapshot URL or duplicate raw series is embedded. Monthly
collection code, scheduler and archive are owned separately. The only edits to
existing UI are links in history navigation, V4 menus and site map; existing
navigation assertions were extended for these real destinations.

## State and source semantics

Query parameters `event`, `window`, `cursor`, `shares` and `indicator` persist
across the three view links. At most four exact eligible listing/currency
identities are selected. Local verified company logos use the existing logo API;
load failure visibly falls back to ticker initials. Event baskets select only
exact suggested listings with observations inside the window; if none qualify,
the current selection remains and a status explains the gap.

The engine reads `globalPrice` for provider closes and `pe` for dated BOS forward
P/E; it never splices `sourcePrice` or annual returns into a daily series.
Adjustment conventions vary and are not harmonised. Price changes are in local
currency and are not verified adjusted or total returns. Missing early saved
OAS/P/E, absent pre-event price bases and sparse valuation are visible states.

Monthly and quarterly periods are aligned to period ends while retaining native
observation dates. Response bases are strictly before an event and cadence
tolerances apply. Horizons beyond completed source coverage remain unavailable;
a daily weekend immediately following the final Friday quote is allowed within
two days. Daily/weekly z-score inputs are collapsed to completed monthly buckets;
fixed pre-event baselines use sample SD. Relationships use consecutive matched
monthly changes with at least 24 pairs, without filling gaps.

The explorer exposes all 74 native archived datasets, provider/group/coverage
filters, native history tables, official links and complete raw downloads.
TIC uses country-specific monthly histories. Auctions use actual competitive
close dates and a declared numeric field; no artificial daily series is made.
Separate monthly FX/UST averages and supplied SGS snapshot context remain labelled.

## Verification

Run from the repository root:

```text
node scripts/test_historical_fred.cjs
node scripts/test_historical_fred_browser.cjs
node scripts/test_desk_ui.cjs
node scripts/test_site_map_interactions.cjs
python -m unittest scripts.test_site_map
```

The analytical suite tests calendar/leap arithmetic, strict bases, completed
periods, weekend quotes, stale/future endpoints, zero/missing data, sample SD,
z cutoffs, units, price rebasing, exact inflation year-on-year matching, sparse
P/E, matched-change correlation and all 74 immutable raw adapters.

The browser suite expects a static preview at `http://127.0.0.1:8798`, override
with `HF_PREVIEW_URL`. It uses Playwright and Edge; `HF_BROWSER_CHANNEL` and
`PLAYWRIGHT_MODULE` can override local defaults. Screenshots are outside `site/`;
override their destination with `HF_SCREENSHOT_DIR`. Checks cover all views at
1600×1000 and 390×844, 2008/2020/March 2023/2024 episodes, no body overflow,
share chips/baskets/logo failure, source loading failure, matrices, exact Sunday
quote dates, TIC/auction controls, CSV, persistent view state and console errors.

The existing owner must run the complete Pages artifact gate and independent
content/source retention checks before publication. No commit, push, deployment,
collector or schedule changes are performed by this implementation handoff.
