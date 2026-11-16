"""Verify the public archive and optionally sync the owner's local raw folder."""
import argparse
import datetime as dt
import hashlib
import io
import json
import re
import tempfile
import time
import urllib.request
import zipfile
from pathlib import Path
from refresh_fred_observatory import sync_local

BASE='https://notwins.github.io/market-intelligence-hub/data/fred/'


def get(relative):
    if not re.fullmatch(r'[A-Za-z0-9_./-]+',relative) or '..' in relative.split('/') or relative.startswith('/'):
        raise ValueError('Unsafe archive-relative path')
    with urllib.request.urlopen(BASE+relative,timeout=45) as response:return response.read()


def sync(destination=None,expected=None,require_current_month=False):
    catalog=json.loads(get('catalog.json'));version=catalog.get('archive_version',catalog['snapshot'])
    if catalog['schema_version']!=1 or len(catalog['datasets'])!=74:raise ValueError('Unexpected archive schema or dataset count')
    if expected and version!=expected:raise ValueError('Expected archive has not reached the public site')
    if require_current_month and str(catalog.get('checked_at',''))[:7]!=dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).strftime('%Y-%m'):
        raise ValueError('The cloud archive has not been checked this Singapore calendar month')
    monitor=json.loads(get(catalog['monitor_url']))
    if monitor['snapshot']!=catalog['snapshot'] or len(monitor['fredIds'])!=69:raise ValueError('Monitor/catalogue mismatch')
    raw=get(catalog['archive_url'])
    with tempfile.TemporaryDirectory() as directory:
        work=Path(directory);(work/'raw/External sources').mkdir(parents=True)
        with zipfile.ZipFile(io.BytesIO(raw)) as bundle:
            if len([name for name in bundle.namelist() if name.startswith('csv/')])!=74:raise ValueError('CSV bundle incomplete')
            for row in catalog['datasets']:
                filename=row['filename']
                if Path(filename).name!=filename or not filename.endswith('.csv'):raise ValueError('Invalid dataset filename')
                data=bundle.read('csv/'+filename)
                if hashlib.sha256(data).hexdigest()!=row['sha256']:raise ValueError('Source checksum mismatch: '+row['id'])
                path=work/'raw'/('' if row['provider']=='FRED' else 'External sources')/filename;path.write_bytes(data)
            for name,dest in [('FRED_Download_Inventory.csv','FRED_Download_Inventory.csv'),('External_Download_Inventory.csv','External sources/External_Download_Inventory.csv'),('README.txt','README.txt')]:
                (work/'raw'/dest).write_bytes(bundle.read(name))
            for name in ['refresh-report.json','revisions.json']:(work/name).write_bytes(bundle.read(name))
        report=json.loads((work/'refresh-report.json').read_text(encoding='utf-8'))
        if report['archive_version']!=version:raise ValueError('Bundle/refresh identity mismatch')
        if destination:sync_local(work,destination)
    result=dict(result='passed',archive_version=version,datasets=74,checked_at=catalog.get('checked_at'),refresh=catalog.get('refresh'),local_sync=bool(destination))
    print(json.dumps(result,indent=2));return result


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--destination',type=Path);parser.add_argument('--verify-only',action='store_true');parser.add_argument('--expected-version');parser.add_argument('--expected-version-file',type=Path);parser.add_argument('--require-current-month',action='store_true');args=parser.parse_args()
    if not args.verify_only and not args.destination:parser.error('Choose --verify-only or --destination')
    if args.expected_version_file:
        args.expected_version=json.loads(args.expected_version_file.read_text(encoding='utf-8'))['archive_version']
    for attempt in range(6):
        try:
            sync(args.destination,args.expected_version,args.require_current_month);break
        except ValueError as error:
            if 'Expected archive has not reached' not in str(error) or attempt==5:raise
            time.sleep(5)
