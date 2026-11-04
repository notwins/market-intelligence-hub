# In-Hub policy and election report charts

## Scope

The V3/V4 policy page now renders the stored Treasury funding extract and historical election snapshots directly on the page. Election dates are selectable without opening a report. The same charts appear in the on-site report reader. Election/policy cards and readers use public source links rather than private ChatGPT destinations. The original report data and archives are unchanged.

## Numerical provenance

`site/policy-report-visuals.js` includes only the numerical facts already published in the matching records of `site/v2-data.js`:

| Edition | DDHQ source snapshot | Democratic House / Senate probability | Projected Democratic House / Senate seats | RCP Democrats / Republicans / lead | Included fieldwork |
| --- | --- | --- | --- | --- | --- |
| 3 Nov 2026 | 2 Nov, 3:03 PM; time zone not recorded | 84% / 65% | 241 / 52 | 52.1% / 43.3% / 8.8 points | 9 Oct–1 Nov |
| 2 Nov 2026 | 1 Nov, 5:43 PM; time zone not recorded | 83% / 62% | 241 / 52 | 51.8% / 43.3% / 8.5 points | 9–30 Oct |
| 1 Nov 2026 | 31 Oct, 5:26 PM U.S. Eastern | 83% / 63% | 241 / 52 | 51.5% / 43.1% / 8.4 points | 8–29 Oct |
| 31 Oct 2026 | 30 Oct, 2:39 PM U.S. Eastern | 82% / 62% | 239 / 52 | 51.4% / 43.2% / 8.2 points | 8–26 Oct |

These are archived observations, not current results, live polling, or a newly reconstructed historical dataset. The public DDHQ page checked on 4 Nov carries a later 3 Nov, 4:45 PM update with an 84% House / 64% Senate estimate. It must not overwrite the 3 Nov briefing's earlier 2 Nov snapshot. The RCP public page still shows 52.1% / 43.3% for 9 Oct–1 Nov.

The 4 Nov policy extract charts the official Treasury release dated 2 Nov: privately held net marketable borrowing estimates of US$618bn (Oct–Dec 2026) and US$800bn (Jan–Mar 2027), with end-quarter cash assumptions of US$850bn and US$1tn, respectively. The official page was rechecked on 4 Nov. These are estimates rather than realized issuance. The original briefing cutoff remains 4 Nov, 08:06 SGT.

Public sources:
- https://votes.decisiondeskhq.com/forecast/2026
- https://www.realclearpolling.com/polls/state-of-the-union/generic-congressional-vote
- https://home.treasury.gov/news/press-releases/sb0675

All charts are original HTML/CSS graphics. No publisher chart, article, private conversation, iframe, screenshot, or third-party script is republished. Polls, model probabilities, projected seats and borrowing estimates are presented as different measures. Bars start at zero and keep visible numbers. Missing editions are not converted to zero values. This change does not add live data collection or a schedule.

## Tests

`node scripts/test_policy_report_visuals.cjs` checks numerical consistency with the existing public reports, exact dates and units, chart limits, primary-source links, no private ChatGPT links in policy/election cards or readers, missing-data behavior, safe HTML, inline date selection and focus, and both V3/V4 integration points.

Run the existing Python import tests, V3/V4 checks, and `node scripts/test_v4_corrections.cjs` as regression checks. Browser QA should include phone and desktop, inline edition selection, repeated report open/close, public sources, absence of horizontal overflow, and V3 compatibility.
