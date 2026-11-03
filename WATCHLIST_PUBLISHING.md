# Watchlist research and call publication

## Scope and visible routes

- `v4.html#watchlist`: the approved 12-name US watchlist, USD prices, six cumulative adjusted-close return horizons, partial sourced research and immutable edition history.
- `v4.html#calls`: explicitly approved public user calls and full reports available at the time of each call. No private diary records are imported by this change. A watchlist name is not a holding, executed trade or recommendation.
- The existing GOOGL factual report remains at `research/googl/`. Its existence does not constitute a user buy call.
- Research-house ratings and targets must remain separately attributed to the named publisher and dated source. Do not classify a house opinion as a user call or label Bank of Singapore research as Morningstar.

## Durable data and importer contract

The repository is the durable publication source. `site/data/watchlist/latest.json` is a complete valid example of schema version 1. `site/data/watchlist/index.json` points to immutable editions in `site/data/watchlist/archive/`. The frontend reads those files, not a local desktop or chat transcript.

For each authorized watchlist research run:

1. Read fresh `main` and the existing `latest.json` and index. Research from approved sources. Create a new edition only from independently checked public market information. Never copy brokerage records, private diary notes, account balances or personal information into the public data.
2. Make JSON using the complete schema in the latest example. Keep all 12 tickers in this exact order: AAPL, MSFT, NVDA, GOOGL, AMZN, META, BRK.B, AMD, AVGO, MU, TSLA, TSM. TSM is the US-listed USD ADR. Preserve original source dates, cutoff, observed quote times, price basis, all six baseline dates and values, and coverage gaps. Previous closes and adjusted closes are separate fields. Missing verification must not become zero or an invented fact. If a required price/baseline cannot be checked, keep the previous published edition and report the specific failure.
3. Use a unique UTC `watchlist-YYYYMMDDTHHMMSSZ` ID. For a correction to the same cutoff, append `-r1`, `-r2`, etc. Never overwrite the original. Put only public research in `research`; distinguish reported facts from analysis, risks and next events. Retain qualifications in attributed or unverified reporting. Boolean verification markers attest to checks performed by the producer; the validator does not itself verify external facts.
4. Run `python scripts/import_watchlist.py --input /tmp/edition.json --root site`. It validates all source URLs and arithmetic, timestamp ordering, the 12-name set, return horizons and approved fields. It writes the new archive, index and latest. Reimporting an identical edition is idempotent; replacing a dated edition is rejected. An older imported edition never replaces a later cutoff. Baseline dates must be on or no more than seven calendar days before the target monthly anniversary; the producer must verify the actual trading session.
5. Run `python -m unittest discover -s scripts -p 'test_*.py'`, `node scripts/test_v4.cjs`, and any affected checks. Review the public diff for private or unsupported content.
6. Commit the new archive, index and latest together, based on fresh remote `main`. Use a normal non-forced fast-forward or compare-and-swap update; reconcile concurrent changes without losing them. The existing push-triggered Pages workflow publishes the site. Do not change the unrelated Reuters cadence or publisher.
7. Verify the exact new commit is on main, the Pages workflow for that commit succeeded, and the public `data/watchlist/latest.json` has the expected edition ID. Only then claim website publication. A queued run, local import or successful push is not deployment proof. Keep old editions if the producer or deployment fails. Do not publish guessed replacement data.

`site/data/watchlist/status.json` currently says automatic watchlist publication has not been verified end to end. Update its factual state only after the scheduled producer's access, outputs and deployment have been confirmed. Never mark it enabled solely because a schedule exists. Refreshing the web page only reloads saved files and does not generate new research.

Full chat reports and public website editions are separate deliveries. Use the verified authorized report chat as the destination for the full report; the main conversation should receive a short verified link where requested. Do not publish private chat permalinks in this public repository.

## Calls and full reports

Use `scripts/import_watchlist_call.py` only for a specifically approved public call. Required keys: `schema_version: 1`, unique `id: call-...`, `ticker`, `called_at`, `recorded_at`, `call_type` (Watch, Buy thesis, Hold thesis, Sell thesis, Review), `summary`, `public_approval: true`, and `report`.

The report needs `title`, `as_of` no later than the original call, `created_at` no earlier than the cutoff and no later than recorded_at, `visibility: public`, `quote_date` and `financial_period_end` (ISO dates or null), `period_basis` (explicit TTM, quarter, point-in-time or mixed labels), `provenance`, at least three full sections (`heading`, `body`) and public source links (`title`, `url`). The intended sections include factual business review, thesis, valuation and assumptions, risks/countercase, catalysts, and what would change the view. Do not backdate later information into an earlier report. A later review is a new dated record linked in its prose, not an edit to the original call. Its classification describes the user's thesis, not an executed trade. Store only explicitly approved public content.

Command: `python scripts/import_watchlist_call.py --input /tmp/call.json --root site`. It appends an immutable call artifact in `site/data/watchlist/calls/` and the public `calls.json` index. Empty calls currently means not imported, not that the user has made no calls. No private/offline diary migration was completed in this release.

## Testing and limitations

- Python validator/archive tests and existing JS source tests run without third-party data services.
- `scripts/test_watchlist_browser.cjs` covers 390px/1440px, text at 100% and 200%, light/dark, filtering/search/sort, archive switching, Calls, Back and unavailable data. It requires an authorized local Chromium environment and preview server on port 8766. The build environment blocked Chromium socket creation, so a passing browser render test is not claimed.
- The price snapshot contains real dated source observations; it is not a live feed. The 20:00 SGT edition keeps its original 19:36–19:56 premarket observations even if markets subsequently move.
- This is a publication path, not proof that recurring delivery is active. Check the actual automation and public timestamps.

Private screenshot evidence must not enter the public repository. Keep vendor-normalized EPS or FCFE distinctly labelled from issuer GAAP EPS or cash-flow measures; quote dates, financial periods, report creation and call dates are separate facts.
