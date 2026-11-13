"""Guard the 8 November status update without treating pending work as published."""
import json
import unittest
from pathlib import Path

SITE = Path(__file__).resolve().parents[1] / 'site'

class LatestResearchStatus(unittest.TestCase):
    def setUp(self):
        self.entries = {r['id']: r for r in json.loads((SITE / 'data/research-register.json').read_text())['entries']}

    def test_unpublished_reports_have_no_public_artifact(self):
        for entry_id in ('pending-humans-only-ai',):
            row = self.entries[entry_id]
            self.assertEqual(row['state'], 'pending')
            self.assertIsNone(row['href'])
            self.assertEqual(row['assets'], [])
            self.assertNotIn('sha256', row)
            self.assertNotIn('published_date', row)
        self.assertIn('rendered layout and accessibility', self.entries['pending-humans-only-ai']['summary'])

    def test_cre_remake_is_a_separate_dated_html_publication(self):
        row = self.entries['pending-us-cre-remake']
        self.assertEqual(row['date'], '2026-11-08')
        self.assertEqual(row['state'], 'published')
        self.assertEqual(row['href'], 'research/us-cre-refinancing-test-2026-11-08/')
        self.assertEqual(row['assets'], [])
        self.assertRegex(row['sha256'], r'^[a-f0-9]{64}$')
        self.assertRegex(row['published_date'], r'^\d{4}-\d{2}-\d{2}$')
        self.assertFalse(list((SITE / row['href']).glob('*.pdf')))

    def test_wealth_remake_preserves_earlier_edition(self):
        row = self.entries['pending-wealth-revision']
        self.assertEqual(row['date'], '2026-11-08')
        self.assertEqual(row['state'], 'pending')
        self.assertEqual(row['href'], 'research/wealth-inequality-2026-11-04/')
        self.assertIn('diversification add-on remain published', row['summary'])

if __name__ == '__main__':
    unittest.main()
