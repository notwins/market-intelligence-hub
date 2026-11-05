"""Validate the TSM public research page and its original chart assets."""
from html.parser import HTMLParser
from pathlib import Path
import hashlib,json,re,unittest

BASE=Path(__file__).resolve().parent
REPORT=BASE/'tsm-2026-11-05'
if not REPORT.exists():
 REPORT=BASE.parent/'site/research/tsm-2026-11-05'

class Page(HTMLParser):
 def __init__(self,text):
  super().__init__();self.ids=[];self.hrefs=[];self.images=[];self.sections=0;self.tables=0;self.h1=0;self.feed(text)
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.append(a['id'])
  if tag=='a':self.hrefs.append(a.get('href',''))
  if tag=='img':self.images.append(a)
  if tag=='section':self.sections+=1
  if tag=='table':self.tables+=1
  if tag=='h1':self.h1+=1

class TSMPublication(unittest.TestCase):
 def test_completeness_and_hash(self):
  raw=(REPORT/'index.html').read_bytes();t=raw.decode();p=Page(t)
  self.assertEqual(hashlib.sha256(raw).hexdigest(),json.loads((REPORT/'publication.json').read_text())['html_sha256'])
  self.assertEqual(p.sections,10);self.assertEqual(p.tables,13);self.assertEqual(len(p.images),6);self.assertEqual(p.h1,1)
  self.assertEqual(len(p.ids),len(set(p.ids)))
  for href in p.hrefs:
   if href.startswith('#'):self.assertIn(href[1:],p.ids)
  for image in p.images:
   self.assertTrue((REPORT/image['src']).is_file());self.assertTrue(image.get('alt'));self.assertTrue(image.get('width'));self.assertTrue(image.get('height'))
  self.assertEqual(len([x for x in p.hrefs if x.startswith('https://')]),16)
 def test_scope_dates_and_access(self):
  t=(REPORT/'index.html').read_text()
  for blocked in ['/workspace/','sandbox:','libfile_','requester','Private research','Personal holdings','retrieval returned 403','Colour and Tagging Standard','my pitch']:
   self.assertNotIn(blocked,t)
  self.assertNotRegex(t,r'<(?:iframe|embed|object)\b|data:image')
  for required in ['4 November 2026 US close','not a live quote','not Morningstar forecasts','not a catastrophe case','one TSM ADR','complete valuation model']:
   self.assertIn(required.lower(),t.lower())
  for analyst_value in ['534','3,440','0.741','25.9%','34.9%','Wide;','Medium;']:
   self.assertNotIn(analyst_value,t)
 def test_financial_arithmetic(self):
  self.assertAlmostEqual(2402.117-1289.971,1112.146)
  self.assertAlmostEqual(25.932/5,5.1864)
  for rev,margin,pe,target in [(190,.42,20,307.727903748),(220,.49,24,498.843128181),(250,.52,28,701.835569952)]:
   self.assertAlmostEqual(rev*margin/(25.932/5)*pe,target,places=8)

if __name__=='__main__':unittest.main()
