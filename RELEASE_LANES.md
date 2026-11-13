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

## Final release requirements
Reconcile against fresh main, regenerate derived catalogues, run existing source/final-artifact suites, complete required genuine rendered QA and preserve earlier editions. Content evidence, privacy, rights and publication checks are not replaced by this tool. Publish only through the established guarded writer, then verify the actual deployed commit and live bytes. Reconcile stale candidates and repeat checks rather than dropping the guard.

Independent UI revert may preserve newly published reports. Removing a report to roll back is prohibited by this append-only pilot. A separately designed retraction/index-selection policy is required.

## Independence roadmap
One Pages deployment currently serves one complete artifact. Keeping one repository with separately versioned immutable UI and content artifacts can eliminate UI rebuilds for report releases, retain existing paths, and allow component-version rollback through a composition manifest. It still redeploys the combined artifact. The dashboard would read a verified content index at runtime, with tested fallback behavior; existing embedded additions and shared search generation must first be decoupled.

Truly independent deployment under unchanged origin/paths requires a verified hosting/routing capability beyond this current Pages workflow. A second repository alone does not provide that. This tool neither adds infrastructure nor changes domains, credentials, permissions, schedules or workflows.

## Tests
`python -m unittest discover -s scripts -p 'test_release_lane_*.py'`

Tests use portable fixtures and temporary local Git repositories, including both release orders, UI-only revert, stale rejection, exact tree/blob binding, dirty-worktree exclusion, ownership, deletion, history/register retention and generated-output overlap. No remote repository is contacted. These tests are release-safety checks, not browser QA.
