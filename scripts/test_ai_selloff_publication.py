"""Public AI selloff report: factual corrections, privacy, links and publication integrity."""
import hashlib,json,re,unittest
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
ROOT=Path(__file__).resolve().parents[1]
REPORT=ROOT/'site/market-understanding/ai-selloff-2026-11-06'
class Page(HTMLParser):
 def __init__(self,text):super().__init__();self.ids=[];self.hrefs=[];self.tags=[];self.feed(text)
 def handle_starttag(self,tag,attrs):
  a=dict(attrs);self.tags.append(tag)
  if 'id' in a:self.ids.append(a['id'])
  if tag=='a':self.hrefs.append(a.get('href',''))
class SelloffPublicationTests(unittest.TestCase):
 def setUp(self):self.raw=(REPORT/'index.html').read_bytes();self.text=self.raw.decode();self.p=Page(self.text)
 def test_report_and_companion_integrity(self):
  m=json.loads((REPORT/'publication.json').read_text())
  self.assertEqual(hashlib.sha256(self.raw).hexdigest(),m['html_sha256'])
  for row in m['files']:
   f=REPORT/row['path'];self.assertEqual(f.stat().st_size,row['bytes']);self.assertEqual(hashlib.sha256(f.read_bytes()).hexdigest(),row['sha256'])
   self.assertTrue(f.read_bytes().startswith(b'%PDF-'))
  self.assertEqual(m['sections'],6)
 def test_public_scope_and_corrections(self):
  for blocked in ['libfile_','/workspace/','chatgpt.com/c/','sandbox:','data:image','Internal_Meeting','house view','market-wrap.com','digital.fidelity.com','6.63 percentage','−0.67%','−3.74%']:
   self.assertNotIn(blocked,self.text)
  self.assertFalse(set(self.p.tags)&{'img','image','iframe','embed','object'})
  self.assertIn('during 5 November trading.',self.text)
  self.assertIn('not personalised investment advice',self.text)
  self.assertIn('four selected sector price indices',self.text)
  for value in ['−22.26%','−17.46%','−16.25%','−17.26%','−16.36%','−9.26%','−3.58%','4.46%','4.59%','4.84%','5.25%']:
   self.assertIn(value,self.text)
 def test_navigation_and_sources(self):
  self.assertEqual(len(self.p.ids),len(set(self.p.ids)))
  self.assertEqual(sum(bool(re.fullmatch(r'source-\d+',i)) for i in self.p.ids),17)
  for link in self.p.hrefs:
   u=urlsplit(link)
   if u.scheme or u.netloc:
    self.assertEqual(u.scheme,'https');self.assertFalse(any(v in u.netloc for v in ['chatgpt','sharepoint','1drv.ms']))
   elif not u.path:
    if u.fragment:self.assertIn(unquote(u.fragment),self.p.ids)
   else:
    f=(REPORT/unquote(u.path)).resolve()
    if f.is_dir():f=f/'index.html'
    self.assertTrue(f.is_file(),link)
  hub=(ROOT/'site/market-understanding/index.html').read_text()
  self.assertEqual(hub.count('id="ai-selloff-report-card"'),1)
  self.assertIn('market-understanding/ai-selloff-2026-11-06/index.html',(ROOT/'scripts/build_site_search.py').read_text())
 def test_arithmetic(self):
  self.assertAlmostEqual((4.46-4.58)*100,-12)
  self.assertAlmostEqual((4.59-4.69)*100,-10)
  self.assertAlmostEqual((4.84-4.90)*100,-6)
  self.assertAlmostEqual((5.25-5.28)*100,-3)
  self.assertAlmostEqual(((4.84-4.46)-(4.90-4.58))*100,6)
if __name__=='__main__':unittest.main()
