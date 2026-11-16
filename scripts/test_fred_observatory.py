"""Verify that the shared macro archive preserves source bytes and chart inputs."""
import csv
import hashlib
import io
import json
import unittest
import zipfile
from pathlib import Path
from refresh_fred_observatory import observation_keys

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'site/data/fred'


class FredArchiveTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = json.loads((BASE / 'catalog.json').read_text(encoding='utf-8'))
        cls.monitor = json.loads((BASE / cls.catalog['monitor_url']).read_text(encoding='utf-8'))

    def test_complete_catalogue_and_immutable_dated_urls(self):
        self.assertEqual(self.catalog['schema_version'], 1)
        self.assertEqual(len(self.catalog['datasets']), self.catalog['dataset_count'])
        self.assertGreaterEqual(self.catalog['dataset_count'],155)
        self.assertEqual(sum(row['provider'] == 'FRED' for row in self.catalog['datasets']), self.catalog['fred_count'])
        self.assertEqual(len({row['id'] for row in self.catalog['datasets']}),self.catalog['dataset_count'])
        for row in self.catalog['datasets']:
            for key in ['csv_url', 'json_url']:
                self.assertRegex(row[key],r'^\d{4}-\d{2}-\d{2}(?:T\d+)?/(?:csv|series)/')
                self.assertNotIn('..', row[key])
                self.assertTrue((BASE / row[key]).is_file())
            self.assertIn(self.catalog['snapshot'], row['citation'])
            self.assertTrue(row['source_url'].startswith('https://'))

    def test_hashes_raw_fields_and_monitor_points_reconcile(self):
        for row in self.catalog['datasets']:
            raw = (BASE / row['csv_url']).read_bytes()
            self.assertEqual(hashlib.sha256(raw).hexdigest(), row['sha256'], row['id'])
            reader = csv.DictReader(io.StringIO(raw.decode('utf-8-sig')))
            columns, records = reader.fieldnames, list(reader)
            payload = json.loads((BASE / row['json_url']).read_text(encoding='utf-8'))
            self.assertEqual(columns, payload['columns'])
            served=[]
            if payload.get('row_pages'):
                for page in payload['row_pages']:
                    content=json.loads((BASE/page).read_text(encoding='utf-8'))
                    served.extend(content.get('rows') or [dict(zip(content['columns'],values)) for values in content['values']])
                self.assertEqual(payload['rows'],served[:payload['page_size']])
            else:served=payload['rows']
            self.assertEqual(records,served)
            self.assertEqual(len(records), row['rows'])
            if row['provider'] == 'FRED':
                points = [[r['observation_date'], float(r[row['id']]) if r[row['id']] not in ('', '.') else None] for r in records]
                self.assertEqual(points, self.monitor['series'][row['id']]['points'], row['id'])
                self.assertEqual(points, payload['series']['points'])
                self.assertEqual(sum(p[1] is not None for p in points), row['observations'])
            elif row['id'].startswith('NY_'):
                points = [[r['observation_date'], float(r['value'])] for r in records]
                self.assertEqual(points, self.monitor['series'][row['id']]['points'])
            elif row['id'] == 'AUCTION':
                points = [[r['competitiveAuctionCloseDate'][:10], float(r['bidToCoverRatio'])] for r in records]
                self.assertEqual(points, self.monitor['series']['AUCTION']['points'])

    def test_zip_contains_all_original_csv_bytes(self):
        with zipfile.ZipFile(BASE / self.catalog['archive_url']) as archive:
            self.assertEqual(len([name for name in archive.namelist() if name.startswith('csv/')]),self.catalog['dataset_count'])
            for row in self.catalog['datasets']:
                self.assertEqual(archive.read('csv/' + row['filename']), (BASE / row['csv_url']).read_bytes())
            for name in ['FRED_Download_Inventory.csv', 'External_Download_Inventory.csv', 'README.txt', 'catalog.json']:
                self.assertIn(name, archive.namelist())

    def test_both_views_use_same_archive_and_offer_return_paths(self):
        for filename in ['market-desk.html', 'risk-observatory.html']:
            text = (ROOT / 'site/fred' / filename).read_text(encoding='utf-8')
            self.assertIn("FredArchive.catalog()", text)
            self.assertIn("FredArchive.resolve(catalog.monitor_url)", text)
            self.assertIn('href="../desk.html"', text)
            self.assertIn('href="data.html"', text)
            self.assertNotIn('C:\\Users', text)
            self.assertNotIn('The Market Intelligence Hub has not been modified', text)
            self.assertIn('window.MONITOR=', text)

    def test_refresh_preserves_prior_rows_and_accounts_for_every_correction(self):
        if not self.catalog.get('refresh_report_url'):
            self.skipTest('Initial, pre-refresh archive')
        report=json.loads((BASE/self.catalog['refresh_report_url']).read_text(encoding='utf-8'))
        previous_path=BASE/report['previous_archive']/'catalog.json'
        self.assertEqual(hashlib.sha256(previous_path.read_bytes()).hexdigest(),report['previous_catalog_sha256'])
        previous=json.loads(previous_path.read_text(encoding='utf-8'))
        revisions=json.loads((BASE/self.catalog['revisions_url']).read_text(encoding='utf-8'))
        self.assertEqual(len(revisions),report['revised'])
        stats={row['id']:row for row in report['datasets']}
        current={row['id']:row for row in self.catalog['datasets']}
        for old in previous['datasets']:
            raw=(BASE/old['csv_url']).read_bytes()
            self.assertEqual(hashlib.sha256(raw).hexdigest(),old['sha256'])
            new=current[old['id']]
            keys=observation_keys(old)
            identify=lambda row:tuple(row[name][:10] if name=='competitiveAuctionCloseDate' else row[name] for name in keys)
            before={identify(row):row for row in csv.DictReader(io.StringIO(raw.decode('utf-8-sig')))}
            after={identify(row):row for row in csv.DictReader(io.StringIO((BASE/new['csv_url']).read_text(encoding='utf-8-sig')))}
            self.assertTrue(before.keys()<=after.keys(),old['id'])
            changed={tuple(row['key']):row for row in revisions if row['id']==old['id']}
            self.assertEqual(len(after)-len(before),stats[old['id']].get('added',0))
            for identity,row in before.items():
                if identity in changed:
                    self.assertEqual(changed[identity]['previous'],row)
                    self.assertEqual(changed[identity]['replacement'],after[identity])
                else:self.assertEqual(row,after[identity])


if __name__ == '__main__':
    unittest.main()
