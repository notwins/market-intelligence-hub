import copy,json,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from io import BytesIO
OWNER=Path(__file__).resolve().parents[1]/'owner/read-up'
sys.path.insert(0,str(OWNER))
from server import Workshop
from approve import approve
from test_read_ups import fixture
import read_ups as R

class OwnerReadUpTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.db=self.root/'owner.sqlite3';self.w=Workshop(self.db,workspace=self.root)
    def tearDown(self):self.w.db.close();self.tmp.cleanup()
    def test_save_is_bookmark_only_and_survives_feed_rollover_restart(self):
        a,b=self.w.feed['items'][:2];self.w.bookmark(a['id'],True);self.assertEqual(self.w.state()['drafts'],[])
        feed={'status':'ok','generated_at':'2026-11-14T16:00:00+08:00','items':[b]}
        with patch('urllib.request.urlopen',return_value=BytesIO(json.dumps(feed).encode())):self.w.refresh()
        self.w.db.close();self.w=Workshop(self.db,workspace=self.root);state=self.w.state()
        self.assertEqual(state['feed']['generated_at'],feed['generated_at']);self.assertTrue(any(x['id']==a['id'] and x['archived'] for x in state['feed']['items']));self.assertEqual(self.w.create([a['id']])['selected'][0]['id'],a['id'])
    def test_single_multi_angle_and_unavailable(self):
        ids=[x['id'] for x in self.w.feed['items'][:2]];d=self.w.create(ids,'Explain the connection');self.assertEqual(len(d['selected']),2);self.assertEqual(d['angle'],'Explain the connection');self.assertEqual(d['happened'],'')
        self.assertTrue(self.w.blockers(d)[0]);self.assertEqual(d['id'],self.w.create(ids[::-1],'Explain the connection')['id'])
        with self.assertRaises(ValueError):self.w.prepare(d['id'],1)
    def ready(self):
        folder,_=fixture(self.root);r=R.read(folder/'record.json');d=self.w.create([self.w.feed['items'][0]['id']]);ev=copy.deepcopy(d['evidence']);ev[0].update(status='verified',original_url=r['sources'][0]['original_url'],accessed_url=r['sources'][0]['accessed_url'],notes='Private synthetic evidence.',checked_at=r['published_at'])
        return self.w.save(d['id'],1,{**{k:r[k] for k in ('title','takeaway','happened','matters','watch')},'evidence':ev})
    def test_browser_cannot_forge_review_and_approval_is_exact(self):
        d=self.ready();result=self.w.prepare(d['id'],d['version'])
        with self.assertRaises(ValueError):self.w.publish(d['id'],d['version'],True)
        approve(result['id'],'Private test reviewer',self.root)
        record=R.read(self.root/'outbox'/result['id']/'record.json');self.assertEqual(len(record['sources']),1)
        changed=self.w.save(d['id'],d['version'],{'title':'A different approved version is required'})
        with self.assertRaises(ValueError):self.w.publish(changed['id'],changed['version'],True)
        self.assertTrue((self.root/'outbox'/result['id']/'review.json').exists())
    def test_concurrent_edit_retains_recovery_and_homepage_is_held(self):
        d=self.w.create([self.w.feed['items'][0]['id']]);self.w.save(d['id'],1,{'notes':'first'});self.assertIn('conflict',self.w.save(d['id'],1,{'notes':'retained second'}));self.assertIn('retained second',self.w.state()['conflicts'][0]['body'])
        d=self.w.get(d['id']);ev=d['evidence'];ev[0]['original_url']='https://www.reuters.com/';d=self.w.save(d['id'],d['version'],{'evidence':ev});self.assertTrue(any('ARTICLE' in s for s in self.w.blockers(d)[0]))
    def test_postcommit_failed_readback_retains_durable_job_and_retry(self):
        d=self.ready();result=self.w.prepare(d['id'],d['version']);job=result['id'];approve(job,'Private test reviewer',self.root)
        with patch('server.submit',return_value={'outcome':'committed','candidate':'a'*40}),patch('server.urlopen',side_effect=OSError('Readback unavailable')),patch('server.time.sleep'):
            self.w.process(job)
        row=self.w.state()['publications'][0];self.assertEqual(row['status'],'awaiting-live-verification');self.assertIn('committed',row['history']);self.assertTrue((self.root/'outbox'/job/'review.json').exists())
        self.w.db.close();self.w=Workshop(self.db,workspace=self.root);self.assertEqual(self.w.state()['publications'][0]['status'],'awaiting-live-verification')
        with patch('server.submit',side_effect=RuntimeError('Authorized Git unavailable')):self.w.process(job)
        self.assertEqual(self.w.state()['publications'][0]['status'],'retry-needed');self.assertEqual(self.w.get(d['id'])['happened'],d['happened'])

if __name__=='__main__':unittest.main()
