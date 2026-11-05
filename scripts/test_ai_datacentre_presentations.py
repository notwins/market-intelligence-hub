"""Bind the public presentation downloads to their reviewed bytes and scope."""
import hashlib
import json
import re
import unittest
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ARTICLE = ROOT / 'site/market-understanding/ai-data-centres-2026-11-05'
NS = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}

class AIDataCentrePresentations(unittest.TestCase):
    def test_downloads_match_reviewed_files(self):
        record = json.loads((ARTICLE / 'publication.json').read_text())['presentations']
        self.assertEqual(len(record['files']), 2)
        self.assertEqual({f['title'] for f in record['files']}, {'Financial briefing', 'Clear visual story'})
        page = (ARTICLE / 'index.html').read_text()
        self.assertIn('id="presentations"', page)
        self.assertIn('Proprietary valuation estimates and price-based rankings are excluded', page)
        self.assertIn('Proprietary valuation tables and related rankings omitted', record['description'])
        for f in record['files']:
            path = ARTICLE / f['path']
            data = path.read_bytes()
            self.assertIn('href="' + f['path'] + '" download', page)
            self.assertEqual(len(data), f['bytes'])
            self.assertLess(len(data), 100000)
            self.assertEqual(hashlib.sha256(data).hexdigest(), f['sha256'])
            with zipfile.ZipFile(path) as z:
                names = z.namelist()
                slides = [n for n in names if re.fullmatch(r'ppt/slides/slide\d+\.xml', n)]
                notes = [n for n in names if re.fullmatch(r'ppt/notesSlides/notesSlide\d+\.xml', n)]
                charts = [n for n in names if re.fullmatch(r'ppt/(?:slides/)?charts/chart\d+\.xml', n)]
                self.assertEqual(len(slides), 5)
                self.assertEqual(len(notes), 5)
                self.assertEqual(len(charts), f['native_charts'])
                self.assertEqual(sum(z.read(n).count(b'<a:tbl>') for n in slides), f['native_tables'])
                self.assertEqual(len([n for n in names if n.startswith('ppt/embeddings/') and n.endswith('.xlsx')]), 1)
                self.assertFalse(any(n.startswith('ppt/media/') or 'vbaProject' in n or 'comments/' in n for n in names))
                for name in notes:
                    text = ' '.join(ET.fromstring(z.read(name)).itertext())
                    self.assertGreater(len(text), 300)
                for name in names:
                    if name.endswith(('.xml', '.rels')):
                        text = z.read(name).decode('utf-8')
                        self.assertNotRegex(text, r'(?i)(Morningstar|bankofsingapore|turn170view1|buy in stages|Discount to FV|FV last set)')
                        self.assertNotRegex(text, r'(?i)(sediment://|sandbox:|/workspace/|libfile_|chatgpt\.com/c/|file:///|password|access_token|refresh_token)')

    def test_formatted_notes_companion(self):
        from html.parser import HTMLParser
        class Links(HTMLParser):
            def __init__(self): super().__init__(); self.hrefs=[]
            def handle_starttag(self,t,attrs):
                if t=='a': self.hrefs.append(dict(attrs).get('href',''))
        f=json.loads((ARTICLE/'publication.json').read_text())['presentations']['notes_companion']
        data=(ARTICLE/f['path']).read_bytes()
        self.assertEqual(len(data),f['bytes'])
        self.assertEqual(hashlib.sha256(data).hexdigest(),f['sha256'])
        text=data.decode(); self.assertEqual(text.count('<h3>Slide '),10)
        self.assertNotRegex(text,r'(?i)(Morningstar|bankofsingapore|sandbox:|/workspace/|libfile_|chatgpt\.com/c/)')
        links=Links(); links.feed(text)
        self.assertTrue(all('<' not in u and '"' not in u for u in links.hrefs))
        self.assertIn('https://creativecommons.org/licenses/by/4.0/',links.hrefs)

    def test_hub_links_to_presentations(self):
        page = (ROOT / 'site/market-understanding/index.html').read_text()
        self.assertEqual(page.count('href="ai-data-centres-2026-11-05/#presentations"'), 1)

if __name__ == '__main__':
    unittest.main()
