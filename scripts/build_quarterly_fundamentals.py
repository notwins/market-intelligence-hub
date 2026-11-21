"""Merge reviewed local Morningstar CSV exports with the annual browser bundle."""

import argparse
import csv
from datetime import date
import json
import math
from pathlib import Path
import re


TYPES = {
    "balance": ("Balance Sheet", "balance-sheet"),
    "cash": ("Cash Flow", "cash-flow"),
    "income": ("Income Statement", "income-statement"),
}
QUARTER = re.compile(r"Q[1-4] \d{4}")


def amount(text):
    if not text.strip():
        return None
    if re.fullmatch(r"[+-]?\d+", text):
        return int(text)
    value = float(text)
    if not math.isfinite(value):
        raise ValueError("Non-finite financial amount")
    return value


def report(file, symbol, kind):
    with file.open(encoding="utf-8-sig", newline="") as source:
        header, *rows = list(csv.reader(source))
    title = re.fullmatch(r"(.+?)_" + kind + r"_Quarterly_As_Originally_Reported", header[0])
    if not title or title[1].upper().lstrip("0") != symbol.upper().lstrip("0"):
        raise ValueError(f"{file.name} does not match the listing and statement")
    if file.stem.endswith(" - No quarterly data"):
        if any(cell.strip() for row in rows for cell in row[1:]):
            raise ValueError(f"{file.name} is marked unavailable but has values")
        return None
    periods = header[1:]
    if len(set(periods)) != len(periods) or not all(label == "TTM" or QUARTER.fullmatch(label) for label in periods):
        raise ValueError(f"Invalid quarterly periods in {file.name}")
    fiscal = re.fullmatch(r"Fiscal year ends in (.+?) \| ([A-Z]{3})", rows[-1][0])
    if not fiscal:
        raise ValueError(f"No fiscal year or currency in {file.name}")
    values = []
    quarterly_columns = [index for index, label in enumerate(periods) if QUARTER.fullmatch(label)]
    for label, *cells in rows[:-1]:
        if len(cells) != len(periods) or not label.strip():
            raise ValueError(f"Invalid financial row in {file.name}")
        indent = len(label) - len(label.lstrip())
        if indent % 4:
            raise ValueError(f"Invalid statement indentation in {file.name}")
        values.append([indent // 4, label.strip(), [amount(cell) for cell in cells]])
    if not any(row[2][index] is not None for row in values for index in quarterly_columns):
        raise ValueError(f"No quarterly figures in {file.name}")
    return dict(currency=fiscal[2], fiscalEnd=fiscal[1], periods=periods, rows=values)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("annual_bundle", type=Path)
    parser.add_argument("quarterly_csvs", type=Path)
    parser.add_argument("capture_date", type=date.fromisoformat)
    parser.add_argument("out", type=Path)
    args = parser.parse_args()
    bundle = json.loads(args.annual_bundle.read_text(encoding="utf-8-sig"))
    directory = Path(__file__).resolve().parents[1] / "site/data/company-fundamentals-listings.json"
    symbols = {key: symbol for key, _, symbol, _ in json.loads(directory.read_text(encoding="utf-8"))}
    if bundle.get("version") != 1 or bundle.get("source") != "Morningstar" or bundle["companies"].keys() != symbols.keys():
        raise ValueError("Annual data does not match the Stocks BETA 2 listing directory")
    captured = str(args.capture_date)
    missing = []
    for ticker, company in bundle["companies"].items():
        name = re.sub(r"[^A-Za-z0-9.]+", "-", ticker)
        statements = {}
        for key, (label, kind) in TYPES.items():
            prefix = f"{name} - {label} - Quarterly - {captured}"
            files = [path for suffix in (".csv", " - No quarterly data.csv")
                     if (path := args.quarterly_csvs / (prefix + suffix)).is_file()]
            if len(files) != 1:
                raise ValueError(f"Expected one CSV for {ticker}, {label}")
            statements[key] = report(files[0], symbols[ticker], kind)
            if statements[key] is None:
                missing.append((ticker, label))
        company["quarterlyCapturedAt"] = captured
        company["quarterly"] = statements
    bundle["version"] = 2
    args.out.write_text(json.dumps(bundle, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{len(symbols)} listings, {len(symbols) * 3 - len(missing)} populated quarterly statements; missing {missing}")


if __name__ == "__main__":
    main()
