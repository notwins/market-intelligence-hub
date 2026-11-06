# Pages presentation and original publication bytes

Legal links belong at the very bottom of mutable pages, including the dashboard,
watchlist reader, search, archive browser and calculator. The six legal pages keep
their native bottom footer. The reader and dashboard expose Terms, Privacy,
Disclaimer, Investment risks and Editorial standards without rewriting originals.

## Protected originals and the footer exception

`scripts/publication_policy.cjs` treats HTML in `data/`, `research/` and
`market-understanding/` as sealed published content. This is an explicit archive
namespace rule, not a date/filename heuristic. It includes companion HTML notes and
original reports that do not yet have a whole-file receipt. A new presentation
should live outside these sealed namespaces or have its legal notice included
before its initial publication and receipt are created.

The policy also discovers protected HTML from every `publication.json`, nested
download receipts, the watchlist report index, the Calls index and the existing
`report_additions_manifest.json` baseline list, even outside those namespaces.
Historical manifests in a `presentations/` directory use the parent report as
their path base, as their existing validators require. Missing referenced HTML
and unsafe paths fail closed.

Protected originals are deliberately exempt from **build-time** footer injection.
This includes `market-understanding/index.html`: although it contains a catalogue,
it also contains original report text and a protected historical baseline. Its
existing baseline must not be weakened to treat it as a freely mutable shell.
Current legal information is accessible through the mutable dashboard/reader and
`legal/`. A direct original archive URL retains its original disclosure and bytes;
it does not acquire the new common footer. GitHub Pages cannot add markup to that
original response without changing its bytes. No hash normalization or alternate
"footer-free" receipt is used to hide this exception.

## Final artifact gate

1. Existing source validations and data reconciliation run as before.
2. `build_pages_artifact.py` copies the site and unchanged validation code to a new
   directory outside the checkout. It refuses to overwrite another candidate and
   applies the footer only to eligible staged HTML. The source site is untouched.
3. `validate_pages_artifact.py` runs **all** Python tests and every JavaScript test
   listed in the publishing workflow against the final staged site. This includes
   all existing protected-baseline, text-preservation, call and download validators.
4. The final byte audit requires the exact source file set, identical protected
   HTML, and identical bytes for every non-HTML file and native legal page. This
   protects all archive JSON, review receipts, publication manifests, downloads and
   assets. It separately verifies every watchlist and call HTML receipt, all direct
   publication HTML hashes, nested companion hashes/sizes, preserved-source hashes
   and Treasury shard receipts from the deployed candidate itself.
5. Footer tests require a single footer with Terms/Privacy/Risks links and no
   content after it. The audit is retained as a separate Actions artifact, outside
   the public site. Upload/deployment use exactly the audited `mih-pages/site` tree;
   no further content transformation runs between the gate and upload.

The final audit compares actual bytes. Existing baseline validators retain only
their already-approved historical addition/copy rules; none strips a legal footer.
Original manifests and expected hashes are never rewritten by this pipeline.
Legal links and the small shared footer stylesheet use relative site paths. The
shared CSS keeps retired redirect pages within their existing 2 KB size budget.
The source-catalogue parser ignores the
generated legal navigation as presentation chrome, so legal links do not change
research-source statistics. This is unrelated to byte/hash verification.

Local validation (choose a new staging path outside the checkout):

```sh
python scripts/build_pages_artifact.py --output ../mih-pages-candidate
python scripts/validate_pages_artifact.py --artifact-root ../mih-pages-candidate --report ../pages-integrity-audit.json
```

After deployment, download that run's `github-pages` artifact, extract `artifact.tar`
and run `audit_pages_artifact.py --artifact-site EXTRACTED --report AUDIT.json` against
the same reconciled source site. Check the live reader's footer and original report
hashes separately; a green pre-transformation check alone is not publication proof.
