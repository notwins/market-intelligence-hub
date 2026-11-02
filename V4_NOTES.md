# Market Intelligence Hub V4 — 2 November 2026, Singapore

Requested updates implemented:

1. Use the available workspace width, including the empty space seen on wide or zoomed-out screens.
2. Arrange cards, charts and data side by side automatically when they fit. Settings offers automatic, one-column and two-column layouts.
3. Add independent Card size controls from 50% to 150%. These adjust target card width, padding and gaps without scaling text.
4. Extend text enlargement from 90% to 200%. Card size at 50% and text at 200% is supported; cards may grow taller or stack to keep content readable. Percentages describe layout targets, not a forced reduction in every physical dimension.
5. Keep exact-value tables scrollable within their cards. Wrap long labels and move event names into a wrapping legend beneath the history chart.
6. Make section and History/Security master subtab URLs change on navigation, with matching browser titles and working Back/Forward navigation. Routes use fragments and do not reload the page for each section change.
7. Keep V3 as the default for browsers without an explicit V4 selection. Open Settings → Dashboard version → V4. This choice is remembered for the main entry page; direct V3 and V4 links remain explicit.
8. Retain the original V3 HTML in `site/v3-backup.html`. The existing V3 page receives only a Settings version-selector hook. V3 CSS, display script, engines and datasets are unchanged. V4 has separate display preferences and continues to use the existing browser-local research workspace.

No new market-data feed, polling cadence, financial calculations or dataset publication is introduced by this release. Changing a section URL/title is a local browser operation with no additional network fetch; ordinary lazy data loading remains unchanged.

Validation: run `node scripts/test_v3.cjs`, `node scripts/test_v4.cjs` and the existing Python publisher tests. Browser QA covers wide-screen layout, compact cards with maximum text, phone reflow, version switching, preference persistence, section/subtab history and browser errors. Physical Safari is not verified.
