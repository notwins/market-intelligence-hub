"""Independent, append-preserving closing-price feed. No HTML build or deployment."""
import argparse
import concurrent.futures
import csv
import datetime as dt
import hashlib
import io
import json
import math
from pathlib import Path
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from zoneinfo import ZoneInfo

UTC = dt.timezone.utc
SGT = ZoneInfo('Asia/Singapore')
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
BASELINE_BASIS = 'source_close_not_total_return'
SUPPLEMENTS = [
    ('GOOGL', 'Alphabet Class A', 'Alphabet'), ('MRVL', 'Marvell Technology', 'Marvell'),
    ('NOW', 'ServiceNow', 'ServiceNow'), ('CRWV', 'CoreWeave', 'CoreWeave'),
    ('IREN', 'IREN', 'IREN'), ('TPR', 'Tapestry', 'Tapestry'),
    ('QCOM', 'Qualcomm', 'QUALCOMM'), ('ARM', 'Arm Holdings', 'Arm'),
    ('SMCI', 'Super Micro Computer', 'Super Micro Computer'), ('GD', 'General Dynamics', 'General Dynamics'),
    ('WDC', 'Western Digital', 'Western Digital'), ('CRM', 'Salesforce', 'Salesforce'),
    ('STX', 'Seagate Technology', 'Seagate'), ('HPE', 'Hewlett Packard Enterprise', 'Hewlett Packard Enterprise'),
    ('BX', 'Blackstone', 'Blackstone'), ('GLW', 'Corning', 'Corning'),
    ('INTU', 'Intuit', 'Intuit'), ('ISRG', 'Intuitive Surgical', 'Intuitive Surgical'),
    ('NOC', 'Northrop Grumman', 'Northrop Grumman'), ('MRNA', 'Moderna', 'Moderna'),
    ('FTNT', 'Fortinet', 'Fortinet'), ('COHR', 'Coherent', 'Coherent'),
    ('GDX', 'VanEck Gold Miners ETF', 'VanEck'), ('SMH', 'VanEck Semiconductor ETF', 'VanEck'),
    ('SNOW', 'Snowflake', 'Snowflake'), ('NET', 'Cloudflare', 'Cloudflare'),
    ('ELV', 'Elevance Health', 'Elevance'), ('CI', 'Cigna', 'Cigna'),
    ('COIN', 'Coinbase', 'Coinbase'), ('JD', 'JD.com ADR', 'JD.com'),
    ('KR', 'Kroger', 'Kroger'), ('NVO', 'Novo Nordisk ADR', 'Novo Nordisk'),
    ('OXY', 'Occidental Petroleum', 'Occidental'),
]


def dumps(value):
    return json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(',', ':'))


def load(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def write_snapshot(root, folder, stem, obj, now):
    raw = dumps(obj).encode('utf-8')
    stamp = now.astimezone(SGT).strftime('%d-%b')
    directory = root / folder / str(now.astimezone(SGT).year)
    directory.mkdir(parents=True, exist_ok=True)
    suffix = 1
    while True:
        revision = '' if suffix == 1 else f'_r{suffix:02}'
        path = directory / f'{stem}{revision}_{stamp}.json'
        if not path.exists():
            path.write_bytes(raw)
            break
        if path.read_bytes() == raw:
            break
        suffix += 1
    return {'path': path.relative_to(root).as_posix(), 'sha256': digest(raw), 'bytes': len(raw)}


def read_ref(root, ref):
    relative = ref['path']
    if not re.fullmatch(r'[-a-zA-Z0-9_/.]+', relative) or relative.startswith('/') or '..' in relative.split('/'):
        raise ValueError('Unsafe feed path')
    raw = (root / relative).read_bytes()
    if digest(raw) != ref['sha256']:
        raise ValueError(f'Hash mismatch: {relative}')
    return json.loads(raw)


def workbook_rows(path):
    """Read saved values only. Source document instructions are not executed."""
    result = {}
    with zipfile.ZipFile(path) as archive:
        shared = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            shared = [''.join(x.itertext()) for x in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('s:si', NS)]
        relationships = {x.attrib['Id']: x.attrib['Target'] for x in ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))}
        for sheet in ET.fromstring(archive.read('xl/workbook.xml')).findall('s:sheets/s:sheet', NS):
            if sheet.attrib['name'] not in ('stocks', 'daily', 'weekly', 'monthly'):
                continue
            target = relationships[sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
            target = target.lstrip('/') if target.startswith('/') else 'xl/' + target
            rows = []
            for row in ET.fromstring(archive.read(target)).findall('s:sheetData/s:row', NS):
                values = {}
                for cell in row:
                    value = cell.find('s:v', NS)
                    value = value.text if value is not None else None
                    if cell.attrib.get('t') == 's' and value is not None:
                        value = shared[int(value)]
                    elif cell.attrib.get('t') == 'inlineStr':
                        value = ''.join(cell.find('s:is', NS).itertext())
                    elif cell.attrib.get('t') == 'n' and value is not None:
                        value = float(value)
                    if value is not None:
                        values[re.sub(r'\d', '', cell.attrib['r'])] = value
                if values:
                    rows.append(values)
            result[sheet.attrib['name']] = rows
    return result


def valid_point(point, cutoff):
    return (isinstance(point, list) and len(point) == 2 and isinstance(point[0], str)
            and re.fullmatch(r'\d{4}-\d{2}-\d{2}', point[0])
            and dt.date.fromisoformat(point[0]) <= cutoff
            and isinstance(point[1], (int, float)) and not isinstance(point[1], bool)
            and math.isfinite(point[1]) and point[1] > 0)


def validate_points(points, cutoff):
    if not all(valid_point(p, cutoff) for p in points):
        raise ValueError('Invalid price or future observation')
    dates = [p[0] for p in points]
    if dates != sorted(set(dates)):
        raise ValueError('Duplicate or unsorted dates')


def yahoo(instrument, start, now):
    symbol = instrument['ticker']
    begin = int(dt.datetime.combine(dt.date.fromisoformat(start), dt.time(), UTC).timestamp())
    query = urllib.parse.urlencode({'period1': begin, 'period2': int(now.timestamp()), 'interval': '1d', 'events': 'splits'})
    url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + urllib.parse.quote(symbol, safe='') + '?' + query
    request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (MarketIntel closing-price importer)'})
    with urllib.request.urlopen(request, timeout=25) as response:
        payload = json.load(response)
    series = payload['chart']['result'][0]
    meta = series['meta']
    if meta['symbol'].upper() != symbol.upper() or meta.get('currency') != instrument['currency']:
        raise ValueError('Provider symbol/currency mismatch')
    if instrument.get('identity_name') and instrument['identity_name'].lower() not in meta.get('longName', meta.get('shortName', '')).lower():
        raise ValueError('Provider issuer-name mismatch')
    timezone = ZoneInfo(meta['exchangeTimezoneName'])
    today = now.astimezone(timezone).date()
    close_time = meta.get('currentTradingPeriod', {}).get('regular', {}).get('end')
    prices = series['indicators']['quote'][0]['close']
    points = {}
    for timestamp, close in zip(series.get('timestamp', []), prices):
        date = dt.datetime.fromtimestamp(timestamp, timezone).date()
        # Never label a still-open session as a completed close. A delay buffer
        # permits provider finalization; absent current-period evidence excludes today.
        if date > today or date == today and (not close_time or now.timestamp() < close_time + 3600):
            continue
        if close is not None:
            points[date.isoformat()] = close
    result = sorted([k, v] for k, v in points.items())
    validate_points(result, today)
    if not result:
        raise ValueError('Provider returned no completed sessions')
    return result, meta


def initial(root, source, now, supplement=False):
    if (root / 'manifest.json').exists():
        raise ValueError('Initial import cannot replace an existing feed')
    book = workbook_rows(source)
    stock_headers = book['stocks'][0]
    stocks = [{stock_headers[k]: v for k, v in row.items()} for row in book['stocks'][1:]]
    instruments, latest = [], {}
    cutoff = now.astimezone(SGT).date()
    for stock in stocks:
        ticker = stock['ticker']
        identity = re.sub('[^a-z0-9]+', '-', ticker.lower()).strip('-')
        record = {key: stock.get(key, '') for key in ('ticker', 'name', 'currency', 'unit', 'exchange', 'asset_type', 'history_url', 'provider')}
        # SI's existing canonical identity map explicitly identifies DBSM as
        # ticker.dbs_d05 and UOBH as ticker.uob_u11. Other vendor codes remain unresolved.
        aliases = {'BRK-B': ['BRK.B'], 'D05.SI': ['DBSM'], 'U11.SI': ['UOBH']}.get(ticker, [])
        basis = 'published_total_return_index' if ticker in ('^SP500TR', '^XNDX') else BASELINE_BASIS
        record.update(id=identity, basis=basis, automatic=stock.get('provider') == 'Yahoo Finance', aliases=aliases)
        column = stock['excel_column']
        history = {'schema_version': 1, 'id': identity, 'basis': basis,
                   'period_note': 'Daily dates are actual sessions; older weekly/monthly dates are workbook period labels.'}
        for frequency in ('daily', 'weekly', 'monthly'):
            history[frequency] = [[row['A'], row[column]] for row in book[frequency][1:] if column in row]
            validate_points(history[frequency], cutoff)
        record['history'] = write_snapshot(root, 'history/' + identity, 'History', history, now)
        if history['daily']:
            latest[identity] = {'date': history['daily'][-1][0], 'close': history['daily'][-1][1], 'status': 'imported_close'}
        instruments.append(record)
    # These exact listings are required by the existing earnings/SI cards.
    # GOOGL must never be substituted with GOOG (different share classes).
    if supplement:
        add_supplements(root, instruments, latest, now)
    registry = write_snapshot(root, 'register', 'Instruments', {'schema_version': 1, 'instruments': instruments}, now)
    snapshot = write_snapshot(root, 'latest', 'Shares_Latest', {'schema_version': 1, 'generated_at': now.isoformat(), 'quotes': latest}, now)
    manifest = {'schema_version': 1, 'generated_at': now.isoformat(), 'mode': 'daily_close', 'count': len(instruments), 'register': registry, 'latest': snapshot, 'months': {}, 'baseline_sha256': digest(Path(source).read_bytes())}
    publish_manifest(root, manifest)
    return {'instruments': len(instruments), 'latest_bytes': snapshot['bytes'], 'mode': 'initial_import'}


def add_supplements(root, instruments, latest, now):
    cutoff = now.astimezone(SGT).date()
    for ticker, name, expected in SUPPLEMENTS:
        if any(x['ticker'] == ticker for x in instruments):
            continue
        record = {'id': ticker.lower(), 'ticker': ticker, 'name': name, 'identity_name': expected,
                  'currency': 'USD', 'unit': 'USD per share', 'asset_type': 'equity', 'provider': 'Yahoo Finance',
                  'history_url': f'https://finance.yahoo.com/quote/{ticker}/history/', 'basis': BASELINE_BASIS, 'automatic': True, 'aliases': []}
        points, meta = yahoo(record, (cutoff - dt.timedelta(days=366*5)).isoformat(), now)
        record['exchange'] = meta.get('fullExchangeName', meta.get('exchangeName', ''))
        record['asset_type'] = 'ETF' if meta.get('instrumentType') == 'ETF' else 'equity'
        record['timezone'] = meta['exchangeTimezoneName']
        history = {'schema_version': 1, 'id': record['id'], 'basis': BASELINE_BASIS, 'daily': points, 'weekly': [], 'monthly': [], 'period_note': 'Actual daily session dates.'}
        record['history'] = write_snapshot(root, 'history/' + record['id'], 'History', history, now)
        latest[record['id']] = {'date': points[-1][0], 'close': points[-1][1], 'status': 'provider_close'}
        instruments.append(record)


def supplement(root, now):
    manifest = validate_feed(root)
    instruments = read_ref(root, manifest['register'])['instruments']
    latest = read_ref(root, manifest['latest'])['quotes']
    before = len(instruments)
    add_supplements(root, instruments, latest, now)
    if len(instruments) == before:
        return {'added': 0, 'instruments': before}
    manifest['register'] = write_snapshot(root, 'register', 'Instruments', {'schema_version': 1, 'instruments': instruments}, now)
    manifest['latest'] = write_snapshot(root, 'latest', 'Shares_Latest', {'schema_version': 1, 'generated_at': now.isoformat(), 'quotes': latest}, now)
    manifest.update(count=len(instruments), generated_at=now.isoformat())
    publish_manifest(root, manifest)
    return {'added': len(instruments)-before, 'instruments': len(instruments), 'latest_bytes': manifest['latest']['bytes']}


def publish_manifest(root, manifest):
    validate_feed(root, manifest)
    temporary = root / '.manifest.tmp'
    temporary.write_text(dumps(manifest), encoding='utf-8')
    temporary.replace(root / 'manifest.json')


def validate_feed(root, manifest=None, public=False):
    manifest = manifest or load(root / 'manifest.json')
    register = read_ref(root, manifest['register'])
    latest = read_ref(root, manifest['latest'])
    ids = [x['id'] for x in register['instruments']]
    if public and (manifest.get('public_display_approved') is not True or not manifest.get('public_display_basis')):
        raise ValueError('Public price distribution requires an explicit publication decision and source basis')
    if manifest['schema_version'] != 1 or manifest['count'] != len(ids) or len(ids) != len(set(ids)) or set(latest['quotes']) != set(ids):
        raise ValueError('Feed identity/count mismatch')
    cutoff = dt.datetime.fromisoformat(manifest['generated_at']).astimezone(SGT).date()
    if manifest.get('events'):
        validate_events(read_ref(root, manifest['events']), register['instruments'], cutoff)
    for quote in latest['quotes'].values():
        if not valid_point([quote['date'], quote['close']], cutoff):
            raise ValueError('Invalid latest observation')
    daily = {}
    for item in register['instruments']:
        history = read_ref(root, item['history'])
        if history['id'] != item['id'] or history['basis'] != item['basis']:
            raise ValueError('History identity/basis mismatch')
        for key in ('daily', 'weekly', 'monthly'):
            validate_points(history[key], cutoff)
        daily[item['id']] = dict(history['daily'])
    for month, ref in manifest['months'].items():
        chunk = read_ref(root, ref)
        if chunk['month'] != month or set(chunk['series']) - set(ids):
            raise ValueError('Monthly identity mismatch')
        for identity, points in chunk['series'].items():
            validate_points(points, cutoff)
            if any(not p[0].startswith(month) for p in points):
                raise ValueError('Wrong monthly partition')
            daily[identity].update(points)
    for identity, observations in daily.items():
        quote = latest['quotes'][identity]
        if not observations or quote['date'] != max(observations) or quote['close'] != observations[quote['date']]:
            raise ValueError('Latest snapshot does not reconcile to historical daily data')
    return manifest


def validate_events(data, instruments, cutoff):
    symbols = {s for item in instruments for s in [item['ticker'], *item.get('aliases', [])]}
    if data.get('schema_version') != 1 or not isinstance(data.get('events'), list):
        raise ValueError('Invalid earnings event schema')
    seen = set()
    for event in data['events']:
        pair = (event.get('ticker'), event.get('date'))
        url = urllib.parse.urlparse(event.get('source_url', ''))
        if (pair[0] not in symbols or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', pair[1] or '')
                or dt.date.fromisoformat(pair[1]) > cutoff or pair in seen
                or event.get('timing') != 'date_only'
                or event.get('evidence') not in ('issuer_release', 'sec_filing')
                or not event.get('label') or not event.get('source_title')
                or url.scheme != 'https' or not url.netloc or url.username or url.password):
            raise ValueError('Invalid, duplicated or unsupported earnings event')
        seen.add(pair)


def import_events(root, source, now):
    manifest = validate_feed(root)
    instruments = read_ref(root, manifest['register'])['instruments']
    # Only the approved public event fields enter the feed, never review receipts.
    fields = ('ticker', 'date', 'label', 'source_url', 'source_title', 'timing', 'evidence')
    events = [{key: event.get(key) for key in fields} for event in load(source)['events']]
    events.sort(key=lambda e: (e['date'], e['ticker']))
    data = {'schema_version': 1, 'events': events}
    validate_events(data, instruments, now.astimezone(SGT).date())
    manifest['events'] = write_snapshot(root, 'events', 'Earnings', data, now)
    manifest['generated_at'] = now.isoformat()
    publish_manifest(root, manifest)
    return {'events': len(events), 'bytes': manifest['events']['bytes']}


def merge(root, observations, statuses, now):
    manifest = validate_feed(root)
    register = read_ref(root, manifest['register'])['instruments']
    current = read_ref(root, manifest['latest'])
    chunks = {month: read_ref(root, ref) for month, ref in manifest['months'].items()}
    changed, inserted, errors = set(), 0, []
    cutoff = now.astimezone(SGT).date()
    for instrument in register:
        identity = instrument['id']
        quote = current['quotes'][identity]
        quote['status'] = statuses.get(identity, quote.get('status', 'not_updated'))
        points = observations.get(identity, [])
        validate_points(points, cutoff)
        known = dict(read_ref(root, instrument['history'])['daily'])
        for chunk in chunks.values():
            known.update(chunk['series'].get(identity, []))
        # A changed overlapping close can indicate a split/provider revision.
        # Hold this instrument for explicit reconciliation instead of splicing bases.
        if any(date in known and not math.isclose(price, known[date], rel_tol=1e-7, abs_tol=1e-7) for date, price in points):
            quote['status'] = 'basis_review'
            errors.append(identity + ': overlapping close changed; reconcile history before appending')
            continue
        for date, price in points:
            if date in known:
                continue
            month = date[:7]
            chunk = chunks.setdefault(month, {'schema_version': 1, 'month': month, 'series': {}})
            values = dict(chunk['series'].get(identity, []))
            values[date] = price
            chunk['series'][identity] = sorted([k, v] for k, v in values.items())
            known[date] = price
            changed.add(month)
            inserted += 1
        if known:
            date = max(known)
            quote.update(date=date, close=known[date])
    for month in changed:
        manifest['months'][month] = write_snapshot(root, 'updates/' + month, 'Prices', chunks[month], now)
    current['generated_at'] = now.isoformat()
    manifest['generated_at'] = now.isoformat()
    manifest['latest'] = write_snapshot(root, 'latest', 'Shares_Latest', current, now)
    publish_manifest(root, manifest)
    return {'inserted': inserted, 'changed_months': sorted(changed), 'latest_bytes': manifest['latest']['bytes'], 'review': errors,
            'statuses': {state: sum(q['status'] == state for q in current['quotes'].values()) for state in sorted({q['status'] for q in current['quotes'].values()})}}


def update(root, now):
    manifest = validate_feed(root)
    register = read_ref(root, manifest['register'])['instruments']
    quotes = read_ref(root, manifest['latest'])['quotes']
    def retrieve(item):
        if not item['automatic']:
            return item['id'], [], 'manual_source'
        start = (dt.date.fromisoformat(quotes[item['id']]['date']) - dt.timedelta(days=10)).isoformat()
        try:
            points, _ = yahoo(item, start, now)
            if not any(point[0] == quotes[item['id']]['date'] for point in points):
                # Require continuity with the existing listing before adding a new
                # tail. A missing overlap may be a relisting or provider-basis change.
                return item['id'], [], 'basis_review'
            return item['id'], points, 'provider_checked'
        except Exception:
            # Provider response bodies may contain unwanted content; retain only status.
            return item['id'], [], 'fetch_failed'
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(retrieve, register))
    return merge(root, {identity: points for identity, points, _ in results}, {identity: status for identity, _, status in results}, now)


def upload(root, file, now):
    manifest = validate_feed(root)
    registry = read_ref(root, manifest['register'])['instruments']
    by_symbol = {x['ticker']: x for x in registry}
    observations = {}
    with open(file, encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        if reader.fieldnames != ['ticker', 'date', 'close', 'currency', 'basis']:
            raise ValueError('CSV columns must be ticker,date,close,currency,basis')
        for row in reader:
            item = by_symbol.get(row['ticker'])
            if not item or row['currency'] != item['currency'] or row['basis'] != item['basis']:
                raise ValueError('Unmapped symbol, currency or price basis')
            observations.setdefault(item['id'], []).append([row['date'], float(row['close'])])
    for points in observations.values():
        points.sort()
    return merge(root, observations, {identity: 'uploaded_close' for identity in observations}, now)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['import', 'supplement', 'update', 'upload', 'events', 'validate'])
    parser.add_argument('--feed-dir', required=True, type=Path)
    parser.add_argument('--workbook', type=Path)
    parser.add_argument('--csv', type=Path)
    parser.add_argument('--events-file', type=Path)
    parser.add_argument('--supplement', action='store_true')
    parser.add_argument('--public', action='store_true', help='Require documented public-display approval before publication')
    args = parser.parse_args()
    args.feed_dir.mkdir(parents=True, exist_ok=True)
    now = dt.datetime.now(UTC)
    # A single lock covers provider reads, staging and manifest promotion.
    lock = args.feed_dir / '.writer.lock'
    lock.touch(exist_ok=False)
    try:
            if args.command == 'import':
                result = initial(args.feed_dir, args.workbook, now, args.supplement)
            elif args.command == 'update':
                result = update(args.feed_dir, now)
            elif args.command == 'supplement':
                result = supplement(args.feed_dir, now)
            elif args.command == 'upload':
                result = upload(args.feed_dir, args.csv, now)
            elif args.command == 'events':
                result = import_events(args.feed_dir, args.events_file, now)
            else:
                result = {'valid': True, 'count': validate_feed(args.feed_dir, public=args.public)['count']}
            print(dumps(result))
    finally:
        lock.unlink()
