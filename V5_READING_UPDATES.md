# V4 reading and phone layout updates · 4 November 2026

These changes selectively carry the remaining Astra V5 reading priorities into V4. They do not replace V4, change financial calculations, or remove saved data, uploads, settings or scheduled publication workflows.

- Briefing credit/earnings cards precede tool shortcuts and promotional cards. Feed freshness remains visible in a compact expandable status notice. The old layout notice is retained in the footer.
- GIC/Temasek/MAS/JPM educational research promotion appears on Briefing and Research library only. Its source destination remains unchanged.
- Reuters topic filters live inside the existing sticky top bar. Extra filters default closed on phones, remain available, and retain their open state across filtering/refresh.
- Headlines and stock text use the selected display font and clearer title hierarchy. Tags follow the title/summary, use smaller labels, and filter on click. Different filter groups combine; active filters have individual removal and clear-tag controls. Selecting another tag within a group replaces that group’s selection.
- Fourteen selected stories have separately source-checked short summaries and distinct context in `data/headline-context.json`. Exact ID, title and timestamp matching prevents attachment to unrelated refreshed stories. 216 rows in the 230-row baseline remain headline-only and are labelled honestly. This is partial coverage, not automated article retrieval or a new wire feed.
- Empty story expansions and repeated general teaching text are removed. ‘Read summary & context’ appears only when meaningful context exists. The general reading guide is available once in expanded filters. Source links remain explicit external links.

Validated locally: 67 Python tests; V3, V4, daily UST curves, mobile structure, headline pagination, headline facets, site search and the new `node scripts/test_news_reading.cjs`. The latter tests exact summary joins, provenance, injection safety, distinct context, tag add/toggle/combine/remove/reset, focus requests and layout integration.

Browser verification is owned by the integration task using the supported site preview. Standalone Chromium could not launch in this executor because of a socket permission limitation, including its one allowed escalated retry. Physical iPhone Safari is not certified. Verify phone/desktop layouts, 200% text with 50% cards, topbar filters while scrolled, per-tag selection and removal, controls toggle persistence, summary/source flows, and company links on the final combined build before publication.
