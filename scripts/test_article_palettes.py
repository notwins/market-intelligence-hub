"""Keep the article key complete, source-backed and honest about legacy status."""
import hashlib,json,re,unittest,subprocess
from pathlib import Path
from build_article_palettes import directory,render,TOPICS,RECOMMENDATIONS
ROOT=Path(__file__).resolve().parents[1];SITE=ROOT/'site'
class ArticlePaletteTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.data=json.loads((SITE/'data/article-palettes.json').read_text());cls.standard=json.loads((SITE/'data/colour-templates-v3.json').read_text());cls.html=(SITE/'colour-templates-v3/index.html').read_text()
 def test_inventory_is_current_and_complete(self):
  self.assertEqual(self.data,directory(ROOT))
  self.assertEqual(len(self.data['articles']),len({a['href'] for a in self.data['articles']}))
  self.assertIn(render(self.data,self.standard),self.html)
 def test_guidance_preserves_all_ten_subjects(self):
  self.assertEqual({i for i,s in TOPICS},{f'{i:02}' for i in range(1,11)})
  self.assertEqual(len([s for v in RECOMMENDATIONS.values() for s in v]),len(set(s for v in RECOMMENDATIONS.values() for s in v)))
  for theme,subject in TOPICS:self.assertIn(subject.replace('&','&amp;'),self.html)
 def test_current_status_is_not_guessed_from_topic(self):
  for a in self.data['articles']:
   path=SITE/a['href'];path=path/'index.html' if path.is_dir() else path;text=path.read_text()
   self.assertEqual(a['source_sha256'],hashlib.sha256(text.encode()).hexdigest())
   if a['status']=='legacy-unassigned':
    self.assertIsNone(a['declared_theme']);self.assertNotIn('id="mih-research-contract"',text)
   else:self.assertEqual(a['status'],'contract-declared');self.assertIsNotNone(a['declared_theme'])
  for phrase in ['Not yet assigned','Prescribed for the next edition','not an applied-theme claim','May include dark-mode colours']:
   self.assertIn(phrase,self.html)
 def test_readable_swatches_and_filter_controls(self):
  for key in ['article-query','article-theme','article-status','article-count','article-more','article-empty','article-results']:
   self.assertIn('id="'+key+'"',self.html)
  self.assertIn('code>',self.html);self.assertIn('role="status"',self.html)
  js=(SITE/'colour-templates-v3/reference.js').read_text();self.assertIn('c.hidden=!visible.has(c)',js)
  self.assertIn('grid-template-columns:1fr',(SITE/'colour-templates-v3/reference.css').read_text())
 def test_directory_interactions_and_semantic_icons(self):
  subprocess.run(['node',str(ROOT/'scripts/test_article_palette_ui.cjs')],check=True,capture_output=True,text=True)
 def test_future_prompt_and_build_use_guide(self):
  self.assertIn('All future research follows',(SITE/'legal/research-prompt.txt').read_text())
  self.assertEqual((ROOT/'.github/workflows/publish.yml').read_text().count('python3 scripts/build_article_palettes.py'),2)
  for text in [json.dumps(self.data),self.html]:
   self.assertIsNone(re.search(r'libfile_|sediment://|chatgpt\.com/(?:c|g)/|/workspace/|graph\.microsoft\.com|onedrive\.live',text,re.I))
if __name__=='__main__':unittest.main()
