# Beta Shares

The V4 Historical charts section includes `#history/beta-shares`. Its chart,
card and heatmap table views compare selected shares using a dated Bloomberg
return snapshot for 2019–2025 and the latest available BOS YTD gain for 2026.
Current earnings and watchlist cards expose the same figures in an expandable
detail section, with their different sources and methods labelled.

## Return basis

The supplied export's start dates are 1 January 2019 through 1 January 2026.
Its paired annualised and holding-period returns imply a common end date of
19 September 2026 under ACT/365. The owner confirmed local currency and gross
dividends reinvested. No common-currency or after-tax return is implied.

Annualised values measure compound annual growth from the selected start date.
They are not individual calendar-year returns. Completed calendar years are
derived from adjacent cumulative holding-period factors:

`year y return = ((1 + HPR(y) / 100) / (1 + HPR(y+1) / 100) - 1) * 100`

The default calendar display takes 2026 from the existing BOS feed's
`ytdGainPct` field, labelled **2026 YTD · BOS**. The PDF calls it “YTD Gains
(%)”; it does not specify whether dividends are included or the currency
return methodology. This figure is therefore a **BOS YTD gain**, not a
verified local-currency, gross-dividend total return. It keeps the BOS row's
price observation date separately from the PDF publication date. Values
retain source precision, including reported zeroes.

A single visible note below the results explains the 2026 dividend basis;
it is not repeated on every Beta card. The 13 November 2026 BOS PDF's
table footnotes and end disclosures do not confirm dividend reinvestment.
A DBS/UOB cross-check against Morningstar price and "with dividends"
charts is consistent with dividend inclusion, allowing for the different
12/13 November observation dates and BOS whole-percentage rounding.
This supports only an inference; it does not verify reinvestment or change
the shared API's unconfirmed-methodology status. Morningstar's current
stock total-return glossary includes cash dividends without reinvestment;
that glossary is not treated as a chart-specific or BOS definition.

`ShareEnrichment.ytdFor(item, year=2026)` returns a period descriptor with
the value, source, observation/report dates, basis and availability. It uses
the same exact listing and currency guards as BOS valuations. Missing,
nonfinite, wrong-year and future-dated values stay unavailable; the frozen
19 September value is never substituted. An older valid same-year BOS
observation may remain as an explicitly dated reference. A reviewed BOS-only
listing can show 2026 while its earlier returns and credit remain unavailable.

The original snapshot's 2026 holding-period return to the inferred cutoff is
preserved in the immutable JSON. The holding-period and annualised display
modes continue to use that snapshot for every start year. Completed calendar
years are unchanged. Charts do not interpolate unavailable years or mix these
figures into the existing historical closing-price series.

The return cutoff does not establish an effective date for each credit rating,
fundamental reporting period or old CSV price. Ratings retain agency, scope
and withdrawal/not-rated markers. Unknown currency, units and reporting
periods prevent use of raw CSV monetary fields for cross-market comparisons.

## Current data and sorting

Existing BOS/current-price selection and Yahoo fallback remain authoritative.
The enrichment snapshot never replaces a current quote or scheduled feed.
The 2026 display reads the existing daily BOS feed and refreshes when its
`bos-equity-updated` event arrives; it does not create another scheduled task.

Default share-list sorting uses comparable BOS market capitalisation in USD.
Missing capitalisations sort last with deterministic ties. Explicit alternative
sorts remain available. Chronological price/earnings observations, bond-specific
ordering and frozen published editions retain their meaning and original data.

Security matching uses identifiers and reviewed listing mappings. ADRs, GDRs,
ordinary shares and exchange listings are not interchangeable. Unmatched
records remain unmatched.

## Display and refresh

Canonical company/tag colours follow the existing colour catalogue. Positive
and negative return shading is separate from company identity. Numbers,
labels, chart markers and a zero baseline preserve meaning without colour.

The cleaned snapshot is versioned with the UI. Replacing it requires a reviewed
new import with source dates and method metadata. No existing automation,
schedule or price-history file is changed by this feature.
