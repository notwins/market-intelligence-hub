"""Extract the Bank of Singapore Equity Coverage Universe without inventing data.

Requires pdfplumber and pypdf. Reads actual PDF table cells and their hyperlinks;
never executes or follows embedded content. All 19 source cells are retained.
The returned object is a PRIVATE raw dataset, including the licensed ESG column.
Public consumers must select allowed fields, rather than publishing this object.
"""
from __future__ import annotations

import argparse
import csv
from datetime import datetime, date
import hashlib
import io
import json
from pathlib import Path
import re
from collections import Counter

VERSION = '1.0.0'
BASE_URL = 'https://productgroup.bankofsingapore.com/equities_research/'
KEYS = [
    'name', 'moat', 'ticker', 'marketCapUsdBillions', 'rating', 'currency',
    'price', 'fairValueOrTargetPrice', 'upsidePct', 'dividendYieldPct', 'pe',
    'pb', 'epsGrowthPct', 'roePct', 'riskRating', 'ytdGainPct', 'esgRating',
    'analystReportMonth', 'analystOrUncertainty',
]
LABELS = [
    'Company Name', 'Moat Rating', 'Ticker', 'Market Cap (USD B)', 'Rating',
    'Cncy', 'Price', 'Fair Value / Target Price', 'Current Upside (%)',
    'Div Yld (%)', 'P/E (X)', 'P/B (X)', 'EPS GR (%)', 'ROE (%)', 'Risk Rating',
    'YTD Gains (%)', 'ESG Rating', 'Date of Report', 'Analyst / Uncertainty Rating',
]
NUMERIC = {'marketCapUsdBillions', 'price', 'fairValueOrTargetPrice', 'upsidePct',
           'dividendYieldPct', 'pe', 'pb', 'epsGrowthPct', 'roePct', 'riskRating',
           'ytdGainPct'}
FORWARD = {'dividendYieldPct', 'pe', 'pb', 'epsGrowthPct', 'roePct'}
MISSING = {'', '-', 'NA', 'N/A', 'UR', 'Restricted', 'Closed'}
RATINGS = {'Buy', 'Hold', 'Sell', 'UR', 'Restricted', 'Closed'}
REGIONS = {'NORTH AMERICA': 'North America', 'EUROPE': 'Europe', 'ASIA': 'Asia',
           'Other Emerging Markets': 'Other Emerging Markets'}
MARKETS = {'Japan', 'China/HK', 'China A-Shares', 'Singapore', 'India', 'Australia',
           'South Korea', 'Indonesia', 'Latin America'}
SECTORS = {'Communication Services', 'Consumer Discretionary', 'Consumer Staples',
           'Energy', 'Financials', 'Health Care', 'Industrials',
           'Information Technology', 'Materials', 'Real Estate', 'Utilities'}


class ExtractionError(ValueError):
    pass


def numeric(text: str):
    if text in MISSING:
        return None
    candidate = text.replace(',', '')
    if re.fullmatch(r'\(\d+(?:\.\d+)?\)', candidate):
        candidate = '-' + candidate[1:-1]
    if not re.fullmatch(r'-?\d+(?:\.\d+)?', candidate):
        raise ExtractionError(f'Unrecognised numeric token {text!r}')
    return float(candidate) if '.' in candidate else int(candidate)


def report_date(text: str) -> date:
    found = re.search(r'\b(\d{1,2} [A-Z][a-z]+ 20\d{2})\b', text)
    if found:
        return datetime.strptime(found.group(1), '%d %B %Y').date()
    raise ExtractionError('Report date absent from cover page')


def price_date(label: str, published: date) -> date:
    if not re.fullmatch(r'\d{1,2}-[A-Z][a-z]{2}', label):
        raise ExtractionError(f'Unexpected price header date {label!r}')
    candidate = datetime.strptime(f'{label}-{published.year}', '%d-%b-%Y').date()
    if candidate > published:
        candidate = candidate.replace(year=published.year - 1)
    if (published - candidate).days > 10:
        raise ExtractionError('Price date differs from report date by more than 10 days')
    return candidate


def provider(raw: dict, urls: list[str]):
    if any('/morningstar/' in url.lower() for url in urls):
        return 'Morningstar', 'embedded_report_link'
    explicit = {'HTI': 'Haitong International', 'OCBC': 'OCBC',
                'PTOS': 'PT OCBC Sekuritas Indonesia'}
    if raw['analystOrUncertainty'] in explicit:
        return explicit[raw['analystOrUncertainty']], 'analyst_column'
    return None, None


def parse_pdf(path, source_url=None) -> dict:
    """Return a validated private snapshot; fail closed on unfamiliar layout/cells."""
    # Keep numerical/date helper tests usable in lightweight CI environments.
    # The daily extraction job requires the bundled PDF runtime dependencies.
    import pdfplumber
    from pypdf import PdfReader
    path = Path(path)
    data = path.read_bytes()
    if not data.startswith(b'%PDF-'):
        raise ExtractionError('Input is not a PDF')
    reader = PdfReader(io.BytesIO(data))
    texts = [page.extract_text() or '' for page in reader.pages]
    published = report_date(texts[0])
    expected_stamp = published.strftime('%d-%b-%y')
    # Every table-bearing page must be consumed, including future page-count changes.
    expected_pages = [n for n, text in enumerate(texts, 1)
                      if 'Company Name' in text and 'Consensus Forward Estimates' in text]
    if not expected_pages:
        raise ExtractionError('No recognised equity coverage table pages')
    source_url = source_url or BASE_URL + published.isoformat() + '_equity_coverage_universe.pdf'
    records, table_audit, headers, counts = [], [], [], {}
    region = market = sector = None
    as_of_dates = set()
    with pdfplumber.open(io.BytesIO(data)) as document:
        for page_number in expected_pages:
            page = document.pages[page_number - 1]
            if expected_stamp not in texts[page_number - 1]:
                raise ExtractionError(f'Page {page_number}: report date inconsistent')
            tables = page.find_tables()
            coverage_tables = [t for t in tables if any('Company Name' in (row[0] or '') for row in t.extract())]
            if len(coverage_tables) != 1:
                raise ExtractionError(f'Page {page_number}: expected one table, found {len(coverage_tables)}')
            table = coverage_tables[0]
            rows = table.extract()
            if any(len(row) != 19 for row in rows):
                raise ExtractionError(f'Page {page_number}: column count changed')
            header_index = next(i for i, row in enumerate(rows) if row[0] == 'Company Name')
            head = rows[header_index]
            expected = {1: 'Moat', 2: 'Ticker', 3: 'Cap', 5: 'Cncy', 7: 'Fair Value /',
                        8: 'Upside', 9: 'Div Yld', 10: 'P/E', 11: 'P/B', 12: 'EPS GR',
                        13: 'ROE', 14: 'Risk', 15: 'Gains', 16: 'ESG', 17: 'of',
                        18: 'Uncertainty'}
            if any(head[index] != value for index, value in expected.items()):
                raise ExtractionError(f'Page {page_number}: source column labels changed')
            unit_row = rows[header_index + 2]
            if unit_row[3] != '(USD B)' or unit_row[10:12] != ['(X)', '(X)']:
                raise ExtractionError(f'Page {page_number}: currency/valuation units changed')
            as_of = price_date(head[6], published).isoformat()
            as_of_dates.add(as_of)
            headers.append({'page': page_number, 'rows': rows[:header_index + 3]})
            row_count = 0
            page_equities = 0
            # All table body text must be captured: company/index rows or known grouping labels.
            # An unrecognised heading is a layout/schema change, not silently skipped.
            for index in range(header_index + 3, len(rows)):
                cells = [str(cell or '').strip() for cell in rows[index]]
                if not any(cells):
                    continue
                populated = [value for value in cells if value]
                if len(populated) == 1:
                    label = populated[0]
                    if label in REGIONS:
                        region = REGIONS[label]
                        market = region if region in {'North America', 'Europe'} else None
                        sector = None
                    elif label in MARKETS:
                        if not region:
                            raise ExtractionError(f'Market before region on page {page_number}')
                        market, sector = label, None
                    elif label in SECTORS:
                        if not market:
                            raise ExtractionError(f'Sector before market on page {page_number}')
                        sector = label
                    else:
                        raise ExtractionError(f'Unknown table grouping {label!r} on page {page_number}')
                    table_audit.append({'page': page_number, 'row': index + 1, 'grouping': label})
                    continue
                raw = dict(zip(KEYS, cells))
                if not all((region, market, sector)):
                    raise ExtractionError(f'Missing grouping on page {page_number}, row {index + 1}')
                ticker = re.sub(r'\bI\s*n\s*d\s*e\s*x\b', 'Index', raw['ticker'])
                is_index = ticker.endswith(' Index')
                if not re.fullmatch(r'.+ (?:[A-Z]{2}|Index)', ticker):
                    raise ExtractionError(f'Malformed ticker {ticker!r}')
                if not re.fullmatch(r'[A-Z]{3}|GBp', raw['currency']):
                    raise ExtractionError(f'Unexpected currency {raw["currency"]!r}')
                if not is_index and raw['rating'] not in RATINGS:
                    raise ExtractionError(f'Unexpected equity rating {raw["rating"]!r}')
                if raw['moat'] not in {'', '✓', '✓✓'}:
                    raise ExtractionError(f'Unknown moat {raw["moat"]!r}')
                bbox = table.rows[index].bbox
                links = sorted({link['uri'] for link in page.hyperlinks
                                if link.get('uri') and 180 <= (link['x0'] + link['x1']) / 2 <= 250
                                and bbox[1] <= (link['top'] + link['bottom']) / 2 <= bbox[3]})
                research_provider, evidence = provider(raw, links)
                month = raw['analystReportMonth']
                if month in MISSING:
                    month = None
                else:
                    try:
                        month = datetime.strptime(month, '%b-%y').strftime('%Y-%m')
                    except ValueError as error:
                        raise ExtractionError(f'Invalid analyst report month {month!r}') from error
                record = dict(raw)
                record.update({key: numeric(raw[key]) for key in NUMERIC})
                record.update({
                    'instrumentId': ticker, 'instrumentType': 'index' if is_index else 'equity',
                    'ticker': ticker, 'region': region, 'marketGroup': market, 'sector': sector,
                    'priceAsOf': as_of, 'reportDate': published.isoformat(),
                    'moat': {'✓': 'Narrow', '✓✓': 'Wide'}.get(raw['moat']),
                    'rating': raw['rating'] or None,
                    'esgRating': None if raw['esgRating'] in MISSING else raw['esgRating'],
                    'analystReportMonth': month,
                    'analystOrUncertainty': raw['analystOrUncertainty'] or None,
                    'uncertaintyRating': raw['analystOrUncertainty'] if raw['analystOrUncertainty'] in
                        {'Low', 'Medium', 'High', 'Very High', 'Extreme'} else None,
                    'researchProvider': research_provider, 'researchProviderEvidence': evidence,
                    'researchReportUrl': links[0] if len(links) == 1 else None,
                    'researchReportUrls': links,
                    'fairValueOrTargetKind': 'fair_value' if research_provider == 'Morningstar' else
                        ('target_price' if research_provider else 'fair_value_or_target_price'),
                    'priceKind': 'published_reference_price',
                    'valuationBasis': 'Consensus forward estimates; period not specified',
                    'sourcePage': page_number, 'sourceRow': index + 1, 'raw': raw,
                })
                if record['price'] is not None and record['price'] <= 0:
                    raise ExtractionError(f'Non-positive price for {ticker}')
                if not is_index and record['price'] is None:
                    raise ExtractionError(f'Equity price missing for {ticker}')
                records.append(record)
                row_count += 1
                page_equities += int(not is_index)
            # Independent text check: count all lines containing an ISO-style quotation
            # currency and price; this catches row omissions by table edge detection.
            currency_lines = [line for line in (page.extract_text() or '').splitlines()
                              if re.search(r'\s(?:USD|EUR|GBp|CHF|SEK|DKK|NOK|JPY|HKD|CNY|SGD|AUD|KRW|IDR|CAD|INR)\s+[\d,]+(?:\.\d+)?\s', line)]
            if len(currency_lines) != row_count:
                raise ExtractionError(f'Page {page_number}: table rows {row_count} do not match independent currency text rows {len(currency_lines)}')
            counts[str(page_number)] = {'records': row_count, 'equities': page_equities,
                                        'indices': row_count - page_equities, 'independentTextRows': len(currency_lines)}
            page.close()
    if len(as_of_dates) != 1:
        raise ExtractionError(f'Inconsistent price dates: {as_of_dates}')
    ids = [record['instrumentId'] for record in records]
    duplicates = [ticker for ticker, count in Counter(ids).items() if count > 1]
    if duplicates:
        raise ExtractionError(f'Duplicate instrument identifiers: {duplicates}')
    equities = sum(record['instrumentType'] == 'equity' for record in records)
    if equities < 1000:
        raise ExtractionError(f'Unexpectedly small coverage universe: {equities} equities')
    columns = [{'key': key, 'sourceLabel': label,
                'unit': 'USD billions' if key == 'marketCapUsdBillions' else
                    'quotation currency (GBp is pence)' if key in {'price', 'fairValueOrTargetPrice'} else
                    'percent' if key.endswith('Pct') else 'times' if key in {'pe', 'pb'} else None,
                'basis': 'Consensus forward estimates; period not specified' if key in FORWARD else None}
               for key, label in zip(KEYS, LABELS)]
    return {
        'schemaVersion': 1, 'extractorVersion': VERSION, 'sourceId': 'bos-equity-coverage',
        'sourceTitle': 'Bank of Singapore Equity Coverage Universe',
        'reportDate': published.isoformat(), 'priceAsOf': next(iter(as_of_dates)),
        'sourceUrl': source_url, 'sourceSha256': hashlib.sha256(data).hexdigest(),
        'metricBasis': 'Consensus forward estimates; period not specified',
        'priceKind': 'published_reference_price', 'columns': columns,
        'records': records,
        'validation': {'passed': True, 'pageCount': len(texts), 'tablePages': expected_pages,
                       'equities': equities, 'indices': len(records) - equities,
                       'records': len(records), 'pages': counts, 'duplicateInstrumentIds': [],
                       'checks': ['19 source columns and units', 'all table pages consumed',
                                  'all table rows accounted for', 'independent text row counts',
                                  'all numeric tokens parsed or preserved as null',
                                  'unique listing-level identifiers', 'report/price date consistency'],
                       'groups': dict(Counter(record['marketGroup'] for record in records if record['instrumentType'] == 'equity'))},
        'sourceNotes': {
            'priceDate': 'Header explicitly supplies the quotation date; report and retrieval dates are different concepts.',
            'forwardPeriod': 'The PDF does not identify a particular fiscal year or a trailing/NTM period for consensus forward estimates.',
            'currency': 'Market capitalization is USD billions; price and fair value/target are in row quotation currency. GBp means pence and is not GBP.',
            'research': 'Provider is identified only from an explicit analyst cell or Morningstar embedded report URL. Fair value and target price are not interchangeable.',
            'missing': 'NA, UR, Restricted, Closed, dash and empty numeric cells are null with the original source token retained.',
            'moat': 'Two ticks mean Wide; one tick Narrow. An empty moat cell is unspecified, not inferred as no moat.',
            'licensedEsg': 'PDF p40 says MSCI ESG information is for internal use and may not be reproduced or redisseminated. Keep ESG raw cells and values out of public serialization.',
        },
    }


def write_outputs(snapshot: dict, output: Path):
    output.mkdir(parents=True, exist_ok=True)
    stem = 'bos-equity-' + snapshot['reportDate']
    (output / (stem + '.json')).write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    # Flat CSV includes source fields, provenance and all numeric values. UTF-8 BOM
    # makes the original names and moat symbols readable in Excel.
    fields = ['instrumentId', 'instrumentType', 'region', 'marketGroup', 'sector', *KEYS,
              'priceAsOf', 'reportDate', 'researchProvider', 'fairValueOrTargetKind',
              'researchReportUrl', 'sourcePage', 'sourceRow']
    fields += ['raw_' + key for key in KEYS]
    with (output / (stem + '.csv')).open('w', encoding='utf-8-sig', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction='ignore')
        writer.writeheader()
        for record in snapshot['records']:
            writer.writerow({**record, **{'raw_' + key: value for key, value in record['raw'].items()}})
    (output / (stem + '-validation.json')).write_text(json.dumps(snapshot['validation'], indent=2) + '\n', encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pdf', type=Path)
    parser.add_argument('--output-dir', required=True, type=Path)
    parser.add_argument('--source-url')
    parser.add_argument('--qa-dir', type=Path, help='Private audit directory for complete document text')
    args = parser.parse_args()
    snapshot = parse_pdf(args.pdf, args.source_url)
    write_outputs(snapshot, args.output_dir)
    if args.qa_dir:
        from pypdf import PdfReader
        args.qa_dir.mkdir(parents=True, exist_ok=True)
        texts = [{'page': n, 'text': page.extract_text()} for n, page in enumerate(PdfReader(args.pdf).pages, 1)]
        (args.qa_dir / 'all-pages-text.json').write_text(json.dumps(texts, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'reportDate': snapshot['reportDate'], 'priceAsOf': snapshot['priceAsOf'],
                      **snapshot['validation']}, indent=2))


if __name__ == '__main__':
    main()
