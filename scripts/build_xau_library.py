"""Build the public XAU series catalogue from the two Raw- GOLD data packs.

Publish dated observations only for the marked sources. Catalogue entries for
other providers carry source links and browser-local import instructions.
"""
import argparse
import calendar
import csv
import datetime as dt
import json
import math
import re
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

from openpyxl import load_workbook

FRED_PUBLIC = (
    "Board of Governors of the Federal Reserve System", "Federal Reserve Bank of",
    "U.S. Bureau of", "U.S. Energy Information Administration", "World Bank",
    "Bank for International Settlements",
)
MONTHLY_FILES = {
    "fred": "XAU and FRED monthly panel - 360 months.csv",
    "metals": "Monthly comparison.csv",
    "quarter": "Quarterly FRED.csv",
    "annual": "Annual FRED.csv",
    "flows": "Quarterly gold flows.csv",
    "physical": "Annual physical data.csv",
    "holdings": "Official gold reserves quarterly - selected holders.csv",
    "compiled": "Gold Historical Monthly.csv",
}
PINK = "https://www.worldbank.org/en/research/commodity-markets"
WGC = "https://www.gold.org/goldhub/data/gold-reserves-by-country"
MINES = "https://www.usgs.gov/media/files/gold-historical-statistics-data-series-140"


def table(path):
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def https(value):
    if not value or not re.fullmatch(r"https://[^\s]+", value):
        return ""
    parts = urlparse(value)
    return value if parts.hostname and not parts.username and not parts.password else ""


def number(value):
    if not value or value.strip() == ".":
        return None
    try:
        result = float(value)
    except ValueError:
        return None
    return result if math.isfinite(result) else None


def period_end(value, freq):
    if freq == "Monthly":
        return value[:7] + "-01"
    year = int(value[:4])
    month = 12 if freq == "Annual" else (int(value[5:7]) - 1) // 3 * 3 + 3
    return f"{year}-{month:02}-{calendar.monthrange(year, month)[1]:02}"


def notes_and_papers(index):
    group = ""
    papers = []
    for line in index.read_text(encoding="utf-8-sig").splitlines():
        if line.startswith("## "):
            group = line[3:]
        match = re.match(r"^- \*\*(\d+)\. \[([^]]+)\]\([^)]+\)\*\* \((\d{4}), \d+ pp\.\) · (.*)", line)
        if not match:
            continue
        number_, title, year, rest = match.groups()
        parts = re.split(r" (?:· )?\[(?:Publisher or publication record|PDF source)\]", rest, maxsplit=1)
        links = re.findall(r"\[(?:Publisher or publication record|PDF source)\]\((https://[^ ]+?)\)(?: ·|$)", rest)
        assert links, (number_, title)
        papers.append({"id": int(number_), "group": group, "title": title, "year": int(year),
                       "note": parts[0], "url": https(links[0])})
    assert len(papers) == 30 and len({p["id"] for p in papers}) == 30
    assert all(p["url"] for p in papers)
    return papers


def compile_library(root, as_of):
    fred = root / "XAU and FRED - 30 Years"
    metals = root / "Gold and Metals - 50 Additional Series"
    parent = {key: metals if key in {"metals", "flows", "physical"} else fred for key in MONTHLY_FILES}
    parent.update(holdings=fred / "Gold and market sources", compiled=root)
    local = {}
    tables = {}
    for key, filename in MONTHLY_FILES.items():
        rows = table(parent[key] / filename)
        tables[key] = rows
        local[key] = {"name": filename, "date": next(iter(rows[0]))}
    entries = {}

    def add(key, label, unit, frequency, group, provider, url, file=None, column=None,
            shared=False, notes="", kind=None, values=None):
        if key in entries:
            raise ValueError(f"Repeated series {key}")
        column = column or key
        if file and column not in tables[file][0] and values is None:
            raise ValueError(f"Unknown column {file}/{column}")
        if values is None:
            values = [(r[local[file]["date"]], number(r[column])) for r in tables[file]]
        points = {period_end(d, frequency): v for d, v in values if d and v is not None and d[:7] <= as_of[:7]}
        if len(points) < 2:
            return
        dates = sorted(points)
        change = kind or ("rate" if unit.strip() in ("%", "Percent", "Percentage Points") else
                          "difference" if points[dates[0]] <= 0 or any(v < 0 for v in points.values()) else "level")
        entries[key] = {
            "label": label, "unit": unit, "frequency": frequency, "group": group, "provider": provider,
            "source": https(url), "basis": notes, "kind": change, "start": dates[0], "end": dates[-1],
            "length": len(dates), "local": [file, column] if file else None, "points": [[d, points[d]] for d in dates] if shared else [],
        }

    for row in table(fred / "FRED series catalog.csv"):
        k = row["Series ID"]
        native = row["Native frequency"]
        frequency = "Quarterly" if native.startswith("Quarterly") else "Annual" if native.startswith("Annual") else "Monthly"
        file = {"Quarterly": "quarter", "Annual": "annual", "Monthly": "fred"}[frequency]
        group = row["Theme"]
        if group == "Supplement":
            if k in {"DFII10", "DFII5", "T10YIE", "T5YIE", "T5YIFR"}:
                group = "Rates and credit"
            elif k in {"DEXUSEU", "DTWEXBGS"}:
                group = "FX and dollar"
            elif k in {"CHNCPALTT01IXNBM", "NGDPRXDCCNA"}:
                group = "China"
            elif k == "SP500":
                group = "Markets and stress"
            elif k == "WALCL":
                group = "Money and activity"
            else:
                group = "Energy and mining"
        provider = row["Original provider"]
        add(k, row["FRED title"], row["Native units"], frequency, group, provider + " via FRED",
            row["FRED source"], file, shared=k != "BAA10Y" and any(provider.startswith(p) for p in FRED_PUBLIC),
            notes="Native " + native.lower() + ". " + row["Panel treatment"] + ". " + row["Notes"])

    for row in table(metals / "Series catalog - 50 new datasets.csv"):
        k = row["Series ID"]
        group, frequency, provider = row["Category"], row["Frequency"], row["Provider"]
        file = {"Monthly": "metals", "Annual": "physical", "Quarterly": "flows"}[frequency]
        shared = any(p in provider for p in ("World Bank", "Geological Survey", "U.S. Bureau of", "Board of Governors"))
        # Provider permissions for the World Gold Council and IMF estimates are
        # handled through the publisher link and local study data.
        values = None
        if shared:
            values = [(r["period"], number(r[k])) for r in table(metals / "50 series CSV" / f"{k}.csv")]
        add(k, row["Series"], row["Unit"], frequency, group, provider, row["Source URL"], file,
            shared=shared, notes=row["Notes"], kind="difference" if frequency == "Quarterly" else None, values=values)

    workbook = load_workbook(metals / "Source downloads" / "World Bank Pink Sheet monthly - November 2026.xlsx",
                             read_only=True, data_only=True)
    try:
        sheet = workbook["Monthly Prices"]
        headers = next(sheet.iter_rows(min_row=5, max_row=5, values_only=True))
        rows = list(sheet.iter_rows(min_row=7, values_only=True))
        for name, unit in [("Silver", "USD/oz"), ("Platinum", "USD/oz"), ("Copper", "USD/metric tonne")]:
            ix = headers.index(name)
            add("pink_" + name.lower(), name + " · World Bank monthly", unit, "Monthly", "Benchmark prices",
                "World Bank Pink Sheet", PINK, shared=True, notes="Monthly average from the Pink Sheet.",
                values=[(r[0].replace("M", "-"), number(str(r[ix]))) for r in rows
                        if isinstance(r[0], str) and re.fullmatch(r"\d{4}M\d{2}", r[0])])
    finally:
        workbook.close()

    for key, label in [("Gold to silver", "Gold-to-silver ratio"), ("Gold to platinum", "Gold-to-platinum ratio")]:
        add(key, label, "ratio", "Monthly", "Benchmark prices", "World Bank Pink Sheet", PINK, "metals",
            shared=True, notes="Matched monthly USD per troy ounce averages. Ratios divide gold by the indicated metal.")

    for row in (k for k in tables["holdings"][0] if k != "Quarter end"):
        add("wgc_" + row, "Official gold · " + row.removesuffix(" tonnes") if row.endswith(" tonnes") else row,
            "tonnes" if row.endswith(" tonnes") else "%", "Quarterly", "Official holdings", "World Gold Council / IMF",
            WGC, "holdings", row, notes="Quarterly source values. Reporting dates vary. World is the source aggregate.",
            values=[(r["Quarter end"], number(r[row]) if row.endswith(" tonnes") or number(r[row]) is None
                     else 100 * number(r[row])) for r in tables["holdings"]])

    skip = {"month", "period_end", "is_complete_month", "data_as_of"}
    for row in table(root / "Gold Historical Data Dictionary.csv"):
        column = row["column"]
        if (column in skip or column.endswith(("_date", "_source")) or "observations" in column
                or "snapshot" in column
                or column == "world_mine_gold_usgs_annual_tonnes"):
            continue
        file = "compiled"
        freq = "Quarterly" if "quarter" in row["frequency"].lower() or "_quarter_" in column else "Annual" if "annual" in row["frequency"].lower() or "_annual_" in column else "Monthly"
        group = ("China" if column.startswith("china") else "Physical gold" if column.startswith("world_")
                 else "Gold archive")
        add("archive_" + column, row["label"], row["unit"], freq, group, "Raw- GOLD compilation", row["source"],
            file, column, notes=row["definition"])

    mine_rows = table(fred / "Gold and market sources" / "USGS world gold mine production 1996-2025.csv")
    add("USGS_WORLD_GOLD", "World gold mine production · USGS", "tonnes", "Annual", "Physical gold", "U.S. Geological Survey",
        MINES, shared=True, notes="Data Series 140 through 2022, then separate USGS MCS editions. 2025 is an estimate.",
        values=[(r["Year"], number(r["World output (metric tonnes)"])) for r in mine_rows])
    audit = Counter("public" if v["points"] else "local" for v in entries.values())
    assert audit["public"] >= 70 and audit["local"] >= 20 and len(entries["USGS_WORLD_GOLD"]["points"]) == 30
    return {"schema": 1, "asOf": as_of, "tables": local, "series": entries,
            "papers": notes_and_papers(root / "Gold Research Index.md")}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("raw_gold", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--as-of", required=True)
    args = parser.parse_args()
    dt.date.fromisoformat(args.as_of)
    result = compile_library(args.raw_gold, args.as_of)
    args.output.write_text(json.dumps(result, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    print(len(result["series"]), "series;", sum(bool(s["points"]) for s in result["series"].values()), "public,", len(result["papers"]), "papers")


if __name__ == "__main__":
    main()

