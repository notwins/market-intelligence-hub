import unittest
from datetime import datetime, timezone
from update_news import parse_treasury_csv, parse_feed

class MarketV2Tests(unittest.TestCase):
    def test_csv_excludes_future_missing_and_impossible_yields(self):
        raw=b'observation_date,DGS2,DGS5,DGS10,DGS30\n2026-10-28,4.67,4.85,5.05,5.37\n2026-10-29,,4.78,4.98,5.32\n2026-10-30,4,4,4,4\n2026-10-27,4,4,99,4\n'
        result=parse_treasury_csv(raw,datetime(2026,10,29,tzinfo=timezone.utc))
        self.assertEqual(result['as_of'],'2026-10-28')
        self.assertEqual(result['values'],[4.67,4.85,5.05,5.37])
        self.assertEqual(len(result['history']),1)
    def test_empty_csv_fails_without_a_fake_observation(self):
        with self.assertRaises(ValueError): parse_treasury_csv(b'observation_date,DGS2,DGS5,DGS10,DGS30\n',datetime.now(timezone.utc))
    def test_bond_earnings_story_remains_credit_coverage(self):
        raw=b'<rss><channel><item><title>Microsoft debt financing follows quarterly results - Reuters</title><link>https://news.google.com/rss/articles/example</link><pubDate>Thu, 29 Oct 2026 20:00:00 GMT</pubDate><source url="https://www.reuters.com">Reuters</source></item></channel></rss>'
        rows=parse_feed(raw,datetime(2026,10,30,tzinfo=timezone.utc),{'MSFT'})
        self.assertEqual(rows[0]['category'],'Fixed income')

if __name__=='__main__': unittest.main()
