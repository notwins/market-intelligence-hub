# Shared company static data

`data/share-static.json` is a separate, validated projection of the supplied Excel
stock-data workbook. `share-static.js` provides one `ShareStaticData` reader for
SI beta 2, current price cards (including SI, watchlist and earnings), Beta Shares,
Share Lab, Stocks BETA and the six-company dashboard. Frozen reports and historical
price/return/valuation datasets are unchanged.

The import reads cached worksheet cells and the linked-entity metadata inside the
XLSX ZIP. Excel linked company cells can store `#VALUE!` as their scalar value while
the full company identity is present in rich-data metadata. No formulas, macros,
connections or hyperlinks execute. The original workbook and rejected rows stay
outside the public repository.

Matching requires the supplied BOS ticker, the resolved ticker, exchange and
currency to agree. Exchange-qualified aliases are explicit. Numeric HK aliases
preserve the HK market. Bare symbols are US-only. Wrong-country matches and
unresolved Excel rows are excluded; unknown markets are not guessed. Company
profiles do not cross between ADRs and local shares. The reader rejects conflicting
identities and currency mismatches and retains the last validated data on refresh
failure. Existing nonblank fields and user overrides win when using `enrich()`.

The 17 November 2026 import contains 774 validated listings from 1,131 ticker rows.
324 ticker rows lack resolved fields, and 33 have unsupported or mismatched listing
identities. 749 additional formatted rows are blank. These counts reconcile in the
published metadata. The source worksheet's date-like name is not an observation date.

Descriptions, employees, industry, headquarters, incorporation year and company
shares outstanding retain their workbook meaning. Their observation dates were
not supplied. Import date is labelled separately. Cached prices and market caps
remain under `cachedFinancials`, visible only in workbook source details. They never
replace current quotes, BOS market-cap sorting, valuations or return calculations.
Market-cap currency and the ADR/listed-class basis of shares outstanding are
unconfirmed; no currency or ADR conversion is inferred.

SI PDFs use a short exact excerpt of the matched description and label the snapshot
fields. Full descriptions remain available in company-card details. Manually entered
SI descriptions take precedence. Profiles still load if price history is unavailable.

Reimport with `python scripts/import_share_static.py --input <private.xlsx> --output
site/data/share-static.json --audit <private-audit.json> --imported-on YYYY-MM-DD`.
Check the excluded-row audit before publishing. This is a manual static-data import;
the existing scheduled quote jobs and deployment workflow are unchanged.

Run the static-data Python/JS tests, affected card/SI checks and the complete Pages
artifact gate. Verify a US and HK listing, a rejected cross-market ticker, actual
SI PDF output, and at least one non-SI card. Roll back the explicit UI/data paths
on latest main while retaining current reports, feeds and the independent reader.
