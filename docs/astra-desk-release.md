# Astra reading and markets desk release

The entry route opens `desk.html`, with Briefing and Markets views. The existing
`v4.html` workspace remains directly available. Existing article, report, brief,
search and Research Explained destinations keep their current URLs and bytes.

## Source ownership and assembly

`site/data/desk-config.json` contains the editorial selection shared with all
visitors. Stable published IDs select one to four reports. Owner selection and
export tools remain in the private local authoring workflow; the public desk is
read-only. A public browser cannot publish or change shared editorial selections.

`scripts/build_desk_data.py` builds `site/data/desk-data.json` from approved public
metadata and the current configuration. The JSON is a final-assembler output,
not committed source and not a replacement for independent research delivery.
The workflow rebuilds it after source reconciliation, before the deployment
catalogue and Pages staging. The existing final artifact validator discovers the
desk JavaScript checks from the workflow and runs them against staged bytes.
Python unittest discovery includes the adapter tests.

The ordinary UI guard adds only named desk source paths. It cannot authorize a
guard or workflow edit. The separate explicit `astra-infrastructure` lane permits
only these four infrastructure paths: `.github/workflows/publish.yml`,
`scripts/release_lane_guard.py`, `scripts/test_release_lane_guard.py` and this
document. It rejects UI files, content, derived output, owner files, other
workflows and source-updater scripts. Both lanes still reject deletion and stale
bases. Path ownership is not a substitute for reviewing the actual workflow diff.

Review and record the exact infrastructure-only commit first, including semantic
confirmation that schedules, credentials, permissions and hosting are unchanged.
Run its preflight explicitly with `--lane astra-infrastructure`. Create the UI-only
commit on that infrastructure base and run its normal `--lane ui` preflight. The
two commits can be published together by one non-force compare-and-swap update
of main to the UI head after checking current remote main again. Do not combine
the guard amendment with the UI diff under the ordinary UI lane. A first policy
amendment requires this explicit infrastructure review; it is not self-authorized
by the former guard.

## Independent content

The fixed schema-1 content reader continues loading new research and hourly news
from `notwins/market-intelligence-content`. Neither deployment builds or publishes
the other repository. Current shared closing-price histories retain their hash
validation, source dates and basis. An unavailable feed keeps dated fallback
content and an explicit failure state; it does not advance observation dates.

The archive separates repository addition dates from research dates. Historical
Pages upload receipts are unavailable for legacy articles, so the interface must
not label those repository dates as verified upload times.

## Validation and rollback

Validate the source and a newly built Pages artifact before publishing. Exercise
desktop, 390px and 320px layouts, keyboard modes, company details, archive search,
existing Research Explained cards and Quick read Escape/focus return. Record
physical-device or text-zoom checks separately from viewport simulation.

An Astra-only rollback restores the entry route and explicitly selected UI paths
on current main, then rebuilds the current derived catalogues. Keep the fixed
independent reader, every published report and companion, historical URLs and
all newer independent publications. Never reset main to an old revision or
redeploy a pre-separation artifact. Verify current report destinations after the
rollback deployment.

## Automatic publication colours

The publication-colour integration adds five named shared display/catalogue/test
paths to ordinary UI ownership. Its guard, guard-test, workflow and this document
remain in the existing explicit astra-infrastructure lane. Review and commit
those four infrastructure paths first; the UI commit follows on that base. Do
not include either derived desk-data.json or new publication records in a UI
commit. The additional workflow step runs a local semantic-colour test only;
schedules, permissions, credentials, source refresh and hosting are unchanged.

Desk cards expose existing tag/ticker metadata to one shared display filter.
The filter adds canonical links and limited emphasis, reuses the existing news
badge position, and creates no modal. Existing report URLs and original bytes
remain protected. Content preparation and publication still belong to the
independent content repository.

## Weekly cloud publication-colour sampling

The user requested a cloud maintenance check every Saturday at noon in
Asia/Singapore. `weekly-publication-colour-audit.yml` schedules 04:00 UTC on
Saturday, with manual dispatch for verification. GitHub-hosted Linux executes a
read-only browser sampling script; the user's computer is not required. GitHub
may delay scheduled starts. No credentials beyond the read-only checkout token
are used, and no articles, source feeds or publishing schedules are edited.

The check samples the daily/featured/archive desk, Research Explained and hourly
stories at desktop and mobile widths. It verifies canonical computed font
colours, linked tags and actual search results, limited inline emphasis, unique
tag rows, existing overlay identities and repeated-filter behavior. It also
samples up to three newest independent full HTML reports, when available, and
checks the current versioned preparation filter. Missing report samples and
transient retries are disclosed. Reports and screenshots stay in Actions
artifacts for 30 days and the run summary; failures produce a failed workflow.

The explicit `publication-maintenance` release lane owns exactly the new weekly
workflow and `scripts/check_publication_colours.cjs`. Its guard amendment and
this documentation are reviewed first through the existing infrastructure lane.
Ordinary UI and content publication ownership remain unchanged.
