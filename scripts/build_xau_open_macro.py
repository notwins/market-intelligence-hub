"""Build the public monthly macro extract for the Gold History overview.

Pass CSVs from BLS via FRED (UNRATE and PAYEMS), Chicago Fed via FRED (NFCI),
and Iacoviello and Tong (AI-GPR, CC BY). The raw files stay outside site/.
"""
import argparse
import csv
import json
import math
from collections import defaultdict
from datetime import date
from pathlib import Path
from statistics import mean


def monthly(path, key, through):
    grouped = defaultdict(list)
    with path.open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            day = date.fromisoformat(row.get("observation_date") or row["Date"])
            if not date(1959, 1, 1) <= day <= through or row[key] in ("", "."):
                continue
            value = float(row[key])
            if not math.isfinite(value):
                raise ValueError(f"Invalid {key} observation on {day}")
            grouped[day.isoformat()[:7]].append(value)
    return [[month + "-01", round(mean(values), 5)] for month, values in sorted(grouped.items())]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("unemployment", "payrolls", "conditions", "geopolitics", "output"):
        parser.add_argument(name, type=Path)
    parser.add_argument("--through", required=True, type=date.fromisoformat)
    args = parser.parse_args()
    series = {key: monthly(path, key, args.through) for key, path in (
        ("UNRATE", args.unemployment), ("PAYEMS", args.payrolls),
        ("NFCI", args.conditions), ("GPR_AI", args.geopolitics),
    )}
    if any(len(observations) < 600 for observations in series.values()):
        raise ValueError("Expected multi-decade source histories")
    data = {"schema": 1, "through": args.through.isoformat()[:7], "series": series}
    args.output.write_text(json.dumps(data, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
