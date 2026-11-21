# SI beta 2 one-pager creator

`si-beta2.html` sits beside SI Pricing in the shared History navigation. Both views use the shared historical SI reference data.

SI and SI 2 also have direct links in the shared primary navigation and the
Historical charts menu. The SI pricing table opens on entry. Company-card SI
references span the card above research and news. Narrow containers stack
Tenor/Coupon, KI/KO and Strike/Step-down in three paired columns; source date and
currency stay with the basket. The nine underlying table fields and their
column menus remain available, with normal page scrolling instead of an inner
scroll box. These display changes reuse the reference data without copying rows.

The reference list shares SI Pricing's quick filter: four logo/name/ticker
selectors with AND/OR joins, currency, tenor 1–11 and inclusive coupon min/max.
The selectors occupy two rows on desktop and four compact rows on phones.
Filters intersect the Full list or SI watchlist and the reference search, without
writing to drafts or favourites. Coupon ranges use confirmed p.a. labels unless
the user includes unconfirmed coupon basis. Reset clears filters and search
while retaining the selected Full list or SI watchlist view.

The page has manual entry for one to four shares, initial KO, KI, strike,
monthly step-down in percentage points, tenor and coupon. Extra controls expose
coupon basis, tenor units, the first step-down month, KI observation type,
issuer, exact reference date, manual reference prices and optional descriptions.
Blank financial inputs are not zero. Final KO is initial KO less the monthly
step times the number of months from the first step month through maturity,
inclusive. This is an explicitly labelled illustration, not a payoff engine.

Each page is a private copy. Imported records retain rounded/photo-unverified
provenance and source-specific coupon basis and tenor labels. A supplied KO
step-down copies into the new draft in percentage points. Blank source cells
remain blank. New reference imports use the default first step-down month of 2. Source dates
are not silently treated as issuer initial-fixing dates. Exact supplied manual
percentages are retained. Barrier prices use reference times percentage/100.
An exact daily reference close is required for a selected date; no nearest-date
substitution occurs. Price charts use the existing hash-verified historical
feed and dated BOS metrics use its existing verified listing mappings. Missing
prices, history, company descriptions and fundamentals stay unavailable.

Collections and SI favourites use the new browser-local key `market-si-beta2-v1`.
Public defaults are blank. Collection import appends to existing pages, and JSON
backup is available. There is no write API, cloud draft storage or client-data
upload. Source PDFs/photos are design references kept outside the repository.
Numbered tabs support arrows/Home/End, duplication and removal with Undo.

The preview uses a self-contained A4 SVG. Selected/all PDF export freezes the
chosen pages and converts the same SVG at twice its preview resolution into PNG
pages. The locally vendored MIT-licensed pdf-lib 1.17.1 combines them into a
downloadable PDF, one SI per page. Exports are image-based for layout and Unicode
fidelity. No external PDF service or user upload is involved. Maximum collection:
30 pages. Unsaved editor changes disable export until applied.

The review area provides Apply/Discard controls, a missing-data summary and a
fit/enlarge preview toggle. Full entered company descriptions are retained in
four-share exports. Downloads have persistent Download/Open links (including a
phone Save to Files hint); changing terms invalidates the previously generated
file. Restored pages wait for enrichment before export, with bounded data-load
and exporter waits. A missing feed leaves explicit unavailable values and allows
manual terms to export. New-page, reference-add, backup and import actions protect
unapplied edits. The reference table keeps Add page visible during sideways scroll.

Run `node scripts/test_si_beta2.cjs`, existing SI/content/navigation checks and
the full Pages artifact validation. Visually inspect exported two/four-share
pages and confirm selected/multipage counts before publication. Roll back only
the creator's files and navigation additions on current main; preserve data and
the independent report reader.

The PDF uses a compact inline terms table and tenor in months (confirmed by the
owner on 18 November 2026). Restored draft tenor units are normalized to months;
original reference JSON remains unchanged. Coupon basis remains as entered.
Charts share an external legend, use five evenly spaced rounded price ticks and
five month-year date ticks with grid lines, and label distinct barrier patterns.
Step-down pages include the final KO price line using reference × final KO / 100.
The existing first-step month controls the inclusive monthly step count.
Matched company descriptions come from ShareStaticData; full source profiles
remain in company cards, while the A4 sheet uses readable excerpts.

Barrier words sit inside clear sections of their own dashed lines. Placement tests
every price-path segment against the label box plus four pixels of clearance,
and avoids other labels. Close barriers use separate horizontal gaps. The price
path is painted last. Only when no clear gap exists anywhere on a barrier does
that label use the outside rail; coincident price data is never obscured.
