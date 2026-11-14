"""Freeze legacy publication bytes and require the independent delivery contract."""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PREFIXES=('research/','data/research-records/','data/hourly-archive/')
FIXED={'data/hourly-news.json','data/research-register.json'}
def check(root=ROOT):
    root=Path(root);site=root/'site'
    baseline=json.loads((root/'docs/legacy-publication-baseline.json').read_text())
    current={p.relative_to(site).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in site.rglob('*') if p.is_file() and (p.relative_to(site).as_posix().startswith(PREFIXES) or p.relative_to(site).as_posix() in FIXED)}
    if current!=baseline:raise ValueError('Legacy publication changed: publish new research/news in market-intelligence-content')
    for page in ['v4.html','v2.html','search.html','market-understanding/index.html']:
        if 'content-source.js' not in (site/page).read_text(encoding='utf-8'):raise ValueError('UI rollback removed independent content reader: '+page)
    return {'legacy_files':len(current),'independent_reader':'present'}
if __name__=='__main__':print(check())
