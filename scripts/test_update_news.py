import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from update_news import parse_feed, persist

NOW=datetime(2026,10,29,0,0,tzinfo=timezone.utc)
def feed(source='Reuters',domain='https://www.reuters.com',link='https://news.google.com/rss/articles/example',date='Wed, 28 Oct 2026 20:00:00 GMT'):
    return f'<rss><channel><item><title>Microsoft reports earnings - Reuters</title><link>{link}</link><pubDate>{date}</pubDate><source url="{domain}">{source}</source></item></channel></rss>'.encode()

class SafetyTests(unittest.TestCase):
    def test_publisher_and_url_validation(self):
        rows=parse_feed(feed(),NOW,{'MSFT'})
        self.assertEqual(rows[0]['tickers'],['MSFT'])
        for raw in [feed(source='Other'),feed(domain='https://reuters.com.evil.test'),feed(link='javascript:alert(1)'),feed(date='Fri, 30 Oct 2026 20:00:00 GMT'),feed(date='Wed, 01 Oct 2026 20:00:00 GMT')]:
            self.assertEqual(parse_feed(raw,NOW,{'MSFT'}),[])
    def test_same_day_archive_never_replaced(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            rows=parse_feed(feed(),NOW,{'MSFT'})
            persist(rows,NOW,root)
            archive=root/'archive/2026-10-29.json'
            original=archive.read_bytes()
            rows[0]['title']='A revised headline'
            persist(rows,NOW,root)
            self.assertEqual(archive.read_bytes(),original)
            self.assertEqual(len(json.loads((root/'archive-index.json').read_text())['days']),1)
            self.assertEqual(json.loads((root/'news.json').read_text())['items'][0]['title'],'A revised headline')
    def test_empty_feed_cannot_replace_previous_data(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            persist(parse_feed(feed(),NOW,{'MSFT'}),NOW,root)
            original=(root/'news.json').read_bytes()
            with self.assertRaises(ValueError): persist([],NOW,root)
            self.assertEqual((root/'news.json').read_bytes(),original)

if __name__=='__main__': unittest.main()
