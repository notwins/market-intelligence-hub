"""Build the XAU Driver Lab's public analytical extract from the compiled monthly CSV."""
import argparse
import csv
from datetime import date
import json
import math
from pathlib import Path
import re

# Public benchmark transformations and official statistical sources. Equity
# comparison uses the calculated change, without republishing index levels.
COLUMNS = (
    "gold_usd_mom_pct", "gold_usd_yoy_pct", "usd_broad_mom_pct",
    "cny_per_usd_mom_pct", "us_10y_real_yield_mom_bps", "us_cpi_yoy_pct",
    "us_pce_yoy_pct", "spx_price_monthly_avg_mom_pct",
    "china_gold_share_official_reserves_pct",
    "world_official_gold_purchases_ecb_annual_tonnes", "world_mine_gold_usgs_annual_tonnes",
)


def build(source):
    with source.open(encoding="utf-8-sig", newline="") as file:
        raw = list(csv.DictReader(file))
    if not raw or set(COLUMNS) - raw[0].keys():
        raise ValueError("The compiled gold CSV lacks Driver Lab fields")
    dates = [row["month"] for row in raw]
    if dates != sorted(set(dates)) or not all(re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", m) for m in dates):
        raise ValueError("Expected unique ISO months in ascending order")
    cutoff = raw[-1]["data_as_of"]
    date.fromisoformat(cutoff)
    result = []
    for row in raw:
        if row["is_complete_month"] != "1":
            continue
        values = []
        for key in COLUMNS:
            cell = row[key].strip()
            n = float(cell) if cell else None
            if n is not None and not math.isfinite(n):
                raise ValueError(f"Non-finite observation in {key}")
            values.append(n)
        result.append([row["month"], *values])
    if not result or any(not any(row[i] is not None for row in result) for i in range(1, len(COLUMNS) + 1)):
        raise ValueError("One or more public chart series have no observations")
    return {"schema": 1, "asOf": cutoff, "columns": COLUMNS, "rows": result}


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("compiled_csv", type=Path)
    cli.add_argument("output", type=Path)
    args = cli.parse_args()
    data = build(args.compiled_csv)
    args.output.write_text(json.dumps(data, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8")
    print(f"{len(data['rows'])} completed months through {data['rows'][-1][0]}")
