"""Refresh the latest three months and merge into the full native history.

No network data is accepted without schema, date, number and duplicate checks.
Prior published snapshots are never edited. This command prepares a new snapshot;
publication remains a normal reviewed Git update and the existing Pages workflow.
"""
import argparse
import calendar
import concurrent.futures
import copy
import csv
import datetime as dt
import decimal
import hashlib
import html
import io
import json
import re
import shutil
import time
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SGT = dt.timezone(dt.timedelta(hours=8))


def digest(value):
    return hashlib.sha256(value).hexdigest()


def fetch(url):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url), timeout=40) as response:
                return response.read()
        except Exception:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def months_before(date, count=3):
    month = date.year * 12 + date.month - 1 - count
    year, month = divmod(month, 12)
    return dt.date(year, month + 1, min(date.day, calendar.monthrange(year, month + 1)[1]))


def query_start(entry, date):
    # Observation dates label periods, rather than release dates. Recheck a
    # lagged latest observation even when its period predates the 3M window.
    start = min(months_before(date), dt.date.fromisoformat(entry['last']))
    if entry['frequency'].startswith('Quarterly'):
        start = start.replace(month=((start.month - 1) // 3) * 3 + 1, day=1)
    elif entry['frequency'].startswith('Monthly'):
        start = start.replace(day=1)
    return start.isoformat()


def parse_csv(raw):
    reader = csv.DictReader(io.StringIO(raw.decode('utf-8-sig')))
    if not reader.fieldnames or len(set(reader.fieldnames)) != len(reader.fieldnames):
        raise ValueError('Missing or duplicate CSV header')
    rows = list(reader)
    if any(None in row or any(value is None for value in row.values()) for row in rows):
        raise ValueError('CSV row width differs from header')
    return reader.fieldnames, rows


def csv_bytes(fields, rows):
    stream = io.StringIO(newline='')
    writer = csv.DictWriter(stream, fieldnames=fields, lineterminator='\n')
    writer.writeheader()
    writer.writerows(rows)
    return stream.getvalue().encode('utf-8')


def numeric(value, missing=True):
    if missing and value in ('', '.'):
        return
    if not decimal.Decimal(str(value)).is_finite():
        raise ValueError('Nonfinite source number')


def merge_rows(old, new, keys):
    """Fresh explicit source rows win. Absent rows never erase stored history."""
    def key(row):
        result = tuple(row[name][:10] if name=='competitiveAuctionCloseDate' else row[name] for name in keys)
        if not all(result):
            raise ValueError('Empty observation identity')
        return result
    current = {key(row): row for row in old}
    incoming = {key(row): row for row in new}
    if len(current) != len(old) or len(incoming) != len(new):
        raise ValueError('Duplicate source observation identities')
    changes, added, unchanged = [], 0, 0
    for identity, row in incoming.items():
        if identity not in current:
            added += 1
        elif current[identity] != row:
            changes.append({'key': list(identity), 'previous': current[identity], 'replacement': row})
        else:
            unchanged += 1
        current[identity] = row
    return [current[k] for k in sorted(current)], dict(added=added, revised=len(changes), unchanged=unchanged), changes


class Tables(HTMLParser):
    def __init__(self):
        super().__init__(); self.rows = []; self.row = None; self.cell = None; self.span = 1
    def handle_starttag(self, tag, attrs):
        if tag == 'tr': self.row = []
        if tag in ('td', 'th') and self.row is not None:
            self.cell = []; self.span = int(dict(attrs).get('colspan', '1'))
        if tag == 'br' and self.cell is not None: self.cell.append(' ')
    def handle_data(self, value):
        if self.cell is not None: self.cell.append(value)
    def handle_endtag(self, tag):
        if tag in ('td', 'th') and self.cell is not None:
            self.row.extend([re.sub(r'\s+', ' ', ''.join(self.cell)).strip()] + [''] * (self.span - 1)); self.cell = None
        if tag == 'tr' and self.row is not None:
            self.rows.append(self.row); self.row = None


def fred(entry, today):
    sid, start = entry['id'], query_start(entry, today)
    url = 'https://fred.stlouisfed.org/graph/fredgraph.csv?' + urllib.parse.urlencode(dict(id=sid, cosd=start, coed=today.isoformat()))
    raw = fetch(url); fields, rows = parse_csv(raw)
    if fields != ['observation_date', sid] or not rows:
        raise ValueError('Unexpected or empty FRED export')
    lower = dt.date.fromisoformat(start) - dt.timedelta(days=7 if entry['frequency'].startswith('Weekly') else 0)
    for row in rows:
        date = dt.date.fromisoformat(row['observation_date'])
        if row['observation_date']!=date.isoformat():raise ValueError('Noncanonical FRED observation date')
        if not lower <= date <= today:
            raise ValueError('FRED export outside requested overlap')
        numeric(row[sid])
    result = dict(fields=fields, rows=rows, keys=['observation_date'], source_url=url, query_start=start, response_sha256=digest(raw))
    # Values can refresh even if the optional source-page metadata is unavailable.
    try:
        with urllib.request.urlopen(urllib.request.Request(entry['source_url']), timeout=5) as response:
            page = response.read().decode('utf-8', errors='replace')
        for name in ['date', 'time']:
            match = re.search(r'class="series-meta-updated-' + name + r'"[^>]*>(.*?)</span>', page, re.S)
            if match: result['source_updated_' + name] = html.unescape(re.sub('<[^>]+>', '', match[1])).strip()
    except Exception:
        result['metadata_note'] = 'Source-page update timestamp unavailable; retained prior timestamp'
    return result


def treasury(entry, today, old_fields):
    start = query_start(entry, today)
    url = 'https://www.treasurydirect.gov/TA_WS/securities/search?' + urllib.parse.urlencode(dict(format='json', type='Note', startDate=start, endDate=today.isoformat()))
    raw = fetch(url); data = json.loads(raw)
    if not isinstance(data, list): raise ValueError('Treasury export is not an array')
    rows = []
    for row in data:
        date = row.get('competitiveAuctionCloseDate', '')[:10]
        if (start <= date <= today.isoformat() and row.get('originalSecurityTerm') == '10-Year'
            and row.get('securityTerm') in ('10-Year', '9-Year 11-Month', '9-Year 10-Month')
            and row.get('securityType') == 'Note' and row.get('inflationProtected') == 'No'
            and row.get('floatingRate') == 'No' and row.get('bidToCoverRatio')):
            numeric(row['bidToCoverRatio'], False)
            if not re.fullmatch('[A-Z0-9]{9}', row.get('cusip', '')): raise ValueError('Invalid auction CUSIP')
            rows.append({name: str(row.get(name, '') if row.get(name) is not None else '') for name in old_fields})
    if not rows: raise ValueError('No comparable auctions in overlap')
    return dict(fields=old_fields, rows=rows, keys=['competitiveAuctionCloseDate', 'cusip'], source_url=url, query_start=start, response_sha256=digest(raw))


def tic(entry, today, old_fields):
    url = 'https://ticdata.treasury.gov/resource-center/data-chart-center/tic/Documents/slt_table5.html'
    raw = fetch(url); parser = Tables(); parser.feed(raw.decode('utf-8', errors='replace'))
    start = query_start(entry, today); dates = {}; rows = []
    for row in parser.rows:
        if row and row[0] == 'Country':
            dates = {j: value + '-01' for j, value in enumerate(row) if re.fullmatch(r'20\d{2}-\d{2}', value)}
            continue
        if not row or not row[0] or not dates: continue
        for j, date in dates.items():
            if start <= date <= today.isoformat() and j < len(row):
                value = row[j].replace(',', '')
                if re.fullmatch(r'-?\d+(?:\.\d+)?', value):
                    rows.append(dict(observation_date=date, country_or_aggregate=row[0], holdings_usd_billions=value, source_url=url))
    if not rows or not any(row['country_or_aggregate'] == 'Singapore' for row in rows):
        raise ValueError('TIC table incomplete or contains no overlap')
    return dict(fields=old_fields, rows=rows, keys=['observation_date', 'country_or_aggregate'], source_url=url, query_start=start, response_sha256=digest(raw))


def nyfed(entries, today):
    import openpyxl
    home = 'https://www.newyorkfed.org/microeconomics/hhdc'
    page = fetch(home).decode('utf-8', errors='replace')
    candidates = set(re.findall(r'https://www\.newyorkfed\.org/[^"\s<>]*HHD_C_Report_20\d{2}Q[1-4](?:\.xlsx)?', page))
    quarter_index = today.year * 4 + (today.month - 1) // 3
    for offset in range(4):
        year, quarter = divmod(quarter_index - offset, 4)
        candidates.add(f'https://www.newyorkfed.org/medialibrary/interactives/householdcredit/data/xls/HHD_C_Report_{year}Q{quarter+1}')
    def edition(url):
        match = re.search(r'(20\d{2})Q([1-4])', url)
        return tuple(map(int, match.groups()))
    failures = []
    for url in sorted(candidates, key=edition, reverse=True):
        if edition(url) > (today.year, (today.month - 1) // 3 + 1): continue
        try:
            raw = fetch(url)
            if not raw.startswith(b'PK'): raise ValueError('NY Fed workbook is not XLSX')
            book = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
            rows = list(book['Page 12 Data'].values); book.close()
            if not any('Percent of Balance 90+ Days Delinquent by Loan Type' in str(row[0]) for row in rows[:5]):
                raise ValueError('NY Fed measure definition changed')
            header_index = next(i for i, row in enumerate(rows[:10]) if 'AUTO' in row and 'STUDENT LOAN' in row and 'HELOC' in row)
            out = {}
            for sid, label in [('NY_Auto', 'AUTO'), ('NY_Student_Loan', 'STUDENT LOAN'), ('NY_HELOC', 'HELOC')]:
                index = rows[header_index].index(label); start = query_start(entries[sid], today); values = []
                for row in rows[header_index+1:]:
                    match = re.fullmatch(r'(\d{2}):Q([1-4])', str(row[0]))
                    if not match: continue
                    year, quarter = 2000 + int(match[1]), int(match[2]); date = f'{year:04d}-{quarter*3-2:02d}-01'
                    if start <= date <= today.isoformat():
                        value = '' if row[index] is None else str(row[index]); numeric(value)
                        values.append(dict(observation_date=date, quarter=f'{year}Q{quarter}', value=value))
                if not values: raise ValueError('NY Fed overlap missing')
                out[sid] = dict(fields=['observation_date','quarter','value'], rows=values, keys=['observation_date'], source_url=url, query_start=start, response_sha256=digest(raw))
            return out
        except Exception as error:
            failures.append(f'{url}: {type(error).__name__}')
    raise ValueError('No valid recent NY Fed workbook: ' + '; '.join(failures))


def run(work, now=None, fetcher=None):
    now = now or dt.datetime.now(SGT)
    if now.tzinfo is None:raise ValueError('Refresh time must include a timezone')
    now=now.astimezone(SGT)
    today = now.astimezone(SGT).date(); stamp = now.astimezone(SGT).strftime('%Y-%m-%dT%H%M%S%f')
    work = Path(work).resolve()
    if work.exists(): raise ValueError('Use a new empty refresh work directory')
    work.mkdir(parents=True); raw_dir = work/'raw'; (raw_dir/'External sources').mkdir(parents=True)
    base = ROOT/'site/data/fred'; original_catalog = (base/'catalog.json').read_bytes(); catalog = json.loads(original_catalog)
    entries = {row['id']: row for row in catalog['datasets']}
    old_monitor = json.loads((base/catalog['monitor_url']).read_text(encoding='utf-8'))
    inventories = {}
    for key, destination in [('fred_inventory_url', raw_dir/'FRED_Download_Inventory.csv'), ('external_inventory_url', raw_dir/'External sources/External_Download_Inventory.csv')]:
        data = (base/catalog[key]).read_bytes(); destination.write_bytes(data); inventories[key] = parse_csv(data)
    fred_meta = {row['series_id']:row for row in inventories['fred_inventory_url'][1]}
    old_data = {}
    for sid, entry in entries.items():
        data = (base/entry['csv_url']).read_bytes()
        if digest(data) != entry['sha256']: raise ValueError('Prior archive hash mismatch: '+sid)
        old_data[sid] = parse_csv(data)
        dest = raw_dir/('' if entry['provider']=='FRED' else 'External sources')/entry['filename']; dest.write_bytes(data)
    (raw_dir/'README.txt').write_bytes((base/catalog['notes_url']).read_bytes())
    incoming, failures = {}, {}
    def source(entry):
        if fetcher: return fetcher(entry, today, old_data[entry['id']][0])
        if entry['provider']=='FRED': return fred(entry,today)
        if entry['id']=='AUCTION': return treasury(entry,today,old_data[entry['id']][0])
        if entry['id']=='TIC': return tic(entry,today,old_data[entry['id']][0])
        raise ValueError('Unknown source')
    jobs = [entry for entry in entries.values() if not entry['id'].startswith('NY_')]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        tasks = {pool.submit(source,entry):entry['id'] for entry in jobs}
        for task in concurrent.futures.as_completed(tasks):
            sid = tasks[task]
            try: incoming[sid] = task.result()
            except Exception as error: failures[sid] = f'{type(error).__name__}: {error}'
            if (len(incoming)+len(failures))%10==0: print(f'Checked {len(incoming)+len(failures)}/71 source exports',flush=True)
    try:
        if fetcher:
            for sid in ['NY_Auto','NY_Student_Loan','NY_HELOC']: incoming[sid] = fetcher(entries[sid],today,old_data[sid][0])
        else: incoming.update(nyfed(entries,today))
    except Exception as error:
        for sid in ['NY_Auto','NY_Student_Loan','NY_HELOC']: failures[sid]=f'{type(error).__name__}: {error}'
    report = dict(schema_version=1, archive_version=stamp, checked_at=now.isoformat(), previous_archive=catalog.get('archive_version',catalog['snapshot']),
                  overlap_months=3, overlap_start=months_before(today).isoformat(), datasets=[], added=0, revised=0)
    revisions = []
    monitor = copy.deepcopy(old_monitor); monitor.update(snapshot=today.isoformat(), archiveVersion=stamp, checkedAt=now.isoformat())
    source_meta = {}
    for sid, entry in entries.items():
        fields, old = old_data[sid]; result = incoming.get(sid); merged = old
        info = dict(id=sid,status='failed' if sid in failures else 'checked', previous_sha256=entry['sha256'], error=failures.get(sid))
        if result:
            try:
                if result['fields'] != fields: raise ValueError('Source columns changed')
                merged, counts, changes = merge_rows(old,result['rows'],result['keys'])
                if len(merged) < len(old): raise ValueError('History was truncated')
                report['added'] += counts['added']; report['revised'] += counts['revised']
                if result.get('metadata_note'): info['metadata_note'] = result['metadata_note']
                info.update(counts, query_start=result['query_start'], received_rows=len(result['rows']), source_url=result['source_url'], response_sha256=result['response_sha256'])
                revisions.extend(dict(id=sid,**change) for change in changes)
                dest=raw_dir/('' if entry['provider']=='FRED' else 'External sources')/entry['filename']
                # A no-change data file remains byte-identical to the last snapshot.
                if counts['added'] or counts['revised']: dest.write_bytes(csv_bytes(fields,merged))
                if sid in fred_meta:
                    meta=fred_meta[sid]; valid=[row for row in merged if row[sid] not in ('','.')]
                    meta.update(requested_end=today.isoformat(),retrieved_at=now.isoformat(),status='downloaded',rows=str(len(merged)),nonmissing_observations=str(len(valid)),missing_observations=str(len(merged)-len(valid)),
                                first_observation=valid[0]['observation_date'],last_observation=valid[-1]['observation_date'],latest_value=valid[-1][sid],first_csv_date=merged[0]['observation_date'],last_csv_date=merged[-1]['observation_date'],
                                download_url=result['source_url'],sha256=digest(dest.read_bytes()),transformation='Native source values; overlap merged by observation date; newest explicit source row wins')
                    for name in ['source_updated_date','source_updated_time']:
                        if result.get(name): meta[name]=result[name]
                if sid in monitor['series']:
                    series=monitor['series'][sid]
                    date_key,value_key=('competitiveAuctionCloseDate','bidToCoverRatio') if sid=='AUCTION' else ('observation_date',sid if sid in fred_meta else 'value')
                    series['points']=[[row[date_key][:10],float(row[value_key]) if row[value_key] not in ('','.') else None] for row in merged]
                    series['retrieved']=now.isoformat()
                    if sid in fred_meta: series['updated']=fred_meta[sid]['source_updated_date']+' '+fred_meta[sid]['source_updated_time']
                    else: series['updated']='Latest source observation '+series['points'][-1][0]
                if sid=='TIC':
                    latest=max(row['observation_date'] for row in merged); excluded=('All Other','Grand Total','Of Which','For. Official','Treasury Bills','T-Bonds')
                    monitor['holdingsDate']=latest; monitor['holders']=sorted([{'name':row['country_or_aggregate'],'value':float(row['holdings_usd_billions'])} for row in merged if row['observation_date']==latest and not row['country_or_aggregate'].startswith(excluded)],key=lambda row:-row['value'])
            except Exception as error:
                raise ValueError('Refusing invalid merged candidate '+sid+': '+str(error)) from error
        source_meta[sid] = dict(retrieved_at=now.isoformat() if info['status']=='checked' else entry['retrieved_at'], last_checked_at=now.isoformat(), refresh_status=info['status'])
        if info.get('error'): source_meta[sid]['refresh_error']=info['error']
        if info.get('metadata_note'): source_meta[sid]['metadata_note']=info['metadata_note']
        report['datasets'].append(info)
    report['checked_count']=sum(row['status']=='checked' for row in report['datasets']);report['failed_count']=len(entries)-report['checked_count']
    report['status']='complete' if not report['failed_count'] else 'partial'
    report['matched']=sum(row.get('unchanged',0) for row in report['datasets'])
    monitor['sourceMetadata']=source_meta
    monitor['refreshSummary']={key:report[key] for key in ['status','checked_count','failed_count','added','revised','matched','overlap_months','overlap_start']}
    report['previous_catalog_sha256']=digest(original_catalog)
    if not report['checked_count']: raise ValueError('All sources failed; retain the previous published snapshot')
    for key in ['fred_inventory_url','external_inventory_url']:
        fields,rows=inventories[key]
        if key=='external_inventory_url':
            for row in rows:
                match=next((entry for entry in entries.values() if entry['filename']==row.get('filename')),None)
                if match:
                    records=parse_csv((raw_dir/'External sources'/row['filename']).read_bytes())[1];date_key='competitiveAuctionCloseDate' if match['id']=='AUCTION' else 'observation_date'
                    dates=sorted(r[date_key][:10] for r in records);row.update(first_observation=dates[0],last_observation=dates[-1],rows=str(len(records)))
        dest=raw_dir/('FRED_Download_Inventory.csv' if key=='fred_inventory_url' else 'External sources/External_Download_Inventory.csv');dest.write_bytes(csv_bytes(fields,rows))
    note='\n\nMONTHLY REFRESH '+now.isoformat()+'\nLatest three calendar months fetched; lagged latest source periods included. Native values merged by observation date, TIC date/country, auction date/CUSIP. Fresh explicit rows replace duplicates, including source-missing values. Older observations remain. Prior published snapshots are unchanged. See refresh-report.json for source outcomes and revisions.json for corrected rows.\n'
    baseline=(raw_dir/'README.txt').read_text(encoding='utf-8').split('\nINITIAL DOWNLOAD NOTES\n',1)[-1].split('\n\nMONTHLY REFRESH',1)[0]
    (raw_dir/'README.txt').write_text('FRED OBSERVATORY — CURRENT FULL HISTORY\n'+note+'\nThe following notes describe the original 20-year download, not the current refresh schedule.\nINITIAL DOWNLOAD NOTES\n'+baseline,encoding='utf-8',newline='\n')
    (work/'monitor.json').write_text(json.dumps(monitor,ensure_ascii=False,separators=(',',':'),allow_nan=False),encoding='utf-8')
    for filename,value in [('refresh-report.json',report),('revisions.json',revisions)]: (work/filename).write_text(json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')
    if (base/'catalog.json').read_bytes()!=original_catalog: raise ValueError('Archive changed during refresh; rerun against its new catalogue')
    print(json.dumps({k:v for k,v in report.items() if k!='datasets'},indent=2),flush=True)
    return work, report


def sync_local(work, destination):
    """Copy validated complete history to the owner's raw folder, backing up changes."""
    work,destination=Path(work).resolve(),Path(destination).resolve()
    report=json.loads((work/'refresh-report.json').read_text(encoding='utf-8'));backup=destination/'_download_support/refresh_backups'/report['archive_version']
    for source in (work/'raw').rglob('*'):
        if not source.is_file(): continue
        relative=source.relative_to(work/'raw');target=destination/relative
        if target.exists() and target.read_bytes()==source.read_bytes(): continue
        if target.exists():
            old=backup/relative;old.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(target,old)
        target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
    receipt=destination/'_download_support/refresh_runs'/report['archive_version'];receipt.mkdir(parents=True,exist_ok=True)
    for name in ['refresh-report.json','revisions.json']:shutil.copyfile(work/name,receipt/name)


def package(work):
    from build_fred_observatory import build, write_json
    work=Path(work).resolve();report=json.loads((work/'refresh-report.json').read_text(encoding='utf-8'))
    report['matched']=sum(row.get('unchanged',0) for row in report['datasets'])
    monitor=json.loads((work/'monitor.json').read_text(encoding='utf-8'));monitor['refreshSummary']['matched']=report['matched']
    (work/'monitor.json').write_text(json.dumps(monitor,ensure_ascii=False,separators=(',',':'),allow_nan=False),encoding='utf-8')
    (work/'refresh-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    readme=work/'raw/README.txt';text=readme.read_text(encoding='utf-8')
    if 'INITIAL DOWNLOAD NOTES' not in text:
        original=text.split('\n\nMONTHLY REFRESH',1)[0]
        readme.write_text('FRED OBSERVATORY — CURRENT FULL HISTORY\nMonthly refresh checked '+report['checked_at']+'. Latest three months merged; full history retained. See refresh-report.json and revisions.json.\nOriginal download notes below are historical and do not describe the current schedule.\nINITIAL DOWNLOAD NOTES\n'+original,encoding='utf-8',newline='\n')
    base=ROOT/'site/data/fred'
    if digest((base/'catalog.json').read_bytes())!=report['previous_catalog_sha256']:
        raise ValueError('Published catalogue changed; rerun merge against current history')
    catalog=build(work/'raw',work/'monitor.json',views=False)
    version=catalog['archive_version'];dated=base/version
    for name in ['refresh-report.json','revisions.json']:shutil.copyfile(work/name,dated/name)
    catalog.update(refresh_report_url=version+'/refresh-report.json',revisions_url=version+'/revisions.json',
                   status='Monthly overlap refresh; previous source values retained for any failed checks')
    write_json(dated/'catalog.json',catalog)
    # Rebuild the small bundle so its catalogue and reviewable revisions agree.
    import zipfile
    with zipfile.ZipFile(dated/'raw-data.zip','w',zipfile.ZIP_DEFLATED) as bundle:
        for path in sorted((dated/'csv').glob('*.csv')):bundle.write(path,'csv/'+path.name)
        for name in ['FRED_Download_Inventory.csv','External_Download_Inventory.csv','README.txt','catalog.json','refresh-report.json','revisions.json']:bundle.write(dated/name,name)
    write_json(base/'catalog.json',catalog)
    return catalog


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--work-dir',required=True,type=Path);parser.add_argument('--sync-local',type=Path);parser.add_argument('--package',action='store_true');parser.add_argument('--use-prepared',action='store_true');args=parser.parse_args()
    if args.use_prepared:
        work=args.work_dir.resolve();report=json.loads((work/'refresh-report.json').read_text(encoding='utf-8'))
    else:work,report=run(args.work_dir)
    if args.package:package(work)
    if args.sync_local: sync_local(work,args.sync_local)
