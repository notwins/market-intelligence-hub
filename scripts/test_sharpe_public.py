"""Public Sharpe chapter: privacy, arithmetic, navigation and complete coverage."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
from decimal import Decimal as D
import re, math, unittest
ROOT=Path(__file__).resolve().parents[1]
PAGE=ROOT/'site/research/wealth-inequality-2026-11-04/sharpe.html'
class Parsed(HTMLParser):
 def __init__(self,text):
  super().__init__(); self.ids=[];self.links=[];self.tags=[];self.feed(text)
 def handle_starttag(self,t,attrs):
  a=dict(attrs);self.tags.append((t,a))
  if 'id' in a:self.ids.append(a['id'])
  if t=='a':self.links.append(a.get('href',''))
class SharpePublic(unittest.TestCase):
 @classmethod
 def setUpClass(cls): cls.text=PAGE.read_text();cls.p=Parsed(cls.text)
 def test_complete_chapter(self):
  self.assertEqual(sum(t=='section' for t,a in self.p.tags),16)
  for n in range(1,15):self.assertIn('17.'+str(n)+' ',self.text)
  self.assertIn('Net investor equity',self.text.replace('net investor equity','Net investor equity'))
  self.assertIn('No universal threshold',self.text)
  self.assertIn('not forecasts',self.text)
 def test_no_private_or_licensed_image_payload(self):
  self.assertNotRegex(self.text,r'libfile_|file_000|/workspace/|chatgpt\.com|sediment:|data:image|<img|<iframe|<script|PHOTOS COMPILATIONS|Winston|Screenshot 09|Screenshot 10')
  self.assertNotIn('href="#source-26"',self.text)
  self.assertLess(PAGE.stat().st_size,65000)
 def test_anchors_and_targets(self):
  self.assertEqual(len(self.p.ids),len(set(self.p.ids)))
  for href in self.p.links:
   u=urlsplit(href)
   if u.scheme:continue
   target=(PAGE.parent/unquote(u.path)) if u.path else PAGE
   self.assertTrue(target.is_file(),href)
   if u.fragment and not (target.name=='v4.html' and u.fragment=='research'):self.assertIn(u.fragment,Parsed(target.read_text()).ids,href)
  for target in ['site/v4.html','site/research/wealth-inequality-2026-11-04/index.html']:
   self.assertIn('sharpe.html',(ROOT/target).read_text())
 def test_hypothetical_arithmetic(self):
  rf=D('.02');ma=D('.08');mb=D('.10');sa=D('.10');sb=D('.20');lam=sb/sa
  self.assertEqual((ma-rf)/sa,D('.6'))
  self.assertEqual((mb-rf)/sb,D('.4'))
  ideal=lam*ma-(lam-1)*rf
  costly=lam*ma-(lam-1)*D('.04')
  self.assertEqual(ideal,D('.14'));self.assertEqual(costly,D('.12'))
  self.assertEqual((costly-rf)/(lam*sa),D('.5'))
  for rho,want in [(1,10),(.5,math.sqrt(75)),(0,math.sqrt(50)),(-.5,5)]:
   self.assertAlmostEqual(math.sqrt(.5**2*10**2*2+2*.5*.5*rho*10*10),want)
 def test_original_charts_are_accessible(self):
  self.assertEqual(sum(t=='figure' and a.get('class')=='original-chart' for t,a in self.p.tags),3)
  self.assertEqual(sum(t=='svg' and a.get('role')=='img' for t,a in self.p.tags),1)
  self.assertIn('Exact values behind the hypothetical paths',self.text)
  self.assertIn('scope="row"',self.text);self.assertIn('scope="col"',self.text)
  for t,a in self.p.tags:
   if 'data-chart-value' not in a:continue
   width=D(re.search(r'width:([\d.]+)%',a['style'])[1]);v=D(a['data-chart-value']);m=D(a['data-chart-max'])
   self.assertLess(abs(width-v/m*100),D('.000001'))
  self.assertIn('@media(max-width:680px)',self.text)
  self.assertIn('@media print',self.text)
 def test_source_version_and_cost_warnings(self):
  for phrase in ['0.79','about 1.7 to 1','0.76','about 1.6 to 1','serial correlation','forced liquidation','total returns','funding','actual dates and exchange rates','not a calculated Sharpe ratio','unnamed $ currency']:
   self.assertIn(phrase,self.text)
if __name__=='__main__':unittest.main()

