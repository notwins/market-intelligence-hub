# News tag pivot

A display-only tag explorer is available above the saved Reuters coverage results and beside the saved hourly news timeline. It does not generate reporting, change source cutoffs, update prices, alter schedules, or rewrite the source feed, research or summaries.

## Scope and behaviour

- Rows (Y) and Columns (X) use nine categories from the existing public `data/keyword-colour-standard.json`: country/region, political figure, institution, asset/instrument, sector/theme, company/ticker, macro indicator, event and editorial status. Canonical IDs drive membership; the same reference supplies the exact light/dark label colours.
- Click a non-empty count to add both axis tags. Row and column totals add only their corresponding tag. Grand totals add no hidden filter. Breadcrumbs remove individual tags. Undo restores the prior complete tag/group state; Reset clears tag selections without clearing text search, existing topic/status choices or other page filters.
- Each category selects one canonical tag; selected categories intersect (AND). A record can have several tags in one category, such as both United States and Mainland China.
- Cells and row/column totals count unique article/story IDs. They overlap when an article has multiple tags, so adding cell counts is not a valid grand total. The displayed grand total counts each source article once.
- Empty cells mean zero. `Not tagged` is a separate internal sentinel, not a source category. It means the conservative display matcher did not identify a tag, not that the subject is absent from the original article.
- The normal Reuters advanced filters remain available. The new pivot filters the resulting full saved feed before its 80-record pager. It never limits membership counts to the current page.
- Hourly filtering runs only after the existing `versions()` grouping: one highest-version card per `story_id`, with previous versions attached. Its status, topic and query controls, scan history, source links and report summaries are preserved. Typing updates the timeline and pivot region without replacing the focused search input.

## Matching boundaries

Matching uses NFKC-normalised whole-token phrases with the public reference’s aliases and stable IDs. It uses explicit headline terms and supplied ticker/status/freshness metadata, not article bodies, hypothetical positions or inferred company geography.

Ambiguous short symbols are restricted. `US` does not match `USD` or `US$` amounts; Fed does not match FedEx or the verb “fed”; North Korea does not become South Korea through the short alias Korea. LATAM airline headlines do not become Latin America; pension default and the verb cloud do not become debt-default or cloud-sector events. Known canonical company acronyms and explicit saved tickers are not limited to the smaller external-factsheet directory. Editorial statuses come only from supplied metadata, never words such as “new” in a headline.

Tag membership and text-colour precedence are different: `US Treasuries` can identify both the instrument and United States. A country name contained only within a matched company name does not manufacture a country exposure tag. No aliases, colour assignments or canonical reference files are changed by this feature.

Public article links remain available; private chat destinations are omitted from the public hourly reader.

These are conservative navigation tags, not completed research classifications. Source date, summary verification, reporting precision and previous versions retain their original meanings.

## Verification

- `node scripts/test_news_tag_pivot.cjs`, invoked by the existing V4 CI check.
- `TABLE_DOM_MODULE=/path/to/jsdom node scripts/test_news_tag_pivot_dom.cjs` for actual DOM cells/totals, filters, missing tags, group Apply/Undo, keyboard focus, palette markup and preserved hourly query typing.
- Existing headline, headline-pagination, news-reading, hourly-precision, Boolean-search and full publisher regression checks remain required.

The bundled source at implementation contains 240 daily headline IDs and 39 unique hourly story IDs from 45 retained versions. Runtime counts read the current saved source and existing page filters. No dataset or private conversation is copied into this component. Rendered-browser/device visual QA is separate from DOM tests.
