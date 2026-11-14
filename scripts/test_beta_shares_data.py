"""Historical equity semantics: runs without the private CSV or extra packages."""
import json
from pathlib import Path
import unittest

from import_beta_shares import calendar_return, credit_value, number

ROOT = Path(__file__).resolve().parents[1]


class BetaSharesDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((ROOT / 'site/data/beta-shares.json').read_text(encoding='utf-8'))
        cls.rows = cls.data['records']
        cls.by_ticker = {row['bbTicker']: row for row in cls.rows}

    def test_cleaned_population_and_identity(self):
        self.assertEqual(len(self.rows), 790)
        self.assertEqual(len(self.by_ticker), 790)
        self.assertEqual(len({r['isin'] for r in self.rows}), 790)
        self.assertEqual(self.data['validation']['excludedTickerOnlyRows'], 321)
        self.assertTrue(all(4 <= r['sourceRow'] <= 793 for r in self.rows))
        self.assertEqual(self.by_ticker['DBS SP']['sourceRow'], 781)
        self.assertNotIn('TSLA US', self.by_ticker)

    def test_calendar_returns_are_not_overlapping_source_returns(self):
        nvda = self.by_ticker['NVDA US']['returns']
        self.assertAlmostEqual(nvda['calendar']['2025'], 38.91569075927448)
        self.assertEqual(nvda['holding']['2025'], 65.94717)
        self.assertEqual(nvda['annualized']['2025'], 34.35603)
        self.assertEqual(nvda['ytd']['2026'], 19.45891)
        self.assertEqual(calendar_return(50, 20), 25)
        self.assertIsNone(calendar_return(None, 20))
        self.assertIsNone(calendar_return(0, None))
        with self.assertRaises(ValueError):
            calendar_return(20, -100)

    def test_return_coverage_missingness_and_reconciliation(self):
        expected = {'2026': 783, '2025': 761, '2024': 756, '2023': 744,
                    '2022': 737, '2021': 725, '2020': 706, '2019': 689}
        self.assertEqual(self.data['validation']['returnCoverage'], expected)
        self.assertEqual(self.data['validation']['returnPairsChecked'], 5901)
        for r in self.rows:
            for year in range(2019, 2026):
                actual = r['returns']['calendar'][str(year)]
                expected_value = calendar_return(r['returns']['holding'][str(year)], r['returns']['holding'][str(year+1)])
                self.assertEqual(actual, expected_value)
        self.assertTrue(all(v is None for v in self.by_ticker['SPCX US']['returns']['holding'].values()))
        self.assertIsNone(number(''))
        self.assertEqual(number('0'), 0)

    def test_basis_confirmation_does_not_invent_quote_or_credit_dates(self):
        self.assertEqual(self.data['returnBasis'], {'currency':'local','dividends':'gross_reinvested','confirmedBy':'user'})
        self.assertEqual(self.data['returnCutoff'], '2026-09-19')
        self.assertEqual(self.data['returnCutoffBasis'], 'inferred_from_annualized_and_holding_returns')
        self.assertIsNone(self.data['priceAsOf'])
        self.assertIsNone(self.data['creditAsOf'])
        self.assertTrue(all(r['snapshot']['currency'] is None and r['snapshot']['marketCapCurrency'] is None for r in self.rows))
        self.assertTrue(all(c['asOf'] is None for r in self.rows for c in r['credit']))

    def test_ratings_keep_scope_status_and_qualifiers(self):
        value = credit_value('(P)Baa1 *-', "Moody's", 'Senior unsecured debt', 'example')
        self.assertEqual(value['grade'], 'Baa1')
        self.assertEqual(value['qualifiers'], ['(P)', '*-'])
        self.assertEqual(value['raw'], '(P)Baa1 *-')
        for raw, status in [('WR','withdrawn'),('WD','withdrawn'),('WDu','withdrawn'),('NR','not_rated'),('','missing')]:
            self.assertEqual(credit_value(raw, 'Fitch', 'Issuer', 'example')['status'], status)
        self.assertTrue(all(len(r['credit']) == 5 for r in self.rows))
        self.assertTrue(all(r['creditOutlook']['field'] == 'RTG_SP_OUTLOOK' for r in self.rows))

    def test_no_raw_input_or_unlabelled_columns_exported(self):
        text = json.dumps(self.data)
        self.assertNotIn('C:\\', text)
        self.assertNotIn('for chat gpt.csv', text)
        for row in self.rows:
            self.assertNotIn('raw', row)
            self.assertNotIn('historicalPe', row['snapshot'])
            self.assertNotIn('YAS_BOND_YLD', row['snapshot'])
            self.assertNotIn('AMT_OUTSTANDING', row['snapshot'])


if __name__ == '__main__':
    unittest.main()
