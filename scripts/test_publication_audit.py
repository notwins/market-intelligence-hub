"""Regression checks for the completed research publication audit of 6 Nov 2026."""
import hashlib
import json
import re
import unittest
import zipfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'site'
SLUGS = ['sti-banks-2026-11-06', 'anthropic-ipo-2026-11-05', 'jpm-price-growth-2026-11-05',
         'xau-central-banks-2026-11-05', 'historical-market-events-2026-11-05', 'cpf-life-yield-2026-11-05',
         'pimco-income-bonds-2026-11-06', 'electricity-infrastructure-2026-11-05',
         'oaktree-rates-wayne-dahl-2026-11-05', 'snb-mas-policy-2026-11-05']

class Links(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids=[]; self.links=[]
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if 'id' in a: self.ids.append(a['id'])
        if tag=='a' and 'href' in a: self.links.append(a['href'])

class PublicationAuditTests(unittest.TestCase):
    def test_reports_and_downloads_are_real(self):
        hub=(SITE/'market-understanding/index.html').read_text()
        for slug in SLUGS:
            with self.subTest(slug=slug):
                root=SITE/'research'/slug
                page=root/'index.html'; text=page.read_text(); parsed=Links(); parsed.feed(text)
                self.assertGreater(len(text), 3000)
                self.assertIn('../research/'+slug+'/',hub)
                self.assertEqual(len(parsed.ids),len(set(parsed.ids)), 'Duplicate HTML or SVG IDs')
                manifest=json.loads((root/'publication.json').read_text())
                self.assertEqual(manifest['html_sha256'],hashlib.sha256(page.read_bytes()).hexdigest())
                for row in manifest['files']:
                    f=root/row['path']
                    self.assertEqual(f.stat().st_size,row['bytes'])
                    self.assertEqual(hashlib.sha256(f.read_bytes()).hexdigest(),row['sha256'])
                for link in parsed.links:
                    u=urlsplit(link)
                    self.assertFalse(any(x in u.netloc.lower() for x in ['chatgpt.com','chat.openai.com','1drv.ms','onedrive','sharepoint']),link)
                    self.assertFalse(link.startswith(('sandbox:','file:')),link)
                    if u.scheme or u.netloc: continue
                    if not u.path:
                        if u.fragment:self.assertIn(unquote(u.fragment),parsed.ids,link)
                        continue
                    target=(root/unquote(u.path)).resolve()
                    if target.is_dir():target=target/'index.html'
                    self.assertTrue(target.is_file(),link)
    def test_new_reports_are_searchable(self):
        source=(ROOT/'scripts/build_site_search.py').read_text()
        for slug in SLUGS:self.assertIn('research/'+slug+'/index.html',source)
    def test_companion_rebuild_preserves_new_catalogue(self):
        import shutil,tempfile
        from unittest.mock import patch
        import build_report_additions as build
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); (root/'scripts').mkdir(); (root/'site').mkdir()
            shutil.copyfile(ROOT/'scripts/report_additions_manifest.json',root/'scripts/report_additions_manifest.json')
            companions=build.make()
            for relative in companions:
                target=root/'site'/relative;target.parent.mkdir(parents=True,exist_ok=True)
                shutil.copyfile(SITE/relative,target)
            with patch.object(build,'ROOT',root),patch.object(build,'SITE',root/'site'),patch.object(build,'make',return_value=companions):build.main()
            hub=(root/'site/market-understanding/index.html').read_text()
            for slug in SLUGS:self.assertIn('../research/'+slug+'/',hub)
            self.assertEqual(hub.count('id="research-added-20261106"'),1)
    def test_cpf_slide_integrity(self):
        folder=SITE/'research/cpf-life-yield-2026-11-05/presentations'
        for path in folder.glob('*.pptx'):
            with zipfile.ZipFile(path) as z:
                names=z.namelist()
                self.assertEqual(len([n for n in names if re.fullmatch(r'ppt/slides/slide\d+\.xml',n)]),5)
                self.assertEqual(len([n for n in names if re.fullmatch(r'ppt/notesSlides/notesSlide\d+\.xml',n)]),5)
                for n in names:
                    if n.endswith(('.xml','.rels')):
                        self.assertNotRegex(z.read(n).decode(),r'(?i)https?://[^\s<>"\']*(?:1drv\.ms|sharepoint|onedrive|chatgpt\.com)')
    def test_jpm_no_bulk_source_dataset(self):
        text=(SITE/'research/jpm-price-growth-2026-11-05/index.html').read_text()
        for value in ['id="report-data"','id="download-data"','id="bond-select"']:
            self.assertNotIn(value,text)
        self.assertIn('Public reading edition',text)

if __name__=='__main__': unittest.main()
