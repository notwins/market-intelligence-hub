"""Prepare a browser-local import from the saved annual XLS statement exports."""

import argparse
import csv
from datetime import datetime
import json
import math
from pathlib import Path
import re
from urllib.parse import urlsplit

import xlrd


STATEMENTS = (
    ("income", "Income statement", "income-statement"),
    ("balance", "Balance sheet", "balance-sheet"),
    ("cash", "Cash flow", "cash-flow"),
)
ROOT = Path(__file__).resolve().parents[1]


def read_statement(path, symbol, kind):
    with xlrd.open_workbook(path, on_demand=True) as book:
        assert book.nsheets == 1, path
        sheet = book.sheet_by_index(0)
        assert sheet.name.upper().lstrip("0") == symbol.upper().lstrip("0"), path
        assert sheet.cell_value(0, 0) == f"{sheet.name}_{kind}_Annual_As_Originally_Reported", path
        _, *periods = sheet.row_values(0)
        assert len(periods) == len(set(periods)) and all(re.fullmatch(r"\d{4}|TTM", period) for period in periods), path
        fiscal = re.fullmatch(r"Fiscal year ends in (.+?) \| ([A-Z]{3})", sheet.cell_value(sheet.nrows - 1, 0))
        assert fiscal, path
        rows = []
        for row in sheet.get_rows():
            index = len(rows)
            if row[0].value == sheet.cell_value(0, 0) or row[0].value.startswith("Fiscal year ends in "):
                continue
            label = row[0].value
            indent = len(label) - len(label.lstrip())
            assert indent % 4 == 0 and label.strip(), (path, index, label)
            values = []
            for cell in row[1:]:
                assert cell.ctype in (xlrd.XL_CELL_EMPTY, xlrd.XL_CELL_NUMBER), (path, label, cell)
                value = cell.value if cell.ctype == xlrd.XL_CELL_NUMBER else None
                assert value is None or math.isfinite(value), (path, label)
                values.append(int(value) if value is not None and value.is_integer() else value)
            rows.append([indent // 4, label.strip(), values])
    return {"currency": fiscal[2], "fiscalEnd": fiscal[1], "periods": periods, "rows": rows}


def build(source, output, catalogue_output):
    coverage = json.loads((ROOT / "site/data/stocks-beta2-monthly-history.json").read_text(encoding="utf-8"))
    securities = {item["ticker"]: item for item in coverage["securities"]}
    with (source / "BETA2 Morningstar coverage.csv").open(encoding="utf-8-sig", newline="") as handle:
        index = list(csv.DictReader(handle))
    companies = {}
    catalogue = []
    for row in index:
        ticker = row["Beta 2 ticker"]
        assert ticker not in companies and ticker in securities and row["Status"] == "Complete", ticker
        url = urlsplit(row["Financials URL"])
        match = re.fullmatch(r"/stocks/([a-z0-9]{4})/([a-z0-9.-]+)/financials", url.path)
        assert url.scheme == "https" and url.netloc == "www.morningstar.com" and match, ticker
        exchange, slug = match.groups()
        symbol = row["Browser identity"].rsplit(maxsplit=1)[1]
        assert slug.upper() == symbol.upper(), ticker
        at = datetime.fromisoformat(row["Capture timestamp (SGT)"])
        assert at.tzinfo is not None, ticker
        statements = {}
        for key, column, kind in STATEMENTS:
            path = (source / row[column]).resolve()
            assert path.is_relative_to(source), path
            statements[key] = read_statement(path, symbol, kind)
        catalogue.append([ticker, exchange.upper(), symbol, securities[ticker]["currency"]])
        companies[ticker] = {"capturedAt": at.isoformat(), "statements": statements}
    assert companies.keys() == securities.keys(), "The spreadsheet archive must cover the entire BETA 2 list."
    output.write_text(json.dumps(
        {"version": 1, "source": "Morningstar", "companies": companies}, ensure_ascii=False, separators=(",", ":")
    ) + "\n", encoding="utf-8")
    if catalogue_output:
        catalogue_output.write_text(
            "[\n" + ",\n".join("  " + json.dumps(row) for row in catalogue) + "\n]\n", encoding="utf-8"
        )


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("source", type=Path)
    cli.add_argument("output", type=Path)
    cli.add_argument("--catalogue-output", type=Path)
    args = cli.parse_args()
    build(args.source.resolve(), args.output, args.catalogue_output)
