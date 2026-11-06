# Public display privacy and original evidence

The November 2026 privacy cleanup removes the owner's personal labels from mutable
catalogue display text and removes contact placeholders and invitations from the
public legal pages. It does not change legal rights or make the draft notices final.
Operator responsibility, the privacy-request process, app data flows and compliance
review remain unresolved and visibly labelled as such.

`scripts/public_display_text.py` applies narrowly scoped replacements when building
site search, the external-source directory and the publication timeline. It changes
display fields only; IDs, destinations, financial data and receipts are preserved.
Other people's names are unaffected. Watchlist renderer version 2 uses a neutral
project label. Version 1 remains available only to reproduce and validate already
receipted original editions; reimport requires exact original bytes and the unchanged
receipt. New editions use version 2.

## Preserved original exceptions

Under the publication integrity policy, 20 protected original HTML files still
contain personal labels (25 occurrences). Removing them would invalidate existing
preservation receipts or protected baselines. They remain accessible as originals;
their mutable catalogue descriptions use neutral labels. No HTML receipt is rewritten.

All paths below are relative to `site/`:

- `data/watchlist/reports/watchlist-20261103T120000Z.html`
- `data/watchlist/reports/watchlist-20261103T140000Z.html`
- `data/watchlist/reports/watchlist-20261103T160000Z.html`
- `data/watchlist/reports/watchlist-20261103T200000Z.html`
- `data/watchlist/reports/watchlist-20261104T000000Z.html`
- `data/watchlist/reports/watchlist-20261104T040000Z.html`
- `data/watchlist/reports/watchlist-20261104T080000Z.html`
- `data/watchlist/reports/watchlist-20261104T120000Z.html`
- `data/watchlist/reports/watchlist-20261104T160000Z.html`
- `data/watchlist/reports/watchlist-20261104T200000Z.html`
- `data/watchlist/reports/watchlist-20261105T000000Z.html`
- `data/watchlist/reports/watchlist-20261105T040000Z.html`
- `data/watchlist/reports/watchlist-20261105T080000Z.html`
- `data/watchlist/reports/watchlist-20261105T120000Z.html`
- `data/watchlist/reports/watchlist-20261105T160000Z.html`
- `data/watchlist/reports/watchlist-20261105T200000Z.html`
- `data/watchlist/reports/watchlist-20261106T000000Z.html`
- `research/cpf-oa-temasek-2070-2026-11-04/index.html` (3 occurrences)
- `research/snb-mas-policy-2026-11-05/index.html` (1 occurrence)
- `research/sti-banks-2026-11-06/index.html` (4 occurrences)

## External identity exceptions

`v4.html` retains these four working external destinations (five username matches
across their hostnames). No verified anonymous canonical replacements are available:

- `https://winston-options-lab.winstonnggw.chatgpt.site/`
- `https://portfolio-simulation-winst.winstonnggw.chatgpt.site/new/#portfolio`
- `https://portfolio-simulation-winst.winstonnggw.chatgpt.site/v6/`
- `https://clubs.winstonnggw.chatgpt.site/`

The cleanup does not promise anonymity in Git history, downloadable originals,
external accounts, external pages or cached copies. The integrity audit continues to
verify actual published bytes, without stripping content before hashing.
