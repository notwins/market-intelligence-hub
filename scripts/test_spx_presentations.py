"""Bind aggregate-only SPX presentation downloads to audited packages."""
from pathlib import Path
from io import BytesIO
from xml.etree import ElementTree as E
import hashlib,json,re,unittest,zipfile
ROOT=Path(__file__).resolve().parents[1];A=ROOT/'site/market-understanding/spx-floor-cap-2026-11-05'
class SPXPresentations(unittest.TestCase):
 def test_exact_downloads_and_aggregate_workbooks(self):
  m=json.loads((A/'publication.json').read_text())['presentations'];self.assertEqual(len(m['files']),2);page=(A/'index.html').read_text()
  for f in m['files']+[m['formatted_notes']]:
   data=(A/f['path']).read_bytes();self.assertEqual(len(data),f['bytes']);self.assertLess(len(data),100000);self.assertEqual(hashlib.sha256(data).hexdigest(),f['sha256']);self.assertIn('href="'+f['path']+'" download',page)
   with zipfile.ZipFile(BytesIO(data)) as z:
    names=z.namelist()
    for n in names:
     if n.endswith(('.xml','.rels')):self.assertNotRegex(z.read(n).decode(),r'(?i)(libfile_|/workspace/|sandbox:|chatgpt\.com/c/|sediment:|file:///)')
     self.assertNotRegex(n,r'(vbaProject|comments/|ppt/media/|word/embeddings/)')
     if n.endswith('.xlsx'):
      with zipfile.ZipFile(BytesIO(z.read(n))) as b:
       self.assertFalse(any('externalLink' in x for x in b.namelist()))
       for x in b.namelist():
        if x.startswith('xl/worksheets/') and x.endswith('.xml'):self.assertLessEqual(len(E.fromstring(b.read(x)).findall('.//{*}row')),9)
    if f['path'].endswith('.pptx'):
     self.assertEqual(sum(bool(re.fullmatch(r'ppt/slides/slide\d+\.xml',n)) for n in names),5);self.assertEqual(sum(bool(re.fullmatch(r'ppt/notesSlides/notesSlide\d+\.xml',n)) for n in names),5)
     charts=[n for n in names if re.fullmatch(r'ppt/(?:slides/)?charts/chart\d+\.xml',n)];self.assertEqual(len(charts),f['native_charts'])
     for n in charts:
      for c in E.fromstring(z.read(n)).findall('.//{*}numCache/{*}ptCount'):self.assertLessEqual(int(c.attrib['val']),8)
     for n in names:
      if re.fullmatch(r'ppt/notesSlides/notesSlide\d+\.xml',n):self.assertGreater(len(' '.join(E.fromstring(z.read(n)).itertext())),300)
 def test_existing_report_is_unchanged(self):
  p=(A/'index.html').read_text();m=json.loads((A/'publication.json').read_text())['presentations'];stripped=re.sub(r'<!-- spx-presentations:start -->.*?<!-- spx-presentations:end -->','',p,flags=re.S);self.assertEqual(hashlib.sha256(stripped.encode()).hexdigest(),m['html_sha256_before_download_panel']);self.assertEqual(p.count('id="presentations"'),1);self.assertIn('Full historical source series are not included',p)
  h=(ROOT/'site/market-understanding/index.html').read_text();self.assertEqual(h.count('href="spx-floor-cap-2026-11-05/#presentations"'),1)
if __name__=='__main__':unittest.main()
