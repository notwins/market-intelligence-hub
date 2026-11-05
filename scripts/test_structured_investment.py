"""Privacy, model, page structure and non-executable teaching-terms checks."""
from pathlib import Path
from html.parser import HTMLParser
import re, subprocess, unittest
ROOT=Path(__file__).resolve().parents[1]
PAGE=ROOT/'site/market-understanding/structured-investment-hypothetical'
class Parser(HTMLParser):
 def __init__(self,text):
  super().__init__();self.ids=[];self.assets=[];self.links=[];self.feed(text)
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id'in a:self.ids.append(a['id'])
  if tag in ['script','link']:self.assets.append(a.get('src')or a.get('href'))
  if tag=='a':self.links.append(a.get('href',''))
class StructuredInvestment(unittest.TestCase):
 def test_model_and_interactions(self):
  out=subprocess.check_output(['node',str(ROOT/'scripts/test_structured_investment.cjs')],text=True)
  self.assertIn('checks passed',out)
 def test_public_files_contain_no_source_payload_or_transmission(self):
  self.assertEqual({p.name for p in PAGE.iterdir()},{'index.html','app.js','model.js','style.css','presentations'})
  combined='\n'.join(p.read_text()for p in PAGE.iterdir() if p.is_file())
  self.assertNotRegex(combined,r'FinIQ|IMG_609|Winston|source_excel_row|PHOTO_ONLY|libfile_|/workspace/|chatgpt\.com/c/|primary_image|corroborating_image')
  self.assertNotRegex(combined,r'\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage)\b')
  self.assertIn("connect-src 'none'",combined)
  self.assertLess(sum(p.stat().st_size for p in PAGE.iterdir() if p.is_file()),50000)
 def test_disclosures_assets_and_responsive_layout(self):
  text=(PAGE/'index.html').read_text();p=Parser(text)
  self.assertEqual(len(p.ids),len(set(p.ids)))
  for a in p.assets:self.assertTrue((PAGE/a).is_file(),a)
  for a in p.links:
   if a.startswith('#'):self.assertIn(a[1:],p.ids)
  for phrase in ['All dates and investment terms here are invented','whole percentage points','Tenor (months)','annual rate','Live pricing needs','Capital may be at risk','No files are uploaded or imported']:
   self.assertIn(phrase,text)
  css=(PAGE/'style.css').read_text()
  for phrase in ['@media(max-width:580px)','overflow-x:auto',':focus-visible','@media print','prefers-reduced-motion']:
   self.assertIn(phrase,css)
if __name__=='__main__':unittest.main()
