import unittest,json,hashlib,re
from pathlib import Path
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parents[1]/'site'
ROUTES=['research/sti-banks-part2-2026-11-06','research/xau-gold-outlook-2026-11-06-v2','market-understanding/howard-marks-2026-11-06-v2']
class Revisions(unittest.TestCase):
 def test_receipts_privacy_and_navigation(self):
  for route in ROUTES:
   p=ROOT/route;h=(p/'index.html').read_text();m=json.loads((p/'publication.json').read_text());self.assertEqual(hashlib.sha256(h.encode()).hexdigest(),m['html_sha256']);self.assertIn('Report editions',h);self.assertIn('research-editions.html',h)
   for bad in ['Winston Ng','onedrive.live.com','chatgpt.com/api/library','/mnt/data/','libfile_']:self.assertNotIn(bad,h)
   for f in m['files']:self.assertEqual(hashlib.sha256((p/f['path']).read_bytes()).hexdigest(),f['sha256'])
 def test_source_holds_and_companions(self):
  gold=(ROOT/ROUTES[1]/'index.html').read_text();self.assertIn('V2 PDF withheld',gold);self.assertFalse(any((ROOT/ROUTES[1]).glob('*.pdf')));self.assertIn('24-page edition',gold);self.assertIn('34-page edition',gold)
  sti=(ROOT/ROUTES[0]/'index.html').read_text();self.assertIn('Part 1',sti);self.assertIn('sampling method and original retrieval date are unverified',sti);self.assertNotIn('cfo-presentation-3q-2026',sti)
