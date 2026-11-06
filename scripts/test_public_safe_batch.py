import hashlib,json,re,unittest
from pathlib import Path
from urllib.parse import urlsplit,unquote
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parents[1]; SITE=ROOT/'site'
ROUTES=['research/pimco-income-public-2026-11-07','market-understanding/ai-tech-public-2026-11-07','research/gold-pdf-public-2026-11-07','research/cpf-pdf-public-2026-11-07','market-understanding/spx-pdf-public-2026-11-07','research/wealth-pdf-public-2026-11-07','market-understanding/bond-comparison-2026-11-07','market-understanding/mas-snb-public-2026-11-07','research/snb-mas-public-2026-11-07']
class Links(HTMLParser):
 def __init__(self):super().__init__();self.links=[];self.ids=set()
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.add(a['id'])
  if tag=='a' and 'href'in a:self.links.append(a['href'])
class PublicSafeBatch(unittest.TestCase):
 def test_receipts_links_privacy(self):
  for route in ROUTES:
   with self.subTest(route=route):
    p=SITE/route;h=(p/'index.html').read_text();m=json.loads((p/'publication.json').read_text())
    self.assertEqual(hashlib.sha256(h.encode()).hexdigest(),m['html_sha256']);self.assertIn('Pending further',h)
    self.assertIn('width=device-width',h);self.assertIn('research-editions.html',h);self.assertNotRegex(h,r'<img\b')
    for f in m['files']:
     b=(p/f['path']).read_bytes();self.assertEqual(len(b),f['bytes']);self.assertEqual(hashlib.sha256(b).hexdigest(),f['sha256']);self.assertTrue(b.startswith(b'%PDF-'))
    for bad in ['Winston','chatgpt.com/c/','libfile_','/mnt/data/','/workspace/','sediment://','file_000000']:self.assertNotIn(bad,h)
    parser=Links();parser.feed(h)
    for link in parser.links:
     u=urlsplit(link)
     if u.scheme or u.netloc:continue
     if not u.path:
      if u.fragment:self.assertIn(unquote(u.fragment),parser.ids,link)
      continue
     target=(SITE/u.path.removeprefix('/market-intelligence-hub/')) if u.path.startswith('/market-intelligence-hub/') else (p/u.path).resolve()
     self.assertTrue(target.exists(),f'{route}: {link}')
 def test_register_and_source_search(self):
  d=json.loads((SITE/'data/research-register.json').read_text())
  for route in ROUTES:
   self.assertTrue(any(r['href']==route+'/' and r['state']=='published' for r in d['entries']))
  self.assertEqual(sum(r['state']=='pending' for r in d['entries']),4)
 def test_distinct_fx_and_no_vendor_series(self):
  for route in ROUTES[-2:]:
   h=(SITE/route/'index.html').read_text();self.assertNotIn('currencynews.co.uk',h);self.assertNotIn('tradingeconomics.com',h)
  a=json.loads((SITE/ROUTES[-2]/'publication.json').read_text());b=json.loads((SITE/ROUTES[-1]/'publication.json').read_text());self.assertNotEqual(a['earlier_edition'],b['earlier_edition'])
if __name__=='__main__':unittest.main()
