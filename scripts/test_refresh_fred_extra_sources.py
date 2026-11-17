"""Offline source-contract tests; no network or stored-history writes."""
import calendar
import concurrent.futures
import datetime as dt
import io
import json
import unittest
import urllib.parse
import zipfile
from unittest.mock import patch

import refresh_fred_extra_sources as extra

TODAY = dt.date(2026, 11, 16)
FED_FIELDS = ['observation_date', 'source_period', 'series_code', 'value', 'description', 'line', 'table', 'units_and_basis']
CENSUS_FIELDS = ['observation_date', 'country_code', 'country_or_area', 'imports_usd_millions', 'exports_usd_millions', 'balance_usd_millions']
ARCHIVE_FIELDS = ['observation_date'] + extra.OFS_COLS + ['source_publication_month', 'source_pdf_page', 'source_url', 'source_value_tokens']


def fixed_start(entry, today):
    return '2026-06-01'


def fiscal_page(rows, total=None, pages=1, types=None):
    fields = list(rows[0])
    return json.dumps({'data': rows, 'meta': {'count': len(rows), 'total-count': total or len(rows),
        'total-pages': pages, 'labels': {f: f for f in fields},
        'dataTypes': types or {f: 'STRING' for f in fields}}}).encode()


class ExtraSourcesTests(unittest.TestCase):
    def setUp(self):
        extra._BULK_CACHE.clear()

    def test_fed_quarter_end_native_missing_and_shared_zip(self):
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, 'w') as book:
            for table in extra.FED_TABLES.values():
                book.writestr('data_dictionary/' + table + '.txt',
                    'FL1.Q\tTotal\tLine 1\tF3.2 Treasury securities\tMillions of dollars; amounts outstanding end of period, not seasonally adjusted\n')
                book.writestr('csv/' + table + '.csv', 'date,FL1.Q\n2026:Q1,17\n2026:Q2,ND\n2026:Q3,0\n2026:Q4,5\n')
        calls = []
        def fetch(url):
            calls.append(url)
            return stream.getvalue()
        def run(sid):
            return extra.fetch_dataset({'id': sid}, TODAY, FED_FIELDS, fetch, fixed_start)
        with concurrent.futures.ThreadPoolExecutor(3) as pool:
            results = list(pool.map(run, extra.FED_TABLES))
        self.assertEqual(calls, [extra.FED_URL])
        for result in results:
            self.assertEqual([(r['observation_date'], r['source_period'], r['value']) for r in result['rows']],
                             [('2026-06-30', '2026:Q2', 'ND'), ('2026-09-30', '2026:Q3', '0')])
            self.assertEqual(result['keys'], ['observation_date', 'series_code'])
            self.assertTrue(result['rows'][0]['units_and_basis'].startswith('Millions of dollars'))

    def census_bytes(self, duplicate=False):
        import openpyxl
        book = openpyxl.Workbook(); sheet = book.active; sheet.title = 'country'
        sheet.append(['year', 'CTY_CODE', 'CTYNAME'] + ['I' + calendar.month_abbr[m].upper() for m in range(1, 13)] + ['IYR'] + ['E' + calendar.month_abbr[m].upper() for m in range(1, 13)] + ['EYR'])
        # Country 0003 has valid all-zero September; 0004 establishes September
        # as globally published. All countries' October-December are placeholders.
        sheet.append(['2026', '0003', 'Group A'] + [0] * 12 + [0] + [0] * 12 + [0])
        sheet.append(['2026', '0003' if duplicate else '0004', 'Country B'] + [0] * 8 + [0.2] + [0] * 3 + [0.2] + [0] * 8 + [0.3] + [0] * 3 + [0.3])
        stream = io.BytesIO(); book.save(stream); book.close()
        return stream.getvalue()

    def test_census_leading_zero_countries_real_zero_and_future_zero(self):
        result = extra.fetch_dataset({'id': 'CENSUS_GOODS_TRADE_COUNTRIES'}, TODAY, CENSUS_FIELDS,
            lambda url: self.census_bytes(), lambda entry, today: '2026-09-01')
        self.assertEqual(len(result['rows']), 2)
        self.assertEqual([r['country_code'] for r in result['rows']], ['0003', '0004'])
        self.assertEqual(result['rows'][0]['imports_usd_millions'], '0')
        self.assertEqual(result['rows'][1]['balance_usd_millions'], '0.1')
        self.assertEqual({r['observation_date'] for r in result['rows']}, {'2026-09-01'})

    def test_census_duplicate_country_identity_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'duplicate'):
            extra.fetch_dataset({'id': 'CENSUS_GOODS_TRADE_COUNTRIES'}, TODAY, CENSUS_FIELDS,
                lambda url: self.census_bytes(True), lambda entry, today: '2026-09-01')

    def test_fiscal_pagination_composite_keys_and_missing_strings(self):
        fields = ['record_date', 'src_line_nbr', 'outstanding_amt']
        sources = [{'record_date': '2026-10-31', 'src_line_nbr': str(i), 'outstanding_amt': value}
                   for i, value in enumerate(['null', '*', '(*)', '0'], 1)]
        calls = []
        def fetch(url):
            calls.append(url)
            page = int(urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)['page[number]'][0])
            return fiscal_page(sources[(page - 1) * 2:page * 2], total=4, pages=2,
                types={'record_date': 'DATE', 'src_line_nbr': 'INTEGER', 'outstanding_amt': 'CURRENCY0'})
        result = extra.fetch_dataset({'id': 'TREASURY_MSPD_MARKET'}, TODAY, fields, fetch, fixed_start)
        self.assertEqual(len(calls), 2)
        self.assertEqual(result['rows'], sources)
        self.assertEqual(result['keys'], ['record_date', 'src_line_nbr'])

    def test_fiscal_partial_and_changed_schema_are_rejected(self):
        rows = [{'record_date': '2026-10-31', 'src_line_nbr': '1', 'value': '0'}]
        with self.assertRaisesRegex(ValueError, 'total-count'):
            extra.fetch_dataset({'id': 'TREASURY_MSPD_SUMMARY'}, TODAY, list(rows[0]),
                lambda url: fiscal_page(rows, total=2), fixed_start)
        with self.assertRaisesRegex(ValueError, 'schema'):
            extra.fetch_dataset({'id': 'TREASURY_MSPD_SUMMARY'}, TODAY, ['record_date', 'src_line_nbr'],
                lambda url: fiscal_page(rows), fixed_start)

    def test_fiscal_duplicate_line_identity_rejected(self):
        row = {'record_date': '2026-10-31', 'src_line_nbr': '1', 'value': '0'}
        with self.assertRaisesRegex(ValueError, 'duplicate'):
            extra.fetch_dataset({'id': 'TREASURY_MSPD_SUMMARY'}, TODAY, list(row),
                lambda url: fiscal_page([row, dict(row)]), fixed_start)

    def test_stale_source_omitting_latest_stored_period_is_rejected(self):
        row = {'record_date': '2026-08-31', 'src_line_nbr': '1', 'value': '0'}
        with self.assertRaisesRegex(ValueError, 'latest stored'):
            extra.fetch_dataset({'id': 'TREASURY_MSPD_SUMMARY', 'last': '2026-10-31'}, TODAY, list(row),
                lambda url: fiscal_page([row]), fixed_start)

    def test_debt_native_source_discrepancy_is_retained(self):
        row = {'record_date': '2026-10-01', 'debt_held_public_amt': '10.00',
               'intragov_hold_amt': '5.00', 'tot_pub_debt_out_amt': '14.97'}
        result = extra.fetch_dataset({'id': 'TREASURY_DEBT_PENNY'}, TODAY, list(row),
            lambda url: fiscal_page([row]), fixed_start)
        self.assertEqual(result['rows'], [row])
        self.assertEqual(result['keys'], ['record_date'])

    def test_ofs_publications_filter_observation_not_publication_and_missing(self):
        rows = [dict(record_date=date, end_of_month='2023-12-31', securities_owner=owner, securities_bil_amt=value)
                for date, owner, value in [('2024-02-29', 'A', '0'), ('2024-03-31', 'A', '0'), ('2024-03-31', 'B', 'null')]]
        fields = ['observation_date'] + list(rows[0]) + ['usable_securities_bil_amt', 'availability_note']
        urls = []
        def fetch(url):
            urls.append(url)
            return fiscal_page(rows)
        result = extra.fetch_dataset({'id': 'TREASURY_OFS2_PUBLICATIONS'}, TODAY, fields, fetch,
                                     lambda entry, today: '2023-12-01')
        self.assertIn('end_of_month:gte:2023-12-01', urllib.parse.unquote(urls[0]))
        self.assertEqual([r['usable_securities_bil_amt'] for r in result['rows']], ['', '0', ''])
        self.assertEqual(result['rows'][0]['securities_bil_amt'], '0')
        self.assertEqual(result['rows'][0]['availability_note'], 'Source documents historical zero as unavailable')
        self.assertEqual(result['keys'], ['observation_date', 'record_date', 'securities_owner'])

    def test_ofs_pdf_tokens_year_carry_quarter_end_and_twelve_columns(self):
        text = 'TABLE OFS-2—Estimated Ownership\n2026 - June 39,462.4 12,273.1 27,189.3 N/A 147.9 N/A N/A N/A N/A N/A N/A N/A\n Mar. 39,065.4 12,024.3 27,041.1 2,169.5 148.8 607.0 573.9 597.9 5,122.8 1,641.6 9,355.0 6,824.7\n2025 - Dec. 1.0 2.0 3.0 - n.a. N/A 7.0 8.0 9.0 10.0 11.0 12.0'
        rows = extra._ofs_table(text, '2026-09', 48, 'https://example.test/official.pdf')
        self.assertEqual([r['observation_date'] for r in rows], ['2026-06-30', '2026-03-31', '2025-12-31'])
        self.assertEqual(rows[0]['depository_institutions_usd_billions'], '')
        self.assertIn('N/A', rows[0]['source_value_tokens'])
        self.assertEqual(rows[0]['total_public_debt_usd_billions'], '39462.4')
        self.assertEqual(rows[0]['source_pdf_page'], '48')
        with self.assertRaisesRegex(ValueError, '12-column'):
            extra._ofs_table(text.replace(' N/A 147.9', ' 147.9'), '2026-09', 48, 'url')

    def test_ofs_archive_skips_contents_and_falls_back_only_unavailable_pdf(self):
        from types import SimpleNamespace
        class Page:
            def __init__(self, text): self.text = text
            def extract_text(self): return self.text
        reader = SimpleNamespace(pages=[Page('TABLE OFS-2 Estimated Ownership .... 48'),
            Page('TABLE OFS-2 Estimated Ownership\n2026 - June ' + ' '.join(['N/A'] * 12))])
        calls = []
        def fetch(url):
            calls.append(url)
            if len(calls) == 1:
                raise OSError('not yet published')
            return b'%PDF-fixture'
        with patch('pypdf.PdfReader', return_value=reader):
            result = extra.fetch_dataset({'id': 'TREASURY_OFS2_20Y_ARCHIVE'}, TODAY, ARCHIVE_FIELDS, fetch, fixed_start)
        self.assertIn('2026_09.pdf', calls[0])
        self.assertIn('2026_06.pdf', calls[1])
        self.assertEqual(result['rows'][0]['source_pdf_page'], '2')
        self.assertEqual(result['rows'][0]['source_publication_month'], '2026-06')

    def test_ofs_archive_changed_fetched_pdf_does_not_silently_fallback(self):
        calls = []
        def fetch(url):
            calls.append(url)
            return b'<html>service unavailable</html>'
        with self.assertRaisesRegex(ValueError, 'not PDF'):
            extra.fetch_dataset({'id': 'TREASURY_OFS2_20Y_ARCHIVE'}, TODAY, ARCHIVE_FIELDS, fetch, fixed_start)
        self.assertEqual(len(calls), 1)


if __name__ == '__main__':
    unittest.main()
