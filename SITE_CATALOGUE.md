# Tag catalogue and public-site search
Implemented in requested order: colored taxonomy first, then search/grouping.

- site/tag-map.html is a single self-contained HTML file: 14 roots, 515 nodes, 124 described branches, category-family colors, search, nested native details, expand/collapse and official reference links. Proposed vocabulary is clearly labelled; it is not a list of verified events or an exact recovered assistant reply. Earlier user instructions were accessible, older assistant full-map replies were omitted.
- site/search.html indexes public saved local content using scripts/build_site_search.py. Every stored daily headline in news and archive JSON is included (not the 80-row presentation limit). Counts and coverage limits appear in the UI.
- Includes sections, original research editions, reports, earnings, saved hourly edition, watchlist, directory references, security master, UST names, historical series, learning chapters, public HTML text and all taxonomy nodes. No candidate UST identifiers or AR values are promoted as verified. Source bodies on external websites, private chats, PDFs and user-local imports are not indexed.
- Plain text snippets are extracts, not generated article summaries. Unknown dates stay labelled. Index build time is not a market-data observation.
- The existing Pages workflow rebuilds the index after its existing feed-refresh step and before committing/publishing. No cron, Reuters task, source prompt or data-refresh behavior changed. New indexed records reflect the files included in that publication.
- V4 has global catalogue/search links and links in Reuters coverage; no V5 redesign is deployed.
- Test scripts: test_tag_map.cjs, test_site_search.cjs, existing headline/Morningstar/mobile/V3/V4 and Python suites.
- Visual browser QA cannot be claimed in this executor: Chromium previously failed its socket permission check.
