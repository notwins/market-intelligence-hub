import json,re,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class SIReferenceTests(unittest.TestCase):
 def test_public_projection(self):
  path=ROOT/'site/data/si-pricing-reference.json';text=path.read_text();d=json.loads(text)
  self.assertEqual(d['classification'],'rounded_historical_reference');self.assertIs(d['live_quotes'],False)
  self.assertEqual(d['record_count'],225);self.assertEqual(len(d['rows']),225)
  allowed={'reference','shares','source_date','currency','tenor_source_value','coupon_pct','strike_pct','ko_pct','ki_pct','additional_review'}
  for i,r in enumerate(d['rows'],1):
   self.assertEqual(set(r),allowed);self.assertEqual(r['reference'],f'SI-{i:03d}')
   self.assertLessEqual('2026-10-30',r['source_date']);self.assertLessEqual(r['source_date'],'2026-11-05')
   for k in ['coupon_pct','strike_pct','ko_pct','ki_pct']:self.assertIs(type(r[k]),int)
  self.assertEqual(sum(r['additional_review'] for r in d['rows']),13)
  self.assertEqual(d['tenor_unit'],'unconfirmed');self.assertEqual(d['coupon_basis'],'unconfirmed')
  self.assertEqual(d['rounding'],{'unit':'whole_percentage_point','strike':'up','ko':'up','ki':'up','coupon':'down'})
  self.assertIsNone(re.search(r'(?<![A-Z0-9])[A-Z]{2}[A-Z0-9]{9}[0-9](?![A-Z0-9])',text))
  for forbidden in ['IMG_609','source_excel_row','primary_image','corroborating_image','account_id','client_name','isin','stepdown']:
   self.assertNotIn(forbidden,text.lower() if forbidden.islower() else text)
 def test_placement_and_original_exclusion(self):
  tools=(ROOT/'site/v4-tools.js').read_text();self.assertIn("['si','▧ SI Pricing']",tools)
  self.assertIn("if(X.historyTab==='si')",tools)
  public=[p.name for p in (ROOT/'site').rglob('*') if p.is_file()]
  self.assertNotIn('Structured_Investment_Reader.html',public)
  self.assertNotIn('FinIQ_SI_225_Rows_PHOTO_QC_Pricing_Locked.xlsx',public)
if __name__=='__main__':unittest.main()
