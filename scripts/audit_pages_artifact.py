"""Verify final Pages bytes against source and original receipts, without rewriting either."""
import argparse
import hashlib
import json
import subprocess
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def inventory(root):
    files = {}
    for path in sorted(root.rglob('*')):
        if path.is_symlink():
            raise ValueError(f'Symlink in publication tree: {path}')
        if path.is_file():
            files[path.relative_to(root).as_posix()] = path
    return files


def audit(source, artifact, repo=ROOT):
    source, artifact, repo = Path(source).resolve(), Path(artifact).resolve(), Path(repo).resolve()
    if source == artifact:
        raise ValueError('Source and deployment artifact must be separate trees')
    source_files, artifact_files = inventory(source), inventory(artifact)
    if source_files.keys() != artifact_files.keys():
        raise ValueError(f'Artifact file set changed: missing={sorted(source_files.keys()-artifact_files.keys())}, '
                         f'extra={sorted(artifact_files.keys()-source_files.keys())}')
    code = 'console.log(JSON.stringify([...require(process.argv[1]).protectedHtml(process.argv[2],process.argv[3])]))'
    protected = set(json.loads(subprocess.check_output(
        ['node', '-e', code, str(repo/'scripts/publication_policy.cjs'), str(source), str(repo)], text=True)))
    unchanged = 0
    mutable = []
    for relative, path in source_files.items():
        # Everything except an explicitly eligible HTML presentation must survive
        # byte-for-byte: manifests, archives, review receipts, downloads, CSS, JSON.
        if not relative.lower().endswith('.html') or relative in protected or relative.startswith('legal/'):
            if path.read_bytes() != artifact_files[relative].read_bytes():
                raise ValueError(f'Protected source bytes changed: {relative}')
            unchanged += 1
        else:
            mutable.append(relative)

    checks = []

    def check(relative, expected, category, size=None):
        relative = str(relative).replace('\\', '/')
        if relative.startswith('/') or any(part in ('.', '..') for part in relative.split('/')) or ':' in relative:
            raise ValueError(f'Unsafe receipt path: {relative}')
        if not isinstance(expected, str) or len(expected) != 64 or any(c not in '0123456789abcdef' for c in expected):
            raise ValueError(f'Invalid SHA-256 receipt: {relative}')
        raw = (artifact / relative).read_bytes()
        if digest(raw) != expected:
            raise ValueError(f'{category} SHA-256 mismatch: {relative}')
        if size is not None and len(raw) != size:
            raise ValueError(f'{category} size mismatch: {relative}')
        checks.append({'path': relative, 'category': category, 'sha256': expected, 'bytes': len(raw)})

    def read(relative):
        return json.loads((artifact / relative).read_text(encoding='utf-8'))

    for report in read('data/watchlist/report-index.json')['reports']:
        check(report['path'], report['sha256'], 'watchlist_report')
    for call in read('data/watchlist/calls.json')['calls']:
        record = read(f"data/watchlist/calls/{call['id']}.json")
        if record != call:
            raise ValueError(f"Call index/archive mismatch: {call['id']}")
        if call['report'].get('html_path'):
            check(call['report']['html_path'], call['report']['sha256'], 'call_report')
    manifests = [p for p in artifact_files if p.endswith('/publication.json')]
    for relative in manifests:
        manifest = read(relative)
        folder = Path(relative).parent
        base = folder.parent if folder.name == 'presentations' else folder
        if 'html_sha256' in manifest:
            check((base/'index.html').as_posix(), manifest['html_sha256'], 'publication_html')

        def visit(value):
            if isinstance(value, list):
                for child in value:
                    visit(child)
            elif isinstance(value, dict):
                if 'path' in value and 'sha256' in value:
                    check((base/value['path']).as_posix(), value['sha256'], 'publication_companion', value.get('bytes'))
                for name, expected in value.get('preserved_source_files', {}).items():
                    check((base/name).as_posix(), expected, 'preserved_source_file')
                for child in value.values():
                    visit(child)
        visit(manifest)
    for shard in read('data/ust-curves-daily.json')['history_files']:
        check('data/' + shard['path'], shard['sha256'], 'treasury_shard')
    return {
        'result': 'passed', 'source_file_count': len(source_files),
        'byte_identical_file_count': unchanged, 'protected_html_count': len(protected),
        'publication_manifest_count': len(manifests),
        'receipt_checks': dict(sorted(Counter(row['category'] for row in checks).items())),
        'mutable_html': sorted(mutable), 'immutable_footer_exceptions': sorted(protected),
        'checks': checks,
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-site', type=Path, default=ROOT/'site')
    parser.add_argument('--artifact-site', type=Path, required=True)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    result = audit(args.source_site, args.artifact_site)
    if args.report:
        args.report.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({key: value for key, value in result.items()
                      if key not in ('checks', 'mutable_html', 'immutable_footer_exceptions')}, indent=2))
