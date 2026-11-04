import hashlib,json,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_site_search import watchlist_report_target

class DatedSearchRouting(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
  (self.root/'data/watchlist/reports').mkdir(parents=True)
  self.edition={'id':'watchlist-20261103T120000Z','as_of':'2026-11-03T20:00:00+08:00'}
  self.path='data/watchlist/reports/'+self.edition['id']+'.html'
  self.content=b'<article id="AAPL"></article><article id="BRK.B"></article>'
  (self.root/self.path).write_bytes(self.content)
  self.row={'edition_id':self.edition['id'],'as_of':self.edition['as_of'],'path':self.path,'sha256':hashlib.sha256(self.content).hexdigest()}
  self.write()
 def tearDown(self):self.tmp.cleanup()
 def write(self): (self.root/'data/watchlist/report-index.json').write_text(json.dumps({'reports':[self.row]}))
 def test_exact_edition_and_company_anchor(self):
  self.assertEqual(watchlist_report_target(self.root,self.edition,'AAPL'),self.path+'#AAPL')
  self.assertEqual(watchlist_report_target(self.root,self.edition,'BRK.B'),self.path+'#BRK.B')
 def test_reader_targets_the_exact_validated_edition(self):
  (self.root/'watchlist-report.html').write_text('<main>Reader</main>')
  for ticker in ['AAPL','BRK.B']:
   self.assertEqual(watchlist_report_target(self.root,self.edition,ticker),'watchlist-report.html?edition='+self.edition['id']+'#'+ticker)
 def test_reader_does_not_bypass_receipt_or_anchor_checks(self):
  (self.root/'watchlist-report.html').write_text('<main>Reader</main>')
  self.assertIsNone(watchlist_report_target(self.root,self.edition,'MSFT'))
  (self.root/self.path).write_text('changed')
  self.assertIsNone(watchlist_report_target(self.root,self.edition,'AAPL'))
 def test_missing_reader_retains_immutable_original_fallback(self):
  (self.root/'watchlist-report.html').mkdir()
  self.assertEqual(watchlist_report_target(self.root,self.edition,'AAPL'),self.path+'#AAPL')
 def test_never_route_to_a_different_or_latest_edition(self):
  self.row['edition_id']='watchlist-20261103T160000Z';self.write()
  self.assertIsNone(watchlist_report_target(self.root,self.edition,'AAPL'))
 def test_mismatched_cutoff_is_not_exact(self):
  self.row['as_of']='2026-11-04T00:00:00+08:00';self.write()
  self.assertIsNone(watchlist_report_target(self.root,self.edition,'AAPL'))
 def test_missing_or_modified_report_has_no_redirect(self):
  (self.root/self.path).write_text('changed')
  self.assertIsNone(watchlist_report_target(self.root,self.edition,'AAPL'))
  (self.root/self.path).unlink()
  self.assertIsNone(watchlist_report_target(self.root,self.edition,'AAPL'))
 def test_invalid_ticker_anchor_and_path_are_rejected(self):
  for ticker in ['MSFT','../AAPL','<script>']:self.assertIsNone(watchlist_report_target(self.root,self.edition,ticker))
  self.row['path']='../../private.html';self.write()
  self.assertIsNone(watchlist_report_target(self.root,self.edition,'AAPL'))
 def test_invalid_or_missing_index(self):
  p=self.root/'data/watchlist/report-index.json';p.write_text('broken')
  self.assertIsNone(watchlist_report_target(self.root,self.edition,'AAPL'))
  p.unlink();self.assertIsNone(watchlist_report_target(self.root,self.edition,'AAPL'))

if __name__=='__main__':unittest.main()
