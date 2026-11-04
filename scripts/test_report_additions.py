"""Additive-only report preservation, arithmetic, accessible data and source checks."""
from decimal import Decimal as D
from html.parser import HTMLParser
from pathlib import Path
import hashlib, json, re, subprocess, unittest
from build_report_additions import make, strip_additions, START, END
ROOT=Path(__file__).resolve().parents[1]
class Parsed(HTMLParser):
 def __init__(self,s):
  super().__init__();self.ids=[];self.links=[];self.bars=[];self.tags=[];self.feed(s)
 def handle_starttag(self,t,attrs):
  a=dict(attrs);self.tags.append((t,a))
  if 'id'in a:self.ids.append(a['id'])
  if t=='a':self.links.append(a.get('href',''))
  if 'data-ra-value'in a:self.bars.append(a)
class Additions(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.manifest=json.loads((ROOT/'scripts/report_additions_manifest.json').read_text());cls.output=make()
 def test_five_reports_retain_every_original_byte(self):
  self.assertEqual(len(self.manifest['reports']),5)
  for path,digest in self.manifest['reports'].items():
   with self.subTest(path=path):
    text=(ROOT/'site'/path).read_text()
    self.assertEqual(hashlib.sha256(strip_additions(text).encode()).hexdigest(),digest)
    self.assertEqual(text.count(START),1);self.assertEqual(text.count(END),1)
    self.assertEqual(text.count('id="research-additions"'),1)
    self.assertIn(self.output[path],text)
 def test_all_new_bar_scales_and_visible_data(self):
  charts=tables=0
  for path,addon in self.output.items():
   p=Parsed(addon);charts+=sum(t=='figure'for t,a in p.tags);tables+=sum(t=='table'for t,a in p.tags)
   for b in p.bars:
    value,maximum=D(b['data-ra-value']),D(b['data-ra-max']);width=D(re.search(r'width:([\d.]+)%',b['style'])[1])
    self.assertGreaterEqual(value,0);self.assertGreater(maximum,0);self.assertLessEqual(value,maximum)
    self.assertLess(abs(width-value/maximum*100),D('.00000001'))
   self.assertIn('scope="row"',addon);self.assertIn('scope="col"',addon);self.assertIn('<caption>',addon)
   self.assertIn('tabindex="0" role="region"',addon);self.assertIn('class="ra-data" open',addon)
   self.assertNotRegex(addon,r'<(?:script|img|iframe)\b')
  self.assertEqual(charts,6);self.assertEqual(tables,6)
 def test_full_page_anchor_integrity_and_local_assets(self):
  for path in self.output:
   page=ROOT/'site'/path;p=Parsed(page.read_text());self.assertEqual(len(p.ids),len(set(p.ids)),path)
   for href in p.links:
    if href.startswith('#'):self.assertIn(href[1:],p.ids,path+' '+href)
   for tag,a in p.tags:
    ref=a.get('src') if tag in ['script','img'] else a.get('href') if tag=='link' else None
    if ref and not re.match(r'(https?:|data:|#)',ref):self.assertTrue((page.parent/ref.split('?')[0]).exists(),ref)
 def test_original_cash_and_stress_arithmetic(self):
  s=self.output['research/wealth-inequality-2026-11-04/index.html']
  self.assertEqual(D(125000)-D(1750000)*D('.025'),81250)
  self.assertEqual(D(125000)-D(1750000)*D('.045'),46250)
  self.assertEqual(D(1750000)-D('.7')*D(2500000)*D('.9'),175000)
  for value in ['87500.00','175000.0','350000.0']:
   self.assertTrue(any(D(a['data-ra-value'])==D(value) for a in Parsed(s).bars))
  self.assertIn('currency not specified by the source',s)
 def test_alphabet_quarters_and_cpf_scenarios(self):
  s=self.output['research/googl/index.html']
  for value in ['24.551','10.116','-5.855','-9.065']:self.assertIn(value,s)
  self.assertIn('unaudited',s);self.assertIn('non-GAAP',s)
  s=self.output['research/cpf-oa-temasek-2070-2026-11-04/index.html']
  for fx in ['1.2','1.275','1.35']:
   self.assertIn(f'{D(7800)*D(fx):,.2f}',s)
   self.assertIn(f'{D(312000)*D(fx)+D("271.25"):,.2f}',s)
  self.assertIn('conditional on repayment',s);self.assertIn('Coupo',s)
 def test_retirement_and_fx_limits(self):
  s=self.output['research/cpf-life-after-55-2026-11-04/index.html']
  for value in ['does not change when the calculator','4% net','immediately before','not a probability','not a CPF or insurer']:self.assertIn(value,s)
  s=self.output['market-understanding/index.html'];bars=Parsed(s).bars
  expected=[D('1.056')*(1-D(n)/100)*100-100 for n in range(6)]
  self.assertEqual([D(a['data-ra-value']) for a in bars],expected)
 def test_distinct_style_scoping_and_privacy(self):
  css=(ROOT/'site/research-additions.css').read_text()
  for phrase in ['background:#eceeff','@media(max-width:650px)','overflow-x:auto','focus-visible','@media print','prefers-reduced-motion']:self.assertIn(phrase,css)
  for addon in self.output.values():self.assertNotRegex(addon,r'libfile_|/workspace/|chatgpt\.com/c/|sediment:|data:image|Client -')
 def test_print_control_harness(self):
  result=subprocess.check_output(['node',str(ROOT/'scripts/test_report_additions.cjs')],text=True)
  self.assertIn('print and chapter controls passed',result)
if __name__=='__main__':unittest.main()
