"""Import dated Bank of Singapore coverage without altering the closing-price series.

The source PDF and full extraction are private. Only an explicitly requested
--public run writes the separate bos data feed, with MSCI ESG omitted.
No network request or parser failure promotes the manifest.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import io
import json
import math
import os
from pathlib import Path
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

SOURCE_ID = "bos-equity-coverage"
BASE_URL = "https://productgroup.bankofsingapore.com/equities_research/"
SOURCE_HOST = "productgroup.bankofsingapore.com"
SGT = ZoneInfo("Asia/Singapore")
MAX_PDF_BYTES = 25 * 1024 * 1024
TIMEOUT_SECONDS = 20
NUMERIC_FIELDS = ("price", "marketCapUsdBillions", "fairValueOrTargetPrice",
                  "upsidePct", "dividendYieldPct", "pe", "pb", "epsGrowthPct",
                  "roePct", "ytdGainPct")
SOURCE_COLUMNS = ("name", "moat", "ticker", "marketCapUsdBillions", "rating", "currency",
                  "price", "fairValueOrTargetPrice", "upsidePct", "dividendYieldPct", "pe", "pb",
                  "epsGrowthPct", "roePct", "riskRating", "ytdGainPct", "esgRating",
                  "analystReportMonth", "analystOrUncertainty")


def canonical(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True,
                       separators=(",", ":"), allow_nan=False) + "\n").encode("utf-8")


def sha256(value):
    return hashlib.sha256(value).hexdigest()


def iso_date(value):
    if not isinstance(value, str):
        raise ValueError("Expected an ISO source date")
    parsed = dt.date.fromisoformat(value)
    if parsed.isoformat() != value:
        raise ValueError("Dates must use YYYY-MM-DD")
    return parsed


def source_url(day):
    return BASE_URL + day.isoformat() + "_equity_coverage_universe.pdf"


def validate_pdf(data):
    if not isinstance(data, bytes) or len(data) < 20 or len(data) > MAX_PDF_BYTES:
        raise ValueError("PDF size outside accepted limits")
    if not data.startswith(b"%PDF-") or b"%%EOF" not in data[-2048:]:
        raise ValueError("Response is not a complete PDF")


def discover_pdf(today, lookback_days=10, opener=urllib.request.urlopen):
    """Try today and the prior ten days. Only an absent edition is skipped."""
    if not 0 <= lookback_days <= 10:
        raise ValueError("Discovery lookback must be between zero and ten days")
    for offset in range(lookback_days + 1):
        day = today - dt.timedelta(days=offset)
        url = source_url(day)
        request = urllib.request.Request(url, headers={
            "User-Agent": "MarketIntelligenceHub-BOSCoverage/1.0",
            "Accept": "application/pdf", "Accept-Encoding": "identity"})
        try:
            with opener(request, timeout=TIMEOUT_SECONDS) as response:
                if response.status != 200:
                    raise ValueError("Unexpected source HTTP status")
                if urllib.parse.urlparse(response.geturl()).hostname != SOURCE_HOST:
                    raise ValueError("Unexpected PDF redirect host")
                mime = response.headers.get_content_type()
                # This source serves an HTML error page with HTTP 200 for absent dates.
                if mime == "text/html":
                    continue
                if mime not in ("application/pdf", "application/octet-stream"):
                    raise ValueError("Source response has a non-PDF content type")
                content_length = response.headers.get("Content-Length")
                if content_length and int(content_length) > MAX_PDF_BYTES:
                    raise ValueError("Source PDF exceeds download limit")
                data = response.read(MAX_PDF_BYTES + 1)
                validate_pdf(data)
                return day, url, data
        except urllib.error.HTTPError as error:
            if error.code not in (404, 410):
                raise
    raise FileNotFoundError("No dated BOS PDF was available within the ten-day lookback")


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def read_ref(root, ref):
    relative = Path(ref["path"])
    path = (root / relative).resolve()
    if relative.is_absolute() or not path.is_relative_to(root.resolve()):
        raise ValueError("Feed reference escapes its directory")
    raw = path.read_bytes()
    if sha256(raw) != ref["sha256"] or len(raw) != ref["bytes"]:
        raise ValueError("Feed reference checksum mismatch")
    return json.loads(raw)


def group_counts(records):
    return {field: {key: sum(str(row.get(field) or "Unspecified") == key for row in records)
                    for key in sorted({str(row.get(field) or "Unspecified") for row in records})}
            for field in ("instrumentType", "region", "marketGroup", "sector")}


def column_keys(columns):
    return [column["key"] if isinstance(column, dict) else column for column in columns]


def validate_snapshot(data, pdf_bytes, today, expected_date=None, previous=None,
                      allow_count_drop=False):
    validate_pdf(pdf_bytes)
    if data.get("schemaVersion") != 1 or data.get("sourceId") != SOURCE_ID:
        raise ValueError("Unsupported BOS snapshot schema/source")
    report_date = iso_date(data.get("reportDate"))
    as_of = iso_date(data.get("priceAsOf"))
    if as_of > report_date or report_date > today:
        raise ValueError("Source dates are future-dated or out of sequence")
    if expected_date and report_date != expected_date:
        raise ValueError("PDF report date does not match requested URL date")
    if data.get("sourceUrl") != source_url(report_date):
        raise ValueError("Source URL does not match the report date")
    if data.get("sourceSha256") != sha256(pdf_bytes):
        raise ValueError("Source PDF checksum mismatch")
    if not data.get("metricBasis"):
        raise ValueError("Missing metric period/basis labels")
    columns = data.get("columns")
    if not isinstance(columns, list) or len(columns) != 19:
        raise ValueError("Expected 19 distinct source columns")
    keys = column_keys(columns)
    if len(set(keys)) != 19 or set(keys) != set(SOURCE_COLUMNS):
        raise ValueError("Expected 19 distinct source columns")
    if "esgRating" not in keys:
        raise ValueError("Missing identifiable ESG source column; public export held")
    records = data.get("records")
    if not isinstance(records, list) or not records:
        raise ValueError("Coverage snapshot has no records")
    audit = data.get("validation", {})
    if audit.get("passed") is not True or audit.get("records") != len(records):
        raise ValueError("Missing or inconsistent complete-parser validation")
    identities = set()
    positions = set()
    for row in records:
        for key in ("instrumentId", "name", "ticker", "region", "marketGroup", "currency"):
            if not isinstance(row.get(key), str) or not row[key].strip():
                raise ValueError("Missing listing identity/group field: " + key)
        if row["instrumentId"] in identities:
            raise ValueError("Duplicate listing identity: " + row["instrumentId"])
        identities.add(row["instrumentId"])
        if row.get("instrumentType") not in ("equity", "index"):
            raise ValueError("Unexpected instrument type")
        if row.get("priceAsOf") != data["priceAsOf"]:
            raise ValueError("Row price date differs from snapshot")
        if not isinstance(row.get("sourcePage"), int) or row["sourcePage"] < 1:
            raise ValueError("Missing positive source page")
        if not isinstance(row.get("sourceRow"), int) or row["sourceRow"] < 1:
            raise ValueError("Missing positive source row")
        position = (row["sourcePage"], row["sourceRow"])
        if position in positions:
            raise ValueError("Duplicate source row position")
        positions.add(position)
        raw = row.get("raw")
        if not isinstance(raw, dict) or set(raw) != set(keys) or not all(isinstance(cell, str) for cell in raw.values()):
            raise ValueError("Incomplete source cells for " + row["instrumentId"])
        for key in NUMERIC_FIELDS:
            if key not in row:
                raise ValueError("Missing numeric field: " + key)
            value = row[key]
            if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float))
                                      or not math.isfinite(value)):
                raise ValueError("Invalid numeric field: " + key)
        if (row["price"] is None and row["instrumentType"] == "equity") or (row["price"] is not None and row["price"] <= 0):
            raise ValueError("Missing or nonpositive source price")
    groups = group_counts(records)
    if audit.get("equities") != groups["instrumentType"].get("equity", 0) or audit.get("indices") != groups["instrumentType"].get("index", 0):
        raise ValueError("Parser instrument totals do not reconcile")
    page_counts = {str(page): sum(row["sourcePage"] == page for row in records)
                   for page in sorted({row["sourcePage"] for row in records})}
    if not isinstance(audit.get("pageCount"), int) or audit["pageCount"] < max(row["sourcePage"] for row in records):
        raise ValueError("Parser page count does not cover source rows")
    if set(audit.get("tablePages", [])) != {int(page) for page in page_counts}:
        raise ValueError("Parser table-page coverage does not reconcile")
    if set(audit.get("pages", {})) != set(page_counts):
        raise ValueError("Missing source-page validation")
    for page, count in page_counts.items():
        page_audit = audit["pages"][page]
        if page_audit.get("records") != count or page_audit.get("independentTextRows") != count:
            raise ValueError("Independent source-page row counts do not reconcile")
    equity_groups = {key: sum(row["instrumentType"] == "equity" and row["marketGroup"] == key for row in records)
                     for key in sorted({row["marketGroup"] for row in records if row["instrumentType"] == "equity"})}
    if audit.get("groups") != equity_groups:
        raise ValueError("Source equity grouping totals do not reconcile")
    if any(sum(counts.values()) != len(records) for counts in groups.values()):
        raise ValueError("Grouping totals do not reconcile")
    if data.get("recordCount") is not None and data["recordCount"] != len(records):
        raise ValueError("Declared record count mismatch")
    if data.get("groupCounts") is not None and data["groupCounts"] != groups:
        raise ValueError("Declared grouping totals mismatch")
    if previous and not allow_count_drop and len(records) < len(previous["records"]) * 0.8:
        raise ValueError("Coverage count fell by more than 20%; explicit review required")
    return groups


def public_snapshot(data, groups):
    """Allow-list public fields; the MSCI ESG column never leaves the private copy."""
    top_fields = ("schemaVersion", "sourceId", "reportDate", "priceAsOf", "sourceUrl",
                  "sourceSha256", "metricBasis", "sourceTitle", "priceKind", "extractorVersion")
    row_fields = ("instrumentId", "instrumentType", "name", "ticker", "region", "marketGroup",
                  "sector", "currency", "price", "priceAsOf", "marketCapUsdBillions", "rating",
                  "moat", "fairValueOrTargetPrice", "upsidePct", "dividendYieldPct", "pe", "pb",
                  "epsGrowthPct", "roePct", "riskRating", "ytdGainPct", "analystReportMonth",
                  "analystOrUncertainty", "researchProvider", "researchProviderEvidence",
                  "researchReportUrl", "sourcePage", "sourceRow", "fairValueOrTargetKind",
                  "priceKind", "valuationBasis", "uncertaintyRating")
    result = {key: data[key] for key in top_fields if key in data}
    result["columns"] = [column for column in data["columns"] if (column["key"] if isinstance(column, dict) else column) != "esgRating"]
    result["records"] = []
    for row in data["records"]:
        public_row = {key: row.get(key) for key in row_fields}
        public_row["raw"] = {key: row["raw"][key] for key in column_keys(result["columns"])}
        result["records"].append(public_row)
    result.update(recordCount=len(result["records"]), groupCounts=groups,
                  omittedFields=["MSCI ESG rating"],
                  omissionReason="Source restricts MSCI ESG redistribution; that column is omitted.")
    return result


def csv_bytes(data):
    fields = ["instrumentId", "instrumentType", "region", "marketGroup", "sector",
              "researchProvider", "fairValueOrTargetKind", *column_keys(data["columns"]), "priceAsOf", "reportDate", "sourcePage", "sourceRow"]
    fields = list(dict.fromkeys(fields))
    stream = io.StringIO(newline="")
    writer = csv.DictWriter(stream, fieldnames=fields)
    writer.writeheader()
    for row in data["records"]:
        record = {**row, "reportDate": data["reportDate"]}
        safe = {}
        for key in fields:
            value = record.get(key)
            if isinstance(value, str) and value.startswith(("=", "+", "-", "@", "\t", "\r")):
                value = "'" + value
            safe[key] = value
        writer.writerow(safe)
    return stream.getvalue().encode("utf-8-sig")


def immutable_write(path, raw):
    if path.exists():
        if path.read_bytes() != raw:
            raise ValueError("Refusing to overwrite immutable file: " + str(path))
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("xb") as handle:
        handle.write(raw)


def atomic_manifest(path, value):
    raw = canonical(value)
    with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".bos-manifest-", delete=False) as handle:
        temp_path = Path(handle.name)
        handle.write(raw)
    try:
        os.replace(temp_path, path)
    finally:
        temp_path.unlink(missing_ok=True)


def reference(relative, raw):
    return {"path": relative, "sha256": sha256(raw), "bytes": len(raw)}


def validated_mappings(mappings, records, require_present=False):
    if not isinstance(mappings, list):
        raise ValueError("Verified mappings must be a list")
    by_id = {row["instrumentId"]: row for row in records}
    seen = set()
    result = []
    for mapping in mappings:
        if set(mapping) != {"ticker", "currency", "instrumentId", "verified"} or mapping["verified"] is not True:
            raise ValueError("Mapping requires a reviewed ticker, currency and listing identity")
        if not all(isinstance(mapping[key], str) and mapping[key].strip() for key in ("ticker", "currency", "instrumentId")):
            raise ValueError("Incomplete verified mapping")
        if mapping["ticker"] in seen:
            raise ValueError("Ambiguous duplicate mapped ticker")
        seen.add(mapping["ticker"])
        row = by_id.get(mapping["instrumentId"])
        if require_present and row is None:
            raise ValueError("Mapped listing is absent from the source")
        if row is not None and (row["currency"] != mapping["currency"] or row["instrumentType"] != "equity"):
            raise ValueError("Mapping currency/type does not match source listing")
        result.append(dict(mapping))
    return result


def ingest(data, pdf_bytes, feed_dir, private_dir, now=None, public=False,
           expected_date=None, allow_count_drop=False, mappings=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    if now.tzinfo is None:
        raise ValueError("Run timestamp must include a timezone")
    root = Path(feed_dir).resolve() / "bos"
    private = Path(private_dir).resolve()
    if private.is_relative_to(Path(feed_dir).resolve()) or private.is_relative_to(Path(__file__).resolve().parents[1]):
        raise ValueError("Private source directory must be outside the public data checkout")
    manifest_path = root / "manifest.json"
    manifest = read_json(manifest_path) if manifest_path.exists() else None
    if manifest and (manifest.get("schemaVersion") != 1 or manifest.get("sourceId") != SOURCE_ID):
        raise ValueError("Existing feed identity/schema mismatch")
    previous = read_ref(root, manifest["latest"]) if manifest else None
    groups = validate_snapshot(data, pdf_bytes, now.astimezone(SGT).date(), expected_date,
                               previous, allow_count_drop)
    prior_mappings = manifest.get("verifiedMappings", []) if manifest else []
    if mappings is None:
        mappings = validated_mappings(prior_mappings, data["records"])
    else:
        mappings = validated_mappings(mappings, data["records"], require_present=True)
        if manifest and mappings != prior_mappings:
            raise ValueError("Changing existing verified mappings requires a separate reviewed migration")
    if manifest and any(item["sourceSha256"] == data["sourceSha256"] for item in manifest["editions"]):
        return {"status": "unchanged", "reportDate": data["reportDate"], "records": len(data["records"])}
    public_data = public_snapshot(data, groups)
    raw_json, raw_csv = canonical(public_data), csv_bytes(public_data)
    stem = data["reportDate"] + "-" + data["sourceSha256"][:16]
    # Full extraction, including restricted columns, is retained outside public trees.
    immutable_write(private / "pdf" / (stem + ".pdf"), pdf_bytes)
    immutable_write(private / "extracted" / (stem + ".json"), canonical(data))
    if not public:
        return {"status": "prepared_private", "reportDate": data["reportDate"],
                "records": len(data["records"]), "publicFeedChanged": False}
    json_path, csv_path = "editions/" + stem + ".json", "editions/" + stem + ".csv"
    edition = {**reference(json_path, raw_json), "reportDate": data["reportDate"],
               "priceAsOf": data["priceAsOf"], "sourceSha256": data["sourceSha256"],
               "sourceUrl": data["sourceUrl"], "csv": reference(csv_path, raw_csv)}
    editions = list(manifest["editions"]) if manifest else []
    editions.append(edition)
    # Same-date revisions become latest; older backfills cannot replace a newer as-of.
    latest = manifest["latest"] if manifest else edition
    if (edition["priceAsOf"], edition["reportDate"]) >= (latest["priceAsOf"], latest["reportDate"]):
        latest = edition
    next_manifest = {
        "schemaVersion": 1, "sourceId": SOURCE_ID, "status": "ok", "checkedAt": now.isoformat(),
        "latest": latest, "editions": sorted(editions, key=lambda item: (item["reportDate"], item["path"]), reverse=True),
        "publicDisplayApproved": True,
        "verifiedMappings": mappings,
        "publicDisplayBasis": "User requested public Hub integration of BOS equity coverage numeric/reference data. MSCI ESG is omitted. This records user publication scope, not a provider licence verification.",
    }
    immutable_write(root / json_path, raw_json)
    immutable_write(root / csv_path, raw_csv)
    atomic_manifest(manifest_path, next_manifest)
    return {"status": "accepted", "reportDate": data["reportDate"], "priceAsOf": data["priceAsOf"],
            "records": len(data["records"]), "latestReportDate": latest["reportDate"],
            "manifest": str(manifest_path), "omittedFields": ["MSCI ESG rating"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--feed-dir", required=True, type=Path)
    parser.add_argument("--private-dir", required=True, type=Path)
    parser.add_argument("--pdf", type=Path, help="Use a supplied PDF instead of discovering online")
    parser.add_argument("--date", help="Expected source report date for a supplied PDF")
    parser.add_argument("--public", action="store_true", help="Write the reviewed numeric feed, excluding MSCI ESG")
    parser.add_argument("--allow-count-drop", action="store_true", help="Use only following explicit coverage-drop review")
    parser.add_argument("--mappings", type=Path, help="Reviewed initial listing mappings JSON list")
    args = parser.parse_args()
    from parse_bos_equity import parse_pdf
    now = dt.datetime.now(dt.timezone.utc)
    if args.pdf:
        if not args.date:
            parser.error("--pdf requires --date")
        expected_date = iso_date(args.date)
        url, raw = source_url(expected_date), args.pdf.read_bytes()
    else:
        if args.date:
            parser.error("--date is only valid with --pdf")
        expected_date, url, raw = discover_pdf(now.astimezone(SGT).date())
    validate_pdf(raw)
    # Parse in an OS temporary directory, never in the public feed tree.
    with tempfile.TemporaryDirectory(prefix="bos-parse-") as temp:
        temporary_pdf = Path(temp) / "source.pdf"
        temporary_pdf.write_bytes(raw)
        data = parse_pdf(temporary_pdf, source_url=url)
    result = ingest(data, raw, args.feed_dir, args.private_dir, now, args.public,
                    expected_date, args.allow_count_drop, read_json(args.mappings) if args.mappings else None)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
