"""Prepare a private reviewed-report submission; never deploy or approve content.

One entry point for scheduled channels and user-requested standalone research.
Input is a complete V3 report folder plus public metadata, not a conversation.
"""
import argparse,json,re,shutil,tempfile
from pathlib import Path
from research_feed import ROOT,canonical,digest,read,require,timestamp,validate_report

CHANNELS={'earnings':'us-earnings-full','credit':'bond-credit-full','policy':'central-banks-policy-full'}
FIELDS={'title','cutoff_sgt','category','tags','summary'}

def prepare(report_dir,metadata,channel,output,slug=None,brief=None,revision=None,site=None):
    report_dir,output=Path(report_dir).resolve(),Path(output).resolve()
    site=Path(site or ROOT/'site')
    require(not output.exists(),'Output must be a new private bundle directory')
    require(not output.is_relative_to(site.resolve()),'Bundle must stay outside the public site')
    require(set(metadata)==FIELDS,'Only title, cutoff_sgt, category, tags and summary are allowed')
    cutoff=timestamp(metadata['cutoff_sgt'])
    if channel=='standalone':
        require(isinstance(slug,str) and re.fullmatch('[a-z][a-z0-9]*(?:-[a-z0-9]+)*',slug),'Standalone needs a stable topic slug')
        require(not re.search(r'\d{4}-\d{2}-\d{2}',slug),'Use a topic slug without the edition date')
        prefix='standalone-'+slug
    else:
        require(channel in CHANNELS and slug is None,'Unknown channel or unexpected topic slug')
        prefix=CHANNELS[channel]
    require(revision is None or isinstance(revision,int) and revision>=2,'A correction revision starts at 2')
    rid=prefix+'-'+cutoff.date().isoformat()+(f'-r{revision}' if revision else '')
    require(report_dir.is_dir() and not report_dir.is_symlink(),'Real report directory required')
    files=list(report_dir.iterdir())
    require(all(p.is_file() and not p.is_symlink() for p in files),'Flat public files only; no directories or symlinks')
    # Validate names before reading; all files are public and explicitly manifested.
    from research_feed import safe_name
    require(all(safe_name(p.name) for p in files),'Unexpected/private file type in report directory')
    assets={p.name:digest(p.read_bytes()) for p in files}
    require('index.html' in assets,'Complete HTML index.html required')
    r={**metadata,'id':rid,'kind':'complete-report','full_report_url':'research/'+rid+'/index.html',
       'full_report_sha256':assets['index.html'],'assets':assets,'quick_read':None}
    if brief:
        require(brief in assets and brief!='index.html' and brief.endswith(('.html','.pdf')),'Matching brief file missing or unsupported')
        r['quick_read']={'edition_id':rid,'full_report_sha256':r['full_report_sha256'],
                        'url':'research/'+rid+'/'+brief,'sha256':assets[brief]}
    standard=read(site/'data/colour-templates-v3.json')
    tags={x['id']:x for x in read(site/'data/external-source-standard.json')['tags']}
    validate_report(r,report_dir,standard,tags)
    # Copy and validate the actual snapshot too; a file changing during preparation
    # cannot produce a bundle whose receipt would later approve different bytes.
    output.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.research-bundle-',dir=output.parent) as tmp:
        candidate=Path(tmp)/'bundle';(candidate/'files').mkdir(parents=True)
        for name in assets:shutil.copyfile(report_dir/name,candidate/'files'/name)
        validate_report(r,candidate/'files',standard,tags)
        (candidate/'record.json').write_bytes(canonical(r))
        candidate.rename(output)
    return {'outcome':'prepared','id':rid,'bundle':str(output),'record_sha256':digest(canonical(r)),
            'review_required':True,'published':False}

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--report-dir',required=True,type=Path);p.add_argument('--metadata',required=True,type=Path)
    p.add_argument('--channel',required=True,choices=[*CHANNELS,'standalone']);p.add_argument('--slug')
    p.add_argument('--brief');p.add_argument('--revision',type=int);p.add_argument('--output',required=True,type=Path)
    a=p.parse_args();print(json.dumps(prepare(a.report_dir,read(a.metadata),a.channel,a.output,a.slug,a.brief,a.revision),indent=2))
