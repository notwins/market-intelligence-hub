#!/usr/bin/env python3
"""Read saved public source links from a pinned Hub git revision. No network I/O.

Only the explicitly listed public reports/modules below are read. Uploaded
originals, zip files, private conversation URLs, article bodies, and historical
worktree files are never used. The output has only short public source metadata.
"""
from __future__ import annotations
import argparse
import collections
import datetime as dt
import hashlib
import html
import ipaddress
import json
import re
import subprocess
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qsl, unquote, urlencode, urlsplit, urlunsplit
from zoneinfo import ZoneInfo

DEFAULT_REVISION = '1998852d739b31b6e3cc90d139acf0e4b7b524a8'
SGT = ZoneInfo('Asia/Singapore')
START = '2026-10-01'
END = '2026-11-04'
PRIVATE_HOSTS = ('chatgpt.com', 'chat.openai.com', 'oaiusercontent.com',
                 'blob.core.windows.net', 'amazonaws.com', 'localhost',
                 'example.com', 'example.org', 'example.net', 'docs.google.com',
                 'drive.google.com', 'dropbox.com', 'box.com', 'sharepoint.com',
                 'onedrive.live.com', '1drv.ms', 'notion.so')
PRIVATE_SUFFIXES = ('.local', '.internal', '.localhost', '.invalid', '.test', '.onion')
TRACKING_KEYS = {'gclid', 'dclid', 'fbclid', 'msclkid', 'mc_cid', 'mc_eid',
                 'igshid', 'guce_referrer', 'guce_referrer_sig', 'guccounter', '.tsrc', 'ltr'}
PRIVATE_QUERY_KEY = re.compile(r'(^|[_-])(token|secret|password|passwd|credential|signature|session|email|phone|address|authorization|jwt|oauth|key|auth|sid|sig|messageid|userid|accountid)([_-]|$)', re.I)
TITLE_KEYS = ('title', 'headline', 'label', 'name', 'issuer')
EXCLUDED_KEYS = {'publisher_url', 'original_url', 'source_schedule', 'license_url',
                 'legal_url', 'uploaded', 'uploaded_file', 'original_workbook',
                 'body', 'summary', 'analysis', 'facts', 'risks', 'takeaway',
                 'limitations', 'notes', 'context', 'caveats'}
PUBLISHERS = {
    'reuters.com': 'Reuters', 'news.google.com': 'Google News',
    'marketscreener.com': 'MarketScreener', 'streetinsider.com': 'StreetInsider',
    'finance.yahoo.com': 'Yahoo Finance', 'stockanalysis.com': 'Stock Analysis',
    'sec.gov': 'U.S. Securities and Exchange Commission',
    'mas.gov.sg': 'Monetary Authority of Singapore',
    'fred.stlouisfed.org': 'Federal Reserve Bank of St. Louis (FRED)',
    'federalreserve.gov': 'Federal Reserve Board',
    'home.treasury.gov': 'U.S. Department of the Treasury',
    'bankofsingapore.com': 'Bank of Singapore', 'morningstar.com': 'Morningstar',
    'apple.com': 'Apple', 'nvidia.com': 'NVIDIA', 'amd.com': 'AMD',
    'aboutamazon.com': 'Amazon', 'microsoft.com': 'Microsoft',
    'alphabet.com': 'Alphabet', 'abc.xyz': 'Alphabet',
    'bis.org': 'Bank for International Settlements',
    'ecb.europa.eu': 'European Central Bank', 'bankofengland.co.uk': 'Bank of England',
    'jpmorgan.com': 'J.P. Morgan Asset Management', 'spglobal.com': 'S&P Global',
    'imf.org': 'International Monetary Fund', 'worldbank.org': 'World Bank',
}


def clean_title(value, limit=150):
    if not isinstance(value, str):
        return ''
    value = re.sub(r'<[^>]*>', '', html.unescape(value))
    value = re.sub(r'\s+', ' ', value).strip()
    # Never put accidental links, secrets, or local paths in a display label.
    if re.search(r'https?://|/workspace/|/tmp/|/home/|(?:api[_-]?key|password|access[_-]?token)\s*[:=]', value, re.I):
        return ''
    return value if len(value) <= limit else value[:limit-1].rstrip() + '…'


def canonical_url(raw):
    """Conservative HTTPS normalization; return (url, rejection_reason).

    Retain path casing, nontracking query order, and all fragments because a PDF
    page or application hash may be meaningful. Remove only known tracking keys.
    Never retain a URL containing credentials, secret-like/private query fields,
    private destinations, nonpublic IP literals, or file-service locations.
    """
    if not isinstance(raw, str):
        return None, 'not_a_url'
    raw = html.unescape(raw).strip()
    if re.search(r'[\x00-\x20\x7f\\]', raw):
        return None, 'unsafe_characters'
    try:
        p = urlsplit(raw)
        if p.scheme.lower() != 'https':
            return None, 'not_https'
        if p.username is not None or p.password is not None:
            return None, 'credentials'
        host = (p.hostname or '').lower().rstrip('.').encode('idna').decode('ascii')
        if not host or '.' not in host or host.endswith(PRIVATE_SUFFIXES):
            return None, 'private_destination'
        if any(host == d or host.endswith('.' + d) for d in PRIVATE_HOSTS):
            return None, 'private_or_non_source_destination'
        try:
            ipaddress.ip_address(host)
            return None, 'ip_literal'
        except ValueError:
            pass
        if not re.fullmatch(r'[a-z0-9-]+(?:\.[a-z0-9-]+)+', host):
            return None, 'invalid_host'
        if p.port not in (None, 443):
            return None, 'nonstandard_port'
        if host == 'notwins.github.io' and p.path.startswith('/market-intelligence-hub'):
            return None, 'internal_hub_link'
        if re.search(r'(?i)(?:/|^)(?:sandbox|sediment|library_file|file_[a-zA-Z0-9]{12,})(?:/|$)', unquote(p.path)):
            return None, 'private_file_path'
        pairs = parse_qsl(p.query, keep_blank_values=True)
        kept = []
        for key, value in pairs:
            lower = key.lower()
            if lower.startswith('utm_') or lower in TRACKING_KEYS or (host == 'news.google.com' and lower == 'oc'):
                continue
            normalized_key = re.sub(r'[^a-z0-9]', '', lower)
            if PRIVATE_QUERY_KEY.search(lower) or normalized_key in {
                'apikey', 'accesskey', 'accesstoken', 'refreshtoken', 'idtoken',
                'clientsecret', 'xamzsignature', 'xamzcredential', 'xamzsecuritytoken',
                'messageid', 'userid', 'accountid', 'sessionid', 'authcode',
                'resetcode', 'resetkey', 'verificationcode', 'onetimecode',
                'csrf', 'csrftoken', 'nonce', 'code',
            }:
                return None, 'private_query'
            if re.search(r'(?i)(?:bearer\s|eyJ[a-zA-Z0-9_-]+\.|/workspace/|/home/|[\w.+-]+@[\w.-]+\.[a-z]{2,})', unquote(value)):
                return None, 'private_query_value'
            kept.append((key, value))
        # Retain original query encoding/order unless tracking was removed.
        query = p.query if len(kept) == len(pairs) else urlencode(kept)
        fragment = p.fragment
        if re.search(r'(?i)(?:token|secret|password|session|signature|credential|email|phone|auth|code)[a-z_-]*=', unquote(fragment)):
            return None, 'private_fragment'
        return urlunsplit(('https', host, p.path or '/', query, fragment)), None
    except (ValueError, UnicodeError):
        return None, 'invalid_url'


def saved_date(value):
    """Use report dates in SGT, never an article's publication or pricing date."""
    if not isinstance(value, str):
        return None
    try:
        if re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
            return dt.date.fromisoformat(value).isoformat()
        parsed = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
        if parsed.tzinfo is not None:
            parsed = parsed.astimezone(SGT)
        return parsed.date().isoformat()
    except ValueError:
        return None


def instant_key(value):
    try:
        stamp = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
        if stamp.tzinfo is None:
            stamp = stamp.replace(tzinfo=SGT)
        return stamp.astimezone(dt.timezone.utc).isoformat()
    except (ValueError, AttributeError):
        return str(value)


def infer_publisher(domain, saved):
    label = clean_title(saved, 90)
    if label:
        return label, 'saved_metadata'
    for suffix, publisher in sorted(PUBLISHERS.items(), key=lambda kv: -len(kv[0])):
        if domain == suffix or domain.endswith('.' + suffix):
            return publisher, 'domain_label'
    return domain.removeprefix('www.'), 'domain_label'


def source_links(obj, title='', publisher=''):
    """Walk structured source fields, not body/prose URLs or source originals."""
    if isinstance(obj, dict):
        for key in TITLE_KEYS:
            candidate = clean_title(obj.get(key))
            if candidate:
                title = candidate
                break
        if isinstance(obj.get('source_url'), str):
            if isinstance(obj.get('provider_series'), str):
                title = clean_title(str(obj.get('id', '')) + ' · ' + obj['provider_series'])
            elif isinstance(obj.get('year'), int):
                title = clean_title(title + ' · ' + str(obj['year']))
        publisher = obj.get('publisher') if isinstance(obj.get('publisher'), str) else publisher
        for key, value in obj.items():
            if key in EXCLUDED_KEYS:
                continue
            if isinstance(value, str) and value.startswith(('https://', 'http://')):
                # Structured strings are links. Metadata/private fields above are excluded.
                yield value, title, publisher
            elif isinstance(value, (dict, list)):
                yield from source_links(value, title, publisher)
    elif isinstance(obj, list):
        for item in obj:
            if isinstance(item, str) and item.startswith(('https://', 'http://')):
                yield item, title, publisher
            elif isinstance(item, (dict, list)):
                yield from source_links(item, title, publisher)


class PublicAnchorParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.current = None
        self.links = []
    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            fields = dict(attrs)
            self.current = [fields.get('href', ''), [], fields.get('title', '')]
    def handle_data(self, data):
        if self.current:
            self.current[1].append(data)
    def handle_endtag(self, tag):
        if tag == 'a' and self.current:
            url, parts, title = self.current
            self.links.append((url, clean_title(' '.join(parts)) or clean_title(title), ''))
            self.current = None


class Repository:
    def __init__(self, path, revision):
        self.path = str(path)
        self.revision = self.git('rev-parse', '--verify', revision + '^{commit}').strip()
        self.files = set(self.git('ls-tree', '-r', '--name-only', self.revision).splitlines())
    def git(self, *args):
        return subprocess.check_output(['git', '-C', self.path, *args], text=True)
    def read(self, name):
        if name not in self.files:
            return None
        return self.git('show', self.revision + ':' + name)
    def json(self, name):
        contents = self.read(name)
        return json.loads(contents) if contents is not None else None


class Inventory:
    def __init__(self, start, end):
        self.start, self.end = start, end
        self.sources = {}
        self.editions = {}
        self.exclusions = collections.Counter()
        self.inputs = []
    def add(self, obj, edition_id, date, kind, report_title, public_path, date_basis, links=None):
        date = saved_date(date)
        if not date or not self.start <= date <= self.end:
            return
        reference = {'id': edition_id, 'date': date, 'type': kind,
                     'title': clean_title(report_title), 'path': public_path,
                     'date_basis': date_basis}
        self.editions.setdefault(edition_id, reference)
        for raw, title, saved_publisher in links if links is not None else source_links(obj, title=report_title):
            url, reason = canonical_url(raw)
            if not url:
                self.exclusions[reason] += 1
                continue
            domain = urlsplit(url).hostname
            publisher, publisher_basis = infer_publisher(domain, saved_publisher)
            title = clean_title(title) or domain.removeprefix('www.')
            entry = self.sources.setdefault(url, {
                'id': 'source-' + hashlib.sha256(url.encode()).hexdigest()[:16],
                'url': url, 'title': title, 'domain': domain,
                'publisher': publisher, 'publisher_basis': publisher_basis,
                'link_type': 'news_redirect' if domain == 'news.google.com' else 'saved_public_link',
                'availability': 'not_rechecked', 'provenance': 'saved_public_reference',
                '_references': {},
            })
            # Prefer saved source titles over generic module, link, or domain labels.
            generic = {'source', 'read', 'open', 'pdf', 'landing page', 'official source', 'source page'}
            if (entry['title'].lower() in generic or entry['title'] == domain or entry['title'] == clean_title(report_title)) and title.lower() not in generic:
                entry['title'] = title
            if entry['publisher_basis'] != 'saved_metadata' and publisher_basis == 'saved_metadata':
                entry['publisher'], entry['publisher_basis'] = publisher, publisher_basis
            entry['_references'].setdefault(edition_id, reference)
    def output(self, revision):
        sources = []
        for entry in self.sources.values():
            item = {k: v for k, v in entry.items() if not k.startswith('_')}
            refs = sorted(entry['_references'].values(), key=lambda r: (r['date'], r['id']))
            item.update(first_referenced=refs[0]['date'], last_referenced=refs[-1]['date'],
                        reference_count=len(refs), references=refs)
            sources.append(item)
        sources.sort(key=lambda s: (s['first_referenced'], s['domain'], s['title'], s['url']))
        editions = sorted(self.editions.values(), key=lambda r: (r['date'], r['id']))
        daily_dates = sorted({e['date'] for e in editions if e['type'] == 'daily_news'})
        missing = []
        day, end = dt.date.fromisoformat(self.start), dt.date.fromisoformat(self.end)
        while day <= end:
            if day.isoformat() not in daily_dates:
                missing.append(day.isoformat())
            day += dt.timedelta(days=1)
        return {
            'schema_version': 1,
            'title': 'Saved public sources · 1 October–4 November 2026',
            'date_range': {'start': self.start, 'end': self.end, 'timezone': 'Asia/Singapore',
                           'basis': 'Saved report edition or dated public module snapshot, not article publication date'},
            'source_revision': revision,
            'availability': 'not_rechecked',
            'notice': 'These links were saved in public Hub reports or dated research modules. Their present availability and contents were not rechecked. Source titles are saved labels, not newly verified claims.',
            'counting_method': 'reference_count counts distinct saved report or module editions containing the URL, once per edition. Daily latest/archive copies, duplicate hourly cutoff editions and watchlist archive/latest copies are combined. Different dated modules remain separate references.',
            'canonicalization': 'HTTPS only. Hostnames are normalized and known tracking parameters removed. Meaningful query parameters, path spelling and fragments are retained. Different publisher/syndication URLs are not collapsed.',
            'coverage': {
                'status': 'partial', 'daily_archive_dates': daily_dates,
                'daily_archive_missing_dates': missing,
                'earliest_saved_reference': min((e['date'] for e in editions), default=None),
                'latest_saved_reference': max((e['date'] for e in editions), default=None),
                'limitations': [
                    'No daily public news archive was found for 1–28 October 2026; this is not a complete month of activity.',
                    'The hourly archive begins on 1 November; that first edition has no selected source links. Later saved hourly editions are partial scans, not continuous coverage.',
                    'The available watchlist archive begins on 3 November 2026. Dates are normalized to Singapore time.',
                    'Public module review/retrieval dates identify the saved snapshot. They do not establish the first-ever use of a source.',
                    'Private conversation sources, uploaded originals, undated security directories, backups and article bodies are excluded.',
                    'Google News links remain saved public redirects. Their final publisher destinations were not resolved.',
                ],
                'edition_counts': dict(sorted(collections.Counter(e['type'] for e in editions).items())),
            },
            'statistics': {'unique_sources': len(sources), 'unique_domains': len({s['domain'] for s in sources}),
                           'saved_editions': len(editions), 'source_edition_references': sum(s['reference_count'] for s in sources)},
            'sources': sources,
        }


def extract(repository, revision=DEFAULT_REVISION, start=START, end=END):
    repo = Repository(repository, revision)
    inv = Inventory(start, end)
    def data(path):
        value = repo.json('site/' + path)
        if value is not None:
            inv.inputs.append(path)
        return value
    for name in sorted(repo.files):
        match = re.fullmatch(r'site/data/archive/(\d{4}-\d{2}-\d{2})\.json', name)
        if match:
            date = match.group(1)
            obj = data(name[5:])
            inv.add(obj, 'daily-news:' + date, date, 'daily_news', 'Daily Reuters headlines · ' + date,
                    name[5:], 'archive_date')
    obj = data('data/news.json')
    if obj:
        date = saved_date(obj.get('generated_at'))
        inv.add(obj, 'daily-news:' + str(date), obj.get('generated_at'), 'daily_news',
                'Daily Reuters headlines · ' + str(date), 'data/news.json', 'generated_at')
    obj = data('data/reports.json')
    for report in (obj or {}).get('reports', []):
        inv.add(report, 'report:' + report['id'], report.get('date'), 'curated_report',
                report.get('title', ''), 'data/reports.json', 'report_date')
    for name in sorted(repo.files):
        if name.startswith('site/data/hourly-archive/') and name.endswith('.json'):
            obj = data(name[5:])
            cutoff = obj.get('cutoff') or obj.get('report_at')
            inv.add(obj, 'hourly:' + instant_key(cutoff), cutoff, 'hourly_report',
                    'Hourly Reuters report · ' + str(saved_date(cutoff)), name[5:], 'cutoff')
    obj = data('data/hourly-news.json')
    for edition in (obj or {}).get('editions', []):
        cutoff = edition.get('cutoff') or edition.get('report_at')
        inv.add(edition, 'hourly:' + instant_key(cutoff), cutoff, 'hourly_report',
                'Hourly Reuters report · ' + str(saved_date(cutoff)), 'data/hourly-news.json', 'cutoff')
    for name in sorted(repo.files):
        if name.startswith('site/data/watchlist/archive/') and name.endswith('.json'):
            obj = data(name[5:])
            inv.add(obj, 'watchlist:' + obj['id'], obj.get('as_of'), 'watchlist_report',
                    obj.get('title', ''), 'data/watchlist/reports/' + obj['id'] + '.html', 'as_of')
    obj = data('data/watchlist/latest.json')
    if obj:
        inv.add(obj, 'watchlist:' + obj['id'], obj.get('as_of'), 'watchlist_report',
                obj.get('title', ''), 'data/watchlist/reports/' + obj['id'] + '.html', 'as_of')
    obj = data('data/credit-issues.json')
    for edition in (obj or {}).get('editions', []):
        inv.add(edition, 'credit:' + edition['id'], edition.get('checked_at'), 'credit_report',
                'Credit issuance · ' + edition['id'], 'data/credit-issues.json', 'checked_at')
    modules = [
        ('data/headline-context.json', 'generated_at', 'Headline research context', 'data/headline-context.json'),
        ('data/history-fed.json', 'retrieved_at', 'Federal Reserve historical data', 'data/history-fed.json'),
        ('data/sgs-daily-snapshot.json', 'checked_at', 'Singapore government yields', 'data/sgs-daily-snapshot.json'),
        ('data/ust-curves-daily.json', 'retrieved_at', 'U.S. Treasury yield curves', 'data/ust-curves-daily.json'),
        ('data/watchlist/company-resources.json', 'verified_on', 'Company research resources', 'data/watchlist/company-resources.json'),
        ('research/singapore/source-data.json', 'verified_on', 'Singapore public finances research', 'research/singapore/index.html'),
    ]
    for path, date_key, title, report_path in modules:
        obj = data(path)
        if obj:
            inv.add(obj, 'module:' + path, obj.get(date_key), 'research_module', title, report_path, date_key)
    metadata = data('market-understanding/market-content.json')
    sources = data('market-understanding/source-register.json')
    if metadata and sources:
        inv.add(sources, 'module:market-understanding', metadata.get('reviewed_at'), 'research_module',
                'Market understanding', 'market-understanding/index.html', 'reviewed_at')
    path = 'research/googl/index.html'
    contents = repo.read('site/' + path)
    if contents:
        # This public report has an explicit research date in its footer.
        m = re.search(r'Research as of (\d{1,2} [A-Za-z]+ \d{4})', contents)
        if m:
            inv.inputs.append(path)
            date = dt.datetime.strptime(m.group(1), '%d %B %Y').date().isoformat()
            parser = PublicAnchorParser()
            parser.feed(contents)
            inv.add({}, 'module:googl-research', date, 'research_module', 'Alphabet company research',
                    path, 'report_footer_date', links=parser.links)
    return inv.output(repo.revision), {'revision': repo.revision, 'public_inputs': sorted(set(inv.inputs)),
                                       'excluded_url_occurrences_by_reason': dict(sorted(inv.exclusions.items()))}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', required=True)
    parser.add_argument('--revision', default=DEFAULT_REVISION)
    parser.add_argument('--output', required=True)
    parser.add_argument('--audit', help='Optional extraction audit, not intended for publication')
    args = parser.parse_args()
    result, audit = extract(args.repo, args.revision)
    Path(args.output).write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    if args.audit:
        Path(args.audit).write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(result['statistics']))

if __name__ == '__main__':
    main()
