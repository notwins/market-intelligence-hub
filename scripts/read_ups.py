"""Short, reviewed read-ups. Private review/evidence never enter the public tree."""
import hashlib, html, json, re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
from research_feed import read, canonical, digest, require

SGT=timezone(timedelta(hours=8))
BASE='https://notwins.github.io/market-intelligence-content/'
FIELDS={'id','revision','kind','published_at','title','takeaway','happened','matters','watch','sources','primary','word_count'}

def stamp(value):
    require(isinstance(value,str) and bool(re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00',value)),'SGT publication/check timestamp required')
    date=datetime.fromisoformat(value);require(date<=datetime.now(SGT),'Future timestamp');return date

def url(value, reuters=False):
    require(isinstance(value,str) and len(value)<=3000 and not re.search(r'[\s\\\x00-\x1f]',value),'Invalid source URL')
    u=urlsplit(value)
    require(u.scheme=='https' and u.hostname and not u.username and not u.password and u.port in (None,443),'Public HTTPS link required')
    host=u.hostname.lower().removeprefix('www.')
    require('.' in host and host not in ('localhost','example.invalid') and not re.fullmatch(r'[\d.]+',host),'Public source host required')
    require(not host.endswith(('.local','.invalid')) and host not in ('chatgpt.com','chat.openai.com'),'Private source forbidden')
    if reuters:require(host=='reuters.com' and len(u.path.strip('/').split('/'))>=2,'Resolved original Reuters ARTICLE required')
    return urlunsplit(('https',host,u.path.rstrip('/'),urlencode(sorted((k,v) for k,v in parse_qsl(u.query) if not k.lower().startswith('utm_') and k not in ('gclid','fbclid','oc'))),''))

def text(value, maximum):
    require(isinstance(value,str) and 0<len(value.strip())<=maximum and not re.search(r'[<>\x00-\x08]|file://|[A-Z]:\\|chatgpt\.com/|\b(?:api[_ -]?key|account ending|client name)\b',value,re.I),'Invalid or private public text')

def scope(sources):return digest(canonical(sorted({url(s['original_url'],True) for s in sources})))[:24]
def destination(r):return 'read-ups/'+r['id']+'/r'+str(r['revision'])+'.html'

def validate(r):
    require(isinstance(r,dict) and set(r)==FIELDS,'Unknown/missing read-up fields (demo/private fields forbidden)')
    require(r['kind']=='reuters-read-up' and re.fullmatch(r'read-up-[a-f0-9]{24}',r['id'] or ''),'Invalid read-up identity')
    require(type(r['revision']) is int and 1<=r['revision']<=10000,'Invalid revision')
    stamp(r['published_at'])
    for k,n in [('title',180),('takeaway',500),('happened',10000),('matters',10000),('watch',10000)]:text(r[k],n)
    require(not re.search(r'fictional|invented example|demo fixture',r['title']+' '+r['takeaway'],re.I),'Rehearsal content forbidden')
    require(isinstance(r['sources'],list) and 1<=len(r['sources'])<=12,'Select 1-12 sources')
    require(isinstance(r['primary'],list) and len(r['primary'])<=10,'Invalid primary sources')
    for key,prefix,fields in [('sources','S',{'id','title','original_url','accessed_url'}),('primary','P',{'id','title','url'})]:
        for i,s in enumerate(r[key],1):
            require(isinstance(s,dict) and set(s)==fields and s['id']==prefix+str(i),'Invalid source identity/fields')
            text(s['title'],500)
            if prefix=='S':url(s['original_url'],True);url(s['accessed_url'])
            else:url(s['url'])
    require(len({url(s['original_url'],True) for s in r['sources']})==len(r['sources']),'Duplicate original article')
    require(r['id']=='read-up-'+scope(r['sources']),'Identity must match exact original article set')
    refs={s['id'] for s in r['sources']+r['primary']};used=set()
    for k in ('happened','matters','watch'):
        for p in filter(str.strip,r[k].split('\n\n')):
            found=set(re.findall(r'\[([SP]\d+)\]',p));require(found and found<=refs,'Missing/unknown paragraph citation');used|=found
    require({s['id'] for s in r['sources']}<=used,'Selected story silently omitted')
    require(r['matters'].startswith('Our interpretation:') and r['watch'].startswith('Our watch points:'),'Label interpretation and watch points')
    words=len(re.findall(r"\b[\w’'-]+\b",' '.join(r[k] for k in ('title','takeaway','happened','matters','watch'))))
    require(type(r['word_count']) is int and r['word_count']==words and words<=(350 if len(r['sources'])==1 else 600),'Invalid/excess word count')
    return r

def review(record, evidence, receipt):
    validate(record)
    require(isinstance(evidence,dict) and set(evidence)=={'selected_ids','sources'},'Private selected-source evidence required')
    require(isinstance(evidence['selected_ids'],list) and len(set(evidence['selected_ids']))==len(record['sources'])==len(evidence['selected_ids']),'Exact selection required')
    require(len(evidence['sources'])==len(record['sources']),'Source evidence missing')
    for public,private in zip(record['sources'],evidence['sources']):
        require(set(private)=={'id','article_id','original_url','accessed_url','checked_at','notes','status'},'Invalid private evidence')
        require(private['id']==public['id'] and private['article_id'] in evidence['selected_ids'] and private['status']=='verified','Unverified or unrelated source')
        require(all(private[k]==public[k] for k in ('original_url','accessed_url')),'Source link mismatch')
        stamp(private['checked_at']);require(isinstance(private['notes'],str) and bool(private['notes'].strip()),'Article verification notes required')
    require(len({s['article_id'] for s in evidence['sources']})==len(record['sources']),'Duplicate selected source')
    require(isinstance(receipt,dict) and set(receipt)=={'record_sha256','evidence_sha256','approved_at','reviewer','checks'},'Private trusted CLI review required')
    require(receipt['record_sha256']==digest(canonical(record)) and receipt['evidence_sha256']==digest(canonical(evidence)),'Stale approval')
    require(receipt['checks']=={'facts':True,'exact_selection':True,'privacy':True,'rights':True,'editorial':True},'Review not complete')
    require(isinstance(receipt['reviewer'],str) and bool(receipt['reviewer'].strip()),'Reviewer required');require(stamp(receipt['approved_at'])>=stamp(record['published_at']),'Approval predates record')
    return {'record':record,'verified_at':receipt['approved_at'],'review_sha256':digest(canonical(receipt))}

def collect(site):
    rows=[];by_id={}
    for p in sorted((Path(site)/'data/read-up-records').glob('*.json')):
        require(not p.is_symlink(),'Symlink record forbidden');row=read(p)
        require(set(row)=={'record','verified_at','review_sha256'},'Unexpected public record envelope')
        r=validate(row['record']);require(p.name==r['id']+'-r'+str(r['revision'])+'.json','Record filename mismatch')
        require(stamp(row['verified_at'])>=stamp(r['published_at']) and re.fullmatch('[a-f0-9]{64}',row['review_sha256'] or ''),'Invalid public review binding')
        versions=by_id.setdefault(r['id'],{});require(r['revision'] not in versions,'Duplicate revision');versions[r['revision']]=r
    for versions in by_id.values():
        require(sorted(versions)==list(range(1,max(versions)+1)),'Missing prior revision')
        rows.append(versions[max(versions)])
        dates=[stamp(versions[i]['published_at']) for i in sorted(versions)];require(dates==sorted(dates),'Revision dates out of order')
    rows.sort(key=lambda r:(r['published_at'],r['id']),reverse=True)
    return {'schema_version':1,'entries':rows}

def paragraphs(value, sources):
    def ref(m):
        s=sources[m[1]];return '<a rel="noopener noreferrer" href="'+html.escape(s.get('original_url',s.get('url')),quote=True)+'">['+m[1]+']</a>'
    return ''.join('<p>'+re.sub(r'\[([SP]\d+)\]',ref,html.escape(p))+'</p>' for p in value.split('\n\n') if p.strip())

def render(r):
    validate(r);e=html.escape;refs={s['id']:s for s in r['sources']+r['primary']}
    body=''.join('<section><h2>'+label+'</h2>'+paragraphs(r[k],refs)+'</section>' for k,label in [('happened','What happened'),('matters','Why it matters · Our interpretation'),('watch','What to watch')])
    links=''.join('<li><a rel="noopener noreferrer" href="'+e(s.get('original_url',s.get('url')),quote=True)+'">['+s['id']+'] '+e(s['title'])+'</a></li>' for s in refs.values())
    return ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+e(r['title'])+' | Reuters Read-Up</title><style>body{margin:0;background:#f5f7f8;color:#172b38;font:18px/1.65 system-ui,sans-serif}main{max-width:760px;margin:auto;padding:clamp(20px,5vw,56px)}h1{font-size:clamp(30px,5vw,44px);line-height:1.15}h2{font-size:24px;margin-top:32px}a{color:#075c6b;overflow-wrap:anywhere}p,li{overflow-wrap:anywhere}.takeaway{font-size:22px;border-left:4px solid #087f8c;padding-left:20px}time,footer{font-size:15px;color:#48616d}li{margin-bottom:12px}</style></head><body><main><a href="https://notwins.github.io/market-intelligence-hub/market-understanding/#reuters-read-up">← Reuters Read-Up</a><h1>'+e(r['title'])+'</h1><time datetime="'+r['published_at']+'">'+r['published_at'].replace('T',' ').replace('+08:00',' SGT')+' · revision '+str(r['revision'])+'</time><p class="takeaway">'+e(r['takeaway'])+'</p>'+body+'<section><h2>Sources</h2><ol>'+links+'</ol></section><footer><p>Independently written research based on selected Reuters reporting. No Reuters affiliation or endorsement. Educational information; not personalised investment advice.</p></footer></main></body></html>').encode('utf8')

def build(site,output):
    index=collect(site);output=Path(output)
    for p in (Path(site)/'data/read-up-records').glob('*.json'):
        r=read(p)['record'];target=output/destination(r);target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(render(r))
    (output/'data/reuters-read-ups.json').write_bytes(canonical(index))
    folder=output/'read-ups';folder.mkdir(exist_ok=True)
    cards=''.join('<article><h2><a href="'+html.escape(BASE+destination(r),quote=True)+'">'+html.escape(r['title'])+'</a></h2><p>'+html.escape(r['takeaway'])+'</p><p>'+r['published_at'].replace('T',' ').replace('+08:00',' SGT')+'</p></article>' for r in index['entries'])
    (folder/'index.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reuters Read-Up</title><style>body{max-width:760px;margin:auto;padding:24px;font:18px/1.6 system-ui;color:#172b38}a{color:#075c6b}article{border-top:1px solid #cbd5dc;padding:20px 0}</style><a href="https://notwins.github.io/market-intelligence-hub/market-understanding/#reuters-read-up">← Research Explained</a><h1>Reuters Read-Up</h1><p>Independently written briefs based on selected Reuters reporting.</p>'+ (cards or '<p>No briefs have been published yet.</p>')+'</html>',encoding='utf8')
    return index
