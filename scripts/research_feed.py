"""Append-only future research contract. Legacy editions are never migrated.

Editorial completeness/privacy/rights are trusted reviewer decisions, not inferred
from file length. This gate binds that decision to exact metadata and public files.
"""
import hashlib, json, re
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
from validate_research_contracts import validate_document

ROOT=Path(__file__).resolve().parents[1]
SGT=timezone(timedelta(hours=8))
ID=r'[a-z][a-z0-9-]*-\d{4}-\d{2}-\d{2}(?:-r[1-9][0-9]*)?'
CORE={'id','title','cutoff_sgt','category','tags','summary','kind','full_report_url','full_report_sha256','quick_read','assets'}
def require(ok,message):
    if not ok: raise ValueError(message)
def unique(pairs):
    d={}
    for k,v in pairs:
        require(k not in d,'Duplicate JSON key: '+k);d[k]=v
    return d
def read(path):return json.loads(Path(path).read_text(encoding='utf-8'),object_pairs_hook=unique)
def canonical(value):return (json.dumps(value,sort_keys=True,ensure_ascii=False,separators=(',',':'))+'\n').encode()
def digest(data):return hashlib.sha256(data).hexdigest()
def timestamp(value):
    require(isinstance(value,str) and re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00',value),'Exact Singapore timestamp required')
    return datetime.fromisoformat(value)
def safe_text(text,maximum=1200):
    require(isinstance(text,str) and 0<len(text.strip())<=maximum,'Empty/oversized public metadata')
    require(not re.search(r'[<>]|https?://|file:|[A-Z]:\\|\b(?:client name|account ending|api[_ -]?key)\b|[\w.+-]+@[\w.-]+',text,re.I),'Private or unsafe public metadata')
def safe_name(name):return isinstance(name,str) and bool(re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]*(?:\.[A-Za-z0-9_-]+)*\.(?:html|pdf|png|jpg|jpeg|webp|css|js)',name)) and '..' not in name

class Links(HTMLParser):
    def __init__(self,text):super().__init__();self.urls=[];self.ids=set();self.feed(text)
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        if 'id' in d:self.ids.add(d['id'])
        for k in ('href','src','poster'):
            if k in d:self.urls.append((tag,k,d[k]))
        require('srcset' not in d,'Use individually manifested image sources')
        require(tag not in ('base','form','object','embed'),'Unsupported active report element')

def validate_report(record,folder,standard,tags):
    require(isinstance(record,dict) and set(record)==CORE,'Unexpected/missing report fields')
    rid=record['id'];require(isinstance(rid,str) and re.fullmatch(ID,rid),'Stable dated edition ID required')
    cutoff=timestamp(record['cutoff_sgt']);require(cutoff<=datetime.now(SGT),'Future report cutoff')
    require(cutoff.date().isoformat() in rid,'ID date differs from cutoff')
    require(record['kind']=='complete-report','A summary/extract cannot replace a complete report')
    for name in ('title','summary','category'):safe_text(record[name])
    require(isinstance(record['tags'],list) and 0<len(record['tags'])<=12 and len(set(record['tags']))==len(record['tags']) and set(record['tags'])<=set(tags),'Unknown/duplicate tags')
    prefix='research/'+rid+'/'
    require(record['full_report_url']==prefix+'index.html','Full report must use its own dated HTML destination')
    assets=record['assets'];require(isinstance(assets,dict) and 'index.html' in assets and len(assets)<=100,'Explicit asset manifest required')
    folder=Path(folder).resolve();actual={p.name for p in folder.iterdir() if p.is_file()}
    require(actual==set(assets),'Unmanifested or missing report file')
    require(all(p.is_file() and not p.is_symlink() for p in folder.iterdir()),'Directories/symlinks not accepted in report bundle')
    require(sum((folder/n).stat().st_size for n in actual)<=50_000_000,'Report bundle exceeds 50 MB')
    for name,expected in assets.items():
        require(safe_name(name),'Unsafe asset path')
        require(isinstance(expected,str) and re.fullmatch('[a-f0-9]{64}',expected),'Invalid asset hash')
        data=(folder/name).read_bytes();require(digest(data)==expected,'Asset hash mismatch: '+name)
        if name.lower().endswith('.pdf'):require(data.startswith(b'%PDF-') and b'%%EOF' in data[-1024:],'Invalid PDF envelope')
        if name.lower().endswith(('.html','.js','.css')):
            text=data.decode('utf-8')
            require(not re.search(r'chatgpt\.com/(?:c|g|space|library)/|chat\.openai\.com/|file://|C:\\Users\\|sediment://|file-service|\b(?:client name|account ending|api[_ -]?key)\b',text,re.I),'Private origin or input in public asset')
            if name.lower().endswith('.html'):
                require('<!doctype html>' in text.lower() and '</html>' in text.lower(),'Incomplete HTML envelope')
                contract=validate_document(text,standard)
                if name=='index.html':require(contract['cutoff']==record['cutoff_sgt'],'Record cutoff differs from full report')
                parsed=Links(text)
                for tag,key,url in parsed.urls:
                    u=urlsplit(url)
                    if u.scheme or u.netloc:
                        require(tag=='a' and key=='href' and u.scheme=='https' and u.hostname and not u.username and not u.password,'Remote active asset or unsafe URL')
                    else:
                        require(not u.query and '%' not in u.path and '\\' not in u.path and not u.path.startswith('/'),'Noncanonical local destination')
                        require(not u.path or u.path in assets,'Unmanifested local destination: '+url)
                        if u.fragment:
                            target=(folder/(u.path or name)).read_text(encoding='utf-8')
                            require(unquote(u.fragment) in Links(target).ids,'Missing destination fragment')
    require(record['full_report_sha256']==assets['index.html'],'Full-report hash mismatch')
    brief=record['quick_read']
    if brief is not None:
        require(isinstance(brief,dict) and set(brief)=={'edition_id','full_report_sha256','url','sha256'},'Unexpected brief fields')
        require(brief['edition_id']==rid and brief['full_report_sha256']==record['full_report_sha256'],'Brief belongs to another report edition')
        require(brief['url'].startswith(prefix),'Brief destination outside edition')
        name=brief['url'][len(prefix):]
        require(name!='index.html' and name in assets and name.endswith(('.html','.pdf')) and assets[name]==brief['sha256'],'Unverified/missing matching brief')
    return record

def validate_review(record,review):
    require(set(review)=={'record_sha256','approved_at_sgt','complete','public_safe','rights_cleared','reviewer'},'Explicit private review receipt required')
    require(review['record_sha256']==digest(canonical(record)),'Review does not bind exact report record')
    require(all(review[x] is True for x in ('complete','public_safe','rights_cleared')),'Completeness, privacy and rights must be approved')
    require(isinstance(review['reviewer'],str) and bool(review['reviewer'].strip()),'Review owner required')
    approved=timestamp(review['approved_at_sgt']);require(timestamp(record['cutoff_sgt'])<=approved<=datetime.now(SGT),'Invalid approval timestamp')
    return {'record':record,'verified_at_sgt':review['approved_at_sgt'],'review_sha256':digest(canonical(review))}

def collect(site):
    site=Path(site);standard=read(site/'data/colour-templates-v3.json');tags={r['id']:r for r in read(site/'data/external-source-standard.json')['tags']}
    legacy=read(site/'data/research-register.json')['entries']
    ids={r['id'] for r in legacy};urls={(r.get('href') or '').rstrip('/') for r in legacy};hashes={r.get('sha256') for r in legacy}
    rows=[]
    for path in sorted((site/'data/research-records').glob('*.json')):
        require(not path.is_symlink(),'Record symlink');row=read(path)
        require(set(row)=={'record','verified_at_sgt','review_sha256'},'Unexpected public receipt fields')
        r=row['record'];require(path.name==r['id']+'.json','Record filename mismatch')
        validate_report(r,site/'research'/r['id'],standard,tags)
        require(timestamp(r['cutoff_sgt'])<=timestamp(row['verified_at_sgt'])<=datetime.now(SGT),'Invalid verification time')
        require(re.fullmatch('[a-f0-9]{64}',row['review_sha256'] or ''),'Review receipt hash required')
        require(r['id'] not in ids and r['full_report_url'][:-len('/index.html')] not in urls and r['full_report_sha256'] not in hashes,'Duplicate edition or report bytes')
        ids.add(r['id']);urls.add(r['full_report_url'][:-len('/index.html')]);hashes.add(r['full_report_sha256']);rows.append(row)
    rows.sort(key=lambda x:(x['record']['cutoff_sgt'],x['record']['id']),reverse=True)
    return rows,tags

def compile_feed(site):
    rows,tags=collect(site)
    records=[{**r['record'],'verified_at_sgt':r['verified_at_sgt']} for r in rows]
    used=sorted({t for r in records for t in r['tags']})
    return {'schema_version':1,'generation':len(records),'revision':digest(canonical(records)),
            'verified_at_sgt':max((r['verified_at_sgt'] for r in records),default=None),
            'records':records,'tags':{key:tags[key] for key in used}}

def build(site):
    site=Path(site);feed=compile_feed(site);data=canonical(feed)
    # A source error fails before any derived output is replaced. The deployed
    # last-good artifact remains intact; no empty/error feed is manufactured.
    (site/'data/research-feed.json').write_bytes(data)
    safe=data.decode().replace('<','\\u003c').replace('\u2028','\\u2028').replace('\u2029','\\u2029')
    (site/'data/research-feed-bootstrap.js').write_text('window.MIH_RESEARCH_FEED='+safe.strip()+';\n',encoding='utf-8')
    return feed

if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser();p.add_argument('--site',type=Path,default=ROOT/'site');a=p.parse_args()
    f=build(a.site);print(json.dumps({'reports':len(f['records']),'revision':f['revision']}))
