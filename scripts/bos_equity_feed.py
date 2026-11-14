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
import re
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
VALUATION_RETENTION = 5
PRICE_SOURCE_ID = "bos-equity-prices"
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
    validate_ref(ref)
    relative = Path(ref["path"])
    path = (root / relative).resolve()
    if relative.is_absolute() or not path.is_relative_to(root.resolve()):
        raise ValueError("Feed reference escapes its directory")
    raw = path.read_bytes()
    if sha256(raw) != ref["sha256"] or len(raw) != ref["bytes"]:
        raise ValueError("Feed reference checksum mismatch")
    return json.loads(raw)


def validate_ref(ref, namespace=None):
    if (not isinstance(ref, dict) or not isinstance(ref.get("path"), str)
            or not re.fullmatch(r"[a-zA-Z0-9_./-]+", ref["path"])
            or ".." in ref["path"] or ref["path"].startswith("/")
            or not isinstance(ref.get("sha256"), str)
            or not re.fullmatch(r"[a-f0-9]{64}", ref["sha256"])
            or type(ref.get("bytes")) is not int or ref["bytes"] <= 0):
        raise ValueError("Invalid immutable feed reference")
    if namespace and not ref["path"].startswith(namespace + "/"):
        raise ValueError("Unexpected feed reference directory")


def finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def validate_stored_edition(data, ref):
    """Recheck archived public input before migration or fallback retention."""
    validate_ref(ref, "editions")
    report_date, as_of = iso_date(data.get("reportDate")), iso_date(data.get("priceAsOf"))
    if (data.get("schemaVersion") != 1 or data.get("sourceId") != SOURCE_ID
            or as_of > report_date or data.get("sourceUrl") != source_url(report_date)
            or not re.fullmatch(r"[a-f0-9]{64}", str(data.get("sourceSha256", "")))
            or any(data.get(key) != ref.get(key) for key in ("reportDate", "priceAsOf", "sourceSha256", "sourceUrl"))
            or not isinstance(data.get("records"), list) or not data["records"]):
        raise ValueError("Invalid stored BOS edition identity/dates")
    ids = set()
    for row in data["records"]:
        if (not isinstance(row.get("instrumentId"), str) or not row["instrumentId"]
                or row["instrumentId"] in ids or row.get("instrumentType") not in ("equity", "index")
                or not isinstance(row.get("ticker"), str) or not row["ticker"]
                or not isinstance(row.get("currency"), str) or not row["currency"]
                or row.get("priceAsOf") != data["priceAsOf"]
                or type(row.get("sourcePage")) is not int or row["sourcePage"] < 1
                or type(row.get("sourceRow")) is not int or row["sourceRow"] < 1
                or not isinstance(row.get("raw"), dict) or not isinstance(row["raw"].get("price"), str)
                or "esgRating" in row or "esgRating" in row["raw"]):
            raise ValueError("Invalid stored BOS listing")
        ids.add(row["instrumentId"])
        for key in NUMERIC_FIELDS:
            if key not in row or row[key] is not None and not finite(row[key]):
                raise ValueError("Invalid stored BOS numeric field")
        if (row["price"] is None and row["instrumentType"] == "equity") or (row["price"] is not None and row["price"] <= 0):
            raise ValueError("Invalid stored BOS price")
    return data


def load_feed(root):
    path = root / "manifest.json"
    if not path.exists():
        return None, None, {}
    raw = path.read_bytes()
    manifest = json.loads(raw)
    if (manifest.get("schemaVersion") != 1 or manifest.get("sourceId") != SOURCE_ID
            or not isinstance(manifest.get("editions"), list) or not manifest["editions"]):
        raise ValueError("Existing feed identity/schema mismatch")
    stored, hashes = {}, set()
    for ref in manifest["editions"]:
        validate_ref(ref, "editions")
        if ref["path"] in stored or ref.get("sourceSha256") in hashes:
            raise ValueError("Duplicate stored edition")
        stored[ref["path"]] = validate_stored_edition(read_ref(root, ref), ref)
        hashes.add(ref["sourceSha256"])
        validate_ref(ref.get("csv"), "editions")
        csv_path = (root / ref["csv"]["path"]).resolve()
        if not csv_path.is_relative_to(root.resolve()):
            raise ValueError("CSV reference escapes its directory")
        csv_raw = csv_path.read_bytes()
        if len(csv_raw) != ref["csv"]["bytes"] or sha256(csv_raw) != ref["csv"]["sha256"]:
            raise ValueError("Stored CSV checksum mismatch")
    if not any(ref == manifest.get("latest") for ref in manifest["editions"]):
        raise ValueError("Latest edition is not in the retained set")
    return manifest, raw, stored


def validate_price_chunk(chunk, month):
    if (not re.fullmatch(r"\d{4}-\d{2}", month) or iso_date(month + "-01").strftime("%Y-%m") != month
            or set(chunk) != {"schemaVersion", "sourceId", "month", "priceKind", "sources", "series"}
            or chunk["schemaVersion"] != 1 or chunk["sourceId"] != PRICE_SOURCE_ID
            or chunk["month"] != month or chunk["priceKind"] != "published_reference_price"
            or not isinstance(chunk["sources"], list) or not chunk["sources"]
            or not isinstance(chunk["series"], dict)):
        raise ValueError("Invalid BOS monthly price schema")
    hashes, observations = set(), set()
    for source in chunk["sources"]:
        if (set(source) != {"sourceSha256", "reportDate", "priceAsOf", "sourceUrl"}
                or not re.fullmatch(r"[a-f0-9]{64}", str(source.get("sourceSha256", "")))
                or source["sourceSha256"] in hashes
                or iso_date(source["priceAsOf"]) > iso_date(source["reportDate"])
                or source["priceAsOf"][:7] != month
                or source["sourceUrl"] != source_url(iso_date(source["reportDate"]))):
            raise ValueError("Invalid BOS price provenance")
        hashes.add(source["sourceSha256"])
    used_sources = set()
    for identity, series in chunk["series"].items():
        if (not isinstance(identity, str) or not identity
                or set(series) != {"currency", "instrumentType", "ticker", "points"}
                or not isinstance(series["currency"], str) or not series["currency"]
                or series["instrumentType"] not in ("equity", "index")
                or not isinstance(series["ticker"], str) or not series["ticker"]
                or not isinstance(series["points"], list) or not series["points"]):
            raise ValueError("Invalid BOS price listing")
        ordered = []
        for point in series["points"]:
            if (not isinstance(point, list) or len(point) != 6 or not finite(point[1]) or point[1] <= 0
                    or type(point[2]) is not int or not 0 <= point[2] < len(chunk["sources"])
                    or not isinstance(point[3], str)
                    or type(point[4]) is not int or point[4] < 1
                    or type(point[5]) is not int or point[5] < 1):
                raise ValueError("Invalid BOS price observation")
            iso_date(point[0])
            source = chunk["sources"][point[2]]
            key = (identity, source["sourceSha256"])
            if point[0] != source["priceAsOf"] or point[0][:7] != month or key in observations:
                raise ValueError("Duplicate or inconsistent BOS price observation")
            observations.add(key)
            used_sources.add(point[2])
            ordered.append((point[0], point[2]))
        if ordered != sorted(ordered):
            raise ValueError("BOS price observations are not ordered")
    if used_sources != set(range(len(chunk["sources"]))):
        raise ValueError("BOS price provenance has no observations")
    return chunk


def price_history_index(manifest):
    history = manifest.get("priceHistory") if manifest else None
    if history is None:
        return {"schemaVersion": 1, "sourceId": PRICE_SOURCE_ID, "months": {}, "sourceHashes": []}
    if (set(history) != {"schemaVersion", "sourceId", "months", "sourceHashes"}
            or history["schemaVersion"] != 1 or history["sourceId"] != PRICE_SOURCE_ID
            or not isinstance(history["months"], dict) or not isinstance(history["sourceHashes"], list)
            or any(not isinstance(h, str) or not re.fullmatch(r"[a-f0-9]{64}", h) for h in history["sourceHashes"])
            or len(set(history["sourceHashes"])) != len(history["sourceHashes"])):
        raise ValueError("Invalid BOS price-history index")
    for month, ref in history["months"].items():
        iso_date(month + "-01")
        validate_ref(ref, "prices")
    return {**history, "months": dict(history["months"]), "sourceHashes": list(history["sourceHashes"])}


def validate_price_history(root, history):
    chunks, hashes = {}, set()
    for month, ref in history["months"].items():
        chunk = validate_price_chunk(read_ref(root, ref), month)
        for source in chunk["sources"]:
            if source["sourceSha256"] in hashes:
                raise ValueError("Price-history source occurs in more than one month")
            hashes.add(source["sourceSha256"])
        chunks[month] = chunk
    if hashes != set(history["sourceHashes"]):
        raise ValueError("Price-history source hash index does not reconcile")
    return chunks


def price_history_plan(root, manifest, snapshots):
    history = price_history_index(manifest)
    existing_chunks = validate_price_history(root, history)
    months, hashes = history["months"], set(history["sourceHashes"])
    changed, originals, writes, obsolete = {}, {}, {}, []
    for data in snapshots:
        source_hash, month = data["sourceSha256"], data["priceAsOf"][:7]
        if source_hash in hashes:
            # Retained snapshots are checked against the index, including no-op runs.
            if month not in months:
                raise ValueError("Price-history hash is missing its month")
            chunk = changed.get(month)
            if chunk is None:
                chunk = existing_chunks[month]
            if not any(s["sourceSha256"] == source_hash for s in chunk["sources"]):
                raise ValueError("Price-history hash is missing its source")
            verify_source_prices(chunk, data)
            continue
        if month not in changed:
            if month in months:
                chunk = existing_chunks[month]
                originals[month] = json.loads(canonical(chunk))
            else:
                chunk = {"schemaVersion": 1, "sourceId": PRICE_SOURCE_ID, "month": month,
                         "priceKind": "published_reference_price", "sources": [], "series": {}}
            changed[month] = chunk
        chunk = changed[month]
        source_index = len(chunk["sources"])
        chunk["sources"].append({key: data[key] for key in ("sourceSha256", "reportDate", "priceAsOf", "sourceUrl")})
        for row in data["records"]:
            if row["price"] is None:
                continue
            identity = row["instrumentId"]
            identity_fields = {key: row[key] for key in ("currency", "instrumentType", "ticker")}
            series = chunk["series"].setdefault(identity, {**identity_fields, "points": []})
            if any(series[key] != value for key, value in identity_fields.items()):
                raise ValueError("BOS price history listing currency/type changed")
            series["points"].append([row["priceAsOf"], row["price"], source_index,
                                     row["raw"]["price"], row["sourcePage"], row["sourceRow"]])
            series["points"].sort(key=lambda point: (point[0], point[2]))
        hashes.add(source_hash)
        verify_source_prices(chunk, data)
    for month, chunk in changed.items():
        validate_price_chunk(chunk, month)
        old = originals.get(month)
        if old:
            if chunk["sources"][:len(old["sources"])] != old["sources"]:
                raise ValueError("Price-history source provenance would change")
            for identity, series in old["series"].items():
                if any(point not in chunk["series"][identity]["points"] for point in series["points"]):
                    raise ValueError("Original price observations would change")
        raw = canonical(chunk)
        path = "prices/" + month + "-" + sha256(raw)[:16] + ".json"
        writes[path] = raw
        if month in months and months[month]["path"] != path:
            obsolete.append(months[month]["path"])
        months[month] = reference(path, raw)
    history["months"] = dict(sorted(months.items()))
    history["sourceHashes"] = sorted(hashes)
    return history, writes, obsolete


def verify_source_prices(chunk, data):
    indices = [i for i, source in enumerate(chunk["sources"]) if source["sourceSha256"] == data["sourceSha256"]]
    if len(indices) != 1:
        raise ValueError("Ambiguous price-history source identity")
    index = indices[0]
    if chunk["sources"][index] != {key: data[key] for key in ("sourceSha256", "reportDate", "priceAsOf", "sourceUrl")}:
        raise ValueError("Price-history source metadata differs")
    actual = {identity: [point for point in series["points"] if point[2] == index]
              for identity, series in chunk["series"].items()}
    actual = {key: value for key, value in actual.items() if value}
    expected = {}
    for row in data["records"]:
        if row["price"] is None:
            continue
        identity = row["instrumentId"]
        if identity not in chunk["series"] or any(chunk["series"][identity][key] != row[key] for key in ("currency", "instrumentType", "ticker")):
            raise ValueError("Price-history listing identity differs")
        expected[identity] = [[row["priceAsOf"], row["price"], index, row["raw"]["price"], row["sourcePage"], row["sourceRow"]]]
    if actual != expected:
        raise ValueError("Price-history observations differ from the original edition")


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
        handle.flush()
        os.fsync(handle.fileno())
    try:
        os.replace(temp_path, path)
    finally:
        temp_path.unlink(missing_ok=True)


def reference(relative, raw):
    return {"path": relative, "sha256": sha256(raw), "bytes": len(raw)}


def retain_editions(editions, latest):
    """Keep the selected latest plus four newest successful observations.

    Same-date revisions count separately. Acceptance time breaks date ties;
    legacy ties keep their existing order, with latest always retained.
    """
    ordered = sorted(editions, key=lambda ref: (ref["priceAsOf"], ref["reportDate"], ref.get("acceptedAt", "")), reverse=True)
    retained = [latest] + [ref for ref in ordered if ref["path"] != latest["path"]][:VALUATION_RETENTION - 1]
    return sorted(retained, key=lambda ref: (ref["reportDate"], ref["priceAsOf"], ref.get("acceptedAt", "")), reverse=True)


def safe_public_path(root, relative):
    if not isinstance(relative, str) or not re.fullmatch(r"(?:editions|prices)/[a-zA-Z0-9_.-]+\.(?:json|csv)", relative):
        raise ValueError("Unexpected immutable data path")
    path = (root / relative).resolve()
    if not path.is_relative_to(root.resolve()) or path == root.resolve():
        raise ValueError("Immutable data path escapes BOS directory")
    return path


def publish_plan(root, expected_manifest, manifest, writes, obsolete):
    """Install verified immutable files, then atomically switch one pointer.

    A failed write/swap removes only newly created files. A local lock and
    manifest compare-and-swap reject concurrent writers. Git publication must
    still use a normal non-force push/reviewed expected-head update.
    """
    paths = {relative: safe_public_path(root, relative) for relative in writes}
    removals = [safe_public_path(root, relative) for relative in set(obsolete) - set(writes)]
    for relative, path in paths.items():
        if path.exists() and path.read_bytes() != writes[relative]:
            raise ValueError("Conflicting immutable data file")
    root.mkdir(parents=True, exist_ok=True)
    lock = root / ".bos-ingest.lock"
    try:
        fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as error:
        raise ValueError("Another BOS writer holds the local lock; retry after it finishes") from error
    os.close(fd)
    created, warnings = [], []
    manifest_path = root / "manifest.json"
    try:
        current = manifest_path.read_bytes() if manifest_path.exists() else None
        if current != expected_manifest:
            raise ValueError("BOS manifest changed concurrently; reload and retry")
        try:
            for relative, path in paths.items():
                if not path.exists():
                    created.append(path)
                immutable_write(path, writes[relative])
                if path.read_bytes() != writes[relative]:
                    raise ValueError("Written BOS data failed readback validation")
            # All referenced outputs are complete before the only mutable pointer.
            atomic_manifest(manifest_path, manifest)
        except BaseException:
            for path in reversed(created):
                path.unlink(missing_ok=True)
            raise
        # Old full editions and superseded monthly versions are removed only
        # after all original observations are safely in the promoted history.
        for path in removals:
            try:
                path.unlink(missing_ok=True)
            except OSError as error:
                warnings.append("Could not remove obsolete BOS data: " + path.name + ": " + str(error))
    finally:
        lock.unlink(missing_ok=True)
    return warnings


def update_plan(root, manifest, stored, incoming=None, now=None):
    """Pure plan: migration, history preservation and retention precede writes."""
    editions = list(manifest["editions"]) if manifest else []
    writes = {}
    if incoming is not None:
        stem = incoming["reportDate"] + "-" + incoming["sourceSha256"][:16]
        raw_json, raw_csv = canonical(incoming), csv_bytes(incoming)
        json_path, csv_path = "editions/" + stem + ".json", "editions/" + stem + ".csv"
        edition = {**reference(json_path, raw_json), "reportDate": incoming["reportDate"],
                   "priceAsOf": incoming["priceAsOf"], "sourceSha256": incoming["sourceSha256"],
                   "sourceUrl": incoming["sourceUrl"], "csv": reference(csv_path, raw_csv),
                   "acceptedAt": now.isoformat()}
        editions.append(edition)
        stored = {**stored, json_path: incoming}
        writes.update({json_path: raw_json, csv_path: raw_csv})
    latest = manifest["latest"] if manifest else edition
    if incoming is not None and (edition["priceAsOf"], edition["reportDate"]) >= (latest["priceAsOf"], latest["reportDate"]):
        latest = edition
    # Oldest first produces stable provenance indices during a legacy migration.
    ordered = sorted(editions, key=lambda ref: (ref["reportDate"], ref.get("acceptedAt", "")))
    snapshots = [stored[ref["path"]] for ref in ordered]
    history, history_writes, obsolete = price_history_plan(root, manifest, snapshots)
    retained = retain_editions(editions, latest)
    retained_paths = {ref["path"] for ref in retained}
    for ref in editions:
        if ref["path"] not in retained_paths:
            obsolete.extend([ref["path"], ref["csv"]["path"]])
            writes.pop(ref["path"], None)
            writes.pop(ref["csv"]["path"], None)
    writes.update(history_writes)
    next_manifest = {**(manifest or {}), "schemaVersion": 1, "sourceId": SOURCE_ID,
                     "latest": latest, "editions": retained, "valuationRetention": VALUATION_RETENTION,
                     "priceHistory": history}
    if incoming is not None:
        next_manifest.update(status="ok", checkedAt=now.isoformat())
    return next_manifest, writes, obsolete


def maintain(feed_dir):
    """Migrate existing successful editions without a download or new dates."""
    root = Path(feed_dir).resolve() / "bos"
    manifest, raw, stored = load_feed(root)
    if manifest is None:
        raise ValueError("No existing BOS feed to maintain")
    next_manifest, writes, obsolete = update_plan(root, manifest, stored)
    if canonical(next_manifest) == raw and not writes and not obsolete:
        return {"status": "unchanged", "records": len(stored[manifest["latest"]["path"]]["records"])}
    warnings = publish_plan(root, raw, next_manifest, writes, obsolete)
    return {"status": "maintained", "latestReportDate": next_manifest["latest"]["reportDate"],
            "valuationEditions": len(next_manifest["editions"]), "priceMonths": len(next_manifest["priceHistory"]["months"]),
            "priceSources": len(next_manifest["priceHistory"]["sourceHashes"]), "warnings": warnings}


def validate_feed(feed_dir):
    """Read-only validation of every referenced valuation and price chunk."""
    root = Path(feed_dir).resolve() / "bos"
    manifest, _, stored = load_feed(root)
    if manifest is None or manifest.get("valuationRetention") != VALUATION_RETENTION or not 1 <= len(manifest["editions"]) <= VALUATION_RETENTION or "priceHistory" not in manifest:
        raise ValueError("BOS feed requires bounded-retention maintenance")
    history = price_history_index(manifest)
    chunks = validate_price_history(root, history)
    for data in stored.values():
        month = data["priceAsOf"][:7]
        if month not in chunks:
            raise ValueError("Retained valuation has no price history")
        verify_source_prices(chunks[month], data)
    referenced = {ref["path"] for ref in manifest["editions"]}
    referenced.update(ref["csv"]["path"] for ref in manifest["editions"])
    referenced.update(ref["path"] for ref in history["months"].values())
    actual = {path.relative_to(root).as_posix() for folder in ("editions", "prices")
              for path in (root / folder).rglob("*") if path.is_file()}
    if actual != referenced:
        raise ValueError("Unreferenced BOS data files remain; review cleanup before publication")
    return {"status": "valid", "valuationEditions": len(manifest["editions"]),
            "priceMonths": len(chunks), "priceSources": len(history["sourceHashes"]),
            "priceObservations": sum(len(series["points"]) for chunk in chunks.values() for series in chunk["series"].values())}


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
    manifest, previous_manifest_bytes, stored = load_feed(root)
    previous = stored[manifest["latest"]["path"]] if manifest else None
    groups = validate_snapshot(data, pdf_bytes, now.astimezone(SGT).date(), expected_date,
                               previous, allow_count_drop)
    prior_mappings = manifest.get("verifiedMappings", []) if manifest else []
    if mappings is None:
        mappings = validated_mappings(prior_mappings, data["records"])
    else:
        mappings = validated_mappings(mappings, data["records"], require_present=True)
        if manifest and mappings != prior_mappings:
            raise ValueError("Changing existing verified mappings requires a separate reviewed migration")
    known_hashes = set(price_history_index(manifest)["sourceHashes"])
    if manifest:
        known_hashes.update(item["sourceSha256"] for item in manifest["editions"])
    if data["sourceSha256"] in known_hashes:
        if public:
            result = maintain(feed_dir)
            result.update(reportDate=data["reportDate"], records=len(data["records"]))
            return result
        return {"status": "unchanged", "reportDate": data["reportDate"], "records": len(data["records"])}
    public_data = public_snapshot(data, groups)
    stem = data["reportDate"] + "-" + data["sourceSha256"][:16]
    # Full extraction, including restricted columns, is retained outside public trees.
    immutable_write(private / "pdf" / (stem + ".pdf"), pdf_bytes)
    immutable_write(private / "extracted" / (stem + ".json"), canonical(data))
    if not public:
        return {"status": "prepared_private", "reportDate": data["reportDate"],
                "records": len(data["records"]), "publicFeedChanged": False}
    next_manifest, writes, obsolete = update_plan(root, manifest, stored, public_data, now)
    next_manifest.update(publicDisplayApproved=True, verifiedMappings=mappings,
                         publicDisplayBasis="User requested public Hub integration of BOS equity coverage numeric/reference data. MSCI ESG is omitted. This records user publication scope, not a provider licence verification.")
    warnings = publish_plan(root, previous_manifest_bytes, next_manifest, writes, obsolete)
    return {"status": "accepted", "reportDate": data["reportDate"], "priceAsOf": data["priceAsOf"],
            "records": len(data["records"]), "latestReportDate": next_manifest["latest"]["reportDate"],
            "manifest": str(manifest_path), "omittedFields": ["MSCI ESG rating"],
            "valuationEditions": len(next_manifest["editions"]), "priceMonths": len(next_manifest["priceHistory"]["months"]),
            "priceSources": len(next_manifest["priceHistory"]["sourceHashes"]), "warnings": warnings}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--feed-dir", required=True, type=Path)
    parser.add_argument("--private-dir", type=Path)
    parser.add_argument("--pdf", type=Path, help="Use a supplied PDF instead of discovering online")
    parser.add_argument("--date", help="Expected source report date for a supplied PDF")
    parser.add_argument("--public", action="store_true", help="Write the reviewed numeric feed, excluding MSCI ESG")
    parser.add_argument("--allow-count-drop", action="store_true", help="Use only following explicit coverage-drop review")
    parser.add_argument("--mappings", type=Path, help="Reviewed initial listing mappings JSON list")
    parser.add_argument("--maintain", action="store_true", help="Migrate/compact existing BOS data without downloading or changing source/check dates; requires --public")
    parser.add_argument("--validate", action="store_true", help="Read-only validation of every retained valuation and monthly price reference")
    args = parser.parse_args()
    if args.validate:
        if args.maintain or args.pdf or args.date or args.mappings or args.allow_count_drop:
            parser.error("--validate cannot be combined with import/maintenance options")
        print(json.dumps(validate_feed(args.feed_dir), indent=2))
        return
    if args.maintain:
        if not args.public or args.pdf or args.date or args.mappings or args.allow_count_drop:
            parser.error("--maintain requires --public and cannot be combined with source/import overrides")
        print(json.dumps(maintain(args.feed_dir), indent=2))
        return
    if not args.private_dir:
        parser.error("--private-dir is required for PDF ingestion")
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
