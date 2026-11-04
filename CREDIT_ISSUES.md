# Dated issuer-spread desk

This module covers original USD new-issue pricing, not secondary-market prices or live spreads. It keeps broad index OAS, sovereign/local-currency yields, and Treasury spreads separate.

## Initial coverage

23 tranches across seven issuers: the ten previously published TI, P&G, CBRE, Main Street and KeyCorp records are retained without changing values. Eight fixed-rate Microsoft tranches priced 29 October 2026 and five Oracle tranches priced 2 November 2026 are added from final SEC pricing sheets. Microsoft’s two SOFR floating-rate notes are excluded from the Treasury-spread comparison. Expected settlement is not represented as confirmed completion.

- Microsoft: https://www.sec.gov/Archives/edgar/data/789019/000119312526439794/d799291dfwp.htm
- Oracle: https://www.sec.gov/Archives/edgar/data/1341439/000119312526443918/d87441dfwp.htm

Both final documents give pricing dates but no exact intraday quote time. `pricing_time` stays null. Edition `checked_at` is an import/source-check timestamp, not a market quote timestamp. Legacy rows explicitly state that the original source was not rechecked in this update. Missing legacy benchmarks are null, not inferred.

## UI integration

`site/credit-issues-data.js` provides the same structured data as `site/data/credit-issues.json`. `site/credit-issues.js` renders a summary card and an issuer/date-filtered desk, with expandable price, coupon, issue yield, Treasury benchmark and source details. Dates, counts, chart scale and issuance-event entries derive from the data. Default coverage is the 13 Microsoft/Oracle technology/AI tranches, with all 23 available through the issuer selector. No row is treated as a company-wide risk ranking.

V3/V4 use small hooks: CSS include, data/module includes immediately after v2-data.js, and conditional calls from spreadCard(), the overview issuance mini-stat and the existing new-issuance section. The credit AI-financing card also uses the verified BIS paper URL directly instead of relying on the mutable first research-array item. The legacy rendering remains as a fallback. Preserve independent changes to creditView(), such as report-reader wording, during integration.

## Import and scheduling boundary

The old chart was disconnected from newly imported report text. The repository workflow refreshes Reuters daily and Fed history weekly; it has no issuer-pricing extraction step. This change adds a validated import path and regression checks, not a new schedule. It does not parse prose or fetch prices automatically. New rows must be verified against final primary documents and imported as new immutable editions. Refresh the page after an edition is published. Do not change the historical pricing date to today's date.

The standalone importer prepares candidate JSON and JS assets, retaining every earlier edition. Use its `--help` and default dry-run before an explicit candidate output. Review, test and publish through the existing guarded publication process. No arbitrary source should be accepted merely because the data is reachable: public redistribution rights must be appropriate.

## Intentionally unavailable

No current secondary quote or issuer OAS feed is connected. No current China USD sovereign spread was verified. FRED ICE index data carries redistribution restrictions, so this module does not copy it. Do not substitute CNY government yields, bond coupons, make-whole margins, convertible yields or SOFR reset margins for Treasury credit spreads.

## Verification

- `node scripts/test_credit_issues.cjs`: old-record preservation, counts, source/metric/date precision, filter interactions, arithmetic reconciliation, data-driven range/scale, source safety and V3/V4 hooks.
- `python -m unittest discover -s scripts -p 'test_*.py'`: 106 checks passed, including 35 focused importer checks.
- Existing V3, V4, Treasury curve and mobile checks passed.
- Managed Chrome QA passed at 390px and 200% font: Tech/AI 13, all 23, Oracle 5, date intersections/empty results, expanded benchmark/source, reset, overview count/navigation and the BIS source link. Spread numerals remain unbroken at enlarged text size. Physical Safari was not certified.
- Independent review matched every new Microsoft/Oracle amount, coupon, price, yield, spread, ISIN and maturity to the final SEC sheets. All 13 issue-yield minus benchmark calculations reconcile exactly. Microsoft 2028 correctly says no separate par-call date is stated. The 10 legacy rows were preserved, not independently rechecked.

No deployment is claimed by this document.
