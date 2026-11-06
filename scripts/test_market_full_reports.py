"""Public full-article publication and privacy regression checks."""
import unittest,json,hashlib,re
from pathlib import Path
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parents[1]/'site'
ROUTES=['us-earnings-cash-flow-2026-11-06','bond-research-review-2026-11-06']
class Tags(HTMLParser):
 def __init__(self):super().__init__();self.ids=[];self.links=[];self.images=[]
 def handle_starttag(self,tag,attrs):
  d=dict(attrs)
  if d.get('id'):self.ids.append(d['id'])
  if tag=='a':self.links.append(d.get('href',''))
  if tag=='img':self.images.append(d)
class FullMarketReports(unittest.TestCase):
 def test_receipts_privacy_and_source_links(self):
  for route in ROUTES:
   d=ROOT/'market-understanding'/route;h=(d/'index.html').read_text();m=json.loads((d/'publication.json').read_text());self.assertEqual(hashlib.sha256(h.encode()).hexdigest(),m['html_sha256'])
   for f in m['files']:self.assertEqual(hashlib.sha256((d/f['path']).read_bytes()).hexdigest(),f['sha256']);self.assertEqual((d/f['path']).stat().st_size,f['bytes'])
   for bad in ['Winston Ng','chatgpt.com/c/','libfile_','/mnt/data/','Unpublished compilation','Draft, not published']:self.assertNotIn(bad,h)
   t=Tags();t.feed(h);self.assertFalse(t.images);self.assertEqual(len(t.ids),len(set(t.ids)))
   for link in t.links:
    if link.startswith('#'):self.assertIn(link[1:],t.ids)
 def test_earnings_scope_and_quote_correction(self):
  h=(ROOT/'market-understanding'/ROUTES[0]/'index.html').read_text();self.assertEqual(len(re.findall(r'id="company-[^"]+"',h)),73);self.assertNotIn('−12.5%',h);self.assertIn('−12.6%, Reuters intraday snapshot',h);self.assertIn('Reuters reporting on Amazon Q3 results',h);self.assertIn('US-Earnings-Cash-Flow-2026-11-06.pdf',h)
 def test_bond_rights_and_shared_feed(self):
  h=(ROOT/'market-understanding'/ROUTES[1]/'index.html').read_text();self.assertNotIn('344bp',h);self.assertNotIn('332bp',h);self.assertNotIn('−12bp',h);self.assertIn('Licensed ICE index observations',h);self.assertIn("const LAST_MONTH='2026-10-01'",h);self.assertIn("data/history-fed.json",h)
 def test_navigation_retains_old_editions(self):
  for f in ['v4.html','market-understanding/index.html','research-editions.html']:
   h=(ROOT/f).read_text()
   for route in ROUTES:self.assertIn(route+'/',h)
  self.assertTrue((ROOT/'market-understanding/treasuries-chf-gold-2026-11-06/index.html').is_file())
