"""Publish genuine feed changes without racing main for a derived search timestamp."""
import subprocess
from pathlib import Path

def publish(root, attempts=3):
 root=Path(root)
 def git(*args,check=True):
  return subprocess.run(['git',*args],cwd=root,text=True,capture_output=True,check=check)
 # Derived catalogue is rebuilt for the Pages artifact after reconciliation.
 # Never create a repository commit merely because its build timestamp changed.
 index='site/data/site-search.json'
 if git('ls-files','--error-unmatch',index,check=False).returncode==0:
  git('restore','--staged','--worktree','--',index)
 paths=[p for p in ['site','scripts','README.md','.gitignore'] if (root/p).exists()]
 if paths:git('add','--',*paths)
 if (root/index).exists():git('reset','--',index)
 if git('diff','--cached','--quiet',check=False).returncode==0:
  return 'No source-data changes; search catalogue will be rebuilt for deployment only.'
 base=git('rev-parse','HEAD').stdout.strip()
 git('commit','-m','Archive market data refresh and visible feed status')
 for attempt in range(attempts):
  pushed=git('push','origin','HEAD:main',check=False)
  if pushed.returncode==0:return 'Source-data changes published without force.'
  # Do not retry auth/network errors as if they were concurrent writes.
  fetched=git('fetch','origin','main',check=False)
  if fetched.returncode:raise RuntimeError('Push failed and remote state could not be checked: '+pushed.stderr)
  remote=git('rev-parse','FETCH_HEAD').stdout.strip()
  if remote==base:raise RuntimeError('Push failed without a changed remote head: '+pushed.stderr)
  rebased=git('rebase',remote,check=False)
  if rebased.returncode:
   git('rebase','--abort',check=False)
   patch=git('format-patch','-1','HEAD','--stdout',check=False).stdout
   (root/'pending-publisher.patch').write_text(patch)
   raise RuntimeError('Concurrent source-data conflict; preserved pending patch, no overwrite or force-push. '+rebased.stderr)
  base=remote
 patch=git('format-patch','-1','HEAD','--stdout',check=False).stdout
 (root/'pending-publisher.patch').write_text(patch)
 raise RuntimeError('Main kept advancing; pending source-data patch preserved without force.')

if __name__=='__main__':
 print(publish(Path.cwd()))
