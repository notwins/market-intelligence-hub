"""BOS cloud/local runner: unchanged reviewed importer, private durable sources.

Only bos/ on market-prices is promoted. No UI build, workflow dispatch, source
artifact upload, history rewrite or parser override is performed by this runner.
"""
from __future__ import annotations
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

import bos_equity_feed as feed
from parse_bos_equity import parse_pdf

HUB = "https://github.com/notwins/market-intelligence-hub.git"
ARCHIVE = "notwins/market-intelligence-private-sources"
RAW = "https://raw.githubusercontent.com/notwins/market-intelligence-hub/market-prices/bos/"


def git(repo, *args, check=True):
    result = subprocess.run(["git", "-C", str(repo), *args], capture_output=True)
    if check and result.returncode:
        # Do not echo credential-bearing configuration or private remote output.
        raise RuntimeError("Git operation failed: " + args[0])
    return result


def text(repo, *args):
    return git(repo, *args).stdout.decode().strip()


def refs(manifest):
    return [r for e in manifest["editions"] for r in (e, e["csv"])] + list(manifest["priceHistory"]["months"].values())


def guard_index(repo, manifest, parent):
    """Check stored Git bytes as well as the working tree (CRLF matters)."""
    paths = git(repo, "diff", "--cached", "--name-only", "-z").stdout.split(b"\0")
    for path in filter(None, paths):
        if not re.fullmatch(rb"bos/(manifest\.json|(?:editions|prices)/[0-9A-Za-z.-]+\.(?:json|csv))", path):
            raise ValueError("Unexpected staged path")
    tree = text(repo, "write-tree")
    def outside(revision):
        return [line for line in git(repo, "ls-tree", "-z", revision).stdout.split(b"\0")
                if line and line.split(b"\t", 1)[1] != b"bos"]
    if outside(tree) != outside(parent):
        raise ValueError("Paths outside bos changed")
    for ref in refs(manifest):
        raw = git(repo, "show", ":bos/" + ref["path"]).stdout
        if len(raw) != ref["bytes"] or feed.sha256(raw) != ref["sha256"]:
            raise ValueError("Git index reference checksum mismatch: " + ref["path"])
    if git(repo, "show", ":bos/manifest.json").stdout != (Path(repo)/"bos/manifest.json").read_bytes():
        raise ValueError("Git index manifest differs")


def public_audit(root, manifest, original_mappings):
    if manifest["verifiedMappings"] != original_mappings:
        raise ValueError("Verified listing mappings changed")
    for ref in manifest["editions"]:
        snapshot = feed.read_ref(root, ref)
        for record in snapshot["records"]:
            if any("esg" in key.lower() for key in (*record, *record.get("raw", {}))):
                raise ValueError("Restricted public ESG field")
        if any("esg" in column["key"].lower() for column in snapshot["columns"]):
            raise ValueError("Restricted public ESG column")
        import csv, io
        rows = list(csv.DictReader(io.StringIO((root/ref["csv"]["path"]).read_text(encoding="utf-8-sig"))))
        if not rows or any("esg" in column.lower() for column in rows[0]) or len(rows) != len(snapshot["records"]):
            raise ValueError("Public CSV audit failed")


def fresh_worktree(seed, directory, branch):
    git(seed, "fetch", "--depth=1", "origin", branch)
    parent = text(seed, "rev-parse", "FETCH_HEAD")
    git(seed, "worktree", "add", "--detach", "--no-checkout", str(directory), parent)
    git(directory, "sparse-checkout", "set", "bos")
    git(directory, "checkout", "--detach", parent)
    return parent


def configure_identity(repo):
    git(repo, "config", "user.name", "github-actions[bot]")
    git(repo, "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com")


def remote_head(repo, branch):
    return text(repo, "ls-remote", "origin", "refs/heads/" + branch).split()[0]


def push(repo, branch, expected):
    if remote_head(repo, branch) != expected:
        return False
    # Ordinary push is the atomic remote fast-forward gate; never force or rebase.
    return git(repo, "push", "origin", "HEAD:refs/heads/" + branch, check=False).returncode == 0


def require_private_archive(repo):
    origin = text(repo, "remote", "get-url", "origin")
    if origin not in ("git@github.com:"+ARCHIVE+".git", "https://github.com/"+ARCHIVE+".git"):
        raise ValueError("Unexpected archive destination")
    # Anonymous access must fail as private. Do not send any token here.
    try:
        with urllib.request.urlopen("https://api.github.com/repos/"+ARCHIVE, timeout=30):
            raise ValueError("Source archive is publicly accessible")
    except urllib.error.HTTPError as error:
        if error.code != 404:
            raise


def save_archive(seed, work, payload):
    """Union only this run's immutable files into a fresh private checkout."""
    require_private_archive(seed)
    for attempt in range(3):
        repo = work / ("archive-" + str(time.time_ns()))
        parent = fresh_worktree(seed, repo, "main")
        for path, raw in payload.items():
            relative = Path(path)
            if relative.is_absolute() or ".." in relative.parts or relative.parts[0] != "bos":
                raise ValueError("Invalid private source path")
            feed.immutable_write(repo / relative, raw)
        git(repo, "-c", "core.autocrlf=false", "add", "--", "bos")
        if not git(repo, "diff", "--cached", "--quiet", check=False).returncode:
            return parent
        configure_identity(repo)
        git(repo, "commit", "-m", "Archive private BOS source and validation receipt")
        if push(repo, "main", parent):
            return text(repo, "rev-parse", "HEAD")
    raise RuntimeError("Private archive contention after three attempts; public update held")


def verify_remote(repo, manifest, attempts=13, delay=30):
    expected = {"manifest.json": (repo/"bos/manifest.json").read_bytes()}
    # Includes all retained valuations/CSV and all monthly chunks.
    expected.update({ref["path"]: (repo/"bos"/ref["path"]).read_bytes() for ref in refs(manifest)})
    pending = dict(expected)
    for attempt in range(attempts):
        for path, raw in list(pending.items()):
            try:
                request = urllib.request.Request(RAW+path, headers={"Cache-Control":"no-cache"})
                with urllib.request.urlopen(request, timeout=30) as response:
                    if response.read(len(raw)+1) == raw:
                        del pending[path]
            except (urllib.error.URLError, TimeoutError):
                pass
        if not pending:
            # Recheck manifest after files: never call a mixed revision verified.
            with urllib.request.urlopen(RAW+"manifest.json", timeout=30) as response:
                if response.read() == expected["manifest.json"]:
                    return
        if attempt+1 < attempts:
            print("Waiting for remote BOS raw-file verification", flush=True)
            time.sleep(delay)
    raise RuntimeError("Published data exists but remote raw-file read-back remains unverified")


def run(seed, archive, work):
    seed, archive, work = (Path(path).resolve() for path in (seed, archive, work))
    if text(seed, "remote", "get-url", "origin") != HUB:
        raise ValueError("Unexpected public destination")
    for repo in (seed, archive):
        if text(repo, "status", "--porcelain"):
            raise ValueError("Runner requires clean checkouts")
    require_private_archive(archive)
    work.mkdir(parents=True, exist_ok=True)
    now = dt.datetime.now(dt.timezone.utc)
    day, url, raw = feed.discover_pdf(now.astimezone(feed.SGT).date())
    feed.validate_pdf(raw)
    with tempfile.TemporaryDirectory(prefix="bos-source-") as temp:
        pdf = Path(temp)/"source.pdf"
        pdf.write_bytes(raw)
        data = parse_pdf(pdf, source_url=url)
    stamp = now.strftime("%Y%m%dT%H%M%S%fZ")
    stem = data["reportDate"]+"-"+data["sourceSha256"][:16]
    private = work/"private"
    for attempt in range(3):
        repo = work/("feed-"+str(attempt))
        parent = fresh_worktree(seed, repo, "market-prices")
        old = feed.read_json(repo/"bos/manifest.json")
        result = feed.ingest(data, raw, repo, private, now=now, public=True, expected_date=day)
        if result.get("warnings"):
            raise ValueError("Cleanup warnings hold publication")
        validation = feed.validate_feed(repo)
        manifest = feed.read_json(repo/"bos/manifest.json")
        public_audit(repo/"bos", manifest, old["verifiedMappings"])
        git(repo, "-c", "core.autocrlf=false", "add", "--", "bos")
        guard_index(repo, manifest, parent)
        receipt = {"checkedAt": now.isoformat(), "publisher":"BOS GitHub/Python refresh runner",
                   "sourceChat":"Direct source - no source AI chat", "sourceRegister":"Not used; direct PDF",
                   "sourceUrl":url, "reportDate":data["reportDate"], "priceAsOf":data["priceAsOf"],
                   "sourceSha256":data["sourceSha256"], "validation":validation,
                   "sourceAudit":data["validation"], "importer":result,
                   "originalPricesAndYtdPreserved":True, "publicEsgAbsent":True,
                   "verifiedMappingsUnchanged":True, "outsideBosUnchanged":True,
                   "codeRevision":text(Path(__file__).resolve().parents[1], "rev-parse", "HEAD"),
                   "workflowRunId":os.environ.get("GITHUB_RUN_ID"), "expectedHead":parent}
        # Archive sources before public promotion, even for a known identical PDF.
        payload = {"bos/pdf/"+stem+".pdf":raw,
                   "bos/extracted/"+stem+".json":feed.canonical(data),
                   "bos/receipts/"+stamp+"-attempt"+str(attempt)+".json":feed.canonical(receipt)}
        receipt["privateArchiveCommit"] = save_archive(archive, work, payload)
        changed = git(repo, "diff", "--cached", "--quiet", check=False).returncode != 0
        if changed:
            configure_identity(repo)
            git(repo, "commit", "-m", "Refresh BOS equity coverage "+data["reportDate"])
            if not push(repo, "market-prices", parent):
                continue  # Fresh state and re-ingestion, never transplant bos/.
        elif remote_head(repo, "market-prices") != parent:
            continue
        receipt["publishedCommit"] = text(repo, "rev-parse", "HEAD") if changed else None
        verify_remote(repo, manifest)
        receipt["remoteVerifiedAt"] = dt.datetime.now(dt.timezone.utc).isoformat()
        receipt["outcome"] = "published" if changed else "unchanged"
        save_archive(archive, work, {"bos/receipts/"+stamp+"-complete.json":feed.canonical(receipt)})
        summary = {k:receipt[k] for k in ("outcome","reportDate","priceAsOf","publishedCommit","remoteVerifiedAt")}
        summary.update(validation)
        summary.update(equities=data["validation"]["equities"], indices=data["validation"]["indices"])
        print(json.dumps(summary, indent=2))
        if os.environ.get("GITHUB_STEP_SUMMARY"):
            with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as output:
                output.write("## BOS daily data\n\n```json\n"+json.dumps(summary,indent=2)+"\n```\n\n")
                output.write("Direct source — no source AI chat. [BOS PDF]("+url+"). Source/report date "+data["reportDate"]+"; price cutoff "+data["priceAsOf"]+". Private originals and audit receipts are archived separately.\n")
        return summary
    raise RuntimeError("Public branch contention after three attempts; remote data retained")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--feed-dir", type=Path, required=True)
    parser.add_argument("--archive-dir", type=Path, required=True)
    parser.add_argument("--work-dir", type=Path, required=True)
    args = parser.parse_args()
    run(args.feed_dir, args.archive_dir, args.work_dir)
