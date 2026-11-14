import copy,json,tempfile,unittest
from pathlib import Path
from prepare_research_bundle import prepare,CHANNELS
from research_feed import read,canonical,digest
from test_research_feed import seed,bundle

class PrepareResearchBundleTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
        self.repo=self.root/'repo';self.repo.mkdir();seed(self.repo)
        self.input,_=bundle(self.root,brief=True)
        r=read(self.input/'record.json');self.meta={k:r[k] for k in ['title','cutoff_sgt','category','tags','summary']}
    def tearDown(self):self.tmp.cleanup()
    def test_every_scheduled_channel_and_standalone_uses_same_contract(self):
        for channel in [*CHANNELS,'standalone']:
            out=self.root/('output-'+channel)
            result=prepare(self.input/'files',self.meta,channel,out,slug='example-study' if channel=='standalone' else None,site=self.repo/'site')
            r=read(out/'record.json')
            self.assertEqual(r['assets']['index.html'],digest((out/'files/index.html').read_bytes()))
            self.assertIsNone(r['quick_read']);self.assertFalse(result['published']);self.assertTrue(result['review_required'])
            self.assertFalse((out/'review.private.json').exists())
    def test_brief_is_bound_to_exact_full_report(self):
        out=self.root/'output';prepare(self.input/'files',self.meta,'standalone',out,slug='example-study',brief='brief.html',site=self.repo/'site')
        r=read(out/'record.json');self.assertEqual(r['quick_read']['full_report_sha256'],r['full_report_sha256'])
        self.assertEqual(r['quick_read']['edition_id'],r['id'])
    def test_private_file_rejected_without_output(self):
        (self.input/'files/private.txt').write_text('private source')
        out=self.root/'output'
        with self.assertRaises(ValueError):prepare(self.input/'files',self.meta,'credit',out,site=self.repo/'site')
        self.assertFalse(out.exists())
    def test_metadata_and_cutoff_rejections_leave_no_bundle(self):
        for key,value in [('source_chat','private'),('cutoff_sgt','2026-11-13T08:00:00+08:00')]:
            meta={**self.meta,key:value};out=self.root/'output'
            with self.assertRaises(ValueError):prepare(self.input/'files',meta,'policy',out,site=self.repo/'site')
            self.assertFalse(out.exists())
    def test_no_overwrite_or_public_receipt_directory(self):
        out=self.root/'output';prepare(self.input/'files',self.meta,'earnings',out,site=self.repo/'site')
        before=(out/'record.json').read_bytes()
        with self.assertRaises(ValueError):prepare(self.input/'files',self.meta,'earnings',out,site=self.repo/'site')
        self.assertEqual(before,(out/'record.json').read_bytes())
        with self.assertRaises(ValueError):prepare(self.input/'files',self.meta,'earnings',self.repo/'site/private',site=self.repo/'site')
    def test_explicit_revision_keeps_original_destination_distinct(self):
        out=self.root/'output';result=prepare(self.input/'files',self.meta,'credit',out,revision=2,site=self.repo/'site')
        self.assertTrue(result['id'].endswith('-r2'))

if __name__=='__main__':unittest.main()
