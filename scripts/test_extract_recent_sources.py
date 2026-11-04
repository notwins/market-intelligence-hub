"""Offline canonicalization, privacy, provenance and reproducibility tests."""
import json
import os
import unittest
import subprocess
from pathlib import Path
from urllib.parse import urlsplit
from extract_recent_sources import (canonical_url, clean_title, saved_date,
                                    instant_key, source_links, Inventory, Repository,
                                    extract, DEFAULT_REVISION)


class URLTests(unittest.TestCase):
    def assertRejected(self, url):
        self.assertIsNone(canonical_url(url)[0], url)
    def test_https_only(self):
        for url in ['http://www.reuters.com/article', 'file:///tmp/x', 'sandbox:/tmp/x',
                    'javascript:alert(1)', 'data:text/plain,secret', '//www.reuters.com/']:
            self.assertRejected(url)
    def test_private_destinations(self):
        for url in ['https://chatgpt.com/c/abc', 'https://sub.chatgpt.com/share/abc',
                    'https://127.0.0.1/', 'https://192.168.1.8/', 'https://[::1]/',
                    'https://localhost/', 'https://intranet/', 'https://a.internal/',
                    'https://x.oaiusercontent.com/a', 'https://account.blob.core.windows.net/a',
                    'https://drive.google.com/file/d/private/view', 'https://example.com/',
                    'https://notwins.github.io/market-intelligence-hub/v4.html']:
            self.assertRejected(url)
    def test_credentials_private_fields(self):
        for url in ['https://user:password@www.reuters.com/',
                    'https://www.reuters.com/?token=x', 'https://www.reuters.com/?api_key=x',
                    'https://www.reuters.com/?accessToken=x', 'https://www.reuters.com/?session_id=x',
                    'https://www.reuters.com/?email=a%40b.com', 'https://www.reuters.com/?q=a%40b.com',
                    'https://www.reuters.com/?X-Amz-Signature=x', 'https://www.reuters.com/?code=x',
                    'https://www.reuters.com/#access_token=x', 'https://www.reuters.com/#token=x']:
            self.assertRejected(url)
    def test_tracking_removed_but_public_query_preserved(self):
        self.assertEqual(canonical_url('https://WWW.Reuters.com:443/story?utm_source=x&article=123#section')[0],
                         'https://www.reuters.com/story?article=123#section')
        self.assertEqual(canonical_url('https://news.google.com/rss/articles/ABC?oc=5')[0],
                         'https://news.google.com/rss/articles/ABC')
        self.assertEqual(canonical_url('https://finance.yahoo.com/quote/AAPL/history/?guce_referrer_sig=x&guce_referrer=a&ltr=1&period1=12&period2=24')[0],
                         'https://finance.yahoo.com/quote/AAPL/history/?period1=12&period2=24')
    def test_conservative_identity(self):
        url = 'https://home.treasury.gov/data.csv?type=daily_treasury_yield_curve&page&_format=csv#page=2'
        self.assertEqual(canonical_url(url)[0], url)
        self.assertNotEqual(canonical_url('https://www.reuters.com/Case/')[0],
                            canonical_url('https://www.reuters.com/case/')[0])
        self.assertNotEqual(canonical_url('https://host.org/report.pdf#page=1')[0],
                            canonical_url('https://host.org/report.pdf#page=2')[0])
    def test_safe_title(self):
        self.assertEqual(clean_title('Headline\n  label'), 'Headline label')
        self.assertEqual(clean_title('https://chatgpt.com/c/private'), '')
        self.assertEqual(clean_title('/workspace/private/file'), '')
        self.assertLessEqual(len(clean_title('x' * 200)), 150)


class ProvenanceTests(unittest.TestCase):
    def test_singapore_report_dates(self):
        self.assertEqual(saved_date('2026-11-03T20:00:00Z'), '2026-11-04')
        self.assertEqual(saved_date('2026-10-29'), '2026-10-29')
        self.assertEqual(instant_key('2026-11-04T00:42:07+08:00'), instant_key('2026-11-03T16:42:07Z'))
    def test_no_prose_originals_or_publisher_homepages(self):
        obj = {'title': 'Saved headline', 'url': 'https://www.reuters.com/story/',
               'original_url': 'https://chatgpt.com/c/private',
               'publisher_url': 'https://www.reuters.com',
               'body': 'https://www.reuters.com/full-article-copy',
               'uploaded': 'https://private-host.org/upload.pdf'}
        self.assertEqual(list(source_links(obj)), [('https://www.reuters.com/story/', 'Saved headline', '')])
    def test_per_edition_count_not_mentions(self):
        inv = Inventory('2026-10-01', '2026-11-04')
        obj = {'title': 'Source title', 'url': 'https://www.reuters.com/story/',
               'sources': ['https://www.reuters.com/story/?utm_source=x']}
        for edition, date in [('one', '2026-10-29'), ('one', '2026-10-29'), ('two', '2026-11-04')]:
            inv.add(obj, edition, date, 'curated_report', 'Report', 'data/reports.json', 'report_date')
        result = inv.output('test')['sources']
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['reference_count'], 2)
        self.assertEqual(result[0]['first_referenced'], '2026-10-29')
        self.assertEqual(result[0]['last_referenced'], '2026-11-04')


class ArtifactTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.repo_path = os.environ.get('SOURCE_REPO', str(Path(__file__).resolve().parents[1]))
        cls.output = json.loads((Path(cls.repo_path) / 'site/data/recent-public-sources.json').read_text())
        cls.has_revision = subprocess.run(['git', '-C', cls.repo_path, 'cat-file', '-e', DEFAULT_REVISION+'^{commit}'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
    def test_snapshot_counts(self):
        self.assertEqual(self.output['statistics'], {'unique_sources': 1047, 'unique_domains': 59,
                         'saved_editions': 42, 'source_edition_references': 1908})
    def test_reproducible_committed_snapshot(self):
        if not self.has_revision:
            self.skipTest('Pinned source revision is unavailable in this shallow checkout; saved inventory validation still runs.')
        again, audit = extract(self.repo_path)
        self.assertEqual(again, self.output)
    def test_safe_output_and_exact_reference_metadata(self):
        ids, urls = set(), set()
        for item in self.output['sources']:
            self.assertEqual(canonical_url(item['url']), (item['url'], None))
            self.assertNotIn(item['id'], ids)
            self.assertNotIn(item['url'], urls)
            ids.add(item['id']); urls.add(item['url'])
            self.assertEqual(item['availability'], 'not_rechecked')
            self.assertEqual(item['provenance'], 'saved_public_reference')
            refs = item['references']
            self.assertEqual(item['reference_count'], len({r['id'] for r in refs}))
            self.assertEqual(item['first_referenced'], min(r['date'] for r in refs))
            self.assertEqual(item['last_referenced'], max(r['date'] for r in refs))
            for reference in refs:
                self.assertTrue((Path(self.repo_path) / 'site' / reference['path']).is_file(), reference['path'])
                self.assertGreaterEqual(reference['date'], '2026-10-01')
                self.assertLessEqual(reference['date'], '2026-11-04')
        serialized = json.dumps(self.output).lower()
        for forbidden in ['chatgpt.com', '/workspace/', '/home/', '/tmp/', 'sandbox:', 'sediment:',
                          'library_file_id', 'original_url', 'uploaded', 'access_token=', 'guce_referrer_sig=']:
            # The output notice mentions the exclusion of uploaded originals, not file metadata.
            if forbidden == 'uploaded':
                continue
            self.assertNotIn(forbidden, serialized)
    def test_coverage_gap_not_hidden(self):
        coverage = self.output['coverage']
        self.assertEqual(coverage['status'], 'partial')
        self.assertEqual(coverage['earliest_saved_reference'], '2026-10-29')
        self.assertEqual(len(coverage['daily_archive_missing_dates']), 28)
        self.assertEqual(coverage['daily_archive_dates'][0], '2026-10-29')
    def test_redirects_not_presented_as_direct(self):
        redirects = [s for s in self.output['sources'] if s['domain'] == 'news.google.com']
        self.assertEqual(len(redirects), 723)
        self.assertTrue(all(s['link_type'] == 'news_redirect' for s in redirects))

if __name__ == '__main__':
    unittest.main()
