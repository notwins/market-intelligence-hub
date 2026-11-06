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

## Boolean search and location labels (4 November 2026)

- The existing search page supports case-insensitive AND, OR, NOT, parentheses, quoted phrases, text: and tag: fields. Adjacent terms mean AND. Precedence: parentheses, NOT, AND, OR. Invalid expressions show an error, never silently broaden results. Input and nesting are bounded; no eval is used.
- Company-name/ticker aliases include Google / Alphabet / GOOG / GOOGL, Microsoft / MSFT, Amazon / AMZN, Apple / AAPL, Nvidia / NVDA, Meta and Tesla / TSLA. Company tags describe explicit saved-text mentions, not inferred exposures. Other tags come from saved metadata. Proposed taxonomy labels remain distinct from assigned content tags.
- Clickable tags combine with the existing expression using a chosen AND or OR, wrapping the old expression to preserve its meaning. All matching records are pageable in groups of 40. The Articles & reports option removes reference-directory and taxonomy-only results.
- Each result names its actual site section or saved page, with a location link. Verified dated watchlist links retain their exact edition and company anchor; unavailable dated reports never redirect to the newest report. Section-only links are labelled Open section, not represented as exact article links. Full indexed text can be expanded, without claiming external article bodies are stored.
- Test coverage: test_boolean_search.cjs, test_search_interactions.cjs (DOM-contract tests, not a browser), existing search, taxonomy, watchlist routing and regression suites. Chromium launch remains blocked by the execution environment's socket restriction; visual desktop/mobile checks have not run.

- Company entry clicks now open the combined internal search rather than Morningstar. The overview Google card, automatic ticker links (including nested research pages) and Reuters ticker chips use this route. Explicit external source links remain unchanged.
- Single-company searches have a compact company hub, saved-record counts, the original dated BOS equity-coverage PDF, and a clearly labelled external Morningstar quote/chart link. The BOS 3 November 2026 PDF returned HTTP 200 and application/pdf on 4 November. No PDF body or private report was imported.

## Research context preview

- V4 Research library cards use native More info details before the external report link. Each preserves the existing saved summary, implication, publisher, date and document type; no new numerical findings or publisher claims are generated.
- The three BOS/OCBC references have More info panels explaining their original edition, known scope and access/price limitations. The OCBC list remains unclassified by currency; PDF contents are not copied.
- test_research_context.cjs checks all nine saved research entries and the three PDF panels, text escaping, external labels and context/link ordering.

## CPF LIFE and RA external tool (6 November 2026)

- `tools/cpf-life-ra.html` is a new self-contained public calculator linked from Tools and the site map, opening outside the dashboard in a new tab. It is indexed automatically as a Page; existing CPF/RA tags retain Singapore Jade from the verified V1.2 Merged master.
- It separates hypothetical RA growth from independently supplied income estimates; no private calculator contents or access settings changed. See `docs/CPF_CALCULATOR.md` for maths, source boundaries and tests.
