# Count-only grouping explorer

This progressively enhances the current V4 source-data tools. It does not change the source JSON, saved workspaces, watchlists, source terms, pricing, financial engines or reporting cutoffs. It makes no request to an external service and stores no record data in persistent storage.

## Exactly where

| Current source table | Full loaded source | Columns | Location |
| --- | ---: | ---: | --- |
| Security Master | 8,466 records | 20 source fields (7-column result grid) | Security Master explorer and Pivot explorer tab |
| Full UST observations | 356 observations | 6 list columns | UST desk, above Cards/Table list |
| SI historical reference | 225 source records | 10 table columns | Historical charts → SI Pricing, expand records |

The rule is strict: **source rows > 50 and columns > 5**. A filtered subset remains explorable even when fewer than 51 rows match, because eligibility describes its full source table. Counts are calculated before source-table pagination. Page filters constrain the current explorer scope. Matured UST rows already excluded by the existing UST filter remain excluded from that scope; the source dataset is not deleted or relabelled.

Source row counts above describe the bundled snapshots at implementation, not permanently fixed future counts. The runtime reads actual source rows and resets on source version or scope changes.

The 12-name share watchlist, external-source catalogue (5 columns), yield/FX history (2–3 columns), and small editorial tables do not qualify. No immutable research article is rewritten to add this component. The master does not contain country, sector, market cap or P/E data, so those groupings are not invented.

## Behaviour

- The original category/currency or default grouping remains visible. A selected cell, row total, column total or grand total creates a working grouping below it and shows contributing records.
- Cell selections constrain both axes; row and column totals constrain only their actual axis. Grand totals add no hidden filter. Zero counts are visually blank, not missing observations.
- A new click in the original master starts a branch from the original scope. Breadcrumbs remove that step and all later steps. Undo restores the prior drill/group state; Reset returns to the current source scope.
- Rows (Y) and Columns (X) are explicit. Change groups opens an editor; Swap, Apply and Cancel are available. On phones it uses a compact bottom panel. The host's original table remains intact.
- Suggested next groups use available source fields, not recommendations or inferred analytical relationships.
- Aggregation is **source-record count only**. No mixed currencies, coupon rates, yields, prices, duration or ratios are summed. SI counts the complete basket once, not once per underlying share.
- Numeric fields get neutral, human-readable, non-overlapping ranges from the complete source dataset. Boundaries stay fixed during drilling. Lower bounds are inclusive, upper bounds exclusive, except the final inclusive upper bound. Unreported values form a distinct `Not supplied` group; zero stays a real number.
- High-cardinality categories keep the most frequent groups plus a visibly labelled Other group. Membership is fixed from the full source. SGD and AUD appear first when present.
- Canonical SI company/currency colours reuse the existing V1.2 mapping and dark variants. Neutral counts and ranges do not imply gains, losses, quality or drill depth. Typography does not shrink as the user drills deeper.
- Matching-record details paginate by 30. These are display projections, not exports or a rewritten dataset. Original full-source tables and source notes stay available.

## Source qualifications preserved

Security Master CPN and duration retain their unconfirmed source labels. No dividend-yield or coupon interpretation is fabricated. UST identity, quote time and raw price convention remain unverified; raw bid/ask strings are never parsed as decimal prices in the pivot. SI tenor units/coupon basis remain unconfirmed, percentages remain the already-rounded hypothetical reference, and no live offer is inferred.

## Checks

- `node scripts/test_grouping_pivot.cjs` (also invoked by the existing V4 CI check)
- `TABLE_DOM_MODULE=/path/to/jsdom node scripts/test_grouping_pivot_dom.cjs`
- `TABLE_DOM_MODULE=/path/to/jsdom node scripts/test_grouping_pivot_adapters.cjs`

These cover strict eligibility, source totals before pagination, stable buckets/endpoint ownership, missing versus zero, high-cardinality categories, totals/selected-cell depth, group Apply/Cancel, Undo, breadcrumbs, paging, source-filter resets, escaped labels, immutable source data, existing filters and approved SI colour labels. Optional DOM tests do not claim a rendered-browser or device visual inspection.
