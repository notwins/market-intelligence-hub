import json
from pathlib import Path
import subprocess
import unittest
from import_share_static import convert

ROOT=Path(__file__).resolve().parents[1]
class ShareStaticTests(unittest.TestCase):
 def row(self,**fields):
  return {'row':2,'A':'TEST US','B':'Example company','K':'TEST','G':'New York Stock Exchange','D':'USD','E':'Example company profile.','F':'0','J':'1000000','L':'1990','C':'10','I':'10','M':'10000000',**fields}
 def test_exact_listing(self):
  r,reason=convert(self.row());self.assertIsNone(reason);self.assertEqual(r['id'],'TEST US');self.assertEqual(r['employees'],0);self.assertIsNone(r['cachedFinancials']['marketCapCurrency']);self.assertIsNone(r['cachedFinancials']['asOf'])
 def test_hk_leading_zeros(self):
  r,_=convert(self.row(A='939 HK',K='0939',G='Hong Kong Stock Exchange',D='HKD'));self.assertIn('0939.HK',r['aliases']);self.assertIn('939 HK',r['aliases'])
 def test_wrong_resolved_listing_is_excluded(self):
  for fields in [dict(A='BRK/B US',K='BRK',G='Bucharest Stock Exchange',D='RON'),dict(A='600519 CH',K='CH',G='TSX Venture Exchange',D='CAD'),dict(K='WRONG'),dict(D='HKD')]:
   with self.subTest(fields=fields):self.assertIsNone(convert(self.row(**fields))[0])
 def test_excel_errors_and_blank_are_not_zero(self):
  self.assertEqual(convert(self.row(A=None))[1],'blank_row');self.assertIsNone(convert(self.row(K='#VALUE!'))[0]);r,_=convert(self.row(F='#VALUE!',L='#N/A',M=None));self.assertIsNone(r['employees']);self.assertIsNone(r['yearIncorporated']);self.assertIsNone(r['cachedFinancials']['marketCap'])
 def test_linked_entity_must_agree(self):
  self.assertIsNone(convert(self.row(rich={'ExchangeID':'XNYS','Ticker symbol':'OTHER','Currency':'USD'}))[0])
 def test_published_projection(self):
  d=json.loads((ROOT/'site/data/share-static.json').read_text(encoding='utf-8'));self.assertEqual(len(d['records']),774);ids={r['id'] for r in d['records']};self.assertTrue({'MSFT US','PANW US','NVDA US','939 HK'}<=ids);self.assertFalse({'BRK/B US','600519 CH','HEN GY','MPACT SP'}&ids)
  self.assertEqual(d['validation']['sourceRows'],d['validation']['accepted']+d['validation']['excluded']);self.assertIsNone(d['asOf']);self.assertEqual(Path(d['sourceFile']).name,d['sourceFile']);self.assertFalse('C:\\\\Users' in json.dumps(d),'Private input paths must not be published')
 def test_shared_reader_and_consumers(self):
  subprocess.run(['node','scripts/test_share_static.cjs'],cwd=ROOT,check=True)

if __name__=='__main__':unittest.main()
