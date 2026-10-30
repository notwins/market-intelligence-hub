# Market Intelligence Hub

**Current release: V3 (31 October 2026, Singapore).** The main URL opens V3, with the security master, historical yield/FX comparisons and UST selection desk. V2 remains at `v2.html`; V1 and original archives remain at `v1.html`. See [V3_NOTES.md](V3_NOTES.md) for imports, local saves, Chinese UI, source limitations and future feed contracts. The new full-history and WSJ connectors are prepared, not connected.

Independent research dashboard, restored from the original Market_Intelligence_Hub_Preview.html. The earlier project ZIP was unavailable in this environment. The original layout, 161 Morningstar equity links and 489 user-supplied bond references are preserved.

Site: https://notwins.github.io/market-intelligence-hub/

## Publishing and daily updates

GitHub Pages source must be **GitHub Actions**. The `Daily Reuters headlines and Pages` workflow publishes changes to main and accepts manual runs. It requests a daily run at 00:00 UTC / **08:00 Asia/Singapore**. Scheduled start and publication times are best-effort, not guaranteed by GitHub. Public-repository scheduled workflows may be disabled after 60 days without repository activity; check Actions if updates stop.

The updater reads Google News RSS and accepts only recent items with exact Reuters publisher metadata and a Reuters source domain. It copies headline metadata and publisher links; it does not generate earnings figures, market prices, yields, forecasts or full research reports. No API keys or paid data services are needed for this headline-only workflow. Article access can require a publisher subscription.

`site/data/news.json` is the latest successful feed. `site/data/archive/YYYY-MM-DD.json` preserves the first successful snapshot of each Singapore date and is never overwritten by reruns. The date index is retained permanently in the repository. `site/data/reports.json` contains separately curated historical analysis, not automatically refreshed analysis. Every run records real health in `site/data/status.json`; failures retain previous news, publish a visible error notice and fail the workflow.

## Source discipline

The starter edition was checked against Reuters-syndicated reporting on 29 October 2026. Unsupported EPS comparisons were removed; source evidence links accompany the historical briefs. All displayed historical financial figures are explicitly dated. Directory labels were imported from user-provided research links and are not represented as independently verified terms or live quotes. Check the linked factsheets for current terms and data. No portfolio holdings or client records are included. Shortlists remain only in each visitor's browser.

Reuters, Morningstar and Bondsupermart attribution is retained. This project is independent and is not affiliated with those publishers. Only headlines, short original summaries and outbound links are published; no full articles are republished.

## Maintenance

Run the workflow manually under Actions to validate data refresh and publication. Review failed Actions notifications. Inspect the public data/status.json and headline date. Update curated reports only after checking their sources, keeping prior editions. Restore a previous repository revision and rerun publication to roll back. Do not delete the archive directory.

Local check: `python -m unittest discover -s scripts -p 'test_*.py'`

Local preview: `python -m http.server 8765 --directory site`

Documentation: [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [scheduled workflow behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

## Overview freshness

The overview lead and company coverage use the latest Reuters-attributed company headlines from news.json, sorted by publication time. They change with the daily feed. The separate verified-results panel reads the newest dated report from reports.json; numerical earnings briefs are source-checked before publication. Amazon Q3 2026 results were added on 30 October 2026, with issuer and Reuters-syndication links. The original 29 October edition remains archived. Open tabs recheck data every five minutes and when revisited.
