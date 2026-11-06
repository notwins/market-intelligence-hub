import json,unittest
from pathlib import Path
from build_external_sources import build, ROOT
from extract_recent_sources import canonical_url
class ExternalSourcesTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.data=build();cls.rows=cls.data['records']
 def test_reproducible(self):self.assertEqual(self.data,json.loads((ROOT/'site/data/external-sources.json').read_text()))
 def test_unique_safe_public_urls(self):
  self.assertEqual(len(self.rows),len({r['url'] for r in self.rows}));self.assertEqual(len(self.rows),len({r['id'] for r in self.rows}))
  for r in self.rows:self.assertEqual(canonical_url(r['url'])[0],r['url']);self.assertTrue(r['title']);self.assertTrue(r['groups']);self.assertTrue(r['provider'])
 def test_multiple_groups_merge_without_losing_origin(self):
  policy=next(r for r in self.rows if r['url'].endswith('/past-monetary-policy-decisions'))
  self.assertIn('Singapore',policy['groups']);self.assertIn('Central banks',policy['groups']);self.assertIn('Monetary policy',policy['groups']);self.assertEqual(policy['provider'],'MAS')
  self.assertEqual(len([r for r in self.rows if r['url'].endswith('/past-monetary-policy-decisions')]),1)
 def test_all_existing_security_urls_preserved(self):
  data=json.loads((ROOT/'site/data/securities.json').read_text());urls={r['url'] for r in self.rows}
  for r in data['stocks']+data['bonds']:self.assertIn(canonical_url(r['url'])[0],urls)
 def test_official_links_and_access_limits(self):
  seeds=json.loads((ROOT/'site/data/external-source-seeds.json').read_text())['records'][:18];self.assertEqual(len(seeds),18)
  urls={r['url'] for r in self.rows}
  for r in seeds:self.assertIn(canonical_url(r['url'])[0],urls)
  inf=next(r for r in self.rows if r['url'].endswith('mas-annual-report_infographic.pdf'));self.assertEqual(inf['status'],'unavailable')
  fin=next(r for r in self.rows if r['url'].endswith('mas-financial-statements-2025_2026.pdf'));self.assertEqual(fin['status'],'publisher_link')
 def test_dates_and_coverage_not_invented(self):
  self.assertEqual(self.data['coverage']['earliest_saved_reference'],'2026-10-29');self.assertEqual(len(self.data['coverage']['daily_archive_missing_dates']),28)
  for r in self.rows:
   if r.get('references'):
    self.assertEqual(r['first_referenced'],min(x['date'] for x in r['references']));self.assertEqual(r['last_referenced'],max(x['date'] for x in r['references']));self.assertEqual(r['reference_count'],len(r['references']))
 def test_redirects_honestly_labeled(self):
  rows=[r for r in self.rows if r['domain']=='news.google.com'];self.assertGreaterEqual(len(rows),723)
  for r in rows:self.assertEqual(r['type'],'News redirect');self.assertEqual(r['status'],'not_rechecked');self.assertIn('not been resolved',r['note'])
 def test_no_private_upload_identifiers_or_paths(self):
  text=json.dumps(self.data)
  for s in ['libfile_','/workspace/','/tmp/','chatgpt.com','workflow.actions','WFTextAction','UserInfo']:self.assertNotIn(s,text)
 def test_supplement_has_exact_public_report_provenance(self):
  supplement=json.loads((ROOT/'site/data/supplemental-public-sources.json').read_text())['records'];self.assertEqual(len(supplement),100)
  public=(ROOT/'site/v2-data.js').read_text();reports=json.loads(public.split('=',1)[1].rstrip().rstrip(';'))['reports'];by_id={r['id']:r for r in reports}
  for row in supplement:
   self.assertEqual(row['status'],'limited');self.assertEqual(canonical_url(row['url'])[0],row['url'])
   self.assertNotIn('full_text',row);self.assertNotIn('body',row)
   for ref in row['references']:
    # Validate retained public reports by stable ID rather than a shifting array index.
    report=by_id.get(ref['id'].removeprefix('report:'))
    if report:
     self.assertEqual(ref['date'],report['date'])
     self.assertIn(row['url'],json.dumps(report,ensure_ascii=False))
 def test_merged_reference_statistics(self):
  refs=[r for r in self.rows if r.get('references')]
  self.assertEqual(self.data['reference_statistics']['unique_sources'],len(refs))
  self.assertEqual(self.data['reference_statistics']['saved_editions'],len({x['id'] for r in refs for x in r['references']}))
 def test_new_public_article_citations(self):
  for slug in ['wealth-inequality-2026-11-04','cpf-oa-temasek-2070-2026-11-04']:
   rows=[r for r in self.rows if any(x['id']=='article:'+slug for x in r.get('references',[]))]
   self.assertGreater(len(rows),10)
   for row in rows:
    refs=[x for x in row['references'] if x['id']=='article:'+slug];self.assertEqual(len(refs),1);self.assertEqual(refs[0]['date'],'2026-11-04')
    self.assertTrue((ROOT/'site'/refs[0]['path']).is_file())
 def test_actual_usage_is_generated_from_public_content(self):
  self.assertGreater(self.data['usage_statistics']['sources_with_usage'],2000)
  self.assertGreater(self.data['usage_coverage']['input_count'],50)
  for row in self.rows:
   self.assertEqual(row['usage_count'],len(row['usages']))
   self.assertEqual(len(row['usages']),len({u['id'] for u in row['usages']}))
   for usage in row['usages']:
    path=usage['path'].split('?')[0].split('#')[0]
    self.assertTrue((ROOT/'site'/path).is_file(),usage['path'])
 def test_all_public_article_anchors_are_indexed_with_exact_usage(self):
  from index_external_source_usage import Page
  by_url={r['url']:r for r in self.rows}
  for base in ['research','market-understanding']:
   for page in (ROOT/'site'/base).rglob('*.html'):
    parser=Page();parser.feed(page.read_text());path=page.relative_to(ROOT/'site').as_posix()
    for raw,label,_ in parser.links:
     url,_=canonical_url(raw)
     if url:self.assertTrue(any(u['path']==path for u in by_url[url]['usages']),(url,path))
 def test_bank_sources_retain_checks_and_do_not_invent_usage(self):
  bank=json.loads((ROOT/'site/data/external-bank-sources.json').read_text())['records'];self.assertEqual(len(bank),10)
  by_url={r['url']:r for r in self.rows}
  for row in bank:
   found=by_url[canonical_url(row['url'])[0]];self.assertEqual(found['status'],row['status']);self.assertIn('Bank earnings',found['groups'])
  for title in ['OCBC 3Q26 CEO presentation','OCBC 3Q26 results highlights']:
   row=next(r for r in bank if r['title']==title);self.assertEqual(row['status'],'limited');self.assertNotIn('report_date',row)
 def test_standard_is_verified_merged_mapping(self):
  standard=json.loads((ROOT/'site/data/external-source-standard.json').read_text());self.assertEqual(standard['version'],'V1.2 Merged');self.assertEqual(len(standard['tags']),437)
  mapping={t['label']:t for t in standard['tags']}
  for label in ['DBS / D05','OCBC / O39','UOB / U11','Singapore']:
   self.assertEqual(mapping[label]['text'],'#047857');self.assertEqual(mapping[label]['background'],'#ECFDF5')
 def test_navigation(self):
  for name in ['v4.html','site-map.html']:self.assertIn('href="external-sources.html"',(ROOT/'site'/name).read_text())
  self.assertIn('aria-live="polite"',(ROOT/'site/external-sources.html').read_text())
if __name__=='__main__':unittest.main()
