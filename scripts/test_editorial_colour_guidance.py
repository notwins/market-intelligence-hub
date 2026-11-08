"""Keep the editorial guide additive and exact against approved colour sources."""
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
import unittest
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'site'
PAGE = SITE / 'legal/editorial-policy.html'

class PageParser(HTMLParser):
    def __init__(self, content):
        super().__init__(); self.ids=[]; self.links=[]; self.themes=[]; self.palettes=[]
        self.feed(content)
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if 'id' in a: self.ids.append(a['id'])
        for k in ('href','src'):
            if k in a: self.links.append(a[k])
        if 'data-theme-id' in a: self.themes.append(a['data-theme-id'])
        if 'data-palette' in a: self.palettes.append((a['data-palette'],a['data-example-id']))

class EditorialColourGuidanceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html=PAGE.read_text(); cls.data=json.loads((SITE/'data/colour-templates-v3.json').read_text()); cls.parsed=PageParser(cls.html)
    def test_original_eight_clauses_and_draft_status_are_preserved(self):
        original=self.html[self.html.index('<h2 id="1-'):self.html.index('<div class="colour-guide"')]
        self.assertEqual(hashlib.sha256(original.encode()).hexdigest(),'5e953e3850c1c4c121b4203d28a095d666c3a912a0aa8b94e534c3170aded123')
        self.assertIn('DRAFT · REVIEW REQUIRED',self.html)
        self.assertIn('Not yet approved as a final policy.',self.html)
    def test_all_theme_tokens_and_original_combinations_match(self):
        self.assertEqual(self.parsed.themes,[t['id'] for t in self.data['themes']])
        for t in self.data['themes']:
            with self.subTest(theme=t['id']):
                card=self.html.split('data-theme-id="'+t['id']+'"',1)[1].split('</article>',1)[0]
                for k,v in t['tokens'].items(): self.assertIn(f'data-token="{k}">{v}</code>',card)
                cores=[c for c in self.data['cores'] if c['Palette No.']==int(t['id'])]
                self.assertEqual(re.findall(r'<i aria-hidden="true" style="background:(#[0-9A-F]{6})"',card),[c['Original'] for c in cores])
    def test_all_31_semantic_pairs_and_examples_match(self):
        self.assertEqual(len(self.parsed.palettes),31)
        source={p['Colour name']:p for p in self.data['semanticPalettes']}
        tags={t['id']:t for t in self.data['tags']}
        self.assertEqual({p for p,_ in self.parsed.palettes},set(source))
        for name,example in self.parsed.palettes:
            with self.subTest(palette=name):
                row=self.html.split('data-palette="'+name+'"',1)[1].split('</tr>',1)[0]
                for mode in ('Light','Dark'):
                    self.assertIn('color:'+source[name][mode+' text']+';background-color:'+source[name][mode+' chip'],row)
                if example:self.assertEqual(tags[example]['colourName'],name)
                else:self.assertEqual(name,'Neutral Charcoal')
    def test_links_assets_unique_ids_and_anchors(self):
        self.assertEqual(len(self.parsed.ids),len(set(self.parsed.ids)))
        for url in self.parsed.links:
            parts=urlsplit(url)
            if parts.scheme or parts.netloc:continue
            target=PAGE.parent/unquote(parts.path) if parts.path else PAGE
            if target.is_dir(): target=target/'index.html'
            self.assertTrue(target.is_file(),url)
            if parts.fragment and target.suffix=='.html':self.assertIn(parts.fragment,PageParser(target.read_text()).ids,url)
        for anchor in ('9-colour-combinations','10-text-and-tagging','11-sections-and-separators','12-formatting-checklist','research-prompt'):
            self.assertIn(anchor,self.parsed.ids);self.assertIn('#'+anchor,self.parsed.links)
    def test_full_prompt_is_copied_and_downloaded_without_example_video(self):
        prompt=(PAGE.parent/'research-prompt.txt').read_text()
        embedded=json.loads(re.search(r'<script type="application/json" id="research-prompt-source">(.*?)</script>',self.html,re.S).group(1))
        self.assertEqual(embedded,prompt)
        original_prompt=prompt.split("\n\nRequired colour and editorial references")[0]
        self.assertEqual(hashlib.sha256(original_prompt.encode()).hexdigest(),"e6ef1dffa4b872208495b7e749996575159b3f94f90ef6c624915975163d9a84")
        for phrase in ('Create a detailed, client-friendly research report','**[TOPIC]**','**[SOURCES / ATTACHMENTS]**','**[DATE AND TIME ZONE]**','**[REPORT FORMAT AND DESTINATION]**','Do not change my websites, files or scheduled tasks, or publish the report, unless I explicitly ask.'):
            self.assertIn(phrase,prompt)
        for path in ('tag-map.html','legal/editorial-policy.html'):
            self.assertIn('https://notwins.github.io/market-intelligence-hub/'+path,prompt)
        self.assertNotIn('youtu',prompt); self.assertNotIn('Casual Finance',self.html)
        self.assertIn('Every article and posting prompt must include',self.html)
        self.assertIn('does not update every existing chat or scheduled task',self.html)
    def test_prompt_copy_success_repeat_and_failure_paths(self):
        subprocess.run(['node',str(ROOT/'scripts/test_editorial_prompt_copy.cjs')],check=True,capture_output=True,text=True)
    def test_private_source_details_do_not_leak(self):
        for name in ('editorial-policy.html','editorial-colours.css','editorial-colours.js','research-prompt.txt'):
            content=(PAGE.parent/name).read_text()
            self.assertIsNone(re.search(r'libfile_|sediment://|chatgpt\.com/(?:c|g)/|/workspace/|/home/agent/|graph\.microsoft\.com|onedrive\.live|file://',content,re.I),name)

if __name__=='__main__': unittest.main()
