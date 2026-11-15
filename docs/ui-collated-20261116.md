# Collated dashboard UI release - 16 November 2026

Base: d58fe9c80b1f833a8ddfcf4ed0506b0e853c5314.

The main desk links to the detailed V4 overview and back. Overview teaser and latest-five Quick Read cards use two columns on desktop, one on phones. Quick Read labels saved summaries explicitly and only embeds matching briefs after their existing SHA-256 check.

Overview share charts use area fills and performance shading, with observed dates and one shared ranking period. Subsection navigation uses a forest-green surface, larger arrows and one-second emphasis; reduced-motion users receive a static outline.

Market tables use 36px rows, narrower instrument columns, one decimal for display, historical levels plus absolute/percentage changes, source/date disclosures under the information button, and synchronized Days/Weeks/Months/Years controls on every table. Wide displays append weekly columns to days. Only the seven requested FX pairs appear; three crosses use identical-month averages and never impersonate daily spot rates. The daily SGS table appears once; separate monthly source history is preserved and never substituted into daily comparisons.

The two yield curves share historical overlay controls for 1-4 weeks, 6/12 months and 2-10 years. Latest stays visible, the scale uses 0.5 percentage-point steps, and absent daily history stays unavailable. Official Treasury par-yield fallback remains labelled separately from unavailable current WSJ quotes. SGS data through 13 November was already present on current main; its separate MAS schedule is unchanged.

The Hub decorates the independently published event study at runtime on the same origin. It does not change or copy the immutable report. Nearby event context preserves announcement/implementation distinctions. Quick cap/performance filters and the floating controls preserve native country panels and eligible +12-month ranking semantics; top-five choices are subsets of the native top-ten modes.

Validation covers selected-price versus historical-series arithmetic, identical-date cross rates, half-point axes, multiple overlays, refresh retention and native event-ranking semantics, plus the complete final Pages artifact suite. Browser checks cover desktop and phone layout, modal close/focus, shared periods/overlays, all five event charts/tables, context and bidirectional navigation.

Rollback: restore only this release's explicit UI/script/test paths from its parent onto current main. Keep the independent ContentDelivery reader and all report/data history. Never redeploy a pre-separation artifact or reset main wholesale.
