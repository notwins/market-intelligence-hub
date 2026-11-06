"""Privacy changes must survive rebuilding without changing original evidence."""
import copy
import hashlib
import json
import re
import shutil
import tempfile
import unittest
from pathlib import Path

from public_display_text import public_display_payload, public_text
from watchlist_report import import_report, render_report

ROOT = Path(__file__).resolve().parents[1]
LEGACY_LABEL = re.compile(r"Winston(?:\s+Ng\b|[’']s (?:public watchlist|thoughts|research article))", re.I)


class PublicPrivacyTests(unittest.TestCase):
    def test_neutral_labels_do_not_erase_other_peoples_names(self):
        text = "Prepared for Winston Ng. Winston’s public watchlist. Winston's thoughts. Winston’s research article."
        cleaned = public_text(text)
        self.assertIsNone(LEGACY_LABEL.search(cleaned))
        self.assertIn('Market Intel public watchlist', cleaned)
        self.assertEqual(public_text('Winston Churchill, Winston Smith, Howard Marks and Wayne Dahl'),
                         'Winston Churchill, Winston Smith, Howard Marks and Wayne Dahl')

    def test_display_cleanup_preserves_links_ids_and_receipts(self):
        data = {'id': 'Winston Ng', 'sha256': 'a'*64, 'path': 'research/sti-banks-2026-11-06/index.html',
                'href': 'https://winston-options-lab.winstonnggw.chatgpt.site/',
                'title': 'Report by Winston Ng', 'usages': [{'title': "Winston's thoughts", 'id': 'saved-original'}]}
        before = copy.deepcopy(data)
        result = public_display_payload(data)
        self.assertEqual(data, before)
        for key in ('id', 'sha256', 'path', 'href'):
            self.assertEqual(result[key], before[key])
        self.assertEqual(result['title'], 'Report by the project maintainer')
        self.assertEqual(result['usages'][0]['title'], 'Independent research')

    def test_rebuilt_catalogues_have_no_legacy_labels_or_contact_placeholders(self):
        for name in ('site-search', 'external-sources', 'publication-timeline'):
            path = ROOT/'site/data'/f'{name}.json'
            # Timeline is generated later in CI and is mandatory in the final artifact.
            if name == 'publication-timeline' and not path.exists():
                continue
            with self.subTest(catalogue=name):
                text = path.read_text(encoding='utf-8')
                self.assertIsNone(LEGACY_LABEL.search(text))
                self.assertNotRegex(text, r'\[INSERT (?:PRIVATE CONTACT|LEGAL OPERATOR)')
                self.assertNotIn('using the private contact stated above', text)

    def test_legal_drafts_keep_rights_and_valid_navigation_without_contact_prompts(self):
        for path in (ROOT/'site/legal').glob('*.html'):
            text = path.read_text(encoding='utf-8')
            with self.subTest(page=path.name):
                self.assertIn('Not yet approved as a final policy.', text)
                self.assertIn('legal operator, privacy-request process, separately hosted app data flows', text)
                self.assertNotRegex(text, r'\[INSERT|privacy-contact email|private contact|contact channel')
                self.assertIsNone(LEGACY_LABEL.search(text))
                for anchor in re.findall(r'href="#([^"]+)"', text):
                    self.assertIn(f'id="{anchor}"', text)
        privacy = (ROOT/'site/legal/privacy.html').read_text(encoding='utf-8')
        for phrase in ('access, correction or withdrawal of consent', 'legal exceptions', 'Voluntary correspondence'):
            self.assertIn(phrase, privacy)

    def test_new_watchlist_template_is_neutral(self):
        edition = json.loads((ROOT/'site/data/watchlist/archive/watchlist-20261103T120000Z.json').read_bytes())
        result = render_report(edition)
        self.assertIn('Market Intel public watchlist', result)
        self.assertIn('Renderer version 2.', result)
        self.assertIsNone(LEGACY_LABEL.search(result))

    def test_every_existing_v1_watchlist_is_exactly_reproducible(self):
        site = ROOT/'site'
        receipts = json.loads((site/'data/watchlist/report-index.json').read_bytes())['reports']
        for receipt in receipts:
            original = (site/receipt['path']).read_bytes()
            if b'Renderer version 1.' not in original:
                continue
            with self.subTest(edition=receipt['edition_id']):
                edition = json.loads((site/'data/watchlist/archive'/f"{receipt['edition_id']}.json").read_bytes())
                self.assertEqual(render_report(edition, template_version=1).encode('utf-8'), original)
                self.assertEqual(hashlib.sha256(original).hexdigest(), receipt['sha256'])

    def test_legacy_import_needs_exact_bytes_and_its_original_receipt(self):
        source = ROOT/'site/data/watchlist'
        edition = json.loads((source/'archive/watchlist-20261103T120000Z.json').read_bytes())
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)/'data/watchlist'
            shutil.copytree(source, folder)
            report = folder/'reports'/f"{edition['id']}.html"
            index = folder/'report-index.json'
            saved, receipt_bytes = report.read_bytes(), index.read_bytes()
            import_report(edition, temp)
            self.assertEqual(report.read_bytes(), saved)
            self.assertEqual(index.read_bytes(), receipt_bytes)
            # A valid old rendering is insufficient if the stored receipt differs.
            data = json.loads(receipt_bytes)
            next(r for r in data['reports'] if r['edition_id'] == edition['id'])['sha256'] = '0'*64
            index.write_text(json.dumps(data), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'Report receipt conflict'):
                import_report(edition, temp)
            self.assertEqual(report.read_bytes(), saved)
            index.write_bytes(receipt_bytes)
            report.write_bytes(saved + b'<!-- mutation -->')
            with self.assertRaisesRegex(ValueError, 'Fixed report'):
                import_report(edition, temp)
            report.write_bytes(saved)
            changed = copy.deepcopy(edition)
            changed['title'] = 'Changed research'
            with self.assertRaisesRegex(ValueError, 'Fixed report'):
                import_report(changed, temp)
            index.unlink()
            with self.assertRaisesRegex(ValueError, 'Fixed report'):
                import_report(edition, temp)


if __name__ == '__main__':
    unittest.main()
