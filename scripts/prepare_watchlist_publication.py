"""Prepare a guarded, reviewed publication candidate. Never pushes, schedules or edits calls."""
import argparse, hashlib, json, shutil, subprocess
from pathlib import Path
from import_watchlist import validate, import_edition, fail
from watchlist_report import import_report
from watchlist_research_review import validate_review, import_review, validate_index

def sha(data): return hashlib.sha256(data).hexdigest()
def files(folder):
    return {str(p.relative_to(folder)).replace('\\','/'):p.read_bytes() for p in sorted(folder.rglob('*')) if p.is_file()}

def prepare(edition, repo, output, expected_commit, research_review=None):
    repo=Path(repo).resolve();output=Path(output).resolve();d=validate(edition)
    fail(len(expected_commit)==40 and all(c in '0123456789abcdef' for c in expected_commit),'Exact base commit SHA required')
    actual=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()
    fail(actual==expected_commit,'Stale checkout: expected base commit does not match HEAD')
    dirty=subprocess.check_output(['git','status','--porcelain','--untracked-files=all','--','site/data/watchlist'],cwd=repo,text=True).strip()
    fail(not dirty,'Public watchlist source has uncommitted changes; prepare from the reviewed base commit')
    fail(not output.exists(),'Use a new empty output directory; never overwrite an earlier candidate')
    fail(output!=repo and repo not in output.parents,'Candidate must be outside the source checkout')
    source=repo/'site/data/watchlist'
    fail(not any(p.is_symlink() for p in source.rglob('*')),'Public data must not contain symlinks')
    saved_review=source/'reviews'/(d['id']+'.json')
    if research_review is None and saved_review.exists():
        research_review=json.loads(saved_review.read_text(encoding='utf-8'))
    fail(research_review is not None,'A completed content-bound research review is required; create and review a draft first')
    validate_review(d,research_review)
    before=files(source);output.mkdir(parents=True);stage=output/'site/data/watchlist';shutil.copytree(source,stage)
    import_edition(d,output/'site'); report=import_report(d,output/'site')
    review_path=import_review(d,research_review,output/'site')
    validate_index(output/'site')
    after=files(stage)
    # Existing dated editions, reports, calls, notes and status must stay byte-identical.
    for name,body in before.items():
        fail(name in after,'Deletion of prior public data is forbidden')
        if name not in ['index.json','latest.json','report-index.json','research-index.json']:
            fail(body==after[name],'Refusing to change retained public artifact: '+name)
    old_research=json.loads(before['research-index.json']);new_research=json.loads(after['research-index.json'])
    for key in ['editions','reviewed_editions']:
        for edition_id,value in old_research[key].items():
            fail(new_research[key].get(edition_id)==value,'Retained research review/mapping changed')
    allowed={'index.json','latest.json','report-index.json','research-index.json','archive/'+d['id']+'.json','reports/'+d['id']+'.html','reviews/'+d['id']+'.json'}
    changed=[name for name,body in after.items() if before.get(name)!=body]
    fail(set(changed)<=allowed,'Candidate contains an unauthorized path')
    fail(files(source)==before,'Public source changed while preparing; start again from fresh main')
    manifest={'schema_version':2,'base_commit':actual,'edition_id':d['id'],'report_path':'site/'+str(report.relative_to(output/'site')).replace('\\','/'),'report_sha256':sha(report.read_bytes()),'research_review_path':'site/'+str(review_path.relative_to(output/'site')).replace('\\','/'),'research_review_sha256':sha(review_path.read_bytes()),'automatic_publication_verified':False,'files':[{'path':'site/data/watchlist/'+name,'sha256':sha(after[name]),'previous_sha256':sha(before[name]) if name in before else None} for name in changed],'preserved_files':[{'path':'site/data/watchlist/'+name,'sha256':sha(body)} for name,body in before.items() if name not in changed]}
    (output/'publication-plan.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return manifest

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--input',required=True);p.add_argument('--repo',default='.');p.add_argument('--output',required=True);p.add_argument('--base-commit',required=True);p.add_argument('--research-review');a=p.parse_args()
    review=json.loads(Path(a.research_review).read_text(encoding='utf-8')) if a.research_review else None
    result=prepare(json.loads(Path(a.input).read_text(encoding='utf-8')),a.repo,a.output,a.base_commit,review);print(json.dumps(result,ensure_ascii=False))
