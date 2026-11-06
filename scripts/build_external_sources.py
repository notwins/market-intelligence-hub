#!/usr/bin/env python3
"""Build the public link directory from explicit public metadata. No network I/O."""
import hashlib,json,re
from collections import Counter
from pathlib import Path
from urllib.parse import urlsplit
from extract_recent_sources import canonical_url, PUBLISHERS, PublicAnchorParser
from index_external_source_usage import collect
ROOT=Path(__file__).resolve().parents[1]
PROVIDERS={**PUBLISHERS,'gic.com.sg':'GIC','mas.gov.sg':'MAS','temasek.com.sg':'Temasek','newyorkfed.org':'Federal Reserve Bank of New York','chicagofed.org':'Federal Reserve Bank of Chicago','atlantafed.org':'Federal Reserve Bank of Atlanta','frbsf.org':'Federal Reserve Bank of San Francisco','minneapolisfed.org':'Federal Reserve Bank of Minneapolis','richmondfed.org':'Federal Reserve Bank of Richmond','stlouisfed.org':'Federal Reserve Bank of St. Louis','ecb.europa.eu':'European Central Bank','snb.ch':'Swiss National Bank','boj.or.jp':'Bank of Japan','rba.gov.au':'Reserve Bank of Australia','hkma.gov.hk':'Hong Kong Monetary Authority','bondsupermart.com':'Bondsupermart','google.com':'Google','cnbc.com':'CNBC','cmegroup.com':'CME Group','am.jpmorgan.com':'J.P. Morgan Asset Management','mufgamericas.com':'MUFG','ssga.com':'State Street','spglobal.com':'S&P Global','moodys.io':"Moody’s",'fitchratings.com':'Fitch Ratings','tradingeconomics.com':'Trading Economics','macromicro.me':'MacroMicro','brookings.edu':'Brookings','oecd.org':'OECD','nber.org':'NBER','piie.com':'Peterson Institute','cfr.org':'Council on Foreign Relations','cepr.org':'CEPR','goldmansachs.com':'Goldman Sachs','morganstanley.com':'Morgan Stanley','citivelocity.com':'Citi','ubs.com':'UBS','credit-suisse.com':'Credit Suisse','financialresearch.gov':'Office of Financial Research','bea.gov':'Bureau of Economic Analysis','cbo.gov':'Congressional Budget Office','gov.uk':'UK Government','data.gov':'Data.gov','bls.gov':'Bureau of Labor Statistics','census.gov':'U.S. Census Bureau','statcan.gc.ca':'Statistics Canada'}
def provider(url):
 host=urlsplit(url).hostname
 for suffix,name in [('dbs.com','DBS'),('ocbc.com','OCBC'),('uobgroup.com','UOB'),('uob.com.sg','UOB')]:
  if host==suffix or host.endswith('.'+suffix):return name
 return next((v for k,v in sorted(PROVIDERS.items(),key=lambda p:-len(p[0])) if host==k or host.endswith('.'+k)),host)
def build(root=ROOT):
 site=root/'site';rows={}
 def add(raw,origin,priority):
  url,reason=canonical_url(raw.get('url'))
  if not url:raise ValueError(f'Unsafe directory URL: {reason}')
  item={**raw,'url':url,'domain':urlsplit(url).hostname,'provider':provider(url),'id':'ext-'+hashlib.sha256(url.encode()).hexdigest()[:16],'groups':list(dict.fromkeys(raw.get('groups',[]))),'origins':[origin],'priority':priority}
  if url in rows:
   old=rows[url];old['groups']=list(dict.fromkeys(old['groups']+item['groups']));old['origins']=list(dict.fromkeys(old['origins']+[origin]))
   # Merge exact edition IDs without counting repeated appearances in one report twice.
   refs={r['id']:r for r in old.get('references',[])}
   for ref in item.get('references',[]):
    if ref['id'] in refs and refs[ref['id']]['date']!=ref['date']:raise ValueError('Conflicting saved edition dates')
    refs.setdefault(ref['id'],ref)
   if refs:
    old['references']=sorted(refs.values(),key=lambda r:(r['date'],r['id']))
    old['first_referenced']=min(r['date'] for r in refs.values());old['last_referenced']=max(r['date'] for r in refs.values());old['reference_count']=len(refs)
   if item.get('access_check'):
    old['additional_access_check']=item['access_check']
    if old['status']=='not_rechecked':old['status']='limited';old['checked_on']=item['checked_on'];old['note']+=' '+item['note']
   return
  rows[url]=item
 seeds=json.loads((site/'data/external-source-seeds.json').read_text())
 for index,row in enumerate(seeds['records']):add(row,'Curated sources',0 if index<18 else 1)
 bank=site/'data/external-bank-sources.json'
 if bank.is_file():
  for row in json.loads(bank.read_text())['records']:add(row,'User-supplied bank sources',0)
 securities=json.loads((site/'data/securities.json').read_text())
 for row in securities['stocks']:
  add(dict(url=row['url'],title=f"{row['ticker']} · {row['name']}",type='Stock factsheet',groups=['Equities',row['sector']],status='not_rechecked',note='Saved stock reference. Current listing status, quote and page availability have not been rechecked.'),'Security directory',4)
 for row in securities['bonds']:
  add(dict(url=row['url'],title=row['name'],type='Bond factsheet',groups=['Rates & bonds',row.get('currency') or 'Currency unspecified',row.get('kind') or 'Bonds'],status='not_rechecked',note='Saved instrument label, not a current price or yield. Verify terms, maturity and current status with the provider.'),'Security directory',4)
 bos=json.loads(re.search(r'const sources=(\[.*?\]);',(site/'bos-resources.js').read_text(),re.S).group(1))
 for row in bos:add(dict(url=row['url'],title=row['title'],type='PDF',groups=['Bank research','Equities' if row['kind']=='equities' else 'Rates & bonds'],report_date=row['date'],status='not_rechecked',note='Previously identified dated edition. Not an automatically updated or live-price link. Publisher access conditions may apply.'),'BOS references',1)
 company=json.loads((site/'data/watchlist/company-resources.json').read_text())
 for ticker,row in company['companies'].items():add(dict(url=row['url'],title=f"{ticker} · Morningstar research hosted by BOS",type='PDF',groups=['Equities','Company research'],report_date=row['report_date'],checked_on=company['verified_on'],status='page_verified',note='Publisher and report date checked in the original PDF. Author: Morningstar. Host: Bank of Singapore. No PDF copy or licensed content is hosted here.'),'Company research references',2)
 recent=json.loads((site/'data/recent-public-sources.json').read_text())
 type_groups={'daily_news':'Daily briefings','hourly_report':'Hourly news','watchlist_report':'Company research','credit_report':'Credit research','curated_report':'Research reports','research_module':'Research explained'}
 for row in recent['sources']:
  refs=row['references'];redirect=row['link_type']=='google_news_redirect' or row['domain']=='news.google.com'
  add(dict(url=row['url'],title=row['title'],type='News redirect' if redirect else 'PDF' if '.pdf' in urlsplit(row['url']).path.lower() else 'Saved source',groups=list(dict.fromkeys(['Recently referenced']+[type_groups.get(x['type'],'Research reports') for x in refs])),status='not_rechecked',note='Saved Google News redirect; final publisher destination has not been resolved.' if redirect else 'Saved public reference; current page availability and contents have not been rechecked.',references=refs,first_referenced=row['first_referenced'],last_referenced=row['last_referenced'],reference_count=row['reference_count']),'Recent public reports',3)
 supplement=json.loads((site/'data/supplemental-public-sources.json').read_text())
 for row in supplement['records']:add(row,'Saved report citations',3)
 # Explicit newly published article editions. Only original external anchors, never bodies or uploads.
 articles=[('wealth-inequality-2026-11-04','Top 1% wealth inequality research',['Wealth research','Economics']),('cpf-oa-temasek-2070-2026-11-04','CPF OA and Temasek 2070 research',['Singapore','Rates & bonds','Retirement research'])]
 for slug,title,groups in articles:
  path=f'research/{slug}/index.html';page=site/path
  if not page.exists():continue
  content=page.read_text()
  if '4 November 2026' not in content:raise ValueError('Expected explicit article edition date is missing')
  parser=PublicAnchorParser();parser.feed(content);seen=set()
  for raw,label,_ in parser.links:
   url,reason=canonical_url(raw)
   if not url or url in seen:continue
   seen.add(url);label=re.sub(r'^\[[A-Z]?\d+\]\s*','',label).strip() or provider(url)+' source'
   ref={'id':'article:'+slug,'date':'2026-11-04','type':'curated_report','title':title,'path':path,'date_basis':'Explicit public article edition date'}
   add(dict(url=url,title=label,type='PDF' if '.pdf' in urlsplit(url).path.lower() else 'Saved source',groups=['Recently referenced','Research reports']+groups,status='not_rechecked',note='Original external citation saved in a public research article. Current source availability and contents have not been rechecked for this directory.',references=[ref],first_referenced='2026-11-04',last_referenced='2026-11-04',reference_count=1),'Published research articles',3)
 usage,usage_coverage=collect(site)
 for item in usage:
  url=item['url'];redirect=urlsplit(url).hostname=='news.google.com'
  add(dict(url=url,title=item['title'],type='News redirect' if redirect else 'PDF' if '.pdf' in urlsplit(url).path.lower() else 'Saved source',groups=item['groups'],status='not_rechecked',note='Saved Google News redirect; final publisher destination has not been resolved.' if redirect else 'External link indexed from public Hub content. Current provider availability and contents have not been rechecked for this directory.'),'Current public Hub content',3)
  row=rows[url];row.setdefault('usages',{})[item['usage']['id']]=item['usage']
 for row in rows.values():
  current=row.get('usages',{})
  row['usages']=sorted(current.values(),key=lambda r:(r['type'],r['title'],r['id']))
  row['usage_count']=len(row['usages'])
 refs=[r for r in rows.values() if r.get('references')]
 editions={ref['id']:ref for r in refs for ref in r['references']}
 statistics={'unique_sources':len(refs),'saved_editions':len(editions),'source_edition_references':sum(r['reference_count'] for r in refs)}
 coverage={**recent['coverage'],'edition_counts':dict(sorted(Counter(r['type'] for r in editions.values()).items()))}
 return {'schema_version':2,'built_on':'2026-11-06','coverage':coverage,'usage_coverage':usage_coverage,'usage_statistics':{'sources_with_usage':sum(bool(r['usages']) for r in rows.values()),'source_usages':sum(r['usage_count'] for r in rows.values()),'public_destinations':len({u['id'] for r in rows.values() for u in r['usages']})},'reference_window':recent['date_range'],'reference_statistics':statistics,'initial_snapshot_statistics':recent['statistics'],'records':list(rows.values())}
if __name__=='__main__':
 data=build();path=ROOT/'site/data/external-sources.json';path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n');print(f"Built {len(data['records'])} canonical source records")
