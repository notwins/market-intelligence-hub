"""Assign allowlisted local artwork to cards from the public Hub feeds."""
import argparse
from datetime import datetime
import json
from pathlib import Path
import re
from tempfile import NamedTemporaryFile
from urllib.request import urlopen

CONTENT = 'https://notwins.github.io/market-intelligence-content/data/'
SITE = Path(__file__).resolve().parents[1] / 'site'
OUTPUT = SITE / 'data/card-artwork.json'
REPORT_ID = re.compile(r'[a-z][a-z0-9-]{1,189}-\d{4}-\d{2}-\d{2}(?:-r[1-9][0-9]*)?')
EDITION_DATE = re.compile(r'\d{4}-\d{2}-\d{2}')
STORY_ID = re.compile(r'[A-Za-z0-9][A-Za-z0-9._:-]{1,189}')
ART_KEY = re.compile(r'[a-z0-9]+(?:-[a-z0-9]+)*')
BRIEFINGS = {'news': 'markets', 'bonds': 'rates', 'earnings': 'markets', 'economy': 'economy'}


def feed(filename):
    with urlopen(CONTENT + filename, timeout=25) as response:
        result = json.load(response)
    if not isinstance(result, dict) or result.get('schema_version') != 1:
        raise ValueError(f'Unexpected public feed schema for {filename}')
    return result


def load_library():
    payload = json.loads((SITE / 'data/card-artwork-library.json').read_text(encoding='utf-8'))
    pools = payload['pools']
    asset_dir = SITE / 'assets/card-art/library'
    keys = {key for pool in pools.values() for key in pool}
    if (payload['schema_version'] != 1 or any(not pool for pool in pools.values())
            or any(not ART_KEY.fullmatch(key) for key in keys)
            or keys != {file.stem for file in asset_dir.glob('*.webp')}):
        raise ValueError('Artwork library does not match the local WebP files')
    rules = [(topic, re.compile(pattern, re.IGNORECASE | re.ASCII)) for topic, pattern in payload['rules']]
    if {topic for topic, _ in rules} != set(pools):
        raise ValueError('Every artwork topic needs a local pool and a matching rule')
    return pools, rules


def seed_hash(identity):
    # FNV-1a also runs in the browser for cards that appear between daily refreshes.
    value = 2166136261
    for byte in identity.encode('utf-8'):
        value = ((value ^ byte) * 16777619) & 0xffffffff
    return value


def topic_for(rules, *signals, default='markets'):
    for signal in signals:
        if isinstance(signal, str):
            topic = next((topic for topic, rule in rules if rule.search(signal)), None)
            if topic:
                return topic
    return default


def rotate(pool, identity, last_used, index):
    # Stable starting point, then prefer the image seen least recently in this list.
    offset = seed_hash(identity) % len(pool)
    order = pool[offset:] + pool[:offset]
    key = min(order, key=lambda candidate: last_used.get(candidate, -1))
    last_used[key] = index
    return key


def rotate_list(pools, topics, prefix=''):
    last_used = {}
    return {key: rotate(pools[topic], prefix + key, last_used, index)
            for index, (key, topic) in enumerate(topics.items())}


def assignments(research, briefings, hourly, library):
    records, editions, scans = research.get('records'), briefings.get('editions'), hourly.get('editions')
    if not all(isinstance(rows, list) and rows for rows in (records, editions, scans)):
        raise ValueError('Public card collections unavailable')
    pools, rules = library
    reports = {}
    seen = set()
    for record in records:
        key = record.get('id')
        if not isinstance(key, str) or not REPORT_ID.fullmatch(key) or key in seen:
            raise ValueError('Unexpected or duplicate public report ID')
        seen.add(key)
        if record.get('kind') == 'complete-report':
            reports[key] = topic_for(rules, record.get('title'), record.get('category'),
                                     ' '.join(record.get('tags') or []), record.get('summary'))

    daily = {}
    for edition in editions:
        day = edition.get('date')
        sections = edition.get('reports')
        if (not isinstance(day, str) or not EDITION_DATE.fullmatch(day) or day in daily
                or not isinstance(sections, dict) or not BRIEFINGS.keys() <= sections.keys()):
            raise ValueError('Unexpected or duplicate public briefing edition')
        daily[day] = {}
        for topic, default in BRIEFINGS.items():
            summary = sections[topic]['summary'] if topic == 'news' else ''
            daily[day][topic] = topic_for(rules, summary, default=default)

    latest = {}
    for scan in scans:
        for story in scan['stories']:
            key, version = story.get('story_id'), story.get('version')
            if not isinstance(key, str) or not STORY_ID.fullmatch(key) or type(version) is not int or version < 1:
                raise ValueError('Unexpected public news story ID or version')
            if key not in latest or version > latest[key][0]['version']:
                stamp = scan.get('report_at')
                latest[key] = (story, datetime.fromisoformat(stamp).timestamp() if stamp else 0)
    ordered = sorted(latest.items(), key=lambda entry: entry[1][1], reverse=True)
    news = {key: topic_for(rules, story.get('headline'), story.get('topic')) for key, (story, _) in ordered}
    return {'schema_version': 1,
            'briefings': {day: rotate_list(pools, topics, day + ':') for day, topics in daily.items()},
            'reports': rotate_list(pools, reports),
            'news': rotate_list(pools, news),
            'topics': {'briefings': daily, 'reports': reports, 'news': news}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=OUTPUT)
    args = parser.parse_args()
    library = load_library()
    result = assignments(feed('research-feed.json'), feed('daily-desk.json'), feed('hourly-news.json'), library)
    content = (json.dumps(result, indent=2, sort_keys=True) + '\n').encode()
    if args.output.is_file() and args.output.read_bytes() == content:
        print('No new artwork assignments.')
        return
    with NamedTemporaryFile(dir=args.output.parent, suffix='.json.tmp', delete=False) as handle:
        handle.write(content)
        temporary = Path(handle.name)
    try:
        temporary.replace(args.output)
    finally:
        temporary.unlink(missing_ok=True)
    print(f"Saved {len(result['reports'])} research assignments, {len(result['briefings'])} briefing dates "
          f"and {len(result['news'])} news stories.")


if __name__ == '__main__':
    main()
