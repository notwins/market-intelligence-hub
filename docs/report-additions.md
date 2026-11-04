# Additive visual companions (4 November 2026)

Five existing public reports retain their full original HTML bytes, with marked inserts only: a jump link, stylesheet and pale-lilac visual companion. Removing those markers must reproduce the per-page SHA-256 in `scripts/report_additions_manifest.json` (baseline main `44af7a59`). Existing report-section/table/text integrity tests still check the original baseline after stripping the additions, while a separate suite validates the new material.

## Added views

- Alphabet: four-quarter cash flow versus capex, SEC source, with free cash flow and capex/OCF calculations. Source quarter values checked against the 28 October 2026 filing.
- Wealth: published hypothetical net-coupon comparison and a separate, explicitly derived collateral-shortfall stress. The source's unspecified `$` currency is preserved.
- CPF OA / Temasek: selected exact constant-FX annual-cash and terminal-estate scenarios from the existing scenario file, with all material assumptions beside the chart.
- CPF LIFE: fixed default-model spending gaps by death-scenario age. This deliberately does not follow calculator changes; an explicit notice links back to the interactive calculator.
- Market Understanding: original FX-return arithmetic from the existing chapter, not a publisher chart or forecast.

There are six charts and six exact-value table disclosures. Charts use ordinary HTML/CSS with readable labels, numeric values and zero baselines. Tables are keyboard-focusable horizontal regions and default open. No external chart library, tracking, copied publisher slide, private document or new API is included. Only existing public sources and clearly identified author arithmetic are used. Dates are not promoted to live-data status.

The formerly inert Market Understanding Print / save PDF button now invokes the normal browser dialog after a user click. Chapter filters/search and expand controls remain intact. The long companion may paginate when printed; charts/rows retain local keep-together styles.

## Rebuild and checks

- `python scripts/build_report_additions.py`
- `python -m unittest discover -s scripts -p 'test_*.py'`
- `node scripts/test_report_additions.cjs`
- `python scripts/build_site_search.py`
- Existing non-browser JavaScript suites (including CPF LIFE model/UI and original research modules).

Pre-publication: 170 Python tests and 30 non-browser JavaScript suites passed. A second reviewer independently checked baseline preservation, all chart widths, source cash figures, FX arithmetic, collateral stresses, CPF scenario values and print dispatch. The public search catalogue rebuild retains 11,087 entries.

## Verification limits

Actual browser, 360/390px mobile screenshots and browser print layout were not run. Earlier browser launches in this task family were reported denied before execution without recoverable exact reasons; no attempt was made to evade or repeat them. Static responsive/print contracts and non-browser interaction tests are not a substitute for visual browser verification. Closed-details print layout can differ across browser versions.
