"""Positive and adversarial cases for the V3 publication gate."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from validate_research_contracts import ROOT, validate_document, validate_site


TOKENS = {'canvas':'#FEFDFB','card':'#FFFFFF','panel':'#F4F5F1','focusPanel':'#EBF4F6',
          'border':'#D8E9EE','ink':'#222D31','secondaryInk':'#45535A',
          'chartOriginal':'#007190','chartRecommended':'#007190'}
TAG = {'id':'geo.united_states','light':'#1D4ED8','dark':'#93C5FD','lightChip':'#EFF6FF','darkChip':'#172554'}
STANDARD = {'themes':[{'id':'03','tokens':TOKENS}],
            'routes':[{'id':'route-008','themeId':'03'},{'id':'route-084','themeId':None}], 'tags':[TAG]}


def fixture():
    contract = {'version':3,'theme':'03','route':'route-008','route_rationale':'The analytical question is generic fixed income.',
        'presentation_tokens':TOKENS,'cutoff':'2026-11-07T12:00:00+08:00','cutoff_id':'cutoff','title_id':'title',
        'takeaways':['takeaway'],'source_ids':['source','chart-source'],'limitations_id':'limits','semantic_tags':[],
        'visuals':[{'id':'chart','kind':'chart', **{key+'_id':'chart-'+key.replace('_','-') for key in
                   ['title','date','instrument','units','source','how_to_read','finding','limitations']}}],
        'cards':[],'no_cards_reason':'Short report uses a narrative with one chart.',
        'editorial_review':{'reviewer':'Fixture reviewer','evidence_checked':True,'semantic_context_checked':True,'accessibility_checked':True}}
    html = '<h1 id="title">Report</h1><time id="cutoff">2026-11-07T12:00:00+08:00</time><p id="takeaway">Evidence-supported conclusion</p><a id="source" href="https://example.org/evidence">Dated source</a><p id="limits">Limitations disclosed</p>'
    html += '<figure id="chart" data-mih-visual><svg></svg>'
    for key in ['title','date','instrument','units','source','how-to-read','finding','limitations']:
        html += ('<a href="https://example.org/data" id="chart-source">Data source</a>' if key == 'source' else f'<p id="chart-{key}">{key} label</p>')
    return contract, html + '</figure>'


def render(c, html):
    return html + '<script type="application/json" id="mih-research-contract">' + json.dumps(c) + '</script>'


class ResearchContractTests(unittest.TestCase):
    def test_current_site(self):
        validate_site(ROOT/'site')

    def test_downloadable_template_cannot_publish_unfinished(self):
        text = (ROOT/'site/colour-templates-v3/research-template.html.txt').read_text()
        standard = json.loads((ROOT/'site/data/colour-templates-v3.json').read_text())
        with self.assertRaises(ValueError):
            validate_document(text, standard)

    def test_valid_document_and_explicit_user_choice(self):
        c, html = fixture()
        validate_document(render(c,html), STANDARD)
        c.update(route='explicit-user-choice', user_choice_reference='User-selected theme, approved for this report on 7 November 2026')
        validate_document(render(c,html), STANDARD)

    def test_missing_malformed_or_unknown_fields_fail(self):
        c, html = fixture()
        for text in [html, render(c,html).replace('"version": 3','"version":'), render(dict(c, semantic_overrides={}),html)]:
            with self.subTest(text=text[-100:]), self.assertRaises(ValueError):
                validate_document(text, STANDARD)

    def test_invalid_palette_routes_and_incomplete_review_fail(self):
        c, html = fixture()
        mutations = [dict(theme='06'),dict(route='route-084'),dict(route='route-999'),dict(route='explicit-user-choice'),
            dict(presentation_tokens=dict(TOKENS,canvas='#FFDD00')),dict(cutoff='2026-11-07'),
            dict(editorial_review=dict(c['editorial_review'],evidence_checked=False)),dict(takeaways=[])]
        for mutation in mutations:
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                validate_document(render(dict(c,**mutation),html),STANDARD)

    def test_each_required_chart_label_is_checked_in_actual_html(self):
        c,html = fixture()
        for key in ['date','instrument','units','source','how-to-read','finding','limitations']:
            with self.subTest(key=key), self.assertRaises(ValueError):
                validate_document(render(c,html.replace('id="chart-'+key+'"','id="removed"')),STANDARD)
        with self.assertRaises(ValueError):
            validate_document(render(c,html.replace('id="chart-units"','hidden id="chart-units"')),STANDARD)
        with self.assertRaises(ValueError):
            validate_document(render(c,html.replace('id="chart-units"','style="display:none" id="chart-units"')),STANDARD)

    def test_semantics_cannot_be_guessed_or_overridden(self):
        c,html = fixture()
        html += '<span id="us" data-mih-semantic="geo.united_states">United States</span>'
        c['semantic_tags'] = [dict(TAG,element_id='us',context='Country, not USD or a pronoun')]
        validate_document(render(c,html), STANDARD)
        for mutation in [dict(light='#FF0000'),dict(id='guessed.company'),dict(context=''),dict(extra='override')]:
            altered = copy.deepcopy(c)
            altered['semantic_tags'][0].update(mutation)
            with self.subTest(mutation=mutation),self.assertRaises(ValueError):
                validate_document(render(altered,html),STANDARD)
        with self.assertRaises(ValueError):
            validate_document(render(c,html.replace('id="us"','id="us" style="color:#FF0000"')),STANDARD)
        c['semantic_tags']=[]
        with self.assertRaises(ValueError):
            validate_document(render(c,html),STANDARD)

    def test_unregistered_visuals_and_cards_fail(self):
        c,html = fixture()
        for extra in ['<svg></svg>','<canvas></canvas>','<table></table>','<div data-mih-card id="card">Card</div>']:
            with self.subTest(extra=extra),self.assertRaises(ValueError):
                validate_document(render(c,html+extra),STANDARD)
        c['visuals']=[]
        with self.assertRaises(ValueError):
            validate_document(render(c,html),STANDARD)

    def test_exact_generated_watchlist_compatibility_not_an_unchecked_data_exemption(self):
        from watchlist_report import import_report
        edition = json.loads((ROOT/'site/data/watchlist/archive/watchlist-20261103T120000Z.json').read_text())
        with tempfile.TemporaryDirectory() as directory:
            site = Path(directory)
            (site/'data').mkdir()
            (site/'data/colour-templates-v3.json').write_text(json.dumps(STANDARD))
            path = import_report(edition, site)
            archive = site/'data/watchlist/archive'
            archive.mkdir()
            (archive/(edition['id']+'.json')).write_text(json.dumps(edition))
            baseline = {'paths': []}
            result = validate_site(site, baseline)
            self.assertEqual(result['checked'], [])
            self.assertEqual(result['generated_compatibility_non_v3'], [path.relative_to(site).as_posix()])
            original = path.read_bytes()
            path.write_bytes(original+b'<!-- forged content -->')
            with self.assertRaisesRegex(ValueError, 'differs from approved renderer'):
                validate_site(site, baseline)
            path.write_bytes(original)
            receipts_path = site/'data/watchlist/report-index.json'
            receipts = json.loads(receipts_path.read_text())
            receipts['reports'][0]['sha256'] = '0'*64
            receipts_path.write_text(json.dumps(receipts))
            with self.assertRaisesRegex(ValueError, 'receipt mismatch'):
                validate_site(site, baseline)
            receipts_path.unlink()
            with self.assertRaisesRegex(ValueError, 'requires archive and receipt'):
                validate_site(site, baseline)
            path.unlink()
            (site/'data/watchlist/reports/custom-article.html').write_text('<h1>Authored report</h1>')
            with self.assertRaisesRegex(ValueError, 'mih-research-contract'):
                validate_site(site, baseline)

    def test_new_paths_are_not_silently_grandfathered_and_ui_is_not_a_report(self):
        with tempfile.TemporaryDirectory() as directory:
            site = Path(directory)
            (site/'data').mkdir()
            (site/'data/colour-templates-v3.json').write_text(json.dumps(STANDARD))
            (site/'research').mkdir()
            old = site/'research/old.html'
            old.write_text('<p>Old report</p>')
            (site/'dashboard.html').write_text('<h1>Utility page</h1><p>Documentation names mih-research-contract.</p><pre>&lt;script id="mih-research-contract"&gt;</pre>')
            baseline = {'paths':['research/old.html']}
            validate_site(site,baseline)
            dashboard = site/'dashboard.html'
            documentation = dashboard.read_text()
            dashboard.write_text(documentation + '<script type="application/json" id="mih-research-contract">{}</script>')
            with self.assertRaises(ValueError):
                validate_site(site,baseline)
            dashboard.write_text(documentation)
            new = site/'research/new.html'
            new.write_text('<p>New report, missing contract</p>')
            with self.assertRaises(ValueError):
                validate_site(site,baseline)
            c,html = fixture()
            new.write_text(render(c,html))
            self.assertEqual(validate_site(site,baseline)['checked'],['research/new.html'])
            outside = site/'new-article.html'
            outside.write_text('<meta content="article" property="og:type"><h1>New article</h1>')
            with self.assertRaises(ValueError):
                validate_site(site,baseline)


if __name__ == '__main__':
    unittest.main()
