"""Read-only legacy adapter for the proposed desk. Never fetches or publishes.

New independent research/news must be merged by the existing ContentDelivery
browser client. Repository introduction is an explicit chronology fallback, not
an invented upload/deployment timestamp. Source financial observations are copied.
"""
from pathlib import Path, PurePosixPath
from datetime import datetime, timezone
from urllib.parse import urlsplit, urlunsplit, unquote
import argparse
import hashlib
import json
import re
import subprocess
import math
from build_publication_timeline import additions, page_title, article_summary
from build_report_additions import CARD_BRIEFS
from research_feed import collect as collect_verified_records

ROOT = Path(__file__).resolve().parents[1]
HUB = 'https://notwins.github.io/market-intelligence-hub/'
DEFAULT_FEATURED = ['research-cpf-oa-temasek-2070-2026-11-04',
                    'research-sti-banks-v2-2026-11-09',
                    'research-bis-ai-financing-loop-2026-11-13']
DATE_BASIS = 'First added to the public repository; not a verified Pages upload time'


def featured_selection(config, local_ids):
    """External IDs require an explicit editorial list; destinations come from the verified reader."""
    if config.get('schema_version') != 1:
        raise ValueError('Unsupported desk configuration version')
    approved = config.get('independent_featured_ids', [])
    pattern = r'[a-z][a-z0-9-]*-\d{4}-\d{2}-\d{2}(?:-r[1-9][0-9]*)?'
    if not isinstance(approved, list) or len(approved) > 4 or any(not isinstance(x, str) or not re.fullmatch(pattern, x) for x in approved):
        raise ValueError('Invalid independent research identity')
    chosen = config.get('featured_ids', DEFAULT_FEATURED)
    if not isinstance(chosen, list) or not all(isinstance(x, str) for x in chosen) or not 1 <= len(chosen) <= 4 or len(chosen) != len(set(chosen)) or any(x not in local_ids and x not in approved for x in chosen) or any(x not in chosen for x in approved):
        raise ValueError('Featured research must contain one to four unique reviewed report IDs')
    return chosen


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def public_href(value, site=None):
    """Accept existing site-local documents or credential-free HTTPS URLs.

    Local paths are decoded before containment checks. Private chat destinations,
    traversal, absolute/protocol-relative paths and active URL schemes fail closed.
    """
    if not isinstance(value, str) or not value or '\\' in value:
        return None
    try:
        u = urlsplit(value)
        if u.scheme:
            if u.scheme != 'https' or not u.hostname or u.username or u.password:
                return None
            if u.hostname.lower() in {'chatgpt.com', 'chat.openai.com'}:
                return None
            return value
        decoded = unquote(u.path)
        if u.netloc or decoded.startswith('/') or '..' in PurePosixPath(decoded).parts or ':' in decoded:
            return None
        if site:
            target = Path(site) / decoded
            if decoded.endswith('/'):
                target /= 'index.html'
            if not target.is_file() or not target.resolve().is_relative_to(Path(site).resolve()):
                return None
        return value
    except (ValueError, OSError):
        return None


def canonical_href(value):
    u = urlsplit(value if value.startswith('https:') else HUB + value)
    path = u.path[:-10] if u.path.endswith('index.html') else u.path
    return urlunsplit((u.scheme.lower(), u.netloc.lower(), path.rstrip('/'), u.query, ''))


def file_key(href):
    path = unquote(urlsplit(href).path)
    return path + 'index.html' if path.endswith('/') else path


def chronology(row):
    # Unknown introduction dates sort last, never replaced with the article date.
    return (row.get('added_at') or '', row['id'])


def reports_from_register(site, entries, added):
    result, seen = [], set()
    published = {e['id']: e for e in entries if e.get('state') == 'published'}
    for entry in published.values():
        href = public_href(entry.get('href'), site)
        if not href or urlsplit(href).scheme or not href.startswith(('research/', 'market-understanding/')):
            continue
        canonical = canonical_href(href)
        if canonical in seen:
            continue
        seen.add(canonical)
        intro = added.get(file_key(href), {})
        row = {'id': entry['id'], 'title': entry['title'], 'href': href,
               'summary': entry.get('summary') or '', 'research_date': entry.get('date'),
               'uploaded_at': None, 'added_at': intro.get('at'), 'upload_basis': DATE_BASIS,
               'recorded_publication_date': entry.get('published_date'),
               'kind': 'Research article', 'edition': entry.get('edition') or '',
               'tags': entry.get('tags', []), 'briefs': [], 'assets': [],
               'added_commit': intro.get('commit'), 'full_edition': entry.get('full_edition')}
        brief = CARD_BRIEFS.get(entry['id'])
        if brief in published:
            item = published[brief]
            if public_href(item['href'], site):
                row['briefs'].append({'title': item['title'], 'href': item['href'],
                                      'summary': item.get('summary') or item.get('edition') or '', 'format': 'HTML'})
        elif brief and brief in entry.get('assets', []) and public_href(brief, site):
            row['briefs'].append({'title': 'One-page brief', 'href': brief,
                                  'summary': 'Matching published brief for this edition.', 'format': 'PDF'})
        for asset in entry.get('assets', []):
            if public_href(asset, site):
                row['assets'].append({'href': asset, 'format': Path(urlsplit(asset).path).suffix[1:].upper(),
                                      'title': Path(urlsplit(asset).path).stem.replace('_', ' ')})
        result.append(row)
    # Preserve published HTML that predates or is absent from the legacy register.
    for base in ('research', 'market-understanding'):
        for path in sorted((Path(site) / base).rglob('*.html')):
            href = path.relative_to(site).as_posix()
            if href == 'market-understanding/index.html' or canonical_href(href) in seen:
                continue
            intro = added.get(href, {})
            result.append({'id': 'document-' + hashlib.sha256(href.encode()).hexdigest()[:16],
                           'title': page_title(path), 'href': href,
                           'summary': article_summary(path) or '', 'research_date': None,
                           'uploaded_at': None, 'added_at': intro.get('at'), 'upload_basis': DATE_BASIS,
                           'recorded_publication_date': None, 'kind': 'Published HTML document',
                           'edition': '', 'tags': [], 'briefs': [], 'assets': [],
                           'added_commit': intro.get('commit'), 'full_edition': None})
            seen.add(canonical_href(href))
    return sorted(result, key=chronology, reverse=True)


def matched_news(data, tickers):
    result, seen = [], set()
    for item in data.get('items', []):
        matched = sorted(set(item.get('tickers', [])) & set(tickers))
        href = public_href(item.get('url'))
        if not matched or not href:
            continue
        key = (canonical_href(href), item.get('published_at'))
        if key in seen:
            continue
        seen.add(key)
        result.append({'id': item.get('id') or hashlib.sha256(str(key).encode()).hexdigest()[:20],
                       'title': item.get('title', ''), 'href': href,
                       'published_at': item.get('published_at'), 'tickers': matched,
                       'source': item.get('publisher') or 'Saved publisher metadata',
                       'match_basis': 'Explicit company ticker in saved headline metadata',
                       'coverage': item.get('verification') or 'Headline metadata only; full article not reproduced'})
    return sorted(result, key=lambda r: (r['published_at'] or '', r['id']), reverse=True)


def public_calls(site, data):
    rows = []
    for call in data.get('calls', []):
        report = call.get('report') or {}
        href = public_href(report.get('html_path'), site)
        if call.get('public_approval') is not True or report.get('visibility') != 'public' or not href:
            continue
        if not href.startswith('research/calls/') or urlsplit(href).scheme:
            continue
        rows.append({'id': call['id'], 'ticker': call['ticker'],
                     'date': call.get('review_date') or call.get('called_at'),
                     'recorded_at': call.get('recorded_at'), 'type': call.get('call_type'),
                     'title': report.get('title'), 'summary': call.get('summary'), 'href': href,
                     'instructions_href': None,
                     'instructions_status': 'Read rationale within the public report; no separate public instructions supplied'})
    return sorted(rows, key=lambda r: (r['date'] or '', r['id']), reverse=True)


def yield_rows(market):
    rows = []
    for i, label in enumerate(market.get('labels', [])):
        value = market.get('values', [])[i]
        # The existing updater's column mapping is explicit; its one DGS10 link
        # describes the whole payload and must not masquerade as every tenor.
        series = {'2Y': 'DGS2', '5Y': 'DGS5', '10Y': 'DGS10', '30Y': 'DGS30'}.get(label)
        rows.append({'id': 'ust-' + label.lower(), 'label': 'US Treasury ' + label,
                     'value': value, 'unit': '%', 'as_of': market.get('as_of'),
                     'status': market.get('status'), 'message': market.get('message'),
                     'basis': 'Saved Federal Reserve H.15 constant-maturity yield; percent per annum',
                     'source': market.get('source'),
                     'source_url': 'https://fred.stlouisfed.org/series/' + series if series else None,
                     'source_series': series,
                     'checked_at': market.get('checked_at'), 'last_attempt': market.get('last_attempt'),
                     'history': [{'date': h['date'], 'value': h['values'][i]}
                                 for h in market.get('history', []) if len(h.get('values', [])) > i]})
    return rows


def sgs_yield_rows(snapshot):
    """Use only source-dated daily SGS benchmark observations, never monthly proxies."""
    if snapshot.get('schema_version') != 1 or snapshot.get('frequency') != 'daily':
        raise ValueError('Daily SGS snapshot required; no monthly fallback')
    tenors = snapshot.get('tenors', [])
    observations = snapshot.get('observations', [])
    if not observations:
        return []
    dates = []
    for observation in observations:
        stamp = observation.get('date', '')
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', stamp):
            raise ValueError('Exact SGS observation date required')
        datetime.strptime(stamp, '%Y-%m-%d')
        if dates and stamp <= dates[-1]:
            raise ValueError('SGS observations must be unique and chronological')
        dates.append(stamp)
    rows = []
    for label in ('2Y', '10Y'):
        columns = [i for i, tenor in enumerate(tenors) if tenor.get('label') == label]
        if len(columns) != 1:
            raise ValueError('Exact SGS tenor mapping required: ' + label)
        i = columns[0]
        history = []
        for observation in observations:
            values = observation.get('values', [])
            value = values[i] if len(values) > i else None
            if value is None:
                continue
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
                raise ValueError('Invalid SGS numeric observation')
            history.append({'date': observation['date'], 'value': value})
        if not history:
            continue
        latest = history[-1]
        rows.append({'id': 'sgs-' + label.lower(), 'label': 'SGS benchmark ' + label,
                     'value': latest['value'], 'unit': '%', 'as_of': latest['date'],
                     'status': 'saved', 'message': 'Saved daily closing observation; not a live quote.',
                     'basis': snapshot.get('basis'), 'date_basis': 'MAS source observation date',
                     'time_precision': snapshot.get('time_precision'), 'observed_time': snapshot.get('observed_time'),
                     'source': snapshot.get('source'), 'source_url': public_href(snapshot.get('source_url')),
                     'checked_at': snapshot.get('checked_at'), 'last_attempt': None,
                     'source_scope': snapshot.get('source_scope'), 'attribution': snapshot.get('attribution'),
                     'license_url': public_href(snapshot.get('license_url')), 'history': history})
    return rows


def build(root=ROOT, now=None):
    root = Path(root); site = root / 'site'; data = site / 'data'
    register = read(data / 'research-register.json')
    intro = additions(root)
    reports = reports_from_register(site, register['entries'], intro)
    # A frozen local edition can postdate the legacy registry. Use the existing
    # exact-byte validator rather than inferring completeness from its title.
    verified, _ = collect_verified_records(site)
    by_href = {canonical_href(r['href']): r for r in reports}
    for receipt in verified:
        record = receipt['record']
        row = by_href.get(canonical_href(record['full_report_url']))
        if not row:
            continue
        row.update(id=record['id'], title=record['title'], summary=record['summary'],
                   research_date=record['cutoff_sgt'], tags=record['tags'],
                   kind='Verified full report', verified_at=receipt['verified_at_sgt'])
        channel = 'earnings' if record['id'].startswith('us-earnings-full-') else 'credit' if record['id'].startswith('bond-credit-full-') else None
        if channel:
            row['full_edition'] = {'channel': channel, 'kind': 'complete-source-edition',
                                   'completeness_verified': True, 'cutoff': record['cutoff_sgt'],
                                   'document': record['full_report_url'], 'sha256': record['full_report_sha256'],
                                   'verification': 'immutable-record-and-exact-asset-validation'}
    reports.sort(key=chronology, reverse=True)
    watch = read(data / 'watchlist/latest.json')
    earnings = read(data / 'earnings-history.json')
    earning_by_ticker = {x['ticker']: x for x in earnings.get('companies', [])}
    si = read(data / 'si-pricing-reference.json')
    news_source = read(data / 'news.json')
    news = matched_news(news_source, [x['ticker'] for x in watch['rows']])
    watchlist = []
    for original in watch['rows']:
        ticker, price = original['ticker'], original.get('price') or {}
        watchlist.append({'ticker': ticker, 'name': original['name'], 'group': original.get('group'),
                          'price': {'value': price.get('close'), 'currency': price.get('currency'),
                                    'as_of': price.get('as_of'), 'change_pct': price.get('change_pct'),
                                    'basis': watch.get('price_basis'),
                                    'source_url': public_href(price.get('source_url'))},
                          'earnings': earning_by_ticker.get(ticker),
                          'si': [r for r in si.get('rows', []) if ticker in r.get('shares', [])],
                          'news_ids': [n['id'] for n in news if ticker in n['tickers']],
                          'research_href': 'search.html?q=' + ticker})
    config_path = data / 'desk-config.json'
    config = read(config_path) if config_path.is_file() else {'schema_version': 1, 'featured_ids': DEFAULT_FEATURED}
    valid_ids = {r['id'] for r in reports}
    chosen = featured_selection(config, valid_ids)
    sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
    return {'schema_version': 1, 'source_commit': sha,
            'built_at': (now or datetime.now(timezone.utc)).isoformat(),
            'coverage': {'archive': 'All legacy published research HTML in this checkout; companion assets remain attached. New independent editions are merged by ContentDelivery in the browser.',
                         'chronology': DATE_BASIS + '. Unknown introduction dates sort last. Source/research dates remain separate.',
                         'prices': 'Saved watchlist fallback only; browser uses the existing hash-verified MarketPrices feed for current published daily closes.',
                         'news': 'Explicit ticker matches in saved headline metadata; not comprehensive coverage or a recommendation.',
                         'calls': 'Only existing explicitly approved public historical reviews; no new call or trading instruction inferred.'},
            'featured_ids': chosen, 'reports': reports,
            'daily_reports': [r for r in reports if r.get('full_edition')],
            'watchlist': watchlist, 'yields': yield_rows(read(data / 'market.json')) + sgs_yield_rows(read(data / 'sgs-daily-snapshot.json')),
            'news': news, 'news_generated_at': news_source.get('generated_at'), 'news_status': news_source.get('status'),
            'calls': public_calls(site, read(data / 'watchlist/calls.json')),
            'earnings_sources': earnings.get('sources'), 'earnings_coverage': earnings.get('coverage'),
            'si_basis': {k: si.get(k) for k in ['classification', 'live_quotes', 'source_capture_date', 'source_date_range', 'tenor_unit', 'coupon_basis', 'rounding']}}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    target = args.output or args.root / 'site/data/desk-data.json'
    payload = build(args.root)
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'output': str(target), 'reports': len(payload['reports']),
                      'watchlist': len(payload['watchlist']), 'news': len(payload['news']), 'calls': len(payload['calls'])}))
