"""Dated public-edition, arithmetic and privacy safeguards for the bond research."""
import json
from pathlib import Path
import re
import unittest
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parents[1]
REPORT=ROOT/'site/market-understanding/treasuries-chf-gold-2026-11-06'
class Capture(HTMLParser):
 def __init__(self):super().__init__();self.ids=[];self.tags=[];self.hrefs=[]
 def handle_starttag(self,t,attrs):
  a=dict(attrs);self.tags.append(t)
  if 'id' in a:self.ids.append(a['id'])
  if 'href' in a:self.hrefs.append(a['href'])
class TreasuryResearchTests(unittest.TestCase):
 def setUp(self):self.html=(REPORT/'index.html').read_text();self.p=Capture();self.p.feed(self.html)
 def test_dated_quotes_and_risk(self):
  for s in ['04:42 UTC','05:06 UTC','Pre-payroll','13:30 UTC','97.006','5.046%','96.897','96.943','0.1125%','12:32pm','1:01pm','timezone','69.964','50.514','4:28pm','not a promise','not Singapore government bonds','dirty-price','9 November 2026','5.053%','model scenarios below retain their original inputs']:
   self.assertIn(s,self.html)
 def test_change_arithmetic(self):
  self.assertAlmostEqual((97.006/96.897-1)*100,.11249058278377522,places=9)
  self.assertAlmostEqual((96.897/92.860-1)*100,4.347404695240149,places=8)
  self.assertAlmostEqual((19.042/11.550-1)*100,64.86580086580086,places=8)
 def test_no_private_or_raster_material(self):
  for s in ['libfile_','chatgpt.com/c/','/workspace/','Client -','data:image','<img','<image','screenshot.jpg','ust_2041_price_']:
   self.assertNotIn(s,self.html)
  self.assertEqual(self.p.tags.count('svg'),4)
  self.assertEqual(set(p.suffix for p in REPORT.iterdir()),{'.html','.css','.json'})
 def test_navigation_and_sources(self):
  self.assertEqual(len(self.p.ids),len(set(self.p.ids)))
  for href in self.p.hrefs:
   if href.startswith('#'):self.assertIn(href[1:],self.p.ids)
  for isin in ['US912810QN19','US87973RBB50','US87973RAW07']:
   self.assertIn('https://www.bondsupermart.com/bsm/bond-factsheet/'+isin,self.p.hrefs)
  hub=(ROOT/'site/market-understanding/index.html').read_text()
  self.assertEqual(hub.count('href="treasuries-chf-gold-2026-11-06/"'),1)
  self.assertIn('market-understanding/treasuries-chf-gold-2026-11-06/index.html',(ROOT/'scripts/build_site_search.py').read_text())
 def test_manifest(self):
  m=json.loads((REPORT/'publication.json').read_text());self.assertEqual(m['as_of'],'2026-11-06T04:42:00Z');self.assertEqual(m['charts'],4)
if __name__=='__main__':unittest.main()
