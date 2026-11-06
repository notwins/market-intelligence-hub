# Publication timeline descriptions

The three-Singapore-calendar-day timeline offers individual Description disclosures and one Open/Close all descriptions control. The all-descriptions setting applies to later pages too. Individual choices survive filtering, searching and Show more during the page session. Rows with no useful saved summary have no disclosure or placeholder.

Descriptions are existing public article leads/meta descriptions or saved report summaries, never generated from headlines. Reuters descriptions require an exact ID/title/publication-date match, `summary_verified: true`, and a public source URL. Repeated delivery/legal/provenance notes live in the shared coverage disclosure instead of each row. Personal order-review pages do not gain description excerpts. Existing public-display sanitization remains applied.

Hub research, Reuters and Scheduled report badges have distinct written labels and shapes, using the existing analysis-purple and neutral-slate treatments. They are source navigation styles, not market signals. Selected explicit title terms retain the existing locked V1 colours confirmed unchanged in Colour & Tagging Standard V1.2 Merged. No ambiguous bare ticker is inferred. The workbook identity and current source folder were verified on 6 November 2026; the companion PDF metadata was verified, but its content fetch was unavailable. Existing layout conventions are retained.

Desktop Markets tables (at least 1000 CSS pixels) now honor the existing Compact/Balanced/Roomy spacing preference and place the closed source control alongside the identity text. The control remains 44px; open details return to full width. Mobile geometry is unchanged.

Checks: `python -m unittest discover -s scripts -p 'test_*.py'`, the JavaScript suites listed in `.github/workflows/publish.yml`, and the publication timeline builder/test. Browser QA should cover individual and global open/close, filtering and searching, pagination, absent summaries, keyboard activation, 390px and desktop layouts, enlarged text, and opening Markets source details.
