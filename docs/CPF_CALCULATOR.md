# CPF LIFE and RA modelling tool

Added 6 November 2026 at `site/tools/cpf-life-ra.html`, linked from the V4 Tools cards. This is a new standalone, self-contained public HTML. It does not copy, link to or change the private CPF LIFE Builder.

## Models and boundaries

- RA growth is a full-year approximation, with an initial one-off top-up and optional RA-only extra-interest sensitivity. Actual CPF calculates interest monthly and credits annually. Other accounts, headroom, tax relief, matching grants and changes in rates are excluded.
- Income modelling is independent of RA inputs: separate manually specified level and escalating starting payouts, 2% anniversary escalation and an inflation sensitivity. All defaults are synthetic, not matched official estimates.
- At each birthday cumulative income includes payments in prior completed years only. The monthly amount shown is the next year's rate. Remaining premium is max(0, assumed premium minus cumulative nominal payouts), not total bequest or liquid cash. Basic Plan is explanation-only.
- Official rules and links checked 6 November 2026. 4% RA base rate applies in Oct–Dec 2026; the floor through end-2027 must not be extrapolated as a future guarantee. ERS 2026 is S$440,800. Official source links are in the HTML.
- No account identifiers, client data, external scripts, form submissions or analytics were added. Inputs are memory-only; CSV/print are user-initiated.

## Design

Colour & Tagging Standard V1.2 Merged workbook was retrieved and its version checked against the current OneDrive folder. CPF Board/LIFE and CPF RA keep Singapore Jade #047857; solid/dashed styles distinguish scenarios. Neutral Charcoal denotes remaining premium, with no return-signal meaning. PDF metadata matched the same release, but content retrieval was blocked by a read-only service error; the accessible workbook's design and chart guidance was used. No private standard files were published.

## Verification

Run `node scripts/test_cpf_calculator.cjs` for tier boundaries, marginal top-up growth, zero periods/payouts, invalid inputs, escalation timing, inflation and premium exhaustion. All scripts parse. Source and existing V4 navigation tests also apply. Browser preview checks cover chart rendering, changed and invalid inputs, and narrow-screen layout.

## Change scope

Before: four external tool cards, with CPF only present in research. After: a fifth card opens the new dedicated CPF model in a new tab. All prior tools, reports, data, archives and access settings are retained. The page shares the existing public GitHub Pages origin; it is external to the dashboard view, not a separate Site account.
