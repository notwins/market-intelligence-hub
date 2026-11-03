"""Weekly, key-free FRED CSV refresh of explicitly mapped monthly Fed series.

Only public provider observations are published. The supplied workbook is never edited.
"""
import csv
import hashlib
import io
import json
import math
import os
from pathlib import Path
import sys
import time
from datetime import date, datetime, timezone
from urllib.parse import urlencode
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'site' / 'data'
START = '1995-01-01'
FX = {'AUD/USD': 'EXUSAL', 'EUR/USD': 'EXUSEU', 'NZD/USD': 'EXUSNZ',
      'GBP/USD': 'EXUSUK', 'USD/CNY': 'EXCHUS', 'USD/HKD': 'EXHKUS',
      'USD/JPY': 'EXJPUS', 'USD/MYR': 'EXMAUS', 'USD/SGD': 'EXSIUS',
      'USD/CHF': 'EXSZUS'}
UST = {'UST ' + tenor: 'GS' + tenor.removesuffix('Y')
       for tenor in ['1M', '3M', '6M', '1Y', '2Y', '3Y', '5Y', '7Y', '10Y', '20Y', '30Y']}
MAPPING = {**FX, **UST}
CSV_BASE = 'https://fred.stlouisfed.org/graph/fredgraph.csv?'


def encode(value):
    return (json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n').encode('utf-8')


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_bytes(encode(value))
    os.replace(temp, path)


def read_json(path, default=None):
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else default


def months(first, last):
    current = date.fromisoformat(first)
    while current.isoformat() <= last:
        yield current.isoformat()
        current = date(current.year + (current.month == 12), current.month % 12 + 1, 1)


def parse_csv(text, today):
    reader = csv.DictReader(io.StringIO(text.lstrip('\ufeff')))
    if reader.fieldnames != ['observation_date', *MAPPING.values()]:
        raise ValueError('Unexpected FRED CSV columns; refusing to publish')
    found = {code: {} for code in MAPPING.values()}
    previous = ''
    cutoff = today.replace(day=1).isoformat()
    for row in reader:
        day = row['observation_date']
        parsed = date.fromisoformat(day)
        if parsed.day != 1 or day <= previous or None in row or any(v is None for v in row.values()):
            raise ValueError('Duplicate, unordered, non-monthly or incomplete FRED row')
        previous = day
        if day < START or day >= cutoff:  # Do not publish incomplete current-month values.
            continue
        for name, code in MAPPING.items():
            value = row[code].strip()
            if value in ('', '.'):
                found[code][day] = None
                continue
            number = float(value)
            if not math.isfinite(number) or (name in FX and number <= 0) or (name in UST and not -10 <= number <= 100):
                raise ValueError('Invalid value in ' + code)
            found[code][day] = number
    result = []
    for name, code in MAPPING.items():
        values = found[code]
        good = [[d, v] for d, v in values.items() if v is not None]
        if len(good) < 12:
            raise ValueError('Insufficient history in ' + code)
        first, last = good[0][0], good[-1][0]
        if (today - date.fromisoformat(last)).days > 100:
            raise ValueError('Provider observations too old in ' + code)
        # Include trailing provider blanks after the last available observation.
        missing = [d for d in months(first, max(values)) if values.get(d) is None]
        result.append({'id': name, 'family': 'fx' if name in FX else 'ust',
                       'unit': name.split('/')[1] + ' per ' + name.split('/')[0] if name in FX else '% p.a.',
                       'frequency': 'monthly', 'derived': False,
                       'provider_series': code, 'source_url': 'https://fred.stlouisfed.org/series/' + code,
                       'source': 'Board of Governors of the Federal Reserve System (US), via FRED, Federal Reserve Bank of St. Louis',
                       'release': 'G.5 Foreign Exchange Rates' if name in FX else 'H.15 Selected Interest Rates',
                       'aggregation': 'Average of available daily observations' if name in FX else 'Average of business days',
                       'seasonal_adjustment': 'Not seasonally adjusted',
                       'license': 'Public Domain: Citation Requested',
                       'points': good, 'missing_periods': missing,
                       'latest_observation': last})
    by_id = {s['id']: s for s in result}
    sgd, chf = by_id['USD/SGD'], by_id['USD/CHF']
    numerator, denominator = dict(sgd['points']), dict(chf['points'])
    common = sorted(numerator.keys() & denominator.keys())
    result.append({'id': 'CHF/SGD', 'family': 'fx', 'unit': 'SGD per CHF',
                   'frequency': 'monthly', 'derived': True,
                   'formula': 'USD/SGD divided by USD/CHF, on matching monthly periods',
                   'aggregation': 'Ratio of monthly averages; not an average of daily cross rates',
                   'source': 'Derived locally from Federal Reserve series EXSIUS and EXSZUS retrieved via FRED',
                   'source_urls': [sgd['source_url'], chf['source_url']],
                   'points': [[d, numerator[d] / denominator[d]] for d in common],
                   'missing_periods': [d for d in months(common[0], max(max(numerator), max(denominator))) if d not in common],
                   'latest_observation': common[-1]})
    return result


def revisions(old, series):
    changes = []
    if not old:
        return changes
    old_series = {s['id']: s for s in old['series']}
    if old_series.keys() != {s['id'] for s in series}:
        raise ValueError('Series mapping changed; manual review required')
    for s in series:
        before = old_series[s['id']]
        old_points, new_points = dict(before['points']), dict(s['points'])
        if min(new_points) > min(old_points) or max(new_points) < max(old_points):
            raise ValueError('Provider history regressed in ' + s['id'])
        dates = old_points.keys() | set(before.get('missing_periods', []))
        for day in sorted(dates):
            previous, current = old_points.get(day), new_points.get(day)
            if previous != current:
                changes.append({'series': s['id'], 'observation_period': day, 'old': previous, 'new': current})
    return changes


def download():
    # Small groups avoid FRED graph timeouts when combining many long series.
    codes = list(MAPPING.values())
    combined = {}
    for offset in range(0, len(codes), 5):
        group = codes[offset:offset + 5]
        text = download_group(group)
        reader = csv.DictReader(io.StringIO(text))
        if reader.fieldnames != ['observation_date', *group]:
            raise ValueError('Unexpected FRED download columns')
        seen = set()
        for row in reader:
            day = row['observation_date']
            if day in seen:
                raise ValueError('Duplicate provider observation period')
            seen.add(day)
            combined.setdefault(day, {}).update({code: row[code] for code in group})
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['observation_date', *codes])
    for day in sorted(combined):
        writer.writerow([day, *[combined[day].get(code, '') for code in codes]])
    return output.getvalue()


def download_group(codes):
    url = CSV_BASE + urlencode({'id': ','.join(codes)}, safe=',')
    for attempt in range(3):
        try:
            with urlopen(url, timeout=30) as response:
                payload = response.read(4_000_001)
            if len(payload) > 4_000_000:
                raise ValueError('FRED response exceeded size limit')
            return payload.decode('utf-8-sig')
        except (OSError, TimeoutError):
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)


def parse_recessions(text, today):
    reader = csv.DictReader(io.StringIO(text.lstrip('\ufeff')))
    if reader.fieldnames != ['observation_date', 'USREC']:
        raise ValueError('Unexpected recession indicator columns')
    periods, start, previous, last = [], None, '', None
    for row in reader:
        day, value = row['observation_date'], row['USREC']
        observed = date.fromisoformat(day)
        if observed.day != 1 or day <= previous or value not in ('0', '1'):
            raise ValueError('Invalid recession indicator')
        if previous:
            y, m = map(int, previous[:7].split('-'))
            if day != date(y + (m == 12), m % 12 + 1, 1).isoformat():
                raise ValueError('Missing recession indicator month; refusing inferred shading')
        previous = day
        if day < START or observed >= today.replace(day=1):
            continue
        last = day
        if value == '1' and start is None:
            start = day
        if value == '0' and start is not None:
            periods.append({'start': start, 'end_exclusive': day})
            start = None
    if last is None or (today - date.fromisoformat(last)).days > 100:
        raise ValueError('Recession indicator is stale or empty')
    if start:
        # Extend the last observed monthly block through its exclusive month end.
        y, m = map(int, last[:7].split('-'))
        periods.append({'start': start, 'end_exclusive': date(y + (m == 12), m % 12 + 1, 1).isoformat(), 'ongoing_as_of': last})
    return {'series': 'USREC', 'source': 'Federal Reserve Bank of St. Louis interpretation of NBER chronology, retrieved via FRED',
            'source_url': 'https://fred.stlouisfed.org/series/USREC',
            'chronology_url': 'https://www.nber.org/research/business-cycle-dating',
            'license': 'Copyrighted: Citation Required', 'latest_observation': last,
            'convention': 'First month following the peak through the trough month. End boundary is exclusive. NBER specifies months, not exact turning-point days.',
            'periods': periods}


def refresh(data_dir=DATA, fetch=download, now=None, recession_fetch=None):
    now = now or datetime.now(timezone.utc)
    stamp = now.isoformat(timespec='seconds').replace('+00:00', 'Z')
    current_path, status_path = data_dir / 'history-fed.json', data_dir / 'history-fed-status.json'
    status = read_json(status_path, {})
    try:
        old = read_json(current_path)
        series = parse_csv(fetch(), now.date())
        original = read_json(data_dir / 'history-v3.json')
        if original:
            originals = {s['id']: s for s in original['series']}
            for s in series:
                before = originals.get(s['id'])
                if before and (s['points'][0][0] > before['points'][0][0] or s['points'][-1][0] < before['points'][-1][0]):
                    raise ValueError('Provider coverage does not retain supplied history for ' + s['id'])
        recession_context = parse_recessions(recession_fetch(), now.date()) if recession_fetch else (old or {}).get('recession_context')
        changes = revisions(old, series)
        digest = hashlib.sha256(encode({'series': series, 'recession_context': recession_context})).hexdigest()
        dataset = {'schemaVersion': 1, 'contractVersion': 'market-history-series/1.0.0', 'id': 'fed-monthly-' + digest[:16],
                   'status': 'provider_snapshot', 'verified_provider_refresh': True,
                   'source_file': 'Federal Reserve monthly releases retrieved via FRED CSV download',
                   'frequency': 'monthly', 'refresh_frequency': 'weekly',
                   'period_label': 'Completed monthly observation periods; date denotes first day of month, not quote time',
                   'retrieved_at': stamp, 'sha256': digest, 'series': series,
                   'recession_context': recession_context,
                   'revision_count_this_refresh': len(changes),
                   'revisions_this_refresh': changes,
                   'original_workbook': 'history-v3.json',
                   'missing_data_policy': 'Missing values excluded from points and listed in missing_periods; never replaced with zero or forward-filled',
                   'archive_path': 'history-fed-archive/' + digest + '.json'}
        archive = data_dir / dataset['archive_path']
        if not archive.exists():
            atomic_json(archive, dataset)
        atomic_json(current_path, dataset)
        atomic_json(status_path, {'status': 'success', 'last_attempt': stamp, 'last_success': stamp,
                                 'schedule': 'Saturday 06:17 UTC; GitHub may delay scheduled runs',
                                 'dataset_id': dataset['id'], 'revision_count': len(changes),
                                 'series_latest': {s['id']: s['latest_observation'] for s in series}})
        return dataset
    except Exception as error:
        # Never overwrite the last good dataset when any provider series fails validation.
        atomic_json(status_path, {**status, 'status': 'failed', 'last_attempt': stamp,
                                 'message': 'Fed history refresh failed; previous published observations retained.',
                                 'error_type': type(error).__name__})
        raise


if __name__ == '__main__':
    try:
        dataset = refresh(recession_fetch=lambda: download_group(['USREC']))
        print('Validated', len(dataset['series']), 'monthly series;', dataset['revision_count_this_refresh'], 'revisions')
    except Exception as error:
        print('Fed history update failed:', type(error).__name__, str(error), file=sys.stderr)
        sys.exit(1)
