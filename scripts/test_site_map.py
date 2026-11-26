"""Family-tree structure, destinations and colour contracts (no browser required)."""
import json
from html.parser import HTMLParser
from pathlib import Path
import re
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]

class HTML(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.tags = []
        self.feed(text)
    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))

def luminance(hex_value):
    rgb = [int(hex_value[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return sum(c * w for c, w in zip([v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb], [.2126, .7152, .0722]))

class SiteMapTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = (ROOT / 'site/site-map.html').read_text()
        cls.css = (ROOT / 'site/site-map.css').read_text()
        cls.js = (ROOT / 'site/site-map.js').read_text()
        # Footer Settings is a separate disclosure from the map tree.
        cls.parsed = HTML(cls.html.split('<!-- MIH_LEGAL_FOOTER_V1 -->')[0])
        cls.nodes = [attrs for tag, attrs in cls.parsed.tags if tag == 'a' and attrs.get('class') == 'map-link']

    def test_original_destinations_and_true_parent_routes(self):
        original = json.loads((ROOT / 'scripts/fixtures/site_map_destinations.json').read_text())
        current = [a['href'] for a in self.nodes]
        self.assertEqual(len(original), 40)
        self.assertTrue(set(current) >= {'desk.html#'+part for part in ('daily','reading','archive')} | set(original) | {'v4.html#master', 'v4.html#history', 'v4.html#history/shares', 'v4.html#history/beta2-shares','v4.html#history/beta4-shares','fred/','fred/market-desk.html','fred/risk-observatory.html','fred/signal-review.html','fred/cross-market-replay.html','fred/data.html','historical-fred.html','fred-1.html','fred-2.html','fred-3.html'})
        self.assertEqual(len(current), 91)
        self.assertEqual(len(set(current)), len(current) - 3)  # Main shortcuts intentionally share the real destination.
        for href in current:
            path = ROOT / 'site' / href.split('#')[0]
            self.assertTrue(path.exists(), href)
            if href.startswith('v4.html#'):
                route = href.split('#')[1]
                if '/' in route:
                    self.assertIn(f'data-view="{route}"', (ROOT / 'site/v4.html').read_text())
        cpf = next(a for a in self.nodes if a['href'] == 'tools/cpf-life-ra.html')
        self.assertEqual(cpf['target'], '_blank')
        self.assertEqual(set(cpf['rel'].split()), {'noopener', 'noreferrer'})

    def test_destination_art_matches_shared_navigation(self):
        from xml.etree import ElementTree as ET
        artwork = ET.parse(ROOT / 'site/assets/navigation-atlas.svg')
        keys = {symbol.attrib['id'] for symbol in artwork.getroot()}
        nav = next((ROOT / 'site').glob('Primary Navigation - Type JS*')).read_text(encoding='utf-8')
        routes = json.loads(nav.split('const destinationArt = ', 1)[1].split(';', 1)[0])
        for href, picture in re.findall(r'<a class="map-link" href="([^"]+)"[^>]*><span class="node-icon">(.*?)</span>', self.html):
            if routes[href] == 'accumulator-beta':
                self.assertIn('src="tools/accumulator-beta-icon.svg"', picture)
            else:
                self.assertIn(routes[href], keys)
                self.assertIn('navigation-atlas.svg#' + routes[href] + '"', picture, href)

    def test_native_tree_and_accessible_controls(self):
        details = [a for t, a in self.parsed.tags if t == 'details']
        self.assertEqual(len(details), 14)
        self.assertEqual(sum('open' in a for a in details), 8)
        self.assertEqual(sum(t == 'summary' for t, a in self.parsed.tags), 14)
        ids = [a['id'] for t, a in self.parsed.tags if 'id' in a]
        self.assertEqual(len(ids), len(set(ids)))
        for ident in [f'map-{i}' for i in range(6)] + ['map-search', 'site-tree', 'expand-all', 'collapse-all', 'reset-map', 'map-status']:
            self.assertIn(ident, ids)
        self.assertIn('aria-live="polite"', self.html)
        self.assertIn('aria-label="Clear site map search"', self.html)
        self.assertIn('min-height:44px', self.css)
        self.assertIn('focus-visible', self.css)
        self.assertIn('@media(max-width:760px)', self.css)
        self.assertIn('forced-colors', self.css)
        for tag, attrs in self.parsed.tags:
            if tag == 'svg':
                self.assertEqual(attrs.get('aria-hidden'), 'true')
        self.assertNotIn('role="tree"', self.html)  # Native links/disclosures, no incomplete ARIA tree widget.
        self.assertNotIn('javascript:', self.html)
        self.assertNotIn('aria-hidden="true">↗', self.html)

    def test_mapped_colours_and_contrast(self):
        tags = {t['id']: t for t in json.loads((ROOT / 'site/data/colour-templates-v3.json').read_text())['tags']}
        mapped = [a for t, a in self.parsed.tags if 'data-semantic-tag' in a]
        self.assertEqual(len(mapped), 14)
        for attrs in mapped:
            tag = tags[attrs['data-semantic-tag']]
            self.assertEqual(attrs['style'], f'--accent:{tag["light"]};--soft:{tag["lightChip"]}')
        for text, background in re.findall(r'--accent:(#[A-Fa-f0-9]{6});--soft:(#[A-Fa-f0-9]{6})', self.html):
            a, b = sorted([luminance(text), luminance(background)])
            self.assertGreaterEqual((b + .05) / (a + .05), 4.5, (text, background))
        self.assertIn('stroke:currentColor', self.css)
        self.assertIn('background:var(--soft)', self.css)

    def test_dom_interactions(self):
        result = subprocess.run(['node', 'scripts/test_site_map_interactions.cjs'], cwd=ROOT, text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

if __name__ == '__main__':
    unittest.main()
