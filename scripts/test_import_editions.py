import unittest
from import_editions import validate

class ImportValidation(unittest.TestCase):
    def sample(self):
        return {'reports':[{'id':'credit-2026-10-30','channel':'credit','date':'2026-10-30','title':'Credit report','cutoff':'08:00 SGT','summary':'Market research','full_text':'Verified research text','original_url':'https://chatgpt.com/c/example','status':'Imported edition','sources':[{'title':'Original source','url':'https://www.bis.org/'}]}]}
    def test_missing_sources_and_unsafe_links_rejected(self):
        x=self.sample();x['reports'][0]['sources']=[]
        with self.assertRaises(ValueError):validate(x)
        x=self.sample();x['reports'][0]['sources'][0]['url']='javascript:alert(1)'
        with self.assertRaises(ValueError):validate(x)
    def test_bad_yields_rejected(self):
        x=self.sample();x['treasury']={'labels':['10Y'],'values':[999]}
        with self.assertRaises(ValueError):validate(x)
    def test_import_keeps_valid_provenance(self):
        x=self.sample();self.assertEqual(validate(x),x)

if __name__=='__main__':unittest.main()
