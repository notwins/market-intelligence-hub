# Mobile navigation and chart-label patch (3 November 2026)

Prepared locally against the public repository checkout; not published.

- V3/V4 bottom tabs: Briefing, US Earnings, Bonds & Credit, Hourly News, More.
- More groups Master, History and UST under Markets & analysis; retains existing Reuters coverage, Research papers and other links.
- Phone top bar shows the current section and a next-section button. Sequence: Briefing, Earnings, Credit, Hourly, Reuters, Research, Master, History, UST, Reports, Directory, Uploads, plus Tools on V4, then wraps.
- Language selector moved into gear settings. Original DOM select and handlers survive dialog regeneration, language switching and display reset.
- V4 historical event labels and dates restored in separate lanes above the plot, with links to the existing official sources and a retained legend. Event toggle and date-filter logic unchanged.
- Landing defaults to V4; explicit stored V3 preference and direct V3 links remain supported. Existing legacy `?view` routing stays intact.
- No market data, schedules, watchlist records or calculations changed.

Validation: 14 V3 tests, 5 V4 tests, 17 Python tests passed. New mobile structural/chart rendering test passed (100% and 200% text, event toggle, route groups, language-node preservation). JavaScript parses. Original V4 test enforcing V3 equality was updated because V3 changes are explicitly requested now.

Browser QA could not run: installed Chromium failed with socket() Operation not permitted, including the one approved escalation retry. Thus physical iPhone Safari, actual click/keyboard flows, screenshots and visual spacing are NOT certified. Run `node scripts/test_mobile_browser.cjs` with a local server serving site/ on localhost:8765 in a browser-capable environment before deployment. No GitHub write attempted; integration permission blocker remains.

Prior broad keyword-colouring/learning-mode request is not implemented in this patch because its exact task/spec has not been resolved.
