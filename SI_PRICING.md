# SI Pricing historical reference

The Historical charts desk includes a separate SI Pricing tab at `v4.html#history/si`. Two restrained shortcuts lead there from the Shares watchlist and the phone More menu.

`site/data/si-pricing-reference.json` contains 225 allowlisted, rounded historical source records. It contains basket codes, source trade dates, currency, the unconfirmed tenor number, rounded coupon/strike/KO/KI percentages and a review flag. SI reference labels are display labels only. There are no client, account, ISIN, original row or photo identifiers, links to original inputs, or unrounded source fields.

The historical photo transcription is not an independent native-workbook or issuer-term verification. Coupon basis and tenor units remain unconfirmed. No annual yield, duration, return, current price or payoff is calculated. All percentages are whole percentage-point displays: strike/KO/KI up, coupon down. The public UI identifies these adjustments and does not call the source-derived data wholly fictional or present the rounded numbers as exact traded terms. Thirteen priority-review flags are retained. Similar-looking source records remain separate; record counts are not trade volume.

The source photos and generated transcription workbook are not public downloads. Updating this data requires repeating privacy checks, matching the approved source, testing direction of rounding and retaining limitations. Never fill missing source terms with zero or attach months/p.a. without new source evidence.

Run `node scripts/test_si_pricing.cjs` and `python -m unittest scripts/test_si_pricing.py`, plus the publishing workflow checks.
