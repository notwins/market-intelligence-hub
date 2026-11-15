# Daily bond prices and yields

The existing GitHub Actions `Market data, weekly Fed history and Pages` workflow
requests a daily start at **07:00 Asia/Singapore** (`23:00 UTC` on the preceding
date). Processing, validation and Pages deployment follow; GitHub scheduled
starts can be delayed. This uses the existing cloud workflow and permissions,
with no local computer requirement and no second overlapping task. The other
daily and weekly schedules are unchanged. See
[GitHub schedule behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

The writer is `scripts/Bond Prices - Type Script - 16-Nov-03.10.py`. It reads the
29 UST identities in the original `site/data/default-bond-watchlist.json` and adds
the five owner-selected Bondsupermart issue codes: US87973RAW07, AU000XCLWAP3,
NC22300W, NZ13100V and NX24100T. Temasek occurs once in the combined 34-bond list.
The original reference snapshot, security master and benchmark history remain
unchanged. The combined list appears on `desk.html` (the main homepage), its
Prices view and `v4.html#watchlist`.

Sources are the public WSJ Treasury notes/bonds page and the same public v4
factsheet JSON endpoints used by Bondsupermart. No login, private session,
source subscription bypass or portfolio records are used. Raw full source
pages and issuer prose are not republished. Saved observations contain only
shortlist identities, prices, yields, source URLs, source timestamps and hashes.

WSJ supplies no ISIN. Match the existing reviewed UST identities by **both exact
coupon and exact maturity**, with exactly one result. Treasury prices use points
and 32nds/eighths, e.g. `99.3040` becomes `99.953125` per 100 principal. Retain raw
notation as well. Yield is WSJ's **Asked yield**, not a recomputed yield, bid
yield or constant-maturity benchmark rate. No Treasury bills are included here.

Bondsupermart identities must match issue code, ISIN, currency, coupon and
maturity. Use the indicative full-lot bid/ask fields and source `showDate`.
Display the **bid yield** using its declared yield-to-maturity (YTM) or
yield-to-worst (YTW) measure. Preserve ask yield separately. Dates use Singapore
time for these source timestamps. Quote checks never become observation dates.

All accepted prices are retained in
`site/data/Bond Prices - Type JSON - 16-Nov-03.10.json`. Each bond has a latest
quote and an append-only observation list. Identical quotes are no-ops for
history even when retrieval time/source-page hash changes. A correction with
the same source timestamp keeps the prior observation and records `revision_of`.
Older-source responses cannot downgrade latest. Source failures/missing exact
identities preserve prior quotes and history and write a visible per-bond status.
Other independently validated bonds can still update. No weekend rows, inferred
historical prices or artificial backfills are created. The UI exposes up to five
source dates per bond, showing the last accepted correction for each date; the
download contains every retained observation and revision.

Initial direct-source check on 16 Nov 2026: all five Bondsupermart bonds and
28 of 29 USTs have 13 Nov source quotes. US912810TC27 is held: the retained
reviewed identity matures 15 Nov 2041, but WSJ supplies its 2% row as 30 Nov 2041.
Do not silently map that conflicting date. Its legacy undated reference remains
available separately. The Hub's daily benchmark-yield history is preserved;
the older UST workbook/shortlist has no verified quote date and cannot become
daily individual-bond price history. The connected Portfolio feed reported a
5 Nov snapshot, but its quote/history data was not accessible here for import.

Run:

```text
python "scripts/Bond Prices Tests - Type Test - 16-Nov-03.10.py"
python "scripts/Bond Prices - Type Script - 16-Nov-03.10.py"
python "scripts/Bond Prices - Type Script - 16-Nov-03.10.py" --validate
```

Routine scheduled refreshes use the normal generated-data reconciliation and
complete Pages artifact checks. An entirely unavailable source set fails after
last-good data/status publication. Partial identity coverage is reported in the
dataset and workflow summary. Do not change the pinned mapping during a routine
refresh. Normal non-force latest-main publication preserves concurrent writers.
After publication, verify the deployed JSON and both homepage and watchlist.
A saved cron expression alone is not evidence of a completed scheduled run.
