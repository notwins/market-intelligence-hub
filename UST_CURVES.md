# Daily UST curve comparison

V4's UST selection desk now includes a separate daily Treasury benchmark panel. The supplied WSJ individual-bond scatter, source warnings, filters, uploads and calculations are unchanged.

- Select a sourced event preset or an exact observation date. Add up to eight historical curves over the latest available curve, with distinct colors, dash patterns, numbered keys, date/context labels and an exact-value table.
- Curves use daily Treasury par yields (% per annum), not the History section's monthly averages. Maturity tenors are equally spaced for readability. Connecting lines are visual guides, not estimated intermediate yields. Missing maturities break paths, and missing dates are never silently substituted.
- Dates and context labels appear at the right on wide screens and below the chart on phones. The latest curve cannot be removed by historical-clear controls.
- The archive contains 9,216 actual daily observations from 1990-01-02 through 2026-11-03. Seven event presets link directly to Federal Reserve policy statements. The March 2020 preset explicitly distinguishes the Sunday event from Monday's observed curve.
- All 37 Treasury annual CSV source URLs, byte counts, retrieval times and SHA-256 hashes are retained in `site/data/ust-curves-daily.json`. Provider blanks remain null, including the discontinued 30Y interval. No private user or client data is used.

## Refresh and data provenance

The historical archive is an explicitly dated publication, not a live feed. The panel also reads the existing `market.json` daily H.15/FRED snapshot. If that snapshot has a newer date, it becomes the latest curve with only its actually observed maturities; absent tenors stay blank. A same-date disagreement is visibly flagged rather than silently replacing Treasury observations. No existing feed, workflow schedule or credential is changed by this feature.

To rebuild the complete history, download the Treasury annual daily CSVs from the exact `raw_sources` URLs, then run `python scripts/import_ust_curves.py --help` for the validated import command. Keep the existing event configuration in `site/data/ust-curves-events.json`. Run Python discovery and `node scripts/test_ust_curves.cjs` before publication. Event significance is context, not a causal claim.

## Testing and rollback

`node scripts/test_v4.cjs` includes the daily-curve tests. These cover data validation, exact dates, multiple additions, duplicate rejection, missing values, latest-feed merging, source conflicts, accessible SVG, markup escaping, and mounted add/remove/clear interactions. Python discovery includes Treasury importer and archived-gap checks.

Rollback should revert only the daily-curve feature commit, preserving later concurrent commits. The feature consists of `ust-curves.js`, `ust-curves.css`, its two data files, importer/tests, the V4 script/style references and the UST mounting hooks. It does not change access settings, source snapshots, positions, or financial calculations.
