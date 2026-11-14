"""Build the explicitly approved, immutable historical equity enrichment snapshot.

The source CSV is local input only. Its sample/header rows, blank ticker stubs,
duplicated columns and unlabelled scratch columns are never published.
"""
from __future__ import annotations
import argparse
import csv
import hashlib
import io
import json
import math
from collections import Counter
from datetime import date, timedelta
from pathlib import Path
import re

START_YEARS = list(range(2026, 2018, -1))
RATING_FIELDS = [
    (16, 'S&P', 'Long-term local-currency issuer credit', 'RTG_SP_LT_LC_ISSUER_CREDIT'),
    (17, "Moody's", 'Senior unsecured debt', 'RTG_MDY_SEN_UNSECURED_DEBT'),
    (18, 'Fitch', 'Long-term issuer default', 'RTG_FITCH_LT_ISSUER_DEFAULT'),
    (46, "Moody's", 'Issuer', 'RTG_MDY_ISSUER'),
    (48, 'Fitch', 'Senior unsecured debt', 'RTG_FITCH_SEN_UNSECURED'),
]
METRICS = {
    'price': 2, 'marketCap': 8, 'bestEps': 10, 'pe': 14, 'pb': 15,
    'dividendYieldPct': 19, 'freeCashFlow': 22, 'freeCashFlowYieldPct': 23,
    'dividendGrowth1yPct': 25, 'dividendCoverage': 26, 'interestCoverage': 27,
    'netDebtToEbitda': 28, 'netDebtToEquity': 29, 'revenue': 30,
    'grossProfit': 31, 'netIncome': 32, 'currentAssets': 33,
    'totalLiabilities': 34, 'revenueGrowthPct': 35, 'grossMarginPct': 36,
    'netIncomeMarginAdjustedPct': 37, 'commonEquityTier1Ratio': 38,
    'netInterestMargin': 39, 'nonPerformingLoansPct': 40,
    'totalDebtToAssets': 43, 'netDebtPerShare': 44, 'totalDebtToEquity': 45,
    'fiveYearAveragePe': 74,
}
EXPECTED_METRIC_HEADERS = {
    2: 'PX LAST', 8: 'CUR_MKT_CAP', 10: 'BEST_EPS', 14: 'pe_ratio',
    15: 'PX_TO_BOOK_RATIO', 19: 'EQY_DVD_YLD_IND', 22: 'CF_FREE_CASH_FLOW',
    23: 'FREE_CASH_FLOW_YIELD', 25: 'DIVIDEND_PER_SHARE_1_YEAR_GROWTH',
    26: 'CASH_DVD_COVERAGE', 27: 'EBITDA_TO_TOT_INT_EXP', 28: 'NET_DEBT_TO_EBITDA',
    29: 'NET_DEBT_TO_SHRHLDR_EQTY', 30: 'SALES_REV_TURN', 31: 'GROSS_PROFIT',
    32: 'EARN_FOR_COMMON', 33: 'BS_CUR_ASSET_REPORT', 34: 'BS_TOT_LIAB2',
    35: 'SALES_GROWTH', 36: 'GROSS_MARGIN', 37: 'NET_INCOME_MARGIN_ADJUSTED',
    38: 'BS_TIER1_COM_EQUITY_RATIO', 39: 'T12_NET_INT_MARGIN', 40: 'NPLS_TO_TOTAL_LOANS',
    43: 'TOT_DEBT_TO_TOT_ASSET', 44: 'NET_DEBT_PER_SHARE', 45: 'TOT_DEBT_TO_COM_EQY',
    74: 'FIVE_YR_AVG_PRICE_EARNINGS',
}


def number(value):
    if value.strip() == '':
        return None
    result = float(value)
    if not math.isfinite(result):
        raise ValueError('Non-finite source number')
    return result


def calendar_return(older_holding, newer_holding):
    if older_holding is None or newer_holding is None:
        return None
    if older_holding <= -100 or newer_holding <= -100:
        raise ValueError('Return cannot support a positive wealth-factor ratio')
    return ((1 + older_holding / 100) / (1 + newer_holding / 100) - 1) * 100


def credit_value(raw, agency, scope, field):
    raw = raw.strip()
    status = 'missing' if not raw else 'not_rated' if raw == 'NR' else 'withdrawn' if raw in {'WR', 'WD', 'WDu'} else 'rated'
    qualifiers = []
    grade = raw if status == 'rated' else None
    if grade:
        for token in ('(P)', '(hyb)', '*+', '*-'):
            if token in grade:
                qualifiers.append(token)
                grade = grade.replace(token, '').strip()
        if grade.endswith('u'):
            qualifiers.append('u')
            grade = grade[:-1]
    elif raw == 'WDu':
        qualifiers.append('u')
    return {'agency': agency, 'scope': scope, 'field': field, 'raw': raw or None,
            'grade': grade, 'status': status, 'qualifiers': qualifiers, 'asOf': None}


def source_date(value):
    if not value.strip():
        return None
    month, day, year = map(int, value.split('/'))
    return date(year, month, day).isoformat()


def import_csv(path):
    payload = Path(path).read_bytes()
    rows = list(csv.reader(io.StringIO(payload.decode('utf-8-sig'))))
    if len(rows) < 4 or any(len(row) != 84 for row in rows):
        raise ValueError('Expected the 84-column Bloomberg export layout')
    header = rows[2]
    expected_headers = {0: 'BB Ticker', 1: 'BB Ticker', 2: 'PX LAST', 3: 'ISIN', 4: 'ID_ISIN',
                         5: 'ID_ISIN', 20: 'LATEST_ANNOUNCEMENT_DT', 21: 'EXPECTED_REPORT_DT',
                         24: 'EQY_DVD_YLD_IND', 47: 'RTG_SP_OUTLOOK',
                         6: 'NAME', 14: 'pe_ratio', 15: 'PX_TO_BOOK_RATIO',
                         41: 'GICS_SECTOR_NAME', 42: 'GICS_INDUSTRY_NAME',
                         65: 'PE_RATIO', 74: 'FIVE_YR_AVG_PRICE_EARNINGS', **EXPECTED_METRIC_HEADERS,
                         **{i: field for i, agency, scope, field in RATING_FIELDS}}
    for index, label in expected_headers.items():
        if header[index] != label:
            raise ValueError(f'Unexpected column {index + 1}: {header[index]!r}')
    for offset, year in enumerate(START_YEARS):
        for first, field in ((49, 'CUST_TRR_RETURN_ANNUALIZED'), (57, 'CUST_TRR_RETURN_HOLDING_PER')):
            if rows[1][first + offset] != f'1/1/{year}' or header[first + offset] != field:
                raise ValueError('Return period labels or fields changed')
    if any(row[index] for row in rows[3:] for index in range(66, 74)):
        raise ValueError('Historical P/E columns now contain data; review their dates before extending this import')
    records, excluded, endpoints = [], 0, []
    tickers, isins = set(), set()
    for source_row, row in enumerate(rows[3:], 4):
        ticker = row[0].strip()
        if not re.fullmatch(r'.+ [A-Z]{2}', ticker) or row[1].strip().upper() != (ticker + ' EQUITY').upper():
            raise ValueError(f'Invalid exchange-qualified ticker at row {source_row}')
        if ticker in tickers:
            raise ValueError(f'Duplicate ticker {ticker}')
        tickers.add(ticker)
        if not any(row[2:75]):
            excluded += 1
            continue
        isin = row[4].strip()
        if not row[2] or not row[3] or not row[6] or not re.fullmatch(r'[A-Z]{2}[A-Z0-9]{9}\d', isin):
            raise ValueError(f'Incomplete core identity at row {source_row}')
        if isin in isins or isin != row[5]:
            raise ValueError(f'Duplicate or inconsistent ISIN {isin}')
        isins.add(isin)
        if row[14] != row[65] or row[19] != row[24]:
            raise ValueError('Duplicated source metrics disagree')
        annualized = {str(year): number(row[49 + i]) for i, year in enumerate(START_YEARS)}
        holding = {str(year): number(row[57 + i]) for i, year in enumerate(START_YEARS)}
        for year in START_YEARS:
            a, h = annualized[str(year)], holding[str(year)]
            if (a is None) != (h is None):
                raise ValueError(f'Annualized and holding-period coverage differ for {ticker}')
            if a is not None:
                if a <= -100 or h <= -100:
                    raise ValueError(f'Invalid return wealth factor for {ticker}')
                if abs(a) > 0.00001:
                    duration = math.log1p(h / 100) / math.log1p(a / 100) * 365
                    expected = (date(2026, 9, 19) - date(year, 1, 1)).days
                    if abs(duration - expected) > .01:
                        raise ValueError(f'Common return endpoint does not reconcile for {ticker}/{year}')
                    endpoints.append(abs(duration - expected))
        snapshot = {key: number(row[index]) for key, index in METRICS.items()}
        snapshot.update({'priceAsOf': None, 'currency': None, 'marketCapCurrency': None,
                         'financialCurrency': None, 'financialScale': None, 'financialPeriod': None,
                         'peBasis': 'source PE_RATIO; period not exported',
                         'latestAnnouncementDate': source_date(row[20]),
                         'expectedReportDate': source_date(row[21])})
        records.append({
            'id': 'isin:' + isin, 'isin': isin, 'bbTicker': ticker, 'ticker': ticker,
            'name': row[3].strip(), 'shortName': row[6].strip(), 'sourceRow': source_row,
            'sector': row[41].strip() or None, 'industry': row[42].strip() or None,
            'currency': None, 'snapshot': snapshot,
            'returns': {'annualized': annualized, 'holding': holding,
                        'calendar': {str(year): calendar_return(holding[str(year)], holding[str(year + 1)])
                                     for year in range(2019, 2026)},
                        'ytd': {'2026': holding['2026']}},
            'credit': [credit_value(row[index], agency, scope, field) for index, agency, scope, field in RATING_FIELDS],
            'creditOutlook': {'agency': 'S&P', 'field': 'RTG_SP_OUTLOOK', 'value': row[47].strip() or None, 'asOf': None},
        })
    if not records or not endpoints:
        raise ValueError('No populated equities or return endpoint evidence')
    return {
        'schemaVersion': 1, 'sourceId': 'bloomberg-equity-snapshot',
        'snapshotId': 'bbg-equities-2026-09-19-v1', 'sourceLabel': 'Bloomberg export supplied by owner',
        'sourceSha256': hashlib.sha256(payload).hexdigest(),
        'returnCutoff': '2026-09-19', 'returnCutoffBasis': 'inferred_from_annualized_and_holding_returns',
        'returnBasis': {'currency': 'local', 'dividends': 'gross_reinvested', 'confirmedBy': 'user'},
        'priceAsOf': None, 'creditAsOf': None,
        'calendarMethod': '(1 + holding return from January Y / 100) / (1 + holding return from January Y+1 / 100) - 1; result multiplied by 100',
        'notes': [
            'Calendar 2019-2025 returns are derived from overlapping holding-period returns; 2026 is a partial-year holding-period return.',
            'The common return endpoint is inferred and reconciled using a 365-day annualization basis. It is not an exported quotation date.',
            'Local-currency total returns with gross dividends reinvested were confirmed by the owner. No FX conversion is applied.',
            'Snapshot prices, valuations and credit ratings are historical source fields. Their observation dates were not exported.',
            'Financial currency, scale and accounting period were not exported. Source monetary values must not be compared across listings as USD.',
            'Credit agency, scope, raw qualifiers and unavailable/withdrawn statuses remain separate. Outlook is not a credit grade.',
        ],
        'validation': {'records': len(records), 'rosterTickers': len(tickers), 'excludedTickerOnlyRows': excluded,
                       'excludedHeaderRows': [1, 2, 3], 'returnPairsChecked': len(endpoints),
                       'maximumEndpointDeviationDays': max(endpoints),
                       'returnCoverage': {str(y): sum(r['returns']['holding'][str(y)] is not None for r in records) for y in START_YEARS},
                       'sectorCounts': dict(Counter(r['sector'] for r in records))},
        'records': records,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('csv', type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    data = import_csv(args.csv)
    encoded = json.dumps(data, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n'
    # A snapshot is immutable. Rebuilding identical bytes is a no-op; revisions
    # require an intentional new snapshot id/path, never a silent overwrite.
    if args.output.exists() and args.output.read_text(encoding='utf-8') != encoded:
        raise ValueError('Refusing to overwrite a different immutable snapshot')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(encoded, encoding='utf-8')
    print(json.dumps(data['validation'], indent=2))


if __name__ == '__main__':
    main()
