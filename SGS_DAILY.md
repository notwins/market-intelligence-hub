# Daily MAS SGS curve and prices

The GitHub-hosted **Market data, weekly Fed history and Pages** workflow
(`.github/workflows/publish.yml`) schedules SGS at **19:00 Asia/Singapore**,
equivalent to **11:00 UTC every day**. It runs while the owner's computer is off.
The duplicate Codex schedule must remain disabled after the verified cloud
handoff. It uses the public MAS Daily SGS Prices **Closing Levels** table:
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

## Cloud publication procedure

The 19:00 SGS schedule selects `scripts/sgs_github_refresh.py`. The existing
08:00 headline, 07:00 bond and weekly Fed schedules retain their previous timing
and source boundaries. An SGS run does not refresh those other sources or use
the generic whole-tree generated-data publisher.

A manual **Run workflow** with **sgs_only** enabled runs the identical SGS path.
Leaving that option off retains the previous general manual workflow behavior.
The installation push also performs one cloud handoff while
`sgs-daily-status.json` has no `refresh_runner: github_actions` marker. A
successful cloud status commit prevents ordinary UI pushes from fetching MAS.

The cloud writer preserves earlier derived build changes in the isolated
runner's Git stash, fetches current main, and invokes the current owning writer
and SGS checks. It replaces only SGS rows in the desk adapter. A routine data
commit is limited to these three paths:

- `site/data/sgs-daily-snapshot.json`
- `site/data/sgs-daily-status.json`
- `site/data/desk-data.json`

Pushes are non-force. If main advances, the writer starts from that new main
and fetches MAS again, preserving concurrent observations and unrelated edits.
Authentication/network errors do not become force pushes. A bounded retry
exhaustion or fatal publication error stops the build; last-good live data stays
available. No new credentials, personal token, hosting service or permission
increase is required; the existing repository-scoped Actions token is used.

The SAME workflow then rebuilds and validates the full Pages artifact and
deploys it. It does not depend on its bot-authored data push starting a second
workflow. GitHub documents this token behavior at
https://docs.github.com/en/actions/concepts/security/github_token.

MAS access, layout, conflict or SGS-check failure restores the previous snapshot
and desk bytes. Only a dated failure status is saved. The normal release gates
still apply before displaying it; after a safe health publication the workflow
is marked failed. Failure details belong in Actions logs, not public JSON.

The cloud status identifies `refresh_runner: github_actions`, its real source
check time and the original MAS observation date. The Actions summary names the
direct MAS source; there is no source AI chat. GitHub scheduling can start late;
the configured cadence remains 19:00 Singapore time.

## Verification and recovery

Check the Actions run and its **Daily MAS SGS refresh** summary. A successful
run requires both build/validation and Pages deployment, followed by live
`scripts/verify_sgs_daily.py` snapshot/status, adapter and reader readback. The homepage, Prices and Historical Charts continue
to read the same shared daily dataset. A commit or saved schedule alone is not
verification of publication.

For owner recovery, use a fresh isolated checkout with
`git -c core.autocrlf=false clone`. Read AGENTS.md. The original local
`python scripts/update_sgs_daily.py` plus
`python scripts/build_desk_data.py --sgs-only` remains available for a deliberate
manual recovery; it is not a second recurring scheduler. Routine recovery must
preserve the same three-file scope, histories and non-force publication rules.

Checks: `python -m unittest discover -s scripts -p test_sgs_github_refresh.py`,
`python -m unittest discover -s scripts -p test_sgs_daily.py`,
`node scripts/test_sgs_daily.cjs`, `node scripts/test_market_snapshot.cjs`,
`node scripts/test_content_delivery.cjs`, and the complete final Pages artifact
suite required by AGENTS.md. Cloud publication tests cover source-failure
retention, the allowlist, concurrent main/SGS updates, non-concurrency push
failures, schedule selection and the one-time cloud handoff.
