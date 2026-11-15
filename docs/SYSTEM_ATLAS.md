# System Atlas

`site/blueprint.html` is the Hub's generated, self-contained Website Blueprint.
It inventories HTML pages, V4 routes, company-selected destinations, browser
modules, selected datasets, reviewed publishing dependencies and actual recent
UI commits. The existing text site map is retained.

## Refresh without another scheduled task

**The blueprint uses the existing UI build; no additional automation is needed.**
The UI release workflow already runs `scripts/build_architecture_map.py` before
the source and Pages artifact checks. The generated map is published when that
release succeeds. It does not trigger, build or deploy the independent content
repository.

There are three separate refresh boundaries:

| Layer | How it refreshes | What that establishes |
| --- | --- | --- |
| Pages, modules and reviewed dependencies | Regenerated during the existing UI build, on configured push, manual and scheduled workflow runs | A source snapshot from the successful UI release, not runtime health |
| Independent research destinations | Browser reads the fixed public research feed when the map opens online, and on manual refresh | Validated feed records and indexed report links; the blueprint does not fetch and verify every report body |
| Private publishers and importers | Declared public configuration; an owner may explicitly regenerate a private export | Public builds do not recheck private enabled state, execution results or publication success |

`graph.refresh.architecture` reads trigger declarations from the current
`.github/workflows/publish.yml`; `job:hub-build.schedule` uses the same result.
The current workflow includes pushes to `main`, manual dispatch, daily 07:00 and
08:00 SGT runs, and a Saturday 14:17 SGT run. Those times are derived from the
checked-out UTC cron expressions rather than copied into the generator. GitHub
may delay scheduled starts, and a scheduled start does not guarantee a successful
release.

Fixed daily and weekly UTC schedules are converted to Singapore time, including
day rollover. Unfamiliar cron syntax stays visible as its original UTC expression
with no guessed SGT description. An unavailable or unrecognised workflow trigger
declaration does not become an invented schedule.

The research refresh reuses the unchanged `ResearchFeed` schema and retention
validator, inlined from `site/research-feed.js`. It keeps the fixed independent
origin and does not import private inputs. A failed refresh retains the current
map and does not advance a successful freshness claim. Opening or refreshing the
map does not run research, publish a report, or change any source schedule.

## Build and source ownership

Build with `python scripts/build_architecture_map.py`. Source assets are
`scripts/blueprint-template.html`, `site/blueprint.css` and `site/blueprint.js`.
The builder reads this checkout only. The shared research validator is embedded
without changing its source; its normal report-page renderer does not start
because the blueprint does not have that renderer's host element.

The public graph includes no local automation IDs, raw prompts, private chats,
client data or local user paths. Existing public declarations of publisher and
importer cadence remain explicitly labelled as declared configuration. They are
not automatically refreshed from the private scheduler.

An owner export is opt-in:

`python scripts/build_architecture_map.py --owner-output <outside-repository-owner.html> --automation-dir <local-automations-directory>`

Only selected schedule name, ID, status, cadence and kind are read into that
private export; prompts and execution credentials are never copied. The owner
HTML is a local file, not an authenticated public page. Keep it outside the
repository and regenerate it after private configuration changes. An ACTIVE
configuration is not proof that a source report completed or was published.

## Map behaviour and limits

The map supports pan, zoom and pinch; dragging cards; group expansion; local
notes; upstream and downstream traces; a local unavailable simulation;
navigation, data and reference overlays; a minimap; accessible list and search;
text scaling; JSON board export and import; and snapshot comparison. Its canvas
uses the Hub's light-only appearance. Board edits stay in the browser and do not
change real pages, tasks, schedules or data. Export JSON to retain portable notes.

Reviewed dependencies and source-reference candidates have separate labels.
HTML navigation is discovered statically. The map is not an exhaustive runtime
trace, uptime monitor, or proof of every dynamically constructed external link.
Changes over time uses real repository revisions and user-imported earlier
snapshots; it does not invent past architecture or unobserved execution history.
The unavailable simulation follows mapped relationships. Retained dated data may
still remain visible after a source failure.

Software options and official links are included in the explorer. React Flow is
a suitable foundation for a larger graph editor; Kumu offers interactive systems
mapping; draw.io supports diagrams, layers and HTML embedding; and tldraw supplies
an infinite canvas under its production licensing terms. This release uses native
browser SVG, HTML and JavaScript so its canvas works offline without an add-on or
dependency CDN. Online research discovery still requires network access.

## Verification

Targeted generator checks:

`python -m unittest discover -s scripts -p test_architecture_map.py`

These cover source discovery, graph consistency, workflow-driven cadence changes,
Singapore-time day rollover, honest handling of unfamiliar cron syntax, public
and owner boundaries, and self-contained validator embedding. Release validation
also includes JavaScript checks, the independent-content contract test, the
complete Pages artifact suite and browser verification of the viewer controls.
No schedule, permission, hosting setting or independent content pipeline is
changed by this feature.
