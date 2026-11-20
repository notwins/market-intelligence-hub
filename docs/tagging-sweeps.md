# Tagging sweep history

The Hub's **Tagging version history** records each sweep. It shows before and after tag IDs, colour values and logo IDs for each changed article. The section totals count researched records per surface. An article present on two surfaces can appear in both sections.

The first record compares the old renderer and the new renderer on the same inventory. Later records compare the current selection with the last accepted sweep snapshot. The report records the approved rules' output. The browser controls the exact placement and display on each surface.

## Run and record the next sweep

Use current, separate checkouts of the Hub and independent content repositories. Fetch the public Hub's current `data/desk-data.json` to a private temporary file. Use the newest accepted snapshot kept with the previous private run.

```powershell
node scripts/run_tagging_sweep.cjs --content-site "<exact-content-checkout>/site" --desk-data "<downloaded-public-desk-data.json>" --baseline-snapshot "<last-accepted-private-snapshot.json>" --output "<private-run-directory>" --publish
```

Use a Git baseline ref instead of a snapshot only when explicitly comparing two renderer versions on the same inventory. Add `--rollback-commit <sha>` only when the run corresponds to a specific, verified release that can be reverted independently.

Each execution writes a private snapshot and report. The publish option adds one public report and one index entry in `site/data/tagging-history/`. Commit only the new report and its index change when the run has no other authorized Hub changes. Keep the full snapshot, source material and private notes outside the public tree. Run a fresh compare after a race to main and retain the prior history entries. Verify the report on the live Pages site before promoting the new private snapshot as the baseline for the next run. Record zero-change sweeps too.

## Revert reference

Use the report's **Before** column and stable article key to prepare a targeted correction to the relevant tags, matching rules or palette. Review the article in its Hub section on staging after a correction. When a report names a single renderer release, Git can revert that release on top of current main after checking for conflicts. Keep the sweep report and independent content history, then record the result as another sweep so the reversal stays visible.
