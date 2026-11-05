import hashlib,json,re,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class NVIDIAResearch(unittest.TestCase):
 def test_public_edition(self):
  root=ROOT/'site/research/nvda-2026-11-05';page=(root/'index.html').read_text();meta=json.loads((root/'publication.json').read_text())
  self.assertEqual(meta['html_sha256'],hashlib.sha256(page.encode()).hexdigest())
  self.assertEqual(page.count('<svg'),4)
  self.assertEqual(page.count('<section '),11)
  for number in ['96.221','89.023','59.688','24.077','21.341','279bn','105bn','60.922','130.497','215.938']:self.assertIn(number,page)
  for forbidden in ['$310','$280','191.08','wide-moat view','libfile_','sediment://','onedrive.live','chatgpt.com/c/','<iframe','<script','data:image','<img']:self.assertNotIn(forbidden,page)
  for source in range(1,14):self.assertIn(f'id="source-{source}"',page)
  for href in re.findall(r'href="#([^"]+)"',page):self.assertIn('id="'+href+'"',page)
  self.assertIn('not bull/base/bear targets',page)
  self.assertIn('not as a forecast loss',page)
  self.assertIn('No access control was bypassed',page)
  self.assertIn('prefers-color-scheme:dark',page)
  self.assertIn('research/nvda-2026-11-05/',(ROOT/'site/market-understanding/index.html').read_text())
  self.assertIn("'research/nvda-2026-11-05/index.html'",(ROOT/'scripts/build_site_search.py').read_text())
if __name__=='__main__':unittest.main()
