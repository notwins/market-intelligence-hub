# Market Intelligence Hub V3

Released 31 October 2026, Singapore time. Main entry: https://notwins.github.io/market-intelligence-hub/. Direct entry: `v3.html`. V2 remains at `v2.html`; the original dashboard and archives remain at `v1.html`. Old `?view=` bookmarks go to V1, including the original browser-local shortlist. V3 has its own browser-local workspace.

## Research sections

**Security master:** 8,466 supplied ACE rows across 13 currencies. Search by name, exact ISIN or bank security number. Category and currency choices combine as AND between fields and OR within a field. Quote status, source AR, sort and precision sit under More filters. Pivot counts open the matching source records. Select rows across pages, create named watchlists and save filter rules. Source prices, quotes and all 20 raw fields remain available in each detail panel. These are source records, not holdings. Source AR is not validated borrowing capacity.

**Yields & FX history:** 31 unique monthly series and 10,558 observations. UST has 11 tenors, SGS has 9, FX has 11 pairs including a labelled derived CHF/SGD cross. The workbook ends in August 2026; it does not supply current market data. Compare two dates across UST, SGS, or both currencies as four curves. Read exact values and A minus B basis-point changes beneath the chart. Missing tenors remain blank. The individual history view supports a comparison series, date range, FX rebasing to a common first date, contextual event markers and a separately labelled hypothetical path.

**UST selection desk:** 356 supplied WSJ rows. The research reference date controls remaining years and excludes matured rows (353 candidates on 31 October 2026). Screen by maturity, coupon and reported yield; compare up to four rows. The scatter shows observed individual-security yields, not a fitted benchmark, zero or forward curve. Quote time, security identifiers and price notation still require review. Pasted ISINs are displayed as unverified source text and are not joined to ACE collateral fields. The default displays raw prices. Selecting Decimal or Treasury points and 32nds previews an interpretation; it does not verify the notation or recalculate source yields. One negative source yield remains flagged.

## Refreshed files and private workspace

Use More → Data & uploads, choose the correct type and choose a file. Review the import counts before Apply reviewed snapshot. A master import replaces the entire snapshot; it is not a partial price patch. Missing saved identities remain flagged. Identity reconciliation uses case-preserving ISIN, then the original `security-no:` bank identifier, then a snapshot-specific row identity. Source row order alone does not reconcile securities.

Supported master inputs: supplied-layout XLSX (ACE, ACE snapshot or Master sheet), Security Library HTML data block, normalized JSON, CSV/TSV with required headers. History supports the supplied XLSX layout or normalized JSON. UST supports the supplied WSJ XLSX layout, CSV or normalized JSON. XLSX parsing is bundled locally, with bounded decompression and no external script dependency. Raw text is preserved; a JSON master whose normalized values contradict its raw fields is rejected.

Uploads are processed in the browser. Reviewed snapshots are stored in IndexedDB on that browser; lists, notes and selections use localStorage. Rollback previous snapshot requires review and restores the prior local dataset. Replacing UST clears its comparison tray because source-row IDs are not verified instrument identities. Workspace backup/restore covers lists, notes, filters and selections, not the full source datasets. Download a backup before clearing browser data. Browser storage is not cross-device sync; publishing a shared refresh remains an owner action.

## Language and phone use

### Appearance settings — 31 October update

Open the gear beside Language, or More → Settings on a phone. Choose System, Arial, Verdana, Georgia or Office sans (using available device fonts), text enlargement from 90% to 150%, Ocean/Forest/Plum/Sand palettes, stronger contrast, compact/balanced/roomy table spacing, centred/full workspace width, taller History/UST charts and an expanded report reader. Changes preview immediately and persist under the separate `market-hub-display-v1` browser key. Reset display only restores these choices while retaining lists, notes, selections and uploaded snapshots. It does not replace browser pinch zoom, synchronize between devices, modify source values or recolour financial status/chart identities.

The maximum text size was checked at 320px phone width, including Chinese settings and the expanded report reader. Fonts/palettes, reload persistence and reset were exercised in the live browser. The empty selection bar now hides until a row is selected. Normal chart label colours use each palette's darker supporting text; their contrast against white is at least 5.39:1. Physical Safari testing remains outstanding.

English, Simplified Chinese and Traditional Chinese are built into the page. New-section explanations and controls are authored in all three languages. Selected research summaries are translated; instrument names, provider headlines and original full English reports retain their source wording. The page identifies original English report text. There is no Google Translate dependency or translation API fee.

Phone navigation uses Briefing, Master, History, UST and More. Cards replace the master table, extra filters are collapsed, and numeric data tables scroll inside their cards. Responsive browser checks cover widths 320, 375, 390 and 430 pixels. This is browser viewport verification, not a physical iPhone/Safari certification.

## Automation boundary and future connections

The existing GitHub publication workflow and headline/Treasury snapshot refresh continue. Target time is 08:00 Asia/Singapore (`0 0 * * *` UTC); scheduled execution can be delayed. Existing immutable headline and research archives are retained. The scheduled research catalogue and its original chat links remain available. A successful headline refresh does not imply that a new full research edition was imported.

The new full-history MAS, Treasury, Fed FX and WSJ price connections are **prepared, not connected**. `site/data/feeds-v3.json` documents their required fields and targets. This release does not turn on new unattended market-data scraping or API polling. A later connector must preserve provider observation time separately from fetch time, frequency, units, base/quote direction, source URL and revisions. Publish only after validation; keep the last successful dataset and a visible failure state when a refresh fails. Do not use a workbook TODAY() value as a market quote time. Do not join WSJ policy or price fields by pasted ISIN until maturity/coupon identity is verified. Keep credentials out of the public repository.

## Validation and rollback

`node scripts/test_v3.cjs` checks source identities, raw/normalized consistency, filter and pivot counts, missing versus zero, exact-date curves, basis points, CHF/SGD derivation, source exceptions, explicit Treasury notation, escaping and bundled decompression. The publication workflow runs these checks alongside the existing Python archive/feed validation before deploying.

V1 and V2 remain usable fallbacks. To revert the default entry, restore the prior `site/index.html` from GitHub history or point the entry page to `v2.html`. Source files supplied by the user were read only; published market datasets retain their provenance and limitations. Reuters attribution remains visible throughout.
