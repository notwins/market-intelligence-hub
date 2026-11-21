"""Publish Friday-ending Treasury and FX observations from daily FRED data."""
import argparse
import csv
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
import os
from pathlib import Path

from update_fed_history import atomic_json, download_group, read_json
from update_fred_daily import CROSSES, DATA, FX, START, YIELDS, parse_group

SOURCE = 'Board of Governors of the Federal Reserve System (US), via FRED, Federal Reserve Bank of St. Louis'
TIPS = {f'TIPS {years}Y': f'DFII{years}' for years in (5, 7, 10, 20, 30)}
FX_PAIRS = dict(sorted({
    **FX, 'USD/BRL': 'DEXBZUS', 'USD/CAD': 'DEXCAUS', 'USD/DKK': 'DEXDNUS',
    'USD/INR': 'DEXINUS', 'USD/MXN': 'DEXMXUS', 'USD/NOK': 'DEXNOUS',
    'USD/ZAR': 'DEXSFUS', 'USD/KRW': 'DEXKOUS', 'USD/LKR': 'DEXSLUS',
    'USD/SEK': 'DEXSDUS', 'USD/TWD': 'DEXTAUS', 'USD/THB': 'DEXTHUS',
    'USD/VES': 'DEXVZUS',
}.items()))


def series_url(code):
    return 'https://fred.stlouisfed.org/series/' + code


def columns(family):
    if family == 'yields':
        return [
            {'id': name, 'provider_series': code, 'source_url': series_url(code),
             'kind': 'nominal' if name in YIELDS else 'real', 'unit': '% p.a.'}
            for name, code in {**YIELDS, **TIPS}.items()
        ]
    result = [
        {'id': pair, 'provider_series': code, 'source_url': series_url(code),
         'unit': f'{pair[4:]} per {pair[:3]}'}
        for pair, code in FX_PAIRS.items()
    ]
    next(column for column in result if column['id'] == 'USD/VES')['note'] = (
        'FRED publishes bolivar redenominations in this series. See the source series notes.'
    )
    for pair, (left, right, op) in CROSSES.items():
        result.append({'id': pair, 'unit': f'{pair[4:]} per {pair[:3]}',
                       'source_urls': [series_url(FX_PAIRS[left]), series_url(FX_PAIRS[right])],
                       'formula': f'{left} {op} {right}'})
    return result


def observations(family, raw, first, end):
    anchor = 'DGS10' if family == 'yields' else 'DEXSIUS'
    first_friday = first + timedelta(days=(4 - first.weekday()) % 7)
    fridays = {}
    for observed, value in sorted(raw[anchor].items()):
        if value is None:
            continue
        day = date.fromisoformat(observed)
        friday = day + timedelta(days=(4 - day.weekday()) % 7)
        if first_friday <= friday <= end and first <= day and day.weekday() < 5:
            fridays[friday] = observed
    codes = [column['provider_series'] for column in columns(family) if 'provider_series' in column]
    result = []
    for friday, observed in sorted(fridays.items()):
        values = [raw[code].get(observed) for code in codes]
        if family == 'fx':
            rates = dict(zip(FX_PAIRS, values))
            for left, right, op in CROSSES.values():
                a, b = rates[left], rates[right]
                values.append(None if a is None or b is None else a / b if op == '/' else a * b)
        result.append({'week_ending': friday.isoformat(), 'date': observed, 'values': values})
    return result


def validate(rows, old, first, end, specs):
    if len(rows) < 1500 or (end - date.fromisoformat(rows[-1]['week_ending'])).days > 7:
        raise ValueError('FRED history is incomplete or more than one week behind')
    for i, spec in enumerate(specs):
        available = [row for row in rows if row['values'][i] is not None]
        if len(available) < 25 or (end - date.fromisoformat(available[-1]['week_ending'])).days > 14:
            raise ValueError(f'Insufficient or stale weekly history for {spec["id"]}')
    by_week = {row['week_ending']: row for row in rows}
    for prior in (old or {}).get('observations', []):
        if prior['date'] < first.isoformat():
            continue
        current = by_week.get(prior['week_ending'])
        if current is None or current['date'] < prior['date'] or any(
            before is not None and after is None
            for before, after in zip(prior['values'], current['values'])
        ):
            raise ValueError('FRED coverage regressed on ' + prior['week_ending'])


def refresh(family, output, today, fetch=download_group):
    anniversary = today - timedelta(days=1) if (today.month, today.day) == (2, 29) else today
    first = anniversary.replace(year=today.year - 30)
    # Bonds BETA also serves older matured issues whose chart already starts in 1995.
    chart_start = min(first, date.fromisoformat(START)) if family == 'yields' else first
    previous_day = today - timedelta(days=1)
    end = previous_day - timedelta(days=(previous_day.weekday() - 4) % 7)
    specs = columns(family)
    codes = [column['provider_series'] for column in specs if 'provider_series' in column]
    groups = [codes[i:i + 5] for i in range(0, len(codes), 5)]
    raw = {}
    with ThreadPoolExecutor(max_workers=3) as pool:
        for group, payload in zip(groups, pool.map(fetch, groups)):
            raw.update(parse_group(payload, group, today, fx_codes=FX_PAIRS.values()))
    rows = observations(family, raw, chart_start, end)
    path = output / f'fred-weekly-{family}.json'
    old = read_json(path)
    validate(rows, old, chart_start, end, specs)
    result = {
        'schema_version': 1, 'frequency': 'weekly', 'source': SOURCE,
        'release': 'H.15 Selected Interest Rates' if family == 'yields' else 'H.10 Foreign Exchange Rates',
        'basis': 'Last available benchmark observation in each Friday-ending week. All values in a row share one source date. Empty cells are unavailable.',
        'anchor': 'DGS10' if family == 'yields' else 'DEXSIUS',
        'columns': specs, 'observations': rows,
    }
    if family == 'fx':
        result['basis'] += ' H.10 rates are New York noon reference rates.'
    if not old or any(old.get(key) != value for key, value in result.items()):
        result['retrieved_at'] = datetime.now(timezone.utc).isoformat(timespec='seconds')
        atomic_json(path, result)
    rows = [row for row in rows if row['date'] >= first.isoformat()]
    csv_path = path.with_suffix('.csv')
    temp = csv_path.with_suffix('.csv.tmp')
    with temp.open('w', encoding='utf-8', newline='') as handle:
        writer = csv.writer(handle, lineterminator='\n')
        writer.writerow(['week_ending', 'observation_date', *[c['id'] for c in specs]])
        writer.writerows([row['week_ending'], row['date'], *row['values']] for row in rows)
    if csv_path.exists() and csv_path.read_bytes() == temp.read_bytes():
        temp.unlink()
    else:
        os.replace(temp, csv_path)
    print(f'{family}: {len(rows)} weeks, {rows[0]["week_ending"]} to {rows[-1]["week_ending"]} (last observation {rows[-1]["date"]})')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=DATA)
    parser.add_argument('--as-of', type=date.fromisoformat, default=datetime.now(timezone.utc).date())
    args = parser.parse_args()
    failures = []
    for name in ('yields', 'fx'):
        try:
            refresh(name, args.output, args.as_of)
        except (OSError, ValueError) as error:
            failures.append(name)
            print(f'{name}: refresh failed. {error}')
    raise SystemExit(bool(failures))
