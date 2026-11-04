"""Bind an explicit public-content/scope review to one immutable watchlist edition.

This does not verify external facts. Source verification remains the edition
producer's attestation. Drafts start pending and cannot authorize publication.
"""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
from import_watchlist import validate, fail, exact_keys, text, stamp, write_json

BINDING = 'watchlist-research-v1'
SCOPES = {'company', 'market_context', 'price_context', 'omit'}


def canonical(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), sort_keys=True, allow_nan=False)


def digest(value):
    return hashlib.sha256(canonical(value).encode('utf-8')).hexdigest()


def content_key(item):
    # A fixed-order string-only tuple has identical JSON in Python and browsers.
    return json.dumps([item['date'], item['headline'], item['facts'], item['analysis'],
                       item['risks'], item['next_watch'],
                       [[s['title'], s['url']] for s in item['sources']]],
                      ensure_ascii=False, separators=(',', ':'), allow_nan=False)


def all_items(edition):
    return {(row['ticker'], i): item for row in edition['rows']
            for i, item in enumerate(row['research'])}


def template(edition):
    d = validate(edition)
    return {'schema_version': 1, 'edition_id': d['id'], 'as_of': d['as_of'],
            'edition_sha256': digest(d), 'reviewed_at': None,
            'public_content_reviewed': False,
            'items': [{'ticker': ticker, 'index': i, 'headline': x['headline'],
                       'item_sha256': digest(x), 'scope': 'pending', 'reason': ''}
                      for (ticker, i), x in all_items(d).items()]}


def validate_review(edition, review, now=None):
    d = validate(edition, now=now)
    exact_keys(review, {'schema_version', 'edition_id', 'as_of', 'edition_sha256',
                        'reviewed_at', 'public_content_reviewed', 'items'}, 'Research review')
    fail(review.get('schema_version') == 1, 'Unsupported research review schema')
    fail(review.get('edition_id') == d['id'] and review.get('as_of') == d['as_of'],
         'Review belongs to a different edition or cutoff')
    fail(review.get('edition_sha256') == digest(d), 'Review edition content has changed')
    fail(review.get('public_content_reviewed') is True, 'Public content review is incomplete')
    checked = stamp(review['reviewed_at'])
    fail(stamp(d['generated_at']) <= checked <= (now or dt.datetime.now(dt.timezone.utc)) + dt.timedelta(minutes=5),
         'Review time must follow edition preparation and not be in the future')
    fail(isinstance(review.get('items'), list), 'Review items must be a list')
    expected, seen = all_items(d), set()
    for decision in review['items']:
        exact_keys(decision, {'ticker', 'index', 'headline', 'item_sha256', 'scope', 'reason'}, 'Review item')
        fail(type(decision.get('index')) is int, 'Review index must be an integer')
        key = (decision.get('ticker'), decision['index'])
        fail(key in expected and key not in seen, 'Unknown or duplicate reviewed item')
        seen.add(key)
        item = expected[key]
        fail(decision.get('headline') == item['headline'] and decision.get('item_sha256') == digest(item),
             'Reviewed item content has changed')
        fail(decision.get('scope') in SCOPES, 'Every item needs an explicit reviewed scope')
        text(decision.get('reason'), 'Review reason', 1000)
        if decision['scope'] == 'company':
            fail(not item['headline'].lower().startswith(('active-session snapshot:', 'shared watchlist context:')),
                 'Price snapshots and shared context cannot be company research')
    fail(seen == set(expected), 'Every research item must be reviewed, including exclusions')
    return review


def index_parts(edition, review):
    validate_review(edition, review)
    items, mapped = all_items(edition), {}
    for decision in review['items']:
        item = items[(decision['ticker'], decision['index'])]
        mapped.setdefault(decision['ticker'], []).append({
            'index': decision['index'], 'headline': item['headline'],
            'scope': decision['scope'], 'content_key': content_key(item), 'item_sha256': digest(item)})
    for entries in mapped.values():
        entries.sort(key=lambda x: x['index'])
    receipt = {'as_of': edition['as_of'], 'reviewed_at': review['reviewed_at'],
               'edition_sha256': review['edition_sha256'],
               'path': 'data/watchlist/reviews/' + edition['id'] + '.json'}
    return mapped, receipt


def import_review(edition, review, root):
    mapped, receipt = index_parts(edition, review)
    folder = Path(root) / 'data/watchlist'
    path = folder / 'reviews' / (edition['id'] + '.json')
    if path.exists():
        fail(json.loads(path.read_text(encoding='utf-8')) == review,
             'Existing research review is immutable; use a new edition revision')
    index_path = folder / 'research-index.json'
    index = json.loads(index_path.read_text(encoding='utf-8')) if index_path.exists() else {
        'schema_version': 2, 'content_binding': BINDING, 'editions': {}, 'reviewed_editions': {}}
    fail(index.get('schema_version') == 2 and index.get('content_binding') == BINDING,
         'Research index needs the reviewed content-binding schema')
    if edition['id'] in index['reviewed_editions']:
        fail(index['reviewed_editions'][edition['id']] == receipt and index['editions'].get(edition['id']) == mapped,
             'Refusing to replace a retained research mapping')
    index['editions'][edition['id']] = mapped
    index['reviewed_editions'][edition['id']] = receipt
    if not path.exists():
        write_json(path, review)
    write_json(index_path, index)
    return path


def validate_index(root):
    folder = Path(root) / 'data/watchlist'
    index = json.loads((folder / 'research-index.json').read_text(encoding='utf-8'))
    exact_keys(index, {'schema_version', 'content_binding', 'editions', 'reviewed_editions'}, 'Research index')
    archive_index = json.loads((folder / 'index.json').read_text(encoding='utf-8'))
    fail(index.get('schema_version') == 2 and index.get('content_binding') == BINDING,
         'Research index must bind reviewed content')
    ids = {e['id'] for e in archive_index['editions']}
    fail(set(index['editions']) == ids == set(index['reviewed_editions']),
         'Every published edition needs its complete reviewed mapping')
    for entry in archive_index['editions']:
        edition_id = entry['id']
        fail(entry['path'] == 'data/watchlist/archive/' + edition_id + '.json', 'Unsafe archive path')
        edition = json.loads((folder / 'archive' / (edition_id + '.json')).read_text(encoding='utf-8'))
        fail(edition['id'] == edition_id and edition['as_of'] == entry['as_of'], 'Archive identity mismatch')
        review = json.loads((folder / 'reviews' / (edition_id + '.json')).read_text(encoding='utf-8'))
        mapped, receipt = index_parts(edition, review)
        fail(index['editions'][edition_id] == mapped and index['reviewed_editions'][edition_id] == receipt,
             'Research index differs from its content-bound review')
    return len(ids)


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--input', required=True)
    p.add_argument('--output', required=True, help='New draft path outside the public site; review all pending decisions before use')
    args = p.parse_args()
    out = Path(args.output)
    fail(not out.exists(), 'Never overwrite an existing review draft')
    write_json(out, template(json.loads(Path(args.input).read_text(encoding='utf-8'))))
    print('Pending review draft written; no publication or approval was performed.')
