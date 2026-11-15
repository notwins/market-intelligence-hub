# Daily MAS SGS curve and prices

The owner's daily Codex automation runs at **19:00 Asia/Singapore**. It uses the
public MAS Daily SGS Prices **Closing Levels** table:
https://eservices.mas.gov.sg/statistics/fdanet/SgsBenchmarkIssuePrices.aspx

The writer is `python scripts/update_sgs_daily.py`. No credentials or dependencies
are needed to read MAS. It parses the table by its exact ID and validates tenor,
Price/Yield column order, issue codes, coupons, maturities, dates and numbers.
The High / Low table is excluded. Fetch/parse/conflict failures preserve the
snapshot byte for byte and write a separate visible failure status.

## Saved data and charts

`site/data/sgs-daily-snapshot.json` retains schema 1 for existing consumers. Each
new dated observation adds `prices` and `issues` alongside its nine yield values.
Prices are the displayed clean prices, S$ per S$100 principal; Treasury bill
prices remain null because the page does not supply them. Names combine the
security type and MAS issue code. No ISIN or other name is invented.

All available dated closing rows are ingested to recover missed runs. Existing
rows remain; repeated dates are deduplicated. Conflicting yield or price values
require review. An overlapping row retains its first saved issue header so a
later benchmark rotation cannot relabel saved prices. New issue metadata means
the MAS header as displayed at retrieval, not an independently verified earlier
historical issue roster. Chart tables disclose that limitation.

The original 4-Nov snapshot's explicitly dated latest prices are retained on
4 Nov. Earlier saved yields have no inferred prices or issue identity. Price
lines break at missing observations and at issue changes. Monthly workbook
history stays separate. Publication dates never replace observation dates.

`sgs-daily.js` reads the same data for the homepage curve/details, the Prices tab
yield and price charts, and `v4.html#history/yield` Historical Charts. Every tenor
has a selectable daily series and accessible values. `sgs-daily-status.json`
records the actual source check and last verified date. Non-trading days add no
fake observations. A successful source check is not a claim of a new market date.

## Daily publication procedure

Use a fresh isolated checkout of current `notwins/market-intelligence-hub` main.
Clone with `git -c core.autocrlf=false clone` to preserve exact reference bytes.
Read AGENTS.md. Run the writer, then `python scripts/build_desk_data.py --sgs-only` and the
relevant Python and JS tests. If the writer fails, publish only the new error
status while keeping the last good snapshot and history; do not fabricate data
or claim success. Run the normal Pages artifact build/validation before pushing.

Commit only `site/data/sgs-daily-snapshot.json`, `site/data/sgs-daily-status.json`
and derived `site/data/desk-data.json` for a routine run. Preserve unrelated paths,
source schedules and all report/news archives. Use the authorized GitHub route
with latest-main ancestry and a non-force expected-head check. If main advances,
rerun the update and checks on the new main. Do not restore an old site snapshot.

Wait for the normal Hub Pages workflow to succeed. Read back the exact live
snapshot/status and confirm the new last observation and matching values, prices,
metadata and retained prior dates. Do not call a commit or a saved schedule a
successful refresh. A failed/blocked publication retains last-good live data.

Local Codex schedules require the local environment to be available. The source
itself requires no logged-in browser. Routine SGS updates do not write to the
independent research/content repository or change other source schedules.

Checks: `python -m unittest discover -s scripts -p test_sgs_daily.py`,
`node scripts/test_sgs_daily.cjs`, `node scripts/test_market_snapshot.cjs`,
`python -m unittest discover -s scripts -p test_desk_data.py`, and the full final
Pages artifact suite required by AGENTS.md.
