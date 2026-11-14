import datetime as dt
import io
import json
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path
from share_prices import write_snapshot, publish_manifest, load, merge, read_ref, validate_feed, upload, update, yahoo, import_events


class PriceFeedTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.now = dt.datetime(2026, 11, 14, 1, tzinfo=dt.timezone.utc)
        history = {'schema_version': 1, 'id': 'a', 'basis': 'source_close_not_total_return', 'daily': [['2026-11-12', 100]], 'weekly': [], 'monthly': []}
        record = {'id': 'a', 'ticker': 'TEST', 'currency': 'USD', 'basis': history['basis'], 'history': write_snapshot(self.root, 'history/a', 'History', history, self.now)}
        register = write_snapshot(self.root, 'register', 'Instruments', {'instruments': [record]}, self.now)
        latest = write_snapshot(self.root, 'latest', 'Shares_Latest', {'quotes': {'a': {'date': '2026-11-12', 'close': 100, 'status': 'imported_close'}}}, self.now)
        publish_manifest(self.root, {'schema_version': 1, 'count': 1, 'generated_at': self.now.isoformat(), 'register': register, 'latest': latest, 'months': {}})

    def tearDown(self):
        self.temp.cleanup()

    def test_append_rerun_and_failed_fetch_preserve_date(self):
        result = merge(self.root, {'a': [['2026-11-12', 100], ['2026-11-13', 95]]}, {'a': 'provider_checked'}, self.now)
        self.assertEqual(result['inserted'], 1)
        result = merge(self.root, {'a': [['2026-11-13', 95]]}, {'a': 'provider_checked'}, self.now)
        self.assertEqual(result['inserted'], 0)
        merge(self.root, {}, {'a': 'fetch_failed'}, self.now)
        quote = read_ref(self.root, load(self.root/'manifest.json')['latest'])['quotes']['a']
        self.assertEqual(quote, {'date': '2026-11-13', 'close': 95, 'status': 'fetch_failed'})

    def test_changed_basis_quarantines_entire_series(self):
        result = merge(self.root, {'a': [['2026-11-12', 50], ['2026-11-13', 51]]}, {'a': 'provider_checked'}, self.now)
        self.assertEqual(result['inserted'], 0)
        self.assertEqual(result['statuses'], {'basis_review': 1})

    def test_future_and_duplicate_rejected_before_manifest_promotion(self):
        original = (self.root/'manifest.json').read_bytes()
        for points in [[['2026-11-15', 102]], [['2026-11-13', 102], ['2026-11-13', 103]]]:
            with self.assertRaises(ValueError):
                merge(self.root, {'a': points}, {'a': 'uploaded_close'}, self.now)
            self.assertEqual(original, (self.root/'manifest.json').read_bytes())

    def test_corruption_and_currency_mismatch(self):
        file = self.root/'prices.csv'
        file.write_text('ticker,date,close,currency,basis\nTEST,2026-11-13,105,SGD,source_close_not_total_return\n')
        with self.assertRaises(ValueError):
            upload(self.root, file, self.now)
        manifest = load(self.root/'manifest.json')
        (self.root/manifest['latest']['path']).write_text('{}')
        with self.assertRaises(ValueError):
            validate_feed(self.root)

    def test_same_day_revision_retains_old_snapshot(self):
        a = write_snapshot(self.root, 'test', 'Prices', {'price': 100}, self.now)
        b = write_snapshot(self.root, 'test', 'Prices', {'price': 101}, self.now)
        self.assertNotEqual(a['path'], b['path'])
        self.assertTrue(b['path'].endswith('_r02_14-Nov.json'))
        self.assertEqual(read_ref(self.root, a)['price'], 100)

    def test_public_distribution_fails_closed(self):
        with self.assertRaisesRegex(ValueError, 'Public price distribution'):
            validate_feed(self.root, public=True)

    def test_earnings_import_excludes_review_metadata_and_is_repeatable(self):
        event = {'ticker': 'TEST', 'date': '2026-11-12', 'label': 'Q3 results',
                 'source_url': 'https://issuer.example/results', 'source_title': 'Issuer results',
                 'timing': 'date_only', 'evidence': 'issuer_release', 'private_note': 'review only'}
        file = self.root / 'review.json'
        file.write_text(json.dumps({'schema_version': 1, 'events': [event], 'gaps': ['review only']}))
        self.assertEqual(import_events(self.root, file, self.now)['events'], 1)
        ref = load(self.root/'manifest.json')['events']
        self.assertNotIn('review only', (self.root/ref['path']).read_text())
        import_events(self.root, file, self.now)
        self.assertEqual(ref, load(self.root/'manifest.json')['events'])
        for key, bad in [('date', '2026-11-15'), ('ticker', 'WRONG'), ('source_url', 'javascript:alert(1)')]:
            file.write_text(json.dumps({'events': [{**event, key: bad}]}))
            with self.assertRaises(ValueError):
                import_events(self.root, file, self.now)
            self.assertEqual(ref, load(self.root/'manifest.json')['events'])

    def test_latest_must_match_history(self):
        manifest = load(self.root/'manifest.json')
        snapshot = read_ref(self.root, manifest['latest'])
        snapshot['quotes']['a']['close'] = 999
        manifest['latest'] = write_snapshot(self.root, 'latest', 'Shares_Latest', snapshot, self.now)
        with self.assertRaisesRegex(ValueError, 'reconcile'):
            publish_manifest(self.root, manifest)

    def test_partial_upload_preserves_other_refresh_status(self):
        merge(self.root, {}, {'a': 'fetch_failed'}, self.now)
        merge(self.root, {}, {}, self.now)
        quote = read_ref(self.root, load(self.root/'manifest.json')['latest'])['quotes']['a']
        self.assertEqual(quote['status'], 'fetch_failed')

    def test_verified_csv_upload_is_idempotent(self):
        file = self.root/'prices.csv'
        file.write_text('ticker,date,close,currency,basis\nTEST,2026-11-13,105,USD,source_close_not_total_return\n')
        self.assertEqual(upload(self.root, file, self.now)['inserted'], 1)
        self.assertEqual(upload(self.root, file, self.now)['inserted'], 0)
        self.assertEqual(read_ref(self.root, load(self.root/'manifest.json')['latest'])['quotes']['a']['close'], 105)

    def test_missing_provider_overlap_is_held(self):
        manifest = load(self.root/'manifest.json')
        registry = read_ref(self.root, manifest['register'])
        registry['instruments'][0]['automatic'] = True
        manifest['register'] = write_snapshot(self.root, 'register', 'Instruments', registry, self.now)
        publish_manifest(self.root, manifest)
        with patch('share_prices.yahoo', return_value=([['2026-11-13', 105]], {})):
            result = update(self.root, self.now)
        self.assertEqual(result['inserted'], 0)
        self.assertEqual(result['statuses'], {'basis_review': 1})

    def test_current_session_waits_for_close_and_buffer(self):
        item = {'ticker': 'TEST', 'currency': 'USD'}
        timestamps = [int((self.now-dt.timedelta(days=1)).timestamp()), int(self.now.timestamp())]
        payload = {'chart': {'result': [{'meta': {'symbol': 'TEST', 'currency': 'USD', 'exchangeTimezoneName': 'UTC',
                    'currentTradingPeriod': {'regular': {'end': int((self.now+dt.timedelta(hours=1)).timestamp())}}},
                    'timestamp': timestamps, 'indicators': {'quote': [{'close': [100, 105]}]}}]}}
        with patch('share_prices.urllib.request.urlopen', side_effect=lambda *a, **k: io.BytesIO(json.dumps(payload).encode())):
            points, _ = yahoo(item, '2026-11-12', self.now)
            self.assertEqual(points, [['2026-11-13', 100]])
            points, _ = yahoo(item, '2026-11-12', self.now+dt.timedelta(hours=3))
            self.assertEqual(points, [['2026-11-13', 100], ['2026-11-14', 105]])


if __name__ == '__main__':
    unittest.main()
