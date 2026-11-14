import json,subprocess,unittest,os
from pathlib import Path
from release_lane_guard import validate, Rejected, REGISTER, UI, ASTRA_DESK_UI, ASTRA_RELEASE_INFRA, PUBLICATION_COLOUR_UI
SHA='a'*40
NEW='b'*40
class GuardTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.base={'site/v4.html':'ui', 'site/market-understanding/market-understanding.css':'css', 'site/research/old-edition/index.html':'old-report', REGISTER:'old-register', 'site/data/site-search.json':'search', 'site/market-understanding/index.html':'page'}
  cls.old=json.dumps({'entries':[{'id':'old','href':'research/old-edition/','title':'Preserved'}]})
 def setUp(self):
  self.report=dict(self.base);self.report['site/research/pilot-new-edition/index.html']='new-report';self.report[REGISTER]='new-register'
  doc=json.loads(self.old);doc['entries'].append({'id':'pilot-new','href':'research/pilot-new-edition/','state':'published'});self.new=json.dumps(doc)
 def reportcheck(self,candidate=None,**kw):
  return validate(self.base,candidate or self.report,lane='report',expected_sha=SHA,current_sha=SHA,register_before=self.old,register_after=self.new,**kw)
 def test_report_then_ui_preserves_every_other_blob(self):
  self.reportcheck();ui=dict(self.report);ui['site/market-understanding/market-understanding.css']='new-ui'
  plan=validate(self.report,ui,lane='ui',expected_sha=NEW,current_sha=NEW)
  self.assertEqual(plan['changed_paths'],['site/market-understanding/market-understanding.css'])
  self.assertEqual(ui['site/research/pilot-new-edition/index.html'],'new-report')
  self.assertTrue(all(ui[p]==v for p,v in self.base.items() if p not in (REGISTER,'site/market-understanding/market-understanding.css')))
 def test_ui_then_report_preserves_ui(self):
  ui=dict(self.base);ui['site/market-understanding/market-understanding.css']='new-ui'
  validate(self.base,ui,lane='ui',expected_sha=SHA,current_sha=SHA)
  combined=dict(self.report);combined['site/market-understanding/market-understanding.css']='new-ui'
  validate(ui,combined,lane='report',expected_sha=NEW,current_sha=NEW,register_before=self.old,register_after=self.new)
  self.assertEqual(combined['site/market-understanding/market-understanding.css'],'new-ui')
 def test_independent_ui_revert_keeps_new_report(self):
  ui=dict(self.report);ui['site/market-understanding/market-understanding.css']='new-ui'
  validate(ui,self.report,lane='ui',expected_sha=NEW,current_sha=NEW)
  self.assertEqual(self.report['site/research/pilot-new-edition/index.html'],'new-report')
 def test_report_removal_rollback_is_not_silently_allowed(self):
  with self.assertRaisesRegex(Rejected,'deletion'):
   validate(self.report,self.base,lane='report',expected_sha=NEW,current_sha=NEW,register_before=self.new,register_after=self.old)
 def test_stale_ui_after_report_is_rejected(self):
  with self.assertRaisesRegex(Rejected,'stale'):validate(self.base,self.report,lane='ui',expected_sha=SHA,current_sha=NEW)
 def test_ui_cannot_touch_report_or_register(self):
  with self.assertRaisesRegex(Rejected,'ownership'):validate(self.base,self.report,lane='ui',expected_sha=SHA,current_sha=SHA)
 def test_report_cannot_touch_ui(self):
  self.report['site/v4.html']='bad'
  with self.assertRaises(Rejected):self.reportcheck()
 def test_old_report_cannot_be_overwritten(self):
  path=next(p for p in self.base if p.startswith('site/research/') and p.endswith('index.html'));self.report[path]='bad'
  with self.assertRaises(Rejected):self.reportcheck()
 def test_deletion_rejected(self):
  del self.report['site/v4.html']
  with self.assertRaisesRegex(Rejected,'deletion'):self.reportcheck()
 def test_search_overlap_rejected_in_both_lanes(self):
  for lane in ['report','ui']:
   with self.subTest(lane=lane):
    candidate=dict(self.base);candidate['site/data/site-search.json']='stale-derived'
    with self.assertRaisesRegex(Rejected,'assembler'):validate(self.base,candidate,lane=lane,expected_sha=SHA,current_sha=SHA)
 def test_register_old_entry_change_rejected(self):
  doc=json.loads(self.new);doc['entries'][0]['title']='lost';self.new=json.dumps(doc)
  with self.assertRaisesRegex(Rejected,'existing'):self.reportcheck()
 def test_duplicate_register_rejected(self):
  doc=json.loads(self.new);doc['entries'].append(doc['entries'][0]);self.new=json.dumps(doc)
  with self.assertRaisesRegex(Rejected,'duplicate'):self.reportcheck()
 def test_unregistered_html_rejected(self):
  self.new=self.old
  with self.assertRaisesRegex(Rejected,'no new'):self.reportcheck()
 def test_missing_new_html_rejected(self):
  del self.report['site/research/pilot-new-edition/index.html']
  with self.assertRaisesRegex(Rejected,'lacks'):self.reportcheck()
 def test_extra_unregistered_edition_rejected(self):
  self.report['site/research/unregistered-report/index.html']='orphan'
  with self.assertRaisesRegex(Rejected,'unregistered'):self.reportcheck()
 def test_noncanonical_path_rejected(self):
  self.report['site/research/../v4.html']='bad'
  with self.assertRaisesRegex(Rejected,'noncanonical'):self.reportcheck()
 def chartbase(self):
  return {**self.base,'site/v4-tools.js':'old-tools','scripts/test_yield_comparisons.cjs':'old-test'}
 def test_ui_ownership_is_exact_existing_set_plus_reviewed_astra_paths(self):
  self.assertEqual(UI,frozenset({'site/v4.html','site/market-understanding/index.html',
   'site/market-understanding/market-understanding.css','scripts/build_report_additions.py',
   'scripts/test_research_register.py','site/v4-tools.js','scripts/test_yield_comparisons.cjs',
   'site/feed-freshness.js','site/research-shortcuts.css','site/market-snapshot.js',
   'site/global-search.js','site/search-query.js','site/search.html','site/favicon.ico',
   'scripts/test_sol_ui.cjs','scripts/test_saved_refresh.cjs','scripts/test_market_snapshot.cjs',
   'site/research-feed.js','site/research-feed.css','site/research-register.js',
   'site/content-source.js','site/reuters-read-up.js','scripts/test_read_up_reader.cjs'}) | ASTRA_DESK_UI | PUBLICATION_COLOUR_UI)
 def test_publication_colour_ownership_keeps_adjacent_and_source_paths_out(self):
  for path in PUBLICATION_COLOUR_UI:
   validate(self.base,{**self.base,path:'reviewed-colour-source'},lane='ui',expected_sha=SHA,current_sha=SHA)
  for path in ['site/publication-colour-private.js','site/data/publication-colour-policy.json','scripts/submit_research.py','site/research/new/index.html']:
   with self.subTest(path=path),self.assertRaises(Rejected):
    validate(self.base,{**self.base,path:'unowned'},lane='ui',expected_sha=SHA,current_sha=SHA)
 def test_desk_source_and_release_infrastructure_ownership_is_explicit(self):
  self.assertEqual(ASTRA_DESK_UI, frozenset({'site/index.html','site/legacy-redirect.js',
   'site/desk.html','site/desk.css','site/desk.js','site/desk-news.js','site/data/desk-config.json',
   'scripts/build_desk_data.py','scripts/test_desk_data.py','scripts/test_desk_ui.cjs',
   'scripts/test_desk_release.cjs','scripts/test_legacy_retirement.cjs'}))
  self.assertEqual(ASTRA_RELEASE_INFRA, frozenset({'.github/workflows/publish.yml',
   'scripts/release_lane_guard.py','scripts/test_release_lane_guard.py','docs/astra-desk-release.md'}))
  for path in ASTRA_DESK_UI:
   with self.subTest(path=path):
    candidate={**self.base,path:'reviewed-astra-change'}
    self.assertEqual(validate(self.base,candidate,lane='ui',expected_sha=SHA,current_sha=SHA)['changed_paths'],[path])
 def test_ordinary_ui_cannot_authorize_infrastructure(self):
  for path in ASTRA_RELEASE_INFRA:
   with self.subTest(path=path), self.assertRaisesRegex(Rejected,'ownership'):
    validate(self.base,{**self.base,'site/desk.html':'desk',path:'unreviewed-policy'},lane='ui',expected_sha=SHA,current_sha=SHA)
 def test_explicit_infrastructure_lane_accepts_only_reviewed_named_paths(self):
  for paths in [(p,) for p in ASTRA_RELEASE_INFRA]+[tuple(ASTRA_RELEASE_INFRA)]:
   with self.subTest(paths=paths):
    candidate={**self.base,**{p:'reviewed-infrastructure' for p in paths}}
    result=validate(self.base,candidate,lane='astra-infrastructure',expected_sha=SHA,current_sha=SHA)
    self.assertEqual(result['changed_paths'],sorted(paths))
    self.assertFalse(result['publication_verified'])
 def test_infrastructure_lane_rejects_ui_content_updaters_and_unknown_workflows(self):
  for path in ['site/desk.html','site/v4.html',REGISTER,'site/research/new-study/index.html',
   'scripts/update_news.py','scripts/update_fed_history.py','.github/workflows/other.yml',
   'owner/desk-editor.html','scripts/release_lane_guard_extra.py']:
   with self.subTest(path=path), self.assertRaisesRegex(Rejected,'ownership'):
    candidate={**self.base,'scripts/release_lane_guard.py':'reviewed-policy',path:'unowned'}
    validate(self.base,candidate,lane='astra-infrastructure',expected_sha=SHA,current_sha=SHA)
 def test_infrastructure_lane_rejects_stale_base_and_deletion(self):
  candidate={**self.base,'scripts/release_lane_guard.py':'reviewed-policy'}
  with self.assertRaisesRegex(Rejected,'stale'):
   validate(self.base,candidate,lane='astra-infrastructure',expected_sha=SHA,current_sha=NEW)
  existing={**self.base,'scripts/release_lane_guard.py':'old-policy'}
  with self.assertRaisesRegex(Rejected,'deletion'):
   validate(existing,self.base,lane='astra-infrastructure',expected_sha=SHA,current_sha=SHA)
 def test_desk_metadata_is_assembler_owned_in_every_lane(self):
  for lane in ['report','ui','astra-infrastructure']:
   candidate={**self.base,'site/data/desk-data.json':'stale-build'}
   with self.subTest(lane=lane), self.assertRaisesRegex(Rejected,'assembler'):
    validate(self.base,candidate,lane=lane,expected_sha=SHA,current_sha=SHA)
 def test_desk_release_does_not_admit_owner_data_other_workflows_or_adjacent_paths(self):
  forbidden=['site/desk-extra.js','site/data/desk-config-private.json','owner/desk-editor.html',
   '.github/workflows/content.yml','.github/workflows/other.yml','scripts/update_news.py',
   'scripts/update_fed_history.py','site/research/new-study/index.html',REGISTER]
  for path in forbidden:
   with self.subTest(path=path), self.assertRaisesRegex(Rejected,'ownership'):
    validate(self.base,{**self.base,'site/desk.html':'desk',path:'unowned'},lane='ui',expected_sha=SHA,current_sha=SHA)
 def test_desk_build_follows_reconciliation_and_precedes_catalogue_and_stage(self):
  workflow=(Path(__file__).resolve().parents[1]/'.github/workflows/publish.yml').read_text(encoding='utf-8')
  reconciled=workflow.split('      - name: Revalidate reconciled source and rebuild deployment catalogue',1)[1]
  self.assertLess(reconciled.index('python3 scripts/build_desk_data.py'),reconciled.index('python3 scripts/build_site_search.py'))
  self.assertLess(reconciled.index('python3 scripts/build_desk_data.py'),reconciled.index('python3 scripts/build_pages_artifact.py'))
  for check in ['test_desk_ui.cjs','test_desk_release.cjs']:
   self.assertIn('node scripts/'+check,reconciled)
  self.assertIn("- cron: '0 0 * * *'",workflow)
  self.assertIn("- cron: '17 6 * * 6'",workflow)
  self.assertIn('permissions:\n  contents: read',workflow)
  self.assertIn('      pages: write\n      id-token: write',workflow)
 def test_reviewed_astra_paths_are_accepted_individually_without_wildcards(self):
  for path in ['site/feed-freshness.js','site/research-shortcuts.css','site/market-snapshot.js',
   'site/global-search.js','site/search-query.js','site/search.html','site/favicon.ico',
   'scripts/test_sol_ui.cjs','scripts/test_saved_refresh.cjs','scripts/test_market_snapshot.cjs']:
   with self.subTest(path=path):
    base={**self.base,path:'old'};candidate={**base,path:'reviewed-change'}
    self.assertEqual(validate(base,candidate,lane='ui',expected_sha=SHA,current_sha=SHA)['changed_paths'],[path])
 def test_chart_paths_are_accepted_individually_and_together(self):
  for paths in [('site/v4-tools.js',),('scripts/test_yield_comparisons.cjs',),
   ('site/v4-tools.js','scripts/test_yield_comparisons.cjs','site/v4.html')]:
   with self.subTest(paths=paths):
    base=self.chartbase();candidate=dict(base)
    for path in paths:candidate[path]='reviewed-change'
    result=validate(base,candidate,lane='ui',expected_sha=SHA,current_sha=SHA)
    self.assertEqual(result['changed_paths'],sorted(paths))
 def test_chart_paths_do_not_admit_other_ui_report_data_or_schedule_paths(self):
  forbidden=['site/history-context.css','site/v4.css','site/global-search-extra.js',
   'site/v4-tools-extra.js','scripts/test_yield_comparisons_browser.cjs',
   'site/research/old-edition/index.html','site/research/new-edition/index.html',REGISTER,
   'site/data/history-fed.json','site/data/history-v3.json','site/data/history-events-v1.json',
   '.github/workflows/publish.yml','.github/workflows/other.yml','scripts/update_news.py','scripts/update_fed_history.py',
   'scripts/release_lane_guard.py','scripts/release_lane_guard_extra.py','RELEASE_LANES.md']
  for path in forbidden:
   with self.subTest(path=path):
    base=self.chartbase();candidate={**base,'site/v4-tools.js':'reviewed-change',path:'unowned-change'}
    with self.assertRaisesRegex(Rejected,'ownership'):
     validate(base,candidate,lane='ui',expected_sha=SHA,current_sha=SHA)
 def test_chart_paths_do_not_admit_any_assembler_output(self):
  for path in ['site/data/site-search.json','site/data/external-sources.json',
   'site/data/article-palettes.json','site/data/publication-timeline.json']:
   with self.subTest(path=path):
    base=self.chartbase();candidate={**base,'site/v4-tools.js':'reviewed-change',path:'derived-change'}
    with self.assertRaisesRegex(Rejected,'assembler'):
     validate(base,candidate,lane='ui',expected_sha=SHA,current_sha=SHA)
 def test_chart_path_deletion_and_stale_base_remain_rejected(self):
  for path in ['site/v4-tools.js','scripts/test_yield_comparisons.cjs']:
   with self.subTest(path=path):
    base=self.chartbase();candidate=dict(base);del candidate[path]
    with self.assertRaisesRegex(Rejected,'deletion'):
     validate(base,candidate,lane='ui',expected_sha=SHA,current_sha=SHA)
    candidate={**base,path:'reviewed-change'}
    with self.assertRaisesRegex(Rejected,'stale'):
     validate(base,candidate,lane='ui',expected_sha=SHA,current_sha=NEW)
 def test_chart_paths_remain_outside_report_lane(self):
  for path in ['site/v4-tools.js','scripts/test_yield_comparisons.cjs']:
   with self.subTest(path=path):
    base=self.chartbase();candidate={**base,**self.report,path:'unowned-change'}
    with self.assertRaisesRegex(Rejected,'report pilot'):
     validate(base,candidate,lane='report',expected_sha=SHA,current_sha=SHA,
      register_before=self.old,register_after=self.new)
if __name__=='__main__':unittest.main(verbosity=2)
