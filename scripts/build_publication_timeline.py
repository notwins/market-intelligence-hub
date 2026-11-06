"""Collate already-public documents and article metadata, without fetching private sources.

Repository introduction time is evidence of hub availability, NOT a historical Pages
completion time or the original author's publication date. Reuters uses its saved
publisher timestamp instead. Missing history remains undated, never guessed.
"""
import argparse
import hashlib
import html
import json
import re
import subprocess
from html.parser import HTMLParser
from datetime import datetime, timezone
from pathlib import Path
from public_display_text import public_display_payload
from urllib.parse import urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parents[1]


def git(root, *args):
    p = subprocess.run(['git', *args], cwd=root, capture_output=True, text=True)
    return p.stdout if p.returncode == 0 else ''


def read(path, fallback=None):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return fallback if fallback is not None else {}


def timestamp(value):
    try:
        d = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        return d.astimezone(timezone.utc).isoformat() if d.tzinfo else None
    except (ValueError, TypeError):
        return None


def public_url(value):
    if not isinstance(value, str):
        return None
    try:
        u = urlsplit(value)
        if u.scheme == 'https' and u.hostname and not u.username and not u.password:
            if u.hostname.lower() in ['chatgpt.com', 'chat.openai.com']:
                return None
            return value
    except ValueError:
        pass
    return None


def canonical_url(value):
    u = urlsplit(value)
    return urlunsplit((u.scheme.lower(), u.netloc.lower(), u.path.rstrip('/'), u.query, ''))


def additions(root):
    result = {}
    text = git(root, 'log', '--reverse', '--diff-filter=A', '--format=COMMIT:%H|%cI', '--name-only', '--', 'site')
    commit = date = None
    for line in text.splitlines():
        if line.startswith('COMMIT:'):
            commit, date = line[7:].split('|', 1)
        elif line.startswith('site/') and commit:
            result.setdefault(line[5:], {'at': timestamp(date), 'commit': commit})
    return result


def parse_payload(text, javascript=False):
    if javascript:
        text = text.split('=', 1)[1].strip().rstrip(';')
    return json.loads(text)


def first_records(root, path, key, javascript=False):
    """First appearance of an explicit saved ID, not last modification of a file."""
    found = {}
    for line in git(root, 'log', '--reverse', '--format=%H|%cI', '--', 'site/' + path).splitlines():
        commit, date = line.split('|', 1)
        raw = git(root, 'show', commit + ':site/' + path)
        try:
            records = parse_payload(raw, javascript).get(key, [])
        except (ValueError, IndexError, AttributeError):
            continue
        for record in records:
            if record.get('id'):
                found.setdefault(record['id'], {'at': timestamp(date), 'commit': commit})
    return found


def page_title(path):
    text = path.read_text()
    match = re.search(r'<title[^>]*>(.*?)</title>', text, re.S | re.I)
    return html.unescape(re.sub('<[^>]+>', '', match[1])).strip() if match else path.stem



def useful_summary(value, title=''):
    """Use existing editorial text only; never turn provenance into article content."""
    if not isinstance(value, str):
        return None
    text = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]*>', '', value))).strip()
    if len(text) < 45 or text.casefold() == title.strip().casefold():
        return None
    if re.match(r'^(?:Saved (?:Reuters|research|edition)|Summary (?:not|unavailable)|No summary|Article body|Read the (?:original|full)|Not (?:personalised|personalized) investment advice)', text, re.I):
        return None
    # Preserve qualifying text rather than chopping off the end of a claim.
    return text if len(text) <= 900 else None


class ArticleDescription(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.description = None
        self.leads = []
        self.paragraph = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'meta' and attrs.get('name', '').lower() == 'description':
            self.description = attrs.get('content')
        if tag == 'p' and set(attrs.get('class', '').split()) & {'dek', 'deck', 'lede', 'lead', 'intro', 'takeaway'}:
            self.paragraph = []

    def handle_data(self, value):
        if self.paragraph is not None:
            self.paragraph.append(value)

    def handle_endtag(self, tag):
        if tag == 'p' and self.paragraph is not None:
            self.leads.append(''.join(self.paragraph))
            self.paragraph = None


def article_summary(path, title=''):
    # Do not amplify order screenshots or personal transaction material in cards.
    if 'calls' in path.parts or not path.is_file() or path.suffix != '.html':
        return None
    parser = ArticleDescription()
    parser.feed(path.read_text())
    return next((text for value in parser.leads[:1] + [parser.description]
                 if (text := useful_summary(value, title))), None)


def verified_reuters_summary(item, contexts):
    saved = next((x for x in contexts if x.get('id') == item.get('id')
                  and x.get('title') == item.get('title')
                  and x.get('published_at') == item.get('published_at')), item)
    if saved.get('summary_verified') is True and public_url(saved.get('summary_source_url')):
        text = useful_summary(saved.get('summary'), item.get('title', ''))
        if text:
            return {'summary': text, 'summary_source_url': saved['summary_source_url']}
    return {}


def title_terms(title, standard):
    """Conservative explicit terms from the locked V1 mappings in merged V1.2.

    No bare short/ambiguous tickers, geography inference or sentiment colouring.
    Offsets are UTF-16 units so the browser slices Unicode headlines correctly.
    """
    allowed = {'Federal Reserve', 'Fed', 'FOMC', 'Monetary Authority of Singapore', 'MAS',
               'Swiss National Bank', 'SNB', 'European Central Bank', 'ECB', 'Bank of England',
               'Bank of Japan', 'CPF LIFE', 'CPF', 'Temasek', 'GIC', 'Nvidia', 'NVIDIA',
               'Microsoft', 'Amazon', 'Alphabet', 'Google', 'Apple', 'Meta Platforms',
               'Broadcom', 'TSMC', 'Micron', 'PIMCO', 'OCBC', 'DBS', 'UOB', 'JPMorgan',
               'Goldman Sachs', 'Berkshire Hathaway', 'USD/SGD', 'USD/CHF', 'CHF/SGD',
               'US Treasuries', 'Treasury STRIPS', 'private credit', 'gold', 'artificial intelligence', 'AI'}
    candidates = []
    for group in standard.get('keyword_groups', []):
        for alias in group.get('aliases', []):
            if alias not in allowed:
                continue
            flags = 0 if alias.isupper() or len(alias) <= 3 else re.I
            for match in re.finditer(r'(?<![\w/])' + re.escape(alias) + r'(?![\w/])', title, flags):
                candidates.append((match.start(), match.end(), group.get('priority', 0), group['text_light']))
    chosen = []
    for start, end, priority, color in sorted(candidates, key=lambda x: (-(x[1]-x[0]), -x[2], x[0])):
        if not any(start < b and end > a for a, b, _, _ in chosen):
            chosen.append((start, end, priority, color))
    units = lambda offset: len(title[:offset].encode('utf-16-le')) // 2
    return [{'start': units(a), 'end': units(b), 'color': c} for a, b, _, c in sorted(chosen)]

def build(root=ROOT, now=None):
    root = Path(root)
    site = root / 'site'
    added = additions(root)
    rows = []
    seen = set()
    missing = []
    manifests = {}
    for path in sorted(site.rglob('publication.json')):
        data = read(path)
        base = path.parent.parent if path.parent.name == 'presentations' else path.parent
        for item in data.get('files', []) + data.get('presentations', {}).get('files', []):
            target = base / item.get('path', '')
            if target.is_file():
                manifests[target.relative_to(site).as_posix()] = {'title': data.get('title', base.name) + ' · ' + item.get('title', target.stem), 'as_of': data.get('as_of')}

    def add(identity, title, href, category, source, timing=None, **extra):
        if identity in seen:
            return
        seen.add(identity)
        row = {'id': hashlib.sha256(identity.encode()).hexdigest()[:20], 'title': title, 'href': href,
               'category': category, 'source': source, 'at': (timing or {}).get('at'),
               'date_basis': 'Added to hub repository', **extra}
        if (timing or {}).get('commit'):
            row['provenance_url'] = 'https://github.com/notwins/market-intelligence-hub/commit/' + timing['commit']
        if not row['at']:
            missing.append(title)
        rows.append(row)

    # Only files already within the published public site, never workspace/private inputs.
    for base in ['research', 'market-understanding']:
        for path in sorted((site / base).rglob('*')):
            if not path.is_file() or path.suffix.lower() not in ['.html', '.pdf', '.pptx', '.docx', '.xlsx', '.xls', '.csv', '.md']:
                continue
            rel = path.relative_to(site).as_posix()
            if rel == 'market-understanding/index.html':
                continue  # Navigation/catalogue, not a research document.
            manifest = manifests.get(rel, {})
            title = manifest.get('title') or (page_title(path) if path.suffix == '.html' else ((page_title(path.parent / 'index.html') + ' · ' + path.suffix[1:].upper()) if (path.parent / 'index.html').is_file() else path.stem.replace('_', ' ')))
            kind = {'.html': 'Research article', '.pdf': 'PDF document', '.pptx': 'Slide deck', '.docx': 'Word document', '.xlsx': 'Workbook', '.xls': 'Workbook', '.csv': 'Data document', '.md': 'Markdown document'}[path.suffix.lower()]
            source = 'Hub research'
            add('document:' + rel, title, rel, 'research', source, added.get(rel),
                kind=kind, format=path.suffix[1:].upper(),
                attribution='Individual user / GPT authorship is not recorded in this catalogue.',
                source_date=manifest.get('as_of'),
                **({'summary': summary} if (summary := article_summary(path, title)) else {}))

    reports = read(site / 'data/watchlist/report-index.json').get('reports', [])
    editions = {x.get('id'): x for x in read(site / 'data/watchlist/index.json').get('editions', [])}
    invalid_watchlist = 0
    for report in reports:
        rel = report.get('path', '')
        if not re.fullmatch(r'data/watchlist/reports/watchlist-[A-Za-z0-9]+\.html', rel):
            invalid_watchlist += 1
            continue
        path = site / rel
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != report.get('sha256'):
            invalid_watchlist += 1
            continue
        eid = report.get('edition_id', '')
        add('document:' + rel, editions.get(eid, {}).get('title', '12-name watchlist · ' + eid),
            'watchlist-report.html?edition=' + eid, 'automation', 'Scheduled watchlist', added.get(rel),
            kind='Automated report', format='HTML', source_date=report.get('as_of'),
            **({'summary': summary} if (summary := useful_summary(editions.get(eid, {}).get('summary'))) else {}))

    for rel, key, js in [('v2-data.js', 'reports', True), ('data/reports.json', 'reports', False), ('data/hourly-news.json', 'editions', False)]:
        try:
            data = parse_payload((site / rel).read_text(), js)
        except (OSError, ValueError, IndexError):
            continue
        dates = first_records(root, rel, key, js)
        for item in data.get(key, []):
            eid = item.get('id')
            if not eid:
                continue
            hourly = key == 'editions'
            title = ('Reuters hourly scan · ' + str(item.get('report_at', eid))) if hourly else item.get('title', eid)
            href = 'v4.html#hourly' if hourly else ('v4.html#reports' if js else 'archive.html?report=' + eid + '#report-' + eid)
            add(('hourly:' if hourly else 'report:') + eid, title, href, 'automation', 'GPT / scheduled briefing', dates.get(eid),
                kind='Hourly report' if hourly else 'Scheduled report', format='HTML',
                report_id=eid if js else None,
                source_date=item.get('report_at') or item.get('date'),
                **({'summary': summary} if (summary := useful_summary(item.get('takeaway') or item.get('summary') or item.get('subtitle'), title)) else {}))

    # Reuters is external publisher metadata. Do not relabel an article's date as hub publication.
    files = [site / 'data/news.json', *sorted((site / 'data/archive').glob('*.json'))]
    latest_news = None
    contexts = read(site / 'data/headline-context.json').get('items', [])
    news_seen = set()
    for path in files:
        data = read(path)
        stamp = timestamp(data.get('generated_at'))
        if path.name == 'news.json':
            latest_news = stamp
        for item in data.get('items', []):
            if str(item.get('publisher', 'Reuters')).casefold() != 'reuters':
                continue
            url = public_url(item.get('url'))
            at = timestamp(item.get('published_at'))
            if not url or not at:
                continue
            # Stable publisher IDs deduplicate repeated daily snapshots; canonical URL is fallback.
            identity = str(item.get('id') or canonical_url(url))
            normalized_title = re.sub(r'\s+', ' ', item.get('title', '').strip()).casefold()
            key = (canonical_url(url), at)
            if identity in news_seen or key in news_seen or (normalized_title, at) in news_seen:
                continue
            news_seen.update([identity, key, (normalized_title, at)])
            add('reuters:' + identity, item.get('title', 'Reuters headline'), url, 'reuters', 'Reuters', {'at': at},
                kind='External article', format='LINK', date_basis='Reuters publication time',
                **verified_reuters_summary(item, contexts))

    rows.sort(key=lambda x: (x['at'] or '', x['id']), reverse=True)
    now = now or datetime.now(timezone.utc)
    payload = {'schema_version': 1, 'built_at': now.isoformat(), 'timezone': 'Asia/Singapore',
               'window': 'Today and the previous two Singapore calendar days',
               'coverage': 'Already-public hub research pages, PDFs, slide decks, downloadable documents/workbooks, saved scheduled/hourly editions, verified watchlist reports, and saved Reuters headline metadata from all retained daily archives. Not every private chat, unpublished file, or Reuters wire article.',
               'date_note': 'Hub entries use first addition to the public repository, not original authorship, data date, or a verified historical Pages deployment time. Reuters uses the saved publisher timestamp. Source edition dates remain separate.',
               'summary_note': 'Descriptions use existing public article descriptions or saved report summaries. Reuters descriptions require an exact matched, source-checked summary. Entries without a useful saved description have no summary control.',
               'reuters_note': 'Reuters links use saved publisher metadata via Google News and open the publisher route. Article bodies are not hosted.',
               'authorship_note': 'Hub research combines user and GPT work; individual authorship is not consistently recorded. Scheduled reports are separately labelled. No authorship is guessed.',
               'feeds': {'reuters_saved_at': latest_news, 'hourly_report_at': (read(site / 'data/hourly-news.json').get('editions') or [{}])[0].get('report_at')},
               'undated_count': len(missing), 'undated_titles': missing, 'invalid_watchlist_reports': invalid_watchlist,
               'counts': {kind: sum(row['category'] == kind for row in rows) for kind in ['research', 'automation', 'reuters']},
               'entries': rows}
    payload = public_display_payload(payload)
    standard = read(site / 'data/keyword-colour-standard.json')
    for row in payload['entries']:
        terms = title_terms(row['title'], standard)
        if terms and row.get('kind') != 'Hourly report':
            row['title_terms'] = terms

    (site / 'data/publication-timeline.json').write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n')
    return payload


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=ROOT)
    args = parser.parse_args()
    result = build(args.root)
    print(json.dumps({'counts': result['counts'], 'undated': result['undated_count'], 'invalid_watchlist_reports': result['invalid_watchlist_reports']}))
