# Hourly Reuters publication

The hourly report feed is separate from the daily headline-discovery job and the 09:00 daily full-report importer. V2 and V3 read `site/data/hourly-news.json` without a page build. The overview, desktop navigation and phone More menu link to `#hourly`. Page refresh checks stored data every five minutes; it does not collect Reuters news.

The Codex heartbeat `publish-hourly-reuters-news-to-dashboard` checks at **:15 every hour, Asia/Singapore**. It reads completed outputs of the existing ChatGPT `(Hour) Reuters Hourly News` task, without prompting it or altering its schedule. Successful scheduled ingestion remains unproven until a later run completes and its cutoff is verified live. The first imported available source report ended 1 November at 11:02:04 SGT and explicitly reported partial coverage, zero selected stories and no completed cutoff. No market facts or filler stories were manufactured.

## Input and publication

1. Fetch current remote data and all existing IDs before merging. Use an isolated up-to-date checkout if another publisher is active.
2. Read the newest relevant completed source run, preferably with `read_thread`. Runs may use separate chats. Initial source: `https://chatgpt.com/c/6ae6ab06-c2b0-83ec-8029-537540a31041`; scheduling conversation: `https://chatgpt.com/c/6ae56595-efc0-83ec-aae5-fd9a9266c2f1`. A manual preview, missing response, task status or in-progress run alone is not a new completed news report.
3. Review each fact against Reuters and strip private material. Semantic duplication across URLs requires operator review. The importer enforces IDs and versions, not truth or semantic equivalence.
4. Save reviewed input outside `site` and run `python scripts/import_hourly_news.py incoming.json`. The importer validates before writes, preserves immutable editions, checks connected story versions, and creates immutable edition archives. Replays change no files. Optional `--site-root` supports isolated validation.
5. Run `python -m unittest discover -s scripts -p 'test_*.py'`, plus `node scripts/test_v3.cjs` after relevant UI/source changes. Publish only the changed feed and new hourly archives. Preserve V1, V2/V3, daily reports, original source data and other publishers' commits.
6. Verify Pages workflow success and read the latest cutoff/coverage on the live hourly tab. Do not claim automatic synchronization from a saved schedule or commit alone.

## Public JSON schema

Incoming top-level fields: `editions` (array), and optional `source_schedule` (`status`: Active / Paused / Unknown; `checked_at`: exact verified timezone timestamp). Do not re-publish solely for an unchanged task-state check. Never resume a paused source task without user authorization.

Each edition must have exactly these fields:

| Field | Meaning |
| --- | --- |
| `id` | Immutable safe filename ID, such as hourly-2026-11-01T105924-SGT. |
| `report_at` | Verified source completion/report timestamp with timezone. |
| `window_start`, `cutoff` | Actual covered window, with timezone. Do not infer missing times. |
| `coverage` | complete / partial / unavailable, as supported by the source. |
| `summary` | Edited public research summary; clearly distinguish incomplete scans from a quiet hour. |
| `limitations` | Array of explicit coverage gaps; required for partial/unavailable scans. |
| `original_url` | Real HTTPS ChatGPT source report link. |
| `sources` | Array of Reuters sources: url, title, published_at; optional updated_at and verification_url. Exact original publication uses a timezone timestamp. A verified date without time uses published_at: null, published_date: YYYY-MM-DD and publication_precision: date. Do not manufacture midnight or infer time from a URL. |

Date-only sources require explicitly partial/unavailable coverage and a timing limitation. Dates use the reported calendar date compared with the Singapore cutoff date; they do not establish an exact intraday publication time or that the article appeared inside the hourly window. The oldest seven-day boundary date and future dates are rejected because date precision cannot establish eligibility there. A wholly unknown publication date remains ineligible. Exact timestamp sources retain the existing seven-day instant checks. Unknown development times remain null and cannot support a breaking label. Date-only reports never advance the complete-scan cutoff.
| `stories` | Array of reviewed story versions; empty is valid without fabricating headlines. |

Each story must have exactly: `story_id` (stable underlying event ID), `version` (positive integer), `status` (new / follow-up / correction), `freshness` (current / breaking / catch-up), `topic`, `headline`, `body`, `analysis`, `watch_next`, `earlier`, `source_urls` (Reuters URLs listed in this edition), `development_at` (verified timezone timestamp or null). Analysis is separate from source facts. An initial version must be new. Every subsequent version requires the preceding retained version and an `earlier` explanation. Do not re-import the same story/version under a different edition. Rewritten headlines or background are not substantive updates.

`publisher_checked_at` records the website update, not source completion. `last_complete_cutoff` derives only from explicitly complete source scans. An unavailable/partial later report never erases earlier verified stories or advances that complete cutoff. Archives remain readable, including corrections. No personal holdings, borrowing balances, Library runtime IDs, credentials or unedited conversation text belong in this public schema.

Before proposing an edition ID, compare the source conversation path and timezone-normalized window start, cutoff and report timestamp against the feed. A matching report is already imported even when another proposed ID, wording, URL query or timestamp offset differs. Reuse the existing published identity and skip that report; never manufacture an alias. The importer rejects aliases before writing any feed or archives. A genuinely later correction report can retain the same research window with its own later report timestamp and connected correction version. Retain any earlier immutable archive, including an accidental alias already archived, rather than rewriting history.

