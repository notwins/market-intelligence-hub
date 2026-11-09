# Dated yield fallback

The user designates WSJ for current US Treasury pricing and Fed/Treasury for historical context. Current WSJ data is not connected: usable timestamped quotes, instrument/convention verification and public-display rights have not been verified. The public page is linked for direct reading; no WSJ table is republished. Existing official snapshots remain labelled historical fallback, not current WSJ quotes. The prior four-series H.15 updater remains unchanged for historical observation usefulness; the briefly introduced eleven-series expansion was withdrawn. No schedule is paused or changed.

The UST comparison desk keeps a separately dated complete prior curve visible automatically if the newest snapshot has missing tenors and a complete observation exists within seven calendar days. Values from different dates are not stitched into a same-date curve. Source links and exact values remain in the table. Historical selected dates are still exact-date observations.

The front-page latest saved UST/SGS view can retain an individual tenor observation from up to seven calendar days before the saved snapshot date. Every retained value has its actual observation date, a Prior observation label and an explicit mixed-date warning. Weekly comparisons remain exact observations on their selected prior session; no monthly proxy, interpolation, forecast or zero is substituted. SGS uses MAS benchmark closing-bid yields, not Treasury par estimates.

No schedule, credential, raw source dataset, historical edition or financial formula is changed. Tests: Python discovery; test_ust_curves.cjs; test_market_snapshot.cjs; test_v4.cjs. Browser rendering was not locally available during preparation.
