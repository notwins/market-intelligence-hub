import json
import tempfile
import unittest
from pathlib import Path
from verify_sgs_daily import verify


class LiveSGSVerificationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        site = self.root / 'site'
        (site / 'data').mkdir(parents=True)
        self.files = {
            'data/sgs-daily-snapshot.json': json.dumps({'source_url': 'https://eservices.mas.gov.sg/statistics/fdanet/SgsBenchmarkIssuePrices.aspx', 'tenors': list(range(9)), 'observations': [{'date': '2026-11-17', 'values': [2.3] * 9}]}).encode(),
            'data/sgs-daily-status.json': json.dumps({'status': 'ok', 'latest_observation_date': '2026-11-17', 'refresh_runner': 'github_actions', 'last_attempt': '2026-11-18T00:00:00Z', 'last_success': '2026-11-18T00:00:00Z'}).encode(),
            'data/desk-data.json': json.dumps({'yields': [{'id': 'sgs-10y', 'value': 2.3, 'as_of': '2026-11-17'}]}).encode(),
            'sgs-daily.js': b'validated SGS reader', 'sgs-daily.css': b'SGS styles',
            'market-snapshot.js': b'shared snapshot reader', 'desk-dashboard.js': b'dashboard reader',
            'desk.html': b'sgs-daily.js sgs-daily.css data-sgs-daily="dashboard" data-sgs-daily="prices"',
            'v4.html': b'sgs-daily.js sgs-daily.css SGSDaily.mount(S.view)'}
        for name, body in self.files.items():
            (site / name).write_bytes(body)

    def test_success_checks_source_date_and_all_readers(self):
        result = verify(self.root, self.files.__getitem__)
        self.assertEqual(result['result'], 'passed')
        self.assertEqual(result['latest_observation_date'], '2026-11-17')
        self.assertEqual(result['tenors'], 9)

    def test_stale_snapshot_is_rejected(self):
        self.files['data/sgs-daily-snapshot.json'] = b'{"stale":true}'
        with self.assertRaisesRegex(ValueError, 'bytes'):
            verify(self.root, self.files.__getitem__)

    def test_wrong_adapter_row_and_missing_historical_mount_are_rejected(self):
        self.files['data/desk-data.json'] = b'{"yields":[]}'
        with self.assertRaisesRegex(ValueError, 'desk SGS'):
            verify(self.root, self.files.__getitem__)
        self.files['data/desk-data.json'] = (self.root / 'site/data/desk-data.json').read_bytes()
        self.files['v4.html'] = b'sgs-daily.js sgs-daily.css'
        with self.assertRaisesRegex(ValueError, 'integration'):
            verify(self.root, self.files.__getitem__)

    def test_last_good_source_error_can_be_verified_before_job_failure_flag(self):
        status = json.loads(self.files['data/sgs-daily-status.json'])
        status['status'] = 'error'
        self.files['data/sgs-daily-status.json'] = json.dumps(status).encode()
        (self.root / 'site/data/sgs-daily-status.json').write_bytes(self.files['data/sgs-daily-status.json'])
        self.assertEqual(verify(self.root, self.files.__getitem__)['source_status'], 'error')


if __name__ == '__main__':
    unittest.main()
