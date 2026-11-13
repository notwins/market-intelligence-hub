"""The research register exposes public metadata, never private source records."""
import hashlib,json,re,subprocess,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SITE=ROOT/'site'
class ResearchRegisterTests(unittest.TestCase):
 def setUp(self):
  self.data=json.loads((SITE/'data/research-register.json').read_text())
  self.tags={r['id']:r for r in json.loads((SITE/'data/external-source-standard.json').read_text())['tags']}
 def test_metadata_and_all_public_paths(self):
  entries=self.data['entries'];self.assertEqual(len(entries),len({r['id'] for r in entries}))
  self.assertEqual(self.data['standard_version'],'V1.2 Merged')
  for row in entries:
   self.assertRegex(row['date'],r'^\d{4}-\d{2}-\d{2}$');self.assertIn(row['state'],['published','pending'])
   self.assertTrue(row['tags']);self.assertTrue(set(row['tags']).issubset(self.tags))
   if row['href']:
    self.assertRegex(row['href'],r'^(research|market-understanding)/[a-z0-9/_.-]+$');self.assertNotIn('..',row['href'])
    self.assertTrue((SITE/row['href']/ 'index.html').is_file() if row['href'].endswith('/') else (SITE/row['href']).is_file())
   for asset in row['assets']:self.assertTrue((SITE/asset).is_file())
   if row['state']=='published':self.assertRegex(row['sha256'],r'^[a-f0-9]{64}$')
 def test_revisions_and_additions_remain_distinct(self):
  urls={r['href']:r for r in self.data['entries'] if r['state']=='published'}
  for p in ['research/sti-banks-2026-11-06/','research/sti-banks-part2-2026-11-06/','research/wealth-inequality-2026-11-04/sharpe.html','research/diversification-made-simple-2026-11-06/','market-understanding/spx-floor-cap-2026-11-05/','market-understanding/spx-collars-2026-11-06/']:self.assertIn(p,urls)
  for p in ['research/googl/','research/nvda-2026-11-05/','research/tsm-2026-11-05/']:self.assertEqual(urls[p]['section'],'Calls')
 def test_private_evidence_is_not_public(self):
  text=(SITE/'data/research-register.json').read_text().lower()
  for secret in ['chatgpt.com/c/','chatgpt.com/g/','conversation_id','thread_id','file_id','onedrive','winston','account ending','client name','short put ledger','tastytrade','lee seong','file-service','sediment://']:
   self.assertNotIn(secret,text)
  for row in self.data['entries']:
   self.assertEqual(set(row)-{'id','title','href','date','date_label','state','edition','section','tags','summary','assets','published_date','sha256'},set())
 def test_filter_sort_search_and_invalid_links(self):
  code="""
  const assert=require('node:assert/strict'),fs=require('node:fs'),api=require('./site/research-register.js');
  const d=JSON.parse(fs.readFileSync('site/data/research-register.json')),tags=new Map(JSON.parse(fs.readFileSync('site/data/external-source-standard.json')).tags.map(t=>[t.id,t]));
  const opts={state:'published',query:'',tag:'',order:'newest'};
  let r=api.select(d.entries,opts,tags);assert(r.every(x=>x.state==='published'));
  for(let i=1;i<r.length;i++)assert(r[i-1].date>=r[i].date);
  r=api.select(d.entries,{...opts,state:'pending'},tags);assert(r.length>0&&r.every(x=>x.state==='pending'));
  r=api.select(d.entries,{...opts,query:'SPX collar'},tags);assert.equal(r.length,1);
  r=api.select(d.entries,{...opts,tag:'asset.gold'},tags);assert(r.length>=3&&r.every(x=>x.tags.includes('asset.gold')));
  r=api.select(d.entries,{...opts,order:'oldest'},tags);for(let i=1;i<r.length;i++)assert(r[i-1].date<=r[i].date);
  assert(!api.validPath('javascript:alert(1)'));assert(!api.validPath('//other.test/'));assert(!api.validPath('research/../../secret'));assert(api.validPath('research/googl/'));
  """
  p=subprocess.run(['node','-e',code],cwd=ROOT,text=True,capture_output=True);self.assertEqual(p.returncode,0,p.stdout+p.stderr)
 def test_companion_rebuild_preserves_register_and_original(self):
  import shutil,tempfile
  from unittest.mock import patch
  import build_report_additions as build
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);(root/'scripts').mkdir();(root/'site').mkdir()
   shutil.copyfile(ROOT/'scripts/report_additions_manifest.json',root/'scripts/report_additions_manifest.json')
   companions=build.make()
   for relative in companions:
    target=root/'site'/relative;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(SITE/relative,target)
   before=build.strip_additions((root/'site/market-understanding/index.html').read_text())
   with patch.object(build,'ROOT',root),patch.object(build,'SITE',root/'site'),patch.object(build,'make',return_value=companions):build.main()
   result=(root/'site/market-understanding/index.html').read_text()
   self.assertEqual(build.strip_additions(result),before)
   self.assertEqual(result.count('id="my-research"'),1)
   self.assertIn('research-register.js',result);self.assertIn('research-register.css',result)
   self.assertLess(result.index('id="published-research"'),result.index('id="my-research"'))
   self.assertLess(result.index('id="my-research"'),result.index('<section class="mu-summary">'))
   self.assertEqual(result.count('id="mu-shortcuts-title"'),1)
   self.assertLess(result.index('id="mu-shortcuts-title"'),result.index('id="full-market-research-20261106"'))
 def test_navigation_order_and_shortcut_targets(self):
  page=(SITE/'market-understanding/index.html').read_text()
  self.assertRegex(page,r'<!-- my-research-register:end --><section class="mu-summary">')
  self.assertLess(page.index('id="published-research"'),page.index('id="my-research"'))
  shortcuts=re.search(r'<!-- research-shortcuts:start -->(.*?)<!-- research-shortcuts:end -->',page,re.S).group(1)
  self.assertIn('aria-labelledby="mu-shortcuts-title"',shortcuts)
  targets=re.findall(r'<a href="#([^"]+)"><b>([^<]+)</b>',shortcuts)
  self.assertEqual(targets,[('mu-ai-financing','Growth'),('mu-bond-duration','Bonds'),('mu-fx-return','Currency'),('mu-alternatives-liquidity','Liquidity')])
  for target,_ in targets:self.assertEqual(page.count('id="'+target+'"'),1)
 def test_ui_interactions(self):
  p=subprocess.run(['node','scripts/test_research_register_ui.cjs'],cwd=ROOT,text=True,capture_output=True);self.assertEqual(p.returncode,0,p.stdout+p.stderr)
 def test_ui_wiring_and_accessibility(self):
  page=(SITE/'market-understanding/index.html').read_text();js=(SITE/'research-register.js').read_text();css=(SITE/'research-register.css').read_text()
  self.assertEqual(page.count('id="my-research"'),1);self.assertIn('research-register.js',page);self.assertIn('research-register.css',page)
  self.assertIn('aria-live="polite"',page);self.assertIn('aria-pressed',js);self.assertIn('textContent',js);self.assertNotIn('innerHTML',js)
  self.assertIn('max-width:560px',css);self.assertIn('prefers-color-scheme:dark',css);self.assertIn('focus-visible',css)
  self.assertIn('market-understanding/#my-research',(SITE/'v4.html').read_text())
if __name__=='__main__':unittest.main()
