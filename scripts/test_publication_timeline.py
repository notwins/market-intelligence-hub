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
 def test_summaries_are_editorial_content_not_boilerplate(self):
  self.assertIsNone(builder.useful_summary(''))
  self.assertIsNone(builder.useful_summary('Saved Reuters-attributed headline metadata via Google News; opens publisher route.'))
  self.assertIsNone(builder.useful_summary('Not personalised investment advice. Read the article.'))
  with tempfile.TemporaryDirectory() as directory:
   page=Path(directory)/'index.html'
   page.write_text('<meta content="The report compares bond yields, duration and currency exposure using dated source data." name="description">')
   self.assertIn('bond yields',builder.article_summary(page))
   page.write_text('<p>Navigation and legal clauses must not become article summaries.</p>')
   self.assertIsNone(builder.article_summary(page))
   call=Path(directory)/'calls';call.mkdir();page=call/'index.html';page.write_text('<meta name="description" content="Private transaction facts should not be amplified in a timeline description.">')
   self.assertIsNone(builder.article_summary(page))
 def test_reuters_summaries_require_exact_identity_and_verification(self):
  item={'id':'r1','title':'A headline','published_at':'2026-11-05T00:00:00Z'}
  context={**item,'summary':'The article compares the latest reported earnings with the previous period and explains the drivers.', 'summary_verified':True,'summary_source_url':'https://www.reuters.com/test/'}
  self.assertIn('summary',builder.verified_reuters_summary(item,[context]))
  for change in [{'title':'Different title'},{'published_at':'2026-11-04T00:00:00Z'},{'summary_verified':False},{'summary_source_url':'https://chatgpt.com/c/private'}]:
   self.assertEqual({},builder.verified_reuters_summary(item,[{**context,**change}]))
 def test_title_colours_are_whole_terms_and_utf16_safe(self):
  standard={'keyword_groups':[{'aliases':['Fed'],'priority':104,'text_light':'#4338CA'},{'aliases':['AI'],'priority':90,'text_light':'#6D28D9'}]}
  self.assertEqual([],builder.title_terms('FedEx and AIG; investors fed up',standard))
  self.assertEqual([{'start':3,'end':6,'color':'#4338CA'}],builder.title_terms('📚 Fed decision',standard))
 def test_reuters_snapshot_deduplication(self):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);(root/'site/data/archive').mkdir(parents=True)
   item={'id':'one','title':'One headline','publisher':'Reuters','url':'https://www.reuters.com/example','published_at':'2026-11-05T00:00:00Z'}
   (root/'site/data/news.json').write_text(json.dumps({'items':[item,item]}))
   (root/'site/data/archive/day.json').write_text(json.dumps({'items':[item]}))
   data=builder.build(root);self.assertEqual(len(data['entries']),1)

if __name__=='__main__':unittest.main()
