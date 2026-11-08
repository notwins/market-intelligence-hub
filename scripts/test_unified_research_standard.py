"""One page, authoritative inputs, retained colour and publication deep links."""
import json,re,unittest
from pathlib import Path
from build_research_standard import markdown,build
ROOT=Path(__file__).resolve().parents[1];PAGE=ROOT/'site/colour-templates-v3/index.html'
class UnifiedStandardTests(unittest.TestCase):
 def test_prompt_and_gate_embed_their_exact_authoritative_sources(self):
  html=PAGE.read_text()
  for id,path in [('unified-prompt-source','site/legal/research-prompt.txt'),('unified-gate-source','docs/research-colour-gatekeeper.md')]:
   text=(ROOT/path).read_text();self.assertEqual(json.loads(re.search('<script type="application/json" id="'+id+'">(.*?)</script>',html,re.S)[1]),text)
   self.assertIn(markdown(text),html)
 def test_all_standards_are_in_one_page_and_old_anchors_remain(self):
  html=PAGE.read_text()
  for id in ['main','standard-overview','research-style','subject-guide','articles','themes','palettes','routing','tagging','companies','keywords','gatekeeper','gatekeeper-complete','downloads']:
   self.assertEqual(html.count('id="'+id+'"'),1,id)
  self.assertLess(html.index('id="research-style"'),html.index('id="companies"'))
  self.assertIn('Copy complete research prompt',html)
  self.assertIn('not a separate version',html)
 def test_generation_is_idempotent_and_escaped(self):
  previous=PAGE.read_text();build(ROOT);self.assertEqual(previous,PAGE.read_text())
  self.assertNotIn('<script>',markdown('<script>alert(1)</script>'))
  self.assertNotIn('<a href="javascript:',markdown('[bad](javascript:alert(1))'))
 def test_new_assets_have_refresh_version(self):
  html=PAGE.read_text()
  self.assertIn('reference.js?v=20261108-unified-standard',html)
  self.assertIn('reference.css?v=20261108-unified-standard',html)
if __name__=='__main__':unittest.main()
