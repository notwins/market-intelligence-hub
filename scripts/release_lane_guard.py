"""Pure preflight pilot. Never writes files, commits, deploys, or authorizes publication.
Inputs are complete path->Git blob-id/hash snapshots; caller must obtain current SHA
again immediately before guarded update_ref(expected_sha=..., force=False).
"""
import json
import re
from pathlib import PurePosixPath

DERIVED = frozenset({'site/data/site-search.json', 'site/data/external-sources.json',
 'site/data/article-palettes.json', 'site/data/publication-timeline.json',
 'site/data/research-feed.json','site/data/research-feed-bootstrap.js','site/research-feed.html'})
REGISTER = 'site/data/research-register.json'
UI = frozenset({'site/v4.html', 'site/market-understanding/index.html',
 'site/market-understanding/market-understanding.css', 'scripts/build_report_additions.py',
 'scripts/test_research_register.py', 'site/v4-tools.js',
 'scripts/test_yield_comparisons.cjs',
 'site/feed-freshness.js', 'site/research-shortcuts.css', 'site/market-snapshot.js',
 'site/global-search.js', 'site/search-query.js', 'site/search.html', 'site/favicon.ico',
 'scripts/test_sol_ui.cjs', 'scripts/test_saved_refresh.cjs',
 'scripts/test_market_snapshot.cjs','site/research-feed.js','site/research-feed.css',
 'site/research-register.js'})

class Rejected(ValueError): pass

def canonical(path):
 if not isinstance(path,str) or '\\' in path or path.startswith('/') or '..' in path.split('/') or str(PurePosixPath(path)) != path:
  raise Rejected('noncanonical path')
 return path

def validate(base, candidate, *, lane, expected_sha, current_sha, register_before=None, register_after=None):
 if not re.fullmatch('[a-f0-9]{40}', expected_sha or '') or expected_sha != current_sha:
  raise Rejected('stale or invalid base; reconcile and rerun all checks')
 if lane not in ('report','ui'): raise Rejected('unknown lane')
 for path in set(base) | set(candidate): canonical(path)
 removed = set(base)-set(candidate)
 if removed: raise Rejected('deletion prohibited: '+', '.join(sorted(removed)))
 changed = {p for p in candidate if base.get(p)!=candidate[p]}
 if changed & DERIVED: raise Rejected('derived output belongs to final assembler')
 if not changed: raise Rejected('empty release')
 if lane=='ui':
  if changed-UI: raise Rejected('UI lane exceeds explicit path ownership')
 else:
  for path in changed-{REGISTER}:
   # Narrow pilot: new standalone report editions only, not existing revisions,
   # metadata changes, historical Calls, report tests or shared UI edits.
   if path in base or not re.fullmatch(r'site/research/[a-z0-9][a-z0-9-]+/[^/]+',path):
    raise Rejected('report pilot permits new standalone edition files only')
  if REGISTER not in changed: raise Rejected('new report must enter register')
  if register_before is None or register_after is None: raise Rejected('register evidence missing')
  old=json.loads(register_before); new=json.loads(register_after)
  if {k:v for k,v in old.items() if k!='entries'} != {k:v for k,v in new.items() if k!='entries'}:
   raise Rejected('register envelope changed')
  def entries(doc):
   result={}
   for row in doc['entries']:
    key=row['id']
    if key in result: raise Rejected('duplicate register ID')
    result[key]=row
   return result
  oldrows,newrows=entries(old),entries(new)
  if any(newrows.get(k)!=v for k,v in oldrows.items()): raise Rejected('existing register entry changed or removed')
  added=set(newrows)-set(oldrows)
  if not added: raise Rejected('no new registered edition')
  owned_roots=set()
  for key in added:
   href=newrows[key].get('href','')
   if not re.fullmatch(r'research/[a-z0-9][a-z0-9-]+/',href) or 'site/'+href+'index.html' not in changed:
    raise Rejected('new entry lacks new owned HTML')
   owned_roots.add('site/'+href)
  if any(not any(p.startswith(root) for root in owned_roots) for p in changed-{REGISTER}):
   raise Rejected('unregistered report files')
 return {'lane':lane,'base_sha':current_sha,'changed_paths':sorted(changed),'requires_final_assembly':True,
         'publication_verified':False}

def git_snapshot(repo, ref):
 import subprocess
 def git(*args):
  return subprocess.check_output(['git','-C',str(repo),*args],stderr=subprocess.PIPE)
 if not re.fullmatch('[a-f0-9]{40}',ref): raise Rejected('full immutable candidate object SHA required')
 # Resolve first, then use only immutable object IDs in further commands.
 tree=git('rev-parse','--verify',ref+'^{tree}').decode().strip()
 snapshot={}
 for record in git('ls-tree','-rz',tree).split(b'\0'):
  if not record: continue
  meta,path=record.split(b'\t',1);mode,kind,oid=meta.decode().split()
  path=path.decode('utf-8');canonical(path)
  if kind!='blob' or mode not in ('100644','100755'):
   raise Rejected('unsupported symlink/submodule/mode: '+path)
  snapshot[path]=mode+':'+oid
 register=git('show',tree+':'+REGISTER).decode('utf-8') if REGISTER in snapshot else None
 return tree,snapshot,register

def main():
 import argparse,subprocess,sys
 parser=argparse.ArgumentParser(description='Read-only Git-tree release lane preflight; not publication approval')
 parser.add_argument('--repo',required=True);parser.add_argument('--base-commit',required=True)
 parser.add_argument('--candidate',required=True,help='Existing local commit/tree; never stages working files')
 parser.add_argument('--current-main-sha',required=True,help='Fresh full SHA obtained by connected GitHub reader; not fetched here')
 parser.add_argument('--lane',required=True,choices=['report','ui']);args=parser.parse_args()
 try:
  if not re.fullmatch('[a-f0-9]{40}',args.base_commit): raise Rejected('full base commit SHA required')
  actual=subprocess.check_output(['git','-C',args.repo,'rev-parse','--verify',args.base_commit+'^{commit}'],stderr=subprocess.PIPE).decode().strip()
  if actual!=args.base_commit: raise Rejected('base is not requested commit')
  bt,base,before=git_snapshot(args.repo,actual);ct,candidate,after=git_snapshot(args.repo,args.candidate)
  result=validate(base,candidate,lane=args.lane,expected_sha=actual,current_sha=args.current_main_sha,register_before=before,register_after=after)
  result.update(base_tree=bt,candidate_tree=ct,paths=[{'path':p,'before':base.get(p),'after':candidate[p]} for p in result['changed_paths']],remote_main_independently_checked=False)
  print(json.dumps(result,indent=2));return 0
 except (Rejected,subprocess.CalledProcessError,UnicodeError,ValueError,KeyError,TypeError) as error:
  print(json.dumps({'accepted':False,'error':str(error),'publication_verified':False}),file=sys.stderr);return 2

if __name__=='__main__':raise SystemExit(main())
