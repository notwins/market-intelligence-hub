"""Public datacentre edition: completeness, source-data and privacy checks."""
import unittest,json,hashlib,re
from pathlib import Path
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parents[1]
REPORT=ROOT/'site/market-understanding/ai-data-centres-2026-11-05'
class Page(HTMLParser):
 def __init__(self,text):super().__init__();self.ids=[];self.hrefs=[];self.svg=0;self.feed(text)
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.append(a['id'])
  if tag=='a':self.hrefs.append(a.get('href',''))
  if tag=='svg':self.svg+=1
class AIDataCentrePublicEdition(unittest.TestCase):
 def test_complete_public_report(self):
  raw=(REPORT/'index.html').read_bytes();text=raw.decode();p=Page(text)
  self.assertEqual(p.svg,11)
  self.assertEqual(len(p.ids),len(set(p.ids)))
  for a in p.hrefs:
   if a.startswith('#'):self.assertIn(a[1:],p.ids)
  self.assertEqual(hashlib.sha256(raw).hexdigest(),json.loads((REPORT/'publication.json').read_text())['html_sha256'])
  for private in ['Winston','Analyst FV','Discount to FV','FV last set','/workspace/','sandbox:','libfile_','<metadata']:
   self.assertNotIn(private,text)
  self.assertNotRegex(text,r'<(?:img|iframe|embed|object)\b|data:image')
  self.assertIn('not personalised investment advice',text)
  self.assertIn('building-the-modular-foundation-for-ai-factories-with-nvidia-mgx',text)
 def test_public_data_scope(self):
  d=json.loads((REPORT/'public-financial-data.json').read_text())
  self.assertEqual(len(d['core_financials']),40)
  for private in ['/workspace/', 'input_file', 'coordination_note', 'internal definition']:
   self.assertNotIn(private,json.dumps(d))
  self.assertEqual(len(d['power_financials'])+len(d['connectivity_financials']),12)
  for k in ['original_valuation_screen','additional_valuation_screen','technical_corrections','power_corrections']:
   self.assertNotIn(k,d)
  for x in d['core_financials']:
   f=x['financials']
   if all(f.get(k) is not None for k in ['operating_cash_flow','cash_capex','fcf_simple']):self.assertAlmostEqual(f['operating_cash_flow']-f['cash_capex'],f['fcf_simple'],places=5)
 def test_hub_and_search(self):
  index=(ROOT/'site/market-understanding/index.html').read_text()
  self.assertEqual(index.count('href="ai-data-centres-2026-11-05/"'),1)
  self.assertIn('market-understanding/ai-data-centres-2026-11-05/index.html',(ROOT/'scripts/build_site_search.py').read_text())
