import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import sgs_github_refresh as cloud


def run(root, *args):
    return subprocess.run(['git', *args], cwd=root, check=True, capture_output=True,
                          text=True, encoding='utf-8').stdout.strip()


def write(root, name, value):
    path = root / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value) + '\n', encoding='utf-8', newline='\n')


class SelectionTests(unittest.TestCase):
    def test_only_1900_sgt_schedule_selects_sgs(self):
        for schedule in ['0 0 * * *', '0 23 * * *', '17 6 * * 6']:
            self.assertFalse(cloud.selected('schedule', {'schedule': schedule}, {}))
        self.assertTrue(cloud.selected('schedule', {'schedule': '0 11 * * *'}, {}))

    def test_manual_sgs_is_explicit_and_regular_manual_behavior_is_retained(self):
        self.assertTrue(cloud.selected('workflow_dispatch', {'inputs': {'sgs_only': 'true'}}, {}))
        self.assertTrue(cloud.selected('workflow_dispatch', {'inputs': {'sgs_only': True}}, {}))
        self.assertFalse(cloud.selected('workflow_dispatch', {}, {}))
        self.assertFalse(cloud.selected('workflow_dispatch', {'inputs': {'sgs_only': 'false'}}, {}))

    def test_push_bootstraps_once_without_creating_a_second_schedule(self):
        self.assertTrue(cloud.selected('push', {}, {}))
        self.assertFalse(cloud.selected('push', {}, {'refresh_runner': cloud.RUNNER}))
        self.assertFalse(cloud.selected('pull_request', {}, {}))

    def test_workflow_preserves_other_schedules_and_deploys_in_the_same_run(self):
        text = (cloud.ROOT / '.github/workflows/publish.yml').read_text(encoding='utf-8')
        for cron in ['0 0 * * *', '0 23 * * *', '17 6 * * 6', cloud.CRON]:
            self.assertEqual(text.count("- cron: '" + cron + "'"), 1)
        self.assertIn('python3 scripts/sgs_github_refresh.py', text)
        self.assertIn("steps.sgs_mode.outputs.enabled != 'true'", text)
        self.assertIn("needs.build.outputs.sgs_failed == 'true'", text)
        self.assertIn('actions/deploy-pages@v4', text)
        self.assertIn('"$sgs_code" -eq 10', text)


class PublicationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.remote = self.directory / 'origin.git'
        self.remote.mkdir()
        run(self.remote, 'init', '--bare')
        self.root = self.directory / 'runner'
        self.root.mkdir()
        run(self.root, 'init', '-b', 'main')
        run(self.root, 'config', 'user.name', 'SGS test')
        run(self.root, 'config', 'user.email', 'sgs-test@example.invalid')
        run(self.root, 'config', 'core.autocrlf', 'false')
        write(self.root, cloud.PATHS[0], {'observations': [{'date': '2026-11-17'}]})
        write(self.root, cloud.PATHS[1], {'status': 'ok'})
        write(self.root, cloud.PATHS[2], {'untouched': 'original desk field'})
        (self.root / 'README.md').write_text('Published source\n', encoding='utf-8')
        run(self.root, 'add', '.')
        run(self.root, 'commit', '-m', 'Initial verified source')
        run(self.root, 'remote', 'add', 'origin', str(self.remote))
        run(self.root, 'push', '-u', 'origin', 'main')
        self.base = run(self.root, 'rev-parse', 'HEAD')

    def remote_text(self, path):
        return run(self.remote, 'show', 'refs/heads/main:' + path)

    def prepare(self, root):
        data = cloud.read(root, cloud.PATHS[0])
        if not any(r['date'] == '2026-11-19' for r in data['observations']):
            data['observations'].append({'date': '2026-11-19'})
        write(root, cloud.PATHS[0], data)
        write(root, cloud.PATHS[1], {'status': 'ok', 'latest_observation_date': '2026-11-19',
                                     'refresh_runner': cloud.RUNNER})
        return False

    def test_publication_contains_only_sgs_and_preserves_unrelated_generated_changes(self):
        (self.root / 'README.md').write_text('Temporary generated view\n', encoding='utf-8')
        result = cloud.publish(self.root, prepare=self.prepare, allow_local=True)
        self.assertFalse(result['source_failed'])
        self.assertEqual(self.remote_text('README.md'), 'Published source')
        self.assertEqual(json.loads(self.remote_text(cloud.PATHS[2]))['untouched'], 'original desk field')
        names = run(self.remote, 'diff', '--name-only', self.base, 'refs/heads/main').splitlines()
        self.assertTrue(set(names) <= set(cloud.PATHS))
        self.assertEqual(json.loads(self.remote_text(cloud.PATHS[0]))['observations'][-1]['date'], '2026-11-19')
        self.assertIn('SGS cloud pre-refresh', run(self.root, 'stash', 'list'))

    def test_concurrent_sgs_observation_and_other_change_survive_retry(self):
        second = self.directory / 'other'
        run(self.directory, 'clone', '--branch', 'main', str(self.remote), str(second))
        run(second, 'config', 'user.name', 'Concurrent source')
        run(second, 'config', 'user.email', 'concurrent@example.invalid')
        calls = []
        def prepare(root):
            calls.append(True)
            self.prepare(root)
            if len(calls) == 1:
                data = cloud.read(second, cloud.PATHS[0])
                data['observations'].append({'date': '2026-11-18'})
                write(second, cloud.PATHS[0], data)
                (second / 'README.md').write_text('Concurrent approved change\n', encoding='utf-8')
                run(second, 'add', '.')
                run(second, 'commit', '-m', 'Concurrent verified data')
                run(second, 'push', 'origin', 'HEAD:main')
            return False
        cloud.publish(self.root, prepare=prepare, allow_local=True)
        self.assertEqual(len(calls), 2)
        self.assertEqual(self.remote_text('README.md'), 'Concurrent approved change')
        rows = json.loads(self.remote_text(cloud.PATHS[0]))['observations']
        self.assertEqual([r['date'] for r in rows], ['2026-11-17', '2026-11-18', '2026-11-19'])

    def test_source_failure_publishes_health_only_and_retains_snapshot_bytes(self):
        before = self.remote_text(cloud.PATHS[0])
        def fail(root):
            write(root, cloud.PATHS[1], {'status': 'error', 'latest_observation_date': '2026-11-17',
                                         'refresh_runner': cloud.RUNNER})
            return True
        result = cloud.publish(self.root, prepare=fail, allow_local=True)
        self.assertTrue(result['source_failed'])
        self.assertEqual(self.remote_text(cloud.PATHS[0]), before)
        self.assertEqual(run(self.remote, 'diff', '--name-only', self.base, 'refs/heads/main'), cloud.PATHS[1])

    def test_unexpected_changed_path_is_never_committed(self):
        def wrong(root):
            self.prepare(root)
            (root / 'README.md').write_text('Forbidden change\n', encoding='utf-8')
            return False
        with self.assertRaisesRegex(ValueError, 'allowlist'):
            cloud.publish(self.root, prepare=wrong, allow_local=True)
        self.assertEqual(run(self.remote, 'rev-parse', 'refs/heads/main'), self.base)

    def test_auth_or_network_push_error_is_not_retried_as_concurrency(self):
        original_git = cloud.git
        def blocked(root, *args, **kwargs):
            if args[0] == 'push':
                return subprocess.CompletedProcess(['git', *args], 1, '', 'Access denied')
            return original_git(root, *args, **kwargs)
        with patch.object(cloud, 'git', side_effect=blocked):
            with self.assertRaisesRegex(RuntimeError, 'main did not advance'):
                cloud.publish(self.root, prepare=self.prepare, allow_local=True)
        self.assertEqual(run(self.remote, 'rev-parse', 'refs/heads/main'), self.base)

    def test_local_publication_is_guarded(self):
        with patch.dict('os.environ', {'GITHUB_ACTIONS': 'false'}):
            with self.assertRaisesRegex(RuntimeError, 'GitHub Actions'):
                cloud.publish(self.root)


class PreparationTests(unittest.TestCase):
    def test_failed_check_rolls_back_snapshot_and_desk_and_marks_cloud_failure(self):
        from update_sgs_daily import atomic_json
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write(root, cloud.PATHS[0], {'source_url': 'https://eservices.mas.gov.sg/statistics/fdanet/SgsBenchmarkIssuePrices.aspx',
                                        'observations': [{'date': '2026-11-17'}]})
            write(root, cloud.PATHS[1], {'status': 'ok', 'last_success': '2026-11-17T11:00:00Z'})
            write(root, cloud.PATHS[2], {'untouched': True})
            before = {p: (root / p).read_bytes() for p in (cloud.PATHS[0], cloud.PATHS[2])}
            def failed_update(root):
                atomic_json(root / cloud.PATHS[0], {'observations': []})
                raise ValueError('Fixture source layout changed')
            with patch('update_sgs_daily.update', side_effect=failed_update):
                self.assertTrue(cloud.prepare_current(root))
            for p, raw in before.items():
                self.assertEqual((root / p).read_bytes(), raw)
            status = cloud.read(root, cloud.PATHS[1])
            self.assertEqual(status['status'], 'error')
            self.assertEqual(status['last_success'], '2026-11-17T11:00:00Z')
            self.assertEqual(status['refresh_runner'], cloud.RUNNER)


if __name__ == '__main__':
    unittest.main()
