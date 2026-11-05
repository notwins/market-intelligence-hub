import copy,hashlib,json,re,tempfile,unittest
from pathlib import Path
from decimal import Decimal as D
from import_watchlist_call import validate_call,import_call
ROOT=Path(__file__).resolve().parents[1]
class CallsReviewTests(unittest.TestCase):
 def setUp(self):self.calls=[c for c in json.loads((ROOT/'site/data/watchlist/calls.json').read_text())['calls'] if c.get('schema_version')==2]
 def test_records_and_receipts(self):
  self.assertEqual(len(self.calls),3)
  for c in self.calls:
   validate_call(c)
   self.assertEqual(c,json.loads((ROOT/'site/data/watchlist/calls'/(c['id']+'.json')).read_text()))
   html=(ROOT/'site'/c['report']['html_path']).read_bytes()
   self.assertEqual(hashlib.sha256(html).hexdigest(),c['report']['sha256'])
   self.assertLess(len(html),35000)
 def test_no_private_content_or_image_assets(self):
  for c in self.calls:
   html=(ROOT/'site'/c['report']['html_path']).read_text()
   text=html+json.dumps(c)
   for forbidden in ['<img','data:image','<iframe','<script','chatgpt.com','libfile_','MUM /','Mum:','Your account:','US$70,000 account']:
    self.assertNotIn(forbidden,text)
   self.assertIn('Historical research, not a current recommendation',html)
   self.assertIn('Skip to report',html)
   self.assertIn('scope="col"',html)
   self.assertIn('Back to Calls',html)
 def test_review_has_no_fake_call_timestamp(self):
  for c in self.calls:self.assertNotIn('called_at',c)
 def test_reject_unsafe_dates_paths_approval(self):
  for change in [lambda c:c.update(public_approval=False),lambda c:c.update(review_date='2026-10-01'),lambda c:c['report'].update(html_path='../../secret'),lambda c:c.update(call_type='Buy thesis'),lambda c:c.update(private_account='secret')]:
   d=copy.deepcopy(self.calls[0]);change(d)
   with self.assertRaises((ValueError,KeyError)):validate_call(d)
 def test_qqq_conditional_math(self):
  cost=D(8)*100*D('46.50');gain=D(8)*100*(D('64.27')-D('46.50'))
  self.assertEqual(cost,D('37200'));self.assertEqual(gain,D('14216'))
  loss=D('100')*(D('690.53')/D('721.25')-1);normalized_gain=D('2.0309')
  self.assertEqual((-normalized_gain/loss*100).quantize(D('.01')),D('47.68'))
  self.assertEqual((loss+normalized_gain).quantize(D('.0001')),D('-2.2284'))
 def test_comparison_payoffs(self):
  for spot,a,b in [(700,1219,1880),(650,-3781,1880),(600,-8781,1880),(550,-13781,-48120),(500,-18781,-98120)]:
   self.assertEqual(1219-100*max(700-spot,0),a);self.assertEqual(1880-1000*max(600-spot,0),b)
 def test_closed_ledger(self):
  rows=[(2,'1.73','1.04',138),(2,'2.15','1.53',124),(1,'1.55','.94',61),(1,'.64','.35',29),(1,'.72','.39',33),(1,'.69','.37',32),(1,'2.40','2.11',29)]
  credit=debit=D(0)
  for q,s,b,p in rows:
   self.assertEqual(q*100*(D(s)-D(b)),D(p));credit+=q*100*D(s);debit+=q*100*D(b)
  self.assertEqual((credit,debit,credit-debit),(D(1376),D(930),D(446)))
  self.assertEqual(2*63500+3*60000+59500+2*59000,484500);self.assertEqual(8*100*50,40000)
 def test_idempotent_and_immutable(self):
  with tempfile.TemporaryDirectory() as t:
   c=self.calls[0];p=import_call(c,t);before=p.read_bytes();import_call(c,t);self.assertEqual(before,p.read_bytes())
   d=copy.deepcopy(c);d['summary']='Changed original'
   with self.assertRaises(ValueError):import_call(d,t)
if __name__=='__main__':unittest.main()
