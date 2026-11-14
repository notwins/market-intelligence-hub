# Market Intelligence Hub UI ownership

New research reports and hourly Reuters editions publish in the independent
`notwins/market-intelligence-content` repository. Read
`docs/independent-content-deployment.md`. Do not write new reports, feed records,
or hourly editions into this UI repository. Existing report bytes and URLs are
frozen here; no migration is authorized.

UI changes own the Hub pages, styles and browser scripts. Preserve the fixed
content-source reader contract, schema 1 and current card design. Test using
`node scripts/test_content_delivery.cjs` and the complete Pages artifact suite.
A rollback restores explicit UI paths on current main and retains the independent
reader; never redeploy an artifact from before the separation release.

Content builds and UI builds do not check out, build, trigger or deploy one another.
The existing unrelated market-data schedules remain unchanged. Do not change
credentials, permissions, source schedules or hosting during ordinary UI work.
Private inputs and review receipts never enter either public repository.
