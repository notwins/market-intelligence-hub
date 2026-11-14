"""Accept only a CLI-reviewed read-up. No credentials or private evidence published."""
import argparse, json, shutil, tempfile
from pathlib import Path
from read_ups import read, canonical, review, collect, require
from submit_research import git

def accept(repo,bundle,receipt):
    bundle=Path(bundle);r=read(bundle/'record.json');row=review(r,read(bundle/'evidence.json'),read(receipt))
    target=Path(repo)/'site/data/read-up-records'/(r['id']+'-r'+str(r['revision'])+'.json')
    if target.exists():
        require(read(target)['record']==r,'Revision already exists with different content; review a new revision');collect(Path(repo)/'site');return [],'duplicate'
    target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(canonical(row))
    try:collect(Path(repo)/'site')
    except Exception:target.unlink();raise
    return [target.relative_to(repo).as_posix()],'accepted'

def submit(remote,bundle,receipt,output=None,publish=False,attempts=5,barrier=None):
    require(publish or output is not None,'Prepare-only needs a new output directory')
    if output:require(not Path(output).exists(),'Output already exists')
    with tempfile.TemporaryDirectory(prefix='mih-read-up-') as tmp:
        repo=Path(tmp)/'candidate';git(None,'clone','--quiet','--branch','main',str(remote),str(repo))
        for attempt in range(attempts):
            if attempt:git(repo,'fetch','--quiet','origin','main');git(repo,'reset','--hard','origin/main');git(repo,'clean','-fd')
            base=git(repo,'rev-parse','HEAD').stdout.strip();paths,outcome=accept(repo,bundle,receipt)
            if not paths:return {'outcome':'duplicate','base':base,'committed':False,'live_verified':False}
            git(repo,'add','--',*paths);require(set(git(repo,'diff','--cached','--name-only').stdout.splitlines())==set(paths),'Unowned mutation')
            git(repo,'-c','user.name=Read-up publisher','-c','user.email=read-up-publisher@users.noreply.github.com','commit','-m','Add reviewed Reuters read-up revision')
            candidate=git(repo,'rev-parse','HEAD').stdout.strip()
            if not publish:shutil.copytree(repo,output);return {'outcome':'prepared','base':base,'candidate':candidate,'paths':paths,'live_verified':False}
            if barrier and attempt==0:barrier.wait(timeout=30)
            result=git(repo,'push','--porcelain','origin','HEAD:refs/heads/main',check=False)
            if not result.returncode:return {'outcome':'committed','base':base,'candidate':candidate,'live_verified':False}
            git(repo,'fetch','--quiet','origin','main');require(git(repo,'rev-parse','FETCH_HEAD').stdout.strip()!=base,'Push rejected without a competing update; reviewed bundle retained')
    raise RuntimeError('Content main kept advancing. Retry original reviewed bundle.')

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--remote',required=True);p.add_argument('--bundle',required=True,type=Path);p.add_argument('--review',required=True,type=Path);p.add_argument('--output',type=Path);p.add_argument('--publish',action='store_true');a=p.parse_args();print(json.dumps(submit(a.remote,a.bundle,a.review,a.output,a.publish),indent=2))
