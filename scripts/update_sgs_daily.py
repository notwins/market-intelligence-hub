"""Fetch MAS Closing Levels and retain dated benchmark yields, prices and identities.

Only the selected official table is parsed. No interpolation, price calculation,
high/low substitution or overwrite of a conflicting saved observation is allowed.
"""
import argparse
import copy
import json
import math
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://eservices.mas.gov.sg/statistics/fdanet/SgsBenchmarkIssuePrices.aspx'
LABELS = ['6M', '1Y', '2Y', '5Y', '10Y', '15Y', '20Y', '30Y', '50Y']
HEADERS = ['6-Mth'] + [f'{n}-Year' for n in (1, 2, 5, 10, 15, 20, 30, 50)]
SGT = timezone(timedelta(hours=8))
MONTHS = dict(zip('Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(), range(1, 13)))


class ClosingTable(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tables = 0
        self.active = False
        self.rows = []
        self.row = None
        self.cell = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'table' and attrs.get('id') == 'ContentPlaceHolder1_ClosingLevelsTable':
            self.tables += 1
            self.active = True
        if not self.active:
            return
        if tag == 'tr':
            self.row = []
        if tag in ('td', 'th'):
            self.cell = {'class': attrs.get('class', ''), 'span': int(attrs.get('colspan', 1)), 'text': ''}
        if tag == 'br' and self.cell is not None:
            self.cell['text'] += '\n'

    def handle_data(self, data):
        if self.active and self.cell is not None:
            self.cell['text'] += data

    def handle_endtag(self, tag):
        if not self.active:
            return
        if tag in ('td', 'th') and self.cell is not None:
            self.cell['text'] = self.cell['text'].strip()
            self.row.append(self.cell)
            self.cell = None
        if tag == 'tr' and self.row is not None:
            self.rows.append(self.row)
            self.row = None
        if tag == 'table':
            self.active = False


def source_date(text):
    match = re.fullmatch(r'(\d{1,2}) ([A-Z][a-z]{2}) (\d{4})', text.strip())
    if not match or match[2] not in MONTHS:
        raise ValueError('Unrecognised MAS date')
    return datetime(int(match[3]), MONTHS[match[2]], int(match[1])).date().isoformat()


def number(text, low, high):
    if text.strip() in ('-', '\u2013', '\u2014', ''):
        return None
    if not re.fullmatch(r'\d+(?:\.\d+)?|-\d+(?:\.\d+)?', text.strip()):
        raise ValueError('Invalid MAS numeric field')
    value = float(text)
    if not math.isfinite(value) or not low <= value <= high:
        raise ValueError('MAS numeric field outside expected bounds')
    return value


def parse(html, today=None):
    parser = ClosingTable()
    parser.feed(html)
    if parser.tables != 1:
        raise ValueError('Exactly one MAS Closing Levels table required')
    headers = [r for r in parser.rows if any(c['class'] == 'tenor' for c in r)]
    if len(headers) != 1 or [c['text'] for c in headers[0][1:]] != HEADERS:
        raise ValueError('MAS benchmark tenor order changed')
    header_rows = [r for r in parser.rows if r and r[0]['class'] == 'labels']
    if len(header_rows) != 1 or len(header_rows[0]) != 10:
        raise ValueError('MAS issue header layout changed')
    tenors = []
    for i, cell in enumerate(header_rows[0][1:]):
        parts = [p.strip() for p in cell['text'].splitlines() if p.strip()]
        if cell['span'] != (1 if i < 2 else 2) or len(parts) != (2 if i < 2 else 3):
            raise ValueError('MAS issue columns changed')
        if not re.fullmatch('[A-Z]{1,2}[0-9]{5,6}[A-Z]', parts[0]):
            raise ValueError('Invalid MAS issue code')
        coupon = None if i < 2 else number(parts[1].removesuffix('%'), 0, 100)
        if i >= 2 and (not parts[1].endswith('%') or coupon is None):
            raise ValueError('Bond coupon missing')
        maturity = source_date(parts[-1])
        tenors.append({'label': LABELS[i], 'issue_code': parts[0], 'maturity': maturity,
                       'coupon_percent': coupon, 'instrument_type': 'treasury_bill' if i < 2 else 'bond',
                       'name': ('Singapore Treasury Bill ' if i < 2 else 'Singapore Government Bond ') + parts[0]})
    expected = ['yield', 'yield'] + ['price', 'yield'] * 7
    subheaders = [r for r in parser.rows if len(r) == 16 and all(c['class'] in ('yield', 'price') for c in r)]
    if len(subheaders) != 1 or [c['text'] for c in subheaders[0]] != [c.title() for c in expected]:
        raise ValueError('MAS Price/Yield columns changed')
    observations = []
    for row in parser.rows:
        if not row or row[0]['class'] != 'date':
            continue
        day = source_date(row[0]['text'])
        if len(row) != 17 or [c['class'] for c in row[1:]] != expected:
            raise ValueError('MAS closing row layout changed')
        if day > (today or datetime.now(SGT).date().isoformat()):
            raise ValueError('Future MAS observation date')
        values = [number(row[1]['text'], -10, 100), number(row[2]['text'], -10, 100)]
        prices = [None, None]
        for i in range(3, 17, 2):
            prices.append(number(row[i]['text'], 0.01, 500))
            values.append(number(row[i + 1]['text'], -10, 100))
        if not any(v is not None for v in values):
            raise ValueError('MAS closing row has no yields')
        if any(t['maturity'] <= day for t in tenors):
            raise ValueError('Matured issue in MAS benchmark header')
        if observations and day <= observations[-1]['date']:
            raise ValueError('MAS dates are duplicated or unordered')
        observations.append({'date': day, 'values': values, 'prices': prices,
                             'issues': copy.deepcopy(tenors),
                             'issue_metadata_basis': 'MAS table header as displayed when retrieved'})
    if not observations or len(observations) > 31:
        raise ValueError('No usable MAS Closing Levels observations')
    return tenors, observations


def merge(previous, tenors, observations, checked_at):
    result = copy.deepcopy(previous)
    if result.get('schema_version') != 1 or [t['label'] for t in result['tenors']] != LABELS:
        raise ValueError('Saved SGS schema or tenor mapping changed')
    rows = {r['date']: r for r in result['observations']}
    if len(rows) != len(result['observations']) or list(rows) != sorted(rows):
        raise ValueError('Saved SGS dates must be unique and ordered')
    # Preserve the known latest prices in the original v1 snapshot, dated by its
    # own source_scope. Do not attach latest bond metadata to earlier yield rows.
    old_last = result['observations'][-1]
    if 'prices' not in old_last:
        old_last['prices'] = [t.get('latest_clean_price_sgd_per_100') for t in result['tenors']]
        old_last['issues'] = [{k: v for k, v in t.items() if k != 'latest_clean_price_sgd_per_100'} for t in result['tenors']]
        old_last['issue_metadata_basis'] = 'Original saved snapshot latest table header'
    for row in observations:
        old = rows.get(row['date'])
        if old is None:
            rows[row['date']] = copy.deepcopy(row)
            continue
        if old['values'] != row['values']:
            raise ValueError('Conflicting saved MAS yields on ' + row['date'] + '; review required')
        if 'prices' not in old:
            old.update({k: copy.deepcopy(row[k]) for k in ('prices', 'issues', 'issue_metadata_basis')})
        elif old['prices'] != row['prices']:
            raise ValueError('Conflicting saved MAS prices on ' + row['date'] + '; review required')
        # Retain the first saved issue identity for overlapping rows. A later
        # rotating MAS header must not silently relabel historical prices.
    result['observations'] = [rows[d] for d in sorted(rows)]
    last = result['observations'][-1]
    latest_tenors = last.get('issues')
    if latest_tenors:
        result['tenors'] = [dict(t, latest_clean_price_sgd_per_100=last['prices'][i]) for i, t in enumerate(latest_tenors)]
    result['checked_at'] = checked_at
    result['source_url'] = SOURCE
    result['source_scope'] = 'Append-preserved source-dated daily yields; prices and issue headers retained only where observed. Missing history is not inferred. Issue headers are saved as displayed by MAS at retrieval.'
    result['attribution'] = ('Contains information from Daily SGS Prices accessed on ' + checked_at[:10] +
                             ' from the Monetary Authority of Singapore. Made available under MAS dataset terms. MAS does not endorse this website.')
    return result


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    os.replace(temp, path)


def update(root=ROOT, html=None, now=None):
    now = now or datetime.now(timezone.utc)
    checked = now.astimezone(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')
    data = Path(root) / 'site/data'
    status_path = data / 'sgs-daily-status.json'
    previous = json.loads((data / 'sgs-daily-snapshot.json').read_text(encoding='utf-8'))
    old_status = json.loads(status_path.read_text(encoding='utf-8')) if status_path.exists() else {}
    try:
        if html is None:
            request = Request(SOURCE, headers={'User-Agent': 'MarketIntelligenceHub/1.0 (public MAS benchmark closing levels)', 'Cache-Control': 'no-cache'})
            with urlopen(request, timeout=45) as response:
                html = response.read(2_000_001)
                if len(html) > 2_000_000:
                    raise ValueError('MAS response unexpectedly large')
                html = html.decode('utf-8-sig')
        tenors, observations = parse(html, now.astimezone(SGT).date().isoformat())
        candidate = merge(previous, tenors, observations, checked)
        changed = any(candidate.get(k) != previous.get(k) for k in ('observations', 'tenors'))
        if changed:
            atomic_json(data / 'sgs-daily-snapshot.json', candidate)
        latest = candidate['observations'][-1]['date']
        age = (now.astimezone(SGT).date() - datetime.fromisoformat(latest).date()).days
        status = {'schema_version': 1, 'status': 'ok', 'last_attempt': checked, 'last_success': checked,
                  'latest_observation_date': latest, 'source_url': SOURCE,
                  'message': 'MAS checked; ' + ('new dated observations saved.' if changed else 'no new observation; history unchanged.'),
                  'observation_age_calendar_days': age, 'data_changed': changed,
                  'observation_count': len(candidate['observations'])}
        atomic_json(status_path, status)
        return status
    except Exception:
        status = {'schema_version': 1, 'status': 'error', 'last_attempt': checked,
                  'last_success': old_status.get('last_success'), 'source_url': SOURCE,
                  'latest_observation_date': previous['observations'][-1]['date'],
                  'message': 'MAS refresh failed validation or source access. Last verified observations retained with their original dates; review the private job log.'}
        atomic_json(status_path, status)
        raise


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    args = parser.parse_args()
    try:
        print(json.dumps(update(args.root)))
    except Exception as exc:
        print('SGS refresh failed: ' + str(exc), file=sys.stderr)
        sys.exit(1)
