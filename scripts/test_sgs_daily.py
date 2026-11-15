import copy
import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from update_sgs_daily import LABELS, HEADERS, parse, merge, update

ROOT = Path(__file__).resolve().parents[1]
ORIGINAL = json.loads((ROOT/'scripts/fixtures/sgs-daily-original.json').read_text())


def fixture():
    issues = ORIGINAL['tenors']
    headers = '<tr><td></td>' + ''.join('<td class="tenor">'+x+'</td>' for x in HEADERS) + '</tr>'
    headers += '<tr><th class="labels">Issue Code</th>'
    for i, t in enumerate(issues):
        maturity = datetime.fromisoformat(t['maturity']).strftime('%d %b %Y')
        headers += '<th class="issue-code" colspan="'+str(1 if i<2 else 2)+'"><b>'+t['issue_code']+'</b><br/>'+(str(t['coupon_percent'])+'%' if i>=2 else '')+'<br/>'+maturity+'</th>'
    headers += '</tr><tr>'+''.join('<td class="'+c.lower()+'">'+c+'</td>' for c in ['Yield','Yield']+['Price','Yield']*7)+'</tr>'
    cells = '<td class="yield">1.87</td>'*2 + ''.join('<td class="price">'+str(99+i)+'</td><td class="yield">'+str(2+i/10)+'</td>' for i in range(7))
    return '<table id="ContentPlaceHolder1_ClosingLevelsTable">'+headers+'<tr><td class="date">13 Nov 2026</td>'+cells+'</tr></table><table id="HighLow"><tr><td>999</td></tr></table>'


class SGSDailyTests(unittest.TestCase):
    def test_exact_closing_columns_and_source_identities(self):
        tenors, rows = parse(fixture(), '2026-11-16')
        self.assertEqual([t['label'] for t in tenors], LABELS)
        self.assertEqual(rows[0]['values'], [1.87,1.87,2,2.1,2.2,2.3,2.4,2.5,2.6])
        self.assertEqual(rows[0]['prices'], [None,None,99,100,101,102,103,104,105])
        self.assertEqual(tenors[4]['issue_code'], 'NZ16100X')
        self.assertEqual(tenors[4]['coupon_percent'], 2.25)
        self.assertEqual(tenors[4]['maturity'], '2036-08-01')

    def test_missing_yield_is_null_and_not_high_low(self):
        _, rows = parse(fixture().replace('>1.87<','>-<',1), '2026-11-16')
        self.assertIsNone(rows[0]['values'][0])
        self.assertNotIn(999,rows[0]['values'])

    def test_changed_layout_bad_number_duplicate_and_future_fail(self):
        for html in [fixture().replace('ClosingLevelsTable','WrongTable'), fixture().replace('6-Mth','3-Mth'), fixture().replace('>Price<','>Yield<',1), fixture().replace('>1.87<','>nan<'), fixture()+fixture(), fixture().replace('13 Nov 2026','17 Nov 2026')]:
            with self.assertRaises(ValueError): parse(html, '2026-11-16')

    def test_append_idempotence_and_original_prices_preserved(self):
        tenors, rows = parse(fixture(), '2026-11-16')
        old = copy.deepcopy(ORIGINAL)
        candidate = merge(old,tenors,rows,'2026-11-16T11:00:00Z')
        self.assertEqual(len(candidate['observations']),7)
        self.assertEqual(candidate['observations'][:5],old['observations'][:5])
        self.assertEqual(candidate['observations'][5]['prices'][4],100.62)
        self.assertNotIn('issues',candidate['observations'][0])
        repeat = merge(candidate,tenors,rows,'2026-11-17T11:00:00Z')
        self.assertEqual(repeat['observations'], candidate['observations'])
        self.assertEqual(ORIGINAL,old)

    def test_conflicting_price_or_yield_is_reviewed_before_any_write(self):
        tenors, rows = parse(fixture(), '2026-11-16')
        saved=merge(ORIGINAL,tenors,rows,'2026-11-16T11:00:00Z')
        for key in ('values','prices'):
            conflict=copy.deepcopy(rows);conflict[0][key][4]+=1
            with self.assertRaises(ValueError):merge(saved,tenors,conflict,'2026-11-17T11:00:00Z')
        self.assertEqual(saved['observations'][-1]['prices'][4],101)

    def test_rotating_header_never_relabels_prior_saved_prices(self):
        tenors, rows = parse(fixture(), '2026-11-16')
        saved=merge(ORIGINAL,tenors,rows,'2026-11-16T11:00:00Z')
        rotated=copy.deepcopy(rows);rotated[0]['issues'][4]['issue_code']='NEWISSUE'
        result=merge(saved,tenors,rotated,'2026-11-17T11:00:00Z')
        self.assertEqual(result['observations'][-1]['issues'][4]['issue_code'],'NZ16100X')

    def test_failed_refresh_leaves_snapshot_bytes_and_reports_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            data=Path(tmp)/'site/data';data.mkdir(parents=True)
            path=data/'sgs-daily-snapshot.json';path.write_text(json.dumps(ORIGINAL))
            before=path.read_bytes()
            with self.assertRaises(ValueError):update(tmp,html='<html>Unavailable</html>',now=datetime(2026,11,16,tzinfo=timezone.utc))
            self.assertEqual(path.read_bytes(),before)
            self.assertEqual(json.loads((data/'sgs-daily-status.json').read_text())['status'],'error')

    def test_repeat_weekend_refresh_never_rewrites_data_or_duplicates_dates(self):
        with tempfile.TemporaryDirectory() as tmp:
            data=Path(tmp)/'site/data';data.mkdir(parents=True)
            path=data/'sgs-daily-snapshot.json';path.write_text(json.dumps(ORIGINAL))
            now=datetime(2026,11,16,tzinfo=timezone.utc)
            self.assertTrue(update(tmp,html=fixture(),now=now)['data_changed'])
            before=path.read_bytes()
            status=update(tmp,html=fixture(),now=now)
            self.assertFalse(status['data_changed'])
            self.assertEqual(path.read_bytes(),before)
            self.assertEqual(status['observation_count'],7)


if __name__=='__main__':unittest.main()
