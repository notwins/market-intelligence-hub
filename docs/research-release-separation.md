# Research publication separated from UI work

Status: live infrastructure and US earnings pilot deployed on 14 November 2026. Infrastructure commit: `31e097a1603a9490e94d8e78817f4b4a16c2b16e`; verified pilot: `94f21828004b18d4d3f84ced2f796d390a91f83f`. This rollout adds the shared preparation adapter and instructions for earnings, credit, policy and standalone reports. Astra's design and existing report bytes are preserved. See [publisher runbook](research-publisher-runbook.md).

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
3. `prepare_research_bundle.py` prepares metadata and hashes from the complete public report files. It does not approve or publish them. After review, `submit_research.py` makes a disposable fresh-main clone, validates the bundle and receipt, then adds only the new edition and record. Default operation prepares a local candidate. An authorized publisher uses the existing connected GitHub writer or explicit `--publish` with existing Git authentication after the release checks.
4. An authorized non-force push compares against the current main. If another publisher or UI release wins, fetch the new main and reapply only this submission. Same ID and same bytes is a no-op; conflicting same ID is rejected. Failed pushes preserve the original reviewed bundle for retry.
5. The existing Pages assembler validates all records, builds the feed/search/fallback with one card template, validates staged HTTP destinations and hashes, and runs the full site suite. Only a passing artifact is uploaded and deployed.
6. The Pages workflow verifies the actual public report URLs after deployment. A post-deployment check failure is reported; automatic rollback/retraction is not implemented.

Important boundary: phase one validates the **staged destination before inclusion**, then verifies the live URL after the atomic Pages release. It does not prove a live URL before making its first card visible. If live read-back before feed promotion is mandatory, phase two needs a report-only deployment followed by verification and a separate feed promotion. That stronger gate is not claimed by this implementation.

Feed failure handling: failed generation blocks the candidate artifact, preserving the deployed one. In an open browser, failed/invalid/older feed refresh retains the verified bootstrap/in-memory records and their actual verification and cutoff dates. Nothing is saved to browser local storage. A new visitor whose entire site is unreachable cannot be guaranteed cached content.

## Preparing a publication (local only)

Run from the repository root, using a new output directory:

```powershell
python scripts/submit_research.py --remote <repository-url-or-local-clone> --bundle <private-bundle> --review <private-review.json> --output <new-local-candidate-directory>
```

The private review has `record_sha256` (canonical sorted compact JSON plus newline), `approved_at_sgt`, `complete: true`, `public_safe: true`, `rights_cleared: true`, and `reviewer`. Only its hash and approval timestamp enter the public record. The receipt is a trusted-caller assertion, not a digital signature or independently authenticated identity. Production must restrict who can approve and invoke the writer.

The connected GitHub writer's commits triggered Pages successfully in the live pilot. An automation using GitHub's workflow token cannot assume the same behavior: it must explicitly invoke the publisher workflow or run its publication stage in the same workflow. No credentials or services were added. The existing daily heartbeat is connected; its persisted schedule remains 09:00 SGT. Scheduled execution is distinct from the controlled live pilot and must be reported separately.

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

1. **Completed:** isolated final-Astra baseline; actual renderer/library/search integration; publisher/guard/validation tests and synthetic demo. No synthetic reports were deployed.
2. **Deployed:** approved infrastructure release, staged destination checks, full artifact tests and live destination readback. Existing writer permissions were reused; branch protection was not changed.
3. **Live pilot passed:** complete 14 November US earnings report, one feed/search entry, exact live file hash and duplicate no-op. A concurrent UI fix was preserved by rebuilding on newer main. The next unattended daily execution remains separately verifiable, not implied by this pilot.
4. **Coverage rollout:** use the same adapter, contract and reviewer gate for earnings, credit, policy and explicitly requested standalone publications. Resume the hourly metadata publisher only on the user's explicit instruction; it remains a separate news feed. Retain source schedules and existing report bytes. Do not convert an old summary into a new full report or backfill old editions under this rollout.
5. **Optional full independence:** choose/approve serving boundary and URL plan, implement live-report verification then atomic feed promotion, test outages and UI rollback. No old content migration required for phase one.

PR checks alone do not configure GitHub branch protection and are not a security boundary against an actor who can rewrite workflows or bypass checks. GitHub Actions, live propagation, exact report hashes and an intervening UI publication were verified in the pilot. Simultaneous report publishers, failure retention and UI rollback were exercised privately. Physical devices and an unattended scheduled execution are not claimed verified. Review receipts attest a trusted review; they do not cryptographically authenticate a reviewer.
