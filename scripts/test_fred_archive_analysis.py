"""Series isolation, vintage selection and immutable-object reuse regressions."""
import copy
import csv
import datetime as dt
import hashlib
import io
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch
import fred_archive_analysis as model
import build_fred_observatory as pack

def entry(sid,provider='US Treasury'):
    return dict(id=sid,name=sid,title=sid,provider=provider,group='Test',unit='USD billions',frequency='Quarterly',source_url='https://example.invalid/source',retrieved_at='2026-11-16')

class ComparableSeriesTests(unittest.TestCase):
    def test_source_markers_never_become_zero(self):
        for value in [None,'','null','ND','NA','N/A','.','*','(*)','NaN','Infinity']:
            self.assertIsNone(model.number(value),value)
        self.assertEqual(model.number('0'),0);self.assertEqual(model.number('-2.125'),-2.125)

    def test_countries_are_separate_even_on_the_same_date(self):
        rows=[{'observation_date':'2026-08-01','country_or_aggregate':country,'holdings_usd_billions':value}
              for country,value in [('Japan','10'),('China','20'),('Grand Total','30')]]
        before=copy.deepcopy(rows);index,summary=model.prepare(entry('TIC'),list(rows[0]),rows)
        self.assertEqual(len(index['groups']),3);self.assertEqual(summary['default_series']['points'],[['2026-08-01',30]])
        self.assertEqual({g['label']:g['points']['holdings_usd_billions'][0][1] for g in index['groups']},{'Japan':10,'China':20,'Grand Total':30})
        self.assertEqual(rows,before)

    def test_publication_history_chooses_latest_period_vintage_including_explicit_missing(self):
        rows=[dict(observation_date='2026-06-30',record_date='2026-07-31',securities_owner='Total Public Debt',usable_securities_bil_amt='10'),
              dict(observation_date='2026-06-30',record_date='2026-09-30',securities_owner='Total Public Debt',usable_securities_bil_amt='')]
        index,summary=model.prepare(entry('TREASURY_OFS2_PUBLICATIONS'),list(rows[0]),rows)
        self.assertEqual(summary['default_series']['points'],[['2026-06-30',None]])
        self.assertEqual(index['groups'][0]['record_indices'],[1]);self.assertEqual(len(rows),2)

    def test_ambiguous_nonmarketable_records_are_not_combined_or_assigned_sigma(self):
        base=dict(record_date='2026-09-30',security_class1_desc='Total Nonmarketable',security_class2_desc='null',security_class3_desc='null',maturity_date='null')
        rows=[dict(base,current_month_outstanding_amt='10'),dict(base,current_month_outstanding_amt='99')]
        grouped,summary=model.prepare(entry('TREASURY_MSPD_NONMARKET'),list(rows[0]),rows)
        self.assertTrue(grouped['groups'][0]['sigma_unavailable']);self.assertTrue(summary['sigma_unavailable'])
        self.assertEqual(summary['default_series']['points'],[]);self.assertEqual(len(rows),2)

    def test_missing_declared_analytical_field_fails_instead_of_inventing_a_metric(self):
        with self.assertRaises(ValueError):model.prepare(entry('TIC'),['observation_date'],[{'observation_date':'2026-01-01'}])

class ObjectReuseTests(unittest.TestCase):
    def test_unchanged_large_records_and_csvs_reuse_immutable_urls_but_zip_remains_complete(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);raw=root/'raw';(raw/'External sources').mkdir(parents=True);template=root/'templates';template.mkdir()
            def csvfile(path,fields,records):
                with path.open('w',encoding='utf-8',newline='') as f:
                    w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(records)
            records=[{'observation_date':(dt.date(2000,1,1)+dt.timedelta(days=i)).isoformat(),'TEST':str(i%19)} for i in range(20001)]
            csvfile(raw/'TEST.csv',['observation_date','TEST'],records)
            checksum=hashlib.sha256((raw/'TEST.csv').read_bytes()).hexdigest()
            meta=dict(series_id='TEST',filename='TEST.csv',title='Test series',units='Percent',frequency='Daily',seasonal_adjustment='Not Seasonally Adjusted',
                      first_observation=records[0]['observation_date'],last_observation=records[-1]['observation_date'],nonmissing_observations='20001',source_url='https://example.invalid/test',
                      retrieved_at='2026-11-16',sha256=checksum)
            csvfile(raw/'FRED_Download_Inventory.csv',list(meta),[meta])
            for name in ['Auto','Student_Loan','HELOC']:
                csvfile(raw/'External sources'/f'NYFed_{name}_Balance_90Plus_Days_Delinquent.csv',['observation_date','quarter','value'],[dict(observation_date='2026-07-01',quarter='2026Q3',value='0')])
            csvfile(raw/'External sources/Treasury_10Y_Nominal_Note_Auctions.csv',['competitiveAuctionCloseDate','cusip','bidToCoverRatio','highYield','interestRate'],[dict(competitiveAuctionCloseDate='2026-11-10',cusip='91282TEST',bidToCoverRatio='2.4',highYield='4.1',interestRate='4')])
            csvfile(raw/'External sources/Treasury_TIC_Major_Foreign_Holders.csv',['observation_date','country_or_aggregate','holdings_usd_billions'],[dict(observation_date='2026-08-01',country_or_aggregate='Grand Total',holdings_usd_billions='100')])
            csvfile(raw/'External sources/External_Download_Inventory.csv',['filename'],[]);(raw/'README.txt').write_text('Disposable source fixture',encoding='utf-8')
            monitor=dict(snapshot='2026-11-16',archiveVersion='2026-11-16T010000',fredIds=['TEST'],series={'TEST':dict(id='TEST',name='Test',title='Test',group='Test',unit='Percent',frequency='Daily',heatTransform='level',points=[[r['observation_date'],float(r['TEST'])] for r in records])})
            packed=root/'monitor.json';pack.write_json(packed,monitor)
            with patch.object(pack,'ROOT',root),patch.object(pack,'TEMPLATE',template):
                first=pack.build(raw,packed,views=False)
                monitor['archiveVersion']='2026-11-16T020000';pack.write_json(packed,monitor)
                second=pack.build(raw,packed,views=False)
            base=root/'site/data/fred';a=first['datasets'][0];b=second['datasets'][0]
            self.assertEqual(a['csv_url'],b['csv_url']);self.assertEqual(a['groups_url'],b['groups_url'])
            one=json.loads((base/a['json_url']).read_text(encoding='utf-8'));two=json.loads((base/b['json_url']).read_text(encoding='utf-8'))
            self.assertEqual(one['row_pages'],two['row_pages']);self.assertEqual(len(two['row_pages']),41)
            self.assertFalse((base/second['archive_version']/'records').exists())
            with zipfile.ZipFile(base/second['archive_url']) as z:
                self.assertEqual(z.read('csv/TEST.csv'),(raw/'TEST.csv').read_bytes())
                self.assertEqual(len([n for n in z.namelist() if n.startswith('csv/')]),6)

if __name__=='__main__':unittest.main()
