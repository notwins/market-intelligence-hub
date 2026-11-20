# SI Pricing historical reference

The Historical charts desk includes a separate SI Pricing tab at `v4.html#history/si`. Two restrained shortcuts lead there from the Shares watchlist and the phone More menu.

`site/data/si-pricing-reference.json` contains 246 allowlisted, rounded historical source records. It contains basket codes, source dates (null when not shown), currency, the source tenor number, rounded coupon/strike/KO/KI percentages and a review flag. SI reference labels are display labels only. There are no client, account, ISIN, original row or photo identifiers, links to original inputs, or unrounded source fields.

The historical photo transcription is not an independent native-workbook or issuer-term verification. Coupon basis and tenor units remain unconfirmed for the original 225 records. New indicative pricing rows retain the screen labels months and per-annum, without claiming independent issuer verification. No annual yield, duration, return, current price or payoff is calculated. All percentages are whole percentage-point displays: strike/KO/KI up, coupon down. The public UI identifies these adjustments and does not call the source-derived data wholly fictional or present the rounded numbers as exact traded terms. Thirteen original priority-review flags are retained; the ten new SGD rows also require date confirmation. Similar-looking source records remain separate; record counts are not trade volume.

The source photos and generated transcription workbook are not public downloads. Updating this data requires repeating privacy checks, matching the approved source, testing direction of rounding and retaining limitations. Never fill missing source terms with zero or attach months/p.a. without new source evidence. Missing screen dates are null, displayed as Date not shown, and require additional review.

Run `node scripts/test_si_pricing.cjs` and `python -m unittest scripts/test_si_pricing.py`, plus the publishing workflow checks.

## Pricing-screen additions, 16 November 2026

Appended SI-226 through SI-246: eleven USD and ten SGD NVDA/TSM records.
All original 225 records and display references remain unchanged. These are
indicative pricing-screen results, not executed trades or current quotes. The
result column is solved strike, not coupon. The screen terms show 11 months,
8% p.a. coupon, monthly KO, and European KI. Public strike levels continue to
round up to whole percentage points; coupon remains 8%. USD KI is 70% and
SGD KI is 75%. KO inputs run 100% through 90% for USD and 100% through 91%
for the complete SGD rows.

The USD screen shows 13 November 2026. The SGD date is not visible and is
stored as null pending confirmation. The clipped final SGD row is excluded;
its remaining terms must not be reconstructed from neighboring rows. Exact
transcription and both photos are retained locally outside the repository.

New rows carry only three additional allowlisted fields: source_kind
(indicative_pricing), tenor_unit (months), and coupon_basis (per_annum).
The original dataset defaults remain unconfirmed and apply to legacy rows.
The optional top-level `ko_step_down_pp` map records the 1.50 percentage-point
step shown for those 21 records. SI beta 2 displays it in the reference list.
Rows without a captured step stay blank. The map does not supply the first
step-down month or change the schedule in a draft. Counts and known date ranges
are validated against the data rather than a fixed 225-record limit. The SI table, grouping detail and matching desk cards
retain the distinction between screen labels and independently verified terms.


## Compact quick filter, 21 November 2026

The SI Pricing route has an always-visible quick filter above the collapsible
reference list. Four exact underlying selectors offer the 20 most frequent
non-Singapore shares in the saved SI rows, followed by five Singapore choices
(DBS, OCBC, UOB, Singtel and SGX), then the remaining source codes. These are
navigation shortcuts, not a market-cap ranking. Missing matches stay empty.
Native dropdowns support keyboard selection; tiny local logos sit beside the
selected shares and source basket labels.

Non-empty share slots combine with their AND/OR selector. AND binds before OR;
the active basket expression is shown with parentheses. Currency, tenor and
numeric ranges intersect that basket condition. Tenor 1–11 filters the source
number without assigning months to legacy rows. Coupon p.a. bounds initially
match only rows with a per_annum screen label. The explicit Include unconfirmed
coupon basis option permits legacy source percentages while retaining their
basis warning. All bounds are inclusive. Blank bounds are inactive, zero is a
real bound, and reversed or negative bounds produce a visible validation message.

Optional Strike/KI/KO/KO-step-down ranges sit to the right on desktop and fold
on phones. Absent step-down values fail an active step-down range and are shown
with a dash in the reference table. Filtering never modifies source data.
Filtering opens the result list and updates the complete-source pivot count;
reset clears all quick controls, search, currency and review filters.

Selected-share price hints use the existing MarketPrices.currentQuote selection:
BOS first for an exact listing and currency; Yahoo is the existing fallback.
Each hint retains the source label, listing currency and observation date. No
new quote collector, schedule or market-data branch is introduced. The logo
identity aliases for Singapore companies and SK Hynix do not merge securities.


The share selectors use the shared searchable SISharePicker: each option and
selected identity places its local company logo, company name and ticker inside
the field/menu. Typed search text does not filter the SI records until an option
is selected; Escape restores the prior selection. Native keyboard navigation,
Any share and Reset remain available. Both SI reference tables use an explicit
two-column basket grid so four underlyings always occupy two rows of two.
Beta 2 uses its existing local logo catalogue for the reference list and keeps
its source basket order and private draft values.
