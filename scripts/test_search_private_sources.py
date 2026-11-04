import json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_site_search import restricted_source
ROOT=Path(__file__).resolve().parents[1]/'site'
class PrivateSourceLinks(unittest.TestCase):
 def test_private_routes_detected_and_public_sources_preserved(self):
  for url in ['https://chatgpt.com/c/private-id','https://chatgpt.com/g/g-workspace/c/private-id','https://chat.openai.com/c/private-id','https://chatgpt.com/%63/private-id']:
   self.assertTrue(restricted_source(url))
  for url in ['https://www.reuters.com/world/example','https://chatgpt.com/share/example','v4.html#hourly',None]:self.assertFalse(restricted_source(url))
 def test_generated_catalogue_omits_original_private_ids(self):
  catalogue=(ROOT/'data/site-search.json').read_text()
  data=json.loads((ROOT/'data/hourly-news.json').read_text())
  urls=[e.get('original_url','') for e in data.get('editions',[])]
  private=[u for u in urls if restricted_source(u)]
  self.assertTrue(private)
  for url in private:
   self.assertNotIn(url,catalogue)
   self.assertNotIn(url.rstrip('/').split('/')[-1],catalogue)
  rows=json.loads(catalogue)['entries']
  self.assertTrue(any(e.get('source_access')=='restricted' for e in rows))
  self.assertTrue(any(e.get('source','') and 'reuters.com' in e['source'] for e in rows))
if __name__=='__main__':unittest.main()
