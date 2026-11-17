# All datasets and records

`fred/data.html` is the single-page overview and record viewer for the current
shared macro archive. The November 2026 expansion contains 155 native CSVs,
140 FRED series and 15 direct-source tables, totalling 511,912 source records.
The earlier archive URLs and CSV bytes remain unchanged.

## Analytical contract

The catalogue names an `analytics_url`. This index provides one explicitly
labelled default series and measure per dataset, native record counts and all
source metadata. `groups_url` loads other countries, sectors, security identities
or measures on demand. Treasury totals and their components are never summed
by the viewer. Fed market-value holdings are distinct from Treasury face-value
debt. Census country trade is goods-only and not seasonally adjusted.

Heat uses the specified native level, YoY percentage change or year-ago native
change. Each observation is compared only with earlier usable observations in
the selected 5/10/15/20 calendar-year window. The sample SD uses N-1, with at least
12 prior observations and nonzero variance. Missing source markers remain
missing; nonpositive YoY bases do not produce percentage changes. Daily/weekly
year-ago comparisons are at or before the target and no more than ten days old;
monthly/quarterly/annual dates must match the source period exactly.

Absolute z below 1 is quiet, at least 1 is gently tinted, and at least 2 has a
stronger outline. Sign and text accompany colour. These are descriptive
distances, not probabilities, trading recommendations or point-in-time tests.
The record table uses rolling prior-only baselines, including when the visitor
browses older rows. The two existing monitor chart expansions retain their
separately labelled fixed-current-baseline guides.

OFS publication-history analytics select the latest publication for each
observation period; raw records retain every publication. Indistinguishable
nonmarketable security rows are retained and identified as analytically
ambiguous instead of being combined into an invented series. Debt-to-the-Penny
source discrepancies on 2011-02-01 and 2025-08-04 retain their native values but
are excluded from heat and baselines, as are growth readings using them as a
year-ago base. Dates are disclosed in the selected dataset's source notes.

## Large records and reusable sources

Native CSV bytes and their SHA-256 values remain authoritative. Ordinary JSON
payloads preserve original columns and string-valued rows. The three large new
tables expose the first 500 rows plus `row_pages` and `total_rows`. Each page
stores one column vector and an array of string-valued `values`; the viewer and
data-client decode this to the same named source fields without numeric
rounding. This avoids repeating every field name in hundreds of thousands of
records. Every page is reconciled with the original CSV in the archive tests.

New snapshots reuse earlier immutable CSV, group-index and record-page URLs
when their contents are unchanged. Only new or changed pages are written.
The downloadable ZIP still contains all current full CSVs, inventories, notes
and refresh receipts, regardless of which immutable snapshot stores a file.
No existing cited object is overwritten or deleted.

## Publication and refresh

The unchanged first-of-month 08:00 Singapore workflow now covers the entire
catalogue. `refresh_fred_extra_sources.py` handles Census, Fed Z.1, fiscal debt,
maturity tables and OFS bulletins. It validates official source schemas,
pagination and duplicate identities, then supplies only the three-month overlap
and lagged latest period to the existing merger. A failed source retains its
verified history and receives visible failure metadata.

The 09:00 local mirror verifies the catalogue-defined number of CSVs and hashes,
with backups before any local replacement. Source fetching, Pages deployment
and local mirroring remain separate operations. No other schedules, research
reports, provider credentials or hosting permissions changed.

Checks: `test_fred_observatory.py`, `test_refresh_fred_observatory.py`,
`test_refresh_fred_extra_sources.py`, `test_fred_archive_analysis.py` and
`test_fred_sigma.cjs`, followed by the normal complete Pages artifact gate.


## Grouping, ranking and guides

The overview defaults to broad main groups (Treasury, equities, inflation, trade,
credit, banking, housing, liquidity, currencies, commodities and the economy).
These display categories are derived from the existing source topics and IDs;
native catalogue metadata is not rewritten. Extreme sigma sorts by descending
absolute finite z across all groups; unavailable scores remain last. Keep main
groups restores sections and ranks extremes within each section. Signed sigma
continues to order by the signed value.

Both the global and expanded-chart SD selectors offer 5, 10, 15 and 20 calendar
years and stay synchronized; the initial window is 5 years. Every eligible mini
chart and expanded chart shows rolling prior mean, plus/minus one and two sample
SD. Missing and constant baselines are labelled instead of inventing guides.
Heat tint applies to the card top and expanded chart heading. Plot areas retain
a neutral background. `test_fred_overview.cjs` checks ranking, parent groups,
missing scores, current dataset coverage, guide eligibility and 15-year bounds.
