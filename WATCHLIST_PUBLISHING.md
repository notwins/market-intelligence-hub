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
- `scripts/test_watchlist_browser.cjs` covers 390px/1440px, text at 100% and 200%, light/dark, filtering/search/sort, archive switching, Calls, Back and unavailable data. It requires an authorized local Chromium environment and preview server on port 8766. The build environment blocked Chromium socket creation, so that full automated phone/desktop test is not claimed. A subsequent live cloud-browser check verified desktop light/dark rendering, 12 cards, search/filter/sort, archive selection, Calls and Back navigation. Watchlist cards reflowed without horizontal overflow at 200% text.
- The price snapshot contains real dated source observations; it is not a live feed. The 20:00 SGT edition keeps its original 19:36–19:56 premarket observations even if markets subsequently move.
- This is a publication path, not proof that recurring delivery is active. Check the actual automation and public timestamps.

Private screenshot evidence must not enter the public repository. Keep vendor-normalized EPS or FCFE distinctly labelled from issuer GAAP EPS or cash-flow measures; quote dates, financial periods, report creation and call dates are separate facts.

## Fixed full reports and guarded publication candidates

The current watchlist/Calls schema remains authoritative. The older separately staged diary prototype is retained privately; it is not a second public feed or a migration of private notes.

`scripts/watchlist_report.py` renders the complete saved edition into `site/data/watchlist/reports/EDITION-ID.html`. It keeps original quote timestamps, return baselines, factual qualifications, sources, coverage gaps, risks and catalysts. Facts and generated analysis are labelled separately, with readable headings, direction labels and colour. The static report is linkable, printable and browser-downloadable; browser printing can produce a PDF. No separately generated PDF/Word call artifact is claimed. `report-index.json` retains paths, cutoffs and SHA-256 receipts. Existing reports with different bytes are rejected; corrections need a new edition ID. Dashboard report links follow the selected edition.

Prepare an update in a fresh portable checkout with Python's standard library:

```
python scripts/prepare_watchlist_publication.py --input EDITION.json --repo . --output ../NEW-CANDIDATE --base-commit FULL-CURRENT-MAIN-SHA
```

The output contains a candidate `site/data/watchlist/` tree and `publication-plan.json`; the source checkout is unchanged. The helper validates/imports the edition, generates its fixed report, rejects stale base commits or reused output directories, and records changed paths with old/new SHA-256. It verifies existing archives, calls, reports, notes and publication status remain byte-identical. Only the new edition/report and mutable research indexes/latest may change. Invalid, empty or unverified editions cannot replace prior data. Verification flags attest to producer checks, not checks performed by the renderer.

Review only the plan's paths and atomically publish them together through the connected GitHub tree/commit APIs on freshly read main. Advance main with `expected_sha` and `force: false`. Conflicts require rereading/rebuilding, never a removed guard or force-push. For an uncertain write, read its actual outcome before another attempt. Human calls are outside the machine publication plan. No credentials or persistent grants are embedded. If execution, source checks or write access are unavailable, retain previous editions and report the exact blocker.

Verify the exact main commit, its successful Pages workflow/deployment, live edition ID and report SHA-256. Publishing the initial layout from the approved 3 November 20:00 SGT edition adds no later market observation. Manual publication, configured scheduling and observed scheduled success are distinct states; keep `status.json` honest. Run `test_watchlist_publication.py` with the existing Python test discovery.

Update the existing hosted `(A) Watchlist Research` task rather than creating a duplicate schedule. Preserve its four-hour Singapore cadence. After a verified deployment, its delivery should be a short link to the durable dated public report plus any material coverage warning. No supported automation update field currently retargets its saved conversation; a task title or recorded start time does not prove delivery to a separate `(A)` chat. Verify the destination with supported task/chat tools before claiming that delivery. Keep private chat identifiers and permalinks out of public data. Never automatically promote Watch only to a call or holding, and never import restricted screenshots.

## Per-company past report controls

Each of the 12 watchlist cards has a labelled Past reports disclosure. Its links are resolved from the public report receipt index and edition index, point directly to the company's anchor in the immutable report, and open in the same tab. The selected edition's cutoff bounds the list, so archived views do not acquire later research. The existing GOOGL company deep dive remains separately labelled. New scheduled editions appear automatically when both indexes contain their matching report receipt; no private catalogue is consumed.

Company names and ticker headings open the internal saved-content search. Public report destinations are labelled “within Market Intel”; publisher/source links are labelled “External source · leaves Market Intel · new tab.” A visible private notice explains that private notes and restricted screenshots are not available on this public page. It is not a claim that a private report exists for every name, and contains no private identifier or link. Do not replace this notice with a private destination until that destination is verified, authorized and appropriately protected. Frozen reports are not rewritten to add these navigation controls.

`test_watchlist_report_destinations.py` verifies public report SHA-256 receipts and all 12 company anchors. `test_watchlist_report_links.cjs` covers exact edition paths, archived cutoffs, unsafe/invalid values, duplicate reports and unavailable versus empty states; the existing `test_watchlist.cjs` runs it as part of the normal workflow.
