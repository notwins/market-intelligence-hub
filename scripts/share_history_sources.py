"""Read the approved public-market fields from three supplied historical files.

Workbook inputs are never modified. Financing limits, internal security numbers,
Excel errors, duplicate CSV columns and unlabelled scratch cells are excluded.
Dates, currencies and price adjustments are never inferred from filenames.
"""
from __future__ import annotations

import csv
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
import hashlib
import io
from pathlib import Path
import re
import xml.etree.ElementTree as ET
import zipfile

from import_beta_shares import import_csv, METRICS, EXPECTED_METRIC_HEADERS

NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
REL = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'
ISIN = re.compile(r'[A-Z]{2}[A-Z0-9]{9}\d')
GLOBAL_ID = 'global-top100-close-2026-11-05'
OCTOBER_ID = 'supplied-october-share-snapshot'
SEPTEMBER_ID = 'bloomberg-equity-snapshot'


def decimal_text(value):
    """Validate, but retain the source's numeric text and literal zero."""
    if value is None or isinstance(value, bool):
        return None
    raw = str(value).strip()
    if not raw or raw.startswith('#'):
        return None
    try:
        parsed = Decimal(raw)
    except InvalidOperation:
        return None
    return raw if parsed.is_finite() else None


def source_date(value):
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    raise ValueError('Expected a typed source observation date')


def text(value):
    return str(value).strip() if value is not None else ''


def load_workbook(path):
    # Extraction runs in the bundled runtime. Importing this module and running
    # its dependency-free contract tests do not require Excel packages in CI.
    import openpyxl
    return openpyxl.load_workbook(path, read_only=True, data_only=True, keep_links=False)


def source(path, identity, label):
    path = Path(path)
    return {'id': identity, 'label': label, 'file': path.name,
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'metrics': {}}


def raw_numeric_cells(path, columns):
    """Read numeric XML lexemes, avoiding a float round trip for source values."""
    output = {}
    with zipfile.ZipFile(path) as archive:
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        relationships = ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))
        targets = {item.attrib['Id']: item.attrib['Target'] for item in relationships}
        for sheet in workbook.find('s:sheets', NS):
            name = sheet.attrib['name']
            if name not in columns:
                continue
            target = targets[sheet.attrib[REL]]
            target = target.lstrip('/') if target.startswith('/') else 'xl/' + target
            cells = {}
            for cell in ET.fromstring(archive.read(target)).iterfind('.//s:c', NS):
                coordinate = cell.attrib.get('r', '')
                column = re.match(r'[A-Z]+', coordinate)
                if not column or column.group() not in columns[name]:
                    continue
                value = cell.find('s:v', NS)
                if cell.attrib.get('t', 'n') == 'n' and value is not None:
                    numeric = decimal_text(value.text)
                    if numeric is not None:
                        cells[coordinate] = numeric
            output[name] = cells
    return output


def cell_number(raw, sheet, column, row, value):
    return raw.get(sheet, {}).get(column + str(row), decimal_text(value))


def read_global(path):
    meta = source(path, GLOBAL_ID, 'Supplied Global Top 100 saved closing prices')
    meta.update(collectionDate='2026-11-06', priceCutoff='2026-11-05',
                adjustment='provider_close_unspecified',
                semantics='Provider Close retains provider adjustments. Not dividend-reinvested total return. No FX conversion. IHC has no separate adjustment flag. Current Top 100 membership is not historical membership.')
    meta['sourceQualifications'] = [
        'Eight missing Yahoo endpoint closes on 5 November were supplemented from StockAnalysis; per-listing source links are retained.',
        'Naver supplied two missing Korean closes on 19 September 2025. The workbook records unexplained Naver/Yahoo differences on 18 September; no harmonisation is inferred.',
        'The IHC issuer service has 13 Close-versus-high/low inconsistencies during 2025. The workbook preserves Close only; intraday OHLC is not validated.',
        'SPCX, 688825.SS and GEV have shorter histories. GEV includes when-issued trading. First and last weekly buckets can be partial.',
    ]
    meta['metrics'] = {
        'globalPrice': {'basis': 'Provider Close; adjustment treatment not harmonised across providers',
                        'unit': 'listing currency per share', 'grain': ['daily', 'weekly'],
                        'adjustment': 'provider_close_unspecified', 'dividendsReinvested': False},
        'marketCap': {'basis': 'Ranking provider raw USD market capitalisation; individual valuation instant not supplied',
                      'unit': 'USD', 'grain': 'snapshot'},
    }
    raw = raw_numeric_cells(path, {'Descriptions': {'I'}, 'Daily 1M': {'E'}, 'Weekly 5Y': {'F'}})
    workbook = load_workbook(path)
    listings, observations, indexed = [], [], {}
    try:
        rows = list(workbook['Descriptions'].iter_rows(values_only=True))
        if list(rows[5][:9]) != ['Rank', 'Ticker', 'Company', 'Currency', 'What the company does', 'Provider country', 'Sector from master', 'Exchange', 'Market cap (USD)']:
            raise ValueError('Global descriptions headers changed')
        for row_number, row in enumerate(rows[6:], 7):
            if not any(value is not None for value in row):
                continue
            ticker, currency = text(row[1]), text(row[3])
            if not ticker or not currency or ticker in indexed:
                raise ValueError('Global listing identity is missing or duplicated')
            key = 'global100:' + ticker + '|' + currency
            listing = {'key': key, 'ticker': ticker, 'bbTicker': None, 'currency': currency,
                       'isin': None, 'name': text(row[2]), 'sector': text(row[6]) or None,
                       'country': text(row[5]) or None, 'countryBasis': 'ranking provider label; not verified headquarters',
                       'exchange': text(row[7]), 'sourceId': GLOBAL_ID, 'sourceRow': row_number,
                       'sourceSheet': 'Descriptions', 'rank': row[0], 'description': text(row[4]),
                       'firstHistoryDate': source_date(row[9]), 'lastPriceDate': source_date(row[10]),
                       'dailyRows': row[11], 'weeklyRows': row[12], 'coverageNotes': text(row[13]),
                       'priceProvider': text(row[14]), 'priceSourceUrl': text(row[15]),
                       'descriptionSourceUrl': text(row[16]), 'additionalCloseSource': text(row[17]) or None,
                       'palette': text(row[18]) or None, 'colourLight': text(row[19]) or None,
                       'fillLight': text(row[20]) or None}
            listings.append(listing)
            indexed[ticker] = listing
            value = cell_number(raw, 'Descriptions', 'I', row_number, row[8])
            if value is not None:
                observations.append({'key': key, 'date': None, 'metric': 'marketCap', 'value': value,
                                     'currency': 'USD', 'sourceId': GLOBAL_ID, 'grain': 'snapshot',
                                     'sourceSheet': 'Descriptions', 'sourceRow': row_number, 'sourceColumn': 'I'})
        for sheet, grain, date_column, currency_column, price_column, price_letter in (
                ('Daily 1M', 'daily', 2, 3, 4, 'E'), ('Weekly 5Y', 'weekly', 3, 4, 5, 'F')):
            count, seen = {}, set()
            for row_number, row in enumerate(workbook[sheet].iter_rows(values_only=True), 1):
                if row_number <= 6 or not any(value is not None for value in row):
                    continue
                ticker = text(row[1])
                listing = indexed.get(ticker)
                if not listing or row[currency_column] != listing['currency']:
                    raise ValueError('Global price listing/currency mismatch')
                day = source_date(row[date_column])
                value = cell_number(raw, sheet, price_letter, row_number, row[price_column])
                if value is None or Decimal(value) <= 0 or (ticker, day) in seen:
                    raise ValueError('Invalid or duplicate global closing price')
                seen.add((ticker, day))
                count[ticker] = count.get(ticker, 0) + 1
                observation = {'key': listing['key'], 'date': day, 'metric': 'globalPrice', 'value': value,
                               'currency': listing['currency'], 'sourceId': GLOBAL_ID, 'grain': grain,
                               'adjustment': 'provider_close_unspecified', 'sourceSheet': sheet,
                               'sourceRow': row_number, 'sourceColumn': price_letter}
                if grain == 'weekly':
                    observation.update(weekStart=source_date(row[2]), observedPrices=row[6], coverage=text(row[7]))
                observations.append(observation)
            if any(count.get(ticker, 0) != listing[grain + 'Rows'] for ticker, listing in indexed.items()):
                raise ValueError('Global stated price counts do not reconcile')
    finally:
        workbook.close()
    return meta, listings, observations


def read_october(path):
    meta = source(path, OCTOBER_ID, 'Supplied October shares cross-section')
    meta.update(priceAsOf=None, currency=None,
                semantics='Filename month is not an observation date. Price and market-cap currencies are absent. Distinct rows may share an ISIN across listings. Internal financing fields are excluded.')
    meta['metrics'] = {
        'sourcePrice': {'basis': 'Source Price column; date, currency and adjustment not supplied', 'unit': 'unknown source currency', 'grain': 'snapshot'},
        'marketCap': {'basis': 'Source Market Cap column; currency and scale not supplied', 'unit': 'unknown', 'grain': 'snapshot'},
        'dividendYield': {'basis': 'Source Dividends (%) column; yield period not supplied', 'unit': 'percent', 'grain': 'snapshot'},
    }
    raw = raw_numeric_cells(path, {'SharePrice': {'N', 'O', 'Q'}})
    workbook = load_workbook(path)
    listings, observations = [], []
    try:
        for row_number, row in enumerate(workbook['SharePrice'].iter_rows(values_only=True), 1):
            if row_number == 1:
                if [row[i] for i in (0, 2, 3, 8, 9, 10, 11, 13, 14, 15, 16)] != ['BB Ticker', 'ISIN', 'Ace Name', 'FINIQ', 'RAW TICKER', 'EXCHANGE', 'TICKER FIN IQ', 'Price', 'Market Cap', 'Company Name', 'Dividends (%)']:
                    raise ValueError('October public-field headers changed')
                continue
            bb = re.sub(r'\s+EQUITY$', '', text(row[0]), flags=re.I) or None
            isin = text(row[2])
            isin = isin if ISIN.fullmatch(isin) else None
            name = text(row[15]) or text(row[3])
            if not name and not bb and not isin and not text(row[8]):
                continue
            key = 'october-row:' + str(row_number)
            listings.append({'key': key, 'bbTicker': bb, 'currency': None, 'isin': isin,
                             'name': name or text(row[8]) or bb or isin, 'ticker': text(row[9]) or None,
                             'providerSymbol': text(row[8]) or None, 'exchange': text(row[10]) or None,
                             'listingLabel': text(row[11]) or None, 'sourceId': OCTOBER_ID,
                             'sourceSheet': 'SharePrice', 'sourceRow': row_number})
            for metric, column, letter in (('sourcePrice', 13, 'N'), ('marketCap', 14, 'O'), ('dividendYield', 16, 'Q')):
                value = cell_number(raw, 'SharePrice', letter, row_number, row[column])
                if value is not None:
                    observations.append({'key': key, 'date': None, 'currency': None, 'metric': metric,
                                         'value': value, 'sourceId': OCTOBER_ID, 'grain': 'snapshot',
                                         'sourceSheet': 'SharePrice', 'sourceRow': row_number, 'sourceColumn': letter})
    finally:
        workbook.close()
    return meta, listings, observations


def read_september(path):
    validated = import_csv(path)
    rows = list(csv.reader(io.StringIO(Path(path).read_text(encoding='utf-8-sig'))))
    meta = source(path, SEPTEMBER_ID, 'Supplied Bloomberg September historical snapshot')
    meta.update(returnCutoff=validated['returnCutoff'], returnCutoffBasis=validated['returnCutoffBasis'],
                returnBasis=validated['returnBasis'], priceAsOf=None, creditAsOf=None,
                semantics='Same immutable CSV used by Beta Shares. Financial currencies, scale, accounting period and quote dates are absent. Return endpoint is inferred from paired annualized and holding-period returns, not a quote date.')
    renames = {'price': 'sourcePrice', 'dividendYieldPct': 'dividendYield'}
    for original, column in METRICS.items():
        metric = renames.get(original, original)
        meta['metrics'][metric] = {'basis': 'Source ' + EXPECTED_METRIC_HEADERS[column] + '; reporting period not exported',
                                   'unit': 'source field units; currency/scale not exported', 'grain': 'snapshot'}
    listings, observations = [], []
    for record in validated['records']:
        row = rows[record['sourceRow'] - 1]
        key = 'bbg:' + record['bbTicker'] + '|' + record['isin']
        listings.append({'key': key, 'bbTicker': record['bbTicker'], 'currency': None, 'isin': record['isin'],
                         'name': record['name'], 'sector': record['sector'], 'industry': record['industry'],
                         'sourceId': SEPTEMBER_ID, 'sourceRow': record['sourceRow'],
                         'credit': record['credit'], 'creditOutlook': record['creditOutlook'],
                         'latestAnnouncementDate': record['snapshot']['latestAnnouncementDate'],
                         'expectedReportDate': record['snapshot']['expectedReportDate']})
        for original, column in METRICS.items():
            value = decimal_text(row[column])
            if value is not None:
                observations.append({'key': key, 'date': None, 'metric': renames.get(original, original),
                                     'value': value, 'currency': None, 'sourceId': SEPTEMBER_ID, 'grain': 'snapshot',
                                     'sourceRow': record['sourceRow'], 'sourceColumn': column + 1})
        for first, label in ((49, 'trrAnnualized'), (57, 'trrHolding')):
            for offset, year in enumerate(range(2026, 2018, -1)):
                metric = label + str(year)
                meta['metrics'][metric] = {'basis': 'Local currency gross dividends reinvested; ' + ('annualized' if label == 'trrAnnualized' else 'holding-period') + ' return',
                                           'unit': 'percent', 'grain': 'period_return', 'periodStart': f'{year}-01-01',
                                           'periodEnd': validated['returnCutoff'], 'endDateBasis': validated['returnCutoffBasis']}
                value = decimal_text(row[first + offset])
                if value is not None:
                    observations.append({'key': key, 'date': validated['returnCutoff'], 'metric': metric,
                                         'value': value, 'currency': None, 'sourceId': SEPTEMBER_ID, 'grain': 'period_return',
                                         'periodStart': f'{year}-01-01', 'dateBasis': validated['returnCutoffBasis'],
                                         'sourceRow': record['sourceRow'], 'sourceColumn': first + offset + 1})
    meta['validation'] = validated['validation']
    return meta, listings, observations


def extract_sources(global_xlsx, october_xlsx, september_csv):
    output = {'sources': [], 'listings': [], 'observations': [], 'cautions': [
        'No name-only joins. Preserve exact exchange, currency, ISIN and share-class distinctions; company colours do not establish security identity.',
        'Global daily and weekly prices overlap. Keep grain separate; do not sum observations or substitute week-start dates for actual price dates.',
        'Global provider Close is not dividend-reinvested total return and is not adjustment-harmonised with BOS published reference prices.',
        'October and September quote/valuation observations are undated snapshots; filenames and return cutoffs are not quotation dates.',
        'October internal security numbers, financing AR/concentration limits and Excel linkage/error fields are excluded.',
        'CSV sample/header rows, ticker-only stubs, duplicate metrics, unlabelled scratch columns and empty historical P/E columns are excluded.',
    ]}
    for reader, path in ((read_global, global_xlsx), (read_october, october_xlsx), (read_september, september_csv)):
        meta, listings, observations = reader(path)
        output['sources'].append(meta)
        output['listings'].extend(listings)
        output['observations'].extend(observations)
    keys = [listing['key'] for listing in output['listings']]
    key_set = set(keys)
    if len(key_set) != len(keys):
        raise ValueError('Duplicate extracted source listing key')
    if any(point['key'] not in key_set or decimal_text(point['value']) is None for point in output['observations']):
        raise ValueError('Invalid extracted financial observation')
    return output
