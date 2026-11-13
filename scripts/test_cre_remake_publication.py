"""Guard exact reviewed CRE visible bytes and the gated pending-to-published transition."""
import hashlib,json,re,unittest
from pathlib import Path
from validate_research_contracts import Document,validate_document
SITE=Path(__file__).resolve().parents[1]/'site'
FOLDER=SITE/'research/us-cre-refinancing-test-2026-11-08'
VISIBLE_SHA='ac1590093e5857bd3c4283b9aac34e301494e5ea8d7c9a2cd274a8f581b2a543'
class CREPublication(unittest.TestCase):
 def setUp(self):
  self.raw=(FOLDER/'index.html').read_bytes();self.text=self.raw.decode();self.doc=Document(self.text)
  self.contract=json.loads(self.doc.contracts[0]['text']);self.receipt=json.loads((FOLDER/'publication.json').read_text())
  self.row=next(r for r in json.loads((SITE/'data/research-register.json').read_text())['entries'] if r['id']=='pending-us-cre-remake')
 def test_exact_reviewed_visible_bytes_and_receipt(self):
  visible=re.sub(rb'<script type="application/json" id="mih-research-contract">.*?</script>',b'',self.raw,flags=re.S)
  self.assertEqual(hashlib.sha256(visible).hexdigest(),VISIBLE_SHA)
  self.assertEqual(self.receipt['html_sha256'],hashlib.sha256(self.raw).hexdigest())
  self.assertEqual(self.contract['cutoff'],'2026-11-08T18:00:00+08:00');self.assertEqual(self.receipt['as_of'],self.contract['cutoff'])
  self.assertEqual(self.receipt['research_date'],'2026-11-08');self.assertEqual(self.contract['theme'],'05');self.assertEqual(self.contract['route'],'route-010')
 def test_truthful_gate_and_single_record_transition(self):
  standard=json.loads((SITE/'data/colour-templates-v3.json').read_text())
  cleared=all(self.contract['editorial_review'][k] is True for k in ['evidence_checked','semantic_context_checked','accessibility_checked'])
  if cleared:
   validate_document(self.text,standard);self.assertEqual(self.row['state'],'published');self.assertEqual(self.row['href'],'research/us-cre-refinancing-test-2026-11-08/')
   self.assertEqual(self.row['sha256'],self.receipt['html_sha256']);self.assertEqual(self.row['published_date'],self.receipt['publication_date']);self.assertRegex(self.row['published_date'],r'^\d{4}-\d{2}-\d{2}$')
  else:
   with self.assertRaisesRegex(ValueError,'^Editorial review incomplete$'):validate_document(self.text,standard)
   self.assertEqual(self.row['state'],'pending');self.assertIsNone(self.row['href']);self.assertNotIn('sha256',self.row);self.assertNotIn('published_date',self.row);self.assertIsNone(self.receipt['publication_date'])
  rows=json.loads((SITE/'data/research-register.json').read_text())['entries'];self.assertEqual(len([r for r in rows if r['id']=='pending-us-cre-remake']),1)
 def test_content_scope_and_all_registered_visuals(self):
  self.assertEqual([sum(v['kind']==kind for v in self.contract['visuals']) for kind in ['chart','table','diagram']],[4,12,3]);self.assertEqual(len(self.contract['cards']),42)
  self.assertIn('CREFC MarketMetrics, 23 Oct 2026, citing MBA',self.text);self.assertIn('direct access remains blocked',self.text)
  self.assertNotIn("21% of that lender group's balances",self.text);self.assertNotIn('releases/h8/current/',self.text)
  self.assertIn('00:37–00:59',self.text);self.assertIn('15:02–15:26',self.text);self.assertIn('Unresolved evidence gap',self.text)
  self.assertIn('does not classify all CRE loans or banks as high-yield-rated',self.contract['route_rationale'])
 def test_no_unreviewed_report_download_and_public_navigation(self):
  self.assertEqual(self.receipt['files'],[]);self.assertEqual(self.row['assets'],[])
  self.assertEqual({p.name for p in FOLDER.iterdir()},{'index.html','publication.json'})
  self.assertEqual(self.text.count('<!-- MIH_LEGAL_FOOTER_V1 -->'),1)
  for n in self.doc.nodes:
   if n['tag']=='a' and n['attrs'].get('href','').startswith('#'):self.assertIn(n['attrs']['href'][1:],self.doc.by_id)
  for source in self.contract['source_ids']:self.assertRegex(self.doc.by_id[source]['attrs']['href'],r'^https://')
  for page in ['terms','privacy','disclaimer','risk-disclosures','editorial-policy']:self.assertIn('/legal/'+page+'.html',self.text)
  self.assertIn('research/us-cre-refinancing-test-2026-11-08/',(SITE/'research-editions.html').read_text())
  for private in ['winston','libfile_','sediment://','/workspace/','chatgpt.com/c/']:self.assertNotIn(private,self.text.lower())
if __name__=='__main__':unittest.main()
