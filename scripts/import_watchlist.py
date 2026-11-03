#!/usr/bin/env python3
"""Validate and import approved public watchlist research. Does not fetch or invent data."""
import argparse, datetime as dt, json, math, re, os, ipaddress, calendar
from pathlib import Path
from urllib.parse import urlparse
TICKERS=['AAPL','MSFT','NVDA','GOOGL','AMZN','META','BRK.B','AMD','AVGO','MU','TSLA','TSM']
def fail(ok, message):
    if not ok: raise ValueError(message)
def stamp(s):
    fail(isinstance(s,str),'Timestamp must be a string')
    try: d=dt.datetime.fromisoformat(s.replace('Z','+00:00'))
    except ValueError: raise ValueError('Invalid timestamp')
    fail(d.tzinfo is not None,'Timestamp must include timezone')
    return d

def public_url(s):
    p=urlparse(s)
    fail(p.scheme=='https' and p.hostname and not p.username and not p.password,'Source must be public HTTPS')
    host=p.hostname.lower().rstrip('.')
    fail(not any(host==x or host.endswith('.'+x) for x in ['localhost','local','chatgpt.com']),'Private/chat source is not publishable')
    try:address=ipaddress.ip_address(host)
    except ValueError:address=None
    fail(address is None or address.is_global,'Private IP source is not publishable')
    return s

def exact_keys(obj, allowed, where):
    fail(isinstance(obj,dict),where+' must be an object')
    fail(not set(obj)-set(allowed),where+' contains unsupported fields')

def text(s, where, maximum=6000):
    fail(isinstance(s,str) and bool(s.strip()) and len(s)<=maximum,where+' must be bounded nonempty text')

def number(n, where, positive=False):
    fail(isinstance(n,(int,float)) and not isinstance(n,bool) and math.isfinite(n),where+' must be finite')
    if positive: fail(n>0,where+' must be positive')

def validate(d, now=None):
    exact_keys(d,{'schema_version','id','as_of','generated_at','title','public_research_only','verification','summary','coverage_note','price_basis','return_basis','caveats','rows'},'Edition')
    fail(d.get('schema_version')==1,'Unsupported schema')
    fail(re.fullmatch(r'watchlist-\d{8}T\d{6}Z(?:-r[1-9][0-9]*)?',d.get('id','')),'Unsafe edition ID')
    asof=stamp(d['as_of']); generated=stamp(d['generated_at']); now=now or dt.datetime.now(dt.timezone.utc)
    fail(asof<=generated<=now+dt.timedelta(minutes=5),'Future/inconsistent edition timestamps')
    fail(d.get('public_research_only') is True,'Public research approval missing')
    exact_keys(d['verification'],{'sources_checked_at','prices_verified','research_verified'},'Verification')
    verified=stamp(d['verification']['sources_checked_at'])
    fail(asof<=verified<=generated,'Verification must follow cutoff and precede generation')
    fail(d['verification'].get('prices_verified') is True,'Unverified prices')
    for key in ['title','summary','coverage_note','price_basis','return_basis']: text(d[key],key)
    fail(isinstance(d['caveats'],list),'Caveats must be a list')
    for value in d['caveats']: text(value,'Caveat')
    fail(isinstance(d.get('rows'),list) and len(d['rows'])==12,'Exactly 12 watchlist rows required')
    fail([r.get('ticker') for r in d['rows']]==TICKERS,'Tickers must match the approved 12-name order')
    for r in d['rows']:
        exact_keys(r,{'ticker','name','group','instrument','price','premarket','returns','research','gaps','sources'},'Row')
        for key in ['name','group','instrument']: text(r[key],key)
        fail(r['group'] in ['Platforms','Semiconductors','Other'],'Invalid group')
        p=r['price']; exact_keys(p,{'close','adjusted_close','previous_close','change_pct','as_of','currency','source_url'},'Price')
        for key in ['close','adjusted_close','previous_close']: number(p[key],key,True)
        number(p['change_pct'],'day change')
        fail(abs((p['close']/p['previous_close']-1)*100-p['change_pct'])<=.025,'Day change does not match price basis')
        fail(p['currency']=='USD','All watchlist prices must be USD')
        fail(stamp(p['as_of'])<=asof,'Price newer than cutoff')
        public_url(p['source_url'])
        if r['premarket'] is not None:
            pre=r['premarket']; exact_keys(pre,{'price','change_pct','as_of','source_url'},'Premarket')
            number(pre['price'],'Premarket',True);number(pre['change_pct'],'Premarket change')
            fail(stamp(p['as_of'])<stamp(pre['as_of'])<=asof,'Premarket timestamp outside cutoff')
            fail(abs((pre['price']/p['close']-1)*100-pre['change_pct'])<=.025,'Premarket change does not match close')
            public_url(pre['source_url'])
        fail(isinstance(r['returns'],list) and len(r['returns'])==6,'Six return horizons required')
        for i,q in enumerate(r['returns'],1):
            exact_keys(q,{'months','base_date','base_adjusted_close','pct','source_url'},'Return')
            fail(q['months']==i,'Return horizons must be 1 to 6 months')
            fail(re.fullmatch(r'\d{4}-\d{2}-\d{2}',q['base_date']) and dt.date.fromisoformat(q['base_date'])<stamp(p['as_of']).date(),'Invalid return base date')
            number(q['base_adjusted_close'],'Return baseline',True);number(q['pct'],'Return percentage')
            fail(abs((p['adjusted_close']/q['base_adjusted_close']-1)*100-q['pct'])<=.025,'Return does not match adjusted-close inputs')
            end=stamp(p['as_of']).date();month_index=end.year*12+end.month-1-i;year,month=divmod(month_index,12);month+=1
            target=dt.date(year,month,min(end.day,calendar.monthrange(year,month)[1]))
            fail(0<=(target-dt.date.fromisoformat(q['base_date'])).days<=7,'Return baseline must be target calendar month or preceding trading session within seven days')
            public_url(q['source_url'])
        fail(isinstance(r['sources'],list) and r['sources'],'Sources missing')
        for source in r['sources']:
            exact_keys(source,{'title','url'},'Source');text(source['title'],'Source title');public_url(source['url'])
        fail(isinstance(r['gaps'],list),'Gaps must be a list')
        for value in r['gaps']:text(value,'Gap')
        fail(isinstance(r['research'],list),'Research must be a list')
        if r['research']:fail(d['verification'].get('research_verified') is True,'Narrative research is not verified')
        for x in r['research']:
            exact_keys(x,{'date','headline','facts','analysis','risks','next_watch','sources'},'Research item')
            fail(re.fullmatch(r'\d{4}-\d{2}-\d{2}',x['date']) and dt.date.fromisoformat(x['date'])<=asof.date(),'Research date invalid')
            for key in ['headline','analysis','risks','next_watch']:text(x[key],key)
            fail(isinstance(x['facts'],list) and x['facts'],'Verified facts missing')
            for f in x['facts']:text(f,'Fact')
            fail(isinstance(x['sources'],list) and x['sources'],'Research evidence missing')
            for s in x['sources']:
                exact_keys(s,{'title','url'},'Research source');text(s['title'],'Source title');public_url(s['url'])
    return d

def write_json(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_suffix('.tmp');tmp.write_bytes((json.dumps(data,ensure_ascii=False,indent=2)+'\n').encode('utf-8'));os.replace(tmp,path)

def import_edition(data, root):
    d=validate(data); folder=Path(root)/'data'/'watchlist';archive=folder/'archive'/(d['id']+'.json')
    if archive.exists():
        fail(json.loads(archive.read_text())==d,'Refusing to overwrite an existing edition; use a revision ID')
    else:write_json(archive,d)
    index_path=folder/'index.json';index=json.loads(index_path.read_text()) if index_path.exists() else {'schema_version':1,'editions':[]}
    if not any(x['id']==d['id'] for x in index['editions']):
        index['editions'].append({'id':d['id'],'as_of':d['as_of'],'title':d['title'],'path':'data/watchlist/archive/'+d['id']+'.json'})
    index['editions'].sort(key=lambda x:(stamp(x['as_of']),int(x['id'].rsplit('-r',1)[1]) if '-r' in x['id'] else 0),reverse=True)
    index['latest_id']=index['editions'][0]['id'];write_json(index_path,index)
    latest=json.loads((folder/'archive'/(index['latest_id']+'.json')).read_text());write_json(folder/'latest.json',latest)
    return archive
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--input',required=True);parser.add_argument('--root',default='site');parser.add_argument('--validate-only',action='store_true');a=parser.parse_args();d=json.loads(Path(a.input).read_text())
    if a.validate_only:validate(d);print('Valid public watchlist edition')
    else:print(import_edition(d,a.root))
