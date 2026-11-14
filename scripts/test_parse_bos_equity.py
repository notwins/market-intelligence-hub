"""Financial source semantics tests; these need no PDF runtime dependencies."""
import unittest
from datetime import date

from parse_bos_equity import ExtractionError, numeric, price_date, provider, report_date


class BosSourceSemanticsTests(unittest.TestCase):
    def test_unavailable_and_restricted_targets_are_not_zero(self):
        for source in ('NA', 'N/A', 'UR', 'Restricted', 'Closed', '-', ''):
            with self.subTest(source=source):
                self.assertIsNone(numeric(source))
        self.assertEqual(numeric('0.0'), 0)

    def test_parentheses_are_negative_and_thousands_separator_is_not_decimal(self):
        self.assertEqual(numeric('(206)'), -206)
        self.assertEqual(numeric('-12'), -12)
        self.assertEqual(numeric('1,619.0'), 1619)
        self.assertEqual(numeric('6,400.00'), 6400)

    def test_unrecognised_numeric_does_not_silently_disappear(self):
        for source in ('4.1 5.2', 'n.m.', '1O.2', '$100', 'Buy'):
            with self.subTest(source=source), self.assertRaises(ExtractionError):
                numeric(source)

    def test_report_and_price_dates_remain_distinct(self):
        self.assertEqual(report_date('Equity Strategy\n13 November 2026\nDaily Updates'), date(2026, 11, 13))
        self.assertEqual(price_date('12-Nov', date(2026, 11, 13)), date(2026, 11, 12))
        self.assertEqual(price_date('31-Dec', date(2027, 1, 2)), date(2026, 12, 31))

    def test_bad_date_header_fails_closed(self):
        for source in ('Price', '12-Nov-26', '12/11', '12-Oct'):
            with self.subTest(source=source), self.assertRaises(ExtractionError):
                price_date(source, date(2026, 11, 13))

    def test_morningstar_requires_evidence_not_region_or_uncertainty(self):
        self.assertEqual(provider({'analystOrUncertainty': 'High'}, []), (None, None))
        self.assertEqual(provider({'analystOrUncertainty': 'High'}, [
            'https://productgroup.bankofsingapore.com/apollo/assets/reports/morningstar/apollo/2026/Nov/x.pdf'
        ]), ('Morningstar', 'embedded_report_link'))
        self.assertEqual(provider({'analystOrUncertainty': 'OCBC'}, []), ('OCBC', 'analyst_column'))
        self.assertEqual(provider({'analystOrUncertainty': 'HTI'}, []), ('Haitong International', 'analyst_column'))
        self.assertEqual(provider({'analystOrUncertainty': 'PTOS'}, []), ('PT OCBC Sekuritas Indonesia', 'analyst_column'))


if __name__ == '__main__':
    unittest.main()
