"""Index actual public outbound links, never infer citations from a shared topic.

Reads HTML anchors, embedded JSON and the named data contracts used by the Hub.
No network I/O, document-body extraction, private originals or generated catalogues.
"""
import json,re
from collections import Counter
from html.parser import HTMLParser
from urllib.parse import quote,urlsplit
from extract_recent_sources import PublicAnchorParser,canonical_url,clean_title,source_links,saved_date,instant_key

class Page(PublicAnchorParser):
 def __init__(self):
  super().__init__();self.in_title=False;self.title_parts=[];self.json_parts=None;self.payloads=[]
 def handle_starttag(self,tag,attrs):
  super().handle_starttag(tag,attrs)
  if tag=='title':self.in_title=True
  if tag=='script' and dict(attrs).get('type')=='application/json':self.json_parts=[]
 def handle_data(self,data):
  super().handle_data(data)
  if self.in_title:self.title_parts.append(data)
  if self.json_parts is not None:self.json_parts.append(data)
 def handle_endtag(self,tag):
  super().handle_endtag(tag)
  if tag=='title':self.in_title=False
  if tag=='script' and self.json_parts is not None:
   try:self.payloads.append(json.loads(''.join(self.json_parts)))
   except json.JSONDecodeError:pass
   self.json_parts=None
 @property
 def title(self):return clean_title(' '.join(self.title_parts))

def collect(site):
 entries=[];inputs=[];excluded=Counter()
 def read(path):
  p=site/path
  if not p.is_file():return {}
  inputs.append(path);return json.loads(p.read_text())
 def add(obj,path,title,kind,date=None,identity=None,links=None,groups=None):
  usage={'id':identity or 'page:'+path,'title':clean_title(title) or path,'path':path,'type':kind,'date':saved_date(date) or ''}
  for raw,label,_ in links if links is not None else source_links(obj,title=title):
   url,reason=canonical_url(raw)
   if not url:excluded[reason]+=1;continue
   entries.append({'url':url,'title':clean_title(label) or urlsplit(url).hostname,'usage':usage,'groups':groups or [kind]})
 # Real published HTML pages, including dated research and public report readers.
 # Retired dashboard copies and the source directory itself are not articles.
 skip={'external-sources.html','v1.html','v2.html','v3.html','v3-backup.html','v3-settings-preview.html'}
 for page in sorted(site.rglob('*.html')):
  path=page.relative_to(site).as_posix()
  if path in skip:continue
  parser=Page();parser.feed(page.read_text());inputs.append(path)
  manifest=page.parent/'publication.json';meta=json.loads(manifest.read_text()) if manifest.is_file() else {}
  date=next((meta.get(k) for k in ['publication_date','published_date','as_of','research_date'] if saved_date(meta.get(k))),None)
  title=parser.title or meta.get('title') or path
  kind='Research articles' if path.startswith(('research/','market-understanding/')) and path!='market-understanding/index.html' else 'Hub pages'
  add({},path,title,kind,date,links=parser.links)
  for payload in parser.payloads:add(payload,path,title,kind,date)
  # Public supporting JSON belongs to this exact article, not a guessed related article.
  if path.startswith(('research/','market-understanding/')) and path.endswith('/index.html'):
   for data_path in sorted(page.parent.glob('*.json')):
    if data_path.name in {'publication.json','market-content.json','source-register.json'}:continue
    add(read(data_path.relative_to(site).as_posix()),path,title,kind,date)
 for file in sorted((site/'data/archive').glob('*.json')):
  day=file.stem;obj=read(file.relative_to(site).as_posix())
  add(obj,'archive.html?day='+day+'#archive-snapshot','Daily Reuters headlines · '+day,'Daily briefings',day,'daily-news:'+day)
 obj=read('data/news.json');day=saved_date(obj.get('generated_at'))
 add(obj,'v4.html#headlines','Latest Reuters headline feed','Daily briefings',day,'latest-headlines')
 for file in ['data/hourly-news.json']+[p.relative_to(site).as_posix() for p in sorted((site/'data/hourly-archive').glob('*.json'))]:
  obj=read(file)
  for edition in obj.get('editions',[obj] if 'stories' in obj else []):
   date=edition.get('cutoff') or edition.get('report_at')
   add(edition,'v4.html#hourly','Hourly Reuters report · '+str(date or 'date unavailable'),'Hourly news',date,'hourly:'+instant_key(date))
 for report in read('data/reports.json').get('reports',[]):
  rid=report['id'];path='archive.html?report='+quote(rid,safe='')+'#report-'+quote(rid,safe='')
  add(report,path,report.get('title',rid),'Research reports',report.get('date'),'report:'+rid)
 legacy_file=site/'v2-data.js'
 if legacy_file.is_file():
  inputs.append('v2-data.js');legacy=json.loads(legacy_file.read_text().split('=',1)[1].strip().rstrip(';'))
  for report in legacy.get('reports',[]):add(report,'v4.html#reports',report.get('title',report.get('id','Saved report')),'Research reports',report.get('date'),'legacy-report:'+str(report.get('id')))
  for key,route in [('research','research'),('earnings','earnings'),('issues','credit'),('treasury','ust'),('credit_stress','credit')]:
   add(legacy.get(key,[]),'v4.html#'+route,'Saved '+key.replace('_',' ')+' section','Hub modules')
 # Named public modules with explicit JSON payloads and verified render routes.
 add(read('data/securities.json'),'v4.html#directory','Stock & bond reference directory','Security directory')
 bos_file=site/'bos-resources.js'
 if bos_file.is_file():
  inputs.append('bos-resources.js');bos=json.loads(re.search(r'const sources=(\[.*?\]);',bos_file.read_text(),re.S).group(1))
  for row in bos:
   add(row,'v4.html#research','White Papers & Research Papers','Bank research')
   route='earnings' if row['kind']=='equities' else 'credit'
   add(row,'v4.html#'+route,'US earnings' if route=='earnings' else 'Bonds & credit','Bank research')
 # Literal outbound link-helper calls in known dashboard render functions only.
 # Do not scan arbitrary script strings or treat article body/prose URLs as links.
 routes={'overview':('overview','Daily briefing'),'earningsView':('earnings','US earnings'),'creditView':('credit','Bonds & credit'),'researchView':('research','White Papers & Research Papers'),'reportsView':('reports','Scheduled reports')}
 for line in (site/'v4.html').read_text().splitlines():
  function=re.match(r'function (\w+)\(',line)
  if not function or function.group(1) not in routes:continue
  route,title=routes[function.group(1)]
  links=[(m[1],m[3],'') for m in re.findall(r'\blink\(([\"\x27])(https://[^\"\x27\s]+)\1,\s*([\"\x27])([^\"\x27]+)\3\)',line)]
  add({},'v4.html#'+route,title,'Hub modules',links=links)
 for file in sorted((site/'data/watchlist/archive').glob('*.json')):
  obj=read(file.relative_to(site).as_posix());rid=obj.get('id');path='data/watchlist/reports/'+str(rid)+'.html'
  if not (site/path).is_file():path='watchlist-report.html?edition='+quote(str(rid))
  add(obj,path,obj.get('title',rid),'Company research',obj.get('as_of'),'watchlist:'+str(rid))
 for edition in read('data/credit-issues.json').get('editions',[]):add(edition,'v4.html#credit','Credit issuance · '+edition['id'],'Credit research',edition.get('checked_at'),'credit:'+edition['id'])
 modules=[('data/headline-context.json','v4.html#headlines','Headline research context'),('data/history-fed.json','v4.html#history','Federal Reserve historical data'),('data/history-v3.json','v4.html#history','Historical yield and FX series'),('data/sgs-daily-snapshot.json','v4.html#overview','Singapore government yields'),('data/ust-curves-daily.json','v4.html#ust','U.S. Treasury yield curves'),('data/watchlist/company-resources.json','v4.html#watchlist','Company research resources'),('data/watchlist/identities.json','v4.html#watchlist','Company identities'),('data/earnings-history.json','v4.html#earnings','Earnings history'),('data/credit-catchup-20261104.json','v4.html#credit','Credit research catch-up'),('market-understanding/source-register.json','market-understanding/index.html','Market understanding source register'),('market-understanding/market-content.json','market-understanding/index.html','Market understanding')]
 for file,path,title in modules:add(read(file),path,title,'Hub modules')
 return entries,{'indexed_inputs':sorted(set(inputs)),'input_count':len(set(inputs)),'excluded_url_occurrences':dict(sorted(excluded.items())),'basis':'Actual public HTML anchors, embedded JSON and named structured data contracts. Usage means the link is present, not that every claim was independently verified.','limits':'Private originals, unsafe URLs, external article bodies, PDF/PPTX/DOCX contents, URLs embedded only in prose and arbitrary executable JavaScript are not scanned. Named JSON data embedded in v2-data.js and bos-resources.js is handled explicitly. External redirects are retained without guessing the final destination.'}
