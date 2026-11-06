"""Company reports stay discoverable without changing the underlying research or calls."""
import hashlib,json,re,unittest
from pathlib import Path
from html.parser import HTMLParser
from build_report_additions import strip_additions
ROOT=Path(__file__).resolve().parents[1]
class Links(HTMLParser):
 def __init__(self,text):super().__init__();self.links=[];self.feed(text)
 def handle_starttag(self,tag,attrs):
  if tag=='a':self.links.append(dict(attrs).get('href',''))
class CompanyResearchNavigation(unittest.TestCase):
 def test_google_sibling_links_and_calls_return(self):
  path=ROOT/'site/research/googl/index.html';html=path.read_text()
  nav=html.split('<!-- company-research-nav:start -->')[1].split('<!-- company-research-nav:end -->')[0]
  self.assertIn('aria-label="Company research navigation"',nav)
  links=Links(nav).links
  self.assertEqual(set(links),{'../../v4.html#calls','../tsm-2026-11-05/','../nvda-2026-11-05/'})
  for href in links:self.assertTrue((path.parent/href.split('#')[0]).exists(),href)
  baseline=json.loads((ROOT/'scripts/report_additions_manifest.json').read_text())['reports']['research/googl/index.html']
  self.assertEqual(hashlib.sha256(strip_additions(html).encode()).hexdigest(),baseline)
 def test_underlying_research_receipts_and_call_records_unchanged(self):
  for slug in ['tsm-2026-11-05','nvda-2026-11-05']:
   path=ROOT/'site/research'/slug
   self.assertEqual(hashlib.sha256((path/'index.html').read_bytes()).hexdigest(),json.loads((path/'publication.json').read_text())['html_sha256'])
  calls=json.loads((ROOT/'site/data/watchlist/calls.json').read_text())['calls']
  self.assertFalse(any(c['ticker'] in ['GOOGL','TSM','NVDA'] for c in calls))
 def test_generator_preserves_navigation(self):
  source=(ROOT/'scripts/build_report_additions.py').read_text()
  self.assertIn("if path=='research/googl/index.html': jump=",source)
  self.assertIn('<!-- company-research-nav:start -->',source)
if __name__=='__main__':unittest.main()
