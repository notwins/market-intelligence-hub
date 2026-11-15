import datetime as dt
from decimal import Decimal
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import share_history_sources as source


class NumbersAndDates(unittest.TestCase):
    def test_exact_numeric_text_zero_and_errors(self):
        self.assertEqual(source.decimal_text('123.45678901234567890'), '123.45678901234567890')
        self.assertEqual(source.decimal_text('0.000'), '0.000')
        self.assertEqual(source.decimal_text('-0.125'), '-0.125')
        self.assertEqual(source.decimal_text('1.2E+11'), '1.2E+11')
        for value in ('#VALUE!', '#N/A', '', 'NaN', 'Infinity', None, True):
            self.assertIsNone(source.decimal_text(value))

    def test_quotation_date_must_be_typed_source_date(self):
        self.assertEqual(source.source_date(dt.datetime(2026, 11, 5)), '2026-11-05')
        for value in ('Oct-2026', '2026-11-05', None, 46200):
            with self.assertRaises(ValueError):
                source.source_date(value)

    def test_xml_precision_takes_priority_over_float(self):
        self.assertEqual(source.cell_number({'Daily 1M': {'E7': '1.234567890123456789'}}, 'Daily 1M', 'E', 7, 1.2345678901234567), '1.234567890123456789')


class FakeSheet:
    def __init__(self, rows): self.rows = rows
    def iter_rows(self, **kwargs): return iter(self.rows)


class FakeBook(dict):
    def close(self): pass


class PublicFieldSelection(unittest.TestCase):
    def test_october_financing_private_fields_never_escape_and_unknown_dates_stay_null(self):
        headers = ['BB Ticker', 'Security No', 'ISIN', 'Ace Name', 'Fixed AR(%)',
                   'Funds Identifier Concentration Limit(%)', 'Underlying Issuer Concentration Limit(%)',
                   'Product Concentration Limit(%)', 'FINIQ', 'RAW TICKER', 'EXCHANGE',
                   'TICKER FIN IQ', 'excelStock', 'Price', 'Market Cap', 'Company Name', 'Dividends (%)']
        private = 'DO-NOT-EXPORT-PRIVATE'
        rows = [headers, ['AAA US EQUITY', private, 'US0000000001', 'Alpha', private, private, private,
                          private, 'AAA.OQ', 'AAA', 'UQ', 'AAA UQ', private, 10.5, 0, 'Alpha Inc', 0]]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'Oct-2026.xlsx';path.write_bytes(b'fixture')
            with patch.object(source, 'load_workbook', return_value=FakeBook(SharePrice=FakeSheet(rows))), patch.object(source, 'raw_numeric_cells', return_value={'SharePrice': {'N2': '10.5000', 'O2': '0', 'Q2': '0'}}):
                meta, listings, observations = source.read_october(path)
        self.assertNotIn(private, str((meta, listings, observations)))
        self.assertEqual(listings[0]['bbTicker'], 'AAA US')
        self.assertIsNone(listings[0]['currency'])
        self.assertEqual([point['value'] for point in observations], ['10.5000', '0', '0'])
        self.assertTrue(all(point['date'] is None and point['currency'] is None for point in observations))
        self.assertNotIn('archiveMonth', observations[0])

    def test_duplicate_isin_does_not_collapse_distinct_rows(self):
        headers = ['BB Ticker', 'Security No', 'ISIN', 'Ace Name', '', '', '', '', 'FINIQ',
                   'RAW TICKER', 'EXCHANGE', 'TICKER FIN IQ', 'excelStock', 'Price', 'Market Cap', 'Company Name', 'Dividends (%)']
        row = ['AAA US EQUITY', None, 'US0000000001', 'Alpha', None, None, None, None,
               'AAA.OQ', 'AAA', 'UQ', 'AAA UQ', None, 10, 1000, 'Alpha', 1]
        other = list(row);other[0] = None;other[8] = 'AAA.L';other[10] = 'L'
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'source.xlsx';path.write_bytes(b'fixture')
            with patch.object(source, 'load_workbook', return_value=FakeBook(SharePrice=FakeSheet([headers, row, other]))), patch.object(source, 'raw_numeric_cells', return_value={}):
                _, listings, observations = source.read_october(path)
        self.assertEqual(len(listings), 2)
        self.assertNotEqual(listings[0]['key'], listings[1]['key'])
        self.assertEqual(listings[0]['isin'], listings[1]['isin'])
        self.assertEqual(len(observations), 6)


if __name__ == '__main__':
    unittest.main()
