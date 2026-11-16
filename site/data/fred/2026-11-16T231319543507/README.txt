MARKET INTEL - SHARED MACRO DATA ARCHIVE
155 data CSVs. Published local-source import; source observation dates and successful retrieval times vary. The existing monthly refresh runs on the first at 08:00 Singapore and merges a three-month overlap without truncating history. Source failures retain verified prior data.

ADDITIONAL MARKET DATA DOWNLOAD - 16 NOVEMBER 2026
Requested window: 16 November 2006 to 16 November 2026.
Saved 81 additional data CSVs: 71 FRED series and 10 direct-source tables.
Additional data rows: 410,649. Total data CSVs in this archive: 155.
All earlier suggested common-market, economy, bond/yield, equity, trade and debt/ownership datasets are included.
The remaining nominal Treasury curve tenors were also saved locally. Existing FRED series and external datasets were preserved.

HOW TO FIND THE FILES
FRED series: this folder, named by exact FRED ID.
Direct Treasury, Federal Reserve and Census tables: External sources subfolder.
Additional_Download_Inventory.csv: one row per new data CSV with titles, units, dates, source URLs and checksums.
The original FRED_Download_Inventory.csv and External_Download_Inventory.csv still describe the original collection.
Supporting original JSON, XLSX, ZIP and PDF downloads, extraction scripts and validation results are in _download_support/additional_20261116.

HISTORY AND SOURCE LIMITS
Native source frequency, values and observation-date labels are retained. Missing values are not zero.
Monthly and quarterly FRED dates can label the full period containing the cutoff (November or Q4 2006). Annual fiscal-year dates are retained.
These are current revised histories where supplied; they are not ALFRED real-time vintages.
Treasury security-detail amount fields retain the source markers * and (*). Treat these as marked source amounts, not numeric zero.
Older monthly budget figures are rounded to whole USD millions; receipts less outlays can differ from the published surplus/deficit by USD1 million due to that precision.
ICE BofA series provide about three years through FRED. S&P 500 and Dow provide about ten years. Other shorter histories are listed below.
Provider source pages and their attribution/use conditions are saved; this local download does not grant public redistribution rights.

DEBT OWNERSHIP
Treasury_OFS2_Ownership_20Y.csv provides 79 consecutive quarter ends, December 2006 to June 2026, from four official archived Treasury bulletins.
Each row records its source PDF, page and publication month. The newest of the four downloaded publications wins overlaps.
This is a mixed-publication historical series. Older values can have subsequent revisions not reflected in the selected publication.
The latest quarter has some unavailable investor categories; blanks and original tokens are retained. No interpolation is used.
The Fed and government accounts are combined in OFS-2. Privately held debt includes foreign holdings.
The separate Fed Financial Accounts stocks file provides detailed sectors at market value, and has parent totals and subcategories.
Transactions files are separately supplied as not-seasonally-adjusted quarterly flows and seasonally-adjusted annual rates.
Do not sum overlapping categories or join face-value and market-value amounts as an exact ownership reconciliation.
Treasury_OFS2_Ownership_Publication_History.csv retains all API publications. Its documented pre-March-2024 zero placeholders have a blank usable-value field.
The existing Treasury TIC country history is retained. Custodial country may differ from ultimate beneficial-owner country.

COUNTRY TRADE
Census country table: goods only, Census basis, not seasonally adjusted; through September 2026.
Unpublished all-zero October-December 2026 placeholders were excluded. Valid country/month zero observations were preserved.
Country codes and overlapping geographic groups are retained. Do not sum groups with their member countries.
Goods-and-services BOP totals in BOPTEXP/BOPTIMP use different coverage and adjustment from this country table.

KNOWN SOURCE DISCREPANCIES
The Debt to the Penny source has two rows where total minus public minus intragovernmental is nonzero:
2011-02-01: -$0.03; 2025-08-04: -$10,000,000,000.00. Original source amounts are retained without inferred correction.
Details and unmodified source JSON are saved in the support folder. OFS-2 totals/components reconcile within published rounding.

SCOPE
Published in the shared Market Intel archive. The existing monthly three-month overlap refresh now covers the complete collection.

SHORTER FRED HISTORIES
BAMLC0A0CMEY: 2023-11-14 to 2026-11-12
BAMLC0A4CBBBEY: 2023-11-14 to 2026-11-12
BAMLCC0A0CMTRIV: 2023-11-14 to 2026-11-12
BAMLEMCBPIEY: 2023-11-14 to 2026-11-12
BAMLEMCBPIOAS: 2023-11-14 to 2026-11-12
BAMLH0A0HYM2EY: 2023-11-14 to 2026-11-12
BAMLH0A1HYBBEY: 2023-11-14 to 2026-11-12
BAMLHYH0A0HYM2TRIV: 2023-11-14 to 2026-11-12
DFII30: 2010-02-22 to 2026-11-12
DJIA: 2016-11-14 to 2026-11-13
PCEC96: 2007-01-01 to 2026-09-01
SP500: 2016-11-14 to 2026-11-13
VXVCLS: 2007-12-04 to 2026-11-13

ORIGINAL COLLECTION NOTES
FRED OBSERVATORY — CURRENT FULL HISTORY


MONTHLY REFRESH 2026-11-16T16:23:03.827878+08:00
Latest three calendar months fetched; lagged latest source periods included. Native values merged by observation date, TIC date/country, auction date/CUSIP. Fresh explicit rows replace duplicates, including source-missing values. Older observations remain. Prior published snapshots are unchanged. See refresh-report.json for source outcomes and revisions.json for corrected rows.

The following notes describe the original 20-year download, not the current refresh schedule.
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
