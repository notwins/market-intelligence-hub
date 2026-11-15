# System Atlas

`site/blueprint.html` is a generated, self-contained interactive public architecture map. The existing text site map is retained. It inventories HTML pages, V4 routes and company-selected destinations, browser modules, selected datasets, reviewed source/publisher/deployment dependencies and actual recent UI commits.

Build with `python scripts/build_architecture_map.py`. Source assets are `scripts/blueprint-template.html`, `site/blueprint.css` and `site/blueprint.js`. The existing UI workflow rebuilds it before source/artifact checks; no schedule, hosting, permissions or independent content pipeline is changed. The builder reads only this checkout. The online browser research refresh reads the fixed independent public feed on opening the map, with a manual refresh also available,, validates schema 1 and report origin, and adds its destinations to the current map session. It neither checks out, builds nor deploys content.

The public graph contains no local automation IDs, raw prompts, private chats, client data or local user paths. A private owner export is opt-in:

`python scripts/build_architecture_map.py --owner-output <outside-repository-owner.html> --automation-dir <local-automations-directory>`

Only selected schedule name, ID, status, cadence and kind are read into the private export; prompts and execution credentials are never copied. The owner HTML is a local file, not an authenticated public page. Keep it outside the repository. It must be regenerated to reflect changed schedule configuration. An ACTIVE configuration is not proof that a source task completed, nor that its content was published.

The map supports pan/zoom/pinch, drag-to-arrange, group expansion, local notes, upstream/downstream traces, a local unavailable simulation, navigation/data/reference overlays, a minimap, accessible list/search, light/dark canvas, text scaling, JSON board export/import and snapshot comparison. All board edits are local browser state; none changes real pages, source tasks, schedules or data. Save exported JSON to retain portable notes. No new automation is installed.

Solid reviewed dependencies and dashed source-reference candidates are labelled separately. HTML navigation is discovered statically. The map is not a comprehensive runtime trace, an uptime monitor, or proof of dynamic external links. Changes over time uses real repository revisions plus user-imported earlier snapshots; it does not invent past architecture or reconstruct unobserved source-run history. Unavailable simulation models mapped reachability, not whether every consumer would disappear; retained dated data may remain visible.

Software options and links are included in the explorer. React Flow is a suitable larger graph-editor foundation; Kumu is an existing interactive systems-mapping application; draw.io provides diagram/layer/HTML embedding; tldraw provides an infinite canvas under its production licensing terms. This release uses native browser SVG/HTML/JavaScript so the downloadable file works offline without an add-on or dependency CDN.

Validation: `python -m unittest discover -s scripts -p test_architecture_map.py`, JavaScript syntax check, independent-content contract test, complete Pages artifact suite, and browser verification of canvas controls, trace/simulation, group/deep-link inspection, local notes, JSON round trip, comparison, mobile layout and published map.
