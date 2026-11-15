# Compact share history

`site/data/share-history.csv` is the complete downloadable public dataset. The
identical dated CSV is delivered locally. `share-history.csv.gz` is only a
deterministic compressed transport copy. Original source files are unchanged.

The importer retains source price, P/E, unrounded implied forward EPS and row
provenance for every reconciled BOS observation, including price/P/E records
without a usable EPS denominator. It also includes the approved Global price
history, public September/October snapshot fields, scoped credit data and the
83 previously cleaned valuation observations. Equal facts from the same source,
listing and date are deduplicated. Conflicting evidence is retained and flagged.

Redundant monthly changes, attribution effects, previous dates and observation
gaps are omitted from storage. They add no independent source fact. Adjacent
source values can reproduce an arithmetic change as `(new / old - 1) * 100`;
calendar total returns can be derived from adjacent cumulative holding-period
factors as `((1 + olderHPR / 100) / (1 + newerHPR / 100) - 1) * 100`. Missing
periods and nonpositive denominators remain unavailable. Raw BOS price changes
are not investment returns because corporate actions are not reconciled.

## CSV records

The header is `Date,Type,Key,Data`. This is a typed CSV stream: the remaining
columns have the following fixed meaning for each record type. Quoting follows
ordinary CSV rules. Text dictionaries are JSON encoded inside their CSV cell.

| Type | Columns after Date and Type |
| --- | --- |
| `V` | Schema version, metadata JSON |
| `S` | Source ID, source dictionary JSON |
| `I` | Integer listing index, listing dictionary JSON |
| `E` | Integer text index, JSON string |
| `D` | Source ID, date-context JSON |
| `O` | Listing index, source page, source row, source column, metric values |
| `Z` | Observation-row count, populated-value count, listing count, source count, SHA-256 |

Only a `D` record contains a date in its first column. Its date is inherited by
the following `O` records. An empty date on `D` explicitly establishes an undated
snapshot; it never inherits a date from an earlier context. Context JSON lists
metric keys in value-column order, plus report date, archive month, sheet and
qualification metadata. Trailing empty metric cells may be omitted.

Numeric values retain their supplied decimal strings. A blank means missing;
zero remains zero. `@n` refers to text dictionary entry `n`. Source dictionaries
hold file basenames, hashes and metric units/bases once. No local paths,
financing limits, private holdings or raw unlabelled worksheet cells are included.

The `Z` checksum covers every UTF-8 byte before the trailer row, including its
preceding newline. Counts and the checksum must reconcile before any parsed
dataset replaces the current in-memory dataset. A failed refresh retains the
previous validated state and exposes an error.

## Financial and identity boundaries

BOS archive-month labels are separate from actual quotation/report dates.
Implied EPS is price divided by positive consensus-forward P/E, with an
unspecified forecast horizon. It is not reported quarterly EPS. GBp and GBP
remain different quotation units. Exact ticker/currency identities are separate.

Global prices retain each provider's Close convention; adjustment treatment is
not harmonised and these are not dividend-reinvested returns. The client exposes
them as `globalPrice` (also the explicit `price` API alias), separate from BOS
`sourcePrice`. Existing historical prices and daily feeds are never overwritten.

September/October snapshot valuation dates and monetary units stay unknown
where the source omitted them. An inferred return cutoff is not a quotation
date. A merged listing's known quotation currency does not fill an unknown
snapshot metric currency. Scoped credit grades retain their original status.

Contradictory ISIN records remain separate source evidence with
`identityStatus: "conflict"`, `currentEligible: false` and `compareEligible: false`.
Other unresolved October identities have the same eligibility restrictions.
They cannot borrow current quotes, valuations, market caps or YTD returns.

`ShareLabData` fetches once on demand, keeps compact indexed rows, and materialises
only requested share/metric observations. `historyFor(record)` separates dated
metrics from undated `snapshots`. `metricFor("trr")` derives completed 2019–2025
calendar returns only; the current BOS YTD display remains a separate overlay.

## Rebuild and validation

Run `scripts/import_share_history.py` with `--bos-dir`, the approved
`--global-xlsx`, `--october-xlsx`, `--september-csv`, `--selected-history`,
`--output`, `--site-output` and `--audit` paths. A previously audited helper bundle
may be supplied through `--additional-json` instead of rereading those three
sources. That bundle remains local; it is not a published alternative dataset.

Run `test_import_share_history.py`, `test_share_history_sources.py` and
`test_share_lab_data.cjs`. The final browser parser also validates the complete
published CSV, including the hash, counts, dates, dictionary references and the
absence of partial records. The existing BOS and Yahoo schedules are unchanged.
