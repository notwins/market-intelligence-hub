# Independent UI and content deployment

Cutover inspected Hub main: `3ed568866a968ef0c6d08f4387381f9fc4c46c68`.

## Ownership
| Repository | Source paths | Deployed URL |
| --- | --- | --- |
| market-intelligence-hub | UI HTML, CSS, browser JS; existing legacy reports frozen | https://notwins.github.io/market-intelligence-hub/ |
| market-intelligence-content | site/research/<dated-id>/* and site/data/research-records/<dated-id>.json | https://notwins.github.io/market-intelligence-content/research/<dated-id>/index.html |
| market-intelligence-content | site/data/hourly-news.json and new site/data/hourly-archive/*.json | independent content site's data paths |

The content build derives research-feed.json, site-search.json, delivery.json and
a static direct-link index. Ordinary publication commits contain only a complete
report plus its small immutable record, or a reviewed news feed and new archives.
Pinned validation standards and the fallback renderer belong to content infrastructure.
No runtime dependency on UI main exists. Browser cards retain the Astra design.

## Actual independence
Each repository owns a separate Pages artifact, workflow, deployment and concurrency
queue. Neither pipeline triggers, checks out or deploys the other. There is no shared
release step after this one-time reader cutover. Both remain on GitHub Pages and
share its platform availability. Existing market/Fed/headline jobs in the Hub are
outside this research and hourly publishing separation and keep their schedules.
No paid service, custom domain, credential or cross-repository token was added.

## Safety and rollback
Stable IDs, immutable dated folders, exact file hashes and private review receipts
prevent duplicate or incomplete publications. A retry is a no-op. A conflicting
concurrent main update requires refetch, reapply and revalidation before a non-force
compare-and-swap write. Never overwrite another publisher's feed. Whole content
history is preserved; revisions are new dated records. Builds validate staged HTTP
report destinations before upload and deployed destinations after publication.
A failed build leaves the last successful content artifact. A failed browser refresh
retains verified content and its actual date; there is no silent freshness advance.
A cold browser cannot recover content it never loaded during a content outage: it
shows the frozen local legacy baseline and a refresh failure. No browser storage is used.

Restore only UI paths on current Hub main to roll back a design change. The independent
reader is the minimum supported rollback contract and is checked by CI. Old pre-cutover
UI artifacts lack that reader and must not be redeployed. UI rollback cannot replace
the separate content artifact or remove its newer report URLs. Restore only explicit
content code paths on latest content main for a content-code rollback; do not roll
back reports or deploy obsolete artifacts. A stale workflow rerun is rejected.

## Public boundaries
No client data, private conversation URLs, raw inputs, review receipts or unlicensed
source reproductions belong in either site. The content baseline contains only
already-public news metadata and publication identities, to retain version chains
and prevent reissue. Existing full reports and historical archive URLs stay in place.
Full-report cards require complete reports; extracts never qualify. A Quick read
requires an exact matching edition and hash, otherwise only the full report appears.

## Verification and rollout
Deploy and verify the content artifact first, then the Hub reader. Only after both
are live switch the existing daily and hourly publisher prompts to the content repo,
keeping their schedules. Verify an actual automatic run separately from a manual
publication. Test two racing submissions, duplicate retry, missing brief, failed build,
failed refresh, full-report links, search, keyboard use and mobile layout. Keep
synthetic reports private. Test UI rollback against a separate content deployment.
