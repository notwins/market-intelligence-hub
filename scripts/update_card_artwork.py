"""Assign local illustrations to the public Hub cards without changing the source feeds."""
import argparse
import json
from pathlib import Path
import re
from urllib.request import urlopen

CONTENT = 'https://notwins.github.io/market-intelligence-content/data/'
OUTPUT = Path(__file__).resolve().parents[1] / 'site/data/card-artwork.json'
REPORT_ID = re.compile(r'[a-z][a-z0-9-]{1,189}-\d{4}-\d{2}-\d{2}(?:-r[1-9][0-9]*)?')
EDITION_DATE = re.compile(r'\d{4}-\d{2}-\d{2}')
TOPICS = {'news': 'macro', 'bonds': 'credit', 'earnings': 'equities', 'economy': 'macro'}


def feed(filename):
    with urlopen(CONTENT + filename, timeout=25) as response:
        result = json.load(response)
    if not isinstance(result, dict) or result.get('schema_version') != 1:
        raise ValueError(f'Unexpected public feed schema for {filename}')
    return result


def choose(record):
    category = str(record.get('category', '')).lower()
    tags = ' '.join(str(tag) for tag in record.get('tags', []))
    if re.search(r'bond|credit|treasur|rates|fixed income', category):
        return 'credit'
    if re.search(r'earnings|equity|shares|stock|company', category):
        return 'equities'
    if re.search(r'macro|fx|central bank|economy', category):
        return 'macro'
    if re.search(r'ticker\.|equities_shares|corporate_earnings|semiconductor', tags):
        return 'equities'
    if re.search(r'credit_spread|asset\.bonds|treasury_yields', tags):
        return 'credit'
    return 'macro'


def assignments(research, briefings):
    records, editions = research.get('records'), briefings.get('editions')
    if not isinstance(records, list) or not isinstance(editions, list) or not editions:
        raise ValueError('Public card collections unavailable')
    reports = {}
    for record in records:
        key = record.get('id')
        if not isinstance(key, str) or not REPORT_ID.fullmatch(key) or key in reports:
            raise ValueError('Unexpected or duplicate public report ID')
        if record.get('kind') != 'complete-report':
            continue
        reports[key] = choose(record)
    daily = {}
    for edition in editions:
        day = edition.get('date')
        if not isinstance(day, str) or not EDITION_DATE.fullmatch(day) or day in daily:
            raise ValueError('Unexpected or duplicate public briefing date')
        daily[day] = {key: art for key, art in TOPICS.items() if key in edition.get('reports', {})}
    return {'schema_version': 1, 'briefings': daily, 'reports': reports}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=OUTPUT)
    args = parser.parse_args()
    result = assignments(feed('research-feed.json'), feed('daily-desk.json'))
    content = (json.dumps(result, indent=2, sort_keys=True) + '\n').encode()
    if args.output.is_file() and args.output.read_bytes() == content:
        print('No new artwork assignments.')
        return
    temporary = args.output.with_suffix('.json.tmp')
    temporary.write_bytes(content)
    temporary.replace(args.output)
    print(f"Saved {len(result['reports'])} research assignments and {len(result['briefings'])} briefing dates.")


if __name__ == '__main__':
    main()
