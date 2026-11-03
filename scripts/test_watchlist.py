import copy,json,tempfile,unittest
from pathlib import Path
from import_watchlist import validate,import_edition,public_url
from import_watchlist_call import validate_call
ROOT=Path(__file__).resolve().parents[1]
class WatchlistTests(unittest.TestCase):
 def setUp(self):self.d=json.loads((ROOT/'site/data/watchlist/archive/watchlist-20261103T120000Z.json').read_text())
 def test_current(self):validate(self.d)
 def reject(self,fn):
  d=copy.deepcopy(self.d);fn(d)
  with self.assertRaises((ValueError,KeyError)):validate(d)
 def test_not_verified(self):self.reject(lambda d:d['verification'].update(prices_verified=False))
 def test_wrong_returns(self):self.reject(lambda d:d['rows'][0]['returns'][0].update(pct=999))
 def test_missing_ticker(self):self.reject(lambda d:d['rows'].pop())
 def test_extra_private_fields(self):self.reject(lambda d:d.update(private_notes='not publishable'))
 def test_invalid_source(self):self.reject(lambda d:d['rows'][0]['price'].update(source_url='javascript:alert(1)'))
 def test_invalid_future(self):self.reject(lambda d:d.update(as_of='2099-01-01T00:00:00Z'))
 def test_unverified_narrative(self):self.reject(lambda d:d['verification'].update(research_verified=False))
 def test_duplicate_and_archive(self):
  with tempfile.TemporaryDirectory() as t:
   p=import_edition(self.d,t);before=p.read_bytes();import_edition(self.d,t);self.assertEqual(before,p.read_bytes())
   changed=copy.deepcopy(self.d);changed['summary']='Changed original'
   with self.assertRaises(ValueError):import_edition(changed,t)
   self.assertEqual(before,p.read_bytes())
 def test_private_chat_source(self):
  with self.assertRaises(ValueError):public_url('https://chatgpt.com/c/private-report')
 def test_nonpublic_ips(self):
  for u in ['https://10.0.0.1/private','https://[::1]/','https://sub.chatgpt.com/c/123']:
   with self.assertRaises(ValueError):public_url(u)
 def test_horizon_mismatch(self):self.reject(lambda d:d['rows'][0]['returns'][5].update(base_date=d['rows'][0]['returns'][0]['base_date']))
 def test_revision_order(self):
  with tempfile.TemporaryDirectory() as t:
   for rev in [9,10]:
    d=copy.deepcopy(self.d);d['id']+='-r'+str(rev);import_edition(d,t)
   latest=json.loads((Path(t)/'data/watchlist/latest.json').read_text());self.assertTrue(latest['id'].endswith('-r10'))
 def test_public_calls_validate(self):
  calls=json.loads((ROOT/'site/data/watchlist/calls.json').read_text())
  for call in calls['calls']:validate_call(call)
 def test_call_cannot_use_later_evidence(self):
  d={'schema_version':1,'id':'call-test','ticker':'AAPL','called_at':'2026-11-02T10:00:00Z','recorded_at':'2026-11-03T10:00:00Z','call_type':'Watch','summary':'Test only','public_approval':True,'report':{'title':'Test report','as_of':'2026-11-03T09:00:00Z','created_at':'2026-11-03T10:00:00Z','visibility':'public','quote_date':None,'financial_period_end':None,'period_basis':'Not applicable','provenance':'Public example','sections':[{'heading':'Example','body':'Test content'}]*3,'sources':[{'title':'Issuer','url':'https://www.apple.com/'}]}}
  with self.assertRaises(ValueError):validate_call(d)
  d['report']['as_of']='2026-11-02T09:00:00Z';validate_call(d)
 def test_call_requires_approval(self):
  with self.assertRaises(ValueError):validate_call({'schema_version':1,'public_approval':False})
if __name__=='__main__':unittest.main()
