"""Preservation, public-safe integration and navigation for the Marks reading."""
import hashlib,json,re,unittest,shutil,tempfile
from unittest.mock import patch
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit,unquote
ROOT=Path(__file__).resolve().parents[1]
ARTICLE=ROOT/'site/market-understanding/howard-marks-2026-11-05'
class Page(HTMLParser):
 def __init__(self,text):
  super().__init__();self.ids=[];self.hrefs=[];self.images=[];self.headings=[];self.tables=0;self.feed(text)
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.append(a['id'])
  if tag=='a':self.hrefs.append(a.get('href',''))
  if tag=='img':self.images.append(a)
  if tag=='table':self.tables+=1
class HowardMarksPublication(unittest.TestCase):
 def setUp(self):
  self.html=(ARTICLE/'index.html').read_text();self.page=Page(self.html);self.record=json.loads((ARTICLE/'publication.json').read_text())
 def test_rebuilding_companions_retains_both_categories(self):
  import build_report_additions as build
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);(root/'scripts').mkdir();(root/'site').mkdir()
   shutil.copyfile(ROOT/'scripts/report_additions_manifest.json',root/'scripts/report_additions_manifest.json')
   companions=build.make()
   for relative in companions:
    target=root/'site'/relative;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/'site'/relative,target)
   with patch.object(build,'ROOT',root),patch.object(build,'SITE',root/'site'),patch.object(build,'make',return_value=companions):build.main()
   page=(root/'site/market-understanding/index.html').read_text()
   self.assertEqual(page.count('id="research-readings"'),1);self.assertEqual(page.count('id="published-research"'),1)
   self.assertIn('howard-marks-2026-11-05/',page);self.assertIn('Original research &amp; analysis',page)
 def test_no_image_files_or_embedded_bitmaps(self):
  self.assertFalse(list(ARTICLE.glob('*.pdf')))
  self.assertFalse(list(ARTICLE.glob('*.png')))
  self.assertNotRegex(self.html,r'<(?:img|image)\b|data:image|base64,')
  self.assertLess(len(self.html.encode()),130000)
  self.assertIn('Print / save PDF',self.html)
 def test_original_html_is_preserved(self):
  original=re.sub(r'<!-- market-intel-publication:start -->.*?<!-- market-intel-publication:end -->','',self.html,flags=re.S)
  original=re.sub(r'<!-- native-chart:start -->.*?<!-- native-chart:end -->','',original,flags=re.S)
  original=re.sub(r'<!-- publication-print:start -->.*?<!-- publication-print:end -->','',original,flags=re.S)
  original=re.sub(r'\n/\* Market Intel publication context; original report styles retained\. \*/.*?(?=</style>)','',original,flags=re.S)
  original=re.sub(r'<meta name="description" content="[^"]*">','',original,count=1)
  self.assertEqual(hashlib.sha256(original.encode()).hexdigest(),self.record['html_text_and_layout_sha256'])
 def test_all_sections_charts_sources_and_links(self):
  for i in range(1,19):self.assertIn(f'section-{i:02d}',self.page.ids)
  self.assertEqual(len(self.page.ids),len(set(self.page.ids)));self.assertEqual(len(self.page.images),0)
  from build_howard_marks_charts import charts
  for chart in charts():self.assertIn(chart,self.html)
  self.assertEqual(len(re.findall(r'<svg\b',self.html)),4)
  self.assertGreaterEqual(self.page.tables,12)
  for href in self.page.hrefs:
   if href.startswith('#'):self.assertIn(unquote(href[1:]),self.page.ids)
   elif not urlsplit(href).scheme:
    target=(ARTICLE/unquote(urlsplit(href).path)).resolve();self.assertTrue(target.exists(),href)
  external={h for h in self.page.hrefs if h.startswith('https://')};self.assertEqual(len(external),17)
  self.assertIn('Not an Oaktree publication or endorsement.',self.html)
  self.assertIn('Educational research, not personalised investment advice.',self.html)
  self.assertNotRegex(self.html,r'(?i)(sediment://|sandbox:|chatgpt\.com/(?:c/|library)|libfile_|secretly|my pitch|client\s+account)')
 def test_separate_readings_and_original_research(self):
  page=(ROOT/'site/market-understanding/index.html').read_text()
  readings=page.split('<!-- research-readings:start -->')[1].split('<!-- research-readings:end -->')[0]
  originals=page.split('<!-- published-writeups:start -->')[1].split('<!-- published-writeups:end -->')[0]
  self.assertIn('howard-marks-2026-11-05/',readings);self.assertNotIn('howard-marks-2026-11-05/',originals)
  for path in ['wealth-inequality-2026-11-04/','cpf-oa-temasek-2070-2026-11-04/','cpf-life-after-55-2026-11-04/','research/googl/']:
   self.assertIn(path,originals);self.assertNotIn(path,readings)
  self.assertNotIn('research pitch',originals);self.assertIn('Original research &amp; analysis',originals)
if __name__=='__main__':unittest.main()
