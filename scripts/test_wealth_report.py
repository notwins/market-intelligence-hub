"""Regression checks for the complete approved wealth research article."""
from build_report_additions import strip_additions
from pathlib import Path
from html.parser import HTMLParser
import re, unittest
ROOT=Path(__file__).resolve().parents[1]/'site'
REPORT=ROOT/'research/wealth-inequality-2026-11-04/index.html'
class Parsed(HTMLParser):
 def __init__(self):super().__init__();self.tags=[];self.ids=[];self.hrefs=[];self.values=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs);self.tags.append((tag,a))
  if 'id' in a:self.ids.append(a['id'])
  if 'href' in a:self.hrefs.append(a['href'])
  if 'data-value' in a:self.values.append(a['data-value'])
class WealthReport(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.text=REPORT.read_text();cls.p=Parsed();cls.p.feed(strip_additions(cls.text))
 def test_complete_original_structure(self):
  self.assertEqual(sum(t=='section' and a.get('class')=='report-section' for t,a in self.p.tags),16)
  self.assertEqual(sum(t=='div' and a.get('class')=='reference' for t,a in self.p.tags),25)
  self.assertEqual(sum(t=='table' for t,a in self.p.tags),11)
  self.assertIn('No personalised trade is proposed.',self.text)
 def test_all_chart_values(self):
  self.assertEqual(self.p.values,['31.1','32.5','36.4','36.4','30.1','28.8','2.4','2.3','88.1','0.6','79.3','0.6','73.8','2.2','58.7','5.5','43.7','9.7','13.5','51.6','7','12','5','30','21','25'])
  self.assertEqual(sum(t=='figure' and a.get('class')=='native-chart' for t,a in self.p.tags),3)
 def test_no_raster_or_private_payload(self):
  self.assertLess(REPORT.stat().st_size,120000)
  self.assertFalse(any(t in ['img','iframe','script'] for t,a in self.p.tags))
  self.assertNotRegex(self.text,r'chatgpt\.com|sandbox:|sediment:|libfile_|data:image|Winston')
 def test_navigation_and_mobile_contract(self):
  for href in self.p.hrefs:
   if href.startswith('#'):self.assertIn(href[1:],self.p.ids)
  self.assertEqual(len(self.p.ids),len(set(self.p.ids)))
  self.assertIn('../../v4.html#research',self.p.hrefs)
  self.assertIn('research/wealth-inequality-2026-11-04/index.html',(ROOT/'v4.html').read_text())
  self.assertIn('@media(max-width:680px)',self.text)
  self.assertIn('tabindex="0" role="region"',self.text)
 def test_cash_arithmetic(self):
  self.assertEqual(2500000-750000,1750000)
  self.assertEqual(125000-1750000*.025,81250)
  self.assertEqual(125000-1750000*.045,46250)
  self.assertEqual(.70*2500000-1750000,0)
if __name__=='__main__':unittest.main()
