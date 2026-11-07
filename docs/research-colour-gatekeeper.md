# V3 research publication gate

The V3 theme reference is `site/colour-templates-v3/index.html`. Its source of
truth is `site/data/colour-templates-v3.json`, verified from the supplied V3
workbook, guide and research prompt. V1.2 remains the authority for semantic
entity/tag colours. Presentation themes do not assign country, company,
security, sentiment or index identity.

## Where enforcement runs

`python3 scripts/validate_research_contracts.py` runs in both source validation
stages of `.github/workflows/publish.yml`. The normal Python test discovery
suite includes positive and negative gate tests plus a current-site check.
`validate_pages_artifact.py` also calls the gate on the **staged site**, after
transformations, and records checked paths in the integrity report. Existing
privacy, protected-source and receipt checks remain in place.

The contract is required on new HTML under `research/`, `market-understanding/`
and `data/`, including report and presentation companion HTML. It also applies
to HTML elsewhere marked with `og:type=article` or
`mih-content-type=article|research`, and any page that opts in with the contract.
Put future uploaded articles/research in those namespaces; do not hide reports
as unmarked utility pages. Ordinary dashboards, legal pages and the reference
page are not articles. The validator cannot infer that an unmarked arbitrary
HTML utility page is actually research. Routing/content classification remains
a publishing review responsibility. Non-HTML PDF/Excel downloads do not have
this HTML contract and require artifact-specific checks and editorial review.

`research_contract_legacy.json` is a fixed inventory of the 98 existing HTML
paths at commit `7ebadedfcd1715c3cd8e49bfa00be619bc179deb`. It is never generated
by CI. Existing pages need not be recoloured or retroactively migrated; their
existing integrity checks still apply. Do not append new reports to this list.
A legacy page opting into a contract is validated. Author-submitted new research must emit the contract before adding new report
paths. One narrowly bounded compatibility route preserves the existing
watchlist generator: `data/watchlist/reports/watchlist-YYYYMMDDTHHMMSSZ[-rN].html`
is accepted without a V3 contract only when its validated archived edition,
exact current `watchlist_report.render_report` bytes, single receipt, date and
SHA-256 all match. A matching filename or receipt alone is insufficient.
The final audit lists these separately as `generated_compatibility_non_v3`;
**they are not V3-compliant articles**. Existing archive/index, public privacy,
financial and research-review tests continue to apply. This avoids disrupting
routine watchlist publication or fabricating reviewer attestations. Migrating
that generator to V3 needs a separate validated template change and real review.
Policy/earnings edition imports update existing data-driven UI rather than
creating new HTML paths; they keep their existing validators. No broad `data/`
exemption, new authored-call exception or arbitrary generator exemption exists.

## Starting a new report

Download `colour-templates-v3/research-template.html.txt`, copy it into a new
research HTML path and replace its placeholders. It is deliberately incomplete
and fails validation until the report and its review are complete. No sample
financial claims are supplied. Its initial Earth & Slate / generic bonds route
is illustrative, not an automatic classification of the next topic.

Include exactly one `<script type="application/json" id="mih-research-contract">`.
Fields are strict; unknown contract and semantic-tag override fields fail.

- `version`: integer `3`.
- `theme`: exact two-digit theme ID, `01` through `10`.
- `route`: exact source route ID whose `themeId` equals `theme`. The six
  precedence-only rows cannot be used as an article route. Alternatively use
  `explicit-user-choice` with `user_choice_reference`: a short public-safe
  reference to the actual approval, never private transcripts or personal data.
- `route_rationale`: why the analytical question fits. Follow explicit user
  choice, analytical question, instrument, sector, geography, then neutral
  Earth & Slate 03. Human review resolves competing routes. Options and
  derivatives route to 05; shares/equities to 04. Singapore geography is 06,
  but does not override an instrument-led credit or derivatives thesis.
- `presentation_tokens`: copy the chosen theme's complete `tokens` object
  exactly from the reference JSON. These are presentation declarations, not
  replacements for canonical semantic text colours.
- `cutoff`: ISO 8601 timestamp with timezone. `cutoff_id`: visible element
  containing that exact timestamp. `title_id`, `limitations_id`: nonempty
  visible elements. `takeaways`: 1–5 visible element IDs.
- `source_ids`: nonempty list of visible HTTP(S) anchor IDs. Keep source dates,
  observation dates and citations close to claims; presence is not verification.
- `semantic_tags`: explicit list, empty if no approved tags are applied.
  Each entry has `id`, `element_id`, `context`, `light`, `dark`, `lightChip`,
  `darkChip`. The four colours must equal the source canonical tag values. Explicit inline
  `color`/`background-color` on marked elements must use those exact HEX values
  (stylesheet-based rendering still needs review).
  The element must have `data-mih-semantic="<canonical-id>"`. Every such marker
  must be registered exactly once. Unknown IDs and colour overrides fail.
  Context must explain ambiguities; a theme never authorizes a semantic tag.
- `visuals` and `cards`: explicit lists. Empty lists need `no_visuals_reason`
  and/or `no_cards_reason`. Do not add decorative charts just to fill a quota.
- `editorial_review`: `reviewer` plus booleans `evidence_checked`,
  `semantic_context_checked`, `accessibility_checked`, all true after actual
  review. Use a public-safe reviewer/role identifier, not private information.

Each visual has `id`, `kind` (`chart`, `table`, `diagram`, `image`), `title_id`,
`date_id`, `instrument_id`, `units_id`, `source_id`, `how_to_read_id`,
`finding_id`, `limitations_id`. Each card has the same fields except `kind`,
`instrument_id` and `how_to_read_id`. Mark containers with `data-mih-visual`
or `data-mih-card`. Each label must be a nonempty visible **descendant** of its
container, and its source must be a registered source link. Use a meaningful
“not applicable” explanation where a diagram has no numerical units.

Every marked card/visual and every SVG, canvas and table must be registered.
For raster charts mark the containing figure; images are not automatically
classified as charts because icons and logos are not data visualizations.
Duplicate IDs, obvious placeholders and inline-hidden labels fail. For a
substantial card containing a chart, register both containers and their
respective labels. Retain exact values in a companion table where necessary.

## What automation does not certify

The gate checks **declared** themes and semantic tokens plus structural label
presence. It does not compute browser CSS, enforce all external styles, prove
contrast on actual backgrounds, assess prose quality, verify facts/URLs,
prove permissions, choose a route, infer tags, inspect rendered raster charts
or confirm a reviewer's attestation. A declaration alone is not full V3
compliance. Review final desktop/mobile rendering and downloaded artifacts.

Before attesting, check exact applied HEX and V1.2 precedence/context guards
(longest valid whole phrase; US not USD; Fed not FedEx; ambiguous short tickers
remain unmapped without evidence), 4.5:1 text and 3:1 essential chart contrast,
non-colour distinctions, gentle surfaces, correct dates/units/FX direction,
zero-based ordinary bars, honest line scales, actuals versus projections,
source-linked values, uncertainty and counterarguments. Separate company,
listing, share class, headquarters and index membership. Never substitute
unverified brand guesses or use semantic identity colours as profit/loss
signals. Canonical dark text tokens are not Wada “Dark” swatches; V3 does not
supply a complete dark-page theme. Never claim unperformed checks.

## Commands

```sh
python3 scripts/validate_research_contracts.py
python3 -m unittest discover -s scripts -p 'test_research_contracts.py' -v
python3 -m unittest discover -s scripts -p 'test_*.py'
python3 scripts/build_pages_artifact.py --output /tmp/unique-v3-candidate
python3 scripts/validate_pages_artifact.py --artifact-root /tmp/unique-v3-candidate --report /tmp/unique-v3-audit.json
```
