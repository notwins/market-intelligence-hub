import copy
import csv
from datetime import date, datetime, timezone
import io
import json
from pathlib import Path
import tempfile
import unittest

import update_fed_history as fed


NOW = datetime(2026, 11, 3, 8, tzinfo=timezone.utc)


def fixture():
    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerow(['observation_date', *fed.MAPPING.values()])
    for day in fed.months('2025-01-01', '2026-11-01'):
        writer.writerow([day, *[1 + i / 10 for i in range(len(fed.MAPPING))]])
    return stream.getvalue()


class FedHistoryTests(unittest.TestCase):
    def test_direction_units_cross_and_completed_months(self):
        series = {s['id']: s for s in fed.parse_csv(fixture(), NOW.date())}
        self.assertEqual(len(series), 22)
        self.assertEqual(series['AUD/USD']['unit'], 'USD per AUD')
        self.assertEqual(series['USD/SGD']['unit'], 'SGD per USD')
        self.assertEqual(series['UST 10Y']['provider_series'], 'GS10')
        self.assertEqual(series['UST 1M']['provider_series'], 'GS1M')
        for s in series.values():
            self.assertEqual(s['points'][-1][0], '2026-10-01')
        self.assertAlmostEqual(series['CHF/SGD']['points'][-1][1], 1.8 / 1.9)
        self.assertIn('Ratio of monthly averages', series['CHF/SGD']['aggregation'])

    def test_missing_is_never_zero_and_cross_requires_both_components(self):
        text = fixture().replace('2026-09-01,1.0,', '2026-09-01,.,')
        series = {s['id']: s for s in fed.parse_csv(text, NOW.date())}
        self.assertIn('2026-09-01', series['AUD/USD']['missing_periods'])
        self.assertNotIn('2026-09-01', dict(series['AUD/USD']['points']))
        text = fixture().replace(',1.8,1.9,', ',.,1.9,')
        with self.assertRaisesRegex(ValueError, 'Insufficient'):
            fed.parse_csv(text, NOW.date())

    def test_bad_headers_duplicate_dates_invalid_values_and_staleness_fail(self):
        for text in [fixture().replace('GS10', 'WRONG'),
                     fixture() + fixture().splitlines()[1] + '\n',
                     fixture().replace('2026-09-01,1.0,', '2026-09-01,nan,'),
                     fixture().replace('2026-09-01,1.0,', '2026-09-01,0,'),
                     fixture().replace('2026-09-01', '2026-09-02')]:
            with self.assertRaises(ValueError):
                fed.parse_csv(text, NOW.date())
        with self.assertRaisesRegex(ValueError, 'too old'):
            fed.parse_csv(fixture(), date(2027, 6, 1))

    def test_success_failure_revision_and_original_workbook_retention(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as directory:
            root = Path(directory)
            original = root / 'history-v3.json'
            original_bytes = fed.encode({'schemaVersion': 1, 'series': fed.parse_csv(fixture(), NOW.date())})
            original.write_bytes(original_bytes)
            first = fed.refresh(root, lambda: fixture(), NOW)
            before = (root / 'history-fed.json').read_bytes()
            archive = (root / first['archive_path']).read_bytes()
            with self.assertRaises(ValueError):
                fed.refresh(root, lambda: '<html>Provider error</html>', NOW)
            self.assertEqual((root / 'history-fed.json').read_bytes(), before)
            self.assertEqual(json.loads((root / 'history-fed-status.json').read_bytes())['status'], 'failed')
            revised = fixture().replace('2026-09-01,1.0,', '2026-09-01,1.05,')
            second = fed.refresh(root, lambda: revised, NOW)
            self.assertEqual(second['revisions_this_refresh'], [{'series': 'AUD/USD', 'observation_period': '2026-09-01', 'old': 1.0, 'new': 1.05}])
            self.assertNotEqual(first['id'], second['id'])
            self.assertEqual((root / first['archive_path']).read_bytes(), archive)
            self.assertEqual(original.read_bytes(), original_bytes)
            self.assertEqual(json.loads((root / 'history-fed-status.json').read_bytes())['status'], 'success')

    def test_regressing_provider_response_cannot_delete_history(self):
        first = {'series': fed.parse_csv(fixture(), NOW.date())}
        shortened = copy.deepcopy(first['series'])
        shortened[0]['points'].pop(0)
        with self.assertRaisesRegex(ValueError, 'regressed'):
            fed.revisions(first, shortened)
        shortened = copy.deepcopy(first['series'])
        shortened[0]['points'].pop()
        with self.assertRaisesRegex(ValueError, 'regressed'):
            fed.revisions(first, shortened)

    def test_recession_month_boundaries_and_missing_indicator(self):
        text = 'observation_date,USREC\n2026-07-01,0\n2026-08-01,1\n2026-09-01,1\n2026-10-01,0\n'
        context = fed.parse_recessions(text, NOW.date())
        self.assertEqual(context['periods'], [{'start': '2026-08-01', 'end_exclusive': '2026-10-01'}])
        with self.assertRaisesRegex(ValueError, 'Missing recession'):
            fed.parse_recessions(text.replace('2026-09-01,1\n', ''), NOW.date())
if __name__ == '__main__':
    unittest.main()
