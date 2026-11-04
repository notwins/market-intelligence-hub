import copy
import datetime as dt
import json
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from watchlist_research_review import template, validate_review, validate_index, import_review, index_parts
from prepare_watchlist_publication import prepare

ROOT=Path(__file__).resolve().parents[1]
BASE='a'*40


class ResearchReviewTests(unittest.TestCase):
    def setUp(self):
        self.d=json.loads((ROOT/'site/data/watchlist/archive/watchlist-20261104T160000Z.json').read_text(encoding='utf-8'))
        self.review=json.loads((ROOT/'site/data/watchlist/reviews'/f"{self.d['id']}.json").read_text(encoding='utf-8'))

    def complete(self,d):
        r=template(d);r['public_content_reviewed']=True
        r['reviewed_at']=dt.datetime.now(dt.timezone.utc).isoformat()
        for item in r['items']:
            item.update(scope='company',reason='Test fixture: each saved item is company-specific and retains its material qualifications.')
        return r

    def test_all_published_editions_are_completely_reviewed(self):
        count=validate_index(ROOT/'site')
        self.assertEqual(count,len(json.loads((ROOT/'site/data/watchlist/index.json').read_text())['editions']))
        mapped,_=index_parts(self.d,self.review)
        self.assertEqual(set(mapped),{'GOOGL','AMZN','META'})

    def test_draft_cannot_approve_anything(self):
        draft=template(self.d)
        self.assertFalse(draft['public_content_reviewed'])
        self.assertTrue(all(i['scope']=='pending' for i in draft['items']))
        with self.assertRaisesRegex(ValueError,'incomplete'):validate_review(self.d,draft)

    def test_same_headline_changed_content_is_rejected(self):
        for change in [lambda x:x['facts'].append('Unreviewed fact'),lambda x:x.update(analysis='New analysis'),lambda x:x.update(risks='Different risk'),lambda x:x.update(next_watch='New next check'),lambda x:x['sources'][0].update(url='https://example.com/changed')]:
            d=copy.deepcopy(self.d);change(d['rows'][3]['research'][0])
            with self.assertRaisesRegex(ValueError,'content has changed'):validate_review(d,self.review)

    def test_all_decisions_required_and_no_duplicate_or_unreviewed_scope(self):
        for change in [lambda r:r['items'].pop(),lambda r:r['items'].append(copy.deepcopy(r['items'][0])),lambda r:r['items'][0].update(scope='pending'),lambda r:r['items'][0].update(reason=''),lambda r:r.update(private_notes='private')]:
            r=copy.deepcopy(self.review);change(r)
            with self.assertRaises(ValueError):validate_review(self.d,r)

    def test_price_context_cannot_be_promoted_to_company(self):
        d=json.loads((ROOT/'site/data/watchlist/archive/watchlist-20261103T160000Z.json').read_text(encoding='utf-8'))
        r=self.complete(d)
        with self.assertRaisesRegex(ValueError,'cannot be company'):validate_review(d,r)

    def test_review_is_immutable(self):
        with tempfile.TemporaryDirectory() as temp:
            import_review(self.d,self.review,temp)
            r=copy.deepcopy(self.review);r['items'][0]['reason']='Different reason'
            with self.assertRaisesRegex(ValueError,'immutable'):import_review(self.d,r,temp)

    def test_new_edition_cannot_prepare_without_review_and_completed_review_is_atomic(self):
        d=copy.deepcopy(self.d);d['id']+='-r9';review=self.complete(d)
        with tempfile.TemporaryDirectory() as temp:
            repo=Path(temp)/'repo';shutil.copytree(ROOT/'site/data/watchlist',repo/'site/data/watchlist')
            out=Path(temp)/'candidate'
            with patch('prepare_watchlist_publication.subprocess.check_output',side_effect=[BASE,'']):
                with self.assertRaisesRegex(ValueError,'completed content-bound'):prepare(d,repo,out,BASE)
            self.assertFalse(out.exists())
            with patch('prepare_watchlist_publication.subprocess.check_output',side_effect=[BASE,'']):
                plan=prepare(d,repo,out,BASE,review)
            changed={x['path'] for x in plan['files']}
            for suffix in ['research-index.json',f"reviews/{d['id']}.json",f"archive/{d['id']}.json",f"reports/{d['id']}.html"]:
                self.assertIn('site/data/watchlist/'+suffix,changed)
            self.assertEqual(plan['research_review_path'],'site/data/watchlist/reviews/'+d['id']+'.json')
            for path in (repo/'site/data/watchlist').rglob('*'):
                if path.is_file() and path.name not in ['index.json','report-index.json','research-index.json','latest.json']:
                    self.assertEqual(path.read_bytes(),(out/path.relative_to(repo)).read_bytes())
            self.assertEqual(validate_index(out/'site'),validate_index(repo/'site')+1)

    def test_dirty_source_stale_review_and_wrong_base_reject(self):
        with tempfile.TemporaryDirectory() as temp:
            out=Path(temp)/'candidate'
            with patch('prepare_watchlist_publication.subprocess.check_output',side_effect=[BASE,' M site/data/watchlist/latest.json']):
                with self.assertRaisesRegex(ValueError,'uncommitted'):prepare(self.d,ROOT,out,BASE,self.review)
            self.assertFalse(out.exists())
            d=copy.deepcopy(self.d);d['id']+='-r9'
            with patch('prepare_watchlist_publication.subprocess.check_output',side_effect=[BASE,'']):
                with self.assertRaisesRegex(ValueError,'different edition'):prepare(d,ROOT,out,BASE,self.review)
            self.assertFalse(out.exists())


if __name__=='__main__':unittest.main()
