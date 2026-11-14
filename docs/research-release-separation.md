# Research publication separated from UI work

Status: private implementation, 14 November 2026. Not pushed, deployed or connected to a live automation. Baseline main: `e8b957bd3bda254e1d6de4f6b31ab1704a995b98` (final Astra release). Astra working files and branch were not changed.

## Recommendation in plain language

Use the current GitHub Pages site for phase one. Build UI changes on a separate branch. Research publishers add a complete dated report and one small record to the latest approved main. The shared card template, research library and site search pick it up automatically. No article publisher edits a page, card, old register or search index.

This separates authoring and release inputs. It is **not independently hosted UI and content**: Pages still builds and deploys a complete site through the existing shared queue. A pending UI design branch cannot delay a report, but a broken approved main or failing shared site test can. Do not roll back a whole old Pages artifact: that could remove newer content. Restore only approved UI-owned files onto current main and rebuild with current reports. UI versions older than the feed integration are incompatible with that rollback.

## What each workflow owns

| Owner | Paths / responsibility |
|---|---|
| Research automation | Private `bundle/record.json`, explicit public files under `bundle/files/`; review receipt outside public tree |
| Accepted research publication | New `site/research/<dated-id>/*` and new `site/data/research-records/<dated-id>.json` only |
| UI release | Existing explicit UI allowlist in `scripts/release_lane_guard.py`; adds `site/research-feed.js`, `site/research-feed.css`, `site/research-register.js` |
| Shared assembler | `site/data/research-feed.json`, `site/data/research-feed-bootstrap.js`, `site/research-feed.html`, search and existing derived inventories |
| Publishing infrastructure | `scripts/research_feed.py`, `submit_research.py`, `research_release_guard.py`, destination verifier, build scripts and workflow definitions; separately reviewed infrastructure changes |
| Legacy content | Existing report files, links and `site/data/research-register.json` stay as they are; no migration |

Each public record is immutable. Corrections get a new dated edition ID (or `-r2`), keeping the old link. One complete report produces one new card. Brief-only publications and extracts are rejected. Optional Quick read must bind to the exact edition and full-report hash. Missing brief means full-report link only. Failed preview leaves a direct matching-brief link.

## Publication sequence

1. Produce a complete V3-contract HTML report, optional matching brief and explicitly listed public assets in a private bundle. The initial contract uses a dated HTML `index.html` full report; PDF may be a companion.
2. A trusted reviewer approves completeness, public safety and publication rights for the exact record/file hashes. Private inputs, research notes, client material and review identity stay outside the public tree. Pattern scans are additional checks, not proof of editorial quality or licensing.
3. `submit_research.py` makes a disposable fresh-main clone, validates the bundle and receipt, then adds only the new edition and record. Default operation prepares a local candidate. `--publish` exists but is not activated here.
4. An authorized non-force push compares against the current main. If another publisher or UI release wins, fetch the new main and reapply only this submission. Same ID and same bytes is a no-op; conflicting same ID is rejected. Failed pushes preserve the original reviewed bundle for retry.
5. The existing Pages assembler validates all records, builds the feed/search/fallback with one card template, validates staged HTTP destinations and hashes, and runs the full site suite. Only a passing artifact is uploaded and deployed.
6. The prepared workflow verifies the actual public report URLs after deployment. A post-deployment check failure is reported; automatic rollback/retraction is not implemented.

Important boundary: phase one validates the **staged destination before inclusion**, then verifies the live URL after the atomic Pages release. It does not prove a live URL before making its first card visible. If live read-back before feed promotion is mandatory, phase two needs a report-only deployment followed by verification and a separate feed promotion. That stronger gate is not claimed by this implementation.

Feed failure handling: failed generation blocks the candidate artifact, preserving the deployed one. In an open browser, failed/invalid/older feed refresh retains the verified bootstrap/in-memory records and their actual verification and cutoff dates. Nothing is saved to browser local storage. A new visitor whose entire site is unreachable cannot be guaranteed cached content.

## Preparing a publication (local only)

Run from the repository root, using a new output directory:

```powershell
python scripts/submit_research.py --remote <repository-url-or-local-clone> --bundle <private-bundle> --review <private-review.json> --output <new-local-candidate-directory>
```

The private review has `record_sha256` (canonical sorted compact JSON plus newline), `approved_at_sgt`, `complete: true`, `public_safe: true`, `rights_cleared: true`, and `reviewer`. Only its hash and approval timestamp enter the public record. The receipt is a trusted-caller assertion, not a digital signature or independently authenticated identity. Production must restrict who can approve and invoke the writer.

An automation using GitHub's workflow token cannot assume its push starts another push-triggered workflow. The production adapter must explicitly invoke the existing publisher workflow or run the publication stage in the same authorized workflow. No token, adapter or schedule was added in this implementation.

## Rollout options

| | Phase one: existing Pages | Phase two: independent content deployment |
|---|---|---|
| Work | Smallest change: this integrated publisher, records, renderer, checks | Separate content origin/storage, immutable objects, atomic feed promotion, release ownership, CORS/cache rules, monitoring and compatible UI contract |
| Cost | Existing hosting; more existing Actions/build work, subject to current account limits | Hosting/storage/requests and operations depend on approved provider; no service chosen or purchased |
| Release | One shared complete-site deployment queue | UI and content releases can deploy separately only when their serving/deployment boundaries are separate |
| Rollback | Restore UI files onto current main; rebuild with latest content | Roll back UI assets without changing content feed/object versions; retain schema compatibility |
| Failure | A shared build or deployment can block both lanes; rejected candidate leaves live artifact | Content outage affects new feed/report retrieval; UI outage independent; caching/partial-promotion risks require explicit handling |
| URLs | All current URLs retained | Keep old Pages reports at existing URLs. New reports may use the approved content origin. Moving existing paths requires retaining copies or a front routing layer; a second repository alone cannot route the existing github.io path or make its deployment independent |

For a true independent service with strict verification: upload immutable full report and brief, verify their live bytes, then atomically publish an append-only feed revision. UI reads that stable feed URL. Retain old report destinations and feed versions. If the same current path namespace must be retained for all future reports, a front routing/hosting change is needed; approve that separately.

## Phased migration and approval boundary

1. **Completed locally:** isolated final-Astra baseline; actual renderer/library/search integration; publisher/guard/validation tests and synthetic demo. No synthetic reports in the release candidate.
2. **Review and approve one infrastructure/UI release:** review this patch and checks; decide whether staged-before/live-after verification is acceptable. Activate required ownership/content checks and trusted reviewer/writer permissions. Existing human/report lane remains separate. No bypass of branch protections is proposed.
3. **Connect one automation:** produce the bundle/receipt and use the shared publisher, run an authorized end-to-end live pilot, including destination checks and retry. If main requires PRs, adapt submission to a serialized merge queue; current direct writer will fail closed rather than bypass protection. Confirm workflow triggering before enabling automatic publication.
4. **Expand to more automations:** reuse the exact contract, reviewer gate and publisher; no per-article UI changes. Add alerts/operating ownership under a separately approved schedule change if required.
5. **Optional full independence:** choose/approve serving boundary and URL plan, implement live-report verification then atomic feed promotion, test outages and UI rollback. No old content migration required for phase one.

Prepared PR checks alone do not configure GitHub branch protection and are not a security boundary against an actor who can rewrite workflows or bypass checks. Real live concurrent pushes, GitHub Actions execution, CDN propagation, physical mobile devices and production reviewer access control remain unverified until the approved pilot.
