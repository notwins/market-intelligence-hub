"""Read back the deployed SGS files, adapter rows and chart integrations."""
import argparse
import json
import os
import time
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]


def verify(root=ROOT, fetch=None):
    root = Path(root)
    files = ('data/sgs-daily-snapshot.json', 'data/sgs-daily-status.json')
    expected = {}
    for name in files:
        body = (root / 'site' / name).read_bytes()
        if fetch(name) != body:
            raise ValueError('Live SGS bytes do not match accepted source: ' + name)
        expected[name] = json.loads(body)
    snapshot, status = (expected[name] for name in files)
    if status.get('refresh_runner') != 'github_actions':
        raise ValueError('Cloud refresh ownership is not present in the live status')
    if status['latest_observation_date'] != snapshot['observations'][-1]['date']:
        raise ValueError('SGS status and snapshot dates differ')
    desk = json.loads(fetch('data/desk-data.json'))
    source_desk = json.loads((root / 'site/data/desk-data.json').read_text(encoding='utf-8'))
    sgs = lambda d: [r for r in d['yields'] if r['id'].startswith('sgs-')]
    if sgs(desk) != sgs(source_desk):
        raise ValueError('Live desk SGS rows differ from accepted source')
    for name in ('sgs-daily.js', 'sgs-daily.css', 'market-snapshot.js', 'desk-dashboard.js'):
        if fetch(name) != (root / 'site' / name).read_bytes():
            raise ValueError('Live SGS chart reader differs from accepted source: ' + name)
    for page in ('desk.html', 'v4.html'):
        text = fetch(page).decode('utf-8')
        if 'sgs-daily.js' not in text or 'sgs-daily.css' not in text:
            raise ValueError('Daily SGS assets missing from ' + page)
        hooks = ('data-sgs-daily="dashboard"', 'data-sgs-daily="prices"') if page == 'desk.html' else ('SGSDaily.mount(S.view)',)
        if not all(hook in text for hook in hooks):
            raise ValueError('Daily SGS chart integration missing from ' + page)
    return {'result': 'passed', 'source_status': status['status'],
            'source_url': snapshot['source_url'], 'source_ai_chat': None,
            'checked_at': status.get('last_success') or status['last_attempt'],
            'latest_observation_date': status['latest_observation_date'],
            'observations': len(snapshot['observations']), 'tenors': len(snapshot['tenors'])}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', required=True)
    args = parser.parse_args()
    parsed = urlsplit(args.base_url)
    if parsed.scheme != 'https' or parsed.hostname != 'notwins.github.io' or parsed.path.rstrip('/') != '/market-intelligence-hub' or parsed.username or parsed.password:
        raise ValueError('Use the existing Market Intelligence Hub Pages origin')
    base = args.base_url.rstrip('/') + '/'
    for attempt in range(6):
        def fetch(name):
            key = os.environ.get('GITHUB_RUN_ID', 'manual') + '-' + str(attempt)
            request = Request(base + name + '?sgs-verify=' + key,
                              headers={'Cache-Control': 'no-cache', 'User-Agent': 'MarketIntel-SGS-live-verification'})
            with urlopen(request, timeout=20) as response:
                if response.status != 200:
                    raise ValueError('Live SGS resource unavailable: ' + name)
                return response.read()
        try:
            result = verify(fetch=fetch)
            print(json.dumps(result))
            return
        except Exception:
            if attempt == 5:
                raise
            time.sleep(10)


if __name__ == '__main__':
    main()
