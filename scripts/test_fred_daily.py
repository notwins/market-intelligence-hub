import csv
from datetime import date, datetime, timedelta, timezone
import io
import json
from pathlib import Path
import tempfile
import unittest

import update_fred_daily as feed

NOW = datetime(2026, 11, 16, tzinfo=timezone.utc)


def fixture(codes, missing=None, override=None):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['observation_date', *codes])
    for n in range(45):
        day = date(2026, 9, 28) + timedelta(days=n)
        if day.weekday() > 4:
            continue
        values = {code: 1 + n / 100 for code in codes}
        values.update({'DEXSIUS': 1.28, 'DEXSZUS': .8, 'DEXJPUS': 160,
                       'DEXUSAL': .7, 'DEXMAUS': 4})
        if override:
            values.update(override)
        writer.writerow([day.isoformat(), *['.' if missing == (code, day.isoformat()) else values[code] for code in codes]])
    return output.getvalue()


class DailyFeedTests(unittest.TestCase):
    def raw(self, **kwargs):
        return feed.parse_group(fixture(list(feed.MAPPING.values()), **kwargs), list(feed.MAPPING.values()), NOW.date())

    def test_cross_units_and_exact_same_date_math(self):
        series = {s['id']: s for s in feed.make_series(self.raw(), NOW.date())}
        for pair, value in {'CHF/SGD': 1.6, 'SGD/JPY': 125, 'AUD/SGD': .896, 'SGD/MYR': 3.125}.items():
            self.assertAlmostEqual(series[pair]['points'][-1][1], value)
            self.assertTrue(series[pair]['derived'])
            self.assertEqual(series[pair]['frequency'], 'daily')
        self.assertEqual(series['USD/SGD']['provider_series'], 'DEXSIUS')
        self.assertEqual(series['UST 1M']['provider_series'], 'DGS1MO')
        self.assertEqual(series['UST 6M']['provider_series'], 'DGS6MO')
        self.assertIn('not a bill discount yield', series['UST 6M']['basis'])
        self.assertEqual(len(series), 25)

    def test_missing_cross_leg_is_not_filled_or_multiplied_as_zero(self):
        missing = '2026-10-05'
        series = {s['id']: s for s in feed.make_series(self.raw(missing=('DEXSZUS', missing)), NOW.date())}
        self.assertNotIn(missing, dict(series['CHF/SGD']['points']))
        self.assertIn(missing, series['CHF/SGD']['missing_periods'])
        self.assertIn(missing, dict(series['AUD/SGD']['points']))

    def test_rejects_zero_negative_nan_infinity_wrong_columns_duplicate_and_future(self):
        for bad in (0, -1, float('nan'), float('inf')):
            with self.assertRaises(ValueError):
                self.raw(override={'DEXSIUS': bad})
        text = fixture(['DEXSIUS'])
        for bad in (text.replace('DEXSIUS', 'EXSIUS'), text + text.splitlines()[-1] + '\n'):
            with self.assertRaises(ValueError):
                feed.parse_group(bad, ['DEXSIUS'], NOW.date())
        truncated = feed.parse_group(text, ['DEXSIUS'], date(2026, 10, 1))
        self.assertEqual(max(truncated['DEXSIUS']), '2026-10-01')
        with self.assertRaises(ValueError):
            feed.make_series(self.raw(), date(2027, 1, 1))

    def test_failures_retain_last_good_data_and_archive(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)
            first = feed.refresh(path, fixture, NOW)
            before = (path / 'fred-daily.json').read_bytes()
            latest = (path / 'fred-latest.json').read_bytes()
            archive = (path / first['archive_path']).read_bytes()
            def failed(codes):
                raise OSError('source unavailable')
            with self.assertRaises(OSError):
                feed.refresh(path, failed, NOW)
            self.assertEqual((path / 'fred-daily.json').read_bytes(), before)
            self.assertEqual((path / 'fred-latest.json').read_bytes(), latest)
            self.assertEqual((path / first['archive_path']).read_bytes(), archive)
            status = json.loads((path / 'fred-daily-status.json').read_text())
            self.assertEqual(status['status'], 'failed')
            self.assertEqual(status['last_success'], first['retrieved_at'])

    def test_revision_archive_and_history_regression(self):
        series = feed.make_series(self.raw(), NOW.date())
        revised = json.loads(json.dumps(series))
        revised[0]['points'][0][1] += .1
        changes = feed.changes_since({'series': series}, revised)
        self.assertEqual(len(changes), 1)
        revised[0]['points'].pop(0)
        with self.assertRaises(ValueError):
            feed.changes_since({'series': series}, revised)
        with tempfile.TemporaryDirectory() as folder:
            first = feed.refresh(folder, fixture, NOW)
            archived = (Path(folder) / first['archive_path']).read_bytes()
            second = feed.refresh(folder, fixture, NOW + timedelta(hours=1))
            self.assertEqual(first['id'], second['id'])
            self.assertEqual((Path(folder) / first['archive_path']).read_bytes(), archived)

    def test_dated_csv_export_preserves_unrounded_cross_and_units(self):
        dataset = {'series': feed.make_series(self.raw(), NOW.date()), 'retrieved_at': NOW.isoformat()}
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'history.csv'
            feed.export_rows(dataset, path, ['CHF/SGD'], '2026-10-01', '2026-10-05')
            with path.open(newline='') as stream:
                rows = list(csv.DictReader(stream))
            self.assertEqual(len(rows), 3)
            self.assertEqual(rows[0]['unit'], 'SGD per CHF')
            self.assertAlmostEqual(float(rows[0]['value']), 1.6)
            with self.assertRaises(ValueError):
                feed.export_rows(dataset, path, ['SGS 10Y'])


if __name__ == '__main__':
    unittest.main()
