"""Stage a byte-preserving Pages candidate; never decorate the source checkout."""
import argparse
import shutil
import subprocess
from pathlib import Path
from public_data_projection import stage

ROOT = Path(__file__).resolve().parents[1]


def build(output, repo=ROOT):
    repo, output = Path(repo).resolve(), Path(output).resolve()
    if output == repo or repo in output.parents or output in repo.parents:
        raise ValueError('Use a new staging directory outside the source checkout')
    if output.exists():
        raise ValueError('Staging directory must not already exist; never overwrite another publisher')
    output.mkdir(parents=True)
    # Include the unchanged validators and documentation so all existing tests can
    # run against the FINAL site bytes with their normal relative paths.
    for folder in ('site', 'scripts', 'docs', '.github', 'owner'):
        if not (repo / folder).exists():
            continue
        shutil.copytree(repo / folder, output / folder, ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
    for source in repo.glob('*.md'):
        shutil.copyfile(source, output / source.name)
    subprocess.run(['node', str(repo / 'scripts/inject_legal_footer.cjs'), str(output / 'site')], check=True)
    stage(output / 'site')
    return output / 'site'


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    print(build(args.output))
