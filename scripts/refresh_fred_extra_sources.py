"""Official native-schema adapters for the additional external datasets.

Only explicit source rows in the overlap are returned; the caller owns the
non-destructive history merge. Identity is date+series for Z.1, date+country
for Census, record_date+src_line_nbr for MSPD, date for debt/PDF, and
observation_date+record_date+securities_owner for OFS publication history.
"""
import calendar
import csv
import datetime as dt
import decimal
import hashlib
import io
import json
import re
import threading
import urllib.parse
import zipfile

FED_URL = 'https://www.federalreserve.gov/releases/z1/current/z1_csv_files.zip'
CENSUS_URL = 'https://www.census.gov/foreign-trade/balance/country.xlsx'
FISCAL_BASE = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/'
FED_TABLES = {'FED_TREASURY_STOCKS': 'F3_2_s',
              'FED_TREASURY_TRANSACTIONS_NSA': 'F3_2_t_tu',
              'FED_TREASURY_TRANSACTIONS_SAAR': 'F3_2_t'}
FISCAL_ENDPOINTS = {
    'TREASURY_DEBT_PENNY': 'v2/accounting/od/debt_to_penny',
    'TREASURY_MSPD_SUMMARY': 'v1/debt/mspd/mspd_table_1',
    'TREASURY_MSPD_MARKET': 'v1/debt/mspd/mspd_table_3_market',
    'TREASURY_MSPD_NONMARKET': 'v1/debt/mspd/mspd_table_3_nonmarket',
    'TREASURY_OFS2_PUBLICATIONS': 'v1/accounting/tb/ofs2_estimated_ownership_treasury_securities'}
OFS_COLS = ['total_public_debt_usd_billions', 'fed_and_government_accounts_usd_billions',
            'total_privately_held_usd_billions', 'depository_institutions_usd_billions',
            'us_savings_bonds_usd_billions', 'private_pension_funds_usd_billions',
            'state_local_pension_funds_usd_billions', 'insurance_companies_usd_billions',
            'mutual_funds_usd_billions', 'state_local_governments_usd_billions',
            'foreign_international_usd_billions', 'other_investors_usd_billions']
MISSING = {'', 'null', '*', '(*)', '-', 'N/A', 'n.a.', 'ND', 'NA'}
_BULK_CACHE = {}
_BULK_LOCK = threading.Lock()


def _bulk(fetch, url):
    # Keep the callable itself in the key, preventing id reuse between runs.
    with _BULK_LOCK:
        key = (fetch, url)
        if key not in _BULK_CACHE:
            _BULK_CACHE[key] = fetch(url)
        return _BULK_CACHE[key]


def _number(value, missing=MISSING):
    if value in missing:
        return
    if not decimal.Decimal(value).is_finite():
        raise ValueError('Nonfinite source number')


def _date(value):
    date = dt.date.fromisoformat(value)
    if date.isoformat() != value:
        raise ValueError('Noncanonical source date')
    return date


def _result(fields, rows, keys, url, start, raw, today):
    if not fields or len(set(fields)) != len(fields) or not rows:
        raise ValueError('Missing schema or empty source overlap')
    identities = set()
    for row in rows:
        if set(row) != set(fields) or any(not isinstance(v, str) for v in row.values()):
            raise ValueError('Source schema differs from published native schema')
        date = row.get('observation_date', row.get('record_date'))
        _date(date)
        if not start <= date <= today.isoformat():
            raise ValueError('Source observation outside requested overlap')
        identity = tuple(row[k] for k in keys)
        if not all(identity) or identity in identities:
            raise ValueError('Empty or duplicate source observation identity')
        identities.add(identity)
    return dict(fields=fields, rows=rows, keys=keys, source_url=url,
                query_start=start, response_sha256=hashlib.sha256(raw).hexdigest())


def _fed(entry, today, fields, fetch, start):
    raw = _bulk(fetch, FED_URL)
    table = FED_TABLES[entry['id']]
    book = zipfile.ZipFile(io.BytesIO(raw))
    dictionary = {}
    for cells in csv.reader(io.StringIO(book.read('data_dictionary/' + table + '.txt').decode('utf-8-sig')), delimiter='\t'):
        if len(cells) != 5 or cells[0] in dictionary:
            raise ValueError('Changed or duplicate Fed dictionary schema')
        if not cells[4].startswith('Millions of dollars;'):
            raise ValueError('Fed source units changed')
        dictionary[cells[0]] = dict(zip(['description', 'line', 'table', 'units_and_basis'], cells[1:]))
    reader = csv.DictReader(io.StringIO(book.read('csv/' + table + '.csv').decode('utf-8-sig')))
    if not reader.fieldnames or reader.fieldnames[0] != 'date' or len(set(reader.fieldnames)) != len(reader.fieldnames):
        raise ValueError('Changed Fed table schema')
    if set(reader.fieldnames[1:]) != set(dictionary):
        raise ValueError('Fed dictionary and table series differ')
    rows = []
    for source in reader:
        if None in source or any(v is None for v in source.values()):
            raise ValueError('Fed source row width changed')
        match = re.fullmatch(r'(\d{4}):Q([1-4])', source['date'])
        if not match:
            raise ValueError('Unexpected Fed quarter')
        year, quarter = map(int, match.groups()); month = quarter * 3
        date = dt.date(year, month, calendar.monthrange(year, month)[1]).isoformat()
        if not start <= date <= today.isoformat():
            continue
        for code in reader.fieldnames[1:]:
            _number(source[code], {'ND', 'NA', ''})
            rows.append(dict(observation_date=date, source_period=source['date'], series_code=code,
                             value=source[code], **dictionary[code]))
    return _result(fields, rows, ['observation_date', 'series_code'], FED_URL, start, raw, today)


def _census(entry, today, fields, fetch, start):
    import openpyxl
    raw = _bulk(fetch, CENSUS_URL)
    book = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
    try:
        iterator = iter(book['country'].values); header = next(iterator)
        expected = ['year', 'CTY_CODE', 'CTYNAME'] + ['I' + calendar.month_abbr[m].upper() for m in range(1, 13)] + ['IYR'] + ['E' + calendar.month_abbr[m].upper() for m in range(1, 13)] + ['EYR']
        if list(header) != expected:
            raise ValueError('Census workbook schema changed')
        cells_all = list(iterator)
    finally:
        book.close()
    sources = []
    latest = None
    for cells in cells_all:
        if len(cells) != len(header):
            raise ValueError('Census row width changed')
        source = dict(zip(header, cells))
        if not re.fullmatch(r'\d{4}', str(source['year'])) or not isinstance(source['CTY_CODE'], str) or not source['CTY_CODE'] or not isinstance(source['CTYNAME'], str):
            raise ValueError('Census year or country identity changed')
        source['year'] = int(source['year'])
        sources.append(source)
        for month in range(1, 13):
            mon = calendar.month_abbr[month].upper()
            values = [source['I' + mon], source['E' + mon]]
            for value in values:
                if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float))):
                    raise ValueError('Census value is not numeric or missing')
                if value is not None:
                    _number(str(value), set())
            if any(value is not None and value != 0 for value in values):
                date = dt.date(source['year'], month, 1).isoformat()
                latest = max(latest or date, date)
    if latest is None:
        raise ValueError('Census has no globally populated month')
    rows = []
    for source in sources:
        for month in range(1, 13):
            date = dt.date(source['year'], month, 1).isoformat()
            if not start <= date <= min(today.isoformat(), latest):
                continue
            mon = calendar.month_abbr[month].upper(); imp, exp = source['I' + mon], source['E' + mon]
            if imp is None and exp is None:
                continue
            balance = '' if imp is None or exp is None else str(decimal.Decimal(str(exp)) - decimal.Decimal(str(imp)))
            rows.append(dict(observation_date=date, country_code=source['CTY_CODE'], country_or_area=source['CTYNAME'],
                             imports_usd_millions='' if imp is None else str(imp),
                             exports_usd_millions='' if exp is None else str(exp), balance_usd_millions=balance))
    return _result(fields, rows, ['observation_date', 'country_code'], CENSUS_URL, start, raw, today)


def _fiscal(entry, today, fields, fetch, start):
    ofs = entry['id'] == 'TREASURY_OFS2_PUBLICATIONS'
    native_fields = [f for f in fields if f not in {'observation_date', 'usable_securities_bil_amt', 'availability_note'}] if ofs else fields
    date_field = 'end_of_month' if ofs else 'record_date'
    filters = f'{date_field}:gte:{start},{date_field}:lte:{today.isoformat()}'
    if ofs:
        filters += ',record_date:lte:' + today.isoformat()
    rows, raw_pages = [], []
    expected_total = expected_pages = None
    for page in range(1, 1001):
        url = FISCAL_BASE + FISCAL_ENDPOINTS[entry['id']] + '?' + urllib.parse.urlencode({
            'filter': filters, 'sort': 'record_date', 'page[size]': '10000', 'page[number]': str(page)})
        raw = fetch(url); raw_pages.append(raw); obj = json.loads(raw)
        data, meta = obj.get('data'), obj.get('meta', {})
        total, pages = int(meta['total-count']), int(meta['total-pages'])
        if not isinstance(data, list) or not data or int(meta['count']) != len(data) or total < len(data) or not 1 <= pages <= 1000:
            raise ValueError('Empty or incomplete FiscalData page')
        if page == 1:
            expected_total, expected_pages = total, pages
            first_url = url
        elif (total, pages) != (expected_total, expected_pages):
            raise ValueError('FiscalData pagination changed during download')
        types = meta.get('dataTypes', {})
        if set(meta.get('labels', {})) != set(native_fields) or set(types) != set(native_fields):
            raise ValueError('FiscalData source schema changed')
        for source in data:
            if set(source) != set(native_fields):
                raise ValueError('FiscalData row schema changed')
            row = {}
            for key, value in source.items():
                if value is None:
                    value = 'null'
                if not isinstance(value, str):
                    raise ValueError('FiscalData native values must remain strings')
                if types[key].startswith(('CURRENCY', 'NUMBER', 'PERCENTAGE', 'INTEGER', 'FLOAT')):
                    _number(value)
                if types[key] == 'DATE' and value not in MISSING:
                    _date(value)
                row[key] = value
            if not start <= row[date_field] <= today.isoformat() or row['record_date'] > today.isoformat():
                raise ValueError('FiscalData returned observations outside filter')
            if ofs:
                value = row['securities_bil_amt']; _number(value)
                unavailable = row['record_date'] < '2024-03-01' and value not in MISSING and decimal.Decimal(value) == 0
                row = dict(observation_date=row['end_of_month'], **row,
                           usable_securities_bil_amt='' if unavailable or value in {'null', ''} else value,
                           availability_note='Source documents historical zero as unavailable' if unavailable else '')
            rows.append(row)
        if page == expected_pages:
            break
    if len(rows) != expected_total:
        raise ValueError('FiscalData total-count does not match complete download')
    keys = ['observation_date', 'record_date', 'securities_owner'] if ofs else ['record_date']
    if entry['id'].startswith('TREASURY_MSPD_'):
        keys.append('src_line_nbr')
    # Hash the exact page bytes in page order; one-page responses hash natively.
    return _result(fields, rows, keys, first_url, start, b''.join(raw_pages), today)


def _ofs_table(text, publication, page, url):
    """Extract the actual 12-column table, retaining source missing tokens."""
    rows, year = [], None
    for line in text.splitlines():
        match = re.match(r'^\s*(?:(\d{4})\s*[-–—]\s*)?(Mar(?:ch)?|June?|Sept(?:ember)?|Dec(?:ember)?)\.?[.\s]*(.*)$', line, re.I)
        if not match:
            continue
        nums = re.sub(r',\s+(?=\d)', ',', match[3])
        nums = re.sub(r'(?<=\d\.)\s+(?=\d(?:\s|$))', '', nums)
        values = re.findall(r'-?\d[\d,]*\.\d+|n\.a\.|N/A|(?<!\S)-(?!\S)', nums, re.I)
        if not values:
            continue
        if match[1]:
            year = int(match[1])
        if year is None or len(values) != 12:
            raise ValueError('OFS-2 year or 12-column table schema changed')
        month = {'mar': 3, 'jun': 6, 'sep': 9, 'dec': 12}[match[2][:3].lower()]
        date = dt.date(year, month, calendar.monthrange(year, month)[1]).isoformat()
        clean = ['' if v.lower() in {'n.a.', 'n/a', '-'} else v.replace(',', '') for v in values]
        for value in clean:
            _number(value, {''})
        rows.append(dict(observation_date=date, **dict(zip(OFS_COLS, clean)),
                         source_publication_month=publication, source_pdf_page=str(page),
                         source_url=url, source_value_tokens=';'.join(values)))
    return rows


def _ofs_archive(entry, today, fields, fetch, start):
    from pypdf import PdfReader
    # Most recent scheduled publication month, then three earlier quarters.
    quarter = today.year * 4 + (today.month // 3) - 1
    failures = []
    for offset in range(4):
        year, q = divmod(quarter - offset, 4)
        publication = f'{year:04d}-{(q + 1) * 3:02d}'
        url = 'https://fiscaldata.treasury.gov/static-data/published-reports/treasury_bulletin/Treasury_Bulletin_' + publication.replace('-', '_') + '.pdf'
        try:
            raw = fetch(url)
        except Exception as exc:
            failures.append(type(exc).__name__ + ': ' + publication)
            continue
        # A fetched but changed/invalid latest release must fail visibly.
        if not raw.startswith(b'%PDF-'):
            raise ValueError('Treasury Bulletin response is not PDF')
        reader = PdfReader(io.BytesIO(raw)); table_rows = None
        # Modern bulletins place OFS here. Prioritizing the known section avoids
        # parsing unrelated decorative cover fonts; all pages remain a fallback.
        preferred = list(range(35, min(len(reader.pages), 75)))
        scan = preferred + [i for i in range(len(reader.pages)) if i not in preferred]
        for index in scan:
            page = index + 1
            text = reader.pages[index].extract_text() or ''
            if not re.search(r'TABLE\s+OFS-2', text) or not re.search(r'Estimated Ownership', text, re.I):
                continue
            if not re.search(r'^\s*\d{4}\s*[-–—]\s*(?:Mar|Jun|Sep|Dec)', text, re.M | re.I):
                continue  # Table of contents mentions the title but has no observations.
            table_rows = _ofs_table(text, publication, page, url)
            break
        if not table_rows:
            raise ValueError('Treasury Bulletin actual OFS-2 table unavailable')
        rows = [r for r in table_rows if start <= r['observation_date'] <= today.isoformat()]
        return _result(fields, rows, ['observation_date'], url, start, raw, today)
    raise ValueError('No recent official Treasury Bulletin PDF: ' + '; '.join(failures))


def fetch_dataset(entry, today, old_fields, fetch, query_start):
    """Fetch one additional dataset without changing any stored history."""
    start = query_start(entry, today)
    _date(start)
    if entry['id'] in FED_TABLES:
        result = _fed(entry, today, old_fields, fetch, start)
    elif entry['id'] == 'CENSUS_GOODS_TRADE_COUNTRIES':
        result = _census(entry, today, old_fields, fetch, start)
    elif entry['id'] in FISCAL_ENDPOINTS:
        result = _fiscal(entry, today, old_fields, fetch, start)
    elif entry['id'] == 'TREASURY_OFS2_20Y_ARCHIVE':
        result = _ofs_archive(entry, today, old_fields, fetch, start)
    else:
        raise ValueError('Unsupported extra-source dataset: ' + entry['id'])
    if entry.get('last') and max(r.get('observation_date', r.get('record_date')) for r in result['rows']) < entry['last']:
        raise ValueError('Source response omits the latest stored observation')
    return result
