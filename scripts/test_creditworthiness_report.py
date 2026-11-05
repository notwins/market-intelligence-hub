import unittest
from pathlib import Path
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parents[1]
class Collector(HTMLParser):
 def __init__(self):super().__init__();self.ids=set();self.hrefs=[]
 def handle_starttag(self,t,a):
  a=dict(a)
  if 'id' in a:self.ids.add(a['id'])
  if t=='a' and 'href' in a:self.hrefs.append(a['href'])
class CreditReport(unittest.TestCase):
 def test_public_artifact(self):
  base=ROOT/'site/market-understanding/creditworthiness-2026-11-05';s=(base/'index.html').read_text();p=Collector();p.feed(s)
  for h in p.hrefs:
   if h.startswith('#'):self.assertIn(h[1:],p.ids)
  for banned in ['libfile_', 'onedrive.live.com','All debt stands below equity','probably BBB','Chart Idea','assuming ~$91.3 debt+$13 buybacks','【']:
   self.assertNotIn(banned,s)
  for needed in ['98.657','1.001x','144.748','30.80%','not calculated','Historical','Source register']:
   self.assertIn(needed,s)
  self.assertTrue((base/'creditworthiness-guide.pdf').read_bytes().startswith(b'%PDF'))
 def test_arithmetic(self):
  self.assertAlmostEqual(7.979+12.350+78.328,98.657)
  self.assertAlmostEqual(111.482-12.715,98.767)
  self.assertAlmostEqual(133.050+11.698,144.748)
  self.assertAlmostEqual(35.934+111.482*.75-12.715-12.393-7.979,86.4585)
  self.assertAlmostEqual(sum([12.393,10.078,9.300,5.235,4.972,49.303]),91.281)
if __name__=='__main__':unittest.main()
