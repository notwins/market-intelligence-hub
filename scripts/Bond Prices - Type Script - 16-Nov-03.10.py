"""Fetch only the owner's bond shortlist; preserve source dates and all accepted prices."""
import argparse
import copy
import datetime as dt
import hashlib
import json
import math
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = Path('site/data/Bond Prices - Type JSON - 16-Nov-03.10.json')
WSJ_CURVE = Path('site/data/wsj-treasury-dashboard.json')
WSJ = 'https://www.wsj.com/market-data/bonds/treasuries'
BSM = 'https://www.bondsupermart.com/bsm/bond-factsheet/'
API = 'https://www.bondsupermart.com/main/ws/v4/bond-info/bond-factsheet/'
UTC = dt.timezone.utc
SGT = dt.timezone(dt.timedelta(hours=8))
# Exact identities checked against the linked factsheets, not ticker resemblance.
EXTRA = [
    ('US87973RAW07', 'US87973RAW07', 'Temasek Financial (I)', 'USD', 2.5, '2070-10-06'),
    ('AU000XCLWAP3', 'AU000XCLWAP3', 'Australia Government', 'AUD', 3.25, '2039-06-21'),
    ('NC22300W', 'SGXF47639806', 'Singapore Government', 'SGD', 3, '2072-08-01'),
    ('NZ13100V', 'SG3261987691', 'Singapore Government', 'SGD', 3.375, '2033-09-01'),
    ('NX24100T', 'SGXF75438295', 'Singapore Government', 'SGD', 3.375, '2034-05-01'),
]


def encode(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()


def digest(value):
    return hashlib.sha256(value if isinstance(value, bytes) else encode(value)).hexdigest()


def stamp(value):
    return value.astimezone(UTC).isoformat(timespec='seconds').replace('+00:00', 'Z')


def number(value, low, high):
    if isinstance(value, bool) or value is None or str(value).strip() in ('', '-', '--'):
        raise ValueError('Missing numeric field')
    value = float(value)
    if not math.isfinite(value) or not low <= value <= high:
        raise ValueError('Numeric field outside accepted bounds')
    return value


def treasury_price(value):
    # WSJ points + 32nds + eighths. E.g. 99.3040 = 99 + 30/32 + 4/256.
    value = str(value).strip()
    match = re.fullmatch(r'(\d{1,3})\.(\d{2})([0-7])0?', value)
    if not match or int(match[2]) > 31:
        raise ValueError('Invalid Treasury point/32nds/eighths notation')
    return number(int(match[1]) + int(match[2]) / 32 + int(match[3]) / 256, 0.001, 250)


def instruments(root=ROOT):
    saved = json.loads((root / 'site/data/default-bond-watchlist.json').read_text(encoding='utf-8'))
    result = [dict(id=r['isin'], isin=r['isin'], name=r['name'], currency=r['currency'],
                   coupon=r['coupon'], maturity=r['maturity'], source='WSJ', source_url=WSJ)
              for r in saved['rows'] if r['issuerType'] == 'ust']
    if len(result) != 29 or len({r['id'] for r in result}) != 29:
        raise ValueError('Reviewed UST shortlist changed; review the mapping before refreshing')
    for code, isin, issuer, currency, coupon, maturity in EXTRA:
        result.append(dict(id=code, isin=isin, name=f'{issuer} {coupon:g}% · {maturity}',
                           currency=currency, coupon=coupon, maturity=maturity,
                           source='Bondsupermart', source_url=BSM + code))
    return result


def fetch(url):
    # Public web endpoints used by the original pages. No login, cookies or bypass.
    request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Accept': '*/*'})
    with urllib.request.urlopen(request, timeout=40) as response:
        if response.status != 200 or response.url.split('?')[0] != url.split('?')[0]:
            raise ValueError('Unexpected source response/redirect')
        raw = response.read(12_000_001)
        if len(raw) > 12_000_000:
            raise ValueError('Source response too large')
        return raw


def checked_date(value, now):
    date = dt.date.fromisoformat(value)
    if date > now.astimezone(SGT).date() or date.year < 2000:
        raise ValueError('Invalid/future observation date')
    return date.isoformat()


def parse_wsj(raw, now, table='NOTES_AND_BONDS'):
    text = raw.decode('utf-8')
    start = re.search(r'window\.__STATE__\s*=\s*', text)
    if not start:
        raise ValueError('WSJ public state unavailable')
    state = json.JSONDecoder().raw_decode(text[start.end():])[0]
    matches = [v['data']['data'] for v in state.get('data', {}).values()
               if v.get('data', {}).get('type') == 'mdc_treasury'
               and json.loads(v['data']['id']).get('treasury') == table]
    if len(matches) != 1:
        raise ValueError('Missing/ambiguous WSJ Treasury table: ' + table)
    data = matches[0]
    date = checked_date(dt.datetime.strptime(data['timestamp'], '%A, %B %d, %Y').date().isoformat(), now)
    rows = data['instruments']
    if not isinstance(rows, list) or len(rows) < (100 if table == 'NOTES_AND_BONDS' else 10):
        raise ValueError('Incomplete Treasury source table')
    return date, rows


def wsj_match(row, quotes):
    found = [q for q in quotes
             if dt.datetime.strptime(q['maturityDate'], '%m/%d/%Y').date().isoformat() == row['maturity']
             and (row['coupon'] is None or number(q['coupon'], 0, 30) == row['coupon'])]
    if len(found) != 1:
        raise ValueError('Exact coupon/maturity match unavailable; no substitute bond used')
    return found[0]


def wsj_quote(row, date, quotes, raw, now):
    q = wsj_match(row, quotes)
    bid, ask = treasury_price(q['bid']), treasury_price(q['ask'])
    if bid > ask:
        raise ValueError('Crossed Treasury bid/ask')
    return dict(date=date, observed_at=date, time_precision='date_only', bid=bid, ask=ask,
                bid_raw=q['bid'], ask_raw=q['ask'], yield_pct=number(q['askYield'], -10, 100),
                yield_basis='Asked yield', source='WSJ', source_url=WSJ,
                source_sha256=digest(raw), retrieved_at=stamp(now))


def update_wsj_curve(path, raw, now, notes):
    if not path.exists():
        return
    curve = json.loads(path.read_text(encoding='utf-8'))
    previous = copy.deepcopy(curve)
    tables = {'note': notes, 'bond': notes} if notes else {}
    try:
        tables['bill'] = parse_wsj(raw, now, 'BILLS')
    except (ValueError, KeyError, TypeError):
        pass  # Keep the last correctly dated bill observations.
    for sample in curve['quotes']:
        prior_date = sample.get('quote_date', previous['as_of'])
        sample['quote_date'] = prior_date
        if sample['kind'] not in tables:
            continue
        day, rows = tables[sample['kind']]
        if day < prior_date or day >= sample['maturity']:
            continue
        identity = {'maturity': sample['maturity'], 'coupon': sample['coupon_percent']}
        try:
            if sample['kind'] == 'bill':
                quote = wsj_match(identity, rows)
                # The WSJ bill Bid/Asked fields are discount rates.
                values = {'asked_yield_percent': number(quote['askYield'], -10, 100)}
            else:
                quote = wsj_quote(identity, day, rows, raw, now)
                values = {'asked_yield_percent': quote['yield_pct'],
                          'bid_price': quote['bid'], 'ask_price': quote['ask']}
        except (ValueError, KeyError, TypeError):
            continue
        sample.update(values, quote_date=day)
    curve['as_of'] = max(row['quote_date'] for row in curve['quotes'])
    if curve != previous:
        curve['verified_on_sgt'] = now.astimezone(SGT).date().isoformat()
        temp = path.with_suffix('.tmp')
        temp.write_text(json.dumps(curve, ensure_ascii=False, indent=2, allow_nan=False) + '\n', encoding='utf-8', newline='\n')
        temp.replace(path)


def bsm_quote(row, raw, now):
    data = json.loads(raw)
    bond, q = data['bondFactSheetDisplay'], data['indicativeFullLotDisplay']
    maturity = dt.datetime.fromtimestamp(number(bond['maturityDate'], 0, 10**13) / 1000, SGT).date().isoformat()
    identity = (bond['issueCode'], bond['isin'], bond['bondCurrencyCode'], bond['couponRate'], maturity)
    if identity != (row['id'], row['isin'], row['currency'], row['coupon'], row['maturity']):
        raise ValueError('Bondsupermart issue/ISIN/currency/coupon/maturity mismatch')
    observed = dt.datetime.fromtimestamp(number(q['showDate'], 0, 10**13) / 1000, UTC)
    date = checked_date(observed.astimezone(SGT).date().isoformat(), now)
    if observed > now + dt.timedelta(minutes=10):
        raise ValueError('Future Bondsupermart quote timestamp')
    bid, ask = number(q['bidPrice'], 0.001, 300), number(q['askPrice'], 0.001, 300)
    if bid > ask:
        raise ValueError('Crossed Bondsupermart bid/ask')
    kind = q['yieldTypeToDisplay']
    if kind not in ('ytm', 'ytw'):
        raise ValueError('Unknown Bondsupermart yield measure')
    key = 'YldToMaturity' if kind == 'ytm' else 'YldToWorst'
    return dict(date=date, observed_at=stamp(observed), time_precision='second', bid=bid, ask=ask,
                yield_pct=number(q['bid' + key], -10, 100), ask_yield_pct=number(q['ask' + key], -10, 100),
                yield_basis='Bid yield to ' + ('maturity' if kind == 'ytm' else 'worst'),
                source='Bondsupermart', source_url=row['source_url'], data_url=API + row['id'],
                source_sha256=digest(raw), retrieved_at=stamp(now))


def accept(saved, row, quote):
    values = {k: v for k, v in quote.items() if k not in ('retrieved_at', 'source_sha256')}
    quote = dict(quote, observation_id=digest(values)[:24])
    history = saved['history'].setdefault(row['id'], [])
    latest = saved['latest'].get(row['id'])
    if latest and quote['observed_at'] < latest['observed_at']:
        raise ValueError('Source is older than the last accepted quote; saved quote retained')
    if any(p['observation_id'] == quote['observation_id'] for p in history):
        return False
    if latest and quote['observed_at'] == latest['observed_at']:
        quote['revision_of'] = latest['observation_id']
    history.append(quote)
    saved['latest'][row['id']] = quote
    return True


def validate(saved, rows):
    ids = {r['id'] for r in rows}
    if saved.get('schema_version') != 1 or saved.get('instruments') != rows:
        raise ValueError('Unsupported feed schema or changed instrument identities')
    if set(saved['history']) != ids or set(saved['latest']) - ids or set(saved['checks']) - ids:
        raise ValueError('Unknown/missing instrument in price feed')
    for row in rows:
        history = saved['history'][row['id']]
        if len({q['observation_id'] for q in history}) != len(history):
            raise ValueError('Duplicate price observations')
        if history and saved['latest'].get(row['id']) != history[-1]:
            raise ValueError('Latest quote/history mismatch')
        if not history and row['id'] in saved['latest']:
            raise ValueError('Latest quote lacks saved history')
        prior = ''
        for q in history:
            dt.date.fromisoformat(q['date'])
            observation_date = (q['observed_at'] if q['time_precision'] == 'date_only' else
                dt.datetime.fromisoformat(q['observed_at'].replace('Z', '+00:00')).astimezone(SGT).date().isoformat())
            if q['date'] != observation_date or q['observed_at'] < prior:
                raise ValueError('Price dates out of order')
            prior = q['observed_at']
            for key in ('bid', 'ask'):
                number(q[key], 0.001, 300)
            number(q['yield_pct'], -10, 100)
            if q['bid'] > q['ask'] or q['source_url'] != row['source_url'] or q['source'] != row['source']:
                raise ValueError('Invalid price/source attribution')
            if row['source'] == 'WSJ' and (treasury_price(q['bid_raw']) != q['bid'] or treasury_price(q['ask_raw']) != q['ask']):
                raise ValueError('Treasury quote conversion mismatch')
            identity = {k: v for k, v in q.items() if k not in ('retrieved_at', 'source_sha256', 'observation_id', 'revision_of')}
            if digest(identity)[:24] != q['observation_id'] or not re.fullmatch('[0-9a-f]{64}', q['source_sha256']):
                raise ValueError('Observation identity/provenance hash mismatch')
    return saved


def update(root=ROOT, now=None, get=fetch):
    now = now or dt.datetime.now(UTC)
    rows = instruments(root)
    path = root / DATA
    saved = json.loads(path.read_text(encoding='utf-8')) if path.exists() else dict(
        schema_version=1, instruments=rows, latest={}, history={r['id']: [] for r in rows}, checks={})
    validate(saved, rows)
    before = copy.deepcopy(saved)
    urls = [WSJ] + [API + r['id'] for r in rows if r['source'] == 'Bondsupermart']
    def request(url):
        try:
            return url, get(url), None
        except Exception as error:
            return url, None, type(error).__name__ + ': ' + str(error)[:150]
    with ThreadPoolExecutor(max_workers=4) as pool:
        sources = {url: (raw, error) for url, raw, error in pool.map(request, urls)}
    raw_wsj, error_wsj = sources[WSJ]
    if not error_wsj:
        try:
            wsj_date, wsj_rows = parse_wsj(raw_wsj, now)
        except Exception as error:
            error_wsj = str(error)
    for row in rows:
        try:
            if row['source'] == 'WSJ':
                if error_wsj:
                    raise ValueError(error_wsj)
                quote = wsj_quote(row, wsj_date, wsj_rows, raw_wsj, now)
            else:
                raw, error = sources[API + row['id']]
                if error:
                    raise ValueError(error)
                quote = bsm_quote(row, raw, now)
            added = accept(saved, row, quote)
            saved['checks'][row['id']] = dict(checked_at=stamp(now), status='ok',
                result='New source observation' if added else 'Source unchanged; actual quote date retained')
        except Exception as error:
            saved['checks'][row['id']] = dict(checked_at=stamp(now), status='unavailable', message=str(error)[:200])
    saved['checked_at'] = stamp(now)
    ok = sum(c['status'] == 'ok' for c in saved['checks'].values())
    saved['status'] = 'ok' if ok == len(rows) else 'partial' if ok else 'error'
    validate(saved, rows)
    if saved != before:
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_suffix('.tmp')
        temp.write_text(json.dumps(saved, ensure_ascii=False, indent=2, allow_nan=False) + '\n', encoding='utf-8')
        temp.replace(path)
    if raw_wsj:
        update_wsj_curve(root / WSJ_CURVE, raw_wsj, now, (wsj_date, wsj_rows) if not error_wsj else None)
    return saved


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--validate', action='store_true')
    args = parser.parse_args()
    result = validate(json.loads((ROOT / DATA).read_text(encoding='utf-8')), instruments()) if args.validate else update()
    print(json.dumps(dict(status=result['status'], checked_at=result['checked_at'],
        available=len(result['latest']), total=len(result['instruments']),
        observations=sum(len(v) for v in result['history'].values()),
        exceptions={k: v.get('message') for k, v in result['checks'].items() if v['status'] != 'ok'}), indent=2))
    if not args.validate and result['status'] == 'error':
        raise SystemExit(1)
