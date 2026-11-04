import unittest
from update_news import is_credit_title

class CreditClassificationTests(unittest.TestCase):
    def test_nonfinancial_senses(self):
        for title in ["Norris says Antonelli deserves more credit for 'insane job' this season",'Britain to make lifetime retirement income the default for private pensions','Pension funds change their default options','System uses a default setting']:
            self.assertFalse(is_credit_title(title),title)
    def test_financial_context_retained(self):
        for title in ['Borrower defaults on sovereign debt','New Africa credit rating agency in talks with 15 sovereign borrowers','Apollo launches European credit platform','Default option for pensions shifts into government bonds','Bank deserves more credit for refinancing debt','Credit spreads widen','Sovereign bond sale']:
            self.assertTrue(is_credit_title(title),title)

if __name__=='__main__': unittest.main()
