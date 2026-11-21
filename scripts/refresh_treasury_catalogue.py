"""Publish public fixed-principal Treasury terms from TreasuryDirect auctions."""
import argparse
import json
import math
import re
from datetime import date, datetime
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / 'site/data/treasury-catalogue.json'
AUCTIONS = 'https://www.treasurydirect.gov/TA_WS/securities/search'
SOURCE = 'https://www.treasurydirect.gov/auctions/auction-query/'
CURVE_START = date(1995, 1, 3)


def isin_for(cusip):
    if not re.fullmatch(r'912[A-Z0-9]{5}[0-9]', cusip):
        raise ValueError(f'Unexpected Treasury CUSIP {cusip!r}')
    values = [int(value, 36) * (1 + i % 2) for i, value in enumerate(cusip[:-1])]
    if (sum(value // 10 + value % 10 for value in values) + int(cusip[-1])) % 10:
        raise ValueError(f'Invalid CUSIP check digit: {cusip}')
    prefix = 'US' + cusip
    digits = ''.join(str(int(c, 36)) for c in prefix)
    total = sum(sum(map(int, str(int(digit) * (2 - i % 2)))) for i, digit in enumerate(reversed(digits)))
    return prefix + str(-total % 10)


def download(kind, today):
    query = urlencode(dict(format='json', type=kind, startDate='1979-01-01', endDate=today.isoformat()))
    request = Request(f'{AUCTIONS}?{query}', headers={'Accept': 'application/json', 'User-Agent': 'Market-Intelligence-Hub/1.0'})
    with urlopen(request, timeout=45) as response:
        body = response.read(30_000_001)
    if len(body) > 30_000_000:
        raise ValueError(f'{kind} results exceeded the expected size')
    rows = json.loads(body)
    if not isinstance(rows, list) or not rows:
        raise ValueError(f'{kind} auction results are unavailable')
    return rows


def auction_day(row, key):
    return date.fromisoformat(row[key][:10])


def original_term_months(row):
    value = row.get('originalSecurityTerm') or ''
    match = re.fullmatch(r'(\d{1,2})-Year(?: (\d{1,2})-Month)?', value)
    if not match:
        return None
    years, months = int(match[1]), int(match[2] or 0)
    return 12 * years + months if years > 0 and months < 12 else None


def project(sources, today):
    instruments = {}
    latest = None
    for kind, rows in sources.items():
        for row in rows:
            if (row.get('securityType') != kind or row.get('inflationProtected') != 'No' or
                row.get('floatingRate') != 'No' or row.get('callable') != 'No' or
                row.get('frequencyOfInterestPayments') != 'Semi-Annual' or not row.get('interestRate')):
                continue
            auction = auction_day(row, 'competitiveAuctionCloseDate')
            issue = auction_day(row, 'issueDate')
            maturity = auction_day(row, 'maturityDate')
            if auction > today or issue > today or maturity <= CURVE_START:
                continue
            original = auction_day(row, 'originalIssueDate') if row.get('originalIssueDate') else issue
            coupon = float(row['interestRate'])
            if not (original <= issue < maturity and math.isfinite(coupon) and coupon > 0):
                raise ValueError(f'Invalid fixed-rate Treasury terms: {row.get("cusip")}')
            isin = isin_for(row['cusip'])
            previous = instruments.get(isin)
            if previous and (previous[0], previous[1], previous[3]) != (kind, coupon, maturity):
                raise ValueError(f'Conflicting coupon or maturity across auctions for {isin}')
            term = original_term_months(row)
            if previous and previous[4] and term and term != previous[4]:
                raise ValueError(f'Conflicting original term across auctions for {isin}')
            instruments[isin] = (kind, coupon, min(original, previous[2]) if previous else original,
                                 maturity, term or (previous[4] if previous else None))
            latest = auction if latest is None else max(latest, auction)
    if not latest or {terms[0] for terms in instruments.values()} != {'Bond', 'Note'}:
        raise ValueError('Incomplete Treasury catalogue')
    return {'schema_version': 1, 'source_url': SOURCE, 'latest_auction_date': latest.isoformat(),
            'instruments': [[isin, kind, coupon, first.isoformat(), end.isoformat(), term]
                            for isin, (kind, coupon, first, end, term) in sorted(instruments.items())]}


def serialize(catalogue):
    header = {key: value for key, value in catalogue.items() if key != 'instruments'}
    return (json.dumps(header, indent=2).removesuffix('\n}') + ',\n  "instruments": [\n'
            + ',\n'.join('    ' + json.dumps(row, separators=(',', ':')) for row in catalogue['instruments'])
            + '\n  ]\n}\n').encode('utf-8')


def refresh(destination, today):
    catalogue = project({kind: download(kind, today) for kind in ('Bond', 'Note')}, today)
    content = serialize(catalogue)
    if destination.exists():
        saved = destination.read_bytes()
        before = json.loads(saved)
        if before == catalogue:
            return len(catalogue['instruments'])
        if ({row[0] for row in before['instruments']} - {row[0] for row in catalogue['instruments']}
                or catalogue['latest_auction_date'] < before['latest_auction_date']):
            raise ValueError('Incomplete auction refresh. The previous Treasury catalogue was retained.')
        terms = {row[0]: row[5] for row in catalogue['instruments']}
        if any(len(row) > 5 and row[5] and not terms.get(row[0]) for row in before['instruments']):
            raise ValueError('Refresh lost verified original terms. The previous Treasury catalogue was retained.')
    temporary = destination.with_suffix('.json.tmp')
    try:
        temporary.write_bytes(content)
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)
    return len(catalogue['instruments'])


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=DESTINATION)
    args = parser.parse_args()
    size = refresh(args.output, datetime.now(ZoneInfo('America/New_York')).date())
    print(f'TreasuryDirect catalogue contains {size} fixed-rate notes and bonds.')
