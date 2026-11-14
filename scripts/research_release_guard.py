"""Read immutable Git objects to enforce new research ownership at merge/release.

Report releases cannot edit UI/workflows/indexes, remove or mutate older editions.
UI-only releases must preserve all report records and their manifested assets.
"""
import argparse,hashlib,json,re,subprocess
from pathlib import Path
from research_feed import ID,CORE,require,canonical,ROOT

def git(repo,*args):return subprocess.check_output(['git','-C',str(repo),*args])
def tree(repo,ref):
    require(bool(re.fullmatch('[a-f0-9]{40}',ref)),'Full immutable Git SHA required')
    oid=git(repo,'rev-parse',ref+'^{tree}').decode().strip();files={}
    for line in git(repo,'ls-tree','-rz',oid).split(b'\0'):
        if not line:continue
        meta,name=line.split(b'\t',1);mode,kind,blob=meta.decode().split();name=name.decode()
        require(kind=='blob' and mode in ('100644','100755'),'Unsupported file mode')
        files[name]=(mode,blob)
    return oid,files
def guard(repo,base,head):
    bt,before=tree(repo,base);ht,after=tree(repo,head)
    changed={p for p in set(before)|set(after) if before.get(p)!=after.get(p)}
    prefix='site/data/research-records/'
    protected=set()
    for p in before:
        if p.startswith(prefix) and p.endswith('.json'):
            row=json.loads(git(repo,'show',bt+':'+p));r=row['record'];protected.add(p)
            protected.update('site/research/'+r['id']+'/'+name for name in r['assets'])
    require(not changed&protected,'Existing automatic report/record changed or removed')
    records=[p for p in changed if p.startswith(prefix) and p.endswith('.json')]
    if not records:
        require(not any(p.startswith('site/research/') for p in changed),'Research assets require an append-only publication record')
        return {'lane':'ui-or-maintenance','protected_files':len(protected),'changed_paths':sorted(changed)}
    owned=set(records);report_hashes=set()
    for p in records:
        require(p not in before and p in after,'Records are append-only')
        row=json.loads(git(repo,'show',ht+':'+p));require(set(row)=={'record','verified_at_sgt','review_sha256'},'Public record envelope')
        r=row['record'];require(set(r)==CORE and re.fullmatch(ID,r['id']) and p==prefix+r['id']+'.json','Record identity/schema')
        require(r['kind']=='complete-report','Incomplete publication')
        for name,expected in r['assets'].items():
            require('/' not in name and '\\' not in name and '..' not in name,'Unsafe asset name')
            path='site/research/'+r['id']+'/'+name;owned.add(path)
            require(path not in before and path in after,'New report assets must be new and present')
            require(hashlib.sha256(git(repo,'show',ht+':'+path)).hexdigest()==expected,'Candidate report hash mismatch')
        require(r['full_report_sha256'] not in report_hashes,'Duplicate full report');report_hashes.add(r['full_report_sha256'])
    require(changed==owned,'Research release overlaps UI, workflow, legacy data or generated indexes')
    return {'lane':'research','changed_paths':sorted(changed),'protected_files':len(protected)}

def restore_ui(repo,ref,paths):
    """Explicit UI-path rollback only. Never checkout/reset a whole historical tree."""
    from release_lane_guard import UI
    _,files=tree(repo,ref)
    require(bool(paths) and set(paths)<=UI,'Rollback exceeds exact UI ownership')
    for p in paths:
        require(p in files,'Selected UI version lacks a required file')
        if p=='site/market-understanding/index.html':
            require(b'id="automated-research"' in git(repo,'show',ref+':'+p),'UI version predates the research feed; choose a compatible UI release')
    for p in paths:
        dest=Path(repo)/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(git(repo,'show',ref+':'+p))

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--repo',type=Path,default=ROOT);p.add_argument('--base',required=True);p.add_argument('--head',required=True);a=p.parse_args()
    print(json.dumps(guard(a.repo,a.base,a.head),indent=2))
