"""Bind the public CHF/SGD report and presentations to audited release hashes."""
from io import BytesIO
from pathlib import Path
from xml.etree import ElementTree as E
import hashlib
import json
import re
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
A = ROOT / 'site/market-understanding/mas-snb-2026-11-05'
PRIVATE = r'(?i)(libfile_|/workspace/|sandbox:|chatgpt\.com/c/|sediment:|file:///|onedrive\.live\.com|turn\d+(?:search|file)|api[_-]?key\s*[=:])'
EXPECTED = {
 'CHF_SGD_Financial_Briefing_5_Slides.pptx': 'ab7d5e4926e8bbf0031f5d9c55eb33684de0a1e60df54ccca8ea1c8e112b6897',
 'CHF_SGD_Clear_Visual_Story_5_Slides.pptx': 'd4ff5746675cfac463848b19eb0a9efc77a95bb114a71d08b673b89cfa747f89',
}

class ChfSgdPublication(unittest.TestCase):
 def setUp(self):
  self.m = json.loads((A / 'publication.json').read_text())

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
    self.assertEqual(len([n for n in names if n.endswith('.xlsx')]), f['native_charts'])
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
  stripped = re.sub(r'<!-- chf-sgd-publication:start -->.*?<!-- chf-sgd-publication:end -->', '', page, flags=re.S)
  self.assertEqual(hashlib.sha256(stripped.encode()).hexdigest(), self.m['html_sha256_before_download_panel'])
  self.assertEqual(self.m['html_sha256_before_download_panel'], '353f27cd8d3bdc8b59da752d72db5004d4fe183fb637bc32015c9e356b2045ca')
  self.assertEqual(page.count('id="presentations"'), 1)
  self.assertIn('aria-labelledby="presentations-title"', page)
  self.assertEqual(hashlib.sha256(page.encode()).hexdigest(), self.m['html_sha256'])
  self.assertEqual(len(re.findall(r'<section\b', stripped)), 26)
  self.assertEqual(len(re.findall(r'<svg\b', stripped)), 10)
  self.assertEqual(len(re.findall(r'<table\b', stripped)), 28)
  self.assertEqual(len(self.m['source_dates']), 37)
  self.assertNotRegex(page, PRIVATE + r'|(?i:TradingEconomics|tradingeconomics\.com)')
  self.assertEqual(set(x.name for x in A.iterdir()), {'index.html','publication.json','presentations'})
  self.assertIn('market-understanding/mas-snb-2026-11-05/index.html', (ROOT/'scripts/build_site_search.py').read_text())
  self.assertNotRegex((A/'publication.json').read_text(), PRIVATE)
  hub = (ROOT/'site/market-understanding/index.html').read_text()
  self.assertEqual(hub.count('href="mas-snb-2026-11-05/#presentations"'), 1)

if __name__ == '__main__':
 unittest.main()
