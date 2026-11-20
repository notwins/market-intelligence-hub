"""Build the public Stocks BETA 2 BOS archive from the monthly workbook."""

import argparse
import csv
from collections import defaultdict
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
KIND = "mih-bos-monthly-public"
MONTHLY_COLUMNS = (
    "Month", "Ticker", "Quote unit", "Share price", "Implied forward EPS", "BOS call",
    "BOS price target", "Target − price", "Gap %", "Forward P/E", "Source page", "Page row",
)
CALLS = {"Buy", "BUY", "Hold", "Sell", "UR", "Restricted", "Closed", "NA", "Accept", "Reject"}
TARGET_MARKERS = {"UR", "Restricted", "RESTRICTED", "NA", "Closed"}


def bloomberg_isins(history):
    """Use the Hub's reviewed, public listing identities."""
    verified = defaultdict(set)
    conflicts = set()
    with history.open(encoding="utf-8-sig", newline="") as file:
        for row in csv.reader(file):
            if len(row) < 4 or row[1] != "I":
                continue
            record = json.loads(row[3])
            ticker, currency, isin = (record.get(key) for key in ("bbTicker", "currency", "isin"))
            if record["identityStatus"] == "conflict" and ticker:
                conflicts.add(ticker)
            if (record.get("sourceId") == "bloomberg-equity-snapshot" and record["currentEligible"]
                    and record["identityStatus"] == "exact_ticker_currency"
                    and ticker and currency and isin and re.fullmatch(r"[A-Z]{2}[A-Z0-9]{9}\d", isin)):
                verified[ticker, currency].add(isin)
    return {key: next(iter(ids)) for key, ids in verified.items() if len(ids) == 1 and key[0] not in conflicts}


def monthly_rows(workbook):
    from openpyxl import load_workbook

    reports = {}
    listings = defaultdict(dict)
    book = load_workbook(workbook, read_only=True, data_only=True)
    try:
        dates = iter(book["Reports"].values)
        if next(dates) != ("Archive month", "Report date", "Price date", "Source CSV"):
            raise ValueError("Unexpected workbook Reports columns.")
        for month_date, report_date, quote_date, _ in dates:
            month = month_date.strftime("%Y-%m")
            if month in reports or quote_date > report_date:
                raise ValueError(f"Invalid report calendar for {month}.")
            reports[month] = [month, report_date.date().isoformat(), quote_date.date().isoformat()]

        months = sorted(reports)
        month_indexes = {month: index for index, month in enumerate(months)}
        rows = iter(book["Monthly"].values)
        if next(rows) != MONTHLY_COLUMNS:
            raise ValueError("Unexpected workbook Monthly columns.")
        for month, ticker, unit, price, eps, call, target, gap, pct, _, _, _ in rows:
            index = month_indexes[month.strftime("%Y-%m")]
            key = ticker, unit
            if index in listings[key]:
                raise ValueError(f"Duplicate ticker-month {key} {months[index]}.")
            if not (price > 0 and eps > 0 and call in CALLS):
                raise ValueError(f"Invalid price, EPS or rating for {key}.")
            if target in TARGET_MARKERS:
                if gap is not None or pct is not None:
                    raise ValueError(f"Nonnumeric target with price gaps for {key}.")
            else:
                if not isinstance(target, (float, int)) or target < 0 or gap is None or pct is None:
                    raise ValueError(f"Incomplete numeric target for {key}.")
            listings[key][index] = [index, price, eps, call, target, gap, pct]
    finally:
        book.close()
    return [reports[month] for month in months], listings


def build(workbook, output):
    months, listings = monthly_rows(workbook)
    isins = bloomberg_isins(ROOT / "site/data/share-history.csv")
    public = {
        "kind": KIND,
        "version": 1,
        "months": months,
        "listings": [
            [ticker, unit, [points[index] for index in sorted(points)], isins.get((ticker, unit))]
            for (ticker, unit), points in sorted(listings.items())
        ],
        "observationCount": sum(map(len, listings.values())),
    }
    output.write_text(json.dumps(public, ensure_ascii=False, allow_nan=False, separators=(",", ":")) + "\n",
                      encoding="utf-8", newline="\n")
    return public


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    archive = build(args.workbook, args.output)
    print(f"{archive['observationCount']:,} observations across {len(archive['listings']):,} listings, "
          f"{len(archive['months'])} months, "
          f"{sum(row[3] is not None for row in archive['listings']):,} BBG identities.")
