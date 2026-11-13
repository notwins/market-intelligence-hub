import re,unittest
from pathlib import Path
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parents[1]/'site'
class Links(HTMLParser):
 def __init__(self):super().__init__();self.links=[];self.routes=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='a' and 'href' in a:self.links.append(a['href'])
  if 'data-view' in a:self.routes.append(a['data-view'])
class NavigationShortcutsTests(unittest.TestCase):
 def setUp(self):
  self.html=(ROOT/'v4.html').read_text();self.more=self.html.split('<dialog id="more">')[1].split('</dialog>')[0]
  names=re.search(r'const viewNames=\{(.*?)\};',self.html).group(1)
  self.views=set(re.findall(r"(?:^|,)(\w+):",names));self.tabs={'history':{'yield','fx','curves','spx','si'},'master':{'explore','watchlists','screens','pivot','review'}}
 def valid_route(self,route):
  parts=route.split('/');self.assertIn(parts[0],self.views)
  if len(parts)>1:self.assertIn(parts[1],self.tabs[parts[0]])
 def test_more_tiles_have_supported_routes(self):
  p=Links();p.feed(self.more);self.assertEqual(len(p.routes),len(set(p.routes)))
  for route in p.routes:self.valid_route(route)
  for href in p.links:self.assertTrue((ROOT/href).exists(),href)
  self.assertIn('history/fx',p.routes);self.assertIn('master/pivot',p.routes)
  self.assertGreaterEqual(self.more.count('more-group-title'),5)
 def test_map_targets_exist_and_match_live_route_tabs(self):
  p=Links();p.feed((ROOT/'site-map.html').read_text())
  for href in p.links:
   path,_,anchor=href.partition('#');self.assertTrue((ROOT/path).exists(),href)
   if path=='v4.html' and anchor:self.valid_route(anchor)
  tools=(ROOT/'v4-tools.js').read_text()
  for values in self.tabs.values():
   for value in values:self.assertIn("'"+value+"'",tools)
 def test_next_section_shortcut_is_visible_on_desktop_and_phone(self):
  css=(ROOT/'mobile-navigation.css').read_text()
  # The base rule, before the phone-only query, must render the shortcut.
  base=css.split('@media')[0]
  shortcut=re.search(r'\.section-next\{([^}]+)\}',base).group(1)
  self.assertIn('display:flex',shortcut);self.assertIn('min-height:44px',shortcut)
  self.assertIn('flex-wrap:nowrap',shortcut);self.assertIn('text-align:left',shortcut)
  self.assertNotRegex(css,r'\.section-next\s*\{[^}]*display\s*:\s*none')
  self.assertIn('mobile-navigation.css?v=20261113.readability1',self.html)
  # Use the visible label as the accessible name, so translation cannot cache an old destination.
  script=(ROOT/'mobile-navigation.js').read_text()
  self.assertNotIn("next.setAttribute('aria-label'",script)
  self.assertIn('mobile-navigation.js?v=20261113.readability1',self.html)
  # The phone's bottom navigation and title layout remain responsive.
  self.assertIn('@media(max-width:760px)',css)
  self.assertIn('.bottom-nav button{min-width:0;white-space:normal',css)
  self.assertIn('.topbar .top-controls{flex-shrink:0}',css)
 def test_complete_desktop_phone_and_map_navigation(self):
  rail=self.html.split('<aside class="rail">')[1].split('</aside>')[0]
  self.assertIn('data-view="history/si"',rail)
  self.assertIn('id="all-sections-btn"',self.html)
  self.assertIn("querySelectorAll('#more-btn,#all-sections-btn')",self.html)
  self.assertIn('aria-controls="more"',self.html)
  css=(ROOT/'v4-navigation.css').read_text()
  self.assertIn('@media(max-width:760px){#all-sections-btn{display:none}}',css)
  self.assertIn('.history-tabs{flex-wrap:wrap;overflow-x:visible}',css)
  menu=Links();menu.feed(self.more)
  site_map=Links();site_map.feed((ROOT/'site-map.html').read_text())
  for parent,tabs in self.tabs.items():
   for tab in tabs:
    self.assertIn(parent+'/'+tab,menu.routes)
    self.assertIn('v4.html#'+parent+'/'+tab,site_map.links)
  for view in self.views-{'master','history','directory'}:
   self.assertIn(view,menu.routes)
   self.assertIn('v4.html#'+view,site_map.links)
  tools=(ROOT/'v4-tools.js').read_text().split('function historyView(){')[1].split('function ')[0]
  self.assertIn("if(!X.history)return intro+tabs+loading('history')",tools)
  self.assertIn("return '<div class=\"history-page\">'+intro+tabs+",tools)
  self.assertNotIn('contextControls()+tabs',tools)
 def test_settings_shortcuts_and_phone_grid(self):
  display=(ROOT/'v4-display.js').read_text();self.assertIn('class="settings-shortcuts"',display)
  self.assertIn('href="site-map.html"',display);self.assertIn('href="tag-map.html"',display)
  css=(ROOT/'v4-navigation.css').read_text();self.assertIn('repeat(2,minmax(0,1fr))',css);self.assertIn('repeat(3,minmax(0,1fr))',css)
  self.assertIn('grid-column:1/-1',css);self.assertIn('focus-visible',css)
if __name__=='__main__':unittest.main()
