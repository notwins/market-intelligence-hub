"""Consolidate public security observations into a lossless, date-block CSV.

Original files are read only. Prices, forward estimates and return periods keep
their source meaning; unknown dates/units are never inferred from a filename.
"""
from __future__ import annotations
import argparse
from collections import defaultdict
import csv
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import gzip
import hashlib
import io
import json
from pathlib import Path
import re

VERSION = 1
NUMBER = re.compile(r"^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$")
PANEL_FIELDS = {
    'eps_source_price': 'sourcePrice', 'eps_source_pe': 'pe',
    'implied_forward_eps': 'impliedEps', 'eps_comparison_status': 'comparisonStatus',
}
FORWARD = 'Consensus forward estimate; exact forecast horizon unspecified'
METRICS = {
    'sourcePrice': {'label': 'BOS reference price', 'unit': 'quotation currency', 'basis': 'Unadjusted source reference price; not a total-return series', 'grain': 'month'},
    'pe': {'label': 'P/E', 'unit': 'times', 'basis': FORWARD, 'grain': 'month'},
    'pb': {'label': 'P/B', 'unit': 'times', 'basis': FORWARD, 'grain': 'month'},
    'dividendYield': {'label': 'Dividend yield', 'unit': 'percent', 'basis': FORWARD, 'grain': 'month'},
    'impliedEps': {'label': 'Implied forward EPS', 'unit': 'quotation currency per quoted share', 'basis': 'Source price / positive source forward P/E; not reported actual EPS', 'derived': True, 'grain': 'month'},
    'peChange': {'label': 'P/E change', 'unit': 'percent', 'basis': 'Adjacent archive observations; forecast rolls not reconciled', 'derived': True, 'grain': 'month'},
    'sourcePriceChange': {'label': 'Raw source-price change', 'unit': 'percent', 'basis': 'Unadjusted arithmetic only; corporate actions not reconciled; not an investment return', 'derived': True, 'grain': 'month'},
}


def compact_json(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), sort_keys=True, allow_nan=False)


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def rows(path):
    with Path(path).open(encoding='utf-8-sig', newline='') as handle:
        yield from csv.DictReader(handle)


def validate_date(value):
    if value in (None, ''):
        return None
    import datetime
    if not isinstance(value, str) or datetime.date.fromisoformat(value).isoformat() != value:
        raise ValueError('Invalid observation date')
    return value


def scalar(value):
    if value is None or value == '':
        return ''
    text = str(value)
    if NUMBER.fullmatch(text):
        if not Decimal(text).is_finite():
            raise ValueError('Nonfinite source value')
    elif text.lower() in ('nan', 'inf', '-inf', 'infinity'):
        raise ValueError('Nonfinite source value')
    return text


class Dataset:
    def __init__(self):
        self.listings = {}
        self.sources = {}
        self.entries = []
        self.cautions = []
        self.deduplicated = 0
        self.conflicts = 0
        self._facts = {}

    def listing(self, value):
        value = {**value}
        ticker, currency, isin = value.get('bbTicker') or '', value.get('currency') or '', value.get('isin') or ''
        candidates = []
        if value.get('forceSeparate'):
            value.pop('forceSeparate')
            key = 'source:' + str(value['key'])
            value.update(id=key, currentEligible=False, compareEligible=False)
            value.pop('key', None)
            self.listings[key] = value
            return key
        if not currency and isin and ticker:
            candidates = [k for k, r in self.listings.items() if r.get('isin') == isin and (not ticker or r.get('bbTicker') == ticker)]
        if not currency and not candidates and ticker:
            candidates = [k for k, r in self.listings.items() if r.get('bbTicker') == ticker]
        key = candidates[0] if len(candidates) == 1 else ('bb:' + ticker + '|' + currency if ticker else str(value.get('key') or 'isin:' + isin))
        if not key or key == 'isin:':
            raise ValueError('Listing needs a stable source identity')
        value.update(id=key, bbTicker=ticker, currency=currency or None, isin=isin or None)
        value.setdefault('currentEligible', bool(ticker and currency))
        value.setdefault('compareEligible', True)
        value.setdefault('identityStatus', 'exact_ticker_currency' if ticker and currency else 'source_identity_currency_unknown')
        if key in self.listings:
            old = self.listings[key]
            if currency and old.get('currency') and currency != old['currency']:
                raise ValueError('Conflicting listing currency')
            if isin and old.get('isin') and isin != old['isin']:
                # A reused source ticker cannot silently replace a known ISIN.
                key += '|isin:' + isin
                value['id'] = key
            else:
                for field, val in value.items():
                    if not old.get(field) and val not in (None, '', []):
                        old[field] = val
                return key
        value.pop('key', None)
        self.listings[key] = value
        return key

    def source(self, source):
        value = {**source}
        value['file'] = str(value.get('file', '')).replace('\\', '/').split('/')[-1]
        key = value['id']
        if key in self.sources and self.sources[key] != value:
            raise ValueError('Conflicting source dictionary identity')
        self.sources[key] = value
        return key

    def add(self, key, source, values, *, date=None, reportDate=None, archiveMonth=None,
            sourcePage='', sourceRow='', sourceColumn='', sourceSheet='', meta=None):
        if key not in self.listings or source not in self.sources:
            raise ValueError('Observation references an unknown dictionary key')
        date, reportDate = validate_date(date), validate_date(reportDate)
        if date and reportDate and date > reportDate:
            raise ValueError('Observation date is after publication')
        cleaned = {metric: scalar(value) for metric, value in values.items() if value not in ('', None)}
        retained = {}
        fact = (key, source, date, reportDate, archiveMonth, sourceSheet)
        facts = self._facts.setdefault(fact, {})
        for metric, value in cleaned.items():
            existing = facts.get(metric)
            if existing is not None:
                same = existing == value or NUMBER.fullmatch(existing) and NUMBER.fullmatch(value) and Decimal(existing) == Decimal(value)
                if same:
                    self.deduplicated += 1
                    continue
                self.conflicts += 1
                meta = {**(meta or {}), 'conflict': True}
            facts[metric] = value
            retained[metric] = value
        if retained:
            self.entries.append({'id': key, 'source': source, 'date': date, 'reportDate': reportDate,
                                 'archiveMonth': archiveMonth, 'sheet': sourceSheet or '',
                                 'page': str(sourcePage or ''), 'row': str(sourceRow or ''),
                                 'column': str(sourceColumn or ''), 'meta': meta or {}, 'values': retained})


def read_bos(base, dataset):
    base = Path(base)
    wide_path = base / 'EPS Consolidated V2/BOS_Monthly_Price_PE_EPS_V2.csv'
    panel_path = base / 'implied_eps_monthly_panel.csv'
    with wide_path.open(encoding='utf-8-sig', newline='') as handle:
        grid = list(csv.reader(handle))
    if len(grid[0]) != 481 or grid[0][0] != 'Share name [ticker; currency]':
        raise ValueError('Unexpected BOS matrix layout')
    import datetime
    months = [datetime.datetime.strptime(grid[0][i].split()[0], '%b-%Y').strftime('%Y-%m') for i in range(1, 481, 4)]
    names, matrix = {}, {}
    for row in grid[1:]:
        if len(row) != len(grid[0]):
            raise ValueError('Ragged BOS matrix')
        match = re.fullmatch(r'(.*) \[(.*); (.*)\]', row[0])
        if not match:
            raise ValueError('Invalid exact BOS identity')
        name, ticker, currency = match.groups()
        identity = (ticker, currency)
        if identity in names:
            raise ValueError('Duplicate BOS matrix listing')
        names[identity] = dataset.listing({'bbTicker': ticker, 'currency': currency, 'name': name,
                                         'currentEligible': True, 'compareEligible': True,
                                         'identityStatus': 'exact_ticker_currency'})
        for i, month in enumerate(months):
            cells = row[1+i*4:5+i*4]
            if any(cells):
                matrix[(*identity, month)] = cells
    raw_sources, seen, date_map = {}, set(), {}
    for row in rows(panel_path):
        identity = (row['eps_security_ticker'], row['eps_currency'])
        key = (*identity, row['archive_month'])
        if key in seen or key not in matrix:
            raise ValueError('Duplicate or absent BOS panel observation')
        seen.add(key)
        expected = [row['eps_source_price'], row['eps_source_pe'], row['implied_forward_eps'], row['pe_change_pct_mom']]
        for value, actual, places in zip(expected, matrix[key], (None, None, 4, 2)):
            if value == '' and actual == '':
                continue
            number = Decimal(value)
            if places is not None:
                number = number.quantize(Decimal(10) ** -places, rounding=ROUND_HALF_UP)
            if not actual or Decimal(actual) != number:
                raise ValueError('BOS matrix/panel values differ')
        price, pe, eps = map(Decimal, expected[:3])
        if price <= 0 or pe <= 0 or abs(eps-price/pe)/(price/pe) > Decimal('1e-10'):
            raise ValueError('Implied forward EPS does not reconcile')
        relative = Path(row['source_csv'].replace('\\', '/'))
        path = (base / relative).resolve()
        if not path.is_relative_to(base.resolve()):
            raise ValueError('Source provenance escapes the supplied archive')
        if path not in raw_sources:
            sid = 'bos:' + row['report_date']
            dataset.source({'id': sid, 'label': 'Bank of Singapore monthly archive', 'file': path.name,
                            'sha256': digest(path), 'metrics': {**METRICS,
                            'impliedEpsChange': {'basis': 'Unadjusted implied forward EPS comparison; forecast rolls unverified', 'unit': 'percent', 'derived': True},
                            'priceEpsEffect': {'basis': 'Arithmetic attribution only; not realised return', 'unit': 'percentage points', 'derived': True},
                            'pricePeEffect': {'basis': 'Arithmetic attribution only; not realised return', 'unit': 'percentage points', 'derived': True}},
                            'adjustment': 'unadjusted', 'grain': 'month', 'reportDate': row['report_date']})
            raw_sources[path] = sid
        sid = raw_sources[path]
        date_map[row['archive_month']] = (row['report_date'], row['eps_price_as_of'], sid)
        dataset.add(names[identity], sid, {metric: row[field] for field, metric in PANEL_FIELDS.items()},
                    date=row['eps_price_as_of'], reportDate=row['report_date'], archiveMonth=row['archive_month'],
                    sourcePage=row['source_page'], sourceRow=row['page_row'])
    extras = 0
    for path, sid in raw_sources.items():
        for row in rows(path):
            identity = (row.get('eps_security_ticker'), row.get('eps_currency'))
            month = path.parent.name
            key = (*identity, month)
            if key in seen or key not in matrix:
                continue
            if row.get('eps_status') != 'unavailable_nonpositive_or_missing_price_pe' or not row.get('eps_source_price'):
                continue
            price, pe = row['eps_source_price'], row.get('eps_source_pe', '')
            if Decimal(price) != Decimal(matrix[key][0]) or bool(pe) != bool(matrix[key][1]) or pe and Decimal(pe) != Decimal(matrix[key][1]):
                raise ValueError('BOS price-only matrix/source values differ')
            if pe and Decimal(pe) > 0:
                raise ValueError('Unexpected positive-PE omitted EPS observation')
            report, date, _ = date_map[month]
            dataset.add(names[identity], sid, {'sourcePrice': price, 'pe': pe}, date=date,
                        reportDate=report, archiveMonth=month, sourcePage=row['source_page'], sourceRow=row['page_row'])
            seen.add(key)
            extras += 1
    if seen != set(matrix):
        raise ValueError('BOS matrix contains unreconciled observations')
    dataset.cautions.extend(['BOS archive months differ from actual price dates.',
        'BOS prices are unadjusted; corporate actions and forecast rolls are not reconciled.',
        'Implied EPS is price / positive consensus-forward P/E, not reported actual earnings.',
        'December 2016 through June 2017 have no observations; no interpolation.',
        'Redundant monthly changes, attribution effects and previous-date/gap columns are not stored. Original price, P/E and full-precision implied EPS are retained; comparisons may be recomputed only as unadjusted arithmetic.'])
    return {'matrixListings': len(names), 'observations': len(seen), 'panelObservations': len(seen)-extras,
            'additionalPricePe': extras, 'matrixBytes': wide_path.stat().st_size, 'panelBytes': panel_path.stat().st_size,
            'panelSha256': digest(panel_path), 'matrixSha256': digest(wide_path)}


def add_helper(dataset, bundle):
    by_ticker = defaultdict(set)
    for listing in bundle['listings']:
        if listing.get('bbTicker') and listing.get('isin'):
            by_ticker[listing['bbTicker']].add(listing['isin'])
    conflicts = {ticker for ticker, isins in by_ticker.items() if len(isins) > 1}
    september = {(r.get('bbTicker'), r.get('isin')) for r in bundle['listings'] if r.get('sourceId') == 'bloomberg-equity-snapshot'}
    reviewed = {}
    mapping_path = Path(__file__).resolve().parents[1] / 'site/bos-equity.js'
    if mapping_path.exists():
        match = re.search(r'const reviewedListings=Object.freeze\((\[.*?\])\.map', mapping_path.read_text(encoding='utf-8'), re.S)
        if match:
            reviewed = {(m['ticker'], m['currency']): m for m in json.loads(match.group(1)) if m.get('verified') is True}
    for source in bundle['sources']:
        dataset.source(source)
    identities = {}
    # Establish consistent supplied ISINs before attaching matching October rows.
    for listing in sorted(bundle['listings'], key=lambda r: r.get('sourceId') != 'bloomberg-equity-snapshot'):
        value = dict(listing)
        if value.get('bbTicker') in conflicts:
            value.update(forceSeparate=True, identityStatus='conflict', currentEligible=False, compareEligible=False)
        elif value.get('sourceId') == 'supplied-october-share-snapshot' and (value.get('bbTicker'), value.get('isin')) not in september:
            value.update(forceSeparate=True, identityStatus='unresolved', currentEligible=False, compareEligible=False)
        elif value.get('sourceId') == 'global-top100-close-2026-11-05':
            mapping = reviewed.get((value.get('ticker'), value.get('currency')))
            if mapping:
                value['bbTicker'] = mapping['instrumentId']
            value.update(currentEligible=True, compareEligible=True, identityStatus='exact_provider_ticker_currency')
        identities[listing['key']] = dataset.listing(value)
    extras = ('grain', 'adjustment', 'periodStart', 'dateBasis', 'currency', 'sourceColumn')
    metadata_values = defaultdict(lambda: defaultdict(set))
    for observation in bundle['observations']:
        for field in extras:
            if field in observation and (field == 'currency' or observation[field] is not None):
                metadata_values[(observation['sourceId'], observation['metric'])][field].add(compact_json(observation[field]))
    promoted = {}
    for (source, metric), fields in metadata_values.items():
        descriptor = dataset.sources[source].setdefault('metrics', {}).setdefault(metric, {})
        for field, values in fields.items():
            if len(values) == 1:
                promoted[(source, metric, field)] = json.loads(next(iter(values)))
                descriptor[field] = promoted[(source, metric, field)]
    grouped = {}
    for observation in bundle['observations']:
        key = observation['key']
        per_row = {field: observation[field] for field in extras if observation.get(field) is not None and
                   (observation['sourceId'], observation['metric'], field) not in promoted}
        context = (key, observation['sourceId'], observation.get('date'), observation.get('reportDate'),
                   observation.get('archiveMonth'), observation.get('sourceSheet', ''), str(observation.get('sourceRow', '')),
                   '', str(observation.get('sourcePage', '')), compact_json(per_row))
        entry = grouped.setdefault(context, {})
        metric = observation['metric']
        if metric in entry and entry[metric] != observation['value']:
            raise ValueError('Conflicting helper observation in one source cell')
        entry[metric] = observation['value']
    for context, values in grouped.items():
        key, source, date, report, month, sheet, row, column, page, meta = context
        dataset.add(identities[key], source, values, date=date, reportDate=report,
                    archiveMonth=month, sourceSheet=sheet, sourceRow=row, sourceColumn=column, sourcePage=page, meta=json.loads(meta))
    dataset.cautions.extend(bundle.get('cautions', []))


def add_selected_history(dataset, path):
    data = json.loads(Path(path).read_text(encoding='utf-8-sig'))
    fields = {'price': 'sourcePrice', 'pe': 'pe', 'pb': 'pb', 'dividend_yield_pct': 'dividendYield',
              'market_cap_usd_bn': 'marketCapUsdBillions', 'eps_growth_pct': 'epsGrowth', 'roe_pct': 'roe',
              'fair_value_or_target': 'fairValueOrTarget', 'rating': 'rating'}
    for observation in data['observations']:
        source = 'bos:' + observation['report_date']
        if source not in dataset.sources:
            dataset.source({'id': source, 'label': 'Bank of Singapore selected archive', 'file': Path(path).name,
                            'sha256': digest(path), 'grain': 'month', 'metrics': METRICS})
        dataset.sources[source]['metrics'].update({
            'marketCapUsdBillions': {'unit': 'USD billions', 'basis': 'Published market capitalisation'},
            'roe': {'unit': 'percent', 'basis': FORWARD}, 'epsGrowth': {'unit': 'percent', 'basis': FORWARD},
            'fairValueOrTarget': {'unit': 'quotation currency', 'basis': 'Unresolved fair value or analyst target; not a market price'}})
        identity = dataset.listing({'bbTicker': observation['source_ticker'], 'currency': observation['currency'],
                                    'name': observation['symbol']})
        values = {metric: observation.get(field) for field, metric in fields.items()}
        for field, raw in observation.get('source_values', {}).items():
            if field in fields and raw not in (None, '', 'NA', 'Restricted'):
                values[fields[field]] = str(raw).replace(',', '')
        dataset.add(identity, source, values, date=observation['price_date'], reportDate=observation['report_date'],
                    archiveMonth=observation['report_date'][:7], sourcePage=observation['source_page'],
                    sourceRow=observation['source_row'])


def encode_csv(dataset):
    """Typed dictionaries + date contexts + compact observation rows, all in CSV."""
    identifiers = {key: index for index, key in enumerate(sorted(dataset.listings))}
    enums = {}
    blocks = defaultdict(list)
    for entry in dataset.entries:
        context = (entry['date'] or '', entry['source'], entry['reportDate'] or '', entry['archiveMonth'] or '',
                   entry['sheet'], compact_json(entry['meta']))
        blocks[context].append(entry)
        for value in entry['values'].values():
            if not NUMBER.fullmatch(value) and value not in enums:
                enums[value] = len(enums)
    stream = io.StringIO(newline='')
    writer = csv.writer(stream, lineterminator='\n')
    writer.writerow(['Date', 'Type', 'Key', 'Data'])
    observation_count = sum(len(entry['values']) for entry in dataset.entries)
    metadata = {'schemaVersion': VERSION, 'kind': 'public-share-history', 'listings': len(identifiers),
                'sources': len(dataset.sources), 'rows': len(dataset.entries), 'observations': observation_count,
                'cautions': list(dict.fromkeys(dataset.cautions)), 'deduplicated': dataset.deduplicated,
                'conflicts': dataset.conflicts}
    writer.writerow(['', 'V', VERSION, compact_json(metadata)])
    for sid, source in sorted(dataset.sources.items()):
        writer.writerow(['', 'S', sid, compact_json(source)])
    for key, number in identifiers.items():
        writer.writerow(['', 'I', number, compact_json(dataset.listings[key])])
    for value, number in enums.items():
        writer.writerow(['', 'E', number, compact_json(value)])
    for context in sorted(blocks):
        date, source, report, month, sheet, meta = context
        entries = blocks[context]
        metrics = sorted({metric for entry in entries for metric in entry['values']})
        writer.writerow([date, 'D', source, compact_json({'reportDate': report or None, 'archiveMonth': month or None,
                         'sheet': sheet, 'metrics': metrics, 'meta': json.loads(meta)})])
        for entry in sorted(entries, key=lambda row: (identifiers[row['id']], row['page'], row['row'], row['column'])):
            values = []
            for metric in metrics:
                value = entry['values'].get(metric, '')
                values.append('@' + str(enums[value]) if value and not NUMBER.fullmatch(value) else value)
            # Trailing empty metric cells carry no information and are reconstructed.
            while values and values[-1] == '':
                values.pop()
            writer.writerow(['', 'O', identifiers[entry['id']], entry['page'], entry['row'], entry['column'], *values])
    body = stream.getvalue().encode('utf-8')
    writer.writerow(['', 'Z', len(dataset.entries), observation_count, len(identifiers), len(dataset.sources), hashlib.sha256(body).hexdigest()])
    return stream.getvalue().encode('utf-8'), metadata


def build(args):
    dataset = Dataset()
    audit = read_bos(args.bos_dir, dataset)
    if args.additional_json:
        add_helper(dataset, json.loads(args.additional_json.read_text(encoding='utf-8-sig')))
    elif args.global_xlsx or args.october_xlsx or args.september_csv:
        from share_history_sources import extract_sources
        add_helper(dataset, extract_sources(args.global_xlsx, args.october_xlsx, args.september_csv))
    if args.selected_history:
        add_selected_history(dataset, args.selected_history)
    raw, metadata = encode_csv(dataset)
    compressed = gzip.compress(raw, compresslevel=9, mtime=0)
    for path in (args.output, args.site_output):
        if path:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(raw)
    if args.site_output:
        args.site_output.with_suffix('.csv.gz').write_bytes(compressed)
    audit.update(metadata=metadata, csvBytes=len(raw), gzipBytes=len(compressed), sha256=hashlib.sha256(raw).hexdigest())
    if args.audit:
        args.audit.parent.mkdir(parents=True, exist_ok=True)
        args.audit.write_text(json.dumps(audit, indent=2, ensure_ascii=False), encoding='utf-8')
    return {key: value for key, value in audit.items() if key != 'metadata'} | {'listings': metadata['listings'], 'observations': metadata['observations']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bos-dir', required=True, type=Path)
    for name in ('global-xlsx', 'october-xlsx', 'september-csv', 'additional-json', 'selected-history', 'site-output', 'audit'):
        parser.add_argument('--' + name, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    print(json.dumps(build(parser.parse_args()), indent=2))


if __name__ == '__main__':
    main()
