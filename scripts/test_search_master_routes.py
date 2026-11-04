import json
from pathlib import Path
import unittest
from urllib.parse import parse_qs, urlsplit

from build_site_search import master_record_target


class MasterSearchRoutes(unittest.TestCase):
    def test_every_saved_identity_round_trips_without_using_a_display_name(self):
        root = Path(__file__).resolve().parents[1]
        records = json.loads((root / 'site/data/master-v3.json').read_text(encoding='utf-8'))['records']
        targets = set()
        for record in records:
            target = master_record_target(record)
            parsed = urlsplit(target)
            self.assertEqual(parsed.path, 'v4.html')
            self.assertEqual(parsed.fragment, 'master/explore')
            self.assertEqual(parse_qs(parsed.query), {'security': [record['id']]})
            targets.add(target)
        self.assertEqual(len(targets), len(records))

    def test_missing_identity_does_not_claim_an_exact_record(self):
        for record in [{}, {'id': None}, {'id': ''}, {'id': 12}]:
            self.assertIsNone(master_record_target(record))

    def test_query_punctuation_cannot_change_the_destination(self):
        identity = 'fixture:&other=x#fragment/<tag>'
        parsed = urlsplit(master_record_target({'id': identity}))
        self.assertEqual(parsed.fragment, 'master/explore')
        self.assertEqual(parse_qs(parsed.query), {'security': [identity]})


if __name__ == '__main__':
    unittest.main()
