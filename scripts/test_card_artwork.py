import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

import update_card_artwork as artwork


class CardArtworkTests(unittest.TestCase):
    def setUp(self):
        self.library = artwork.load_library()
        self.pools, _ = self.library
        self.research = {'records': [
            {'id': 'ai-infrastructure-2026-11-28', 'kind': 'complete-report',
             'title': 'Nvidia semiconductor demand', 'category': 'Equities'},
            {'id': 'extract-only-2026-11-28', 'kind': 'extract', 'title': 'Central bank news'},
        ]}
        self.briefings = {'editions': [{'date': '2026-11-28', 'reports': {
            key: {'summary': 'Trade deficit widens on capital equipment imports'}
            for key in artwork.BRIEFINGS
        }}]}
        self.hourly = {'editions': [{'stories': [
            {'story_id': 'R-STORY', 'version': 1, 'headline': 'Global equities', 'topic': 'Markets'},
            {'story_id': 'R-STORY', 'version': 2, 'headline': 'Treasury yields rise', 'topic': 'Markets'},
        ]}]}

    def test_topics_prefer_headlines_and_latest_news_version(self):
        assigned = artwork.assignments(self.research, self.briefings, self.hourly, self.library)
        self.assertIn(assigned['reports']['ai-infrastructure-2026-11-28'], self.pools['computing'])
        self.assertNotIn('extract-only-2026-11-28', assigned['reports'])
        self.assertIn(assigned['news']['R-STORY'], self.pools['rates'])
        self.assertIn(assigned['briefings']['2026-11-28']['news'], self.pools['trade'])
        self.assertIn(assigned['briefings']['2026-11-28']['bonds'], self.pools['rates'])
        self.assertEqual(artwork.seed_hash('hello'), 0x4f9f2cab)

    def test_assets_credits_and_assignments_agree(self):
        keys = {key for pool in self.pools.values() for key in pool}
        self.assertEqual(len(keys), 100)
        credits = (artwork.SITE / 'card-artwork-credits.html').read_text(encoding='utf-8')
        for key in keys:
            self.assertIn(f'id="{key}"', credits)
            self.assertLessEqual((artwork.SITE / f'assets/card-art/library/{key}.webp').stat().st_size, 32768)
        saved = json.loads(artwork.OUTPUT.read_text(encoding='utf-8'))
        self.assertTrue(set(saved['reports'].values()) <= keys)
        self.assertTrue(set(saved['news'].values()) <= keys)
        self.assertTrue(all(set(values.values()) <= keys for values in saved['briefings'].values()))

    def test_failed_feed_preserves_saved_assignments(self):
        with TemporaryDirectory() as folder:
            output = Path(folder) / 'artwork.json'
            output.write_bytes(b'previous assignments\n')
            with patch.object(artwork, 'feed', side_effect=[self.research, self.briefings, OSError('Offline')]):
                with patch('sys.argv', ['update_card_artwork.py', '--output', str(output)]):
                    with self.assertRaises(OSError):
                        artwork.main()
            self.assertEqual(output.read_bytes(), b'previous assignments\n')


if __name__ == '__main__':
    unittest.main()
