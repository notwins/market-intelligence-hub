import csv,io,json,unittest,hashlib
from datetime import date
from pathlib import Path
from import_ust_curves import COLUMNS,parse_csv

def sample(rows,cols=COLUMNS):
    buf=io.StringIO();w=csv.writer(buf);w.writerows([['Date']+cols]+rows);return buf.getvalue().encode()
class ImportTests(unittest.TestCase):
    def test_nulls_are_not_filled(self):
        raw=sample([['03/13/2020']+['1']*11,['03/16/2020','ND','NA','.','']+['2']*7,['03/17/2020']+['']*11])
        rows,empty=parse_csv(raw,2020,date(2026,11,4));self.assertEqual(rows[1]['values'],[None]*4+[2]*7);self.assertEqual(empty,1)
    def test_absent_maturity_stays_null(self):
        rows,_=parse_csv(sample([['06/15/2005']+['1']*10],COLUMNS[:-1]),2005,date(2026,11,4));self.assertIsNone(rows[0]['values'][-1])
    def test_duplicate_rejected(self):
        with self.assertRaises(ValueError):parse_csv(sample([['03/16/2020']+['1']*11]*2),2020,date(2026,11,4))
    def test_future_rejected(self):
        with self.assertRaises(ValueError):parse_csv(sample([['03/16/2027']+['1']*11]),2027,date(2026,11,4))
    def test_nan_rejected(self):
        with self.assertRaises(ValueError):parse_csv(sample([['03/16/2020']+['NaN']*11]),2020,date(2026,11,4))
    def test_wrong_year_rejected(self):
        with self.assertRaises(ValueError):parse_csv(sample([['03/16/2020']+['1']*11]),2021,date(2026,11,4))
    def test_published_history(self):
        root=Path(__file__).resolve().parents[1]/'site/data'
        p=json.loads((root/'ust-curves-daily.json').read_text());all_rows=[]
        self.assertEqual(len(p['history_files']),37)
        for entry in p['history_files']:
            raw=(root/entry['path']).read_bytes();shard=json.loads(raw)
            self.assertEqual(hashlib.sha256(raw).hexdigest(),entry['sha256'])
            self.assertEqual(shard['schema_version'],1);self.assertEqual(shard['year'],entry['year'])
            self.assertEqual(len(shard['observations']),entry['count'])
            self.assertTrue(all(int(r['date'][:4])==entry['year'] for r in shard['observations']))
            self.assertLess(len(raw),25000)
            all_rows+=shard['observations']
        rows={r['date']:r['values'] for r in all_rows}
        self.assertEqual(len(rows),len(all_rows));self.assertEqual(len(rows),p['observation_count'])
        self.assertEqual(sorted(rows),[r['date'] for r in all_rows])
        self.assertEqual(p['observation_range'],{'start':all_rows[0]['date'],'end':all_rows[-1]['date']})
        self.assertEqual(len(p['observations']),8)
        self.assertEqual({r['date'] for r in p['observations']},{e['date'] for e in p['events']}|{all_rows[-1]['date']})
        for row in p['observations']:self.assertEqual(row['values'],rows[row['date']])
        self.assertGreater(len(rows),9000);self.assertEqual(len(p['raw_sources']),37)
        self.assertNotIn('2020-03-15',rows);self.assertEqual(rows['2020-03-16'],[.25,.24,.29,.29,.36,.43,.49,.67,.73,1.10,1.34])
        self.assertIsNone(rows['2005-06-15'][-1]);self.assertIsNone(rows['2008-12-10'][1]);self.assertIsNone(rows['2008-12-18'][1]);self.assertIsNone(rows['2008-12-24'][1])
        self.assertEqual(p['events'][2]['event_date'],'2020-03-15');self.assertEqual(p['events'][2]['date'],'2020-03-16')
        self.assertEqual(p['observations'][-1]['date'],'2026-11-03')
if __name__=='__main__':unittest.main()
