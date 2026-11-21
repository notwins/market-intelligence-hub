import csv
from datetime import date
from pathlib import Path
import unittest

from update_fred_weekly import DATA, FX_PAIRS, observations, columns
from update_fed_history import read_json


class WeeklyFREDTests(unittest.TestCase):
    def test_fallback_day_is_shared_and_crosses_use_the_same_day(self):
        raw = {code: {} for code in FX_PAIRS.values()}
        raw['DEXSIUS'] = {'2026-11-12': 1.29, '2026-11-13': None, '2026-11-16': 1.3}
        raw['DEXSZUS'] = {'2026-11-12': 0.83, '2026-11-13': 0.85}
        raw['DEXJPUS'] = {'2026-11-13': 150}
        [row] = observations('fx', raw, date(2026, 11, 9), date(2026, 11, 13))
        values = dict(zip((c['id'] for c in columns('fx')), row['values']))
        self.assertEqual((row['week_ending'], row['date']), ('2026-11-13', '2026-11-12'))
        self.assertEqual(values['CHF/SGD'], 1.29 / 0.83)
        self.assertIsNone(values['SGD/JPY'])

    def test_public_csv_matches_source_date_and_values(self):
        for family, count in [('yields', 16), ('fx', 27)]:
            path = Path(DATA) / f'fred-weekly-{family}.json'
            data = read_json(path)
            iso_dates = {row['week_ending']: row for row in data['observations']}
            with path.with_suffix('.csv').open(encoding='utf-8', newline='') as handle:
                header, *rows = csv.reader(handle)
            self.assertEqual(len(header), count + 2)
            self.assertGreaterEqual(len(rows), 1500)
            self.assertLessEqual(len(rows), 1567)
            for week, day, *values in rows:
                self.assertEqual(date.fromisoformat(week).weekday(), 4)
                self.assertEqual(iso_dates[week]['date'], day)
                self.assertEqual(iso_dates[week]['values'], [float(v) if v else None for v in values])


if __name__ == '__main__':
    unittest.main()
