"""Meaningful overlap/revision regressions; official source requests are mocked."""
import datetime as dt
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import refresh_fred_observatory as refresh


class MergeTests(unittest.TestCase):
    def test_three_calendar_months_and_lagged_quarter(self):
        self.assertEqual(refresh.months_before(dt.date(2026, 11, 16)), dt.date(2026, 8, 16))
        self.assertEqual(refresh.months_before(dt.date(2027, 5, 31)), dt.date(2027, 2, 28))
        self.assertEqual(refresh.query_start({'last':'2026-04-01','frequency':'Quarterly'},dt.date(2026,11,16)),'2026-04-01')
        self.assertEqual(refresh.query_start({'last':'2026-10-01','frequency':'Monthly'},dt.date(2026,11,16)),'2026-08-01')

    def test_fresh_revision_zero_and_withdrawal_win_without_truncation(self):
        old=[{'date':'2006-01-01','v':'1.25'},{'date':'2026-08-01','v':'2.10'},{'date':'2026-09-01','v':'3'}]
        fresh=[{'date':'2026-08-01','v':'0'},{'date':'2026-09-01','v':''},{'date':'2026-10-01','v':'4.123456789'}]
        merged,counts,changes=refresh.merge_rows(old,fresh,['date'])
        self.assertEqual(len(merged),4);self.assertEqual(merged[0],old[0])
        self.assertEqual([row['v'] for row in merged],['1.25','0','','4.123456789'])
        self.assertEqual(counts,{'added':1,'revised':2,'unchanged':0})
        self.assertEqual(changes[0]['previous']['v'],'2.10')
        self.assertEqual(refresh.merge_rows(merged,fresh,['date'])[1],{'added':0,'revised':0,'unchanged':3})

    def test_composite_keys_and_duplicate_rejection(self):
        old=[{'date':'2026-08-01','country':'Singapore','v':'5'},{'date':'2026-08-01','country':'Japan','v':'8'}]
        fresh=[{'date':'2026-08-01','country':'Singapore','v':'6'}]
        merged,counts,_=refresh.merge_rows(old,fresh,['date','country'])
        self.assertEqual(len(merged),2);self.assertEqual(counts['revised'],1)
        with self.assertRaisesRegex(ValueError,'Duplicate'):refresh.merge_rows(old,fresh+fresh,['date','country'])
        with self.assertRaisesRegex(ValueError,'Duplicate'):refresh.merge_rows(old+old,fresh,['date','country'])
        with self.assertRaises(ValueError):refresh.numeric('NaN')
        with self.assertRaises(ValueError):refresh.numeric('Infinity')

    def test_fred_rejects_wrong_schema_and_out_of_window_history(self):
        entry={'id':'TEST','last':'2026-11-10','frequency':'Daily','source_url':'https://fred.stlouisfed.org/series/TEST'}
        for raw in [b'observation_date,WRONG\n2026-11-10,1\n',b'observation_date,TEST\n2006-01-01,1\n',b'observation_date,TEST\n2026-11-10,NaN\n']:
            with patch.object(refresh,'fetch',return_value=raw):
                with self.assertRaises(ValueError):refresh.fred(entry,dt.date(2026,11,16))

    def test_auction_timestamp_correction_is_one_identity(self):
        old=[{'competitiveAuctionCloseDate':'2026-11-10T00:00:00','cusip':'91282AAA1','ratio':'2.40'}]
        new=[{'competitiveAuctionCloseDate':'2026-11-10T13:00:00','cusip':'91282AAA1','ratio':'2.41'}]
        rows,counts,_=refresh.merge_rows(old,new,['competitiveAuctionCloseDate','cusip'])
        self.assertEqual(len(rows),1);self.assertEqual(counts['added'],0);self.assertEqual(counts['revised'],1)


class FullHistoryTests(unittest.TestCase):
    def test_all_datasets_merge_and_failed_source_retains_verified_bytes(self):
        base=refresh.ROOT/'site/data/fred';before=(base/'catalog.json').read_bytes();catalog=json.loads(before)
        entries={row['id']:row for row in catalog['datasets']}
        original={sid:(base/row['csv_url']).read_bytes() for sid,row in entries.items()}
        def source(entry,today,fields):
            sid=entry['id']
            if sid=='BAMLC0A0CM':raise ValueError('Simulated provider outage')
            old=refresh.parse_csv(original[sid])[1]
            keys=refresh.observation_keys(entry)
            rows=[dict(old[-1])]
            if sid=='DGS10':
                rows[0][sid]='0';rows.append({'observation_date':'2099-01-01','DGS10':'4.123456789'})
            return dict(fields=fields,rows=rows,keys=keys,source_url=entry['source_url'],query_start='2026-08-16',response_sha256='a'*64)
        with tempfile.TemporaryDirectory() as folder:
            work,report=refresh.run(Path(folder)/'candidate',now=dt.datetime(2099,1,2,tzinfo=refresh.SGT),fetcher=source)
            self.assertEqual(report['checked_count'],len(entries)-1);self.assertEqual(report['failed_count'],1)
            self.assertEqual(report['added'],1);self.assertEqual(report['revised'],1)
            failed=entries['BAMLC0A0CM'];self.assertEqual((work/'raw'/failed['filename']).read_bytes(),original['BAMLC0A0CM'])
            new=refresh.parse_csv((work/'raw/DGS10.csv').read_bytes())[1]
            old=refresh.parse_csv(original['DGS10'])[1]
            self.assertEqual(new[:-2],old[:-1]);self.assertEqual(len(new),len(old)+1)
            monitor=json.loads((work/'monitor.json').read_text(encoding='utf-8'))
            self.assertEqual(monitor['series']['DGS10']['points'][-1],['2099-01-01',4.123456789])
            self.assertEqual(monitor['sourceMetadata']['BAMLC0A0CM']['refresh_status'],'failed')
        self.assertEqual((base/'catalog.json').read_bytes(),before)
        self.assertEqual((base/entries['DGS10']['csv_url']).read_bytes(),original['DGS10'])


if __name__=='__main__':unittest.main()
