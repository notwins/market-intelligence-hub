# Column controls

`site/table-controls.js` and `site/table-controls.css` progressively enhance semantic HTML tables. Load both on a mutable host page. Every leaf column header gets a separate options button; existing header controls, table links and row actions are retained. No network requests, browser storage or source-data edits are made by this module.

Current hosts: V4, V2, archive reader, saved securities, external sources and the saved watchlist reader. V4 covers tables mounted later by its dashboard modules, including SI Pricing. Dynamic table/body replacement is observed. `window.MarketTableControls.refresh(scope)` is available for explicit refreshes.

## Behavior and limits

- Sort ascending/descending or restore original row order; dates are recognized only in unambiguous supported formats. Missing values always sort last. Equivalent values remain in source order.
- Per-column literal, case-insensitive contains filters combine with AND. Sort and filter apply only to loaded rows in the rendered table, within existing groups. Original pagination/search controls continue to control other records. Totals retain their source values and are not recalculated by filters.
- Heat shading is available for scalar numeric columns with consistent units, not identifiers, dates, mixed text or missing-only columns. Five neutral blue magnitude bands use all loaded data rows before column filtering. Explicit signed changes use a purple-to-blue diverging scale centered at zero, with a symmetric loaded range and labeled direction. Missing cells are not shaded; constant columns use the middle band. A legend states the loaded range and units. This is not a gain/loss or quality scale.
- Blue, purple and teal font options use readable paired backgrounds. A focus outline emphasizes one column without hiding other columns. Default colors remain the original financial/source colors.
- Signed percentage formatting is offered only when a header explicitly has `data-table-kind="signed-change" data-table-unit="%"` and its cells contain compatible scalar percentage data. It adds an explicit positive sign and percent suffix without scaling or rounding. The original DOM nodes and precise text are restored when turned off. It never turns prices, counts, coupons, yields, basis-point changes or arbitrary signed values into percentages.
- Totals, spanning rows and row-group separators stay in position. Body rowspans disable unsafe sorting/filtering. Multi-column group headers are not individual columns; controls attach to single-column leaf headers.
- Dialog controls are native keyboard-operable, with Escape, focus return, at least 44px buttons, responsive sizing, high-contrast focus, forced-colors fallback and print hiding. Changes reset when the host replaces a table, as the dialog explains.
- `data-table-controls="off"` opts a table/subtree out. `data-table-static` pins a body row. Optional `data-tc-value` on a cell supplies its explicit scalar/text key when a renderer also shows source notes. Such keys must retain the same units and meaning as the displayed source value.

## Preserved report pages

Standalone immutable research pages and original archived report HTML are deliberately not rewritten. Their original direct-page tables do not receive these controls. Saved watchlist editions read through `watchlist-report.html` receive controls at display time while their archived report HTML and JSON remain unchanged. There is no reliance on the unpublished subsection-navigation work or any protected research modification.

## Checks

- `node scripts/test_table_controls.cjs`: scalar/unit/type policy, sorting, heat bounds and host includes; run in both publishing validation stages.
- `node scripts/test_table_controls_dom.cjs`: optional jsdom interaction suite. Install jsdom in a test-only location and set `TABLE_DOM_MODULE` to that module path when it is not on Node’s module search path. This covers behavior without claiming browser layout verification.
- `node scripts/test_table_controls_browser.cjs`: interactive Chromium regression coverage with a local site server on port 8771 (`TABLE_TEST_URL` overrides the URL). Covers source precision/restoration, header/body replacement, grouped totals, rowspan safety, original controls, repeated actions, keyboard/focus and mobile sizing. This runtime cannot launch Chromium because Unix sockets are blocked, so browser checks must run in an executor that supports Chromium before treating layout/interaction QA as verified.

Design reference: Colour & Tagging Standard V1.2 Merged workbook (5 November 2026). Its exact-value, unit, missing-data and labeled sequential/diverging-scale guidance informs these controls. Companion PDF guidance was not verified for this change. Semantic entity/tag mappings are not changed by optional display choices.
