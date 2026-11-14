"""Prepare/publish a reviewed report using an isolated disposable Git checkout.

Default: prepare a local candidate only. --publish is an explicit opt-in for an
authorized publisher. No credentials are created, and no force push is possible.
Private review receipts and raw inputs never enter the checkout or public site.
"""
import argparse,json,shutil,subprocess,tempfile,time
from pathlib import Path
from research_feed import ROOT,read,canonical,validate_report,validate_review,collect,require

def git(root,*args,check=True):
    p=subprocess.run(['git',*args],cwd=root,capture_output=True,text=True)
    if check and p.returncode:raise RuntimeError('Git operation failed: '+p.stderr.strip())
    return p

def accept(repo,bundle,review):
    repo,bundle=Path(repo),Path(bundle)
    r=read(bundle/'record.json');site=repo/'site'
    standard=read(site/'data/colour-templates-v3.json');tags={x['id']:x for x in read(site/'data/external-source-standard.json')['tags']}
    validate_report(r,bundle/'files',standard,tags);receipt=validate_review(r,read(review))
    target=site/'data/research-records'/(r['id']+'.json')
    if target.exists():
        previous=read(target)
        require(previous['record']==r,'ID already exists with different bytes/metadata; use a new revision')
        collect(site)
        return [],'duplicate'
    folder=site/'research'/r['id'];require(not folder.exists(),'Report destination already exists')
    # Validated input only; never recursive-copy an automation working directory.
    folder.mkdir(parents=True);target.parent.mkdir(parents=True,exist_ok=True)
    for name in r['assets']:shutil.copyfile(bundle/'files'/name,folder/name)
    target.write_bytes(canonical(receipt));collect(site)
    paths=['site/research/'+r['id']+'/'+name for name in sorted(r['assets'])]+['site/data/research-records/'+r['id']+'.json']
    return paths,'accepted'

def submit(remote,bundle,review,output=None,publish=False,attempts=5,barrier=None):
    require(publish or output is not None,'A new output checkout is required for prepare-only')
    if output:require(not Path(output).exists(),'Output checkout must not exist')
    with tempfile.TemporaryDirectory(prefix='mih-report-') as tmp:
        repo=Path(tmp)/'candidate'
        git(None,'clone','--quiet','--branch','main',str(remote),str(repo))
        for attempt in range(attempts):
            if attempt:
                git(repo,'fetch','--quiet','origin','main')
                # This reset only touches the disposable clone created above.
                git(repo,'reset','--hard','origin/main');git(repo,'clean','-fd')
            base=git(repo,'rev-parse','HEAD').stdout.strip()
            paths,outcome=accept(repo,bundle,review)
            if not paths:return {'outcome':outcome,'base':base,'published':False,'already_accepted':True}
            git(repo,'add','--',*paths)
            changed=set(git(repo,'diff','--cached','--name-only').stdout.splitlines())
            require(changed==set(paths),'Submission changed paths outside its ownership')
            git(repo,'-c','user.name=Research publisher','-c','user.email=research-publisher@users.noreply.github.com','commit','-m','Add verified research '+read(Path(bundle)/'record.json')['id'])
            candidate=git(repo,'rev-parse','HEAD').stdout.strip()
            if not publish:
                shutil.copytree(repo,output)
                return {'outcome':'prepared','base':base,'candidate':candidate,'paths':paths,'published':False}
            if barrier and attempt==0:barrier.wait(timeout=20)
            pushed=git(repo,'push','--porcelain','origin','HEAD:refs/heads/main',check=False)
            if not pushed.returncode:
                duplicate=any(line.startswith('=\t') for line in pushed.stdout.splitlines())
                return {'outcome':'duplicate' if duplicate else outcome,'base':base,'candidate':candidate,'paths':paths,'published':not duplicate}
            git(repo,'fetch','--quiet','origin','main')
            current=git(repo,'rev-parse','FETCH_HEAD').stdout.strip()
            if current==base:raise RuntimeError('Push failed without a changed head; no overwrite attempted')
        raise RuntimeError('Main kept advancing; original reviewed bundle remains available for retry')

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--remote',required=True);p.add_argument('--bundle',required=True,type=Path);p.add_argument('--review',required=True,type=Path);p.add_argument('--output',type=Path);p.add_argument('--publish',action='store_true');a=p.parse_args()
    print(json.dumps(submit(a.remote,a.bundle,a.review,a.output,a.publish),indent=2))
