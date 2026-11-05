"""Preserve the corrected report and bind downloads to audited public packages."""
from io import BytesIO
from pathlib import Path
from xml.etree import ElementTree as E
import hashlib
import json
import re
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
A = ROOT / 'site/market-understanding/creditworthiness-2026-11-05'
PRIVATE = r'(?i)(libfile_|/workspace/|sandbox:|chatgpt\.com/c/|sediment:|file:///|onedrive\.live\.com|turn\d+(?:search|file)|api[_-]?key\s*[=:])'
EXPECTED = {
 'Creditworthiness_Financial_Briefing_Public.pptx': '2f5153a062c479c141188234f06795ba272be94a77c344220156c54bc970f361',
 'Creditworthiness_Clear_Visual_Story_Public.pptx': '80a0ce5ba0b5c59b7abb891511be6ce7a8cbc9c44bc2c70980f853fdc187d148',
}

class CreditPresentations(unittest.TestCase):
 def setUp(self):
  self.m = json.loads((A / 'publication.json').read_text())['presentations']

 def test_exact_audited_downloads(self):
  self.assertEqual(len(self.m['files']), 2)
  self.assertEqual(set(p.name for p in (A/'presentations').iterdir()), set(EXPECTED))
  page = (A/'index.html').read_text()
  for f in self.m['files']:
   data = (A/f['path']).read_bytes()
   self.assertEqual(len(data), f['bytes'])
   self.assertEqual(hashlib.sha256(data).hexdigest(), f['sha256'])
   self.assertEqual(f['sha256'], EXPECTED[Path(f['path']).name])
   self.assertIn('href="'+f['path']+'" download', page)
   with zipfile.ZipFile(BytesIO(data)) as z:
    names = z.namelist()
    slides = [n for n in names if re.fullmatch(r'ppt/slides/slide\d+\.xml', n)]
    notes = [n for n in names if re.fullmatch(r'ppt/notesSlides/notesSlide\d+\.xml', n)]
    charts = [n for n in names if re.fullmatch(r'ppt/(?:slides/)?charts/chart\d+\.xml', n)]
    self.assertEqual(len(slides), 5)
    self.assertEqual(len(notes), 5)
    self.assertEqual(len(charts), f['native_charts'])
    for n in slides:
     self.assertNotEqual(E.fromstring(z.read(n)).get('show'), '0')
    for n in notes:
     xml = E.fromstring(z.read(n))
     words = ' '.join(t.text or '' for t in xml.findall('.//{*}t')).split()
     self.assertGreater(len(words), 200)
     self.assertTrue(xml.findall('.//{*}rPr[@b="1"]'))
     self.assertTrue(xml.findall('.//{*}buChar'))
    for n in names:
     self.assertNotRegex(n, r'(?i)(vbaProject|activeX|comments/|ppt/media/)')
     if n.endswith(('.xml', '.rels')):
      txt = z.read(n).decode()
      self.assertNotRegex(txt, PRIVATE)
      if n.endswith('.rels'): self.assertNotIn('TargetMode="External"', txt)
     if n.endswith('.xlsx'):
      with zipfile.ZipFile(BytesIO(z.read(n))) as b:
       self.assertFalse(any('externalLink' in x for x in b.namelist()))
       for x in b.namelist():
        if x.endswith(('.xml','.rels')): self.assertNotRegex(b.read(x).decode(), PRIVATE)
        if x.startswith('xl/worksheets/') and x.endswith('.xml'):
         self.assertFalse(E.fromstring(b.read(x)).findall('.//{*}f'))
        if x == 'xl/workbook.xml':
         xml = E.fromstring(b.read(x))
         self.assertFalse(xml.findall('.//{*}definedName'))
         for sheet in xml.findall('.//{*}sheet'): self.assertIn(sheet.get('state'), (None, 'visible'))

 def test_report_preserved(self):
  page = (A/'index.html').read_text()
  stripped = re.sub(r'<!-- credit-presentations:start -->.*?<!-- credit-presentations:end -->', '', page, flags=re.S)
  self.assertEqual(hashlib.sha256(stripped.encode()).hexdigest(), self.m['html_sha256_before_download_panel'])
  self.assertEqual(self.m['html_sha256_before_download_panel'], '47085384d6f0961132295d4cc913c4652c9ba2ae207588810e4a3d0927ec1650')
  for name, digest in self.m['preserved_source_files'].items():
   self.assertEqual(hashlib.sha256((A/name).read_bytes()).hexdigest(), digest)
  self.assertEqual(page.count('id="presentations"'), 1)
  self.assertIn('aria-labelledby="presentations-title"', page)
  self.assertIn('not forecasts', page)
  self.assertIn('different fiscal year ends', page)
  self.assertNotRegex((A/'publication.json').read_text(), PRIVATE)
  hub = (ROOT/'site/market-understanding/index.html').read_text()
  self.assertEqual(hub.count('href="creditworthiness-2026-11-05/#presentations"'), 1)

if __name__ == '__main__':
 unittest.main()
