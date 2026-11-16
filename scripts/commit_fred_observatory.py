"""Create a data-only local commit; push only after the full publication gate."""
import argparse
import json
import subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]


def git(*args):
    return subprocess.check_output(['git',*args],cwd=ROOT,text=True).strip()


def commit(work):
    report=json.loads((Path(work)/'refresh-report.json').read_text(encoding='utf-8'))
    version=report['archive_version'];prefix='site/data/fred/'+version+'/'
    catalog=json.loads((ROOT/'site/data/fred/catalog.json').read_text(encoding='utf-8'))
    if catalog.get('archive_version')!=version:raise ValueError('Prepared and current archive versions differ')
    if not version.startswith(catalog['snapshot']) or any(c not in '0123456789-T' for c in version):raise ValueError('Invalid archive identity')
    if git('diff','--cached','--name-only'):raise ValueError('Unexpected pre-staged changes')
    subprocess.run(['git','add','--','site/data/fred/catalog.json',prefix],cwd=ROOT,check=True)
    changed=git('diff','--cached','--name-only').splitlines()
    if not changed or any(name!='site/data/fred/catalog.json' and not name.startswith(prefix) for name in changed):
        raise ValueError('Refresh includes paths outside the new archive and latest catalogue')
    if any(line.startswith('D') for line in git('diff','--cached','--name-status').splitlines()):raise ValueError('A refresh must not delete prior data')
    subprocess.run(['git','config','user.name','github-actions[bot]'],cwd=ROOT,check=True)
    subprocess.run(['git','config','user.email','41898282+github-actions[bot]@users.noreply.github.com'],cwd=ROOT,check=True)
    subprocess.run(['git','commit','-m',f'Refresh FRED Observatory: {report["checked_count"]}/74 checked, {report["added"]} added, {report["revised"]} revised'],cwd=ROOT,check=True)
    print(git('rev-parse','HEAD'))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--work-dir',required=True,type=Path);args=parser.parse_args();commit(args.work_dir)
