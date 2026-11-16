# Historical FRED and Prices — architecture and Sol 6.1 implementation prompt

## Outcome and ownership

Implement three working, complementary trader dashboards called **Fred-1**, **Fred-2**, and **Fred-3**, grouped as **Historical FRED and Prices** under **Historical Datas**. They are historical analysis screens, separate from the existing FRED Observatory. Use the existing Market Intel GitHub Pages site, public datasets, source contracts, company logos and restrained colours. Preserve all existing data, routes, independent content delivery and unrelated schedules.

This document is the complete implementation handoff for **Sol 6.1, high reasoning**. Build the actual pages and functional controls, not mockups. Deliver source code, analytical tests, rendered desktop/mobile verification and a short deployment-ready change summary. The owner is completing the monthly FRED collection independently; do not modify that code or workflow.

## Routes and navigation

Use root-level pages `historical-fred.html` (overview), `fred-1.html`, `fred-2.html`, `fred-3.html`, so existing relative share data and logo APIs work without rewriting their contracts. Add links to the existing Historical charts shortcuts, V4 desktop/mobile history menus and site map. Label the new group Historical FRED and Prices with three child routes. Keep the current FRED Observatory links and section unchanged. Both main headers and breadcrumbs must place the feature under Historical Datas.

## Architecture

1. `site/data/historical-fred-events.json`: versioned event registry and editorial indicator mappings. Each event includes stable id, date, label, official URL, date kind, short factual context, mechanism hypothesis, selected indicator ids, rationale and suggested share basket. Preserve the supplied event dates; do not turn announcements into implementation dates.
2. `site/historical-fred-data.js`: adapters and pure analytical functions. Load current `data/fred/catalog.json` and its monitor through `FredArchive`, plus existing `history-fed.json`, `history-v3.json`, `ShareLabData` and event registry. Fetch once; reuse promises. Keep original data immutable. Export testable functions via CommonJS as well as a browser namespace.
3. `site/historical-fred.js`: shared state, event navigation, controls, rendering and downloads for all three layouts. URL query parameters retain event, window and selected share when switching views. Update controls coherently; a slow earlier fetch must not overwrite newer selections.
4. `site/historical-fred.css`: scoped visual system and responsive grids. Native SVG/canvas charts are sufficient; no new paid service or mandatory chart CDN. SVG needs accessible descriptions and underlying data tables.
5. Shared public data remain the core backend. Do not duplicate the 74 raw datasets or hard-code a dated monitor URL. Monthly FRED publication must automatically flow into these screens without a UI rebuild.

## Data sources and limits

* The FRED catalogue currently lists 74 datasets: 69 FRED series, three NY Fed delinquency series, Treasury auctions and TIC foreign Treasury holdings. The numeric monitor contains 73 series; TIC requires its native multi-country records. Inspect actual schema rather than assuming it.
* `ShareLabData.load()/records()/historyFor(record)` read the validated compact `data/share-history.csv`. Use `metrics.globalPrice` for provider daily Close, `metrics.pe` for dated BOS consensus-forward P/E, and `metrics.sourcePrice` only when explicitly labelled BOS unadjusted reference price. Do not splice them together. Restrict selectable records to resolved comparable identities and exact listing/currency. Retain source URL/file, date, report date, currency, unit and adjustment basis.
* Do not use the frozen Bloomberg annual-return snapshot as daily event prices. Do not invent an SPX series: the historical SPX source-status tab previously had no licensed published history. A user-selected available share is not an index proxy. Local-currency price change is not dividend-reinvested total return.
* Current credit OAS histories begin 2023-11-14. Earlier event panels must display unavailable with actual coverage; no proxy substitution. BOS dated valuations largely begin in 2017. Unavailable P/E stays blank. Global share price coverage varies by listing.
* Use `history-fed.json` for dated monthly FX and UST context; `history-v3.json` for supplied SGS monthly history and its explicit source status. Keep monthly averages, monthly source snapshots and daily quotes distinct. Existing source data and historical archives must remain byte-identical.
* These are retrospective views of latest revised observations, **not a reconstruction of what was published or knowable on the event date**. Observation period, report date and retrieval date are distinct. This sentence belongs near the global controls, with detailed methods below.

## Event-to-indicator map

Use all 12 existing `history-events-v1.json` events. Add the two distinct 2022-06-15 and 2023-07-26 policy events already in `ust-curves-events.json`, and the **2023-03-12 BTFP announcement** (official source https://www.federalreserve.gov/newsevents/pressreleases/monetary20230312a.htm). Do not fabricate future or unsupported events. At least 15 selectable events, sorted chronologically.

| Episode | Primary evidence | Secondary context | Interpretation and limits |
| --- | --- | --- | --- |
| 2008 QE announcement and zero bound | EFFR, DGS2, DGS10, T10Y2Y, STLFSI4, NFCI, WALCL | UNRATE, ICSA, DRALACBS, DRSFRMACBS, HOUST, PERMIT, MORTGAGE30US, lending standards | Separate policy action, financial stress and later economic outcomes. Credit spreads and P/E unavailable in the saved early window. |
| 2010 QE2 / 2012 QE3 | WALCL, DGS10, DFII10, T10YIE, THREEFYTP10 | WRESBAL, M2SL, USD/SGD, UNRATE, HOUST | Balance-sheet expansion, real yield and inflation compensation are separate channels; concurrent moves do not identify policy effects. |
| 2013 taper announcement | DGS10, DFII10, T10YIE, THREEFYTP10, WALCL | T10Y2Y, DTWEXBGS, USD/SGD, mortgage rates | This is December's announced taper, not a fabricated May taper-tantrum date. |
| 2015 SNB floor removal | USD/CHF, CHF/SGD, DEXSZUS, DEXSIUS | DGS10, DTWEXBGS, available Swiss/global shares | FX quote direction must be explicit; monthly averages cannot measure the intraday shock. |
| 2015 Fed lift-off | EFFR, DGS2, DGS10, T10Y2Y, DTWEXBGS | USD/SGD, deposits, lending standards | Compare front end, curve and currency; no claim that higher rates automatically benefit bank stocks. |
| 2017 runoff announcement | WALCL, WRESBAL, RRPONTSYD, WTREGEN, DGS10, THREEFYTP10 | EFFR, SOFR if covered, deposits | Announcement vs subsequent runoff distinguished. Balance-sheet components keep original units. |
| 2018 initial China tariffs effective | DTWEXBGS, USD/CNY, INDPRO, PAYEMS, DGS10, NFCI | available China/exporter/US shares and dated P/E | These are trade-sensitive indicators, not a causal tariff model. No fixed-sector composite invented. |
| 2020 emergency easing | EFFR, DGS2, DGS10, WALCL, ICSA, STLFSI4, NFCI | UNRATE, PAYEMS, GDPC1, M2SL, deposits, available share closes/P/E | Event occurred Sunday; first observed quote and previous quote dates must be shown. |
| 2022 lift-off / 75 bp hike | EFFR, DGS2, DGS10, DFII10, T10YIE, CPIAUCSL, CPILFESL, PCEPILFE | mortgage rates, HOUST, T10Y2Y, available growth/bank shares and P/E | Inflation plotted as explicitly calculated 12-month change using exact matching periods; no index-level-as-percent error. |
| 2023 bank funding intervention | DPSACBW027SBOG, WRESBAL, WALCL, STLFSI4, NFCI, DRTSCILM | CRE lending, CRE delinquencies by bank size, bank shares/P/E | Sector-wide data do not identify an individual bank's exposure. Saved OAS still unavailable for March 2023. |
| 2023 peak-rate step | EFFR, DGS2, DGS10, T10Y2Y, DFII10 | core inflation, UNRATE, Sahm indicator, household debt service and NY Fed delinquencies | Slower household/CRE indicators are quarterly context, not immediate reactions. |
| 2024 50 bp easing step | EFFR, DGS2, DGS10, DFII10, T10Y2Y, BAMLH0A0HYM2, BAMLC0A0CM | UNRATE, SAHMREALTIME, P/E, household and CRE credit | Separate yield moves from credit-spread moves and subsequent equity price changes. |

The full indicator library must make **all 74** datasets accessible, with group filters, source links, coverage, native history chart/table and raw download. Curated event panels select suitable data; do not cram every series into one misleading axis. Group all additional series sensibly: credit-rating spreads; CRE balances/standards/delinquencies/charge-offs; consumer delinquency and debt service; inflation SA/NSA variants; activity/labour; liquidity/funding; fiscal/debt/foreign ownership and auctions. AUCTION uses actual auction dates and a declared numeric field; TIC offers country selection and actual monthly dates, never a latest cross-section presented as a historical series.

## Analytical contract

* Event windows: 3, 6, 12 and 24 calendar months before/after (default 12). A date cursor permits step-through of completed observations. Clearly show the selected window and the event date.
* Plot the event as a vertical violet dashed line and label announcement/effective status. Shade pre/post subtly. Draw zero for spreads/changes, 100 for rebased prices, and a pre-event reference for levels. Use separate aligned panels for different units; no arbitrary dual axes.
* Monthly/quarterly FRED timestamps often denote period start. Derive a period-end coordinate for comparisons, retaining the original observation date in provenance. No current-quarter value may be treated as a prior observation merely because its timestamp is quarter start. Weekly/daily dates retain native meaning. Latest vintage is explicitly retrospective even after this alignment.
* For event response, base is last eligible completed observation strictly before event; endpoint is last observation on/before event + horizon (1, 3, 6, 12 calendar months). Show actual base/endpoint dates and sampling grain. Apply maximum age of 7 days for daily quotes, 14 weekly, 45 monthly, 120 quarterly; missing/stale endpoints produce unavailable, not silent carry-forward. No interpolation, zero-fill or extrapolation. If future horizon exceeds source coverage, leave unavailable unless endpoint genuinely within allowed cadence at boundary.
* Price response = `(end/base - 1)*100`, with positive base and original currency. Yield, OAS and rate response in **basis points** when original unit is percentage; level differences in native units for other series. P/E changes are turns, not percentages unless explicitly chosen. Share Close adjustment conventions differ by source and are not harmonised; the resulting price changes are not verified corporate-action-adjusted or total-return measures.
* Price chart rebase uses a valid pre-event baseline; if absent, show unavailable rather than taking a post-event point as 100. Select at most four shares, with individual currency labels. Dated P/E may remain sparse; use markers/step segments rather than implying daily measurement.
* Surprise heat uses signed level z-score against a **strictly pre-event** baseline: monthly series last 60 completed monthly values, minimum 24; quarterly last 20 completed quarters, minimum 12; daily/weekly series first converted to last valid observation per completed month for a comparable baseline. Use sample SD (n-1). The card can show current cursor level z against this fixed baseline; never include future observations in the baseline. Zero SD/insufficient data = unavailable. Explain that extreme does not equal good/bad or statistically independent significance.
* |z| <1 neutral; 1–<2 muted amber/blue directional tint with visible `1σ` badge; >=2 stronger terracotta/deep blue border and `2σ` badge. Never blink. Text/sign/badge must communicate the same signal without colour. Return direction has its own muted green/red scale, distinct from z-score and company identity.
* Fred-3 relationships use matched monthly **changes**, at least 24 paired observations. Report N, period, units and Pearson r; no correlation of unrelated trending levels by default, no causal claim. Do not fill gaps or mix daily/quarterly by forward filling. If insufficient pairs, explain rather than emit a number.
* All calculated figures retain full precision internally; render 2 decimals/appropriate unit. Zero is a real number. Provide a visible data table/export containing displayed observations, dates, unit, transform, source and event id.

## Three layouts

### Fred-1 — Event Replay / warm paper

Desktop top ribbon: Market Intel identity, Historical Datas breadcrumb, three view tabs, current data version. Then event dropdown + previous/next event, 3/6/12/24-month range, share selector and date cursor.

Four to six KPI cards: policy rate, 10Y yield, curve, financial stress, selected share price and dated P/E. Each shows actual observation date, event-relative change and baseline z where valid. Main grid: large 2-column rates chart, share rebased chart, real yield/breakeven chart, event-specific macro chart, policy/liquidity chart, valuation chart. Bottom: annotated chronology and a factual before/after evidence table. Each event's rationale explains why these indicators are selected. Use a direct computed title such as '10Y yield changed +x bp across the selected window' only when the calculation is valid.

### Fred-2 — Response Matrix / sage and sand

An event comparison matrix is the primary visual. Rows are episodes, columns are 1/3/6/12-month responses for a chosen indicator; another small matrix compares recommended indicators within the selected event, preserving units. Heat tint based on baseline z is explicitly separate from response value. Clicking an event selects it and shows a compact trend and exact observation-date evidence table. Include ranked largest absolute z cards, an all-dataset searchable explorer, source/coverage filters and CSV export. Three dense columns at large desktop sizes; matrices scroll within their panel on small screens.

### Fred-3 — Transmission Desk / powder slate

An interconnected research screen showing policy -> yields/real yield -> financing/credit -> equities/valuation and slower economic outcomes. This is a hypothesized channel map, not proof of transmission. Header includes event and date range; primary panels show policy and curve, real/nominal yields, credit spreads or unavailable state, selected stock closes, dated P/E, liquidity/lending. Add matched-month change scatter and correlation, an aligned timeline and source/coverage strip. User can choose suitable series for relationships and compare alternate event periods. Keep all units/axis definitions legible.

## Visual system

Dense Bloomberg-like information hierarchy with a gentle Market Intel base; do not copy Bloomberg marks. Numeric tabular font, compact uppercase panel labels and strong data alignment. Use existing system/installed fonts; no external font dependency required. Default 1600–1920px desktop: 12-column grid, 12px gaps, 10–16px panel padding, 13px body, 11px metadata, 22–28px key figures. At 1100px use two columns; below 720px stack, with local horizontal scrolling only for tables.

Tokens: ink `#24333d`; muted `#65727b`; border `#d7dfdf`; paper `#f4f3ee`; cards `#fffefa`; sage background `#edf2ed`; slate background `#edf1f5`. Rates blue `#557da3`; equities teal `#438e83`; policy violet `#8876a5`; inflation ochre `#bd9454`; credit terracotta `#b77366`; liquidity sage `#7e9c85`. Strong heat: warm `#d59479` / blue `#82a5c1`; soft heat `#f0dfc7` / `#dce8f0`. All numeric text uses dark ink; never neon fills. Use SVG line icons for calendar, curve, layers, bank, globe, stocks, download and source. Reuse `company-logos.js/css` and already-local verified logo assets where matched; fallback is ticker initials, not a fabricated logo. Company colours identify companies, heat colours express metrics.

Accessibility: real labelled controls, keyboard operation, visible focus, sufficient contrast, SVG descriptions, accessible loading/error status, reduced-motion support, no flashing. Preserve click targets and readable text when dense. No horizontal body overflow at 390px.

## Acceptance checks and handoff

* All three routes render distinct useful dashboards with real shared data and at least 15 sourced events.
* All 74 datasets discoverable, including native TIC/auction data. Coverage gaps visible for old OAS/P/E and recently introduced series.
* Event/window/share/cursor switching works; state survives view links. Table/export agrees with chart/card calculations.
* Pure tests cover leap/calendar month arithmetic, strict pre-event baseline, monthly/quarterly period-end conversion, weekends, stale endpoints, future horizons, missing/zero, SD=0, sample SD, z cutoffs, unit conversion, no price-base substitution, matched-change correlation and sparse valuation handling.
* Browser checks at 1600px and 390px for 2008, 2020, 2023 and 2024, console errors, loading/failure states, logo fallbacks and navigation placement. Save screenshots outside public site.
* Run existing content delivery and full Pages artifact suite before deployment. Do not weaken or bypass immutable archive/source guards. Existing monthly collector remains responsible for current FRED catalog; these pages merely consume it.
* Return explicit changed paths, calculations and verification results. Package this prompt with complete implementation source and a concise README for future Sol 6.1 work.
