import json,subprocess,tempfile,unittest
from pathlib import Path
from publish_generated_data import publish

class PublisherRaceTests(unittest.TestCase):
 def git(self,root,*args):
  return subprocess.run(['git',*args],cwd=root,text=True,capture_output=True,check=True).stdout.strip()
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.base=Path(self.temp.name);self.origin=self.base/'remote.git';self.a=self.base/'a';self.b=self.base/'b'
  self.git(self.base,'init','--bare',str(self.origin));self.git(self.base,'clone',str(self.origin),str(self.a))
  self.git(self.a,'checkout','-b','main')
  for root in [self.a]:
   self.git(root,'config','user.name','Test');self.git(root,'config','user.email','test@example.invalid')
  (self.a/'site/data').mkdir(parents=True);(self.a/'site/data/feed.json').write_text('old\n');(self.a/'site/data/site-search.json').write_text('index-old\n');(self.a/'README.md').write_text('old docs\n')
  self.git(self.a,'add','.');self.git(self.a,'commit','-m','initial');self.git(self.a,'push','origin','HEAD:main')
  self.git(self.origin,'symbolic-ref','HEAD','refs/heads/main');self.git(self.base,'clone',str(self.origin),str(self.b))
  self.git(self.b,'config','user.name','Test');self.git(self.b,'config','user.email','test@example.invalid')
 def tearDown(self):self.temp.cleanup()
 def advance(self,path,text):
  (self.b/path).write_text(text);self.git(self.b,'add',path);self.git(self.b,'commit','-m','concurrent');self.git(self.b,'push','origin','HEAD:main')
 def test_index_only_does_not_push_or_create_commit(self):
  head=self.git(self.a,'rev-parse','HEAD');(self.a/'site/data/site-search.json').write_text('new timestamp\n')
  self.advance('README.md','new remote docs\n')
  self.assertIn('No source-data changes',publish(self.a))
  self.assertEqual(self.git(self.a,'rev-parse','HEAD'),head);self.assertEqual((self.a/'site/data/site-search.json').read_text(),'index-old\n')
 def test_nonconflicting_advance_reconciles_without_overwrite(self):
  (self.a/'site/data/feed.json').write_text('new feed\n');(self.a/'site/data/site-search.json').write_text('new index\n')
  self.advance('README.md','concurrent docs\n');self.assertIn('published without force',publish(self.a))
  self.assertEqual((self.a/'README.md').read_text(),'concurrent docs\n');self.assertEqual((self.a/'site/data/feed.json').read_text(),'new feed\n')
  self.assertEqual(self.git(self.origin,'show','main:README.md'),'concurrent docs');self.assertEqual(self.git(self.origin,'show','main:site/data/feed.json'),'new feed')
 def test_conflict_stops_and_preserves_patch(self):
  (self.a/'site/data/feed.json').write_text('publisher feed\n');self.advance('site/data/feed.json','other publisher feed\n')
  with self.assertRaisesRegex(RuntimeError,'conflict'):publish(self.a)
  self.assertTrue((self.a/'pending-publisher.patch').exists());self.assertIn('publisher feed',(self.a/'pending-publisher.patch').read_text())
  self.assertEqual(self.git(self.origin,'show','main:site/data/feed.json'),'other publisher feed')
  self.assertEqual((self.a/'site/data/feed.json').read_text(),'publisher feed\n')
if __name__=='__main__':unittest.main()
