import copy
import json
from pathlib import Path
import tempfile
import unittest
from build_architecture_map import ROOT, HUB, build_graph, owner_graph, render, build


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

    def test_owner_output_cannot_enter_public_repository(self):
        with self.assertRaises(ValueError):build(output=Path(tempfile.gettempdir())/'atlas-test-public.html',owner_output=ROOT/'site/private-owner.html',automation_dir=Path(tempfile.gettempdir()))


if __name__=='__main__':unittest.main()
