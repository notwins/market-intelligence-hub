"""Validate and append a source-checked credit new-issue edition, without fetching.

Default is a read-only dry run:
    python scripts/import_credit_issues.py incoming-edition.json

Write a review candidate, preserving the existing edition history:
    python scripts/import_credit_issues.py incoming-edition.json \
        --existing site/data/credit-issues.json --output-dir /tmp/credit-candidate

The candidate contains site/data/credit-issues.json and site/credit-issues-data.js.
An explicit --output-dir . writes those local publication files; this script never
publishes, changes schedules, or contacts a network service. --dry-run overrides
--output-dir. Missing default history starts an empty dataset; an explicitly named
missing --existing is an error. For first import use --new-dataset instead.

An edition is {id, checked_at, source_scope, rows}; see ROW_FIELDS below. Times
must include seconds and a UTC offset or Z. Date-only pricing never receives an
invented timestamp. checked_at is an edition review time, not a live quote time.
primary_checked is the operator's attestation, not automated source verification.
Retained rows keep their explicit retained_prior_import label and historical date.
All spreads are Treasury-benchmark-at-issue spreads, never OAS or current spreads.
Published yield rounding can account for at most 0.51 bp arithmetic discrepancy.
History and conflicting financial terms cannot be silently rewritten; a correction
workflow with explicit supersession would be needed for changed financial terms.
Duplicate identity conservatively uses ticker/currency/maturity/pricing_date.
Legitimate different-ID tranches sharing those fields require manual reconciliation
before import; this initial schema has no independent ISIN/CUSIP discriminator.
"""

import argparse
from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
import ipaddress
import json
import math
import os
from pathlib import Path
import re
import sys
import tempfile
from urllib.parse import parse_qsl, unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_EXISTING = ROOT / "site/data/credit-issues.json"
SINGAPORE = timezone(timedelta(hours=8))
SPREAD_TOLERANCE_BP = 0.51
DATASET_FIELDS = {"schema_version", "editions"}
EDITION_FIELDS = {"id", "checked_at", "source_scope", "rows"}
ROW_FIELDS = {
    "id", "issuer", "ticker", "currency", "maturity", "pricing_date",
    "pricing_time", "time_precision", "coupon_type", "coupon_percent",
    "issue_price_percent", "issue_yield_percent", "spread_bp", "spread_metric",
    "benchmark", "amount_m", "source_url", "notes", "verification",
}
ECONOMIC_FIELDS = (
    "ticker", "currency", "maturity", "pricing_date", "coupon_type",
    "coupon_percent", "issue_price_percent", "issue_yield_percent", "spread_bp",
    "spread_metric", "amount_m",
)
SAFE_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}\Z")
TICKER = re.compile(r"[A-Z][A-Z0-9.-]{0,11}\Z")
ISO_DATE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}\Z")
ISO_TIME = re.compile(
    r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}"
    r"(?:\.[0-9]{1,6})?(?:Z|[+-][0-9]{2}:[0-9]{2})\Z"
)


def _object(value, fields, where):
    if not isinstance(value, dict) or set(value) != fields:
        raise ValueError(f"{where}: expected exactly {', '.join(sorted(fields))}")


def _text(value, where, *, limit=2000, empty=False):
    if not isinstance(value, str) or len(value) > limit:
        raise ValueError(f"{where}: expected text of at most {limit} characters")
    if (not empty and not value.strip()) or value != value.strip():
        raise ValueError(f"{where}: expected trimmed, nonempty text")
    if any(ord(char) < 32 or ord(char) == 127 for char in value):
        raise ValueError(f"{where}: control characters are not allowed")
    return value


def _id(value, where):
    if not isinstance(value, str) or not SAFE_ID.fullmatch(value):
        raise ValueError(f"{where}: unsafe ID")


def _date(value, where):
    if not isinstance(value, str) or not ISO_DATE.fullmatch(value):
        raise ValueError(f"{where}: expected YYYY-MM-DD")
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise ValueError(f"{where}: invalid calendar date") from error


def _time(value, where):
    if not isinstance(value, str) or not ISO_TIME.fullmatch(value):
        raise ValueError(f"{where}: expected timezone-aware ISO timestamp with seconds")
    try:
        # fromisoformat normalizes malformed offsets such as +08:99; do not.
        if value[-1] != "Z" and (int(value[-5:-3]) > 14 or int(value[-2:]) > 59):
            raise ValueError("invalid UTC offset components")
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.utcoffset() is None or abs(parsed.utcoffset()) > timedelta(hours=14):
            raise ValueError("invalid UTC offset")
        return parsed
    except ValueError as error:
        raise ValueError(f"{where}: invalid timezone-aware timestamp") from error


def _now(now):
    now = datetime.now(timezone.utc) if now is None else now
    if not isinstance(now, datetime) or now.utcoffset() is None:
        raise ValueError("now must be timezone-aware")
    return now


def _number(value, where, minimum, maximum, *, positive=False):
    if type(value) not in (int, float):
        raise ValueError(f"{where}: expected a finite number, not a boolean or string")
    if not minimum <= value <= maximum or not math.isfinite(value):
        raise ValueError(f"{where}: number outside [{minimum}, {maximum}]")
    if positive and value <= 0:
        raise ValueError(f"{where}: must be positive")


def validate_source_url(value):
    """Require a public HTTPS evidence URL, without credentials or token queries."""
    _text(value, "source_url", limit=4096)
    if any(char.isspace() for char in value) or "\\" in value:
        raise ValueError("source_url: whitespace or backslashes are not allowed")
    try:
        parsed = urlsplit(value)
        host = parsed.hostname or ""
        port = parsed.port
    except ValueError as error:
        raise ValueError("source_url: malformed URL") from error
    if parsed.scheme != "https" or not host or port not in (None, 443):
        raise ValueError("source_url: public HTTPS URL required")
    if parsed.username is not None or parsed.password is not None:
        raise ValueError("source_url: credentials are not allowed")
    if "%" in host or host.endswith("."):
        raise ValueError("source_url: encoded or ambiguous hostname")
    if host == "chatgpt.com" or host.endswith(".chatgpt.com") or host == "chat.openai.com":
        raise ValueError("source_url: ChatGPT conversations are not primary evidence")
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        labels = host.split(".")
        if len(labels) < 2 or any(
            not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", label)
            for label in labels
        ) or labels[-1] in {"localhost", "local", "internal", "lan", "home", "onion"}:
            raise ValueError("source_url: public hostname required")
        # Reject numeric shorthand that browsers may interpret as a local IPv4.
        if labels[-1].isdigit() or host == "localhost.localdomain":
            raise ValueError("source_url: ambiguous/private hostname")
    else:
        if not address.is_global:
            raise ValueError("source_url: private/reserved IP addresses are not allowed")
    for key, _ in parse_qsl(parsed.query, keep_blank_values=True):
        key = re.sub(r"[^a-z0-9]", "", unquote(key).lower())
        if any(word in key for word in (
            "token", "password", "passwd", "secret", "credential", "signature",
            "authorization", "session", "apikey", "accesskey", "securitykey",
        )) or key in {"key", "sig", "auth", "code", "jwt", "oauth", "sso"}:
            raise ValueError("source_url: authentication/token query parameters are not allowed")
    # Fragments have no evidentiary value and can conceal bearer tokens.
    if parsed.fragment:
        raise ValueError("source_url: remove URL fragments")
    return value


def _security_key(row):
    # Coupon and coupon type are excluded: changes must not disguise a conflict.
    return tuple(row[field] for field in (
        "ticker", "currency", "maturity", "pricing_date",
    ))


def validate_edition(edition, now=None):
    """Validate one edition without modifying its values or adding timestamps."""
    now = _now(now)
    _object(edition, EDITION_FIELDS, "edition")
    _id(edition["id"], "edition.id")
    checked = _time(edition["checked_at"], "checked_at")
    today = now.astimezone(SINGAPORE).date()
    if checked > now or checked.astimezone(SINGAPORE).date() > today:
        raise ValueError("checked_at: future review timestamps are not allowed")
    _text(edition["source_scope"], "source_scope", limit=4000)
    if not isinstance(edition["rows"], list):
        raise ValueError("edition.rows: expected an array")
    ids, securities = set(), set()
    for row in edition["rows"]:
        _object(row, ROW_FIELDS, "row")
        _id(row["id"], "row.id")
        _text(row["issuer"], "issuer", limit=200)
        if not isinstance(row["ticker"], str) or not TICKER.fullmatch(row["ticker"]):
            raise ValueError("ticker: expected a safe uppercase ticker")
        if row["currency"] != "USD":
            raise ValueError("currency: initial scope supports USD only")
        pricing_date = _date(row["pricing_date"], "pricing_date")
        maturity = _date(row["maturity"], "maturity")
        if pricing_date > today or pricing_date > checked.astimezone(SINGAPORE).date():
            raise ValueError("pricing_date: cannot be later than today or the edition review")
        if maturity <= pricing_date:
            raise ValueError("maturity: must be after pricing_date")
        if row["time_precision"] == "date_only":
            if row["pricing_time"] is not None:
                raise ValueError("pricing_time: date_only requires null, not an invented time")
        elif row["time_precision"] == "timestamp":
            priced = _time(row["pricing_time"], "pricing_time")
            if priced.date() != pricing_date:
                raise ValueError("pricing_time: source-local date must match pricing_date")
            if priced > checked or priced > now:
                raise ValueError("pricing_time: cannot be after review time or now")
        else:
            raise ValueError("time_precision: expected date_only or timestamp")
        if row["coupon_type"] not in ("fixed", "fixed_to_floating"):
            raise ValueError("coupon_type: unsupported coupon type")
        _number(row["coupon_percent"], "coupon_percent", 0, 30)
        _number(row["issue_price_percent"], "issue_price_percent", 0, 200, positive=True)
        _number(row["issue_yield_percent"], "issue_yield_percent", -10, 50)
        _number(row["spread_bp"], "spread_bp", -500, 5000)
        _number(row["amount_m"], "amount_m", 0, 1000000, positive=True)
        if row["spread_metric"] != "treasury_benchmark_at_issue":
            raise ValueError("spread_metric: only treasury_benchmark_at_issue is supported")
        if row["verification"] not in ("primary_checked", "retained_prior_import"):
            raise ValueError("verification: unknown verification status")
        benchmark = row["benchmark"]
        if benchmark is None:
            if row["verification"] == "primary_checked":
                raise ValueError("benchmark: primary_checked requires a Treasury benchmark")
        else:
            _object(benchmark, {"description", "yield_percent"}, "benchmark")
            _text(benchmark["description"], "benchmark.description", limit=1000)
            _number(benchmark["yield_percent"], "benchmark.yield_percent", -10, 30)
            calculated = (row["issue_yield_percent"] - benchmark["yield_percent"]) * 100
            if abs(calculated - row["spread_bp"]) > SPREAD_TOLERANCE_BP + 1e-9:
                raise ValueError("spread_bp: issue yield minus benchmark yield does not match")
        validate_source_url(row["source_url"])
        _text(row["notes"], "notes", limit=6000, empty=True)
        key = _security_key(row)
        if row["id"] in ids or key in securities:
            raise ValueError("row: duplicate ID or security/pricing_date within one edition")
        ids.add(row["id"])
        securities.add(key)
    return edition


def _check_consistent(previous, row):
    if previous["id"] != row["id"]:
        raise ValueError("security/pricing_date: keep the same row ID across editions")
    if any(previous[field] != row[field] for field in ECONOMIC_FIELDS):
        raise ValueError(f"row {row['id']}: contradictory financial terms across editions")
    if previous["benchmark"] is not None and row["benchmark"] is not None:
        if previous["benchmark"]["yield_percent"] != row["benchmark"]["yield_percent"]:
            raise ValueError(f"row {row['id']}: contradictory Treasury benchmark yields")
        if previous["benchmark"]["description"] != row["benchmark"]["description"]:
            raise ValueError(f"row {row['id']}: contradictory Treasury benchmark descriptions")
    if previous["pricing_time"] is not None and row["pricing_time"] is not None:
        if _time(previous["pricing_time"], "pricing_time") != _time(row["pricing_time"], "pricing_time"):
            raise ValueError(f"row {row['id']}: contradictory pricing timestamps")


def validate_dataset(dataset, now=None):
    """Validate all retained history as well as cross-edition security consistency."""
    now = _now(now)
    _object(dataset, DATASET_FIELDS, "dataset")
    if type(dataset["schema_version"]) is not int or dataset["schema_version"] != 1:
        raise ValueError("schema_version: expected integer 1")
    if not isinstance(dataset["editions"], list):
        raise ValueError("editions: expected an array")
    edition_ids, row_ids, securities = set(), {}, {}
    for edition in dataset["editions"]:
        validate_edition(edition, now)
        if edition["id"] in edition_ids:
            raise ValueError("edition: duplicate edition ID")
        edition_ids.add(edition["id"])
        for row in edition["rows"]:
            key = _security_key(row)
            if row["id"] in row_ids and row_ids[row["id"]] != key:
                raise ValueError(f"row {row['id']}: ID reused for a different security/pricing_date")
            if key in securities:
                # Compare every observation, including earlier enriched metadata.
                for previous in securities[key]:
                    _check_consistent(previous, row)
            row_ids[row["id"]] = key
            securities.setdefault(key, []).append(row)
    return dataset


def merge_edition(existing, incoming, now=None):
    """Append or idempotently re-import; never mutate inputs or old editions."""
    now = _now(now)
    validate_dataset(existing, now)
    validate_edition(incoming, now)
    for edition in existing["editions"]:
        if edition["id"] == incoming["id"]:
            if edition != incoming:
                raise ValueError("Existing edition IDs are immutable; use a new edition ID")
            return deepcopy(existing)
    merged = deepcopy(existing)
    merged["editions"].append(deepcopy(incoming))
    return validate_dataset(merged, now)


def active_rows(dataset, now=None):
    """Latest dated review of each security, deduplicated without deleting history."""
    validate_dataset(dataset, now)
    latest = {}
    for edition in sorted(dataset["editions"], key=lambda item: _time(item["checked_at"], "checked_at")):
        for row in edition["rows"]:
            latest[_security_key(row)] = deepcopy(row)
    return list(latest.values())


def _json_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"JSON: duplicate object key {key!r}")
        result[key] = value
    return result


def read_json(path):
    def reject_constant(value):
        raise ValueError(f"JSON: non-finite constant {value}")
    return json.loads(Path(path).read_text(encoding="utf-8"),
                      object_pairs_hook=_json_object, parse_constant=reject_constant)


def write_dataset(dataset, output_dir, now=None):
    """Write a local, deterministic JSON/JS pair after validating the whole merge."""
    now = _now(now)
    validate_dataset(dataset, now)
    output = Path(output_dir)
    json_path = output / "site/data/credit-issues.json"
    js_path = output / "site/credit-issues-data.js"
    if json_path.exists():
        previous = validate_dataset(read_json(json_path), now)
        length = len(previous["editions"])
        if dataset["editions"][:length] != previous["editions"]:
            raise ValueError("output already contains editions that would be removed or changed")
    encoded = json.dumps(dataset, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    compact = json.dumps(dataset, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    for character, escape in (("<", "\\u003c"), (">", "\\u003e"), ("&", "\\u0026"),
                              ("\u2028", "\\u2028"), ("\u2029", "\\u2029")):
        compact = compact.replace(character, escape)
    payloads = ((json_path, encoded), (js_path, "window.MI_CREDIT_ISSUES=" + compact + ";\n"))
    staged = []
    try:
        for destination, payload in payloads:
            destination.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", newline="\n",
                                             dir=destination.parent, delete=False) as handle:
                staged.append((Path(handle.name), destination))
                handle.write(payload)
                handle.flush()
                os.fsync(handle.fileno())
        for temporary, destination in staged:
            os.replace(temporary, destination)
    finally:
        for temporary, _ in staged:
            temporary.unlink(missing_ok=True)
    return json_path, js_path


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("edition", type=Path, help="one incoming edition JSON object")
    history = parser.add_mutually_exclusive_group()
    history.add_argument("--existing", type=Path, help="existing dataset (default: repository publication)")
    history.add_argument("--new-dataset", action="store_true", help="explicitly start an empty candidate")
    parser.add_argument("--output-dir", type=Path, help="candidate root; output files are beneath its site/")
    parser.add_argument("--dry-run", action="store_true", help="validate only, even with --output-dir")
    args = parser.parse_args(argv)
    try:
        now = _now(None)
        path = args.existing if args.existing is not None else DEFAULT_EXISTING
        if args.new_dataset or (args.existing is None and not path.exists()):
            existing = {"schema_version": 1, "editions": []}
        else:
            existing = read_json(path)
        result = merge_edition(existing, read_json(args.edition), now)
        count = len(active_rows(result, now))
        if args.dry_run or args.output_dir is None:
            print(f"Validated dry run: {len(result['editions'])} editions, {count} distinct issues. No files written.")
        else:
            paths = write_dataset(result, args.output_dir, now)
            print(f"Wrote local candidate: {len(result['editions'])} editions, {count} distinct issues.")
            for destination in paths:
                print(destination)
        return 0
    except (ValueError, OSError, UnicodeError) as error:
        print(f"Credit issue import rejected: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
