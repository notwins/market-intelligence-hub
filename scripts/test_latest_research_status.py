"""Guard the 8 November status update without treating pending work as published."""
import json
import unittest
from pathlib import Path

SITE = Path(__file__).resolve().parents[1] / 'site'

class LatestResearchStatus(unittest.TestCase):
    def setUp(self):
        self.entries = {r['id']: r for r in json.loads((SITE / 'data/research-register.json').read_text())['entries']}

    def test_unpublished_reports_have_no_public_artifact(self):
        for entry_id in ('pending-us-cre-remake', 'pending-humans-only-ai'):
            row = self.entries[entry_id]
            self.assertEqual(row['state'], 'pending')
            self.assertIsNone(row['href'])
            self.assertEqual(row['assets'], [])
            self.assertNotIn('sha256', row)
            self.assertNotIn('published_date', row)
        self.assertIn('earlier source report', self.entries['pending-us-cre-remake']['summary'])
        self.assertIn('rendered layout and accessibility', self.entries['pending-humans-only-ai']['summary'])

    def test_wealth_remake_preserves_earlier_edition(self):
        row = self.entries['pending-wealth-revision']
        self.assertEqual(row['date'], '2026-11-08')
        self.assertEqual(row['state'], 'pending')
        self.assertEqual(row['href'], 'research/wealth-inequality-2026-11-04/')
        self.assertIn('diversification add-on remain published', row['summary'])

if __name__ == '__main__':
    unittest.main()
