#!/usr/bin/env python3
"""Import one explicitly approved public call with a full point-of-call report."""
import argparse,datetime as dt,json,re
from pathlib import Path
from import_watchlist import exact_keys,fail,stamp,text,public_url,write_json,TICKERS

def validate_call(d):
    exact_keys(d,{'schema_version','id','ticker','called_at','recorded_at','call_type','summary','public_approval','report'},'Call')
    fail(d.get('schema_version')==1 and d.get('public_approval') is True,'Explicit public call approval required')
    fail(re.fullmatch(r'call-[a-z0-9-]+',d.get('id','')),'Unsafe call ID')
    fail(d['ticker'] in TICKERS,'Unknown watchlist ticker')
    fail(d['call_type'] in ['Watch','Buy thesis','Hold thesis','Sell thesis','Review'],'Unknown call classification')
    fail(stamp(d['called_at'])<=stamp(d['recorded_at'])<=dt.datetime.now(dt.timezone.utc)+dt.timedelta(minutes=5),'Invalid call time')
    text(d['summary'],'Call summary')
    r=d['report'];exact_keys(r,{'title','as_of','created_at','visibility','quote_date','financial_period_end','period_basis','provenance','sections','sources'},'Call report');text(r['title'],'Report title')
    fail(stamp(r['as_of'])<=stamp(d['called_at']),'Point-of-call report cannot contain later evidence')
    fail(r['visibility']=='public','Private evidence cannot be imported into a public call')
    fail(stamp(r['as_of'])<=stamp(r['created_at'])<=stamp(d['recorded_at']),'Invalid report creation time')
    for key in ['quote_date','financial_period_end']:
        fail(r[key] is None or (isinstance(r[key],str) and re.fullmatch(r'\d{4}-\d{2}-\d{2}',r[key]) and dt.date.fromisoformat(r[key])<=stamp(r['as_of']).date()),'Invalid '+key)
    text(r['period_basis'],'Financial period basis');text(r['provenance'],'Evidence provenance')
    fail(isinstance(r['sections'],list) and len(r['sections'])>=3,'A full report must contain at least three sections')
    for s in r['sections']:
        exact_keys(s,{'heading','body'},'Report section');text(s['heading'],'Report heading');text(s['body'],'Report body',20000)
    fail(isinstance(r['sources'],list) and bool(r['sources']),'Report sources required')
    for s in r['sources']:
        exact_keys(s,{'title','url'},'Report source');text(s['title'],'Source title');public_url(s['url'])
    return d

def import_call(d,root):
    d=validate_call(d);folder=Path(root)/'data'/'watchlist'/'calls';p=folder/(d['id']+'.json')
    if p.exists():fail(json.loads(p.read_text())==d,'Original calls are immutable; append a new dated review')
    else:write_json(p,d)
    index=folder.parent/'calls.json';old=json.loads(index.read_text()) if index.exists() else {'schema_version':1,'calls':[]}
    if not any(c['id']==d['id'] for c in old['calls']):old['calls'].append(d)
    old['calls'].sort(key=lambda c:c['called_at'],reverse=True);write_json(index,old)
    return p
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--input',required=True);p.add_argument('--root',default='site');p.add_argument('--validate-only',action='store_true');a=p.parse_args();d=json.loads(Path(a.input).read_text())
    if a.validate_only:validate_call(d);print('Valid approved public call')
    else:print(import_call(d,a.root))
