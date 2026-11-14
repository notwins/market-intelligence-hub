# Beta Shares

The V4 Historical charts section includes `#history/beta-shares`. Its chart,
card and heatmap table views compare selected shares using the same dated
Bloomberg return snapshot. Current earnings and watchlist cards expose the
same returns in an expandable detail section.

## Return basis

The supplied export's start dates are 1 January 2019 through 1 January 2026.
Its paired annualised and holding-period returns imply a common end date of
19 September 2026 under ACT/365. The owner confirmed local currency and gross
dividends reinvested. No common-currency or after-tax return is implied.

Annualised values measure compound annual growth from the selected start date.
They are not individual calendar-year returns. Completed calendar years are
derived from adjacent cumulative holding-period factors:

`year y return = ((1 + HPR(y) / 100) / (1 + HPR(y+1) / 100) - 1) * 100`

The 2026 value is the supplied holding-period return from 1 January 2026 to
the inferred cutoff. It is labelled YTD and is not annualised. Missing periods
remain missing. Charts do not interpolate unavailable years or mix these
returns into the existing historical closing-price series.

The return cutoff does not establish an effective date for each credit rating,
fundamental reporting period or old CSV price. Ratings retain agency, scope
and withdrawal/not-rated markers. Unknown currency, units and reporting
periods prevent use of raw CSV monetary fields for cross-market comparisons.

## Current data and sorting

Existing BOS/current-price selection and Yahoo fallback remain authoritative.
The enrichment snapshot never replaces a current quote or scheduled feed.

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
