"""Public report links must resolve to preserved artifacts and exact share anchors."""
import hashlib
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'site'

class WatchlistReportDestinations(unittest.TestCase):
    def test_saved_report_receipts_and_all_share_anchors(self):
        reports = json.loads((SITE / 'data/watchlist/report-index.json').read_text())['reports']
        archive = {e['id']: e for e in json.loads((SITE / 'data/watchlist/index.json').read_text())['editions']}
        tickers = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'BRK.B', 'AMD', 'AVGO', 'MU', 'TSLA', 'TSM']
        self.assertTrue(reports)
        for report in reports:
            with self.subTest(edition=report['edition_id']):
                edition_id = report['edition_id']
                self.assertRegex(edition_id, r'^watchlist-\d{8}T\d{6}Z(?:-r[1-9][0-9]*)?$')
                self.assertEqual(report['path'], f'data/watchlist/reports/{edition_id}.html')
                content = (SITE / report['path']).read_bytes()
                self.assertEqual(hashlib.sha256(content).hexdigest(), report['sha256'])
                self.assertEqual(report['as_of'], archive[edition_id]['as_of'])
                for ticker in tickers:
                    self.assertIn(f'id="{ticker}"', content.decode())

    def test_frontend_load_order_and_internal_company_search(self):
        page = (SITE / 'v4.html').read_text()
        self.assertLess(page.index('src="watchlist-report-links.js'), page.index('src="watchlist.js'))
        source = (SITE / 'watchlist.js').read_text()
        self.assertIn('search.html?q=${encodeURIComponent(r.ticker)}', source)
        self.assertIn('External source · leaves Market Intel · new tab', source)
        self.assertNotIn('Open the full GOOGL company report ↗', source)
        public = (SITE / 'watchlist-report-links.js').read_text()
        for private_identifier in ['libfile_', 'chatgpt.com/c/', 'chatgpt.com/g/', 'sediment://']:
            self.assertNotIn(private_identifier, public)
        self.assertNotIn('href="#"', public)

if __name__ == '__main__':
    unittest.main()
