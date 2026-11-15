"""Visitor paths retain real destinations and progressive disclosure."""
from html.parser import HTMLParser
from pathlib import Path
import unittest

SITE = Path(__file__).resolve().parents[1] / 'site'

class Page(HTMLParser):
    def __init__(self, name):
        super().__init__()
        self.nodes = []
        self.feed((SITE / name).read_text(encoding='utf-8'))
    def handle_starttag(self, tag, attrs):
        self.nodes.append((tag, dict(attrs)))

class VisitorNavigation(unittest.TestCase):
    def test_current_home_sections_in_map_are_real_and_unique(self):
        home = Page('desk.html')
        ids = [a['id'] for _, a in home.nodes if 'id' in a]
        self.assertEqual(len(ids), len(set(ids)))
        links = [a['href'] for tag, a in Page('site-map.html').nodes
                 if tag == 'a' and a.get('href', '').startswith('desk.html#')]
        self.assertEqual(len(links), 3)
        self.assertEqual(len(set(links)), 3)
        all_links = [a.get('href') for tag, a in Page('site-map.html').nodes if tag == 'a']
        for destination in ('market-understanding/', 'v4.html#calls', 'v4.html#history'):
            self.assertIn(destination, all_links)
        for href in links:
            self.assertIn(href.split('#')[1], ids)

    def test_map_buttons_keep_a_working_no_script_destination(self):
        for name in ('desk.html', 'search.html', 'v4.html'):
            with self.subTest(page=name):
                nodes = Page(name).nodes
                links = [a for tag, a in nodes if tag == 'a' and 'data-site-map' in a]
                self.assertTrue(links)
                self.assertTrue(all(a['href'] == 'site-map.html' for a in links))
                self.assertTrue(any(tag == 'script' and a.get('src', '').startswith('site-navigation.js?') for tag, a in nodes))

    def test_archive_and_optional_tools_start_collapsed(self):
        archive = next(a for tag, a in Page('desk.html').nodes if a.get('id') == 'archive')
        self.assertNotIn('open', archive)
        self.assertTrue(any(tag == 'details' and a.get('class') == 'hub-extra-links' and 'open' not in a
                            for tag, a in Page('v4.html').nodes))
        # All old filtering and pagination controls remain available inside the archive.
        ids = {a.get('id') for _, a in Page('desk.html').nodes}
        self.assertTrue({'archive-query', 'archive-cards', 'archive-more'} <= ids)

    def test_advanced_operators_are_inside_disclosure(self):
        html = (SITE / 'search.html').read_text(encoding='utf-8')
        start = html.index('<details class="advanced">')
        toolbar = html.index('<div class="insert-toolbar"')
        self.assertLess(start, toolbar)
        self.assertLess(toolbar, html.index('</details>', start))
        for token in ('AND', 'OR', 'text:', 'tag:', '(', ')'):
            self.assertIn('data-insert="' + token + '"', html)

if __name__ == '__main__':
    unittest.main()
