import copy,json,shutil,subprocess,tempfile,threading,unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from research_feed import ROOT,canonical,digest,read,build,compile_feed,collect,validate_report,validate_review
from submit_research import accept,submit,git
from research_release_guard import guard,restore_ui
from test_research_contracts import fixture,render,STANDARD

TAG={'id':'asset.fixed_income_bonds','label':'Fixed income / bonds','text':'#166534','background':'#F0FDF4','dark_text':'#86EFAC','dark_background':'#052E16'}
def seed(root):
    (root/'site/data').mkdir(parents=True)
    for name,data in [('colour-templates-v3.json',STANDARD),('external-source-standard.json',{'tags':[TAG]}),('research-register.json',{'entries':[]})]:
        (root/'site/data'/name).write_bytes(canonical(data))
    (root/'site/v4.html').write_text('<h1>Released UI A</h1>')
    git(root,'init','-b','main');git(root,'config','user.name','Test');git(root,'config','user.email','test@example.invalid');git(root,'add','.');git(root,'commit','-m','Base released UI')

def bundle(root,name='alpha',brief=False):
    rid='test-'+name+'-2026-11-14';p=root/rid;(p/'files').mkdir(parents=True,exist_ok=True)
    c,h=fixture();c['cutoff']='2026-11-14T08:00:00+08:00';h=h.replace('2026-11-07T12:00:00+08:00',c['cutoff']).replace('>Report</h1>','>'+name.title()+' complete synthetic study</h1>')
    text='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+name.title()+' complete synthetic study</title></head><body>'+render(c,h)+'</body></html>'
    (p/'files/index.html').write_text(text,encoding='utf-8')
    assets={'index.html':digest((p/'files/index.html').read_bytes())}
    r={'id':rid,'title':name.title()+' complete synthetic study','cutoff_sgt':c['cutoff'],'category':'Research','tags':[TAG['id']],'summary':'Original synthetic publication test with dated evidence labels and explicit limitations.','kind':'complete-report','full_report_url':'research/'+rid+'/index.html','full_report_sha256':assets['index.html'],'quick_read':None,'assets':assets}
    if brief:
        (p/'files/brief.html').write_text(text.replace('complete synthetic study','matching synthetic brief'),encoding='utf-8');assets['brief.html']=digest((p/'files/brief.html').read_bytes())
        r['quick_read']={'edition_id':rid,'full_report_sha256':assets['index.html'],'url':'research/'+rid+'/brief.html','sha256':assets['brief.html']}
    save(p,r);return p,p/'review.private.json'
def save(p,r):
    (p/'record.json').write_bytes(canonical(r));(p/'review.private.json').write_bytes(canonical({'record_sha256':digest(canonical(r)),'approved_at_sgt':'2026-11-14T09:00:00+08:00','complete':True,'public_safe':True,'rights_cleared':True,'reviewer':'Synthetic test reviewer'}))

class ResearchFeedTests(unittest.TestCase):
    def setUp(self):self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.repo=self.root/'repo';self.repo.mkdir();seed(self.repo)
    def tearDown(self):self.tmp.cleanup()
    def test_accept_does_not_edit_ui_or_copy_private_receipt(self):
        before=(self.repo/'site/v4.html').read_bytes();p,v=bundle(self.root,brief=True);paths,outcome=accept(self.repo,p,v)
        self.assertEqual(outcome,'accepted');self.assertEqual(before,(self.repo/'site/v4.html').read_bytes())
        self.assertFalse(any('private' in x for x in paths));self.assertFalse(list((self.repo/'site').rglob('*private*')))
        f=build(self.repo/'site');self.assertEqual(len(f['records']),1);self.assertNotIn('reviewer',json.dumps(f));self.assertEqual(accept(self.repo,p,v)[1],'duplicate')
    def test_rejects_summary_and_unapproved_private_fields(self):
        for key,value in [('kind','extract'),('private_source','secret'),('full_report_url','../private.html')]:
            p,v=bundle(self.root);r=read(p/'record.json');r[key]=value;save(p,r)
            with self.assertRaises(ValueError):accept(self.repo,p,v)
        p,v=bundle(self.root);r=read(v);r['rights_cleared']=False;v.write_bytes(canonical(r))
        with self.assertRaises(ValueError):accept(self.repo,p,v)
    def test_missing_brief_and_wrong_edition_fail(self):
        p,v=bundle(self.root,brief=True);r=read(p/'record.json');r['quick_read']['edition_id']='wrong';save(p,r)
        with self.assertRaises(ValueError):accept(self.repo,p,v)
        p,v=bundle(self.root,brief=True);(p/'files/brief.html').unlink()
        with self.assertRaises(ValueError):accept(self.repo,p,v)
    def test_failed_build_preserves_last_good_outputs(self):
        p,v=bundle(self.root);accept(self.repo,p,v);build(self.repo/'site');f=self.repo/'site/data/research-feed.json';before=f.read_bytes()
        (self.repo/'site/research/test-alpha-2026-11-14/index.html').write_text('broken')
        with self.assertRaises(ValueError):build(self.repo/'site')
        self.assertEqual(before,f.read_bytes())
    def test_bad_destination_and_unlisted_asset(self):
        p,v=bundle(self.root);r=read(p/'record.json');file=p/'files/index.html';file.write_text(file.read_text().replace('</body>','<a href="missing.html">Missing</a></body>'));r['assets']['index.html']=r['full_report_sha256']=digest(file.read_bytes());save(p,r)
        with self.assertRaisesRegex(ValueError,'destination'):accept(self.repo,p,v)
        p,v=bundle(self.root);(p/'files/private.txt').write_text('private fixture')
        with self.assertRaises(ValueError):accept(self.repo,p,v)
    def test_same_id_changed_content_rejected(self):
        p,v=bundle(self.root);accept(self.repo,p,v);r=read(p/'record.json');r['title']='Changed';save(p,r)
        with self.assertRaisesRegex(ValueError,'ID already'):accept(self.repo,p,v)
    def test_real_git_race_and_duplicate_retry(self):
        remote=self.root/'remote.git';git(None,'clone','--bare',str(self.repo),str(remote));barrier=threading.Barrier(2)
        jobs=[bundle(self.root,n) for n in ['alpha','beta']]
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures=[pool.submit(submit,remote,p,v,publish=True,barrier=barrier) for p,v in jobs]
            results=[f.result(timeout=40) for f in futures]
        self.assertTrue(all(r['published'] for r in results));verify=self.root/'verify';git(None,'clone',str(remote),str(verify))
        self.assertEqual(len(collect(verify/'site')[0]),2)
        self.assertEqual(submit(remote,*jobs[0],publish=True)['outcome'],'duplicate')
    def test_ui_merge_race_preserves_released_ui(self):
        remote=self.root/'remote.git';git(None,'clone','--bare',str(self.repo),str(remote));p,v=bundle(self.root);barrier=threading.Barrier(2)
        with ThreadPoolExecutor(max_workers=1) as pool:
            future=pool.submit(submit,remote,p,v,publish=True,barrier=barrier)
            ui=self.root/'ui';git(None,'clone',str(remote),str(ui));git(ui,'config','user.name','Test');git(ui,'config','user.email','test@example.invalid')
            (ui/'site/v4.html').write_text('<h1>Released UI B</h1>');git(ui,'add','.');git(ui,'commit','-m','Reviewed UI B');git(ui,'push','origin','main');barrier.wait(timeout=20);future.result(timeout=40)
        verify=self.root/'verify';git(None,'clone',str(remote),str(verify));self.assertIn('UI B',(verify/'site/v4.html').read_text());self.assertEqual(len(collect(verify/'site')[0]),1)
    def test_simultaneous_duplicate_is_accepted_once(self):
        remote=self.root/'remote.git';git(None,'clone','--bare',str(self.repo),str(remote));p,v=bundle(self.root);barrier=threading.Barrier(2)
        with ThreadPoolExecutor(max_workers=2) as pool:
            jobs=[pool.submit(submit,remote,p,v,publish=True,barrier=barrier) for _ in range(2)]
            results=[f.result(timeout=40) for f in jobs]
        self.assertEqual(sorted(r['outcome'] for r in results),['accepted','duplicate'])
    def test_failed_publication_preserves_remote_and_bundle(self):
        remote=self.root/'remote.git';git(None,'clone','--bare',str(self.repo),str(remote));p,v=bundle(self.root)
        before=git(remote,'rev-parse','main').stdout;hook=remote/'hooks/pre-receive';hook.write_bytes(b'#!/bin/sh\nexit 1\n');hook.chmod(0o755)
        with self.assertRaisesRegex(RuntimeError,'Push failed'):submit(remote,p,v,publish=True)
        self.assertEqual(git(remote,'rev-parse','main').stdout,before);self.assertTrue((p/'files/index.html').exists());self.assertTrue(v.exists())
    def test_guard_rejects_unregistered_report_asset(self):
        base=git(self.repo,'rev-parse','HEAD').stdout.strip();p=self.repo/'site/research/unregistered/index.html';p.parent.mkdir(parents=True);p.write_text('Unregistered');git(self.repo,'add','.');git(self.repo,'commit','-m','Unregistered')
        with self.assertRaisesRegex(ValueError,'publication record'):guard(self.repo,base,git(self.repo,'rev-parse','HEAD').stdout.strip())
    def test_ui_rollback_preserves_new_report_and_guard_rejects_overlap(self):
        base=git(self.repo,'rev-parse','HEAD').stdout.strip();p,v=bundle(self.root);accept(self.repo,p,v);git(self.repo,'add','.');git(self.repo,'commit','-m','Report');head=git(self.repo,'rev-parse','HEAD').stdout.strip()
        self.assertEqual(guard(self.repo,base,head)['lane'],'research')
        record=self.repo/'site/data/research-records/test-alpha-2026-11-14.json';before=record.read_bytes();(self.repo/'site/v4.html').write_text('UI B');git(self.repo,'add','.');git(self.repo,'commit','-m','UI B')
        restore_ui(self.repo,base,['site/v4.html']);self.assertEqual(record.read_bytes(),before);self.assertEqual(len(collect(self.repo/'site')[0]),1)
        git(self.repo,'add','.');git(self.repo,'commit','-m','UI rollback');self.assertEqual(guard(self.repo,head,git(self.repo,'rev-parse','HEAD').stdout.strip())['lane'],'ui-or-maintenance')
        (self.repo/'site/v4.html').write_text('Mixed UI');git(self.repo,'add','.');git(self.repo,'commit','-m','Mixed')
        with self.assertRaises(ValueError):guard(self.repo,base,git(self.repo,'rev-parse','HEAD').stdout.strip())
    def test_published_source_feed_is_consistent(self):
        expected=compile_feed(ROOT/'site');self.assertEqual(read(ROOT/'site/data/research-feed.json'),expected)

if __name__=='__main__':unittest.main()
