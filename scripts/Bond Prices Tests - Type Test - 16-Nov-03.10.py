"""Source parsing, financial notation, identity and retention regression checks."""
import copy
import datetime as dt
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('daily_bond_prices', ROOT/'scripts/Bond Prices - Type Script - 16-Nov-03.10.py')
B = importlib.util.module_from_spec(spec)
spec.loader.exec_module(B)
NOW = dt.datetime(2026, 11, 16, 0, tzinfo=B.UTC)


class BondPricesTests(unittest.TestCase):
    def test_wsj_notation(self):
        for raw, expected in [('99.3040', 99.953125), ('99.3140', 99.984375), ('64.0100', 64.03125), ('96.2320', 96.7265625)]:
            self.assertEqual(B.treasury_price(raw), expected)
        for raw in ['99.3240', '99.3180', 'NaN', '99.3141', '-99.3140', '99.3']:
            with self.assertRaises(ValueError):
                B.treasury_price(raw)

    def test_exact_wsj_identity_and_future_date(self):
        row = B.instruments()[0]
        q = dict(maturityDate='11/15/2033', coupon='4.500', bid='96.2320', ask='96.2520', askYield='5.050')
        quote = B.wsj_quote(row, '2026-11-13', [q], b'source', NOW)
        self.assertEqual(quote['yield_pct'], 5.05)
        self.assertEqual(quote['yield_basis'], 'Asked yield')
        for qs in [[], [q, q], [{**q, 'coupon': '4.0'}], [{**q, 'maturityDate': '11/30/2033'}]]:
            with self.assertRaises(ValueError):
                B.wsj_quote(row, '2026-11-13', qs, b'source', NOW)
        with self.assertRaises(ValueError):
            B.checked_date('2026-11-17', NOW)

    def test_history_dedup_revision_and_failed_refresh(self):
        rows = B.instruments()
        saved = dict(schema_version=1, instruments=rows, latest={}, history={r['id']: [] for r in rows}, checks={})
        q = dict(date='2026-11-13', observed_at='2026-11-13', bid=96.7265625, ask=96.7890625,
                 yield_pct=5.05, yield_basis='Asked yield', bid_raw='96.2320', ask_raw='96.2520',
                 source='WSJ', source_url=B.WSJ, retrieved_at=B.stamp(NOW), source_sha256='a'*64,
                 time_precision='date_only')
        self.assertTrue(B.accept(saved, rows[0], q))
        self.assertFalse(B.accept(saved, rows[0], {**q, 'retrieved_at':'2026-11-16T01:00:00Z', 'source_sha256':'b'*64}))
        self.assertEqual(len(saved['history'][rows[0]['id']]), 1)
        revised = {**q, 'yield_pct': 5.051}
        self.assertTrue(B.accept(saved, rows[0], revised))
        self.assertIn('revision_of', saved['latest'][rows[0]['id']])
        before = copy.deepcopy(saved)
        with self.assertRaises(ValueError):
            B.accept(saved, rows[0], {**q, 'observed_at':'2026-11-12', 'date':'2026-11-12'})
        self.assertEqual(saved, before)
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root/'site/data').mkdir(parents=True)
            (root/'site/data/default-bond-watchlist.json').write_bytes((ROOT/'site/data/default-bond-watchlist.json').read_bytes())
            (root/B.DATA).write_text(json.dumps(saved), encoding='utf-8')
            def fail(url):
                raise OSError('source unavailable')
            failed = B.update(root, NOW, fail)
            self.assertEqual(failed['history'], saved['history'])
            self.assertEqual(failed['latest'], saved['latest'])
            self.assertEqual(failed['status'], 'error')

    def test_bsm_identity_yield_type_and_timestamp(self):
        row = B.instruments()[-1]
        d = dict(bondFactSheetDisplay=dict(issueCode=row['id'], isin=row['isin'], bondCurrencyCode='SGD',
                  couponRate=3.375, maturityDate=2030025600000),
                 indicativeFullLotDisplay=dict(showDate=1794557715000, bidPrice=107.525, askPrice=107.942,
                  yieldTypeToDisplay='ytm', bidYldToMaturity=2.272, askYldToMaturity=2.213))
        q = B.bsm_quote(row, json.dumps(d).encode(), NOW)
        self.assertEqual(q['date'], '2026-11-13')
        self.assertEqual(q['yield_basis'], 'Bid yield to maturity')
        self.assertEqual(q['yield_pct'], 2.272)
        d['bondFactSheetDisplay']['isin'] = 'wrong'
        with self.assertRaises(ValueError):
            B.bsm_quote(row, json.dumps(d).encode(), NOW)


if __name__ == '__main__':
    unittest.main()
