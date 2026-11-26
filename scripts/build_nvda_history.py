"""Build the public NVIDIA history snapshot from the two comparison CSVs."""
import argparse
import csv
import json
import math
from pathlib import Path
import re
from urllib.parse import urlsplit

FINANCIAL = "NVIDIA and 30 Peers - Financial Growth QoQ YoY - Nov-2026.csv"
MARKET = "NVIDIA and 30 Peers - Monthly Prices Dividends and Valuation - Side by Side - Nov-2026.csv"
PERIOD = re.compile(r"^(Latest annual|Latest quarterly|Annual \d{4}|Quarterly \d{4}-Q[1-4]|Half-year \d{4}-H[12]) / (.+)$")
MONTH = re.compile(r"^(\d{4}-\d{2}) / (.+)$")
STATEMENTS = ("Income statement", "Balance sheet", "Cash flow", "Ratios and growth", "USD comparison", "QoQ", "YoY")
DATES = ("Period ending", "Filing or release date", "Period starting (filing date range or inferred)")
FIN_TEXT = {*DATES, "Form or source type", "Source document", "Reporting currency"}
FIN_FX = ("Reporting currency per USD, period average", "Reporting currency per USD, period end")
MARKET_FIELDS = (
    "Close Date", "Close As Traded", "Split-adjusted Close",
    "Cash Dividend per Share in Month (Split-Adjusted)", "Cash Dividend per Share TTM (Split-Adjusted)",
    "Cash Dividend Yield TTM %", "P/E TTM x", "P/B Latest Filed x", "Estimated or Observed Market Cap USD bn",
    "Market Cap Basis", "Shares Source Date", "TTM Net Income Period End", "Earnings Disclosure Date",
    "Earnings Basis", "Book Equity Period End", "Book Equity Disclosure Date",
    "BOS Listing", "BOS Quote Date", "BOS Report Date", "BOS Price", "BOS Price Currency",
    "BOS Consensus Forward P/E x", "BOS Consensus Forward P/B x", "BOS Consensus Forward Dividend Yield %",
    "BOS Market Cap USD bn",
)
MARKET_NUMERIC = set(MARKET_FIELDS) - {
    "Close Date", "Market Cap Basis", "Shares Source Date", "TTM Net Income Period End", "Earnings Disclosure Date",
    "Earnings Basis", "Book Equity Period End", "Book Equity Disclosure Date",
    "BOS Listing", "BOS Quote Date", "BOS Report Date", "BOS Price Currency",
}
PUBLIC_HOSTS = (
    "sec.gov", "dart.fss.or.kr", "samsung.com", "tsmc.com", "hkexnews.hk", "cninfo.com.cn",
    "skhynix.com", "asml.com", "alibabagroup.com", "arm.com", "microsoft.com", "nvidia.com",
)


def read(path):
    with path.open(encoding="utf-8-sig", newline="") as handle:
        header, *rows = csv.reader(handle)
    if len(header) != 32 or header[:2] != ["Item", "NVIDIA (NVDA)"]:
        raise ValueError(f"Unexpected comparison columns in {path.name}")
    if not all(len(row) == len(header) for row in rows):
        raise ValueError(f"Invalid row width in {path.name}")
    if len({row[0] for row in rows}) != len(rows):
        raise ValueError(f"Duplicate item in {path.name}")
    return header, dict((row[0], row[1:]) for row in rows)


def number(value):
    if not value:
        return None
    result = float(value)
    if not math.isfinite(result):
        raise ValueError(f"Invalid number {value!r}")
    return int(result) if result.is_integer() else result


def public_url(value):
    if not value:
        return None
    parts = urlsplit(value)
    host = parts.hostname or ""
    if parts.scheme == "https" and any(host == domain or host.endswith("." + domain) for domain in PUBLIC_HOSTS):
        return value
    return None


def pad(values):
    while values and values[-1] is None:
        values.pop()
    return values


def cells(values, convert):
    return pad([convert(value) for value in values])


def snapshot(folder, output, as_of):
    header, financial = read(folder / FINANCIAL)
    market_header, market = read(folder / MARKET)
    if header != market_header:
        raise ValueError("The financial and market columns must match")
    companies = []
    for idx, label in enumerate(header[1:]):
        name, ticker = label[:-1].rsplit(" (", 1)
        companies.append({"name": name, "ticker": ticker, "currency": market["Reporting Currency"][idx],
                          "quoteCurrency": market["Price Currency"][idx], "symbol": market["Price Symbol"][idx]})
    filings = {}
    fields = []
    for item, values in financial.items():
        match = PERIOD.match(item)
        if not match:
            continue
        period, field = match.groups()
        group = field.split(" / ", 1)[0]
        if field == "Source document":
            row = cells(values, public_url)
        elif field in FIN_TEXT or field.endswith(" / Prior reporting period ending"):
            row = cells(values, lambda value: value or None)
        elif field in FIN_FX or group in STATEMENTS:
            row = cells(values, number)
        else:
            # Quotes, local paths and source inputs stay in the source archive.
            continue
        if row:
            filings.setdefault(period, {})[field] = row
            if field not in fields:
                fields.append(field)
    monthly = {}
    for item, values in market.items():
        match = MONTH.match(item)
        if not match or match[2] not in MARKET_FIELDS:
            continue
        month, field = match.groups()
        row = cells(values, number if field in MARKET_NUMERIC else lambda value: value or None)
        if row:
            monthly.setdefault(month, {})[field] = row
    assert len(companies) == 31 and len(monthly) == 120
    assert filings["Latest quarterly"]["QoQ / Revenue change (USD million)"][0] == 19623
    assert filings["Latest quarterly"]["QoQ / Revenue growth (%)"][0] == 20.39
    assert monthly["2026-11"]["Close As Traded"][0] == 149.3
    assert monthly["2026-10"]["BOS Price"][0] == 204.64
    output.mkdir(parents=True, exist_ok=True)
    for filename, payload in {
        "financials.json": {"schemaVersion": 1, "asOf": as_of, "companies": companies, "fields": fields, "periods": filings},
        "monthly.json": {"schemaVersion": 1, "asOf": as_of, "tickers": [c["ticker"] for c in companies], "months": monthly},
    }.items():
        text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n"
        (output / filename).write_text(text, encoding="utf-8", newline="\n")
        print(filename, len(text.encode("utf-8")), "bytes")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_folder", type=Path)
    parser.add_argument("output_folder", type=Path)
    parser.add_argument("--as-of", required=True)
    args = parser.parse_args()
    snapshot(args.input_folder, args.output_folder, args.as_of)
