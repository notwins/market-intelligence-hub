"""SGS-only GitHub Actions refresh and non-force publication.

The existing Pages workflow deploys the accepted source in this SAME run;
GITHUB_TOKEN pushes do not need to trigger another workflow.
"""
import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CRON = '0 11 * * *'  # 19:00 Asia/Singapore, which has no daylight-saving shift.
RUNNER = 'github_actions'
PATHS = ('site/data/sgs-daily-snapshot.json', 'site/data/sgs-daily-status.json',
         'site/data/desk-data.json')


def selected(event_name, event, status):
    if event_name == 'schedule':
        return event.get('schedule') == CRON
    if event_name == 'workflow_dispatch':
        return event.get('inputs', {}).get('sgs_only') in (True, 'true')
    # One cloud handoff run on installation. Once the cloud-written status is
    # committed, ordinary UI pushes do not request MAS again.
    return event_name == 'push' and status.get('refresh_runner') != RUNNER


def command(root, args, check=True):
    return subprocess.run(args, cwd=root, text=True, encoding='utf-8',
                          capture_output=True, check=check)


def git(root, *args, check=True):
    return command(root, ['git', *args], check)


def read(root, name):
    return json.loads((Path(root) / name).read_text(encoding='utf-8'))


def prepare_current(root=ROOT):
    """Fetch once; a failed source/check restores last-good financial data."""
    from update_sgs_daily import update, atomic_json
    root = Path(root)
    original = {name: (root / name).read_bytes() for name in PATHS}
    old_snapshot = json.loads(original[PATHS[0]])
    old_status = json.loads(original[PATHS[1]])
    failed = False
    try:
        update(root)
        command(root, [sys.executable, 'scripts/build_desk_data.py', '--sgs-only'])
        snapshot = read(root, PATHS[0])
        if snapshot['observations'][:len(old_snapshot['observations'])] != old_snapshot['observations']:
            raise ValueError('Saved SGS observations must remain unchanged')
        previous_desk, next_desk = json.loads(original[PATHS[2]]), read(root, PATHS[2])
        if ({k: v for k, v in previous_desk.items() if k != 'yields'} !=
                {k: v for k, v in next_desk.items() if k != 'yields'}):
            raise ValueError('Non-SGS desk fields changed')
        other = lambda d: [r for r in d['yields'] if not r['id'].startswith('sgs-')]
        if other(previous_desk) != other(next_desk):
            raise ValueError('Non-SGS yield rows changed')
        command(root, [sys.executable, '-m', 'unittest', 'discover', '-s', 'scripts', '-p', 'test_sgs_daily.py'])
        command(root, ['node', 'scripts/test_sgs_daily.cjs'])
    except Exception as exc:
        failed = True
        # Keep detailed errors in the Actions log, never in public JSON.
        print('SGS source/check failure: ' + type(exc).__name__ + ': ' + str(exc), file=sys.stderr)
        if isinstance(exc, subprocess.CalledProcessError) and (exc.stderr or exc.stdout):
            print((exc.stderr or exc.stdout).strip(), file=sys.stderr)
        for name, raw in original.items():
            (root / name).write_bytes(raw)
        now = datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')
        atomic_json(root / PATHS[1], {
            'schema_version': 1, 'status': 'error', 'last_attempt': now,
            'last_success': old_status.get('last_success'),
            'latest_observation_date': old_snapshot['observations'][-1]['date'],
            'source_url': old_snapshot['source_url'],
            'message': 'MAS source or SGS validation failed. Last verified closing data and history retained. See the GitHub Actions run for details.'})
    status = read(root, PATHS[1])
    status['refresh_runner'] = RUNNER
    atomic_json(root / PATHS[1], status)
    return failed


def prepare_subprocess(root):
    # After a concurrent main update, execute the CURRENT owning writer/checks,
    # rather than applying a saved snapshot or old imported calculation code.
    result = command(root, [sys.executable, 'scripts/sgs_github_refresh.py', '--prepare-only'], check=False)
    if result.stdout:
        print(result.stdout.strip())
    if result.stderr:
        print(result.stderr.strip(), file=sys.stderr)
    if result.returncode not in (0, 10):
        raise RuntimeError('SGS preparation could not produce a safe candidate')
    return result.returncode == 10


def publish(root=ROOT, attempts=3, prepare=prepare_subprocess, allow_local=False):
    root = Path(root).resolve()
    if not allow_local and (os.environ.get('GITHUB_ACTIONS') != 'true' or
                            os.environ.get('GITHUB_REPOSITORY') != 'notwins/market-intelligence-hub'):
        raise RuntimeError('Cloud publication requires the expected GitHub Actions repository')
    if Path(git(root, 'rev-parse', '--show-toplevel').stdout.strip()).resolve() != root:
        raise ValueError('Use the repository root')
    if git(root, 'diff', '--cached', '--name-only').stdout.strip():
        raise ValueError('Unexpected staged changes; refusing to publish')
    # Earlier workflow checks may create derived catalogues. Preserve them in
    # this isolated runner; the normal build regenerates them after reconciliation.
    if git(root, 'status', '--porcelain').stdout.strip():
        git(root, 'stash', 'push', '--include-untracked', '-m', 'SGS cloud pre-refresh derived files')
    for attempt in range(attempts):
        git(root, 'fetch', 'origin', 'main')
        base = git(root, 'rev-parse', 'FETCH_HEAD').stdout.strip()
        git(root, 'switch', '--detach', base)
        failed = prepare(root)
        changed = set(git(root, 'diff', '--name-only').stdout.splitlines())
        changed.update(git(root, 'ls-files', '--others', '--exclude-standard').stdout.splitlines())
        if changed - set(PATHS):
            raise ValueError('SGS preparation changed paths outside the three-file allowlist')
        git(root, 'add', '--', *PATHS)
        staged = set(git(root, 'diff', '--cached', '--name-only').stdout.splitlines())
        if staged - set(PATHS):
            raise ValueError('Unexpected staged publication paths')
        if not staged:
            return {'source_failed': failed, 'commit': base, 'changed': False}
        status = read(root, PATHS[1])
        message = ('Record SGS refresh failure and retain verified history' if failed else
                   'Refresh MAS SGS closing levels through ' + status['latest_observation_date'])
        git(root, 'commit', '-m', message)
        candidate = git(root, 'rev-parse', 'HEAD').stdout.strip()
        pushed = git(root, 'push', 'origin', 'HEAD:main', check=False)
        if pushed.returncode == 0:
            return {'source_failed': failed, 'commit': candidate, 'changed': True}
        # Retry only a real concurrent main advance. Authentication, permissions
        # and network failures never become a force push or a fabricated success.
        fetched = git(root, 'fetch', 'origin', 'main', check=False)
        if fetched.returncode or git(root, 'rev-parse', 'FETCH_HEAD').stdout.strip() == base:
            raise RuntimeError('SGS data push failed; main did not advance. Pages deployment must stop.')
        if attempt + 1 == attempts:
            raise RuntimeError('Main kept advancing; SGS candidate was not published')
        # Current candidate is committed and working tree is clean. The next
        # iteration starts at new main and fetches MAS again without overwriting
        # a concurrent SGS observation or restoring an old whole-file snapshot.
    raise RuntimeError('No SGS publication attempt completed')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--select', action='store_true')
    parser.add_argument('--prepare-only', action='store_true')
    args = parser.parse_args()
    if args.select:
        event_file = os.environ.get('GITHUB_EVENT_PATH')
        event = json.loads(Path(event_file).read_text(encoding='utf-8')) if event_file else {}
        enabled = selected(os.environ.get('GITHUB_EVENT_NAME'), event, read(ROOT, PATHS[1]))
        with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as stream:
            stream.write('enabled=' + str(enabled).lower() + '\n')
        return 0
    if args.prepare_only:
        failed = prepare_current()
        print(json.dumps({'source_failed': failed, 'status': read(ROOT, PATHS[1])}))
        return 10 if failed else 0
    result = publish()
    status = read(ROOT, PATHS[1])
    summary = ('SGS source refresh failed; last verified data retained.' if result['source_failed'] else
               'SGS closing data checked and saved through ' + status['latest_observation_date'] + '.')
    print(json.dumps({**result, 'status': status}))
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a', encoding='utf-8') as stream:
            stream.write('### Daily MAS SGS refresh\n\n' + summary + '\n\nDirect source: ' +
                         status['source_url'] + '\n\nSource check: ' + status['last_attempt'] +
                         '\n\nObservation date: ' + status['latest_observation_date'] +
                         '\n\nNo source AI chat. The same workflow validates and deploys these saved files.\n')
    return 10 if result['source_failed'] else 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as exc:
        print('SGS cloud publication stopped: ' + str(exc), file=sys.stderr)
        sys.exit(1)
