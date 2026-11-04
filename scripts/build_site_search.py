"""Build a public-content catalogue, never inspect private files or external pages."""
import json,re,hashlib
from pathlib import Path
from html.parser import HTMLParser
from datetime import datetime,timezone
from urllib.parse import urlsplit,unquote,quote
ROOT=Path(__file__).resolve().parents[1]/'site'
def read(path):return json.loads((ROOT/path).read_text())

def master_record_target(record):
 identity=record.get('id')
 if not isinstance(identity,str) or not identity.strip():return None
 return 'v4.html?security='+quote(identity,safe='')+'#master/explore'
def strings(x):
 if isinstance(x,str):return x
 if isinstance(x,list):return ' '.join(strings(v) for v in x)
 if isinstance(x,dict):return ' '.join(strings(v) for k,v in x.items() if k not in ['source_file','sha256','raw','url','source_url','source_sheet','source_path','original_url','conversation_id','thread_id'])
 return ''
def watchlist_report_target(root,edition,ticker):
 # Never send an archived search result to whichever edition happens to be latest.
 from urllib.parse import quote
 eid=edition.get('id','')
 if not re.fullmatch(r'watchlist-\d{8}T\d{6}Z(?:-r[1-9][0-9]*)?',eid):return None
 if not re.fullmatch(r'[A-Z][A-Z0-9.-]{0,11}',ticker or ''):return None
 try:
  reports=json.loads((root/'data/watchlist/report-index.json').read_text()).get('reports',[])
  expected='data/watchlist/reports/'+eid+'.html'
  matches=[r for r in reports if r.get('edition_id')==eid and r.get('path')==expected and r.get('as_of')==edition.get('as_of')]
  if len(matches)!=1:return None
  content=(root/expected).read_bytes()
  if hashlib.sha256(content).hexdigest()!=matches[0].get('sha256'):return None
  if ('id="'+ticker+'"').encode() not in content:return None
  # The reader renders this exact saved edition; the original receipt stays authoritative.
  if (root/'watchlist-report.html').is_file():
   return 'watchlist-report.html?edition='+quote(eid,safe='')+'#'+quote(ticker,safe='')
  return expected+'#'+quote(ticker,safe='')
 except (OSError,ValueError,TypeError):return None

LOCATIONS={
 'Headline':('Reuters coverage · daily headlines and saved archives','headlines'),
 'Hourly edition':('Hourly news · scan history','hourly'),
 'Hourly story':('Hourly news · saved story version','hourly'),
 'Report':('Scheduled reports and archive','reports'),
 'Research edition':('Scheduled reports · imported edition history','reports'),
 'Research library':('Research library','research'),
 'Earnings card':('US earnings','earnings'),
 'Watchlist research':('Watchlist · dated full report','watchlist'),
 'Public diary':('Calls and full reports','calls'),
 'Stock directory':('Watchlist – equities','watchlist'),
 'Bond directory':('Watchlist – bonds','watchlist'),
 'Security master':('Security master','master'),
 'UST reference':('UST selection desk','ust'),
 'Historical series':('Yields and FX history','history'),
 'External research PDF':('Research library · external PDF reference','research')
}
def restricted_source(url):
 if not isinstance(url,str):return False
 try:
  parsed=urlsplit(url)
  return parsed.hostname in ['chatgpt.com','chat.openai.com'] and re.match(r'^/(?:c|g)(?:/|$)',unquote(parsed.path)) is not None
 except ValueError:return True

def reading_sections(record,kind):
 # Display-only structure from explicit public saved fields. Never synthesize facts.
 fields={'Hourly story':[('What happened','body'),('Saved analysis','analysis'),('What to watch','watch_next'),('Earlier version','earlier')],
         'Research library':[('Saved summary','summary'),('Saved analysis','implication')]}.get(kind,[])
 return [dict(label=label,text=re.sub(r'https?://\S+','',record[key]).strip()) for label,key in fields if isinstance(record.get(key),str) and record[key].strip()]

def build():
 rows=[];seen=set()
 def add(kind,title,text,href,date=None,source=None,status='Dated saved content',tags=None,location=None,reading=None):
  key=(kind,title,href,str(date),str(text))
  if key in seen:return
  seen.add(key)
  restricted=restricted_source(source) or restricted_source(href)
  if restricted_source(source):source=None
  if restricted_source(href):href=None
  if location and restricted_source(location.get('href')):location={**location,'href':None}
  if location is None:
   label,section=LOCATIONS.get(kind,(title,None))
   exact=kind in ['Page','Learning chapter','Tag catalogue','Section'] or (kind=='Watchlist research' and href is not None)
   location={'label':('V4 → '+label if section else label),'href':href if exact else ('v4.html#'+section if section else href),'exact':exact}
  clean_tags=sorted(set(str(t).strip() for t in (tags or []) if t is not None and str(t).strip()))
  rows.append(dict(id=hashlib.sha256(repr(key).encode()).hexdigest()[:16],kind=kind,title=str(title),text=re.sub(r'\s+',' ',re.sub(r'https?://\S+','',str(text))).strip(),href=href,date=date,source=source,status=status,tags=clean_tags,location=location,source_access='restricted' if restricted else 'public',reading=reading or []))
 sections={'overview':'Daily briefing','watchlist':'12-name watchlist','calls':'Calls and full reports','headlines':'Reuters coverage','hourly':'Hourly news','earnings':'US earnings','credit':'Bonds and credit','policy':'Central Banks and US Administration','reports':'Scheduled reports and archive','research':'White Papers & Research Papers','master':'Security master','history':'Yields FX history historical event charts','ust':'UST selection desk','feeds':'Data and uploads','tools':'Tools and simulators'}
 for key,title in sections.items():add('Section',title,title,'v4.html#'+key,status='Navigation')
 add('Section','Tag and event tree map','Searchable colored country sector policy ticker and historical event groupings','tag-map.html',status='Recommended taxonomy')
 for file in [ROOT/'data/news.json',*sorted((ROOT/'data/archive').glob('*.json'))]:
  d=json.loads(file.read_text())
  for x in d.get('items',[]):add('Headline',x.get('title','Untitled'),strings([x.get('category'),x.get('tickers')]),x.get('url') or 'v4.html#headlines',x.get('published_at'),x.get('url'),'Saved Reuters-attributed headline metadata; article body not indexed',tags=[x.get('category'),*(x.get('tickers') or [])],location={'label':'V4 → Reuters coverage' if file.name=='news.json' else 'V4 → Scheduled reports → Daily archive → '+file.stem,'href':'v4.html#headlines' if file.name=='news.json' else 'v4.html#reports','exact':False})
 for file in [ROOT/'data/hourly-news.json',*sorted((ROOT/'data/hourly-archive').glob('*.json'))]:
  d=json.loads(file.read_text())
  for edition in d.get('editions',[d] if 'stories' in d else []):
   add('Hourly edition',edition.get('summary') or edition.get('id','Hourly edition'),strings(edition.get('limitations',[])),'v4.html#hourly',edition.get('cutoff'),edition.get('original_url'),edition.get('coverage','Unspecified coverage'))
   for x in edition.get('stories',[]):add('Hourly story',x.get('title',x.get('headline','Hourly story')),strings(x),'v4.html#hourly',x.get('published_at') or edition.get('cutoff'),x.get('url') or next(iter(x.get('source_urls',[])),None),x.get('status','Saved report'),tags=[x.get('topic'),*(x.get('tickers') or [])],reading=reading_sections(x,'Hourly story'))
 for x in read('data/reports.json').get('reports',[]):add('Report',x.get('title',x['id']),strings(x),'v1.html?view=archive',x.get('date'),None,x.get('status','Saved edition'),location={'label':'V1 → Research archive → '+str(x.get('date','Unknown edition')),'href':'v1.html?view=archive','exact':False})
 # Parse the public JSON payload, never index executable JavaScript text.
 legacy=json.loads((ROOT/'v2-data.js').read_text().split('=',1)[1].strip().rstrip(';'))
 for x in legacy.get('reports',[]):add('Research edition',x.get('title',x.get('id','Research edition')),strings(x),'v4.html#reports',x.get('date'),None,'Original imported edition; not refreshed by search')
 for x in legacy.get('research',[]):add('White Papers & Research Papers',x.get('title',x.get('name','Research reference')),strings(x),'v4.html#research',x.get('date'),None,'Saved research reference',reading=reading_sections(x,'White Papers & Research Papers'))
 for c in read('data/earnings-history.json').get('companies',[]):
  add('Earnings card',c['ticker']+' – '+c['name'],strings(c),'v4.html#earnings',c['history'][0].get('report_date'),None,'Selected issuer-reported actuals; partial history',tags=[c['ticker']])
 add('Section','Colour and tag reference','Search actual headline tags, companies, atlas colours and palette differences','colour-reference.html',status='Current site colour reference')
 for x in legacy.get('earnings',[]):add('Earnings card',x.get('company',x.get('ticker',x.get('title','Earnings'))),strings(x),'v4.html#earnings',x.get('date'),None,'Saved dated earnings card')

 for file in sorted((ROOT/'data/watchlist/archive').glob('*.json')):
  d=json.loads(file.read_text())
  for x in d.get('rows',[]):
   target=watchlist_report_target(ROOT,d,x.get('ticker',''))
   add('Watchlist research',x.get('ticker','')+' · '+x.get('name',''),strings([x.get('research'),x.get('gaps')]),target,d.get('as_of'),(x.get('sources') or [{}])[0].get('url'),'Watch only; dated research, not an executed trade'+('' if target else '; matching dated report unavailable — no redirect to latest'),tags=[x.get('ticker')],location={'label':'V4 → Watchlist → '+str(d.get('as_of','Unknown edition'))+' → '+x.get('ticker',''),'href':target,'exact':bool(target)})
 for x in read('data/watchlist/calls.json').get('calls',[]):add('Public diary',x.get('title',x.get('ticker','Public entry')),strings(x),'v4.html#calls',x.get('date'),None,'Public saved entry')
 d=read('data/securities.json')
 for x in d.get('stocks',[]):add('Stock directory',x['ticker']+' · '+x['name'],strings([x.get('sector'),x.get('exchange')]),x['url'],None,x['url'],'User-supplied reference link; not a current quote',tags=[x.get('ticker'),x.get('sector')])
 for x in d.get('bonds',[]):add('Bond directory',x['name'],strings([x.get('id'),x.get('issuer'),x.get('currency'),x.get('kind'),x.get('maturity')]),x['url'],None,x['url'],'User-supplied reference; terms not independently reverified',tags=[x.get('currency'),x.get('kind')])
 d=read('data/master-v3.json')
 for x in d.get('records',[]):
  target=master_record_target(x)
  add('Security master',x.get('name',x.get('id','Security')),strings([x.get('isin'),x.get('securityNo'),x.get('currency'),x.get('category'),x.get('vendorType')]),target or 'v4.html#master',None,None,'Imported reference; no live prices or AR verification implied',tags=[x.get('currency'),x.get('category')],location={'label':'V4 → Security master','href':target or 'v4.html#master','exact':bool(target)})
 d=read('data/ust-v3.json')
 for x in d.get('rows',[]):add('UST reference',x['name'],strings([x.get('currency'),x.get('maturity'),x.get('instrumentType')]),'v4.html#ust',d.get('quote_date'),None,'Quote date not established; candidate identifiers excluded')
 for x in read('data/history-v3.json').get('series',[]):add('Historical series',x['id'],strings([x.get('family'),x.get('unit'),x.get('frequency')]),'v4.html#history',(x.get('points') or [[None]])[-1][0],None,'Historical saved series; gaps retained')
 d=read('market-understanding/market-content.json')
 for x in d.get('chapters',[]):add('Learning chapter',x['title'],strings(x),'market-understanding/#mu-'+x['id'],d.get('reviewed_at'),None,'Historical educational snapshot')
 class Text(HTMLParser):
  def __init__(self):super().__init__();self.skip=0;self.out=[]
  def handle_starttag(self,t,a):
   if t in ['script','style']:self.skip+=1
  def handle_endtag(self,t):
   if t in ['script','style']:self.skip=max(0,self.skip-1)
  def handle_data(self,d):
   if not self.skip:self.out.append(d)
 # Catalogues all public HTML pages, excludes code and transient UI preferences.
 for file in sorted(ROOT.rglob('*.html')):
  if file.name in ['search.html','tag-map.html']:continue
  p=Text();p.feed(file.read_text());title=re.search(r'<title>(.*?)</title>',file.read_text(),re.S)
  add('Page',re.sub('<[^>]+>','',title.group(1)) if title else file.stem,' '.join(p.out),file.relative_to(ROOT).as_posix(),None,None,'Public page text; JavaScript-only content indexed separately where supported')
 taxonomy_html=(ROOT/'tag-map.html').read_text()
 taxonomy=json.loads(re.search(r'<script type="application/json" id="taxonomy">(.*?)</script>',taxonomy_html,re.S)[1])
 def tags(nodes,path=''):
  from urllib.parse import quote
  for node in nodes:
   trail=(path+' → ' if path else '')+node['label']
   add('Tag catalogue',trail,node.get('description',''),'tag-map.html?q='+quote(node['label']),None,node.get('source_url'),'Recommended vocabulary, not an event claim')
   tags(node.get('children',[]),trail)
 tags(taxonomy)
 # Only the explicit link metadata is indexed; never fetch or copy the PDFs.
 source_text=(ROOT/'bos-resources.js').read_text()
 bos=json.loads(re.search(r'const sources=(\[.*?\]);',source_text,re.S)[1])
 for item in bos:add('External research PDF',item['title'],item['scope'],item['url'],item['date'],item['url'],'Dated link only; indicative previous-business-day prices, not live or automatic')
 counts={k:sum(x['kind']==k for x in rows) for k in sorted({x['kind'] for x in rows})}
 payload={'schema_version':2,'built_at':datetime.now(timezone.utc).isoformat(),'counts':counts,'limits':'Public saved content only. No external article bodies, private chats, linked PDFs, tool outputs or local-browser imports. All saved daily headlines and archived snapshots are included, not just the first 80 displayed. Directory dates can be unknown. Search does not refresh financial data. Some JavaScript-only views are represented by section entries rather than every displayed sentence.','entries':rows}
 (ROOT/'data/site-search.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')))
 return payload
if __name__=='__main__':
 d=build();print(json.dumps({'count':len(d['entries']),'counts':d['counts']}))
