"""Contracts for the proposed desk adapter: no invented timing or private links."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from build_desk_data import ROOT, public_href, canonical_href, reports_from_register, matched_news, public_calls, yield_rows, sgs_yield_rows, chronology


class DeskDataTests(unittest.TestCase):
    def test_rejects_active_private_and_traversal_urls(self):
        for href in ['javascript:alert(1)', 'data:text/html,bad', '//example.org/a',
                     '../secret.html', '%2e%2e/secret.html', '/private.html',
                     'https://user:password@example.org/a', 'https://chatgpt.com/c/private',
                     'https://chat.openai.com/c/private', 'http://example.org/a', 'x\\secret.html']:
            self.assertIsNone(public_href(href), href)
        self.assertEqual(public_href('https://www.reuters.com/article/x'), 'https://www.reuters.com/article/x')

    def test_canonical_index_and_directory_are_one_destination(self):
        self.assertEqual(canonical_href('research/a/'), canonical_href('research/a/index.html#main'))
        self.assertNotEqual(canonical_href('research/a/'), canonical_href('research/a-v2/'))

    def test_unknown_upload_is_not_replaced_with_article_date(self):
        with tempfile.TemporaryDirectory() as tmp:
            site = Path(tmp); (site / 'research/a').mkdir(parents=True)
            (site / 'research/a/index.html').write_text('<title>A</title>')
            entries = [{'id': 'a', 'state': 'published', 'title': 'A', 'href': 'research/a/',
                        'date': '2004-02-03', 'published_date': '2026-11-14'}]
            row = reports_from_register(site, entries, {})[0]
            self.assertIsNone(row['uploaded_at']); self.assertIsNone(row['added_at'])
            self.assertEqual(row['research_date'], '2004-02-03')
            self.assertEqual(row['recorded_publication_date'], '2026-11-14')
            self.assertIn('not a verified Pages upload', row['upload_basis'])

    def test_aliases_dedupe_pending_entries_excluded_and_versions_retained(self):
        with tempfile.TemporaryDirectory() as tmp:
            site = Path(tmp)
            for directory in ['a', 'a-v2']:
                (site / 'research' / directory).mkdir(parents=True)
                (site / 'research' / directory / 'index.html').write_text('<title>A</title>')
            entries = [dict(id='a', state='published', title='A', href='research/a/'),
                       dict(id='alias', state='published', title='A duplicate', href='research/a/index.html'),
                       dict(id='v2', state='published', title='A V2', href='research/a-v2/'),
                       dict(id='private', state='pending', title='Private request', href='missing.html')]
            rows = reports_from_register(site, entries, {'research/a/index.html': {'at': '2026-01-02T12:00:00Z'}})
            self.assertEqual(len(rows), 2)
            self.assertEqual(rows[0]['id'], 'a')
            self.assertEqual(rows[1]['id'], 'v2')

    def test_news_matches_explicit_symbols_only_and_dedupes(self):
        data = {'items': [
            {'id':'1','title':'Apple pies','tickers':[],'url':'https://example.org/food','published_at':'2026-11-01'},
            {'id':'2','title':'Apple results','tickers':['AAPL'],'url':'https://example.org/results','published_at':'2026-11-01'},
            {'id':'3','title':'Duplicate','tickers':['AAPL'],'url':'https://example.org/results#top','published_at':'2026-11-01'},
            {'id':'4','title':'A different listing','tickers':['GOOG'],'url':'https://example.org/class-c','published_at':'2026-11-01'}]}
        news = matched_news(data, ['AAPL', 'GOOGL'])
        self.assertEqual([n['id'] for n in news], ['2'])
        self.assertEqual(news[0]['tickers'], ['AAPL'])

    def test_calls_require_explicit_approval_public_visibility_and_real_document(self):
        with tempfile.TemporaryDirectory() as tmp:
            site = Path(tmp); (site/'research/calls/example').mkdir(parents=True)
            (site/'research/calls/example/index.html').write_text('<title>Public</title>')
            approved = {'id':'a','ticker':'SPY','public_approval':True,'review_date':'2026-11-05',
                        'report':{'visibility':'public','html_path':'research/calls/example/index.html','title':'Historical review'}}
            private = copy.deepcopy(approved); private['id']='private'; private['public_approval']=False
            invisible = copy.deepcopy(approved); invisible['id']='invisible'; invisible['report']['visibility']='private'
            missing = copy.deepcopy(approved); missing['id']='missing'; missing['report']['html_path']='research/calls/missing/index.html'
            rows = public_calls(site, {'calls':[approved,private,invisible,missing]})
            self.assertEqual([r['id'] for r in rows], ['a'])
            self.assertIsNone(rows[0]['instructions_href'])

    def test_yield_error_preserves_last_observation_and_its_actual_date(self):
        rows = yield_rows({'status':'error','as_of':'2026-11-10','labels':['2Y','10Y'],
                           'values':[0,4.98], 'message':'Refresh failed',
                           'last_attempt':'2026-11-14T10:00:00Z',
                           'history':[{'date':'2026-11-09','values':[4.56,4.88]}]})
        self.assertEqual(rows[0]['value'], 0)
        self.assertEqual(rows[1]['value'], 4.98)
        self.assertEqual(rows[1]['as_of'], '2026-11-10')
        self.assertEqual(rows[1]['status'], 'error')
        self.assertEqual(rows[1]['history'], [{'date':'2026-11-09','value':4.88}])
        self.assertEqual(rows[0]['source_url'], 'https://fred.stlouisfed.org/series/DGS2')
        self.assertEqual(rows[1]['source_url'], 'https://fred.stlouisfed.org/series/DGS10')

    def test_independent_featured_choices_require_explicit_editorial_review(self):
        from build_desk_data import featured_selection
        external = 'new-independent-report-2026-11-15'
        config = {'schema_version':1, 'featured_ids':['local', external], 'independent_featured_ids':[external]}
        self.assertEqual(featured_selection(config, {'local'}), ['local', external])
        with self.assertRaises(ValueError): featured_selection({**config, 'independent_featured_ids':[]}, {'local'})
        with self.assertRaises(ValueError): featured_selection({**config, 'featured_ids':['local', 'local']}, {'local'})
        with self.assertRaises(ValueError): featured_selection({**config, 'independent_featured_ids':['../private']}, {'local'})

    def test_generated_contract_has_only_existing_destinations_and_precise_fallbacks(self):
        payload = json.loads((ROOT/'site/data/desk-data.json').read_text(encoding='utf-8'))
        self.assertEqual(payload['schema_version'], 1)
        self.assertEqual(len(payload['watchlist']), 12)
        self.assertEqual(len(payload['reports']), len({canonical_href(r['href']) for r in payload['reports']}))
        self.assertEqual(payload['reports'], sorted(payload['reports'], key=chronology, reverse=True))
        self.assertTrue(all(r['uploaded_at'] is None for r in payload['reports']))
        config = json.loads((ROOT/'site/data/desk-config.json').read_text(encoding='utf-8'))
        self.assertTrue(set(payload['featured_ids']) <= {r['id'] for r in payload['reports']} | set(config.get('independent_featured_ids', [])))
        for report in payload['reports']:
            self.assertIsNotNone(public_href(report['href'], ROOT/'site'))
            for brief in report['briefs']:
                self.assertIsNotNone(public_href(brief['href'], ROOT/'site'))
        originals = json.loads((ROOT/'site/data/watchlist/latest.json').read_text())['rows']
        for row, original in zip(payload['watchlist'], originals):
            self.assertEqual(row['price']['value'], original['price']['close'])
            self.assertEqual(row['price']['as_of'], original['price']['as_of'])
            self.assertTrue(all(row['ticker'] in s['shares'] for s in row['si']))
        self.assertNotIn('chatgpt.com', json.dumps(payload))
        earnings = [r for r in payload['daily_reports'] if r['full_edition']['channel'] == 'earnings']
        self.assertGreaterEqual(max(r['full_edition']['cutoff'] for r in earnings), '2026-11-14T08:01:00+08:00')
        latest = next(r for r in earnings if r['id'] == 'us-earnings-full-2026-11-14')
        self.assertIsNone(latest['uploaded_at'])
        self.assertNotEqual(latest['added_at'], latest['verified_at'])

    def test_sgs_uses_daily_tenor_values_and_observation_date(self):
        source = json.loads((ROOT/'site/data/sgs-daily-snapshot.json').read_text())
        rows = sgs_yield_rows(source)
        self.assertEqual([r['id'] for r in rows], ['sgs-2y', 'sgs-10y'])
        for row, label in zip(rows, ['2Y', '10Y']):
            column = next(i for i,t in enumerate(source['tenors']) if t['label'] == label)
            self.assertEqual(row['value'], source['observations'][-1]['values'][column])
            self.assertEqual(row['as_of'], source['observations'][-1]['date'])
            self.assertEqual(row['source_url'], source['source_url'])
            self.assertEqual(row['attribution'], source['attribution'])
            self.assertEqual(len(row['history']), len(source['observations']))
            self.assertIsNone(row['observed_time'])

    def test_sgs_rejects_monthly_substitutes_and_never_fills_missing_quotes(self):
        snapshot = {'schema_version':1,'frequency':'monthly','tenors':[{'label':'2Y'},{'label':'10Y'}],
                    'observations':[{'date':'2026-11-04','values':[1.83,2.18]}]}
        with self.assertRaises(ValueError): sgs_yield_rows(snapshot)
        snapshot['frequency']='daily'; snapshot['observations'][0]['values']=[None,None]
        self.assertEqual(sgs_yield_rows(snapshot), [])
        snapshot['observations']=[{'date':'2026-11-04','values':[1.83,2.18]}, {'date':'2026-11-03','values':[1.85,2.21]}]
        with self.assertRaises(ValueError): sgs_yield_rows(snapshot)


if __name__ == '__main__':
    unittest.main()
