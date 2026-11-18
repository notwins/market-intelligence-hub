# Fred-1/2/3: latest observations, watchlist and S&P 500

The existing View / historical episode dropdown now includes Latest available.
Bare URLs default to that snapshot; URLs carrying an existing historical event
remain historical. Mode, event, lookback, cursor and selected listings travel
between all three dashboards in the query string.

Latest shows the most recent saved observation through the Singapore snapshot
date, retaining its actual observation/period-end date and age. Daily, weekly,
monthly and quarterly releases are not presented as simultaneous live quotes.
Its heat baseline precedes the displayed observation. Quarterly one-month
changes are unavailable. Historical event baselines and missing-value rules
remain separate.

The current public site watchlist supplies quick dropdown choices ahead of
the full listing catalogue. USD listing and share class are preserved using the
verified watchlist identities. When a history record lacks an ISIN, only its
already-eligible exact US ticker/currency identity can match; no ISIN is invented.
The existing four-share comparison limit remains visible. The existing basket
button chooses the first four watchlist names in latest mode. Shared current
quotes and dated BOS P/E are displayed separately from historical provider Close.

S&P 500 is the actual Yahoo Finance ^GSPC price-index series. It excludes
reinvested dividends. Its saved history begins 3 January 2006. Before-event
returns run from a quote on/before the monthly anniversary to the strict
pre-event close. After-event returns begin at that same pre-event close. Latest
trailing returns end at the actual last completed close. All calculations retain
provider precision and CSV exports include actual endpoint dates and values.
No incomplete future horizon or unfinished US trading session becomes a close.

Raw index CSV and JSON live under `site/data/spx/`. Each successful collection
retains the source response and an immutable derived snapshot in `archive/`.
Subsequent collections fetch a three-calendar-month overlap and retain older
dates. The S&P 500 is a separate benchmark, not a change to the 74-dataset FRED
catalogue or its existing monthly archive contract.

`spx-history-daily.yml` collects after the US session at 07:15 Singapore Tuesday
through Saturday. This workflow commits index data only. The site's existing
08:00 Singapore daily `publish.yml` run builds and deploys current main; a bot
data commit does not itself start a push-triggered workflow. GitHub schedules
can start late. Source failures leave the previously published data and its date.

Sources: [Yahoo Finance index history](https://finance.yahoo.com/quote/%5EGSPC/history/),
[FRED S&P 500 series and ten-year coverage limitation](https://fred.stlouisfed.org/series/SP500),
[GitHub token workflow-trigger rules](https://docs.github.com/en/actions/concepts/security/github_token).

The current consumer pages are `fred-1.html`, `fred-2.html` and `fred-3.html`:
latest macro cards/table, indexed share/index charts, selected-share quote table,
S&P 500 event/trailing-return tables, matched monthly-change scatter and CSVs.
