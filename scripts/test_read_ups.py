import concurrent.futures, copy, json, re, shutil, tempfile, threading, unittest
from datetime import datetime
from pathlib import Path
import read_ups as R
from submit_read_up import accept,submit
from submit_research import git

def fixture(root,article='capacity',revision=1):
    r=dict(kind='reuters-read-up',revision=revision,published_at='2026-11-14T08:00:00+08:00',title='Capacity and funding',takeaway='Demand and funding need to be read together.',
           happened='Selected reporting describes an investment plan. [S1]',matters='Our interpretation: cash timing matters. [S1]',watch='Our watch points: compare receipts with payments. [S1]',
           sources=[dict(id='S1',title='Selected story',original_url='https://www.reuters.com/business/'+article+'-2026-11-14/',accessed_url='https://www.reuters.com/business/'+article+'-2026-11-14/')],primary=[])
    r['id']='read-up-'+R.scope(r['sources']);r['word_count']=len(re.findall(r"\b[\w’'-]+\b",' '.join(r[k] for k in ('title','takeaway','happened','matters','watch'))))
    evidence={'selected_ids':['selected-id'],'sources':[dict(id='S1',article_id='selected-id',original_url=r['sources'][0]['original_url'],accessed_url=r['sources'][0]['accessed_url'],checked_at=r['published_at'],notes='Private synthetic evidence for isolated tests only.',status='verified')]}
    receipt={'record_sha256':R.digest(R.canonical(r)),'evidence_sha256':R.digest(R.canonical(evidence)),'approved_at':datetime.now(R.SGT).isoformat(timespec='seconds'),'reviewer':'Private test reviewer','checks':dict.fromkeys(('facts','exact_selection','privacy','rights','editorial'),True)}
    folder=Path(root)/('bundle-'+article+'-'+str(revision));folder.mkdir();(folder/'record.json').write_bytes(R.canonical(r));(folder/'evidence.json').write_bytes(R.canonical(evidence));path=folder/'private-review.json';path.write_bytes(R.canonical(receipt));return folder,path

class ReadUpTests(unittest.TestCase):
    def setUp(self):self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.repo=self.root/'repo';(self.repo/'site').mkdir(parents=True)
    def tearDown(self):self.tmp.cleanup()
    def test_exact_approval_one_card_retry_and_private_exclusion(self):
        b,v=fixture(self.root);paths,_=accept(self.repo,b,v);self.assertEqual(len(paths),1);self.assertEqual(accept(self.repo,b,v)[1],'duplicate');index=R.collect(self.repo/'site');self.assertEqual(len(index['entries']),1);self.assertNotIn('Private synthetic',json.dumps(index));self.assertNotIn('reviewer',json.dumps(index))
    def test_unavailable_source_and_stale_approval(self):
        b,v=fixture(self.root);e=R.read(b/'evidence.json');e['sources'][0]['status']='unavailable';(b/'evidence.json').write_bytes(R.canonical(e))
        with self.assertRaises(ValueError):accept(self.repo,b,v)
        e['sources'][0]['status']='verified';e['sources'][0]['notes']='Changed evidence';(b/'evidence.json').write_bytes(R.canonical(e))
        with self.assertRaisesRegex(ValueError,'Stale'):accept(self.repo,b,v)
        self.assertEqual(R.collect(self.repo/'site')['entries'],[])
    def test_demo_private_fields_types_and_unsafe_original_rejected(self):
        b,v=fixture(self.root);r=R.read(b/'record.json')
        for patch in [{'demo':True},{'notes':'private'},{'title':None},{'revision':True}]:
            with self.assertRaises((ValueError,TypeError)):R.validate({**r,**patch})
        for value in ['javascript:alert(1)','https://www.reuters.com/','https://www.reuters.com@evil.invalid/business/a','https://127.0.0.1/business/a']:
            invalid=copy.deepcopy(r);invalid['sources'][0]['original_url']=value
            with self.assertRaises(ValueError):R.validate(invalid)
    def test_canonical_duplicate_and_scope(self):
        b,v=fixture(self.root);r=R.read(b/'record.json');sources=copy.deepcopy(r['sources']);sources[0]['original_url']+='?utm_source=x#top';self.assertEqual(R.scope(sources),R.scope(r['sources']))
        r['sources']*=2
        with self.assertRaises(ValueError):R.validate(r)
    def test_revision_preserves_original_and_conflicts(self):
        b,v=fixture(self.root);accept(self.repo,b,v);first=R.collect(self.repo/'site')['entries'][0]
        b2,v2=fixture(self.root,revision=2);accept(self.repo,b2,v2);index=R.collect(self.repo/'site');self.assertEqual(len(index['entries']),1);self.assertEqual(index['entries'][0]['revision'],2)
        out=self.root/'artifact';(out/'data').mkdir(parents=True);R.build(self.repo/'site',out);self.assertEqual((out/R.destination(first)).read_bytes(),R.render(first));self.assertTrue((out/R.destination(index['entries'][0])).exists())
        r=R.read(b/'record.json');r['title']='Changed';(b/'record.json').write_bytes(R.canonical(r))
        with self.assertRaises(ValueError):accept(self.repo,b,v)
    def test_missing_revision_and_missing_source_citation_fail_without_card(self):
        b,v=fixture(self.root,revision=2)
        with self.assertRaisesRegex(ValueError,'Missing prior'):accept(self.repo,b,v)
        self.assertEqual(R.collect(self.repo/'site')['entries'],[])
        r=R.read(b/'record.json');r['happened']='No citation'
        with self.assertRaises(ValueError):R.validate(r)
    def test_two_independent_publishers_and_lost_ack_retry(self):
        git(self.repo,'init','-b','main');git(self.repo,'config','user.name','Test');git(self.repo,'config','user.email','test@example.invalid');(self.repo/'initial').write_text('Fixture');git(self.repo,'add','.');git(self.repo,'commit','-m','Initial')
        remote=self.root/'remote.git';git(None,'clone','--bare',str(self.repo),str(remote));a,av=fixture(self.root,'alpha');b,bv=fixture(self.root,'beta');barrier=threading.Barrier(2)
        with concurrent.futures.ThreadPoolExecutor(2) as pool:
            results=list(pool.map(lambda pair:submit(str(remote),*pair,publish=True,barrier=barrier),[(a,av),(b,bv)]))
        check=self.root/'check';git(None,'clone','--quiet',str(remote),str(check));self.assertEqual(len(R.collect(check/'site')['entries']),2)
        self.assertTrue(all(x['outcome']=='committed' for x in results));self.assertEqual(submit(str(remote),a,av,publish=True)['outcome'],'duplicate')
    def test_failed_publish_keeps_review_bundle_and_remote_feed(self):
        b,v=fixture(self.root);before=(b/'record.json').read_bytes()
        with self.assertRaises(RuntimeError):submit(str(self.root/'missing.git'),b,v,publish=True)
        self.assertEqual((b/'record.json').read_bytes(),before);self.assertTrue(v.exists());self.assertEqual(R.collect(self.repo/'site')['entries'],[])

if __name__=='__main__':unittest.main()
