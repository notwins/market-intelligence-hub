import json,subprocess,tempfile,unittest
from pathlib import Path
SCRIPT=Path(__file__).with_name('release_lane_guard.py')
class CLITests(unittest.TestCase):
 def git(self,*args):return subprocess.check_output(['git','-C',str(self.root),*args],stderr=subprocess.PIPE).decode().strip()
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
  self.git('init');self.git('config','user.name','Pilot');self.git('config','user.email','pilot@example.invalid')
  (self.root/'site/data').mkdir(parents=True);(self.root/'site/v4.html').write_text('old UI');(self.root/'site/data/research-register.json').write_text('{"entries":[]}')
  (self.root/'scripts').mkdir();(self.root/'site/v4-tools.js').write_text('old render module');(self.root/'scripts/test_yield_comparisons.cjs').write_text('old presentation test')
  self.git('add','.');self.git('commit','-m','base');self.base=self.git('rev-parse','HEAD')
 def tearDown(self):self.tmp.cleanup()
 def commit(self):self.git('add','.');self.git('commit','-m','candidate');return self.git('rev-parse','HEAD')
 def runcli(self,candidate,lane='ui',current=None):
  return subprocess.run(['python',str(SCRIPT),'--repo',str(self.root),'--base-commit',self.base,'--candidate',candidate,'--current-main-sha',current or self.base,'--lane',lane],text=True,capture_output=True)
 def test_committed_bytes_not_dirty_worktree_and_exact_hashes(self):
  (self.root/'site/v4.html').write_text('new UI');candidate=self.commit();(self.root/'site/v4.html').write_text('unreviewed dirty edit')
  r=self.runcli(candidate);self.assertEqual(r.returncode,0,r.stderr);out=json.loads(r.stdout)
  self.assertEqual(out['paths'][0]['after'],'100644:'+self.git('rev-parse',candidate+':site/v4.html'))
  self.assertEqual(out['candidate_tree'],self.git('rev-parse',candidate+'^{tree}'))
 def test_report_register_taken_from_tree(self):
  (self.root/'site/research/new-edition').mkdir(parents=True);(self.root/'site/research/new-edition/index.html').write_text('report')
  (self.root/'site/data/research-register.json').write_text('{"entries":[{"id":"new","href":"research/new-edition/"}]}')
  r=self.runcli(self.commit(),'report');self.assertEqual(r.returncode,0,r.stderr)
 def test_stale_current_sha_fails(self):
  (self.root/'site/v4.html').write_text('new');r=self.runcli(self.commit(),current='b'*40);self.assertEqual(r.returncode,2);self.assertIn('stale',r.stderr)
 def test_unregistered_report_cannot_be_hidden_by_worktree_register(self):
  (self.root/'site/research/new-edition').mkdir(parents=True);(self.root/'site/research/new-edition/index.html').write_text('report');candidate=self.commit()
  (self.root/'site/data/research-register.json').write_text('{"entries":[{"id":"new","href":"research/new-edition/"}]}')
  self.assertEqual(self.runcli(candidate,'report').returncode,2)
 def test_chart_paths_are_bound_to_reviewed_tree_not_dirty_files(self):
  paths=['scripts/test_yield_comparisons.cjs','site/v4-tools.js']
  for path in paths:(self.root/path).write_text('reviewed presentation')
  candidate=self.commit();(self.root/'site/v4-tools.js').write_text('unreviewed dirty edit')
  r=self.runcli(candidate);self.assertEqual(r.returncode,0,r.stderr);out=json.loads(r.stdout)
  self.assertEqual(out['changed_paths'],paths)
  for row in out['paths']:
   self.assertEqual(row['after'],'100644:'+self.git('rev-parse',candidate+':'+row['path']))
 def test_chart_extension_cannot_self_authorize_a_guard_edit(self):
  (self.root/'site/v4-tools.js').write_text('reviewed presentation')
  (self.root/'scripts/release_lane_guard.py').write_text('unreviewed policy')
  r=self.runcli(self.commit());self.assertEqual(r.returncode,2);self.assertIn('ownership',r.stderr)
if __name__=='__main__':unittest.main()
