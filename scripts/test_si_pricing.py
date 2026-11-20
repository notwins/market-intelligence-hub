import hashlib,json,re,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class SIReferenceTests(unittest.TestCase):
 def test_public_projection(self):
  path=ROOT/'site/data/si-pricing-reference.json';text=path.read_text(encoding='utf-8');d=json.loads(text)
  self.assertEqual(d['classification'],'rounded_historical_reference');self.assertIs(d['live_quotes'],False)
  self.assertEqual(d['record_count'],246);self.assertEqual(len(d['rows']),246)
  allowed={'reference','shares','source_date','currency','tenor_source_value','coupon_pct','strike_pct','ko_pct','ki_pct','additional_review'}
  for i,r in enumerate(d['rows'],1):
   self.assertEqual(set(r),allowed if i<=225 else allowed|{'source_kind','tenor_unit','coupon_basis'});self.assertEqual(r['reference'],f'SI-{i:03d}')
   if r['source_date'] is not None:
    self.assertLessEqual('2026-10-30',r['source_date']);self.assertLessEqual(r['source_date'],'2026-11-13')
   for k in ['coupon_pct','strike_pct','ko_pct','ki_pct']:self.assertIs(type(r[k]),int)
  self.assertEqual(sum(r['additional_review'] for r in d['rows']),d['additional_review_count'])
  self.assertEqual(sum(r['additional_review'] for r in d['rows'][:225]),13)
  self.assertEqual(d['tenor_unit'],'unconfirmed');self.assertEqual(d['coupon_basis'],'unconfirmed')
  self.assertEqual(d['rounding'],{'unit':'whole_percentage_point','strike':'up','ko':'up','ki':'up','coupon':'down'})
  self.assertIsNone(re.search(r'(?<![A-Z0-9])[A-Z]{2}[A-Z0-9]{9}[0-9](?![A-Z0-9])',text))
  for forbidden in ['IMG_609','source_excel_row','primary_image','corroborating_image','account_id','client_name','isin','stepdown']:
   self.assertNotIn(forbidden,text.lower() if forbidden.islower() else text)
 def test_append_preserves_history_and_new_terms(self):
  d=json.loads((ROOT/'site/data/si-pricing-reference.json').read_text(encoding='utf-8'))
  prior=json.dumps(d['rows'][:225],sort_keys=True,separators=(',',':')).encode()
  self.assertEqual(hashlib.sha256(prior).hexdigest(),'6e72ec679556f4c66f3a45c6feb5ad72bf5592a88da29137b7ae0674da357bcf')
  usd,sgd=d['rows'][225:236],d['rows'][236:]
  self.assertEqual([r['strike_pct'] for r in usd],[71,72,73,75,76,78,80,82,85,89,94])
  self.assertEqual([r['strike_pct'] for r in sgd],[78,79,81,82,84,86,89,92,96,101])
  self.assertEqual([r['ko_pct'] for r in usd],list(range(100,89,-1)))
  self.assertEqual([r['ko_pct'] for r in sgd],list(range(100,90,-1)))
  self.assertEqual({r['ki_pct'] for r in usd},{70});self.assertEqual({r['ki_pct'] for r in sgd},{75})
  self.assertEqual({r['currency'] for r in usd},{'USD'});self.assertEqual({r['currency'] for r in sgd},{'SGD'})
  self.assertEqual({r['source_date'] for r in usd},{'2026-11-13'})
  for r in sgd:
   self.assertIsNone(r['source_date']);self.assertIs(r['additional_review'],True)
  for r in usd+sgd:
   self.assertEqual(r['shares'],['NVDA','TSM']);self.assertEqual(r['coupon_pct'],8)
   self.assertEqual(r['tenor_source_value'],11);self.assertEqual(r['tenor_unit'],'months')
   self.assertEqual(r['coupon_basis'],'per_annum');self.assertEqual(r['source_kind'],'indicative_pricing')
 def test_step_down_metadata_matches_pricing_screen_rows(self):
  d=json.loads((ROOT/'site/data/si-pricing-reference.json').read_text(encoding='utf-8'))
  self.assertEqual(d['ko_step_down_pp'],{f'SI-{i:03d}':1.5 for i in range(226,247)})
 def test_placement_and_original_exclusion(self):
  tools=(ROOT/'site/v4-tools.js').read_text();self.assertIn("['si','▧ SI Pricing']",tools)
  self.assertIn("if(X.historyTab==='si')",tools)
  public=[p.name for p in (ROOT/'site').rglob('*') if p.is_file()]
  self.assertNotIn('Structured_Investment_Reader.html',public)
  self.assertNotIn('FinIQ_SI_225_Rows_PHOTO_QC_Pricing_Locked.xlsx',public)
if __name__=='__main__':unittest.main()
