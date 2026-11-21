"""Key-free, on-demand FRED FX and US constant-maturity yield feed.

Run this script to retrieve provider observations, not trading quotes. The
monthly workbook/history contract and the separate MAS pipeline are untouched.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import csv
from datetime import date, datetime, timezone
import hashlib
import io
import json
import math
from pathlib import Path

from update_fed_history import atomic_json, download_group, encode, read_json

DATA = Path(__file__).resolve().parents[1] / 'site' / 'data'
START = '1995-01-01'
FX = {'AUD/USD': 'DEXUSAL', 'EUR/USD': 'DEXUSEU', 'NZD/USD': 'DEXUSNZ',
      'GBP/USD': 'DEXUSUK', 'USD/CNY': 'DEXCHUS', 'USD/HKD': 'DEXHKUS',
      'USD/JPY': 'DEXJPUS', 'USD/MYR': 'DEXMAUS', 'USD/SGD': 'DEXSIUS',
      'USD/CHF': 'DEXSZUS'}
YIELDS = {'UST ' + term: 'DGS' + code for term, code in
          [('1M', '1MO'), ('3M', '3MO'), ('6M', '6MO'), ('1Y', '1'),
           ('2Y', '2'), ('3Y', '3'), ('5Y', '5'), ('7Y', '7'),
           ('10Y', '10'), ('20Y', '20'), ('30Y', '30')]}
MAPPING = {**FX, **YIELDS}
CROSSES = {'CHF/SGD': ('USD/SGD', 'USD/CHF', '/'),
           'SGD/JPY': ('USD/JPY', 'USD/SGD', '/'),
           'AUD/SGD': ('AUD/USD', 'USD/SGD', '*'),
           'SGD/MYR': ('USD/MYR', 'USD/SGD', '/')}


def parse_group(text, codes, today, fx_codes=FX.values()):
    reader = csv.DictReader(io.StringIO(text.lstrip('\ufeff')))
    if reader.fieldnames != ['observation_date', *codes]:
        raise ValueError('Unexpected FRED daily columns')
    result = {code: {} for code in codes}
    previous = ''
    fx_codes = set(fx_codes)
    for row in reader:
        day = row['observation_date']
        observed = date.fromisoformat(day)
        if observed.isoformat() != day or day <= previous or None in row or any(v is None for v in row.values()):
            raise ValueError('Duplicate, unordered or incomplete daily observation')
        previous = day
        if day < START or observed > today:
            continue
        for code in codes:
            raw = row[code].strip()
            value = None if raw in ('', '.') else float(raw)
            if value is not None and (not math.isfinite(value) or
                    (code in fx_codes and value <= 0) or
                    (code not in fx_codes and not -10 <= value <= 100)):
                raise ValueError('Invalid provider value: ' + code)
            result[code][day] = value
    return result


def make_series(raw, today):
    result = []
    for name, code in MAPPING.items():
        values = raw[code]
        good = [[day, value] for day, value in sorted(values.items()) if value is not None]
        if len(good) < 25 or (today - date.fromisoformat(good[-1][0])).days > 21:
            raise ValueError('Insufficient or stale daily history: ' + code)
        fx = name in FX
        result.append({'id': name, 'family': 'fx' if fx else 'ust',
                       'unit': name.split('/')[1] + ' per ' + name.split('/')[0] if fx else '% p.a.',
                       'frequency': 'daily', 'derived': False, 'provider_series': code,
                       'source_url': 'https://fred.stlouisfed.org/series/' + code,
                       'source': 'Federal Reserve Board via FRED, Federal Reserve Bank of St. Louis',
                       'release': 'H.10 Foreign Exchange Rates' if fx else 'H.15 Selected Interest Rates',
                       'basis': 'New York noon buying rate; weekly H.10 publication' if fx else
                                'Treasury constant-maturity market yield, quoted on an investment basis; not a bill discount yield, coupon or auction result',
                       'license': 'Public Domain: Citation Requested',
                       'points': good,
                       'missing_periods': [day for day, value in sorted(values.items()) if value is None and day >= good[0][0]],
                       'latest_observation': good[-1][0]})
    by_id = {s['id']: s for s in result}
    for name, (a, b, op) in CROSSES.items():
        left, right = dict(by_id[a]['points']), dict(by_id[b]['points'])
        common = sorted(left.keys() & right.keys())
        calendar = sorted(set(raw[MAPPING[a]]) | set(raw[MAPPING[b]]))
        formula = a + (' divided by ' if op == '/' else ' multiplied by ') + b
        result.append({'id': name, 'family': 'fx', 'unit': name.split('/')[1] + ' per ' + name.split('/')[0],
                       'frequency': 'daily', 'derived': True, 'formula': formula,
                       'basis': 'Same-date unrounded daily reference rates; no forward filling or interpolation',
                       'source': 'Calculated from Federal Reserve observations retrieved via FRED',
                       'source_urls': [by_id[a]['source_url'], by_id[b]['source_url']],
                       'provider_series': [MAPPING[a], MAPPING[b]],
                       'points': [[day, left[day] / right[day] if op == '/' else left[day] * right[day]] for day in common],
                       'missing_periods': [day for day in calendar if day >= common[0] and day not in left.keys() & right.keys()],
                       'latest_observation': common[-1]})
    return result


def changes_since(old, series):
    changes = []
    if not old:
        return changes
    previous = {s['id']: s for s in old['series']}
    if previous.keys() != {s['id'] for s in series}:
        raise ValueError('Daily series mapping changed; review required')
    for s in series:
        before, after = dict(previous[s['id']]['points']), dict(s['points'])
        if min(after) > min(before) or max(after) < max(before):
            raise ValueError('Provider coverage regressed: ' + s['id'])
        for day in sorted(before.keys() | set(previous[s['id']].get('missing_periods', []))):
            if before.get(day) != after.get(day):
                changes.append({'series': s['id'], 'date': day, 'previous': before.get(day), 'current': after.get(day)})
    return changes


def refresh(data_dir=DATA, fetch=download_group, now=None):
    now = now or datetime.now(timezone.utc)
    stamp = now.isoformat().replace('+00:00', 'Z')
    data_dir = Path(data_dir)
    current, status_path = data_dir / 'fred-daily.json', data_dir / 'fred-daily-status.json'
    old, status = read_json(current), read_json(status_path, {})
    try:
        codes = list(MAPPING.values())
        groups = [codes[i:i + 5] for i in range(0, len(codes), 5)]
        # Bounded concurrency; no credentials, API keys or account changes.
        with ThreadPoolExecutor(max_workers=3) as pool:
            payloads = list(pool.map(fetch, groups))
        raw = {}
        receipts = []
        for group, payload in zip(groups, payloads):
            raw.update(parse_group(payload, group, now.date()))
            receipts.append({'series': group, 'sha256': hashlib.sha256(payload.encode('utf-8')).hexdigest()})
        series = make_series(raw, now.date())
        revisions = changes_since(old, series)
        digest = hashlib.sha256(encode(series)).hexdigest()
        dataset = {'schemaVersion': 1, 'contractVersion': 'fred-daily/1.0.0',
                   'id': 'fred-daily-' + digest[:16], 'status': 'provider_snapshot',
                   'source_file': 'Daily Federal Reserve FX and Treasury yields retrieved from FRED CSV',
                   'verified_provider_refresh': True, 'frequency': 'daily', 'retrieved_at': stamp,
                   'sha256': digest, 'series': series, 'raw_downloads': receipts,
                   'archive_path': 'fred-daily-archive/' + digest + '.json',
                   'missing_data_policy': 'Provider blanks remain gaps; derived crosses require both legs on the identical date. No zeros, carry-forward or interpolation.',
                   'publication_cadence': {'fx': 'H.10 daily observations, published weekly Monday 16:15 US Eastern',
                                           'ust': 'H.15 published business days 16:15 US Eastern; source holidays and delays apply'},
                   'retrieval_cadence': 'On demand, plus the existing Saturday 06:17 UTC Fed job; retrieval is not an intraday quote service'}
        archive = data_dir / dataset['archive_path']
        if not archive.exists():
            atomic_json(archive, dataset)
        atomic_json(current, dataset)
        latest = {**{key: value for key, value in dataset.items() if key not in ('series', 'raw_downloads')},
                  'series': [{**{k: v for k, v in s.items() if k not in ('points', 'missing_periods')},
                              'date': s['points'][-1][0], 'value': s['points'][-1][1]} for s in series]}
        atomic_json(data_dir / 'fred-latest.json', latest)
        atomic_json(status_path, {'status': 'success', 'last_attempt': stamp, 'last_success': stamp,
                                 'dataset_id': dataset['id'], 'revision_count': len(revisions),
                                 'revisions': revisions,
                                 'series_latest': {s['id']: s['latest_observation'] for s in series}})
        return dataset
    except Exception as error:
        atomic_json(status_path, {**status, 'status': 'failed', 'last_attempt': stamp,
                                 'error_type': type(error).__name__,
                                 'message': 'FRED daily refresh failed; previous published observations retained.'})
        raise


def export_rows(dataset, path, selected=None, start=START, end=None):
    selected = selected or [s['id'] for s in dataset['series']]
    known = {s['id']: s for s in dataset['series']}
    if any(name not in known for name in selected):
        raise ValueError('Unknown series; use --list-series')
    with Path(path).open('w', encoding='utf-8', newline='') as stream:
        writer = csv.writer(stream)
        writer.writerow(['series', 'observation_date', 'value', 'unit', 'derived', 'retrieved_at'])
        for name in selected:
            s = known[name]
            for day, value in s['points']:
                if start <= day <= (end or '9999-12-31'):
                    writer.writerow([name, day, value, s['unit'], s['derived'], dataset['retrieved_at']])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-dir', type=Path, default=DATA)
    parser.add_argument('--list-series', action='store_true')
    parser.add_argument('--saved', action='store_true', help='Export last saved history without contacting FRED')
    parser.add_argument('--series', action='append', help='Repeat for each exact pair or UST tenor')
    parser.add_argument('--start', default=START)
    parser.add_argument('--end')
    parser.add_argument('--csv', type=Path, help='Optional tidy historical export for prompts, Excel or analysis')
    args = parser.parse_args()
    if args.list_series:
        print('\n'.join([*MAPPING, *CROSSES]))
        return
    for day in (args.start, args.end):
        if day and date.fromisoformat(day).isoformat() != day:
            parser.error('Dates must use YYYY-MM-DD')
    if args.end and args.start > args.end:
        parser.error('--start must not be later than --end')
    if args.series and any(name not in {**MAPPING, **CROSSES} for name in args.series):
        parser.error('Unknown series; use --list-series')
    dataset = read_json(args.data_dir / 'fred-daily.json') if args.saved else refresh(args.data_dir)
    if not dataset:
        parser.error('No saved daily dataset')
    if args.csv:
        export_rows(dataset, args.csv, args.series, args.start, args.end)
    print(json.dumps({'id': dataset['id'], 'retrieved_at': dataset['retrieved_at'],
                      'latest': {s['id']: s['latest_observation'] for s in dataset['series']},
                      'csv': str(args.csv) if args.csv else None}))


if __name__ == '__main__':
    main()
