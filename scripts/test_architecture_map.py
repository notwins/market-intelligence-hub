import copy
import json
from pathlib import Path
import re
import tempfile
import unittest
from urllib.parse import urlsplit
from build_architecture_map import ROOT, HUB, build_graph, owner_graph, render, build, cron_in_singapore, workflow_refresh


class ArchitectureMapTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.graph=build_graph()
        cls.nodes={n['id']:n for n in cls.graph['nodes']}

    def test_discovers_all_html_without_recursing_into_generated_map(self):
        actual={p.relative_to(ROOT/'site').as_posix() for p in (ROOT/'site').rglob('*.html') if p.name!='blueprint.html'}
        found={n['path'] for n in self.graph['nodes'] if n['type']=='page'}
        self.assertEqual(actual,found)
        self.assertEqual(len(actual),self.graph['coverage']['html_pages'])

    def test_ids_edges_and_company_deep_links_are_consistent(self):
        self.assertEqual(len(self.nodes),len(self.graph['nodes']))
        for e in self.graph['edges']:
            self.assertIn(e['source'],self.nodes);self.assertIn(e['target'],self.nodes);self.assertNotEqual(e['source'],e['target'])
        self.assertEqual(self.nodes['company:AAPL:earnings']['url'],HUB+'v4.html?company=AAPL#earnings')
        self.assertEqual(self.nodes['company:AAPL:history/beta3-shares']['parent'],'route:history/beta3-shares')
        self.assertEqual(self.nodes['route:history/beta3-shares']['parent'],'route:history')

    def test_automation_pipeline_does_not_conflate_independent_deployments(self):
        pairs={(e['source'],e['target']) for e in self.graph['edges']}
        self.assertIn(('process:source-runs','job:hourly'),pairs)
        self.assertIn(('job:content-build','app:pages-content'),pairs)
        self.assertNotIn(('job:content-build','job:hub-build'),pairs)
        self.assertNotIn(('job:hub-build','job:content-build'),pairs)
        self.assertIn('No automatic WSJ updater',self.nodes['data:wsj-treasury-dashboard.json']['description'])

    def test_public_graph_has_no_local_schedule_ids_prompts_or_private_paths(self):
        s=json.dumps(self.graph)
        for value in ['fixture-private-123','C:\\Users','chatgpt.com/c/','"prompt"','"owner"']:
            self.assertNotIn(value,s)
        refresh=self.graph['refresh']
        self.assertFalse(refresh['new_schedule_required'])
        self.assertFalse(refresh['private_automations']['rechecked_by_public_build'])
        self.assertFalse(refresh['private_automations']['live_status'])
        self.assertEqual(refresh['research']['mode'],'browser_open_and_manual')
        for id in ['daily','hourly','bos']:
            self.assertIn('not rechecked',self.nodes['job:'+id]['schedule_basis'])
            self.assertNotIn('owner',self.nodes['job:'+id])

    def test_sgs_cloud_schedule_and_software_owner_follow_public_workflow(self):
        job = self.nodes['job:sgs']
        self.assertIn('19:00 SGT', job['schedule'])
        self.assertIn('GitHub Actions', job['schedule'])
        self.assertIn('.github/workflows/publish.yml', job['schedule_basis'])
        pairs = {(e['source'], e['target']) for e in self.graph['edges']}
        self.assertIn(('app:github', 'job:sgs'), pairs)
        self.assertNotIn(('app:codex', 'job:sgs'), pairs)
        self.assertNotIn('private enabled state', job['status'])

    def test_workflow_change_updates_graph_cadence_without_new_schedule(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);(root/'site/data').mkdir(parents=True);(root/'.github/workflows').mkdir(parents=True)
            (root/'site/data/earnings-history.json').write_text('{"companies":[]}',encoding='utf-8')
            (root/'site/v4.html').write_text('<title>Fixture</title><a data-view="overview">Today</a>',encoding='utf-8')
            workflow=root/'.github/workflows/publish.yml'
            workflow.write_text("name: Fixture\non:\n  push:\n    branches: [main]\n  workflow_dispatch:\n  schedule:\n    - cron: '0 23 * * *'\n    - cron: '17 6 * * 6'\njobs:\n  ignored:\n    name: no trigger\n",encoding='utf-8')
            before=build_graph(root);summary=before['refresh']['architecture']['summary']
            self.assertIn('Daily at 07:00 SGT',summary);self.assertIn('Saturday at 14:17 SGT',summary)
            self.assertIn('Push to main',summary);self.assertIn('Manual workflow runs',summary)
            workflow.write_text(workflow.read_text(encoding='utf-8').replace('0 23 * * *','30 4 * * *'),encoding='utf-8')
            after=build_graph(root);summary=after['refresh']['architecture']['summary']
            self.assertIn('Daily at 12:30 SGT',summary);self.assertNotIn('07:00',summary)
            job=next(n for n in after['nodes'] if n['id']=='job:hub-build')
            self.assertEqual(job['schedule'],summary)
            self.assertEqual(after['refresh']['architecture']['triggers']['schedules'][0]['cron_utc'],'30 4 * * *')
            self.assertFalse(after['refresh']['new_schedule_required'])

    def test_cron_timezone_rollover_and_unfamiliar_syntax_stay_honest(self):
        self.assertEqual(cron_in_singapore('17 22 * * 6')['readable_sgt'],'Sunday at 06:17 SGT')
        self.assertEqual(cron_in_singapore('0 23 * * SUN')['readable_sgt'],'Monday at 07:00 SGT')
        self.assertEqual(cron_in_singapore('0 0 * * *')['readable_sgt'],'Daily at 08:00 SGT')
        for expression in ['*/15 0-6 * * 1-5','0 0 1 * *','70 24 * * *']:
            parsed=cron_in_singapore(expression)
            self.assertEqual(parsed['conversion'],'utc-only');self.assertIn(expression,parsed['readable_sgt'])
            self.assertIn('not inferred',parsed['readable_sgt'])

    def test_missing_workflow_does_not_invent_a_cadence(self):
        with tempfile.TemporaryDirectory() as d:
            refresh=workflow_refresh(d)
            self.assertEqual(refresh['architecture']['triggers']['schedules'],[])
            self.assertIn('cadence not inferred',refresh['architecture']['summary'])

    def test_owner_metadata_is_opt_in_and_never_changes_public_graph(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'one';p.mkdir();(p/'automation.toml').write_text('id="fixture-private-123"\nname="Publish hourly Reuters news to dashboard"\nstatus="PAUSED"\nkind="heartbeat"\nrrule="FREQ=HOURLY"\nprompt="secret private prompt"\n',encoding='utf-8')
            original=copy.deepcopy(self.graph);owner=owner_graph(self.graph,d);n=next(n for n in owner['nodes'] if n['id']=='job:hourly')
            self.assertEqual(n['owner']['status'],'PAUSED');self.assertNotIn('secret private prompt',json.dumps(owner));self.assertEqual(self.graph,original)

    def test_embedded_data_is_safe_and_artifact_is_self_contained(self):
        graph=copy.deepcopy(self.graph);graph['notes']=['</script><script>alert(1)</script>'];html=render(graph)
        self.assertIn('\\u003c/script',html);self.assertNotIn('/*BLUEPRINT_',html)
        self.assertNotIn('<script src=',html);self.assertNotIn('<link rel="stylesheet"',html)
        self.assertIn('id="viewport"',html);self.assertIn('id="import-board"',html)
        validator=(ROOT/'site/research-feed.js').read_text(encoding='utf-8')
        js=(ROOT/'site/blueprint.js').read_text(encoding='utf-8')
        self.assertIn(validator,html);self.assertLess(html.index(validator),html.index(js))
        self.assertNotIn('id="automated-research"',html)

    def test_rendered_blueprint_preserves_light_only_policy(self):
        html=render(self.graph)
        self.assertRegex(html,r'<meta\s+name="color-scheme"\s+content="light"\s*>')
        self.assertNotIn('Dark canvas',html)
        self.assertNotRegex(html,r'id=[\"\x27](?:theme|theme-button|theme-toggle)[\"\x27]')
        js=(ROOT/'site/blueprint.js').read_text(encoding='utf-8')
        self.assertRegex(js,r'const state=\{[^\n]*\blight:true\b')
        self.assertNotIn('light:saved.light',js)
        self.assertRegex(js,r'function theme\(\)\{[^\n]*state\.light=true;')
        self.assertIn("document.documentElement.style.colorScheme='light'",js)
        css=(ROOT/'site/blueprint.css').read_text(encoding='utf-8')
        root_css=re.search(r':root\{([^}]+)\}',css).group(1)
        self.assertIn('color-scheme:light',root_css)
        background=re.search(r'--bg:#([A-Fa-f0-9]{6})',root_css).group(1)
        self.assertTrue(all(int(background[i:i+2],16)>=240 for i in (0,2,4)),'Default canvas must stay light before JavaScript runs')
        self.assertNotRegex(css,r'prefers-color-scheme:\s*dark')

    def test_owner_output_cannot_enter_public_repository(self):
        with self.assertRaises(ValueError):build(output=Path(tempfile.gettempdir())/'atlas-test-public.html',owner_output=ROOT/'site/private-owner.html',automation_dir=Path(tempfile.gettempdir()))

    def test_hosted_owner_entry_contains_only_public_access_metadata(self):
        path=ROOT/'site/data/blueprint-access.json'
        if not path.exists(): self.skipTest('Owner hosting not installed in this fixture')
        access=json.loads(path.read_text(encoding='utf-8'))
        self.assertEqual(set(access),{'schema_version','public_url','owner_url','owner_access','owner_metadata'})
        u=urlsplit(access['owner_url']);self.assertEqual(u.scheme,'https');self.assertFalse(u.username or u.password or u.query or u.fragment)
        self.assertEqual(access['owner_access'],'server-password');self.assertEqual(self.nodes['app:owner-blueprint']['url'],access['owner_url'])
        self.assertIn(access['owner_url'],(ROOT/'site/blueprint-access.js').read_text(encoding='utf-8'))


if __name__=='__main__':unittest.main()
