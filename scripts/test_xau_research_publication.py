"""Original XAU research edition: public scope, links and byte receipts."""
import hashlib,json,re,unittest,zipfile
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
ROOT=Path(__file__).resolve().parents[1];SITE=ROOT/'site'
ROUTE='research/xau-gold-outlook-2026-11-06';REPORT=SITE/ROUTE
class Page(HTMLParser):
 def __init__(self,text):super().__init__();self.ids=[];self.links=[];self.tags=[];self.feed(text)
 def handle_starttag(self,tag,attrs):
  a=dict(attrs);self.tags.append(tag)
  if 'id' in a:self.ids.append(a['id'])
  if tag=='a':self.links.append(a.get('href',''))
class XAUPublicationTests(unittest.TestCase):
 def setUp(self):self.raw=(REPORT/'index.html').read_bytes();self.text=self.raw.decode();self.p=Page(self.text)
 def test_receipts_and_downloads(self):
  m=json.loads((REPORT/'publication.json').read_text());self.assertEqual(hashlib.sha256(self.raw).hexdigest(),m['html_sha256'])
  self.assertEqual(m['pdf_pages'],24);self.assertEqual(m['slides_per_deck'],5)
  self.assertEqual(self.text.count('class="sectioncard"'),16)
  self.assertEqual(len(m['files']),3)
  for row in m['files']:
   f=REPORT/row['path'];self.assertEqual(f.stat().st_size,row['bytes']);self.assertEqual(hashlib.sha256(f.read_bytes()).hexdigest(),row['sha256'])
   if f.suffix=='.pdf':self.assertTrue(f.read_bytes().startswith(b'%PDF-'))
   else:
    with zipfile.ZipFile(f) as z:
     self.assertEqual(len([n for n in z.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml',n)]),5)
     self.assertFalse(any(n.startswith('ppt/media/') for n in z.namelist()))
     for n in z.namelist():
      if n.endswith(('.xml','.rels')):self.assertNotRegex(z.read(n).decode(),r'(?i)Winston Ng|mailto:|wa\.me/|chatgpt\.com/c/|sharepoint|1drv\.ms')
 def test_public_scope_and_legal_footer(self):
  for term in ['Winston Ng','mailto:','wa.me/','libfile_','/workspace/','data:image','Research Explained','chatgpt.com/c/']:
   self.assertNotIn(term,self.text)
  self.assertFalse(set(self.p.tags)&{'img','image','iframe','embed','object'})
  self.assertEqual(self.text.count('MIH_LEGAL_FOOTER_V1'),1)
  for term in ['Not personalised financial advice','legal/terms.html','legal/privacy.html','legal/risk-disclosures.html','v4.html#research']:
   self.assertIn(term,self.text)
 def test_navigation_and_sources(self):
  self.assertEqual(len(self.p.ids),len(set(self.p.ids)))
  for link in self.p.links:
   u=urlsplit(link)
   if u.scheme or u.netloc:
    self.assertEqual(u.scheme,'https')
    if u.hostname=='notwins.github.io':
     p=u.path.removeprefix('/market-intelligence-hub/');target=SITE/unquote(p)
     if target.is_dir():target=target/'index.html'
     self.assertTrue(target.is_file(),link)
   elif not u.path:
    if u.fragment:self.assertIn(unquote(u.fragment),self.p.ids)
   else:self.assertTrue((REPORT/unquote(u.path)).exists(),link)
  self.assertIn('Earlier syndicated Reuters version',self.text)
  hub=(SITE/'v4.html').read_text();self.assertEqual(hub.count('id="xau-research-20261106"'),1)
  self.assertIn(ROUTE+'/index.html',(ROOT/'scripts/build_site_search.py').read_text())
  self.assertIn(ROUTE+'/',(SITE/'site-map.html').read_text())
 def test_sgd_return_arithmetic(self):
  self.assertAlmostEqual((4400*1.25/(4000*1.3)-1)*100,5.769230769230771)
if __name__=='__main__':unittest.main()
