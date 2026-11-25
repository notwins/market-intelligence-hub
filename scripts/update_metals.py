"""Refresh the Hub's metal histories and keep immutable provider files in the owner's archive."""
import argparse
import csv
import hashlib
import io
import json
import os
import subprocess
import tempfile
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

PUBLIC = Path(__file__).resolve().parents[1] / 'site/data/metals'
FRED = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DEXSIUS'
SPOT = 'https://fairfindr.com/data/spot-prices.csv'
CHART = 'https://query1.finance.yahoo.com/v8/finance/chart/'
OHLC = ['open', 'high', 'low', 'close']


def atomic(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.read_bytes() == data:
        return
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as tmp:
        tmp.write(data)
    os.replace(tmp.name, path)


def fetch(url, label, folder):
    options = ['--user-agent', 'Mozilla/5.0'] if url.startswith(CHART) else []
    raw = subprocess.check_output(['curl', '--fail', '--silent', '--show-error', '--location',
                                   '--max-time', '20', '--retry', '2', *options, url])
    digest = hashlib.sha256(raw).hexdigest()[:12]
    name = Path(label)
    atomic(folder / 'source-snapshots' / f'{name.stem}-{digest}{name.suffix}', raw)
    return raw


def price(value):
    v = Decimal(str(value))
    if not v.is_finite() or v <= 0:
        raise ValueError(f'Unexpected market price {value}')
    return v


def market_series(raw, ticker, cutoff):
    data = json.loads(raw)['chart']['result'][0]
    if data['meta']['symbol'] != ticker or data['meta']['currency'] != 'USD':
        raise ValueError('Unexpected symbol or currency')
    quote = data['indicators']['quote'][0]
    rows = {}
    for i, ts in enumerate(data['timestamp']):
        day = datetime.fromtimestamp(ts, timezone.utc).date()
        if day >= cutoff:
            continue
        values = [quote[k][i] for k in OHLC]
        if all(v is None for v in values):
            continue
        prices = [price(v).quantize(Decimal('.01')) for v in values]
        if min(prices) != prices[2] or max(prices) != prices[1]:
            raise ValueError(f'Invalid {ticker} OHLC on {day}')
        if ticker == 'GLD':
            volume = quote['volume'][i]
            if not isinstance(volume, int) or volume < 0:
                raise ValueError(f'Invalid volume on {day}')
            prices.append(volume)
        rows[day.isoformat()] = prices
    return rows


def table(raw):
    return csv.DictReader(io.StringIO(raw.decode('utf-8-sig')), skipinitialspace=True)


def merged(name, columns, additions):
    rows = {}
    path = PUBLIC / name
    if path.exists():
        for row in table(path.read_bytes()):
            rows[row['date']] = [row[c] for c in columns]
    rows.update(additions)
    if not rows:
        raise ValueError('Empty series: ' + name)
    stream = io.StringIO()
    writer = csv.writer(stream, lineterminator='\n')
    writer.writerow(['date', *columns])
    writer.writerows([d, *rows[d]] for d in sorted(rows))
    return stream.getvalue().encode()


def refresh(folder):
    # At the scheduled Singapore morning run, yesterday UTC is a completed US session.
    cutoff = datetime.now(timezone.utc).date()
    seed = {}
    for r in table((folder / 'HistoricalPrices.csv').read_bytes()):
        day = datetime.strptime(r['Date'], '%m/%d/%y').date().isoformat()
        seed[day] = [price(r[k.title()]) for k in OHLC]
    first, last = min(seed), max(seed)
    if len(seed) < 9000 or first != '1990-08-27':
        raise ValueError('Expected the original WSJ XAU index archive')
    # Refetch from the end of the unchanged source file, including any missed runs.
    since = int(datetime.fromisoformat(last).replace(tzinfo=timezone.utc).timestamp())
    until = int(datetime.combine(cutoff + timedelta(days=1), datetime.min.time(), timezone.utc).timestamp())
    extra = market_series(fetch(f'{CHART}%5EXAU?period1={since}&period2={until}&interval=1d', 'XAU-index.json', folder), '^XAU', cutoff)
    if last not in extra or abs(extra[last][3] - seed[last][3]) > Decimal('.05'):
        raise ValueError('Index feed does not match the seed closing observation')
    seed.update({d: v for d, v in extra.items() if d > last})
    gld = market_series(fetch(CHART + 'GLD?range=20y&interval=1d', 'GLD.json', folder), 'GLD', cutoff)
    if len(gld) < 4900 or date.fromisoformat(min(gld)) > cutoff - timedelta(days=7250):
        raise ValueError('GLD feed returned an incomplete twenty-year window')
    fx = {r['observation_date']: price(r['DEXSIUS']) for r in table(fetch(FRED, 'DEXSIUS.csv', folder))
          if r['DEXSIUS'] not in ('', '.') and r['observation_date'] < cutoff.isoformat()}
    spot = {r['date_utc']: price(r['close_usd_per_troy_oz']) for r in table(fetch(SPOT, 'spot-prices.csv', folder))
            if r['symbol'] == 'XAU' and r['date_utc'] < cutoff.isoformat()}
    if not spot or not fx or not (spot.keys() & fx.keys()):
        raise ValueError('Missing overlapping spot and FX observations')
    outputs = {
        'xau-index.csv': merged('xau-index.csv', OHLC, seed),
        'gld.csv': merged('gld.csv', OHLC + ['volume'], gld),
        'dexsius.csv': merged('dexsius.csv', ['sgd_per_usd'], {d: [r] for d, r in fx.items()}),
    }
    # Rejoin all preserved observations, including FRED releases arriving after the gold close.
    historical = PUBLIC / 'xau-spot.csv'
    if historical.exists():
        spot = {**{r['date']: price(r['usd_per_oz']) for r in table(historical.read_bytes())}, **spot}
    fx = {r['date']: price(r['sgd_per_usd']) for r in table(outputs['dexsius.csv'])}
    derived = {d: [v, fx[d], v * fx[d]] if d in fx else [v, '', ''] for d, v in spot.items()}
    outputs['xau-spot.csv'] = merged('xau-spot.csv', ['usd_per_oz', 'sgd_per_usd', 'sgd_per_oz'], derived)
    for name, data in outputs.items():
        atomic(folder / name, data)
        atomic(PUBLIC / name, data)
        records = list(table(data))
        print(f"{name}: {len(records)} observations, {records[0]['date']} through {records[-1]['date']}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', required=True, type=Path)
    refresh(parser.parse_args().archive)
