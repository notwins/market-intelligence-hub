#!/usr/bin/env python3
"""Import selected numerical facts from supplied BOS extracts; never publish raw rows.

Usage: python scripts/import_equity_valuation_history.py --input <csv> [<csv> ...]
       --output site/data/equity-valuation-history.json
The input files stay outside the public repository. This is not a daily-feed job.
"""
import argparse
import csv
import datetime as dt
import json
import re
from decimal import Decimal, InvalidOperation
from pathlib import Path

PILOTS = (
    ("D05.SI", "DBS SP", "SGD", "DBS Group"),
    ("U11.SI", "UOB SP", "SGD", "United Overseas Bank"),
    ("NVDA", "NVDA US", "USD", "NVIDIA"),
    ("MSFT", "MSFT US", "USD", "Microsoft"),
    ("AAPL", "AAPL US", "USD", "Apple"),
    ("TSM", "TSM US", "USD", "TSMC ADR"),
)
FIELDS = {
    "market_cap_usd_bn": 1, "price": 4, "fair_value_or_target": 5,
    "dividend_yield_pct": 7, "pe": 8, "pb": 9,
    "eps_growth_pct": 10, "roe_pct": 11,
}
MONTHS = {m: i for i, m in enumerate(
    ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])}


def number(text):
    value = text.strip()
    if value.upper() in {"", "NA", "N/A", "N.M.", "NM", "-", "—"}:
        return None
    if value.startswith("(") and value.endswith(")"):
        value = "-" + value[1:-1]
    try:
        result = Decimal(value.replace(",", ""))
    except InvalidOperation as exc:
        raise ValueError("Unexpected numeric field") from exc
    if not result.is_finite():
        raise ValueError("Non-finite numeric field")
    return float(result)


def parse_file(path):
    with Path(path).open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    if not rows or set(rows[0]) != {
        "report_date_from_url", "source_page", "page_row", "raw_text", "raw_cells_json"
    }:
        raise ValueError("Unsupported raw-row schema")
    report_dates = {row["report_date_from_url"] for row in rows}
    if len(report_dates) != 1:
        raise ValueError("An input must contain exactly one report date")
    report_date = report_dates.pop()
    report = dt.date.fromisoformat(report_date)
    page_dates, forward_pages = {}, set()
    for row in rows:
        page, text = int(row["source_page"]), row["raw_text"]
        if "Consensus Forward Estimates" in text:
            forward_pages.add(page)
        if "Company Name" in text and "Cncy" in text:
            match = re.search(r"\b(\d{1,2})-([A-Z][a-z]{2})\b", text)
            if match:
                month = MONTHS[match[2]]
                year = report.year - (month > report.month)
                price_date = dt.date(year, month, int(match[1]))
                if price_date > report:
                    raise ValueError("Price observation follows the report date")
                page_dates[page] = price_date.isoformat()

    observations = []
    for symbol, source_ticker, currency, _ in PILOTS:
        candidates = []
        for row in rows:
            cells = json.loads(row["raw_cells_json"])
            if source_ticker in cells and len(cells) >= 17:
                candidates.append((row, cells))
        if len(candidates) != 1:
            raise ValueError(f"Expected one exact row for {source_ticker} in {report_date}")
        row, cells = candidates[0]
        ticker_index = cells.index(source_ticker)
        page = int(row["source_page"])
        if ticker_index not in (1, 2) or cells[ticker_index + 3] != currency:
            raise ValueError(f"Listing/currency mismatch for {source_ticker}")
        if page not in page_dates or page not in forward_pages:
            raise ValueError(f"Missing price date or forward-estimate heading on page {page}")
        rating = cells[ticker_index + 2]
        if rating not in {"Buy", "Hold", "Sell", "Closed", "UR", "Restricted"}:
            raise ValueError("Unrecognised rating position; review the source layout")
        original = {field: cells[ticker_index + offset] for field, offset in FIELDS.items()}
        values = {field: number(text) for field, text in original.items()}
        if values["price"] is not None and values["price"] <= 0:
            raise ValueError("Nonpositive source price")
        flags = ["forward_horizon_unspecified", "reference_provider_unresolved"]
        for field in ("pe", "pb"):
            if values[field] is not None and values[field] <= 0:
                flags.append(f"{field}_nonmeaningful_for_range")
        observations.append({
            "symbol": symbol, "source_ticker": source_ticker, "currency": currency,
            "report_date": report_date, "price_date": page_dates[page],
            **values, "source_values": original,
            "rating": rating,
            "coverage_status": {"Closed": "closed", "Restricted": "restricted", "UR": "under_review"}.get(rating, "covered"),
            "metric_basis": "consensus_forward_estimates", "forecast_horizon": "unspecified",
            "price_basis": "source_snapshot_unadjusted",
            "reference_value_type": "fair_value_or_target_undifferentiated",
            "reference_provider": None,
            "source_id": "bos_" + report_date, "source_page": page,
            "source_row": int(row["page_row"]), "quality_flags": flags,
        })
    source = {
        "title": "BOS Equity Coverage Universe · " + report_date,
        "publisher": "Bank of Singapore", "report_date": report_date,
        "price_dates": sorted({row["price_date"] for row in observations}),
        "evidence": "Selected numerical facts checked against the supplied CSV extract and its page headings.",
        "verification_status": "supplied_extract_checked",
        "original_pdf_retrieved": False,
    }
    return report_date, source, observations


def build(paths):
    sources, observations = {}, []
    for path in paths:
        date, source, parsed = parse_file(path)
        key = "bos_" + date
        if key in sources:
            raise ValueError("Duplicate report edition")
        sources[key] = source
        observations.extend(parsed)
    if not sources:
        raise ValueError("No editions supplied")
    report_dates = sorted(source["report_date"] for source in sources.values())
    observations.sort(key=lambda row: (row["symbol"], row["report_date"]))
    return {
        "schema_version": 1, "kind": "selected_equity_valuation_history",
        "coverage": {
            "complete": False, "edition_count": len(sources), "listing_count": len(PILOTS),
            "observation_count": len(observations), "report_dates": report_dates,
            "first_report_date": report_dates[0], "last_report_date": report_dates[-1],
            "label": f"{len(sources)} supplied editions; incomplete archive. No historical percentiles.",
            "note": "These are selected monthly publications from different years. Missing editions and observations are not interpolated.",
        },
        "methodology": {
            "metric_basis": "The source groups dividend yield, P/E, P/B, EPS growth and ROE under Consensus Forward Estimates.",
            "forecast_horizon": "The exact forecast year or rolling horizon is not specified in the supplied headings.",
            "price_basis": "Source snapshot prices are retained only as evidence. They are not adjusted across corporate actions and must not produce historical price returns.",
            "reference_values": "Fair value and target price remain undifferentiated where the underlying provider and concept have not been resolved per row. Neither is a market price.",
            "dates": "Report dates and price observation dates are separate. Intraday availability times are not supplied.",
            "percentiles_available": False,
            "range_basis": "Minima and maxima describe only the supplied observations, not a continuous historical valuation range or trading signal.",
            "use": "Descriptive comparison only; no historical strategy test or consensus-surprise series is established.",
        },
        "listings": [{"symbol": symbol, "source_ticker": ticker, "currency": currency,
                      "name": name, "observation_count": len(sources)}
                     for symbol, ticker, currency, name in PILOTS],
        "sources": {key: sources[key] for key in sorted(sources)},
        "observations": observations,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", nargs="+", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    data = build(args.input)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Imported {data['coverage']['observation_count']} observations across {data['coverage']['edition_count']} editions.")


if __name__ == "__main__":
    main()
