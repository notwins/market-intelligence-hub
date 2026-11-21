import json
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

import refresh_treasury_catalogue as catalogue


def auction(kind, cusip, coupon, issued, matures, **fields):
    return dict(securityType=kind, cusip=cusip, interestRate=coupon, competitiveAuctionCloseDate=issued,
                issueDate=issued, maturityDate=matures, inflationProtected='No', floatingRate='No',
                callable='No', frequencyOfInterestPayments='Semi-Annual') | fields


class TreasuryCatalogueTest(unittest.TestCase):
    today = date(2026, 11, 22)

    def setUp(self):
        self.bond = auction('Bond', '912810UY2', '5.375', '2026-11-16', '2056-11-15', originalSecurityTerm='30-Year')
        self.note = auction('Note', '91282CJJ1', '4.5', '2023-11-15', '2033-11-15', originalSecurityTerm='10-Year')
        self.sources = {'Bond': [self.bond], 'Note': [self.note]}

    def test_terms_exclude_other_structures_and_reopenings_preserve_issuance(self):
        self.sources['Bond'].extend([
            self.bond | {'issueDate': '2026-11-21', 'originalIssueDate': '2026-11-16'},
            self.bond | {'inflationProtected': 'Yes', 'interestRate': '99'},
            self.bond | {'callable': 'Yes', 'interestRate': '99'},
            self.bond | {'issueDate': '2026-12-01', 'interestRate': '99'},
        ])
        result = catalogue.project(self.sources, self.today)
        self.assertEqual(result['instruments'], [
            ['US912810UY28', 'Bond', 5.375, '2026-11-16', '2056-11-15', 360],
            ['US91282CJJ18', 'Note', 4.5, '2023-11-15', '2033-11-15', 120],
        ])
        self.assertEqual(catalogue.original_term_months({'originalSecurityTerm': '20-Year 1-Month'}), 241)

    def test_incomplete_refresh_retains_previous_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'catalogue.json'
            previous = catalogue.serialize(catalogue.project(self.sources, self.today))
            output.write_bytes(previous)
            with patch.object(catalogue, 'download', side_effect=lambda kind, _: self.sources[kind]):
                self.assertEqual(catalogue.refresh(output, self.today), 2)
                self.assertEqual(json.loads(output.read_bytes())['schema_version'], 1)
                self.sources['Bond'] = []
                with self.assertRaises(ValueError):
                    catalogue.refresh(output, self.today)
            self.assertEqual(output.read_bytes(), previous)

    def test_conflicting_terms_are_rejected(self):
        self.sources['Bond'].append(self.bond | {'interestRate': '5.25'})
        with self.assertRaisesRegex(ValueError, 'Conflicting coupon or maturity'):
            catalogue.project(self.sources, self.today)
