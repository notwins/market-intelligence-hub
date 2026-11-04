"""Presentation-only markup must preserve all original research text and links."""
from build_report_additions import strip_additions
import hashlib
import unittest
from html.parser import HTMLParser
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class Evidence(HTMLParser):
 def __init__(self):super().__init__();self.text=[];self.keywords=[];self.conclusions=0;self.links=[]
 def handle_data(self,s):self.text.append(s)
 def handle_starttag(self,t,attrs):
  a=dict(attrs)
  if a.get('class')=='mu-keyword':self.keywords.append(t)
  if a.get('class')=='mu-conclusion':self.conclusions+=1
  if t=='a':self.links.append(a.get('href'))
class TestReadingEmphasis(unittest.TestCase):
 def test_source_text_is_unchanged(self):
  p=Evidence();p.feed(strip_additions((ROOT/'site/market-understanding/index.html').read_text()))
  self.assertEqual(hashlib.sha256(''.join(p.text).encode()).hexdigest(),'9d0d92f894f663ea4bd1ff7dd9c8690f8f0a3251ea9262ae78d4a95e822eb22c')
  self.assertEqual(p.conclusions,45);self.assertEqual(len(p.keywords),73);self.assertEqual(set(p.keywords),{'strong'})
  self.assertTrue(any('mas.gov.sg' in (u or '') for u in p.links));self.assertTrue(any('am.jpmorgan.com' in (u or '') for u in p.links))
 def test_saved_context_not_invented(self):
  text=(ROOT/'site/headline-explorer.js').read_text();self.assertIn('Key takeaway · saved context',text);self.assertIn("<strong>'+esc(context)+'</strong>",text)
  text=(ROOT/'site/v4.html').read_text();self.assertIn('Key takeaway · saved analysis',text);self.assertIn('<strong>${esc(x.implication)}</strong>',text)
 def test_print_emphasis_and_no_new_external_assets(self):
  css=(ROOT/'site/market-understanding/market-understanding.css').read_text();self.assertIn('.mu-keyword',css);self.assertIn('print-color-adjust:exact',css);self.assertNotIn('@import',css)
 def test_conclusions_use_sentence_case_and_body_size(self):
  css=(ROOT/'site/market-understanding/market-understanding.css').read_text()
  self.assertIn('font-size:inherit;letter-spacing:normal;text-transform:none;font-weight:700',css)
if __name__=='__main__':unittest.main()
