"""Private loopback owner desk. Assisted research; explicit filesystem review."""
import argparse, copy, json, os, re, secrets, sys, threading, time
from datetime import datetime
from pathlib import Path
from urllib.request import Request, urlopen
import workshop

REPO=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(REPO/'scripts'))
import read_ups as contract
from research_feed import canonical as encode, digest, read
from submit_read_up import submit

HOME=Path(os.environ.get('LOCALAPPDATA',str(Path.home())))/'ReutersReadUpOwner'
REMOTE='https://github.com/notwins/market-intelligence-content.git'

def atomic(path,data):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    temporary=path.with_name(path.name+'.'+secrets.token_hex(6)+'.tmp')
    try:temporary.write_bytes(data);os.replace(temporary,path)
    finally:
        if temporary.exists():temporary.unlink()

class Workshop(workshop.Workshop):
    def __init__(self,db=':memory:',workspace=HOME):
        super().__init__(db);self.workspace=Path(workspace);self.active=set()
        self.db.executescript('CREATE TABLE IF NOT EXISTS snapshots(id INTEGER PRIMARY KEY,body TEXT); CREATE TABLE IF NOT EXISTS saved_items(id TEXT PRIMARY KEY,body TEXT); CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY,draft_id TEXT,version INTEGER,status TEXT,history TEXT);')
        row=self.db.execute('SELECT body FROM snapshots WHERE id=1').fetchone()
        if row:self.feed=json.loads(row[0])
        self.items.update({x['id']:x for x in self.feed['items']})
        for row in self.db.execute('SELECT body FROM saved_items'):item=json.loads(row[0]);self.items[item['id']]=item
        # Migrate old ID-only bookmarks while their metadata is still available.
        for row in self.db.execute('SELECT id FROM bookmarks'):
            if row[0] in self.items:self.db.execute('INSERT OR IGNORE INTO saved_items VALUES(?,?)',(row[0],json.dumps(self.items[row[0]])))
        self.db.commit()

    def state(self):
        with self.lock:
            result=super().state();feed=copy.deepcopy(self.feed);ids={x['id'] for x in feed['items']}
            for row in self.db.execute('SELECT body FROM saved_items'):
                item=json.loads(row[0])
                if item['id'] not in ids:feed['items'].append({**item,'archived':True})
            result['feed']=feed;result['publications']=[dict(r) for r in self.db.execute('SELECT * FROM outbox ORDER BY rowid DESC')];return result

    def bookmark(self,ident,save):
        with self.lock,self.db:
            if ident not in self.items:raise ValueError('Unknown published headline')
            if save:
                self.db.execute('INSERT OR IGNORE INTO bookmarks VALUES(?)',(ident,))
                self.db.execute('INSERT OR REPLACE INTO saved_items VALUES(?,?)',(ident,json.dumps(self.items[ident])))
            else:
                self.db.execute('DELETE FROM bookmarks WHERE id=?',(ident,));self.db.execute('DELETE FROM saved_items WHERE id=?',(ident,))
        return {'ok':True}

    def refresh(self):
        with self.lock:
            previous=copy.deepcopy(self.feed)
            try:
                result=super().refresh()
                with self.db:self.db.execute('INSERT OR REPLACE INTO snapshots VALUES(1,?)',(json.dumps(self.feed),))
                return result
            except Exception:self.feed=previous;raise

    def blockers(self,d):
        blockers,words=super().blockers(d)
        if d['demo']:blockers.append('Fictional examples cannot be published.')
        for e in d['evidence']:
            if e.get('original_url'):
                try:contract.url(e['original_url'],True)
                except ValueError as exc:blockers.append(e['id']+': '+str(exc))
        return blockers,words

    def prepare(self,ident,version,revision=1):
        with self.lock:
            if not self.persistent:raise ValueError('Enable saving to this computer before preparing a durable publication bundle.')
            d=self.get(ident)
            if d['version']!=version:raise ValueError('Draft changed. Review current version.')
            blockers,words=self.blockers(d)
            if blockers:raise ValueError('Held: '+'; '.join(blockers))
            if type(revision) is not int or not 1<=revision<=10000:raise ValueError('Invalid revision')
            job='job-'+digest(encode([ident,version,revision]))[:24];folder=self.workspace/'outbox'/job
            if (folder/'record.json').exists():return {'id':job,'message':'Review bundle '+job+' retained. Complete the private CLI review, then Publish this version.'}
            r={k:d[k] for k in ('title','takeaway','happened','matters','watch')}
            r.update(kind='reuters-read-up',revision=revision,published_at=datetime.now(contract.SGT).isoformat(timespec='seconds'),word_count=words,
                     sources=[{k:s[k] for k in ('id','title','original_url','accessed_url')} for s in d['evidence']],
                     primary=[{k:s[k] for k in ('id','title','url')} for s in d['primary']])
            r['id']='read-up-'+contract.scope(r['sources']);contract.validate(r)
            evidence={'selected_ids':[s['id'] for s in d['selected']],'sources':[{k:s[k] for k in ('id','article_id','original_url','accessed_url','checked_at','notes','status')} for s in d['evidence']]}
            for e in evidence['sources']:e['checked_at']=datetime.fromisoformat(e['checked_at']).astimezone(contract.SGT).isoformat(timespec='seconds')
            atomic(folder/'record.json',encode(r));atomic(folder/'evidence.json',encode(evidence))
            with self.db:self.db.execute('INSERT OR IGNORE INTO outbox VALUES(?,?,?,?,?)',(job,ident,version,'awaiting-review','[]'))
            return {'id':job,'message':'Prepared '+job+'. Review its exact sources and brief, then run approve.py --job '+job+' --reviewer YOUR_NAME --approve in this owner folder. Return here and Publish.'}

    def event(self,job,status,detail):
        with self.lock,self.db:
            row=self.db.execute('SELECT history FROM outbox WHERE id=?',(job,)).fetchone();history=json.loads(row[0]);history.append({'at':workshop.now(),'status':status,'detail':detail})
            self.db.execute('UPDATE outbox SET status=?,history=? WHERE id=?',(status,json.dumps(history),job))

    def publish(self,ident,version,reviewed,fail=False,revision=1):
        with self.lock:
            if reviewed is not True:raise ValueError('Review this exact version and tick the confirmation first.')
            result=self.prepare(ident,version,revision);job=result['id'];folder=self.workspace/'outbox'/job
            if not (folder/'review.json').exists():raise ValueError(result['message'])
            contract.review(read(folder/'record.json'),read(folder/'evidence.json'),read(folder/'review.json'))
            if job not in self.active:
                self.event(job,'queued','Explicit owner Publish; exact reviewed bundle retained');self.active.add(job)
                threading.Thread(target=self.process,args=(job,),daemon=True).start()
            return {'message':'Publication queued privately. Check My drafts → Publication attempts for commit and live verification. No research is rerun.'}

    def process(self,job):
        folder=self.workspace/'outbox'/job
        try:
            os.environ['GIT_TERMINAL_PROMPT']='0';os.environ['GCM_INTERACTIVE']='never'
            result=submit(REMOTE,folder,folder/'review.json',publish=True)
            self.event(job,'committed',result)
            record=read(folder/'record.json');last=None
            for attempt in range(18):
                try:
                    address=contract.BASE+contract.destination(record)+'?read-up='+digest(encode(record))
                    with urlopen(Request(address,headers={'Cache-Control':'no-cache'}),timeout=15) as response:assert response.read()==contract.render(record),'Brief readback differs'
                    with urlopen(Request(contract.BASE+'data/reuters-read-ups.json?read-up='+digest(encode(record)),headers={'Cache-Control':'no-cache'}),timeout=15) as response:index=json.load(response)
                    assert any(x['id']==record['id'] and x['revision']>=record['revision'] for x in index['entries']),'Card not deployed'
                    self.event(job,'live-verified',address);return
                except Exception as exc:
                    last=str(exc)
                    if attempt<17:time.sleep(10)
            self.event(job,'awaiting-live-verification',last)
        except Exception as exc:self.event(job,'retry-needed',str(exc))
        finally:
            with self.lock:self.active.discard(job)

def main():
    p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=8794);p.add_argument('--session-only',action='store_true');a=p.parse_args()
    storage=HOME/'workspace.sqlite3';app=Workshop(storage if storage.exists() and not a.session_only else ':memory:')
    server=workshop.LocalServer(('127.0.0.1',a.port),workshop.Handler);server.app=app;server.token=secrets.token_urlsafe(32);server.storage=storage
    print('Private Reuters Read-Up: http://127.0.0.1:'+str(a.port),flush=True)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close();app.db.close()

if __name__=='__main__':main()
