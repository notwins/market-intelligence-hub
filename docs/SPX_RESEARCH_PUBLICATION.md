# SPX floor/cap research publication

Published reader: `site/market-understanding/spx-floor-cap-2026-11-05/`.

The reader is a source-linked public edition of the research dated 5 November 2026. It keeps 35 sections, the methodology, presentation guidance, source register and nine charts. It is a hypothetical annual-reset scenario, not actual IFI returns or an executable historical options backtest.

## Verified basis

- NYU year-end price levels, 1960–2025: 65 returns for 1961–2025, counts 17 negative / 10 between 0% and 9% inclusive / 38 above 9%.
- CAGRs: 7.612795% price-only and 5.786322% clipped. Starting at 100: 11,780.2444 versus 3,871.8521.
- Published rounded Slickcharts total returns provide a separately labelled approximate dividend-reinvested comparator. They are not clipped.
- Government-table monthly endpoints, December 2016–December 2025: 109 endpoints, 97 overlapping twelve-month observations, counts 16 / 16 / 65.
- Independent rational-arithmetic and source checks reproduced the headline calculations. Two one-hundredth-point annual endpoint differences between the NYU series and an earlier close capture are disclosed, not silently mixed.
- Option values in the pricing panel are theoretical model results. A 9% call and 0% floor do not by themselves establish zero-premium availability.

## Public edition scope

The raw annual appendix, source HTML/PDF copies, CSV/ZIP downloads and reconstructable full-series charts are not distributed. Four visuals are replaced by original aggregate comparisons. Public access to a source is not blanket redistribution permission. The remaining charts show aggregate distributions, selected regime results, analytic payoffs or illustrative pricing. Data rights are explicitly required before implementing the suggested full-series chart or audit-download designs.

One original worked-example heading is corrected from “Price return” to “Gross payoff return”; the values are unchanged. SVG identifiers are scoped, charts have keyboard-scrollable containers, all sections are in the contents, and the reader has source links and a print/save-PDF control. Source report hash and publication metadata are recorded in `publication.json` without private source links or account identifiers.

## Verification

The publication tests check section/chart preservation, unique IDs, navigation, raw-data exclusion, known arithmetic, an independent Black–Scholes–Merton calculation, source references, disclosure language and integration. Publication also runs the repository's Python and JavaScript regression suites.

Aggregate SVGs were rendered and visually inspected. Local browser rendering was unavailable because the execution environment denied Chromium socket creation, including on the permitted escalation route. A separate live-browser review subsequently verified all 35 sections, nine SVGs, contents links and narrow layouts at 393px and 295px CSS widths using browser zoom. Charts and tables stayed in local scroll containers with keyboard access. That review found threshold labels overlapping a histogram bar; both labels were moved to the empty count=13 area and regression-tested. Native mobile-device emulation and print rendering remain unverified.
