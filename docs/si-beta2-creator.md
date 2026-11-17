# SI beta 2 one-pager creator

`si-beta2.html` sits beside SI Pricing in the shared History navigation. The
original SI list, prices, watchlists and reference bytes remain unchanged.

The page has manual entry for one to four shares, initial KO, KI, strike,
monthly step-down in percentage points, tenor and coupon. Extra controls expose
coupon basis, tenor units, the first step-down month, KI observation type,
issuer, exact reference date, manual reference prices and optional descriptions.
Blank financial inputs are not zero. Final KO is initial KO less the monthly
step times the number of months from the first step month through maturity,
inclusive. This is an explicitly labelled illustration, not a payoff engine.

Each page is a private copy. Imported records retain rounded/photo-unverified
provenance, unknown coupon basis/tenor units and missing step-down. Source dates
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
