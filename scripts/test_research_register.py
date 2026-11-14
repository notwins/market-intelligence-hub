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
    self.assertEqual(set(row)-{'id','title','href','date','date_label','state','edition','section','tags','summary','assets','published_date','sha256','full_edition'},set())
 def test_registered_full_edition_documents_are_bound_to_reviewed_bytes(self):
  from build_report_additions import validate_full_editions
  validate_full_editions(self.data,SITE)
 def test_full_edition_publication_gate_rejects_extracts_and_bad_documents(self):
  import copy,tempfile
  from build_report_additions import validate_full_editions
  with tempfile.TemporaryDirectory() as directory:
   site=Path(directory);root='research/verified-2026-11-01/';document=root+'report.pdf'
   (site/root).mkdir(parents=True);payload=b'%PDF-1.4\npublic source fixture\n%%EOF\n';(site/document).write_bytes(payload)
   row={'id':'verified-2026-11-01','state':'published','date':'2026-11-01','href':root,'edition':'Verified full original edition','assets':[document],
        'full_edition':{'channel':'credit','kind':'complete-source-edition','completeness_verified':True,'cutoff':'2026-11-01T08:00:00+08:00','document':document,'sha256':hashlib.sha256(payload).hexdigest(),'verification':'original-document-completeness-reviewed'}}
   self.assertEqual(validate_full_editions({'entries':[row]},site),[row])
   for field,value in [('kind','extract'),('completeness_verified',False),('completeness_verified','true'),('verification','length checked'),('channel','chart-data'),('cutoff','2026-11-01'),('document','https://chatgpt.com/c/private'),('document','research/verified-2026-11-01/../private.pdf'),('sha256','0'*64)]:
    bad=copy.deepcopy(row);bad['full_edition'][field]=value
    with self.subTest(field=field,value=value),self.assertRaises(ValueError):validate_full_editions({'entries':[bad]},site)
   for edition in ['Verified extract','Abstract','Public abridged summary','Historical research atlas','Compilation','Snapshot']:
    bad=copy.deepcopy(row);bad['edition']=edition
    with self.subTest(edition=edition),self.assertRaises(ValueError):validate_full_editions({'entries':[bad]},site)
   bad=copy.deepcopy(row);bad['full_edition']['private_source']='secret'
   with self.assertRaises(ValueError):validate_full_editions({'entries':[bad]},site)
   (site/document).write_bytes(payload+b'changed')
   with self.assertRaises(ValueError):validate_full_editions({'entries':[row]},site)
 def test_full_slots_ignore_newer_extracts_and_keep_historical_references_separate(self):
  code=r"""
  const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
  const source=fs.readFileSync('site/v4-tools.js','utf8').split('/* full-report-destinations:start */')[1].split('/* full-report-destinations:end */')[0],ctx={window:{},Date};
  vm.createContext(ctx);vm.runInContext(source,ctx);const api=ctx.window.HubFullReportEditions;
  const full={id:'old-full',title:'Dated complete source',state:'published',date:'2026-11-01',href:'research/verified-2026-11-01/',edition:'Verified full original edition',assets:['research/verified-2026-11-01/report.pdf'],full_edition:{channel:'credit',kind:'complete-source-edition',completeness_verified:true,cutoff:'2026-11-01T08:00:00+08:00',document:'research/verified-2026-11-01/report.pdf',sha256:'a'.repeat(64),verification:'original-document-completeness-reviewed'}};
  const newer={id:'new-extract',channel:'credit',date:'2026-11-14',cutoff:'08:00 SGT',title:'New extract',status:'Verified extract',full_text:'long text '.repeat(10000)};
  api.setRegistry({entries:[{...newer,state:'published',edition:'Verified extract'}]});assert.equal(api.select('credit').length,0);
  let html=api.panel('credit',[newer]);assert(html.includes('No verified full edition available'));assert(!html.includes('Read verified full edition'));assert(html.includes('Read dated extract'));assert(html.includes('Historical research reference'));assert(html.includes('2026-11-06'));
  const before=JSON.stringify(full);api.setRegistry({entries:[full,newer]});assert.equal(api.select('credit')[0].id,'old-full');html=api.panel('credit',[newer]);assert(html.includes('research/verified-2026-11-01/report.pdf'));assert(html.indexOf('Read verified full edition')<html.indexOf('Latest saved extract'));assert.equal(JSON.stringify(full),before);
  for(const change of [{edition:'Abstract'},{edition:'Verified extract'},{full_edition:{...full.full_edition,kind:'summary'}},{full_edition:{...full.full_edition,completeness_verified:false}},{full_edition:{...full.full_edition,document:'https://chatgpt.com/c/private'}},{full_edition:{...full.full_edition,sha256:'missing'}},{state:'pending'}]){api.setRegistry({entries:[{...full,...change}]});assert.equal(api.select('credit').length,0);}
  api.setRegistry({entries:[full]});assert.equal(api.select('earnings').length,0);assert.equal(api.select('weekly-fx').length,0);html=api.panel('weekly-fx',[]);assert(html.includes('not weekly narrative editions'));assert(html.includes('2026-11-05'));assert(html.includes('historical-market-events-2026-11-05'));assert(!html.includes('Read verified full edition'));
  const six=Array.from({length:6},(_,i)=>({...full,id:'full-'+i,date:'2026-11-0'+(i+1),full_edition:{...full.full_edition,cutoff:'2026-11-0'+(i+1)+'T08:00:00+08:00'}}));api.setRegistry({entries:six.reverse()});assert.equal(api.select('credit')[0].id,'full-5');assert.equal((api.panel('credit',[]).match(/rel="noopener noreferrer"/g)||[]).length,5);
  assert(!api.library([newer]).includes('chatgpt.com'));api.setRegistry(null);assert.equal(api.select('credit').length,0);
  const page=fs.readFileSync('site/v4.html','utf8');assert(!page.includes('Read the full scheduled edition'));assert(!page.includes('Read latest credit report'));assert(page.includes("['researchRegister','data/research-register.json']"));assert(page.includes('HubFullReportEditions.readerNotice(r)'));
  """
  result=subprocess.run(['node','-e',code],cwd=ROOT,text=True,capture_output=True)
  self.assertEqual(result.returncode,0,result.stdout+result.stderr)
 def test_filter_sort_search_and_invalid_links(self):
  code="""
  const assert=require('node:assert/strict'),fs=require('node:fs'),api=require('./site/research-register.js');
  const d=JSON.parse(fs.readFileSync('site/data/research-register.json')),tags=new Map(JSON.parse(fs.readFileSync('site/data/external-source-standard.json')).tags.map(t=>[t.id,t]));
  const opts={state:'published',query:'',tag:'',order:'newest'};
  let r=api.select(d.entries,opts,tags);assert(r.every(x=>x.state==='published'));
  for(let i=1;i<r.length;i++)assert(r[i-1].date>=r[i].date);
  r=api.select(d.entries,{...opts,state:'pending'},tags);assert(r.length>0&&r.every(x=>x.state==='pending'));
  r=api.select(d.entries,{...opts,query:'SPX collar'},tags);
  assert.deepEqual(r.map(x=>x.href).sort(),[
   'market-understanding/spx-collars-2026-11-06/',
   'research/spx-collar-public-companion-2026-11-14/'
  ]);
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
