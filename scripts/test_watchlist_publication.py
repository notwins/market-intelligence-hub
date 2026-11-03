import copy,hashlib,json,shutil,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from watchlist_report import render_report,import_report
from prepare_watchlist_publication import prepare
ROOT=Path(__file__).resolve().parents[1]
BASE='a'*40

class PublicationTests(unittest.TestCase):
 def setUp(self):self.d=json.loads((ROOT/'site/data/watchlist/archive/watchlist-20261103T120000Z.json').read_text(encoding='utf-8'))
 def test_report_complete_readable_and_separate_from_calls(self):
  text=render_report(self.d)
  for r in self.d['rows']:self.assertIn('id="'+r['ticker']+'"',text)
  self.assertEqual(text.count('class="card company"'),12);self.assertIn('Watch only',text);self.assertIn('not a live portfolio',text);self.assertIn('Risks and countercase',text);self.assertIn('Baseline date',text);self.assertNotIn('<script',text)
 def test_escape_injected_title_and_facts(self):
  d=copy.deepcopy(self.d);d['title']='<script>alert(1)</script>';d['rows'][0]['research'][0]['facts']=['<img src=x onerror=1>']
  text=render_report(d);self.assertNotIn('<script>',text);self.assertNotIn('<img ',text);self.assertIn('&lt;script&gt;',text);self.assertIn('&lt;img ',text)
 def test_immutable_report_and_receipt_idempotence(self):
  with tempfile.TemporaryDirectory() as folder:
   p=import_report(self.d,folder);original=p.read_bytes();import_report(self.d,folder);self.assertEqual(original,p.read_bytes())
   index=json.loads((Path(folder)/'data/watchlist/report-index.json').read_text(encoding='utf-8'));self.assertEqual(len(index['reports']),1);self.assertEqual(index['reports'][0]['sha256'],hashlib.sha256(original).hexdigest())
   altered=copy.deepcopy(self.d);altered['title']='Later correction'
   with self.assertRaisesRegex(ValueError,'Fixed report'):import_report(altered,folder)
   self.assertEqual(original,p.read_bytes())
 def test_candidate_preserves_old_calls_notes_status_and_editions(self):
  with tempfile.TemporaryDirectory() as temp:
   repo=Path(temp)/'repo';folder=repo/'site/data/watchlist';folder.mkdir(parents=True)
   shutil.copytree(ROOT/'site/data/watchlist',folder,dirs_exist_ok=True);(folder/'local-public-note.txt').write_text('Previously published note',encoding='utf-8');before={p.relative_to(folder):p.read_bytes() for p in folder.rglob('*') if p.is_file()}
   with patch('prepare_watchlist_publication.subprocess.check_output',return_value=BASE):plan=prepare(self.d,repo,Path(temp)/'candidate',BASE)
   after=Path(temp)/'candidate/site/data/watchlist'
   for name,body in before.items():
    if str(name) in ['index.json','latest.json','report-index.json']:self.assertEqual(json.loads((after/name).read_bytes()),json.loads(body))
    else:self.assertEqual((after/name).read_bytes(),body)
   self.assertFalse(plan['automatic_publication_verified']);self.assertTrue(all('/reports/' in f['path'] or f['path'].rsplit('/',1)[1] in ['index.json','latest.json','report-index.json'] for f in plan['files']))
 def test_stale_base_and_existing_candidate_are_rejected(self):
  with tempfile.TemporaryDirectory() as temp:
   with patch('prepare_watchlist_publication.subprocess.check_output',return_value='b'*40):
    with self.assertRaisesRegex(ValueError,'Stale checkout'):prepare(self.d,ROOT,Path(temp)/'candidate',BASE)
   with patch('prepare_watchlist_publication.subprocess.check_output',return_value=BASE):
    with self.assertRaisesRegex(ValueError,'new empty'):prepare(self.d,ROOT,temp,BASE)
 def test_private_fields_invalid_financial_values_and_sources_reject_before_output(self):
  for mutate in [lambda d:d.update(private_notes='private'),lambda d:d['rows'][0]['price'].update(close=float('nan')),lambda d:d['rows'][0]['sources'][0].update(url='https://chatgpt.com/c/private')]:
   d=copy.deepcopy(self.d);mutate(d)
   with self.assertRaises(ValueError):render_report(d)

if __name__=='__main__':unittest.main()
