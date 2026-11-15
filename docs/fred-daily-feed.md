# FRED daily FX and US yield feed

Public reader: `fred-feed.html`. Machine-readable endpoints relative to the Hub:

- `data/fred-latest.json`: latest value, actual observation date, units and source for each series.
- `data/fred-daily.json`: full available daily observations since 1995 (later starts stay later), source mapping, missing dates, same-date crosses and retrieval time.
- `data/fred-daily-status.json`: latest request outcome and last successful retrieval; a failed request does not replace observations.

These are reference observations, not live/intraday trading quotes. Federal Reserve
H.10 publishes daily New York noon buying rates weekly on Monday at 16:15 US Eastern.
H.15 is published business days at 16:15 US Eastern; source holidays and delays apply.
Source release time, observation date and Hub retrieval time are different fields.
Retrieval is on demand and in the existing Saturday 06:17 UTC Fed job. No cron,
Reuters/news schedule, account permission or credential was changed.

## Retrieve with a prompt or command

Example request: “Refresh FRED FX and yields, export USD/SGD, CHF/SGD and UST 10Y
from 2020-01-01 onward, and show observation dates.” The implementation command is:

```powershell
python scripts/update_fred_daily.py --series USD/SGD --series CHF/SGD --series "UST 10Y" --start 2020-01-01 --csv history.csv
```

Use `--end YYYY-MM-DD` to restrict the export, `--saved` to export without a provider
request, `--list-series` to list exact IDs, or `--data-dir <private-folder>` to keep
a requested refresh/export private. No API key is needed by this public CSV route.
By default a refresh prepares the site's JSON locally. Publishing requires the
normal reviewed Git/Pages deployment; running a local command alone is not a live
publication. The webpage reload button reloads published files only.

Ten workbook currency mappings: AUD/USD DEXUSAL, EUR/USD DEXUSEU, NZD/USD DEXUSNZ,
GBP/USD DEXUSUK, USD/CNY DEXCHUS, USD/HKD DEXHKUS, USD/JPY DEXJPUS,
USD/MYR DEXMAUS, USD/SGD DEXSIUS, USD/CHF DEXSZUS.

UST constant-maturity investment-basis yields: DGS1MO, DGS3MO, DGS6MO, DGS1,
DGS2, DGS3, DGS5, DGS7, DGS10, DGS20, DGS30. These are not discount-basis
Treasury-bill yields, coupons, issuance yields or an executable individual-bond quote.
The WSJ individual-security yield cards remain separate. SGS is supplied by the
separate MAS pipeline and is not labelled FRED.

| Derived pair | Exact same-date formula |
| --- | --- |
| CHF/SGD | DEXSIUS / DEXSZUS |
| SGD/JPY | DEXJPUS / DEXSIUS |
| AUD/SGD | DEXUSAL × DEXSIUS |
| SGD/MYR | DEXMAUS / DEXSIUS |

AUD is USD per AUD, the reverse quotation direction to most USD legs. Compute
crosses before rounding. A missing leg makes that date missing. No forward fill,
monthly-to-daily substitution or interpolation is used. Existing monthly history
and the supplied workbook remain unchanged. Public files contain only provider
observations, hashes, public source URLs and derived rates; never upload raw workbooks.

Successful content changes create immutable `fred-daily-archive/<hash>.json`
snapshots; revisions are recorded in the request status. Unchanged observations
reuse the same dataset ID and immutable archive. Invalid values, unexpected
columns, stale source history or regressed coverage reject the refresh. The prior
daily JSON/latest JSON and their actual dates survive a provider error.

Source: Federal Reserve Board, retrieved via FRED, Federal Reserve Bank of St. Louis.
Public domain: citation requested. Daily data availability and public CSV service
availability are external dependencies; there is no guarantee of instant updates.
