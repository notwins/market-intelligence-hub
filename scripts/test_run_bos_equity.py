import copy
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest import mock

import bos_equity_feed as feed
import run_bos_equity as runner
from test_bos_equity_feed import snapshot, PDF


class RunnerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.seed = self.root/'seed'
        self.archive = self.root/'archive'
        for repo in (self.seed, self.archive):
            subprocess.run(['git','init','-b','main',str(repo)],check=True,capture_output=True)
            runner.configure_identity(repo)
            runner.git(repo,'config','core.autocrlf','false')
            (repo/'README.md').write_bytes(b'Preserve this root file\n')
            runner.git(repo,'add','README.md')
            runner.git(repo,'commit','-m','Initial fixture')
        self.data = snapshot(day='2026-11-13')
        feed.ingest(self.data,PDF,self.seed,self.root/'private',public=True)
        runner.git(self.seed,'-c','core.autocrlf=false','add','bos')
        runner.git(self.seed,'commit','-m','Initial BOS')
        runner.git(self.seed,'branch','market-prices')
        self.public_remote=self.bare(self.seed,'public.git')
        self.private_remote=self.bare(self.archive,'private.git')

    def bare(self,repo,name):
        remote=self.root/name
        subprocess.run(['git','clone','--bare',str(repo),str(remote)],check=True,capture_output=True)
        runner.git(repo,'remote','add','origin',str(remote))
        return remote

    def manifest(self):
        return feed.read_json(self.seed/'bos/manifest.json')

    def test_index_hash_gate_catches_line_ending_conversion(self):
        manifest=self.manifest()
        ref=manifest['latest']['csv']
        path=self.seed/'bos'/ref['path']
        # Simulate an index blob silently normalized by Windows Git.
        path.write_bytes(path.read_bytes().replace(b'\r\n',b'\n'))
        runner.git(self.seed,'add','--',str(path))
        with self.assertRaisesRegex(ValueError,'checksum mismatch'):
            runner.guard_index(self.seed,manifest,runner.text(self.seed,'rev-parse','HEAD'))

    def test_outside_bos_path_holds_publication(self):
        (self.seed/'README.md').write_text('Changed Yahoo root\n')
        runner.git(self.seed,'add','README.md')
        with self.assertRaisesRegex(ValueError,'Unexpected staged path'):
            runner.guard_index(self.seed,self.manifest(),runner.text(self.seed,'rev-parse','HEAD'))

    def test_public_archive_is_rejected(self):
        runner.git(self.archive,'remote','set-url','origin','https://github.com/'+runner.ARCHIVE+'.git')
        with mock.patch.object(runner.urllib.request,'urlopen'):
            with self.assertRaisesRegex(ValueError,'publicly accessible'):
                runner.require_private_archive(self.archive)

    def test_remote_conflict_does_not_push(self):
        with mock.patch.object(runner,'remote_head',return_value='new-head'),mock.patch.object(runner,'git') as operation:
            self.assertFalse(runner.push(self.seed,'market-prices','stale-head'))
            operation.assert_not_called()

    def test_checkout_url_suffix_does_not_weaken_repository_guard(self):
        self.assertTrue(runner.same_origin(runner.HUB.removesuffix('.git'),runner.HUB))
        self.assertFalse(runner.same_origin(runner.HUB+'.evil',runner.HUB))
        self.assertFalse(runner.same_origin('https://example.com/notwins/market-intelligence-hub',runner.HUB))

    def run_fixture(self, pdf=PDF, data=None):
        data=data or self.data
        with mock.patch.object(runner,'HUB',str(self.public_remote)), \
             mock.patch.object(runner,'require_private_archive'), \
             mock.patch.object(feed,'discover_pdf',return_value=(feed.iso_date(data['reportDate']),data['sourceUrl'],pdf)), \
             mock.patch.object(runner,'parse_pdf',return_value=data), \
             mock.patch.object(runner,'verify_remote'):
            return runner.run(self.seed,self.archive,self.root/'work')

    def test_identical_source_archives_without_public_commit(self):
        parent=runner.remote_head(self.seed,'market-prices')
        result=self.run_fixture()
        self.assertEqual(result['outcome'],'unchanged')
        self.assertIsNone(result['publishedCommit'])
        self.assertEqual(runner.remote_head(self.seed,'market-prices'),parent)
        archived=runner.git(self.archive,'fetch','origin','main')
        files=runner.text(self.archive,'ls-tree','-r','--name-only','FETCH_HEAD')
        self.assertIn('bos/pdf/2026-11-13-',files)
        self.assertIn('-complete.json',files)

    def test_new_source_publishes_and_preserves_root_and_history(self):
        raw=PDF+b'new-source'
        data=snapshot(day='2026-11-16',raw=raw)
        result=self.run_fixture(raw,data)
        self.assertEqual(result['outcome'],'published')
        self.assertEqual(result['priceSources'],2)
        self.assertEqual(result['priceObservations'],6)
        runner.git(self.seed,'fetch','origin','market-prices')
        self.assertEqual(runner.git(self.seed,'show','FETCH_HEAD:README.md').stdout,b'Preserve this root file\n')

    def test_cleanup_warning_stops_before_archive_or_push(self):
        with mock.patch.object(feed,'ingest',return_value={'warnings':['locked obsolete file']}), \
             mock.patch.object(runner,'save_archive') as archive:
            with self.assertRaisesRegex(ValueError,'Cleanup warnings'):
                self.run_fixture()
            archive.assert_not_called()

    def test_source_validation_failure_retains_remote_head(self):
        parent=runner.remote_head(self.seed,'market-prices')
        bad=copy.deepcopy(self.data)
        bad['reportDate']='2026-11-12'
        with self.assertRaises(ValueError):
            self.run_fixture(data=bad)
        self.assertEqual(runner.remote_head(self.seed,'market-prices'),parent)

    def test_remote_readback_failure_is_not_success(self):
        repo=self.seed
        with mock.patch.object(runner.urllib.request,'urlopen',side_effect=TimeoutError):
            with self.assertRaisesRegex(RuntimeError,'unverified'):
                runner.verify_remote(repo,self.manifest(),attempts=1,delay=0)

    def test_concurrent_yahoo_update_is_preserved_on_fresh_retry(self):
        real_push=runner.push
        collided=False
        def concurrent_push(repo,branch,expected):
            nonlocal collided
            if branch=='market-prices' and not collided:
                collided=True
                other=self.root/'other-writer'
                parent=runner.fresh_worktree(self.seed,other,'market-prices')
                (other/'README.md').write_bytes(b'New Yahoo observation\n')
                runner.git(other,'add','README.md')
                runner.git(other,'commit','-m','Other data writer')
                self.assertTrue(real_push(other,branch,parent))
                return False
            return real_push(repo,branch,expected)
        raw=PDF+b'concurrent-source'
        with mock.patch.object(runner,'push',side_effect=concurrent_push):
            result=self.run_fixture(raw,snapshot(day='2026-11-16',raw=raw))
        self.assertTrue(collided)
        self.assertEqual(result['outcome'],'published')
        runner.git(self.seed,'fetch','origin','market-prices')
        self.assertEqual(runner.git(self.seed,'show','FETCH_HEAD:README.md').stdout,b'New Yahoo observation\n')


if __name__=='__main__':
    unittest.main()
