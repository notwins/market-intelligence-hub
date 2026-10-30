"""Merge verified report JSON into the V2 publication file and retain dated archives.

Usage: python scripts/import_editions.py incoming.json
Incoming keys: reports (required); earnings, issues, research, treasury, tasks (optional).
The operator must verify financial figures and remove personal information first.
"""
import json
import sys
import re
from pathlib import Path
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse

ROOT=Path(__file__).resolve().parents[1]/'site'

def validate(incoming):
    if not isinstance(incoming,dict) or not isinstance(incoming.get('reports'),list): raise ValueError('reports array required')
    for report in incoming['reports']:
        if report.get('channel') not in ('credit','earnings','election'): raise ValueError('Unknown report channel')
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}',report.get('date','')): raise ValueError('ISO report date required')
        observed=datetime.strptime(report['date'],'%Y-%m-%d').date()
        if observed>datetime.now(timezone(timedelta(hours=8))).date():raise ValueError('Future report edition')
        if not all(report.get(k) for k in ('id','title','cutoff','summary','full_text','original_url','status')): raise ValueError('Incomplete report provenance')
        if report['status']!='Source unavailable' and not report.get('sources'): raise ValueError('Verified source links required')
        urls=[report['original_url']]+[s['url'] for s in report.get('sources',[])]
        if any(urlparse(u).scheme!='https' for u in urls): raise ValueError('Only HTTPS source links allowed')
    for issue in incoming.get('issues',[]):
        for key,limit in [('coupon',100),('price',200),('ytm',100),('spread',100000),('amount_m',1000000)]:
            if not isinstance(issue.get(key),(int,float)) or not 0<=issue[key]<=limit: raise ValueError('Invalid issuance '+key)
        if urlparse(issue.get('url','')).scheme!='https':raise ValueError('Primary pricing source required')
    if 'treasury' in incoming:
        t=incoming['treasury']
        if len(t.get('labels',[]))!=len(t.get('values',[])) or not t.get('values'):raise ValueError('Treasury series mismatch')
        if any(not isinstance(v,(int,float)) or not 0<=v<=25 for v in t['values']):raise ValueError('Invalid Treasury yield')
    for company in incoming.get('earnings',[]):
        if not company.get('date') or not company.get('ticker') or urlparse(company.get('evidence','')).scheme!='https':raise ValueError('Company provenance required')
    return incoming

def main():
    incoming=validate(json.loads(Path(sys.argv[1]).read_text(encoding='utf-8')))
    path=ROOT/'v2-data.js'
    text=path.read_text(encoding='utf-8').strip()
    if not text.startswith('window.MI_V2_DATA=') or not text.endswith(';'): raise ValueError('Unexpected publication format')
    data=json.loads(text[len('window.MI_V2_DATA='):-1])
    archives=ROOT/'data/v2';archives.mkdir(parents=True,exist_ok=True)
    previous=archives/('before-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%f')+'.json')
    previous.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    by_id={r['id']:r for r in data['reports']}
    for report in incoming['reports']:
        old=by_id.get(report['id'])
        if old and old!=report: raise ValueError('Existing edition IDs are immutable; use a revision ID')
        by_id[report['id']]=report
    data['reports']=sorted(by_id.values(),key=lambda r:(r['date'],r.get('cutoff','')),reverse=True)
    for key in ('earnings','issues','research','treasury','tasks','credit_stress','bond_takeaways','earnings_chart'):
        if key in incoming: data[key]=incoming[key]
    stamp=datetime.now(timezone(timedelta(hours=8))).isoformat(timespec='seconds')
    data['updated_at']=stamp;data['reports_checked_at']=stamp
    if 'tasks' in incoming:data['tasks_checked_at']=stamp
    path.write_text('window.MI_V2_DATA='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    print('Merged verified editions; previous publication archived. Publish site/v2-data.js and changed archive files.')

if __name__=='__main__':main()
