# Watchlist reading update, 4 November 2026

The dashboard and new `watchlist-report.html?edition=ID#TICKER` reader are presentation layers over existing, immutable watchlist JSON. No historical JSON, original report HTML, receipts or calls were changed.

- One ticker/company search link, independently verified ISIN and precise share class/ADR identity. Evidence is in identities.json.
- Charts go to existing verified Morningstar destinations. Report goes to the exact company PDF linked by the 3 November BOS directory, independently checked for company identity and report-header date. Author is Morningstar, host is Bank of Singapore. No PDFs are copied. These dated links are not a claim to the newest available report.
- All six cumulative adjusted-close horizons are swipeable and keyboard-scrollable. The calculation table has no separate repetitive source column.
- Point-form facts, analysis, risks and next checks retain all material qualifications. Dated company research accumulates without exact repeats. Shared policy context appears once, outside company cards.
- Content-bound research-index.json separates company narratives from quote-only and broad-market context. Every saved item has an explicit review decision; only full matching `company` content appears in company links. Identical retained research is deduplicated including analysis, risks, next checks and source attribution. A self-declared scope or matching headline cannot authorize changed content. New editions require a completed review and mapping prepared atomically with the edition/report; see WATCHLIST_PUBLISHING.md. A missing or stale review produces a visible notice and retains access to the original report. Do not infer substance from ticker mentions.
- Compact dates show SGT; full timestamps, pricing/return basis, coverage and original inputs remain accessible. Repetitive absence statements are not rendered on cards. Full original files remain available from the reader.
- The public Google research is prominent on Calls & full reports. No private report, screenshot or identifier was added. Empty personal calls do not create a watchlist button.

Validation: 75 Python tests and all non-browser CJS suites passed, including new watchlist reading coverage. Independent financial review checked all seven readers and all 15 original archive/report/call hashes. Managed browser checks passed desktop and 390px phone, 200% global text, horizontal returns, calculation table, meaningful history, internal company routes and anchored reader.

Integration adds the source-verified credit issuance desk, structured search reading, exact company PDF/chart hub links, query composition controls, grouped phone navigation, Settings shortcuts and eleven additional saved credit explanations. Final combined tests are rerun after catalogue generation and browser QA.

## Ticker controls (7 November 2026)

Clickable watchlist tickers use exact Colour & Tagging Standard V1.2 Merged company
colours, verified against the current master on 7 November. Ocean: AAPL, MSFT,
GOOGL, AMZN, TSLA. Violet: NVDA, AMD, AVGO, MU, TSM. Magenta: META. Navy: BRK.B.
Prescribed light/dark text and chip pairs pass 4.5:1 normal-text contrast. A border,
hover/focus underline and 44px minimum height keep controls identifiable. Unknown
tickers retain existing link colours, without inferred company assignments.

Only watchlist card ticker headings and their saved-edition reader are changed.
Destinations, company names, card accents, prices/returns, earnings cards and
immutable original reports are unchanged. No proposed V3 palette is used.
