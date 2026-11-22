"""Publish dated publisher links only. Original PDFs are read privately and discarded."""
from __future__ import annotations

import argparse
import datetime as dt
import io
import json
from pathlib import Path
import re
import urllib.error
import urllib.request
from pypdf.errors import PyPdfError

import bos_equity_feed as feed
from parse_bos_equity import report_date

HOST = "https://productgroup.bankofsingapore.com/"
BONDS = HOST + "fixed_income_research/Daily_Price/"
REPORT = re.compile(re.escape(HOST) + r"apollo/assets/reports/morningstar/apollo/\d{4}/[A-Za-z]{3}/[\w.-]+\.pdf")
SOURCE_ERRORS = (ValueError, IndexError, PyPdfError, urllib.error.URLError, TimeoutError, ConnectionError)
FILE = Path("publisher-documents/latest.json")
# Exact listing and share class used by the earnings desk (all quoted in USD).
LISTINGS = {symbol: symbol + " US" for symbol in
            "AAPL MSFT NVDA GOOGL AMZN META AMD AVGO MU TSLA TSM BABA".split()}
LISTINGS["BRK.B"] = "BRK/B US"


def days(today, limit=12):
    """Check today's edition first, then the preceding business days."""
    yield today
    day = today
    for _ in range(limit):
        day -= dt.timedelta(days=1)
        while day.weekday() >= 5:
            day -= dt.timedelta(days=1)
        yield day


def document_url(kind, day):
    if kind == "equity":
        return feed.source_url(day)
    prefix = {"bonds": "Bond_List-", "credit": "BOS-OCBC%20bond%20list-"}[kind]
    return BONDS + prefix + day.strftime("%d_%b_%Y.pdf")


def download(url):
    request = urllib.request.Request(url, headers={"Accept": "application/pdf", "User-Agent": "MarketIntelligenceHub/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=30) as reply:
            if reply.geturl() != url:
                raise ValueError("Unexpected publisher redirect")
            mime = reply.headers.get_content_type()
            if mime == "text/html":
                return None
            if mime not in ("application/pdf", "application/octet-stream"):
                raise ValueError("Unexpected content type")
            data = reply.read(feed.MAX_PDF_BYTES + 1)
            feed.validate_pdf(data)
            return data
    except urllib.error.HTTPError as error:
        if error.code not in (404, 410):
            raise
        return None


def first_page(data):
    from pypdf import PdfReader
    return PdfReader(io.BytesIO(data)).pages[0].extract_text() or ""


def bond_has_data(text, kind, day):
    date_line = rf"(?m)^\s*0?{day.day}\s+{day:%b %Y}\s*$"
    markers = ("Sources: Bloomberg, Bank of Singapore", "Crncy") if kind == "bonds" else ("OCBC Credit Research List", "Sources: Bloomberg, OCBC")
    return (all(marker in text for marker in (*markers, "ISIN", "Bid", "Ask"))
            and re.search(date_line, text) and re.search(r"(?m)^\s*[A-Z]{2}[A-Z0-9]{9}\d\s", text))


def equity_rows(data, day, root, editions, wanted):
    digest = feed.sha256(data)
    ref = next((r for r in editions if r["sourceSha256"] == digest and r["reportDate"] == day.isoformat()), None)
    if ref:
        snapshot = feed.read_ref(root, ref)
        if snapshot["reportDate"] != day.isoformat() or snapshot["sourceSha256"] != digest:
            raise ValueError("Coverage edition does not match the source file")
        return {r["instrumentId"]: r["researchReportUrl"] for r in snapshot["records"]
                if r["currency"] == "USD" and r["instrumentType"] == "equity"}

    # An edition can have useful report links even if its valuation table changed
    # shape. Read only exact USD listing rows and the text inside their PDF links.
    import pdfplumber
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(data))
    cover = reader.pages[0].extract_text() or ""
    if "Equity Coverage Universe" not in cover or report_date(cover) != day:
        raise ValueError("Coverage title or edition date mismatch")
    rows = {}
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for index, source in enumerate(reader.pages[1:], 1):
            text = source.extract_text() or ""
            if not all(marker in text for marker in ("Company Name", "Ticker", "Cncy", day.strftime("%d-%b-%y"))):
                continue
            found = {listing for listing in wanted
                     if re.search(r"(?m)(?<!\S)" + re.escape(listing) + r"\s+[^\n]*?\bUSD\s+[\d,]+\.\d+", text)}
            if not found:
                continue
            page = pdf.pages[index]
            words = page.extract_words()
            links = {listing: set() for listing in found}
            for link in page.hyperlinks:
                if not link.get("uri"):
                    continue
                label = " ".join(w["text"] for w in words
                                 if link["x0"] <= (w["x0"] + w["x1"]) / 2 <= link["x1"]
                                 and link["top"] <= (w["top"] + w["bottom"]) / 2 <= link["bottom"])
                if label in found:
                    links[label].add(link["uri"])
            for listing, urls in links.items():
                if listing in rows or len(urls) > 1:
                    raise ValueError("Ambiguous listing or report link")
                rows[listing] = next(iter(urls), None)
            page.close()
            if wanted <= rows.keys():
                break
    return rows


def report_details(url, edition, ticker):
    if not REPORT.fullmatch(url):
        raise ValueError("Unrecognized company report destination")
    data = download(url)
    if not data:
        raise ValueError("Company report PDF unavailable")
    page = first_page(data)
    title = page.split("Last Price", 1)[0].split("Page 1 of", 1)[-1]
    if not re.search(r"(?<![\w.])" + re.escape(ticker) + r"(?![\w.])", title):
        raise ValueError("Company report share class does not match the coverage listing")
    header = page.split("Reporting Currency:", 1)[0]
    match = re.search(r"Morningstar Equity Analyst Report\s*\|\s*Report as of\s+(\d{1,2} [A-Za-z]{3} \d{4})\b", header)
    if not match:
        raise ValueError("Morningstar report date unavailable")
    date = dt.datetime.strptime(match[1], "%d %b %Y").date()
    if date > edition:
        raise ValueError("Company report date is later than its coverage edition")
    return {"url": url, "report_date": date.isoformat(), "edition": edition.isoformat()}


def refresh(feed_dir, today):
    path = feed_dir / FILE
    old = json.loads(path.read_bytes()) if path.exists() else {}
    documents = dict(old.get("documents", {}))
    reports = dict(old.get("reports", {}))
    editions = json.loads((feed_dir / "bos/manifest.json").read_bytes())["editions"]
    for kind in ("bonds", "credit"):
        for day in days(today):
            url = document_url(kind, day)
            try:
                data = download(url)
                if data and bond_has_data(first_page(data), kind, day):
                    documents[kind] = {"date": day.isoformat(), "url": url}
                    break
            except SOURCE_ERRORS as error:
                print(f"{kind} {day}: {error}")
    pending = set(LISTINGS)
    last_equity = documents.get("equity", {}).get("date", "")
    accepted = False
    for day in days(today):
        # The previous successful run already reconciled every earlier edition.
        if accepted and day.isoformat() < last_equity and all(
                ticker in reports and reports[ticker]["edition"] < last_equity for ticker in pending):
            break
        url = document_url("equity", day)
        try:
            data = download(url)
            if not data:
                continue
            rows = equity_rows(data, day, feed_dir / "bos", editions, {LISTINGS[t] for t in pending})
            if not rows:
                continue
        except SOURCE_ERRORS as error:
            print(f"equity {day}: {error}")
            continue
        if not accepted:
            reports = {t: r for t, r in reports.items() if r["edition"] <= day.isoformat()}
            documents["equity"] = {"date": day.isoformat(), "url": url}
            accepted = True
        for ticker in sorted(pending):
            link = rows.get(LISTINGS[ticker])
            if not link:
                if reports.get(ticker, {}).get("edition") == day.isoformat():
                    del reports[ticker]  # The publisher corrected a same-date directory.
                continue
            try:
                reports[ticker] = report_details(link, day, ticker)
            except SOURCE_ERRORS as error:
                previous = reports.get(ticker, {})
                if previous.get("edition") == day.isoformat():
                    del reports[ticker]
                print(f"{ticker} {day}: {error}")
                continue
            pending.remove(ticker)
        if not pending:
            break
    if set(documents) != {"equity", "bonds", "credit"} or not reports:
        raise ValueError("No verified edition available for initial publication")
    result = {"schemaVersion": 1, "documents": documents, "reports": reports}
    if result != old:
        path.parent.mkdir(exist_ok=True)
        feed.atomic_manifest(path, result)
    print("Publisher editions", {k: v["date"] for k, v in documents.items()})
    print("Company links", len(reports), "prior-edition links",
          {k: v["edition"] for k, v in reports.items() if v["edition"] != documents["equity"]["date"]})
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--feed-dir", type=Path, required=True)
    refresh(parser.parse_args().feed_dir, dt.datetime.now(feed.SGT).date())
