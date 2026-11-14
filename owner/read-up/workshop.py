"""Loopback-only Reuters Read-Up workshop. Standard library; no deployment capability."""
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
from datetime import datetime, timezone
import argparse, copy, hashlib, json, os, re, secrets, sqlite3, threading, socket

ROOT = Path(__file__).resolve().parent
def now(): return datetime.now(timezone.utc).isoformat(timespec='seconds')
def digest(value): return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()[:24]
def canonical(value):
    u = urlsplit(value)
    if u.scheme != 'https' or not u.hostname or u.username or u.password: raise ValueError('A public HTTPS source link is required.')
    host = u.hostname.lower().removeprefix('www.')
    query = [(k,v) for k,v in parse_qsl(u.query) if not k.lower().startswith('utm_') and k not in ('oc','gclid','fbclid')]
    return urlunsplit(('https', host, u.path.rstrip('/'), urlencode(sorted(query)), ''))

def catalogue():
    source = json.loads((ROOT.parents[1]/'site/data/news.json').read_text(encoding='utf8'))
    items, seen = [], set()
    for x in sorted(source['items'], key=lambda x:x['published_at'], reverse=True):
        key = canonical(x['url'])
        if key in seen: continue
        seen.add(key)
        items.append({**x, 'key':key, 'tags':list(dict.fromkeys([x['category']]+x.get('tickers',[]))), 'demo':False})
    demos = []
    for x in demos: x.update(key=canonical(x['url']), demo=True)
    return {'generated_at':source['generated_at'], 'items':items+demos, 'duplicates_removed':len(source['items'])-len(items)}

class Workshop:
    def __init__(self, db=':memory:'):
        self.lock = threading.RLock()
        self.db = sqlite3.connect(str(db), check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.persistent = str(db) != ':memory:'
        self.feed = catalogue()
        self.items = {x['id']:x for x in self.feed['items']}
        self.db.executescript('''CREATE TABLE IF NOT EXISTS drafts(id TEXT PRIMARY KEY, scope TEXT UNIQUE, version INTEGER, body TEXT);
          CREATE TABLE IF NOT EXISTS bookmarks(id TEXT PRIMARY KEY);
          CREATE TABLE IF NOT EXISTS conflicts(id TEXT PRIMARY KEY, draft_id TEXT, body TEXT);
          CREATE TABLE IF NOT EXISTS publications(scope TEXT PRIMARY KEY, body TEXT);
          CREATE TABLE IF NOT EXISTS content_index(id INTEGER PRIMARY KEY CHECK(id=1), body TEXT);
          INSERT OR IGNORE INTO content_index VALUES(1,'{"schema_version":1,"entries":[]}');''')
        self.db.commit()

    def enable_storage(self, path):
        with self.lock:
            if self.persistent: return
            path = Path(path); path.parent.mkdir(parents=True, exist_ok=True)
            target = sqlite3.connect(path, check_same_thread=False); target.row_factory = sqlite3.Row
            # Never overwrite a previous workspace. The launcher resumes it on startup.
            if path.exists() and path.stat().st_size > 0:
                target.close(); raise ValueError('An existing workspace was found. Restart to resume it; current session remains intact.')
            self.db.backup(target); self.db.close(); self.db=target; self.persistent=True

    def state(self):
        with self.lock:
            return {'persistent':self.persistent,'bookmarks':[r[0] for r in self.db.execute('SELECT id FROM bookmarks')],
                    'drafts':[json.loads(r[0]) for r in self.db.execute('SELECT body FROM drafts ORDER BY rowid DESC')],
                    'conflicts':[dict(r) for r in self.db.execute('SELECT * FROM conflicts')], 'feed':self.feed}

    def get(self, ident):
        with self.lock:
            row=self.db.execute('SELECT body FROM drafts WHERE id=?',(ident,)).fetchone()
            if not row: raise ValueError('Draft not found.')
            return json.loads(row[0])

    def create(self, ids, angle=''):
        if not isinstance(ids,list) or not ids or len(ids)>12: raise ValueError('Select between 1 and 12 headlines.')
        selected=[]; seen=set()
        for ident in ids:
            if ident not in self.items: raise ValueError('Selection is not in the imported Hub snapshot.')
            item=self.items[ident]
            if item['key'] not in seen: selected.append(copy.deepcopy(item)); seen.add(item['key'])
        if len({x['demo'] for x in selected})>1: raise ValueError('Keep fictional demonstrations separate from real Reuters headlines.')
        # Stable source order means citation IDs survive reordered retries.
        selected.sort(key=lambda x:x['id'])
        angle=angle.strip()[:2000]
        scope=digest([sorted(seen), ' '.join(angle.lower().split())])
        with self.lock, self.db:
            row=self.db.execute('SELECT body FROM drafts WHERE scope=?',(scope,)).fetchone()
            if row: return json.loads(row[0])
            evidence=[{'id':'S'+str(i+1),'article_id':s['id'],'title':s['title'],'original_url':s['url'] if s['demo'] else '',
                       'accessed_url':s['url'] if s['demo'] else '', 'status':'verified' if s['demo'] and not s.get('unavailable') else 'unavailable' if s.get('unavailable') else 'unverified',
                       'notes':'Fictional test evidence, not Reuters reporting.' if s['demo'] else 'Headline metadata only; article body has not been verified.',
                       'checked_at':now() if s['demo'] else ''} for i,s in enumerate(selected)]
            d={'id':secrets.token_hex(10),'scope':scope,'version':1,'created_at':now(),'updated_at':now(),'selected':selected,'angle':angle,
               'evidence':evidence,'primary':[], 'notes':'','title':'','takeaway':'','happened':'','matters':'','watch':'',
               'review':False,'status':'draft','demo':selected[0]['demo']}
            if d['demo'] and not any(s.get('unavailable') for s in selected): d.update(demo_brief(evidence))
            self.db.execute('INSERT INTO drafts VALUES(?,?,?,?)',(d['id'],scope,1,json.dumps(d)))
            return d

    def save(self, ident, version, patch):
        with self.lock, self.db:
            d=self.get(ident)
            if d['version']!=version:
                conflict=secrets.token_hex(8)
                self.db.execute('INSERT INTO conflicts VALUES(?,?,?)',(conflict,ident,json.dumps(patch)))
                return {'conflict':conflict,'message':'Another tab saved first. Your edit is preserved as a recovery copy. Reload the current draft before merging.'}
            for k in ('title','takeaway','happened','matters','watch','notes'):
                if k in patch:
                    if not isinstance(patch[k],str) or len(patch[k])>20000: raise ValueError('Invalid draft text.')
                    d[k]=patch[k]
            if 'evidence' in patch:
                ev=patch['evidence']
                if not isinstance(ev,list) or [(x.get('id'),x.get('article_id')) for x in ev]!=[(x['id'],x['article_id']) for x in d['evidence']]: raise ValueError('Source identity/order cannot change. Create another selection instead.')
                for x in ev:
                    if x.get('status') not in ('verified','unverified','unavailable'): raise ValueError('Invalid source status.')
                    for k in ('original_url','accessed_url'):
                        if x.get(k): canonical(x[k])
                d['evidence']=copy.deepcopy(ev)
            if 'primary' in patch:
                if not isinstance(patch['primary'],list) or len(patch['primary'])>10: raise ValueError('Invalid primary sources.')
                for i,p in enumerate(patch['primary']):
                    canonical(p['url'])
                    if p['id']!='P'+str(i+1) or not p.get('title') or not p.get('checked_at'): raise ValueError('Primary source needs an ID, title and check date.')
                d['primary']=patch['primary']
            d['review']=False # Every edit invalidates approval.
            d['version']+=1; d['updated_at']=now(); d['status']='draft'
            self.db.execute('UPDATE drafts SET version=?,body=? WHERE id=?',(d['version'],json.dumps(d),ident))
            return d

    def blockers(self,d):
        out=[]
        for e in d['evidence']:
            if e['status']!='verified': out.append(e['title']+': '+e['status']+' — '+e.get('notes','No reason recorded.'))
            elif not all(e.get(k) for k in ('original_url','accessed_url','notes','checked_at')): out.append(e['id']+': missing verification record.')
            elif not d['demo'] and urlsplit(e['original_url']).hostname not in ('reuters.com','www.reuters.com'): out.append(e['id']+': resolve and check the original Reuters article URL first.')
        for k in ('title','takeaway','happened','matters','watch'):
            if not d[k].strip(): out.append(k.capitalize()+': write this part of the brief.')
        allowed={x['id'] for x in d['evidence']+d['primary']}
        used=set()
        for field in ('happened','matters','watch'):
            for paragraph in filter(str.strip,d[field].split('\n\n')):
                refs=set(re.findall(r'\[([SP]\d+)\]',paragraph)); used|=refs
                if not refs: out.append(field.capitalize()+': add citations beside each paragraph, e.g. [S1].')
                if refs-allowed: out.append('Unknown citation: '+', '.join(sorted(refs-allowed)))
        for e in d['evidence']:
            if e['id'] not in used: out.append(e['id']+': selected article is not cited; it cannot be silently omitted.')
        words=len(re.findall(r'\b[\w’\'-]+\b',' '.join(d[k] for k in ('title','takeaway','happened','matters','watch'))))
        if words>(350 if len(d['selected'])==1 else 600): out.append('Brief exceeds the requested upper word limit. Shorten it before publication.')
        return list(dict.fromkeys(out)),words

    def publish(self, ident, version, reviewed, fail=False):
        with self.lock:
            d=self.get(ident)
            if d['version']!=version: raise ValueError('Draft changed. Review the current version before publishing.')
            blockers,words=self.blockers(d)
            if blockers or reviewed is not True: raise ValueError('Publication held: '+('; '.join(blockers) or 'Confirm editorial review.'))
            scope=digest(sorted({canonical(e['original_url']) for e in d['evidence']}))
            prior=self.db.execute('SELECT body FROM publications WHERE scope=?',(scope,)).fetchone()
            if prior: return {'entry':json.loads(prior[0]),'duplicate':True,'message':'This exact article bundle already has a preview card. Draft retained; no second card created.'}
            # Public whitelist deliberately excludes angle, evidence notes, drafts and owner state.
            entry={k:d[k] for k in ('title','takeaway','happened','matters','watch','demo')}
            entry.update(id='read-up-'+scope,published_at=now(),word_count=words,
                         sources=[{k:e[k] for k in ('id','title','original_url','accessed_url')} for e in d['evidence']],
                         primary=[{k:p[k] for k in ('id','title','url')} for p in d['primary']])
            entry['href']='brief.html?id='+entry['id']
            # One transaction is the publication boundary: index and entry commit together.
            with self.db:
                self.db.execute('INSERT INTO publications VALUES(?,?)',(scope,json.dumps(entry)))
                if fail: raise OSError('Simulated publication failure. Draft retained; last verified preview index unchanged.')
                index=self.index(); index['entries'].insert(0,entry)
                self.db.execute('UPDATE content_index SET body=? WHERE id=1',(json.dumps(index),))
                d.update(status='preview-published',review=True)
                self.db.execute('UPDATE drafts SET body=? WHERE id=?',(json.dumps(d),ident))
            return {'entry':entry,'duplicate':False,'message':'Published to the local preview only. Nothing was pushed or deployed.'}

    def index(self):
        with self.lock: return json.loads(self.db.execute('SELECT body FROM content_index WHERE id=1').fetchone()[0])

    def refresh(self):
        import urllib.request
        with urllib.request.urlopen('https://notwins.github.io/market-intelligence-hub/data/news.json',timeout=20) as response:
            raw=response.read(2_000_001)
        if len(raw)>2_000_000: raise ValueError('Feed too large; previous snapshot retained.')
        data=json.loads(raw)
        if data.get('status')!='ok' or not isinstance(data.get('items'),list) or not data['items']: raise ValueError('Hub did not return a successful feed; previous snapshot retained.')
        if datetime.fromisoformat(data['generated_at']).tzinfo is None: raise ValueError('Missing feed timezone.')
        cleaned=[];seen=set();ids=set()
        for x in data['items']:
            if x.get('publisher')!='Reuters' or not isinstance(x.get('title'),str) or not x['title'].strip(): raise ValueError('Invalid headline; previous snapshot retained.')
            if not isinstance(x.get('id'),str) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,80}',x['id']) or x['id'] in ids: raise ValueError('Invalid or duplicate headline ID; previous snapshot retained.')
            ids.add(x['id'])
            if not isinstance(x.get('category'),str) or not all(isinstance(t,str) for t in x.get('tickers',[])): raise ValueError('Invalid tags; previous snapshot retained.')
            key=canonical(x['url'])
            if urlsplit(key).hostname not in ('reuters.com','news.google.com'): raise ValueError('Unexpected source host; previous snapshot retained.')
            if datetime.fromisoformat(x['published_at']).tzinfo is None: raise ValueError('Missing source timezone; previous snapshot retained.')
            if key in seen: continue
            seen.add(key);cleaned.append({**x,'key':key,'tags':list(dict.fromkeys([x['category']]+x.get('tickers',[]))),'demo':False})
        cleaned.sort(key=lambda x:x['published_at'],reverse=True)
        with self.lock:
            demos=[x for x in self.feed['items'] if x['demo']]
            self.feed={'generated_at':data['generated_at'],'items':cleaned+demos,'duplicates_removed':len(data['items'])-len(cleaned)}
            self.items.update({x['id']:x for x in cleaned})
        return {'ok':True}

def demo_brief(sources):
    refs=' '.join('['+e['id']+']' for e in sources)
    bundle=len(sources)>1
    return {'title':'Fictional example: demand grows, but funding still matters',
      'takeaway':'Illustrative takeaway: growing demand is useful only if the business can fund its next stage without stretching its balance sheet.',
      'happened':('In this fictional test case, a company reports more demand for computing capacity while preparing its next investment phase. The sample evidence describes a stronger order book, but it does not establish that every order has become revenue or that every customer has paid. This distinction is central to reading the announcement. '+refs+
        ('\n\nThe second fictional item concerns the funding of that same investment cycle. Read together, the selected items connect the commercial opportunity to the cost of supplying it. They describe different parts of one decision: whether promised demand can support the cash commitments required to expand. Neither example establishes a market price or a trading opportunity. '+refs if bundle else '')),
      'matters':('Our interpretation: the useful question is how quickly sales turn into cash relative to the timing of construction and equipment payments. A growing business can face a funding gap even when its products are popular. Orders, recognised revenue and collected cash should therefore be considered separately. '+refs+
        ('\n\nOur interpretation: this is why the two stories belong in one brief. The operating announcement helps explain the proposed expansion; the financing announcement raises a question about who bears the risk if that expansion is delayed. The connection does not prove that financing is unsafe, and it does not justify assuming that a large customer guarantees a supplier’s obligations. Those questions require the actual contract terms. '+refs if bundle else '')),
      'watch':('Our watch points: compare later cash collections with investment payments, and check the maturity and conditions of any borrowing. Look for cancellation clauses, customer concentration and changes to the investment timetable. These are questions for follow-up research, not reported outcomes. This entire example is invented to demonstrate the reading flow and must not be treated as Reuters coverage. '+refs+
        ('\n\nFor the next reading, look for evidence that answers the shared question rather than adding more headlines. A useful update would explain whether customer receipts are arriving before major payments fall due, or whether the company has changed the scale of its expansion. A new headline without those details would not resolve the uncertainty in this illustrative bundle. '+refs if bundle else ''))}

class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args): pass
    def send(self,data,status=200,kind='application/json'):
        raw=json.dumps(data).encode() if kind=='application/json' else data
        self.send_response(status); self.send_header('Content-Type',kind+'; charset=utf-8'); self.send_header('Content-Length',str(len(raw)))
        self.send_header('Cache-Control','no-store'); self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Referrer-Policy','no-referrer'); self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
        self.end_headers(); self.wfile.write(raw)
    def safe_request(self,mutation=False):
        host=self.headers.get('Host','')
        if host not in ('127.0.0.1:'+str(self.server.server_port),'localhost:'+str(self.server.server_port)): raise PermissionError('Loopback host only.')
        origin=self.headers.get('Origin')
        if origin and origin!='http://'+host: raise PermissionError('Cross-origin request rejected.')
        if mutation and self.headers.get('X-Workshop-Token')!=self.server.token: raise PermissionError('Local request token missing.')
    def do_GET(self):
        try:
            self.safe_request(); path=urlsplit(self.path).path
            if path=='/api/state': self.send({**self.server.app.state(),'token':self.server.token}); return
            if path.startswith('/public/'): self.send({'error':'Use the live public subsection link.'},404); return
            files={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/style.css':'style.css','/public/':'public.html','/public/brief.html':'public.html','/public/public.js':'public.js','/public/style.css':'style.css','/guide.html':'guide.html'}
            if path not in files: self.send({'error':'Not found'},404); return
            file=ROOT/files[path]; kind='text/html' if file.suffix=='.html' else 'text/css' if file.suffix=='.css' else 'text/javascript'
            self.send(file.read_bytes(),kind=kind)
        except PermissionError as e:self.send({'error':str(e)},403)
        except Exception as e:self.send({'error':str(e)},500)
    def do_POST(self):
        try:
            self.safe_request(True)
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=250000: raise ValueError('Request is too large or empty.')
            body=json.loads(self.rfile.read(size)); app=self.server.app; path=urlsplit(self.path).path
            if path=='/api/create': result=app.create(body['ids'],body.get('angle',''))
            elif path=='/api/save': result=app.save(body['id'],body['version'],body['patch'])
            elif path=='/api/prepare': result=app.prepare(body['id'],body['version'],body.get('revision',1))
            elif path=='/api/check': result=dict(zip(('blockers','words'),app.blockers(app.get(body['id']))))
            elif path=='/api/publish': result=app.publish(body['id'],body['version'],body.get('reviewed'),body.get('fail',False),revision=body.get('revision',1))
            elif path=='/api/bookmark': result=app.bookmark(body['id'],body['save'])
            elif path=='/api/persist': app.enable_storage(self.server.storage); result={'ok':True}
            elif path=='/api/refresh-feed': result=app.refresh()
            else: self.send({'error':'Not found'},404); return
            self.send(result,409 if isinstance(result,dict) and 'conflict' in result else 200)
        except PermissionError as e:self.send({'error':str(e)},403)
        except (ValueError,KeyError,TypeError) as e:self.send({'error':str(e)},400)
        except OSError as e:self.send({'error':str(e)},503)
        except Exception:self.send({'error':'Request could not complete. Reload the workspace to check saved state before retrying.'},500)

class LocalServer(ThreadingHTTPServer):
    allow_reuse_address=False
    def server_bind(self):
        if hasattr(socket,'SO_EXCLUSIVEADDRUSE'):
            self.socket.setsockopt(socket.SOL_SOCKET,socket.SO_EXCLUSIVEADDRUSE,1)
        super().server_bind()

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--port',type=int,default=8794); parser.add_argument('--session-only',action='store_true'); args=parser.parse_args()
    storage=Path(os.environ.get('LOCALAPPDATA',str(Path.home())))/'ReutersReadUpPrivate/workspace.sqlite3'
    app=Workshop(storage if storage.exists() and not args.session_only else ':memory:')
    server=LocalServer(('127.0.0.1',args.port),Handler); server.app=app; server.token=secrets.token_urlsafe(32); server.storage=storage
    print('Reuters Read-Up: http://127.0.0.1:'+str(args.port)+' (local only)',flush=True)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close(); app.db.close()
if __name__=='__main__':main()
