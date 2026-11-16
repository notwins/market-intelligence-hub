FRED OBSERVATORY — CURRENT FULL HISTORY
Monthly refresh checked 2026-11-16T15:34:51.655069+08:00. Latest three months merged; full history retained. See refresh-report.json and revisions.json.
Original download notes below are historical and do not describe the current schedule.
INITIAL DOWNLOAD NOTES
﻿FRED WATCHLIST DATA DOWNLOAD
Snapshot date: 16 November 2026 (Asia/Singapore)
Requested window: 2006-11-16 to 2026-11-16

CONTENTS
69 original FRED CSVs in this folder, named by exact FRED series ID.
5 external data CSVs in the "External sources" subfolder.
FRED_Download_Inventory.csv: titles, native frequency, units, seasonal adjustment,
actual first/last nonmissing dates, counts, source-update date/time, retrieval
timestamp, download links and SHA-256 checksums.
External sources/External_Download_Inventory.csv: status of all 8 external measures.
Original source snapshots, download scripts and validation details are retained
in _download_support. Previous versions, when changed, are kept below that folder.

FRED DATA HANDLING
Files are the original FRED CSV response, with unchanged values and native
frequency. Missing values remain blank (or a source missing marker). They are
not zero. No interpolation, resampling, rounding, inflation-rate conversion or
spread-unit conversion was applied. Observation dates label source periods.
For monthly and quarterly series, FRED includes the full period containing the
cutoff, so dates can start 2006-11-01 or 2006-10-01. This preserves source dates.
The last observation varies by series and publication lag. These are current
revised histories, not ALFRED point-in-time vintages. No refresh is scheduled.

SHORTER HISTORIES RETURNED BY FRED
BAMLC0A0CM: 2023-11-14 through 2026-11-12
BAMLC0A1CAAA: 2023-11-14 through 2026-11-12
BAMLC0A2CAA: 2023-11-14 through 2026-11-12
BAMLC0A3CA: 2023-11-14 through 2026-11-12
BAMLC0A4CBBB: 2023-11-14 through 2026-11-12
BAMLH0A0HYM2: 2023-11-14 through 2026-11-12
BAMLH0A1HYBB: 2023-11-14 through 2026-11-12
BAMLH0A2HYB: 2023-11-14 through 2026-11-12
BAMLH0A3HYC: 2023-11-14 through 2026-11-12
CLDACBM027SBOG: 2015-01-01 through 2026-10-01
RRPONTSYD: 2007-04-26 through 2026-11-13
SMPACBM027SBOG: 2015-01-01 through 2026-10-01
SNFACBM027SBOG: 2015-01-01 through 2026-10-01
SOFR: 2018-04-03 through 2026-11-12
SUBLPDRCSC: 2013-10-01 through 2026-10-01
SUBLPDRCSM: 2013-10-01 through 2026-10-01
SUBLPDRCSN: 2013-10-01 through 2026-10-01

The nine ICE BofA series currently return roughly three years. FRED's notes
state that only three years are included starting April 2026. Source:
https://fred.stlouisfed.org/series/BAMLH0A3HYC
The saved source pages retain the provider's attribution and use conditions.

EXTERNAL DATA
Treasury TIC: 10,015 records covering 233 distinct months, November 2006 through
August 2026. Country and aggregate rows are both present. The latest 13-month
table supersedes the historical table for overlapping month/label pairs.
At repeated June survey-break columns, the first/newer basis is retained.
January 2007, 2008, 2009, 2010 and 2011 are omitted because the January column
is shifted in the current Treasury historical source and cannot be reliably
mapped to countries. These gaps were not estimated. Historical country groups
and labels can change; missing entries are not zero. Custodial country is not
necessarily beneficial-owner country. Original HTML/TXT/CSV sources are saved.

Treasury auctions: 233 regular-term nominal 10Y note auctions, December 2006
through November 2026, including normal reopenings. Rows keep the published
bid-to-cover ratio, yield/coupon, price, offering and bidder award fields.
Shorter special reopenings of originally 10Y notes are excluded from this CSV
and remain in the raw JSON. The published USD25m auction of 21 June 2019 is
included. This is an unaggregated auction table. TreasuryDirect's official API
was used because the Fiscal Data API timed out.

New York Fed: three series, each 80 quarters, 2006Q4 through 2026Q3. Values are
the percent of outstanding balances 90+ days delinquent for auto loans, student
loans and HELOCs, from Page 12 Data of the 2026Q3 report workbook. These are
existing delinquent balances, not transition rates. Source quarters are kept
alongside quarter-start dates, and values are not rounded or annualised.

NOT DOWNLOADED
Trepp office and multifamily CMBS delinquency histories: no open bulk export
was located in the public source guide. A source export or appropriate access
is required. CME FedWatch year-end 2026 probability history: no historical bulk
export was available from the supplied public link. An appropriate API/source
export is required. No substitute measures or empty data CSVs were created.
Details and source links are in External_Download_Inventory.csv.

VERIFICATION
All 69 FRED CSVs passed date, header, numeric, row-count, coverage and checksum
checks. All 240 New York Fed values reconcile to the source workbook. All 233
auction rows reconcile to the saved official JSON. TIC gaps and survey breaks
are explicitly recorded. Machine-readable validation is in _download_support.
