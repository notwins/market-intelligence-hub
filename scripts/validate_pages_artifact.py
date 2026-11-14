"""Run the complete publishing suite against staged bytes, then audit those exact bytes."""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from audit_pages_artifact import audit, ROOT
from validate_research_contracts import validate_site
from verify_research_destinations import verify_staged


def validate(artifact_root, report):
    artifact_root = Path(artifact_root).resolve()
    subprocess.run([sys.executable, '-m', 'unittest', 'discover', '-s', 'scripts', '-p', 'test_*.py'],
                   cwd=artifact_root, check=True)
    # Use the workflow's complete JS suite, once each, in its listed order. This
    # keeps the final artifact gate in sync when a publisher adds a source check.
    workflow = (ROOT/'.github/workflows/publish.yml').read_text(encoding='utf-8')
    checks = list(dict.fromkeys(re.findall(r'node scripts/(test_[\w]+\.cjs)', workflow)))
    if not checks:
        raise ValueError('Workflow has no JavaScript validation suite')
    if 'test_legal_footer.cjs' not in checks:
        checks.append('test_legal_footer.cjs')
    for name in checks:
        subprocess.run(['node', 'scripts/' + name], cwd=artifact_root, check=True)
    research_contracts = validate_site(artifact_root/'site')
    served_research = verify_staged(artifact_root/'site')
    result = audit(ROOT/'site', artifact_root/'site')
    result['research_contracts'] = research_contracts
    result['served_research_destinations'] = served_research
    result['source_git_commit'] = subprocess.check_output(
        ['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    result['final_validation'] = {'python': "unittest discover -s scripts -p test_*.py", 'javascript': checks}
    Path(report).write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({key: value for key, value in result.items()
                     if key not in ('checks', 'mutable_html', 'immutable_footer_exceptions', 'final_validation')}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--artifact-root', type=Path, required=True)
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args()
    validate(args.artifact_root, args.report)
