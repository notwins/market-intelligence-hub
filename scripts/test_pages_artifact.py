"""Regressions for the deployed bytes, including older editions and companions."""
import hashlib
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from audit_pages_artifact import audit, inventory
from build_pages_artifact import build, ROOT


def hashes(root):
    return {name: hashlib.sha256(path.read_bytes()).hexdigest() for name, path in inventory(root).items()}


class PagesArtifactTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temp.name) / 'candidate'
        cls.before = hashes(ROOT/'site')
        cls.site = build(cls.root)
        cls.result = audit(ROOT/'site', cls.site)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def node(self, script, *args, check=True):
        return subprocess.run(['node', str(ROOT/'scripts'/script), *map(str, args)],
                              check=check, capture_output=True, text=True)

    def test_source_tree_is_untouched_and_repeated_injection_is_idempotent(self):
        self.assertEqual(hashes(ROOT/'site'), self.before)
        before = hashes(self.site)
        self.node('inject_legal_footer.cjs', self.site)
        self.assertEqual(hashes(self.site), before)
        self.node('test_legal_footer.cjs', self.site)

    def test_every_manifest_and_receipt_family_is_checked(self):
        rows = json.loads((ROOT/'site/data/watchlist/report-index.json').read_text())['reports']
        self.assertEqual(self.result['receipt_checks']['watchlist_report'], len(rows))
        self.assertEqual(self.result['publication_manifest_count'], len(list((ROOT/'site').rglob('publication.json'))))
        self.assertEqual(set(self.result['receipt_checks']), {
            'watchlist_report', 'call_report', 'publication_html', 'publication_companion',
            'preserved_source_file', 'treasury_shard'})
        self.assertIn('market-understanding/index.html', self.result['immutable_footer_exceptions'])
        self.assertIn('market-understanding/ai-data-centres-2026-11-05/presentations/Presentation_Notes.html',
                      self.result['immutable_footer_exceptions'])
        self.assertIn('watchlist-report.html', self.result['mutable_html'])
        self.assertGreater(self.result['byte_identical_file_count'], 300)

    def test_mutations_of_old_reports_calls_downloads_receipts_and_baselines_fail(self):
        paths = [
            'data/watchlist/reports/watchlist-20261103T120000Z.html',
            'data/watchlist/reports/watchlist-20261106T000000Z.html',
            'research/calls/call-qqq-hedge-review-20261031/index.html',
            'research/sti-banks-2026-11-06/index.html',
            'research/sti-banks-2026-11-06/publication.json',
            'data/watchlist/report-index.json',
            'data/watchlist/archive/watchlist-20261103T120000Z.json',
            'data/watchlist/reviews/watchlist-20261103T120000Z.json',
            'market-understanding/index.html',
            'research/googl/index.html',
            'research/wealth-inequality-2026-11-04/sharpe.html',
        ]
        paths += [row['path'] for row in self.result['checks'] if row['category'] in
                  ('publication_companion', 'preserved_source_file', 'treasury_shard')]
        for relative in paths:
            with self.subTest(path=relative):
                target = self.site/relative
                original = target.read_bytes()
                try:
                    target.write_bytes(original + b'\n<!-- MIH_LEGAL_FOOTER_V1 -->\n')
                    with self.assertRaisesRegex(ValueError, 'Protected source bytes changed'):
                        audit(ROOT/'site', self.site)
                finally:
                    target.write_bytes(original)

    def test_privacy_projection_rejects_unrelated_news_changes(self):
        target = self.site/'data/hourly-news.json'
        original = target.read_bytes()
        try:
            data = json.loads(original)
            data['editions'][0]['summary'] += ' unapproved mutation'
            target.write_text(json.dumps(data))
            with self.assertRaisesRegex(ValueError, 'Protected source bytes changed'):
                audit(ROOT/'site', self.site)
        finally:
            target.write_bytes(original)

    def test_removing_an_original_is_not_hidden_by_missing_receipt(self):
        target = self.site/'data/watchlist/report-index.json'
        original = target.read_bytes()
        try:
            target.unlink()
            with self.assertRaisesRegex(ValueError, 'Artifact file set changed'):
                audit(ROOT/'site', self.site)
        finally:
            target.write_bytes(original)

    def test_footer_is_last_not_merely_present(self):
        for relative in ['v4.html', 'watchlist-report.html', 'legal/terms.html']:
            with self.subTest(path=relative):
                target = self.site/relative
                original = target.read_bytes()
                try:
                    target.write_bytes(original.replace(b'</body>', b'<p>Content after footer</p></body>'))
                    self.assertNotEqual(self.node('test_legal_footer.cjs', self.site, check=False).returncode, 0)
                finally:
                    target.write_bytes(original)

    def test_legal_navigation_does_not_become_research_evidence(self):
        from index_external_source_usage import Page
        original = '<title>Report</title><a href="https://example.org/source">Source</a>'
        footer = '<footer class="mih-legal-footer"><nav><a href="legal/terms.html">Terms</a></nav></footer>'
        before, after = Page(), Page()
        before.feed(original + '<a href="https://example.org/second">Second source</a>')
        after.feed(original + footer + '<a href="https://example.org/second">Second source</a>')
        self.assertEqual(before.links, after.links)
        self.assertEqual(before.title, after.title)
        self.assertEqual(len(after.links), 2)

    def test_footer_links_resolve_inside_site_at_every_depth(self):
        from html.parser import HTMLParser
        class Links(HTMLParser):
            def __init__(self):
                super().__init__(); self.links = []
            def handle_starttag(self, tag, attrs):
                if tag == 'a': self.links.append(dict(attrs)['href'])
        for relative in self.result['mutable_html']:
            page = self.site/relative
            text = page.read_text(encoding='utf-8')
            parser = Links(); parser.feed(text.split('<!-- MIH_LEGAL_FOOTER_V1 -->')[1])
            self.assertEqual(len(parser.links), 6)
            for link in parser.links:
                self.assertTrue((page.parent/link).resolve().is_relative_to(self.site.resolve()))
                self.assertTrue((page.parent/link).is_file(), relative + ': ' + link)

    def test_namespace_and_manifest_protection_do_not_depend_on_dated_filenames(self):
        sealed = self.site/'research/new-original.html'
        extra = self.site/'new-publication'
        extra.mkdir()
        content = b'<html><body><main>Original</main></body></html>'
        try:
            sealed.write_bytes(content)
            (extra/'index.html').write_bytes(content)
            (extra/'notes.html').write_bytes(content)
            (extra/'publication.json').write_text(json.dumps({
                'html_sha256': hashlib.sha256(content).hexdigest(),
                'presentations': {'notes_companion': {'path': 'notes.html', 'sha256': hashlib.sha256(content).hexdigest()}}
            }), encoding='utf-8')
            self.node('inject_legal_footer.cjs', self.site)
            for target in [sealed, extra/'index.html', extra/'notes.html']:
                self.assertEqual(target.read_bytes(), content)
        finally:
            sealed.unlink()
            for name in ['index.html', 'notes.html', 'publication.json']:
                (extra/name).unlink()
            extra.rmdir()

    def test_stage_refuses_existing_candidate_and_source_checkout(self):
        with self.assertRaisesRegex(ValueError, 'must not already exist'):
            build(self.root)
        with self.assertRaisesRegex(ValueError, 'outside the source'):
            build(ROOT/'site/candidate')

    def test_workflow_uploads_only_after_the_final_gate(self):
        workflow = (ROOT/'.github/workflows/publish.yml').read_text()
        stage = workflow.index('python3 scripts/build_pages_artifact.py')
        gate = workflow.index('python3 scripts/validate_pages_artifact.py')
        upload = workflow.index('uses: actions/upload-pages-artifact@')
        self.assertLess(stage, gate)
        self.assertLess(gate, upload)
        self.assertIn('path: ${{ runner.temp }}/mih-pages/site', workflow[upload:])
        self.assertNotIn('inject_legal_footer', workflow[gate:])


if __name__ == '__main__':
    unittest.main()
