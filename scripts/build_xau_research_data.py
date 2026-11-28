"""Build the XAU dashboard's dated source extract from the named public downloads."""
import argparse
import csv
import datetime as dt
import json
import re
from pathlib import Path

from openpyxl import load_workbook

FRED_IDS = ("DFII10", "DTWEXBGS", "T10YIE", "CPIAUCSL", "CPILFESL", "PCEPI", "EFFR", "GS10")
OZ_TONNE = 31.1034768 / 1_000_000
SOURCES = {
    "gold": ("World Bank Pink Sheet • monthly gold", "https://www.worldbank.org/en/research/commodity-markets"),
    "mining": ("Austrian Federal Ministry of Finance • World Mining Data 2026", "https://www.bmf.gv.at/en/topics/mining/mineral-resources-policy/wmd.html"),
    "reserves": ("IMF International Liquidity • monetary gold volume", "https://data.imf.org/en/datasets/IMF.STA:IL"),
    "reserveWorkbook": ("IMF series download via FetchSeries", "https://www.fetchseries.com/central-banks/gold-reserves-imf/"),
    "safe": ("China SAFE • Official Reserve Assets 2026", "https://www.safe.gov.cn/en/2021/0203/2045.html"),
    "gdpcn": ("World Bank • China real GDP growth", "https://data.worldbank.org/indicator/NY.GDP.MKTP.KD.ZG?locations=CN"),
    "cpicn": ("World Bank • China CPI inflation", "https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG?locations=CN"),
    "cpiworld": ("World Bank • world CPI inflation", "https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG?locations=1W"),
    "nbsCpi": ("China NBS • October 2026 CPI", "https://www.stats.gov.cn/english/PressRelease/202611/t20261111_1965808.html"),
    "nbsGdp": ("China NBS • Q3 2026 GDP", "https://www.stats.gov.cn/english/PressRelease/202610/t20261021_1965671.html"),
}


def number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def workbook(folder, name):
    return load_workbook(folder / name, read_only=True, data_only=True)


def gold(folder):
    with_workbook = workbook(folder, "pink.xlsx")
    sheet = with_workbook["Monthly Prices"]
    rows = iter(sheet.values)
    for _ in range(4):
        next(rows)
    col = next(rows).index("Gold")
    data = []
    for row in rows:
        if re.fullmatch(r"\d{4}M\d{2}", str(row[0])) and number(row[col]):
            data.append([str(row[0]).replace("M", "-") + "-01", round(row[col], 4)])
    with_workbook.close()
    return data


def annual(folder, name):
    data = json.loads((folder / name).read_text(encoding="utf-8"))[1]
    return sorted([[row["date"] + "-12-31", round(row["value"], 4)]
                   for row in data if number(row["value"])])


def fred(folder, ceiling):
    result = {}
    for name in FRED_IDS:
        with (folder / (name + ".csv")).open(encoding="utf-8-sig", newline="") as handle:
            table = csv.DictReader(handle)
            date_key = table.fieldnames[0]
            assert name in table.fieldnames
            rows = []
            for row in table:
                date, value = row[date_key], row[name]
                if date <= ceiling and value not in ("", "."):
                    rows.append([date, float(value)])
        assert len(rows) > 300
        result[name] = rows
    return result


def mining(folder):
    with_workbook = workbook(folder, "mines.xlsx")
    rows = iter(with_workbook["Gold"].values)
    next(rows)
    years = [int(year) for year in next(rows)[2:7]]
    matrix = {}
    for country, unit, *columns in rows:
        if not country or unit != "kg":
            continue
        matrix[country] = {"values": [round(value / 1000, 3) if number(value) else None for value in columns[:len(years)]],
                           "status": columns[-1]}
    with_workbook.close()
    world = matrix.pop("Total")["values"]
    return {"years": years, "world": world, "countries": matrix}


def official_gold(folder, ceiling):
    work = workbook(folder, "imf-reserves.xlsx")
    populations = {}
    for table in ("Global aggregates", "Countries"):
        rows = iter(work[table].values)
        next(rows)
        column_names = next(rows)
        for row in rows:
            date = row[0]
            if not isinstance(date, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date) or date > ceiling:
                continue
            for label, value in zip(column_names[2:], row[2:]):
                if label and number(value) and value >= 0:
                    populations.setdefault(label, []).append([date, round(value * OZ_TONNE, 3)])
    work.close()
    aggregate = {label: populations.pop(label) for label in ("World", "Advanced Economies", "Emerging Market and Developing Economies")}
    assert populations["United States"][-1][1] > 8000
    floor = (dt.date.fromisoformat(ceiling) - dt.timedelta(days=365)).isoformat()
    latest = sorted(((k, v[-1][1]) for k, v in populations.items() if v[-1][0] >= floor),
                    key=lambda row: (-row[1], row[0]))[:30]
    selected = {name: populations[name] for name, _ in latest}
    return {"aggregates": aggregate, "countries": selected}


def china_official(folder):
    work = workbook(folder, "safe.xlsx")
    rows = list(work["Sheet1"].values)
    dated = [(i, f"{float(value):.2f}".replace(".", "-")) for i, value in enumerate(rows[3])
             if number(value) or re.fullmatch(r"\d{4}\.\d{2}", str(value))]
    metric = next(row for row in rows if any(isinstance(v, str) and "万盎司" in v for v in row))
    fx = rows[7]
    series = {"safeGold": [], "safeFx": []}
    for i, month in dated:
        cell = re.search(r"(\d+)\s*万盎司", str(metric[i]))
        if cell:
            series["safeGold"].append([month + "-01", round(int(cell[1]) * 10_000 * OZ_TONNE, 3)])
        try:
            value = float(str(fx[i]).strip())
        except ValueError:
            continue
        series["safeFx"].append([month + "-01", round(value / 10, 3)])
    work.close()
    return series


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--as-of", required=True)
    args = parser.parse_args()
    dt.date.fromisoformat(args.as_of)
    payload = {
        "schema": 1, "asOf": args.as_of, "sources": SOURCES,
        "series": {
            "pink": gold(args.source),
            "gdpcn": annual(args.source, "gdpcn.json"),
            "cpicn": annual(args.source, "cpicn.json"),
            "cpiworld": annual(args.source, "worldbankmacro"),
            **china_official(args.source),
        },
        "fred": fred(args.source, args.as_of),
        "mining": mining(args.source),
        "reserves": official_gold(args.source, args.as_of),
        "chinaLatest": {
            "cpi": {"date": "2026-10", "value": 0.7},
            "gdp": {"date": "2026 Q3", "value": 4.5},
        },
    }
    assert len(payload["series"]["pink"]) > 780
    assert len(payload["series"]["safeGold"]) == 10
    assert len(payload["reserves"]["countries"]) == 30
    args.output.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
