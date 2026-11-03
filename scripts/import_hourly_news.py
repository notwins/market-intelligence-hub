"""Publish reviewed, public-only hourly report extracts; never fetch news implicitly.

Usage: python scripts/import_hourly_news.py incoming.json [--site-root site]
Incoming is {"editions": [...]}; IDs and published story versions are immutable.
The operator must check the completed source report and verify Reuters facts first.
"""
import argparse
import copy
import json
import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

SGT = timezone(timedelta(hours=8))
SOURCE_NAME = 'Reuters Hourly News'
SOURCE_CHAT = 'https://chatgpt.com/c/6ae6ab06-c2b0-83ec-8029-537540a31041'


def timestamp(value):
    if not isinstance(value, str):
        raise ValueError('Timestamp with timezone required')
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.tzinfo is None:
        raise ValueError('Timestamp with timezone required')
    return result


def https(value, hosts=None):
    p = urlparse(value or '')
    if p.scheme != 'https' or not p.hostname or p.username or p.password:
        raise ValueError('Public HTTPS source required')
    if hosts and not any(p.hostname == h or p.hostname.endswith('.' + h) for h in hosts):
        raise ValueError('Unexpected source publisher')


def identifier(value):
    if not isinstance(value, str) or not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,119}', value):
        raise ValueError('Stable public identifier required')


def source_publication(source, cutoff, report, edition):
    """Retain date precision without manufacturing an original publication time."""
    precision = source.get('publication_precision', 'timestamp')
    value = source.get('published_at')
    if precision == 'timestamp':
        published = timestamp(value)
        if not cutoff - timedelta(days=7) <= published <= cutoff:
            raise ValueError('Reuters source outside eligible seven-day window')
        if 'published_date' in source and source['published_date'] is not None:
            raise ValueError('Exact publication uses published_at only')
        if source.get('updated_at') and not published <= timestamp(source['updated_at']) <= report:
            raise ValueError('Invalid source update time')
        return
    if precision != 'date' or 'published_at' not in source or value is not None:
        raise ValueError('Publication precision must agree with published_at')
    raw_date = source.get('published_date')
    if not isinstance(raw_date, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', raw_date):
        raise ValueError('Verified original publication date required')
    published_date = date.fromisoformat(raw_date)
    cutoff_date = cutoff.astimezone(SGT).date()
    # Exclude the oldest calendar day: a date alone cannot resolve its seven-day boundary.
    if not cutoff_date - timedelta(days=7) < published_date <= cutoff_date:
        raise ValueError('Publication date outside eligible calendar days or on uncertain boundary')
    if edition['coverage'] == 'complete' or not edition['limitations']:
        raise ValueError('Date-only source timing requires explicit partial coverage limitations')
    if source.get('updated_at'):
        updated = timestamp(source['updated_at'])
        if updated > report or updated.astimezone(SGT).date() < published_date:
            raise ValueError('Invalid source update time')


def validate(edition, now=None):
    now = now or datetime.now(SGT)
    allowed = {'id', 'report_at', 'cutoff', 'window_start', 'coverage', 'summary',
               'limitations', 'original_url', 'sources', 'stories'}
    if not isinstance(edition, dict) or set(edition) != allowed:
        raise ValueError('Use the public edition schema; private or unknown fields are rejected')
    identifier(edition['id'])
    if ':' in edition['id']:
        raise ValueError('Edition ID must be a safe archive filename')
    start, cutoff, report = [timestamp(edition[k]) for k in ('window_start', 'cutoff', 'report_at')]
    if not start <= cutoff <= report <= now:
        raise ValueError('Report window, cutoff or completion time is invalid')
    if edition['coverage'] not in ('complete', 'partial', 'unavailable'):
        raise ValueError('Explicit coverage status required')
    if not isinstance(edition['summary'], str) or not edition['summary'].strip():
        raise ValueError('Public summary required')
    if not isinstance(edition['limitations'], list) or not all(isinstance(x, str) for x in edition['limitations']):
        raise ValueError('Coverage limitations must be text')
    if edition['coverage'] != 'complete' and not edition['limitations']:
        raise ValueError('Incomplete coverage must state the gap')
    https(edition['original_url'], ['chatgpt.com'])
    if not isinstance(edition['sources'], list) or not isinstance(edition['stories'], list):
        raise ValueError('Sources and stories must be lists')
    urls = set()
    for source in edition['sources']:
        if set(source) - {'url', 'title', 'published_at', 'updated_at', 'verification_url',
                          'published_date', 'publication_precision'}:
            raise ValueError('Unknown source field')
        https(source.get('url'), ['reuters.com'])
        if not source.get('title'):
            raise ValueError('Reuters article title required')
        source_publication(source, cutoff, report, edition)
        if source.get('verification_url'):
            https(source['verification_url'])
        if source['url'] in urls:
            raise ValueError('Duplicate source URL')
        urls.add(source['url'])
    seen = set()
    fields = {'story_id', 'version', 'status', 'freshness', 'topic', 'headline', 'body',
              'analysis', 'watch_next', 'earlier', 'source_urls', 'development_at'}
    for story in edition['stories']:
        if set(story) != fields:
            raise ValueError('Use the public story schema')
        identifier(story['story_id'])
        if story['story_id'] in seen:
            raise ValueError('One version per underlying story in an edition')
        seen.add(story['story_id'])
        if type(story['version']) is not int or story['version'] < 1:
            raise ValueError('Positive story version required')
        if story['status'] not in ('new', 'follow-up', 'correction'):
            raise ValueError('Unknown story status')
        if story['freshness'] not in ('current', 'breaking', 'catch-up'):
            raise ValueError('Unknown freshness label')
        if any(not isinstance(story[k], str) for k in ('topic', 'headline', 'body', 'analysis', 'watch_next', 'earlier')):
            raise ValueError('Story text required')
        if not all(story[k].strip() for k in ('topic', 'headline', 'body')):
            raise ValueError('Empty story')
        if story['status'] != 'new' and not story['earlier'].strip():
            raise ValueError('Follow-ups and corrections must explain the earlier fact')
        if not isinstance(story['source_urls'], list) or not story['source_urls'] or not set(story['source_urls']) <= urls:
            raise ValueError('Every story needs verified Reuters source references')
        development = story['development_at']
        if development is not None:
            observed = timestamp(development)
            if observed > cutoff or observed < cutoff - timedelta(days=7):
                raise ValueError('Invalid development time')
            if observed < start and story['freshness'] != 'catch-up':
                raise ValueError('Older discoveries must be labelled catch-up')
        elif story['freshness'] == 'breaking':
            raise ValueError('Breaking requires a verified development time')
    return edition


def empty_feed():
    return {'schema_version': 1, 'source_name': SOURCE_NAME, 'source_url': SOURCE_CHAT,
            'publisher_checked_at': None, 'last_complete_cutoff': None,
            'source_schedule': {'status': 'Unknown', 'checked_at': None}, 'editions': []}


def merge(current, incoming, now=None):
    now = now or datetime.now(SGT)
    if set(incoming) - {'editions', 'source_schedule'} or not isinstance(incoming.get('editions'), list):
        raise ValueError('Incoming editions array required')
    result = copy.deepcopy(current)
    records = {x['id']: x for x in current['editions']}
    changed = False
    if 'source_schedule' in incoming:
        state = incoming['source_schedule']
        if set(state) != {'status', 'checked_at'} or state['status'] not in ('Active', 'Paused', 'Unknown'):
            raise ValueError('Public source schedule state required')
        if timestamp(state['checked_at']) > now:
            raise ValueError('Future schedule check')
        if result.get('source_schedule', {}).get('status') != state['status']:
            result['source_schedule'] = copy.deepcopy(state)
            changed = True
    for edition in incoming['editions']:
        validate(edition, now)
        old = records.get(edition['id'])
        if old is not None:
            if old != edition:
                raise ValueError('Published edition IDs are immutable; issue a new correction edition')
            continue
        records[edition['id']] = copy.deepcopy(edition)
        changed = True
    if not changed:
        return result, False
    ordered = sorted(records.values(), key=lambda x: (timestamp(x['report_at']), x['id']))
    versions = {}
    for edition in ordered:
        for story in edition['stories']:
            key = (story['story_id'], story['version'])
            if key in versions:
                raise ValueError('Duplicate story version; reuse history instead of republishing the same facts')
            previous = versions.get((story['story_id'], story['version'] - 1))
            if story['version'] == 1:
                if story['status'] != 'new':
                    raise ValueError('Initial story version must be new')
            elif previous is None or story['status'] == 'new':
                raise ValueError('Follow-up version must connect to retained history')
            versions[key] = story
    result['editions'] = list(reversed(ordered))
    complete = [x['cutoff'] for x in ordered if x['coverage'] == 'complete']
    result['last_complete_cutoff'] = max(complete, key=timestamp) if complete else None
    result['publisher_checked_at'] = now.isoformat(timespec='seconds')
    return result, True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('incoming', type=Path)
    parser.add_argument('--site-root', type=Path, default=Path(__file__).resolve().parents[1] / 'site')
    args = parser.parse_args()
    target = args.site_root / 'data/hourly-news.json'
    current = json.loads(target.read_text(encoding='utf-8')) if target.exists() else empty_feed()
    result, changed = merge(current, json.loads(args.incoming.read_text(encoding='utf-8')))
    if not changed:
        print('No new completed hourly report. No files changed.')
        return
    # Validate everything before any archive or publication mutation.
    archive = args.site_root / 'data/hourly-archive'
    archive.mkdir(parents=True, exist_ok=True)
    for edition in result['editions']:
        path = archive / (edition['id'] + '.json')
        content = json.dumps(edition, ensure_ascii=False, indent=2) + '\n'
        if path.exists() and json.loads(path.read_text(encoding='utf-8')) != edition:
            raise ValueError('Immutable archive conflicts with reviewed edition')
    for edition in result['editions']:
        path = archive / (edition['id'] + '.json')
        if not path.exists():
            path.write_text(json.dumps(edition, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    target.parent.mkdir(parents=True, exist_ok=True)
    temp = target.with_suffix('.json.tmp')
    temp.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temp.replace(target)
    print('Merged reviewed hourly editions. Publish hourly-news.json and new hourly-archive files.')


if __name__ == '__main__':
    main()

