import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location('publication_builder',Path(__file__).with_name('build_publication_timeline.py'))
builder=importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

class PublicationTimelineTests(unittest.TestCase):
 def test_timezone_and_private_links(self):
  self.assertEqual(builder.timestamp('2026-11-06T00:00:00+08:00'),'2026-11-05T16:00:00+00:00')
  self.assertIsNone(builder.timestamp('2026-11-05'))
  self.assertIsNone(builder.public_url('https://chatgpt.com/c/private'))
  self.assertIsNone(builder.public_url('javascript:alert(1)'))
  self.assertIsNone(builder.public_url('https://user:secret@example.com'))
 def test_first_introduction_is_not_data_date_or_modification(self):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory)
   def git(*args):return subprocess.run(['git',*args],cwd=root,check=True,capture_output=True,text=True).stdout
   git('init');git('config','user.name','Test');git('config','user.email','test@example.com')
   (root/'site/research/test').mkdir(parents=True);(root/'site/market-understanding').mkdir()
   (root/'site/data').mkdir()
   page=root/'site/research/test/index.html';page.write_text('<title>Already public</title><p>As of 1999</p>')
   (root/'site/data/news.json').write_text(json.dumps({'items':[{'id':'r1','title':'Reuters title','publisher':'Reuters','url':'https://www.reuters.com/example/','published_at':'2026-11-05T00:00:00Z'},{'id':'private','title':'Private','url':'https://chatgpt.com/c/private','published_at':'2026-11-05T00:00:00Z'}]}))
   git('add','.');git('commit','-m','Publish')
   first=git('rev-parse','HEAD').strip()
   page.write_text('<title>Already public, corrected</title>');git('add','.');git('commit','-m','Correct')
   payload=builder.build(root)
   doc=next(x for x in payload['entries'] if x['category']=='research')
   self.assertTrue(doc['provenance_url'].endswith(first))
   self.assertNotIn('1999',doc['at']);self.assertEqual(payload['undated_count'],0)
   self.assertEqual(payload['counts']['reuters'],1)
 def test_reuters_snapshot_deduplication(self):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);(root/'site/data/archive').mkdir(parents=True)
   item={'id':'one','title':'One headline','publisher':'Reuters','url':'https://www.reuters.com/example','published_at':'2026-11-05T00:00:00Z'}
   (root/'site/data/news.json').write_text(json.dumps({'items':[item,item]}))
   (root/'site/data/archive/day.json').write_text(json.dumps({'items':[item]}))
   data=builder.build(root);self.assertEqual(len(data['entries']),1)

if __name__=='__main__':unittest.main()
