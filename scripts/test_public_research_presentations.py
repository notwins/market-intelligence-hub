"""Audited public decks: exact reviewed bytes, native objects and privacy boundaries."""
from pathlib import Path
from xml.etree import ElementTree as ET
from io import BytesIO
import hashlib,json,re,unittest,zipfile
ROOT=Path(__file__).resolve().parents[1]
FOLDERS=['market-understanding/structured-investment-hypothetical','research/wealth-inequality-2026-11-04']
PATTERN=r'<!-- research-presentations:start -->.*?<!-- research-presentations:end -->'
PRIVATE=r'(?i)(FinIQ|IMG_609|Winston|source_excel_row|PHOTO_ONLY|libfile_|/workspace/|chatgpt\.com/c/|primary_image|corroborating_image|sediment://|sandbox:|file:///|access_token|refresh_token)'
class PublicResearchPresentations(unittest.TestCase):
 def test_reviewed_packages(self):
  for folder in FOLDERS:
   a=ROOT/'site'/folder;m=json.loads((a/'presentations/publication.json').read_text());self.assertEqual(len(m['files']),2)
   for f in m['files']:
    with self.subTest(file=f['path']):
     data=(a/f['path']).read_bytes();self.assertEqual(len(data),f['bytes']);self.assertLess(len(data),100000);self.assertEqual(hashlib.sha256(data).hexdigest(),f['sha256'])
     with zipfile.ZipFile(BytesIO(data)) as z:
      names=z.namelist();slides=[n for n in names if re.fullmatch(r'ppt/slides/slide\d+\.xml',n)];notes=[n for n in names if re.fullmatch(r'ppt/notesSlides/notesSlide\d+\.xml',n)];charts=[n for n in names if re.fullmatch(r'ppt/(?:slides/)?charts/chart\d+\.xml',n)]
      self.assertEqual(len(slides),5);self.assertEqual(len(notes),5);self.assertEqual(len(charts),f['native_charts']);self.assertEqual(sum(z.read(n).count(b'<a:tbl>') for n in slides),f['native_tables'])
      self.assertFalse(any(n.startswith('ppt/media/') or 'vbaProject' in n or 'comments/' in n or 'customXml/' in n for n in names))
      for n in notes:
       xml=z.read(n);txt=' '.join(ET.fromstring(xml).itertext());self.assertGreater(len(txt),300);self.assertIn('SOURCES',txt.upper());self.assertIn(b'b="1"',xml);self.assertIn(b'<a:buChar',xml)
      for n in names:
       if n.endswith(('.xml','.rels')):self.assertNotRegex(z.read(n).decode(),PRIVATE)
       if n.endswith('.xlsx'):
        with zipfile.ZipFile(BytesIO(z.read(n))) as book:
         self.assertFalse(any('externalLink' in v for v in book.namelist()))
         for v in book.namelist():
          if v.endswith(('.xml','.rels')):self.assertNotRegex(book.read(v).decode(),PRIVATE)
 def test_additive_panels_preserve_reports(self):
  for folder in FOLDERS:
   a=ROOT/'site'/folder;m=json.loads((a/'presentations/publication.json').read_text());h=(a/'index.html').read_text();self.assertEqual(h.count('id="presentations"'),1)
   self.assertEqual(hashlib.sha256(re.sub(PATTERN,'',h,flags=re.S).encode()).hexdigest(),m['source_page_sha256_before_download_section'])
   for f in m['files']:self.assertIn('href="'+f['path']+'" download',h)
   self.assertNotRegex(h,PRIVATE)
   if 'sharpe_sha256_before_download_link' in m:
    s=(a/'sharpe.html').read_text();self.assertIn('index.html#presentations',s);self.assertEqual(hashlib.sha256(re.sub(PATTERN,'',s,flags=re.S).encode()).hexdigest(),m['sharpe_sha256_before_download_link'])
 def test_hub_links_are_not_duplicate_cards(self):
  h=(ROOT/'site/market-understanding/index.html').read_text()
  for dest in ['structured-investment-hypothetical/#presentations','../research/wealth-inequality-2026-11-04/#presentations']:self.assertEqual(h.count('href="'+dest+'"'),1)
if __name__=='__main__':unittest.main()
