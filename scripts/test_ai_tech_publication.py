"""Public-edition completeness, restricted-data exclusion and navigation."""
import hashlib,json,re,unittest
from pathlib import Path
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parents[1]
REPORT=ROOT/'site/market-understanding/ai-tech-2026-11-05'
class Page(HTMLParser):
 def __init__(self,text):super().__init__();self.ids=[];self.hrefs=[];self.profiles=0;self.svg=0;self.feed(text)
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.append(a['id'])
  if tag=='a':self.hrefs.append(a.get('href',''))
  if tag=='article' and a.get('class')=='profile':self.profiles+=1
  if tag=='svg':self.svg+=1
class AITechPublicEdition(unittest.TestCase):
 def test_public_content_and_completeness(self):
  raw=(REPORT/'index.html').read_bytes();text=raw.decode();p=Page(text)
  self.assertEqual(hashlib.sha256(raw).hexdigest(),json.loads((REPORT/'publication.json').read_text())['html_sha256'])
  self.assertEqual(p.profiles,40);self.assertEqual(p.svg,6)
  self.assertEqual(re.findall(r'<h2>([0-9]{2}) ',text),[f'{i:02d}' for i in range(1,16)])
  self.assertIn('.chart svg{min-width:1000px;max-height:none}',text)
  self.assertEqual(len(p.ids),len(set(p.ids)))
  for link in p.hrefs:
   if link.startswith('#'):self.assertIn(link[1:],p.ids)
  for private in ['Analyst value','BOS universe rating','Exact upside formula','Price/FVE','/workspace/','sandbox:','libfile_','<metadata']:
   self.assertNotIn(private,text)
  self.assertIn('adapted HTML edition',text)
  self.assertIn('not personalised investment advice',text)
  self.assertNotRegex(text,r'<(?:img|iframe|embed|object)\b|data:image')
 def test_research_explained_link(self):
  index=(ROOT/'site/market-understanding/index.html').read_text()
  self.assertEqual(index.count('href="ai-tech-2026-11-05/"'),1)
  self.assertIn('My thoughts',index)
