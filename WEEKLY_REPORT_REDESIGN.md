# Weekly credit and earnings reader · 6 November 2026

The current V4 report pop-out is widened to 1,480px (bounded by the viewport) and nearly full height, with a single scrolling surface and an accessible persistent Close control. Phones retain a near-full-screen reader. Text follows the user's existing browser display font and scaling controls.

Ten public extracts dated 2–6 November are rewritten as a separate editorial layer: a takeaway, dated key figures, short reported-fact/analysis sections, source links, watchpoints and explicit coverage. The saved `v2-data.js` editions, archives, numbers, cutoffs and source links are not rewritten. Original text remains available in a collapsed section. A changed source text disables that edition's rewrite until reviewed again.

Charts include recent Treasury curves, actual/consensus earnings comparisons, and clearly labelled IREN target timing. Prior/next edition navigation and a date selector keep old reports accessible. Older unsupported editions retain the existing reader.

Fixed a pre-existing unclosed mobile CSS block that had accidentally confined subsequent reader rules to phone widths.

## Evidence and design

Latest Treasury 5 November values, IREN fiscal Q1 2027, Tapestry fiscal Q1 2027 and the Bank of England 5 November decision were rechecked against their primary linked sources on 6 November. Earlier edition data remain their previously verified public extracts. Calculated beats are explicit; forecasts, adjusted measures, quarterly observations and annualized run rates stay distinct. Restricted ICE numerical series are not newly reproduced.

Colour & Tagging Standard V1.2 Merged workbook was verified against the current OneDrive file (5 November revision). Fact and analysis labels use its Macro Slate and Policy Plum mapping. Existing chart/category colours are preserved. The workbook’s UI/layout guidance and the existing site design supply the presentation rules.

## Checks

- `node scripts/test_scheduled_reports.cjs` includes `test_weekly_report_editorial.cjs`.
- Ten source matches, immutable original editions, source indices, safe links, fail-closed changes, chart units/periods, date navigation and CSS brace regression.
- V4/shared application regression suite and Python publisher checks.
- Browser QA: report open, close, previous/next, date selection, in-reader jumps and mobile/desktop layout.
