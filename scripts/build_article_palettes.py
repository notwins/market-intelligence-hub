"""Build an evidence-labelled article colour directory without recolouring reports."""
from collections import Counter
from html import escape
from html.parser import HTMLParser
import hashlib
import json
from pathlib import Path
import re
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
TOPICS = [
 ('04','US/global shares, earnings and equity ETFs'),
 ('03','UST, generic bonds, investment-grade credit and cross-asset research'),
 ('05','High-yield/distressed credit, options and derivatives'),
 ('06','Singapore banks, CPF, retirement, SGS and SSB'),
 ('08','FX, central banks, CPI and macro policy'),
 ('07','AI, chips and digital innovation'),
 ('09','Gold, oil and commodities'),
 ('02','China/Hong Kong, property and infrastructure'),
 ('01','Japan'),
 ('10','Taiwan/Korea and Asian technology'),
]
# Reviewed recommendation for each existing article's main question, not an
# attestation that the historical page has already adopted the V3 template.
RECOMMENDATIONS = {
 '04': ['anthropic-ipo-2026-11-05','googl','nvda-2026-11-05','ai-selloff-2026-11-06','us-earnings-cash-flow-2026-11-06'],
 '03': ['diversification-made-simple-2026-11-06','historical-market-events-2026-11-05','jpm-price-growth-2026-11-05','oaktree-rates-wayne-dahl-2026-11-05','pimco-income-bonds-2026-11-06','wealth-inequality-2026-11-04','bond-research-review-2026-11-06','creditworthiness-2026-11-05','creditworthiness-2026-11-06-v2','howard-marks-2026-11-05','howard-marks-2026-11-06-v2','treasuries-chf-gold-2026-11-06','pimco-income-public-2026-11-07','wealth-pdf-public-2026-11-07','bond-comparison-2026-11-07','global-credit-public-2026-11-07'],
 '05': ['spx-collars-2026-11-06','spx-floor-cap-2026-11-05','structured-investment-hypothetical','spx-pdf-public-2026-11-07'],
 '06': ['cpf-life-after-55-2026-11-04','cpf-life-explained-2026-11-06-v2','cpf-life-yield-2026-11-05','cpf-oa-temasek-2070-2026-11-04','sti-banks-2026-11-06','sti-banks-part2-2026-11-06','cpf-pdf-public-2026-11-07'],
 '08': ['snb-mas-policy-2026-11-05','mas-snb-2026-11-05','mas-snb-public-2026-11-07','snb-mas-public-2026-11-07'],
 '07': ['ai-data-centres-2026-11-05','ai-tech-2026-11-05','ai-tech-public-2026-11-07'],
 '09': ['xau-central-banks-2026-11-05','xau-gold-outlook-2026-11-06','xau-gold-outlook-2026-11-06-v2','gold-pdf-public-2026-11-07'],
 '02': ['electricity-infrastructure-2026-11-05'],
 '10': ['tsm-2026-11-05'],
}
class Source(HTMLParser):
 def __init__(self, text):
  super().__init__();self.styles=[];self.stylesheets=[];self.contracts=[];self.current=None;self.feed(text)
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='style':self.current='style';self.styles.append('')
  if tag=='link' and a.get('rel')=='stylesheet':self.stylesheets.append(a.get('href',''))
  if tag=='script' and a.get('id')=='mih-research-contract':self.current='contract';self.contracts.append('')
 def handle_data(self,text):
  if self.current=='style':self.styles[-1]+=text
  if self.current=='contract':self.contracts[-1]+=text
 def handle_endtag(self,tag):
  if tag in {'style','script'}:self.current=None

def directory(root=ROOT):
 site=Path(root)/'site';standard=json.loads((site/'data/colour-templates-v3.json').read_text());register=json.loads((site/'data/research-register.json').read_text());themes={t['id']:t for t in standard['themes']}
 recommendations={slug:theme for theme,slugs in RECOMMENDATIONS.items() for slug in slugs};articles=[]
 for entry in register['entries']:
  if entry['state']!='published':continue
  url=urlsplit(entry['href']);assert not url.scheme and not url.netloc
  path=site/url.path
  if path.is_dir():path/='index.html'
  assert path.resolve().is_relative_to(site.resolve()) and path.is_file(), entry['href']
  text=path.read_text();parsed=Source(text);css='\n'.join(parsed.styles)
  for href in parsed.stylesheets:
   u=urlsplit(href)
   if not u.scheme and not u.netloc:
    style=(path.parent/u.path).resolve()
    if style.is_relative_to(site.resolve()) and style.is_file():css+='\n'+style.read_text()
  colours=[]
  for value in re.findall(r'#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b',css):
   value=value.upper()
   if len(value)==4:value='#'+''.join(c*2 for c in value[1:])
   if value not in colours:colours.append(value)
  # Prefer chromatic samples for a useful small key, retaining exact source HEX.
  chromatic=[v for v in colours if max(int(v[i:i+2],16) for i in (1,3,5))-min(int(v[i:i+2],16) for i in (1,3,5))>20]
  current=(chromatic+[v for v in colours if v not in chromatic])[:5]
  contract=None
  if parsed.contracts:
   from validate_research_contracts import validate_document
   validate_document(text,standard);contract=json.loads(parsed.contracts[0])
  slug=url.path.strip('/').split('/')[1]
  rec=contract['theme'] if contract else recommendations.get(slug)
  assert rec is None or rec in themes
  articles.append({'id':entry['id'],'title':entry['title'],'href':entry['href'],'date':entry['date'],'edition':entry['edition'],'recommended_theme':rec,'declared_theme':contract['theme'] if contract else None,'status':'contract-declared' if contract else 'legacy-unassigned','source_css_samples':current,'source_sha256':hashlib.sha256(text.encode()).hexdigest()})
 return {'schema_version':1,'standard':'V3.0 presentation / V1.2 Merged semantics','guidance_date':'2026-11-08','scope':'Published editions in the research register. Prescribed future themes are not evidence that existing articles have been restyled. CSS samples are literal source declarations, not a computed-style or full-palette audit. PDFs and generated watchlist editions are not individually inventoried.','topics':[{'theme':i,'subject':s} for i,s in TOPICS],'articles':articles}

def swatches(standard,theme):
 return '<div class="article-swatches">'+''.join('<span><i aria-hidden="true" style="background:'+s['hex']+'"></i><code>'+s['hex']+'</code></span>' for s in standard['swatches'] if s['themeId']==theme and s['shade']=='Original')+'</div>'

def render(data,standard):
 themes={t['id']:t for t in standard['themes']}
 name=lambda i:i+' · '+themes[i]['name']
 guide='<section id="subject-guide"><p class="kicker">Required for future research · 8 November 2026</p><h2>Main subject → presentation theme</h2><p>All future research follows this subject guide. Choose the main analytical question first; one incidental company, country or keyword does not override it. Company and keyword identity colours stay at V1.2 Merged.</p><div class="subject-guide-grid">'
 for theme,subject in TOPICS:
  guide+='<article class="subject-guide-card"><h3>'+escape(subject)+'</h3><a href="?theme='+theme+'#themes">'+escape(name(theme))+'</a>'+swatches(standard,theme)+('<p class="caption">Restrained use: vivid colours only for small marks, never a saturated page background.</p>' if theme=='07' else '')+'</article>'
 guide+='</div><p class="caption">Five Original core swatches are shown for each theme. Each also has Light and Dark shades in the <a href="#palettes">150-swatch directory</a>. Page surfaces use the separately documented near-white UI tints. For mixed subjects, follow the <a href="#routing">route precedence</a> and record the reason.</p></section>'
 section='<section id="articles"><div class="sectionhead"><div><p class="kicker">Article-by-article colour key</p><h2>Which article uses which colours?</h2></div><p>See the existing source colours beside the prescribed theme for the next edition. Opening a palette here does not recolour an older report.</p></div><p class="notice"><strong>Existing pages are preserved.</strong> “Not yet assigned” means no V3 article contract was found. The prescribed theme is a reviewed subject recommendation, not an applied-theme claim. A declared contract still needs visual review to confirm the rendered colours.</p><div class="controls"><label class="grow">Find an article<input id="article-query" type="search" placeholder="Gold, CPF, NVIDIA, bonds…"></label><label>Prescribed theme<select id="article-theme"><option value="">All themes</option>'+''.join('<option value="'+i+'">'+escape(name(i))+'</option>' for i in themes)+'</select></label><label>Current V3 status<select id="article-status"><option value="">All statuses</option><option value="legacy-unassigned">Not yet assigned</option><option value="contract-declared">Contract declared</option></select></label></div><p id="article-count" class="caption" role="status" aria-live="polite">'+str(len(data['articles']))+' published article editions.</p><div id="article-results" class="article-directory">'
 for a in sorted(data['articles'],key=lambda a:(a['date'],a['title']),reverse=True):
  theme=a['recommended_theme'];theme_label=name(theme) if theme else 'Needs subject review'
  search=' '.join([a['title'],a['edition'],a['date'],theme_label])
  section+='<article class="article-palette" data-article-theme="'+(theme or '')+'" data-article-status="'+a['status']+'" data-article-search="'+escape(search,quote=True)+'"><p class="article-meta">'+escape(a['date'])+' · '+escape(a['edition'])+'</p><h3><a href="../'+escape(a['href'],quote=True)+'">'+escape(a['title'])+'</a></h3><p class="article-status"><strong>Current V3:</strong> '+('Contract declared: '+escape(name(a['declared_theme'])) if a['declared_theme'] else 'Not yet assigned · existing design retained')+'</p><div class="article-prescribed"><span class="kicker">Prescribed for the next edition</span><p>'+('<a href="?theme='+theme+'#themes">'+escape(theme_label)+'</a>' if theme else escape(theme_label))+'</p>'+(swatches(standard,theme) if theme else '')+'</div><details class="current-samples"><summary>Existing CSS colour samples</summary><p class="caption">Exact declarations in this HTML or its local stylesheets. May include dark-mode colours; this is not a named V3 assignment or a rendered-colour audit.</p><div class="article-swatches">'+(''.join('<span><i aria-hidden="true" style="background:'+c+'"></i><code>'+c+'</code></span>' for c in a['source_css_samples']) or '<span>No HEX samples found in the source styles.</span>')+'</div></details></article>'
 section+='</div><p id="article-empty" class="empty" hidden>No matching articles. Clear a filter or try a broader search.</p><button id="article-more" class="more" type="button" hidden>Show more articles</button><p class="caption">Scope: published editions in the <a href="../research-editions.html">research register</a>. Archived editions remain separate. Linked PDF interiors and generated watchlist reports are not individually classified here. New registered articles with no reviewed route are labelled “Needs subject review” until a route is recorded.</p></section>'
 return guide+section

def build(root=ROOT):
 root=Path(root);data=directory(root);standard=json.loads((root/'site/data/colour-templates-v3.json').read_text());page=root/'site/colour-templates-v3/index.html';text=page.read_text();start='<!-- ARTICLE PALETTES START -->';end='<!-- ARTICLE PALETTES END -->';fragment=start+'\n'+render(data,standard)+'\n'+end
 if start in text:text=text[:text.index(start)]+fragment+text[text.index(end)+len(end):]
 else:text=text.replace('<main id="main">','<main id="main">'+fragment)
 page.write_text(text);(root/'site/data/article-palettes.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');return data
if __name__=='__main__':
 data=build();print('Built palette directory:',len(data['articles']),'published editions;',dict(Counter(a['status'] for a in data['articles'])))
