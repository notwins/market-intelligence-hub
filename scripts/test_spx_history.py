import datetime as dt
import unittest
from update_spx_history import parse_chart,month_before

class IndexHistoryTests(unittest.TestCase):
    def chart(self,symbol='^GSPC'):
        return {'chart':{'result':[{'meta':{'symbol':symbol},'timestamp':[int(dt.datetime(2026,11,d,14,30,tzinfo=dt.timezone.utc).timestamp()) for d in [13,16]],'indicators':{'quote':[{'close':[7000.,7100.]}]}}]}}
    def test_unfinished_session_never_becomes_close(self):
        self.assertEqual(parse_chart(self.chart(),dt.datetime(2026,11,16,15,tzinfo=dt.timezone.utc)),[('2026-11-13',7000.)])
        self.assertEqual(len(parse_chart(self.chart(),dt.datetime(2026,11,16,22,tzinfo=dt.timezone.utc))),2)
    def test_wrong_security_is_rejected(self):
        with self.assertRaises(ValueError):parse_chart(self.chart('SPY'),dt.datetime(2026,11,16,22,tzinfo=dt.timezone.utc))
    def test_month_overlap_clamps_calendar(self):
        self.assertEqual(month_before(dt.date(2024,5,31),3),dt.date(2024,2,29))

if __name__=='__main__':unittest.main()
