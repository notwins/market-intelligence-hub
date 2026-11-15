import csv
import hashlib
import io
import json
import unittest

import import_share_history as history


class HistoryTests(unittest.TestCase):
    def fixture(self):
        data = history.Dataset()
        key = data.listing({'bbTicker': 'ABC US', 'currency': 'USD', 'name': 'ABC'})
        data.source({'id': 'test', 'label': 'Test source', 'file': 'test.csv', 'sha256': 'a'*64, 'metrics': {}})
        return data, key

    def test_precision_zero_missing_and_dictionary_roundtrip(self):
        data, key = self.fixture()
        data.add(key, 'test', {'pe': '0', 'sourcePrice': '1.234567890123456789', 'missing': None, 'status': 'not comparable'}, date='2026-01-01', sourceRow=2)
        raw, meta = history.encode_csv(data)
        parsed = list(csv.reader(io.StringIO(raw.decode())))
        point = next(row for row in parsed if row[1] == 'O')
        self.assertIn('1.234567890123456789', point)
        self.assertIn('0', point)
        self.assertEqual(meta['observations'], 3)
        self.assertEqual(parsed[-1][-1], hashlib.sha256(raw[:raw.rfind(b'\n,Z,')+1]).hexdigest())
        self.assertEqual(history.encode_csv(data)[0], raw)

    def test_exact_currency_and_conflicting_isin_are_separate(self):
        data, usd = self.fixture()
        gbp = data.listing({'bbTicker': 'ABC US', 'currency': 'GBp', 'name': 'ABC pence'})
        self.assertNotEqual(usd, gbp)
        unresolved = data.listing({'key': 'source-row:4', 'bbTicker': 'ABC US', 'currency': None,
                                  'isin': 'US0000000001', 'name': 'Conflicting source', 'forceSeparate': True,
                                  'identityStatus': 'conflict'})
        self.assertNotEqual(usd, unresolved)
        self.assertFalse(data.listings[unresolved]['currentEligible'])
        self.assertFalse(data.listings[unresolved]['compareEligible'])

    def test_duplicate_equal_fact_omitted_conflict_preserved(self):
        data, key = self.fixture()
        for value in ('10.00', '10', '11'):
            data.add(key, 'test', {'pe': value}, date='2026-01-01')
        self.assertEqual(len(data.entries), 2)
        self.assertEqual(data.deduplicated, 1)
        self.assertEqual(data.conflicts, 1)
        self.assertTrue(data.entries[1]['meta']['conflict'])

    def test_invalid_numeric_and_date_rejected(self):
        data, key = self.fixture()
        for value in (float('nan'), float('inf')):
            with self.assertRaises(ValueError):
                data.add(key, 'test', {'pe': value})
        with self.assertRaises(ValueError):
            data.add(key, 'test', {'pe': 10}, date='2026-02-30')
        with self.assertRaises(ValueError):
            data.add(key, 'test', {'pe': 10}, date='2026-02-03', reportDate='2026-02-01')

    def test_source_local_paths_are_not_published(self):
        data, key = self.fixture()
        data.source({'id': 'other', 'label': 'Other', 'file': 'C:\\private\\source.csv', 'sha256': 'b'*64, 'metrics': {}})
        data.add(key, 'other', {'pe': 10})
        raw, _ = history.encode_csv(data)
        self.assertNotIn(b'private', raw)
        self.assertEqual(data.sources['other']['file'], 'source.csv')


if __name__ == '__main__':
    unittest.main()
