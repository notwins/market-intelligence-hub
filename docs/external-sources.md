# External source directory

`site/external-sources.html` is a link manager, not a quote or research-content feed. It loads `site/data/external-sources.json` and supports text search, provider/type/year/access/reference-month filters, multiple topic filters, grouping, sorting, pagination and browser-local saved stars.

## Build inputs

- `site/data/external-source-seeds.json`: 18 official MAS/GIC destinations and 77 bookmark rows. Source identity/access checks are dated 4 November 2026. Duplicate URLs merge their groups; unavailable and limited checks remain labelled.
- Existing `site/data/securities.json`: 161 stock and 489 bond references. No current listing, market value or availability is asserted.
- Existing BOS references and company-report metadata: original external URLs only. Morningstar authorship and BOS hosting remain distinct.
- `site/data/recent-public-sources.json`: 1,047 public source URLs from 42 dated saved editions at revision `1998852d739b31b6e3cc90d139acf0e4b7b524a8`. This includes 723 unresolved Google News redirects. Availability was not rechecked.

- `site/data/supplemental-public-sources.json`: 100 exact public report citations, including 89 additional URLs and 11 overlapping records with saved-report provenance. HEAD-only checks are labelled limited and are not identity verification. These add 110 saved-edition references; the initial combined snapshot has 1,136 dated links in 55 editions.

- The newly public wealth-inequality and CPF OA/Temasek articles at main `807d917` contribute their exact external source anchors, dated from the explicit 4 November article editions. No article prose or private source files are copied. The final directory has 1,915 canonical links, including 1,181 dated sources in 57 saved editions.

The requested archive window is 1 October–4 November 2026 (Singapore time). Available references run 29 October–4 November. Earlier October daily archives were unavailable. This is a bounded snapshot, not a continuous monitor or an exhaustive list of personal browsing activity.

## Rebuild and validate

```
python scripts/extract_recent_sources.py --repo . --output site/data/recent-public-sources.json
python scripts/build_external_sources.py
python -m unittest discover -s scripts -p 'test_*.py'
node scripts/test_external_sources.cjs
```

The extractor reads only committed public source files and makes no network requests. It rejects private conversation, account, credential, file-sharing and uploaded-original URLs. It preserves meaningful URL query parameters/fragments and strips known tracking parameters. It never executes imported bookmark shortcuts.

The pinned-revision reproduction test runs when the source commit is available. In a shallow checkout it is skipped; saved inventory validation, URL/privacy checks, provenance file existence, snapshot counts and directory reproducibility still run.

A `report_date` is distinct from `first_referenced` / `last_referenced`. A `reference_count` counts distinct report/module editions, not visits. A report-period year filter includes both calendar years of a fiscal period such as 2025/26. Group filters match any selected group and combine with all other filters.

One record is retained per conservative canonical URL. Different publisher and syndication destinations, and different substantive URL fragments, are not assumed to be equivalent. Saved stars contain only stable link IDs in this browser’s local storage, and never alter the public file.
