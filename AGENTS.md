# Market Intelligence Hub publication ownership

For a new complete research publication, read `docs/research-publisher-runbook.md`
and `docs/research-release-separation.md`. Use the shared prepare/submit scripts
for scheduled and standalone reports. Add only the dated public report files and
its immutable record; the Pages assembler generates cards and search entries.
Do not hand-edit UI files or the legacy register for a new full report. Keep
private inputs and review receipts outside the repository. This applies only to
research the user has authorized for public publication, not every private draft.

Hourly Reuters metadata uses its existing importer and versioned news schema,
not the complete-report card lane. Read `HOURLY_NEWS.md` and retain coverage gaps.

For UI work, preserve existing report files, feed records and stable URLs. Keep
UI and report commits separate, reconcile on latest main, use a non-force guarded
write and validate the final Pages artifact. A rollback restores explicit UI paths
onto current main; it must not redeploy an old whole-site artifact.

Do not change source schedules, credentials, permissions or hosting as an implied
part of ordinary article or UI work. Follow the user's current authorization.
