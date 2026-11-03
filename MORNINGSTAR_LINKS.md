# Morningstar ticker links — 3 November 2026
Shared, exchange-aware browser mapping in site/morningstar-links.js uses the 161 existing user-supplied directory URLs plus:
- MU / NASDAQ: https://www.morningstar.com/stocks/xnas/mu/quote.html
- TSM / NYSE, US-listed ADR: https://www.morningstar.com/stocks/xnys/tsm

The two additions were identity-checked against Morningstar's indexed official pages on 3 November 2026. Direct fetch returned HTTP 403; availability and paid access are not guaranteed. No market figures, research bodies or screenshots were imported. Existing directory links retain their user-provided provenance, not a new full verification claim.

V3/V4 article text and the standalone GOOGL report link recognizable uppercase ticker references. Explicit venue-qualified symbols must match the exchange. Ambiguous bare words and short symbols outside the watchlist remain plain text; company-name inference is intentionally not used. Reuters headline/source links remain intact, no nested anchors. Dynamically rendered reports are processed again without duplicating links. Archived source JSON stays unchanged. External links open a new tab with noopener noreferrer.

No scheduled prompt modification is needed: this is a display-layer enhancement used whenever saved content renders. It does not make the news or data live.

Checks: node scripts/test_morningstar.cjs; existing V3/V4/mobile and Python suites. Browser visual QA unavailable in this executor because Chromium socket permissions prevent startup.
