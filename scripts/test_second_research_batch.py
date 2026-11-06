import unittest,json,hashlib,re,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'site'
ROUTES=['research/cpf-life-explained-2026-11-06-v2','market-understanding/creditworthiness-2026-11-06-v2','market-understanding/spx-collars-2026-11-06']
class SecondResearchBatch(unittest.TestCase):
 def test_public_receipts_and_old_editions(self):
  for route in ROUTES:
   p=ROOT/route;raw=(p/'index.html').read_bytes();h=raw.decode();m=json.loads((p/'publication.json').read_text());self.assertEqual(hashlib.sha256(raw).hexdigest(),m['html_sha256']);self.assertIn('Report editions',h);self.assertIn('Earlier',h)
   for marker in ['Winston Ng','onedrive.live.com','libfile_','/mnt/data/','chatgpt.com/api/library']:self.assertNotIn(marker,h)
   for f in m['files']:self.assertEqual(hashlib.sha256((p/f['path']).read_bytes()).hexdigest(),f['sha256'])
 def test_cpf_embedded_model_and_print(self):
  p=ROOT/ROUTES[0];h=(p/'index.html').read_text();embedded=json.loads(re.search(r'<script type="application/json" id="model-data">(.*?)</script>',h,re.S).group(1));standalone=json.loads((p/'CPF_LIFE_Model_Data_public_v2_2026-11-06.json').read_text());self.assertEqual(embedded,standalone);self.assertEqual(len(embedded['monthly']['rows']),481);self.assertIn("addEventListener('beforeprint'",h);self.assertIn("addEventListener('afterprint'",h)
 def test_teaching_labels_and_exact_pdf_hold(self):
  credit=(ROOT/ROUTES[1]/'index.html').read_text();self.assertIn('partial research coverage',credit);self.assertIn('not a current bond-buying list',credit)
  spx=(ROOT/ROUTES[2]/'index.html').read_text();self.assertIn('not executable zero-premium collar quotes',spx);self.assertFalse(list((ROOT/ROUTES[2]).glob('*.pdf')));self.assertIn("b.setAttribute('aria-label',b.title)",spx)
