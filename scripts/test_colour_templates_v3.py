"""Pin the verified V3 reference and preserved V1.2 semantics, without optional packages."""
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import unittest
from urllib.parse import urlsplit, unquote
from validate_research_contracts import validate_document

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT/'site'
REFERENCE = SITE/'colour-templates-v3'
# Exact original file fingerprints verified against the supplied source files.
DOWNLOADS = {
    'Colour_Standard_V3_Visual_Guide.pdf': '15711c1e4707ba54801fbcf10af6f98a918778aba22a6c38d48348c3fca6aab1',
    'Colour_Standard_V3_Wada_Master.xlsx': '589fcaff1c0827f98d36b31850ca0582888487091a479fd10cde6c9d794a4874',
    'Research_Master_Prompt_V3_0.md': 'd119318df5696a9ed28fcd0b025bbadf5e2e1f39826fdb869ade1e2685f10001',
    'Sanzo_Wada_Inspired_10_Palettes_150_Colours.pdf': 'ace26dffc891609a4128269d2e5f23e76d3ed9709eba7b5b3ee11bafb68163fe',
    'Sanzo_Wada_Inspired_10_Palettes_150_Colours.xlsx': '062e9f6a03c48d55b79eb4df85b6881ee4711494fe02f63b9f29ed4d96d2951a',
    'Sanzo_Wada_Inspired_10_Palettes_150_HEX.txt': '2a2aa43bf04d474a352ad47d0ef0708f23ea728e32eaab9bbb532ed2c20b9a65',
}
# Independently normalized from approved Market_Colour_Tag_Master_v1_2_Merged.xlsx
# (source SHA256 46ecab67f4eba9e57a9320489f4f7b07688f645f34d093372554c2871d319694),
# not copied from V3 verification claims. Sort by canonical id, retain alias order,
# encode JSON UTF-8 with sorted keys, ensure_ascii=False and separators=(',', ':').
SEMANTIC_BASELINES = {
    'tags': (['id','label','category','subcategory','colourName','light','dark','lightChip','darkChip','priority','matchingRule','aliases'],
             '45bc3ce9624437ab6bd0ef10d85d865c71a6f9b27019ceae8e1a5b57278d5858'),
    'companies': (['id','name','listings','colourName','light','dark','sectorSource','countrySourceNotHQ','aliases'],
                  '355424d3daf03326b82d76e5381970734cb2c9b62d3b2358dc785f72e8d363e3'),
}


class Links(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.ids, self.urls = [], []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        for key in ('href','src'):
            if key in attrs:
                self.urls.append(attrs[key])


class ColourTemplatesV3Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((SITE/'data/colour-templates-v3.json').read_text())
        cls.html = (REFERENCE/'index.html').read_text()

    def test_counts_unique_ids_and_references(self):
        expected = {'themes':10,'swatches':150,'cores':50,'routes':89,'tags':437,'companies':212,
                    'semanticPalettes':31,'aliasRecords':1782,'aliasGuards':37,'groupLinks':1773,
                    'legacyDesignRules':31,'rules':15,'chartRules':8,'contrastAudit':150}
        for key,count in expected.items():
            self.assertEqual(len(self.data[key]),count,key)
        for key in ('themes','routes','tags','companies'):
            self.assertEqual(len({r['id'] for r in self.data[key]}),len(self.data[key]),key)
        themes = {t['id'] for t in self.data['themes']}
        self.assertEqual(themes,{f'{i:02}' for i in range(1,11)})
        self.assertEqual(sum(r['themeId'] is None for r in self.data['routes']),6)
        for key in ('routes','tags','companies'):
            for row in self.data[key]:
                self.assertIn(row['themeId'], themes | {None})
        for theme in self.data['themes']:
            self.assertEqual(set(theme['tokens']),{'canvas','card','panel','focusPanel','border','ink','secondaryInk','chartOriginal','chartRecommended'})
            for colour in theme['tokens'].values():
                self.assertRegex(colour,r'^#[0-9A-F]{6}$')

    def test_original_download_fingerprints(self):
        self.assertEqual({p.name for p in (REFERENCE/'downloads').iterdir()},set(DOWNLOADS))
        for name,expected in DOWNLOADS.items():
            with self.subTest(download=name):
                self.assertEqual(hashlib.sha256((REFERENCE/'downloads'/name).read_bytes()).hexdigest(),expected)

    def test_v1_2_semantics_are_preserved_independently_of_verification_claims(self):
        for collection,(fields,expected) in SEMANTIC_BASELINES.items():
            rows = sorted(({key:row[key] for key in fields} for row in self.data[collection]),key=lambda row:row['id'])
            actual = hashlib.sha256(json.dumps(rows,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
            self.assertEqual(actual,expected,collection+' must retain approved V1.2 mappings')

    def test_known_subject_routes_not_a_universal_singapore_palette(self):
        routes = {r['id']:r for r in self.data['routes']}
        for route,theme,term in [('route-030','05','Options'),('route-001','04','Equities'),
                                 ('route-008','03','bonds'),('route-057','06','Singapore'),
                                 ('route-056','04','United States'),('route-016','08','Foreign exchange')]:
            with self.subTest(route=route):
                self.assertEqual(routes[route]['themeId'],theme)
                self.assertIn(term.lower(),routes[route]['keyword'].lower())

    def test_all_150_swatches_match_original_text_and_core_tables(self):
        text = (REFERENCE/'downloads/Sanzo_Wada_Inspired_10_Palettes_150_HEX.txt').read_text()
        source_rows = re.findall(r'^\s*([1-5])\s+(#[0-9A-F]{6})\s+(#[0-9A-F]{6})\s+(#[0-9A-F]{6})\s*$',text,re.M)
        self.assertEqual(len(source_rows),50)
        expected = {}
        for i,(core,*shades) in enumerate(source_rows):
            for shade,colour in zip(('Light','Original','Dark'),shades):
                expected[(f'{i//5+1:02}',int(core),shade)] = colour
        actual = {(r['themeId'],r['core'],r['shade']):r['hex'] for r in self.data['swatches']}
        self.assertEqual(len(actual),150)
        self.assertEqual(actual,expected)
        for row in self.data['cores']:
            for shade in ('Light','Original','Dark'):
                self.assertEqual(row[shade],expected[(f"{row['Palette No.']:02}",row['Core'],shade)])
        for row in self.data['contrastAudit']:
            self.assertEqual(row['HEX'],expected[(f"{row['Palette no.']:02}",row['Core'],row['Shade'])])

    def test_navigation_downloads_and_javascript_targets_exist(self):
        parsed = Links(self.html)
        self.assertEqual(len(parsed.ids),len(set(parsed.ids)))
        for url in parsed.urls:
            parts = urlsplit(url)
            if parts.scheme or parts.netloc:
                continue
            target = REFERENCE/unquote(parts.path) if parts.path else REFERENCE/'index.html'
            if target.is_dir():
                target /= 'index.html'
            self.assertTrue(target.is_file(),url)
            if parts.fragment and target.suffix == '.html':
                self.assertIn(parts.fragment,Links(target.read_text()).ids,url)
        for name in DOWNLOADS:
            self.assertIn('downloads/'+name,parsed.urls)
        js = (REFERENCE/'reference.js').read_text()
        self.assertTrue(set(re.findall(r"\$\('([^']+)'\)",js)).issubset(set(parsed.ids)))
        self.assertIn('../data/colour-templates-v3.json',js)
        for path in ('site-map.html','colour-reference.html'):
            self.assertTrue(any(u in {'colour-templates-v3/','colour-templates-v3/index.html'} for u in Links((SITE/path).read_text()).urls))

    def test_no_private_links_in_published_reference_text(self):
        paths = [SITE/'data/colour-templates-v3.json']+[p for p in REFERENCE.rglob('*') if p.suffix in {'.html','.js','.css','.md','.txt'}]
        forbidden = re.compile(r'libfile_|sediment://|chatgpt\.com/(?:c|g)/|/workspace/|/home/agent/|graph\.microsoft\.com|file://',re.I)
        for path in paths:
            self.assertIsNone(forbidden.search(path.read_text()),path.name)

    def test_starter_and_published_gate_rules_are_honest_and_consistent(self):
        self.assertEqual((REFERENCE/'gatekeeper-rules.md').read_bytes(),(ROOT/'docs/research-colour-gatekeeper.md').read_bytes())
        starter = (REFERENCE/'research-template.html.txt').read_text()
        with self.assertRaises(ValueError):
            validate_document(starter,self.data)
        self.assertIn('"evidence_checked": false',starter)
        self.assertIn('"accessibility_checked": false',starter)
        self.assertIn('"semantic_context_checked": false',starter)
        rules = (REFERENCE/'gatekeeper-rules.md').read_text()
        for phrase in ('generated_compatibility_non_v3','explicit-user-choice','cutoff_id','semantic_tags','how_to_read_id'):
            self.assertIn(phrase,rules)
        self.assertIn('not certified as V3',self.html)
        self.assertIn('Existing reports are preserved',self.html)
        workflow = (ROOT/'.github/workflows/publish.yml').read_text()
        self.assertGreaterEqual(workflow.count('python3 scripts/validate_research_contracts.py'),2)
        self.assertIn("validate_site(artifact_root/'site')",(ROOT/'scripts/validate_pages_artifact.py').read_text())


if __name__ == '__main__':
    unittest.main()
