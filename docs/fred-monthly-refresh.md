# Monthly FRED Observatory refresh

The cloud workflow `.github/workflows/fred-observatory-monthly.yml` runs on the
first day of every month at 00:00 UTC / 08:00 Singapore. GitHub may delay its
start. It also supports an authorised manual run. This is separate from the
existing daily FX, prices, Reuters, research and weekly Fed schedules.

`refresh_fred_observatory.py` reads the current published history. It fetches
three calendar months from FRED and Treasury auctions. Monthly/quarterly source
periods are rounded down to their period start, and a lagged latest period is
rechecked even if it precedes that cutoff. New York Fed and TIC provide bulk
workbook/table downloads, so only overlap rows are selected before merging.
The NY Fed workbook is discovered from its official source, with recent official
quarter URLs as fallbacks. No 20-year source re-download is required. Revisions outside the selected overlap remain as previously saved.

Observation identities are:

- FRED and NY Fed: native observation date.
- Treasury auctions: auction calendar date plus CUSIP.
- TIC: month plus the exact country/aggregate label.
- Fed Treasury tables: quarter-end date plus source series code.
- Census: source month plus exact country code.
- Debt-to-the-Penny: record date; MSPD: month-end plus source line number.
- OFS archived table: quarter-end; OFS API: holding date, publication record date and owner.

New explicit source rows replace duplicate identities, including a source's
explicit missing value. Missing rows do not delete older history. Numbers retain
source precision and native units. No interpolation, resampling, rounding or
new country-name mapping is performed. Duplicate incoming identities, changed
schemas and invalid numbers stop acceptance. A failed download retains the
prior verified dataset, its retrieval date and a visible failed-source status;
validated other sources may publish as an explicitly partial refresh.

Each run creates a new dated archive folder. The latest catalogue is the only
existing data path changed. Earlier snapshot files and cited URLs remain fixed.
Every changed observation has its previous and replacement record in
`revisions.json`; `refresh-report.json` records source request URLs, response
hashes, overlap windows and matched/added/revised counts. A successful no-change
check still creates a dated receipt; it does not invent new observations.

Both monitoring pages load the current catalogue and its monitor file. The
archive page's downloads, source status and saved date follow the same catalogue.
Dates in chart details come from the data rather than fixed release captions.

## Routine commands

Run from a clean, current main checkout using Python 3.12+ and openpyxl 3.1.5:

```text
python scripts/refresh_fred_observatory.py --work-dir NEW_PRIVATE_WORK_DIR --package
python -m unittest discover -s scripts -p test_fred_observatory.py
```

The work directory must be new. `--use-prepared` can package an already validated
receipt only if its prior catalogue SHA still matches current history.
`--sync-local RAW_FOLDER` also updates the owner's local CSV collection, with
changed originals backed up under `_download_support/refresh_backups/<run>/`.

The cloud job creates a local commit containing only the new archive folder and
latest catalogue. It builds the ordinary Pages artifact, runs its complete
validation gate, then makes a non-force main push and deploys that same artifact.
It shares the existing publication concurrency group, and refreshes none of the
unrelated source feeds. A concurrent main advance rejects the push; rerun against
new history instead of transplanting a stale merged archive. No new token or
provider credential is required. A partial source refresh is labelled publicly
and flagged in the job result after publication.

## Local mirror

The companion monthly Codex heartbeat runs at 09:00 Singapore on the first.
It verifies the public catalogue and ZIP, checks every catalogue-defined checksum and syncs the
full CSVs, inventories, notes and receipts to the owner's configured raw folder.
It uses `scripts/sync_fred_observatory.py --destination RAW_FOLDER`; prior local
files are backed up before replacement. It does not create another source-refresh
schedule or publish UI. A stale/partial cloud result must be reported as such.

The expanded 155-file collection and single-page record/sigma viewer are described
in [fred-all-datasets.md](fred-all-datasets.md). Unchanged objects can reuse an
earlier immutable dated URL; every bundle still contains all current full CSVs.

The public verifier can also run independently:

```text
python scripts/sync_fred_observatory.py --verify-only --expected-version VERSION
```
