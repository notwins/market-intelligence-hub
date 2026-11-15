# Shared company logo UI — 16 November 2026

The reading desk, detailed overview, watchlist, earnings and research cards share
150 local WebP company logos. Images occupy 198,748 bytes combined. Identity uses
exact ticker/tag mappings, conservative title matches and the explicit three-bank
mapping for STI/Singapore-bank research. General STI-index coverage does not imply
three-bank coverage. GOOG/GOOGL and Berkshire share-class aliases share one brand.

Company headers use a single 40px badge (32px on phones); article metadata uses
24–28px badges and supports several companies. Reuters rows retain their original
source, title, exact available publication time and company logos. Date-only and
unknown timestamps stay explicit. Existing tags and source/dialog links remain.
Logos keep original brand colours and a white backing; no new semantic colours
or replacement market data are introduced.

Assets live in `site/assets/company-logos/`. The compact catalogue records each
source URL, SHA-256 and size. The 100-company baseline is the existing workbook
basket; 50 additional curated names were checked outside that basket and the
retrieved current Top 100. This is an identity library, not a refreshed ranking or
investment recommendation. Company trademarks belong to their respective owners;
editorial identification does not imply endorsement. The source catalogue is
credited to CompaniesMarketCap / CompaniesLogo.

One presentation observer handles dynamic route/filter refreshes without changing
the independent content contract. It deduplicates company marks, reserves image
space and provides a text fallback on image failure. Missing optional logo data
does not suppress articles. All images are same-origin and lazy-loaded.

Scope excludes report contents, financial observations, publication timestamps,
workflows, schedules and credentials. The release is assembled on latest main;
concurrent changes must be reconciled before an expected-SHA branch update.

Validation: `node scripts/test_company_logos.cjs`, existing reader/card tests,
independent publication guard and the complete final Pages artifact suite.
Rendered QA checks company/news cards, STI bank groups, watchlist, earnings,
article dialogs and phone layouts. The optional historical release-lane pilot is
not the active publisher and its old path list is not broadened by this change.

Rollback: restore only the changed UI entry pages and renderer lines on current
main; remove the logo module/style references. Do not reset main, redeploy an old
complete artifact, or roll back any separately published report/feed.

## Extended card sweep — 16 November 2026

The second release covers plain article cards, the overview watchlist teaser,
standalone price cards, publication-timeline entries, Reuters discovery stories,
full-page and quick search results, share-return/explorer cards, issuer cards,
research edition lists and saved stock rows. Cards use their own headings,
explicit identities and exact company tags; a parent never inherits a nested
article's subjects. Repeated price/valuation badges inside company cards are
suppressed. Existing chart, filter, source and navigation behaviour is retained.

Browser regression checks cover nested-card ownership, tag-only bank identity,
STI triple badges, changing identities, replacing headers, cleared identities,
missing-image fallback, phone overflow and existing news/report links. Unchanged
cards reuse their identity result during asynchronous price/data refreshes.
