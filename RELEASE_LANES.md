# UI and report release-lane preflight

Status: optional read-only operational tool, not enabled in CI or the publisher.

## Purpose
Prepare UI and report changes in separate worktrees and test them concurrently. A single coordinator still reconciles and publishes the final Pages artifact. This is an interim collision-prevention measure, not independent deployment.

Run:
```
python scripts/release_lane_guard.py --repo . --base-commit FULL_BASE_COMMIT_SHA --candidate FULL_LOCAL_COMMIT_OR_TREE_SHA --current-main-sha FRESH_VERIFIED_REMOTE_MAIN_SHA --lane report
```
Use `--lane ui` for an explicitly owned UI patch. The command reads immutable Git objects, binds register content to the candidate tree, and reports every changed path, mode and blob ID. It does not stage, commit, fetch, upload or deploy. Exit 0 means this narrow preflight passed; exit 2 means rejection. The current-main input must be independently verified through the connected repository reader, then used in the final expected-SHA write guard. No force update.

## Ownership
- Report pilot: new `site/research/<edition>/` folders and append-only research-register entries. Prior editions and old register entries cannot be changed or removed. Other publication shapes require separately reviewed policies, not disabling the guard.
- UI pilot: only the explicit paths in `UI` within the guard. Being path-authorized does not prove internal sections were preserved; content and interaction tests remain mandatory.
- Derived search, external-source, palette and timeline outputs belong to the final assembler, not either submitted lane. The register is report-owned; register-derived page additions must be rebuilt once after reconciliation with the selected UI, never overwritten from an old full-file copy.

### History-chart ownership extension (proposal for coordinator review)
Reviewed chart tree: `56764f7807ae2a64927a7fd1a680a233a787e946`, based on
`185474ebeab62ace55ec62cb7aca11be197c318e`; this proposal does not activate a release.
The proposed extension adds exactly `site/v4-tools.js` and
`scripts/test_yield_comparisons.cjs`; it adds no patterns, overrides or bypasses.
The reviewed chart batch changes only phone event-label presentation, an event
disclosure with the existing official links, and the event-checkbox position in
`lineChart`/`timePanel`. The test file verifies that presentation and preservation.
The existing `site/v4.html` edit only refreshes the shared module's cache key.
An empty event-legend wrapper is also omitted when the selected range has no events.

`v4-tools.js` also contains financial, source, report and other tool behavior.
Path acceptance does not authorize changes to those sections or certify semantics:
each future edit still needs explicit scope/content review. Financial observations,
formulas, scenarios/horizons, sources, report functions and schedules remain outside
this chart batch. Existing deletion, stale-base, report-lane and derived-data checks
remain mandatory. Guard/policy files themselves do not become UI-owned; this policy
proposal requires separate coordinator review before the chart release can use it.
Do not move or duplicate chart functions into HTML to evade ownership checks.

### Astra UI ownership assignment — 14 November 2026

The final assembler owns the user-requested Astra push/deployment on top of the
completed research-card release. The previous research writer reported its slot
clear; the parallel research-feed prototype is isolated and has no publishing scope.
This assignment adds only these exact paths to the UI lane:

- `site/feed-freshness.js`
- `site/research-shortcuts.css`
- `site/market-snapshot.js`
- `site/global-search.js`
- `site/search-query.js`
- `site/search.html`
- `site/favicon.ico`
- `scripts/test_sol_ui.cjs`
- `scripts/test_saved_refresh.cjs`
- `scripts/test_market_snapshot.cjs`

The existing card-page, generator and register-test ownership covers the bounded
Quick read delayed-close correction. Reports, brief assets, register metadata and
financial observations remain outside UI ownership. No wildcard, deletion, stale-base
override, derived-output exception or workflow change is introduced. Guard/policy
files are a separate coordinator policy change; they do not become UI-owned.
The final assembler must regenerate indexes after reconciliation and verify all
published reports/briefs remain intact before the expected-SHA update of main.

## Final release requirements
Reconcile against fresh main, regenerate derived catalogues, run existing source/final-artifact suites, complete required genuine rendered QA and preserve earlier editions. Content evidence, privacy, rights and publication checks are not replaced by this tool. Publish only through the established guarded writer, then verify the actual deployed commit and live bytes. Reconcile stale candidates and repeat checks rather than dropping the guard.

Independent UI revert may preserve newly published reports. Removing a report to roll back is prohibited by this append-only pilot. A separately designed retraction/index-selection policy is required.

## Independence roadmap
One Pages deployment currently serves one complete artifact. Keeping one repository with separately versioned immutable UI and content artifacts can eliminate UI rebuilds for report releases, retain existing paths, and allow component-version rollback through a composition manifest. It still redeploys the combined artifact. The dashboard would read a verified content index at runtime, with tested fallback behavior; existing embedded additions and shared search generation must first be decoupled.

Truly independent deployment under unchanged origin/paths requires a verified hosting/routing capability beyond this current Pages workflow. A second repository alone does not provide that. This tool neither adds infrastructure nor changes domains, credentials, permissions, schedules or workflows.

## Tests
`python -m unittest discover -s scripts -p 'test_release_lane_*.py'`

Tests use portable fixtures and temporary local Git repositories, including both release orders, UI-only revert, stale rejection, exact tree/blob binding, dirty-worktree exclusion, ownership, deletion, history/register retention and generated-output overlap. No remote repository is contacted. These tests are release-safety checks, not browser QA.
