import copy
import json
import unittest
from pathlib import Path
from public_data_projection import public_value, projected_bytes, private_url, stage
from import_hourly_news import report_identity, validate, empty_feed
from test_hourly_news import sample, NOW


class PublicDataProjectionTests(unittest.TestCase):
    def test_private_origins_only(self):
        for url in ('https://chatgpt.com/c/fixture', 'https://chatgpt.com/g/project/c/fixture',
                    'https://chat.openai.com/c/fixture', 'https://chatgpt.com/%63/fixture',
                    'https://chatgpt.com/space/private', 'https://chatgpt.com/library/private'):
            self.assertTrue(private_url(url))
            self.assertIsNone(public_value(url))
        for value in ('https://chatgpt.com/share/public', 'https://www.reuters.com/article', None, 7):
            self.assertEqual(public_value(value), value)

    def test_hourly_legacy_identity_content_and_source_preserved(self):
        old = sample(); old.pop('source_report_key'); old['original_url'] = 'https://chatgpt.com/c/fixture'
        before = copy.deepcopy(old)
        new = public_value(old)
        self.assertEqual(old, before)
        self.assertEqual(report_identity(old), report_identity(new))
        validate(new, NOW)
        for key in old:
            if key != 'original_url': self.assertEqual(old[key], new[key])
        self.assertIsNone(new['original_url'])
        self.assertEqual(public_value(new), new)
        self.assertIsNone(empty_feed()['source_url'])

    def test_only_allowlisted_data_families_transform(self):
        raw = json.dumps({'original_url': 'https://chatgpt.com/c/fixture', 'full_text': 'Retained'}).encode()
        self.assertEqual(projected_bytes('research/report.json', raw), raw)
        out = projected_bytes('data/v2/before-fixture.json', raw)
        self.assertEqual(json.loads(out), {'original_url': None, 'full_text': 'Retained'})
        self.assertEqual(projected_bytes('data/v2/before-fixture.json', out), out)

    def test_final_data_has_no_private_origin_urls(self):
        root = Path(__file__).resolve().parents[1] / 'site'
        paths = [root/'data/hourly-news.json', root/'v2-data.js',
                 *(root/'data/hourly-archive').glob('*.json'), *(root/'data/v2').glob('*.json')]
        for path in paths:
            relative = path.relative_to(root).as_posix()
            out = projected_bytes(relative, path.read_bytes()).decode()
            data = json.loads(out[len('window.MI_V2_DATA='):].strip()[:-1]) if relative == 'v2-data.js' else json.loads(out)
            def visit(value):
                if isinstance(value, dict):
                    for child in value.values(): visit(child)
                elif isinstance(value, list):
                    for child in value: visit(child)
                else: self.assertFalse(private_url(value), relative)
            visit(data)

if __name__ == '__main__': unittest.main()
