# Public data privacy projection

Pages staging removes private-origin conversation and file URLs from the deployed
hourly feed, hourly edition archives, V2 report data and V2 snapshots. It does not
change report text, Reuters links, financial values, timestamps, schedule state,
edition IDs or story versions. Legacy hourly identities become the same SHA-256
source-report keys used by current editions, so deduplication remains stable.

The source editions remain unchanged for provenance and replay. This is a public
projection, not a claim that old Git commits have been erased. Repository/history
cleanup is separate work and must not be implied by successful Pages deployment.

The artifact audit permits only the exact deterministic projection for these
allowlisted data families. Any unrelated data edit still fails the integrity gate.
Source and staged tests verify idempotence, retained report identity, preserved
content and rejection of unrelated mutations. New hourly feed generation no
longer inserts a private source-chat URL.
