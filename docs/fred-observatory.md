# FRED Observatory

Public section: `fred/`. Subsections: `fred/market-desk.html` and
`fred/risk-observatory.html`. `fred/data.html` browses the shared archive.
The section is linked from the reading desk, full workspace, mobile More menu
and site map. These are UI/data additions, not research-feed publications.

## Shared data contract

`data/fred/catalog.json` is the current schema-1 catalogue. Each dataset has a
stable ID, provider, native units/frequency, original-source URL, coverage,
retrieval date, row counts, SHA-256, citation and relative CSV/JSON URL.
Resolve those URLs relative to `data/fred/`, never relative to the current page.

The first snapshot is `2026-11-16/`: 69 FRED series and five external datasets
(three New York Fed household measures, Treasury auctions, Treasury TIC).
Original CSV bytes, both download inventories and coverage notes are retained.
The downloadable ZIP contains the same CSV bytes and inventory files.
Internal downloader scripts, previous attempts and private filesystem paths
are excluded. No synthetic observations from the optional GPT Pro designs
are used.

`series/{id}.json` exposes original columns and rows as strings so every field
and published precision survives. Where a chart series exists, the additional
`series` object contains numeric points and its source metadata. Missing values
remain null in chart points. TIC's complete historical country/aggregate table
is available in its raw rows; the current chart uses only its latest dated
cross-section. The archive README records the omitted January 2007–2011 columns.

Both monitor views fetch the exact same dated `monitor.json`. They do not
fetch data from FRED in visitors' browsers, change the separate daily FRED FX
feed, or imply an automatic refresh of the full collection. Load failures are
visible and do not switch to demonstration histories.

For future browser charts:

```html
<script src="fred/data-client.js"></script>
<script>
FredArchive.load('DGS10').then(dataset => {
  console.log(dataset.series.points, dataset.metadata.citation);
});
</script>
```

The helper resolves paths from its own script location. It also exposes
`catalog()`, `metadata(id)`, `csvURL(id)` and `resolve(relativePath)`.
For reproducible citations, retain the dated file URLs. Add a new dated folder
for future snapshots; do not overwrite old files referenced by published work.

## Rebuilding

`scripts/build_fred_observatory.py --raw-dir SOURCE --monitor-json PACKED`
accepts a verified raw collection and the matching original numeric monitor
pack. The checked-in templates and engine live in `scripts/fred-observatory/`.
The builder verifies raw FRED hashes and refuses to overwrite an existing dated
snapshot. It is an explicit import, not a network or scheduled update.
`python -m unittest discover -s scripts -p test_fred_observatory.py` reconciles
every CSV/JSON field, chart point, checksum and ZIP member.

Heat uses prior-only sample SD over the selected baseline at each series'
native frequency. The default is five years, with at least twelve prior
nonmissing observations. Trending measures use labelled growth transforms.
Fixed current-baseline chart bands are descriptive rather than rolling
backtests. Both signs receive attention at absolute z >=1 and >=2.
Observation dates, limited histories and provider definitions are shown.
