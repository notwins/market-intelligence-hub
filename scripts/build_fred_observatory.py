"""Package a dated raw-data archive and the two FRED monitor views.

Usage: python scripts/build_fred_observatory.py --raw-dir SOURCE --monitor-json PACKED
The source folder is read only. No network refresh or synthetic data is used.
"""
import argparse
import csv
import hashlib
import html
import json
import shutil
import zipfile
from pathlib import Path
from fred_archive_analysis import prepare as prepare_analysis, representative, number

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / 'scripts/fred-observatory'


def read_csv(path):
    with path.open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        return reader.fieldnames, list(reader)


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n', encoding='utf-8')


def json_bytes(value):
    return (json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False)+'\n').encode('utf-8')


def write_bundle(base,catalog,extra=()):
    dated=base/catalog['archive_version']
    with zipfile.ZipFile(dated/'raw-data.zip','w',zipfile.ZIP_DEFLATED) as bundle:
        for row in catalog['datasets']:bundle.write(base/row['csv_url'],'csv/'+row['filename'])
        for name in ['FRED_Download_Inventory.csv','External_Download_Inventory.csv','README.txt','catalog.json',*extra]:bundle.write(dated/name,name)


def build(raw, packed, views=True):
    raw = Path(raw).resolve()
    monitor = json.loads(Path(packed).read_text(encoding='utf-8'))
    snapshot = monitor['snapshot']
    version = monitor.get('archiveVersion', snapshot)
    if not version.startswith(snapshot) or any(c not in '0123456789-T' for c in version):
        raise ValueError('Invalid dated archive version')
    base = ROOT / 'site/data/fred'
    previous=json.loads((base/'catalog.json').read_text(encoding='utf-8')) if (base/'catalog.json').exists() else {}
    previous_entries={e['id']:e for e in previous.get('datasets',[])}
    dated = base / version
    if dated.exists():
        raise ValueError('Snapshot already exists; publish a new dated snapshot rather than replacing cited files')
    (dated / 'csv').mkdir(parents=True)
    inventory = read_csv(raw / 'FRED_Download_Inventory.csv')[1]
    entries = []
    for meta in inventory:
        sid = meta['series_id']
        source = raw / meta['filename']
        checksum = hashlib.sha256(source.read_bytes()).hexdigest()
        if checksum != meta['sha256']:
            raise ValueError('Raw CSV differs from its inventory: ' + sid)
        headers, rows = read_csv(source)
        entry = dict(id=sid, title=meta['title'], name=monitor['series'][sid]['name'], provider='FRED',
                     group=monitor['series'][sid]['group'], unit=meta['units'], frequency=meta['frequency'],
                     adjustment=meta['seasonal_adjustment'], first=meta['first_observation'], last=meta['last_observation'],
                     rows=len(rows), observations=int(meta['nonmissing_observations']), source_url=meta['source_url'],
                     source_updated=(meta.get('source_updated_date','') + ' ' + meta.get('source_updated_time','')).strip() or 'See original source',
                     retrieved_at=meta['retrieved_at'], filename=source.name, sha256=checksum)
        entries.append((entry, source, headers, rows))
    externals = [
        ('NY_Auto', 'NYFed_Auto_Balance_90Plus_Days_Delinquent.csv', 'New York Fed', 'Auto balances 90+ days delinquent', 'Loans', 'Percent', 'Quarterly', 'https://www.newyorkfed.org/microeconomics/hhdc'),
        ('NY_Student_Loan', 'NYFed_Student_Loan_Balance_90Plus_Days_Delinquent.csv', 'New York Fed', 'Student loan balances 90+ days delinquent', 'Loans', 'Percent', 'Quarterly', 'https://www.newyorkfed.org/microeconomics/hhdc'),
        ('NY_HELOC', 'NYFed_HELOC_Balance_90Plus_Days_Delinquent.csv', 'New York Fed', 'HELOC balances 90+ days delinquent', 'Loans', 'Percent', 'Quarterly', 'https://www.newyorkfed.org/microeconomics/hhdc'),
        ('AUCTION', 'Treasury_10Y_Nominal_Note_Auctions.csv', 'US Treasury', '10Y nominal note auctions · full published fields', 'Fiscal', 'Mixed · see columns', 'Auction', 'https://www.treasurydirect.gov/auctions/auction-query/'),
        ('TIC', 'Treasury_TIC_Major_Foreign_Holders.csv', 'US Treasury', 'Major foreign holders of Treasury securities', 'Fiscal', 'USD billions', 'Monthly', 'https://ticdata.treasury.gov/resource-center/data-chart-center/tic/Documents/mfh.txt'),
    ]
    registry_path=TEMPLATE/'extra-datasets.json'
    additional=json.loads(registry_path.read_text(encoding='utf-8')) if registry_path.exists() else []
    externals.extend((r['id'],r['filename'],r['provider'],r['title'],r['group'],r['unit'],r['frequency'],r['source_url']) for r in additional)
    external_meta={r.get('filename'):r for r in read_csv(raw/'External sources/External_Download_Inventory.csv')[1]}
    definitions={r['id']:r for r in additional}
    for sid, filename, provider, title, group, unit, frequency, url in externals:
        source = raw / 'External sources' / filename
        headers, rows = read_csv(source)
        date_key = 'competitiveAuctionCloseDate' if sid == 'AUCTION' else 'record_date' if sid.startswith('TREASURY_MSPD') or sid=='TREASURY_DEBT_PENNY' else 'observation_date'
        dates = sorted(row[date_key][:10] for row in rows)
        entry = dict(id=sid, name=title, title=title, provider=provider, group=group, unit=unit,
                     frequency=frequency, adjustment='As published', first=dates[0], last=dates[-1], rows=len(rows),
                     observations=len(rows), source_url=url, source_updated='See source inventory',
                     retrieved_at=external_meta.get(filename,{}).get('retrieved_at') or snapshot, filename=filename, sha256=hashlib.sha256(source.read_bytes()).hexdigest())
        if sid in definitions:
            entry['notes']=definitions[sid].get('notes','')
            entry['refresh_type']=definitions[sid].get('refresh_type',sid)
        entries.append((entry, source, headers, rows))
    datasets = []; analytics=[]
    for entry, source, headers, rows in entries:
        entry.update(monitor.get('sourceMetadata', {}).get(entry['id'], {}))
        entry['csv_url'] = f'{version}/csv/{source.name}'
        entry['json_url'] = f'{version}/series/{entry["id"]}.json'
        entry['groups_url']=f'{version}/analytics/{entry["id"]}.json'
        entry['citation'] = f'{entry["provider"]}, {entry["title"]} ({entry["id"]}), observations {entry["first"]} to {entry["last"]}, saved {snapshot}. Original source: {entry["source_url"]}'
        prior=previous_entries.get(entry['id'],{})
        if prior.get('sha256')==entry['sha256']:
            entry['csv_url']=prior['csv_url']
        else:shutil.copyfile(source, dated / 'csv' / source.name)
        # Raw strings preserve every CSV field; numeric points are a separate convenience view.
        grouped,summary=prepare_analysis(entry,headers,rows,monitor['series'].get(entry['id']))
        if entry['provider']!='FRED':entry['observations']=sum(any(number(r[m['field']]) is not None for m in grouped['metrics']) for r in rows)
        entry.update({k:summary[k] for k in ['series_count','default_field','default_group']})
        if entry['id'] not in monitor['series'] or (entry['provider']!='FRED' and entry['id'] not in ['NY_Auto','NY_Student_Loan','NY_HELOC','AUCTION']):
            monitor['series'][entry['id']]=representative(entry,grouped)
        page_size=500
        payload = dict(schema_version=1, snapshot=snapshot, metadata=entry, columns=headers, rows=rows)
        if len(rows)>20000:
            pages=[]
            old_payload=json.loads((base/prior['json_url']).read_text(encoding='utf-8')) if prior.get('json_url') else {}
            prior_pages=old_payload.get('row_pages',[])
            for n,start in enumerate(range(0,len(rows),page_size)):
                path=f'{version}/records/{entry["id"]}/{n:04d}.json'
                content=json_bytes(dict(columns=headers,values=[[r[c] for c in headers] for r in rows[start:start+page_size]],page=n))
                if n<len(prior_pages) and (base/prior_pages[n]).read_bytes()==content:path=prior_pages[n]
                else:
                    (base/path).parent.mkdir(parents=True,exist_ok=True);(base/path).write_bytes(content)
                pages.append(path)
            payload.update(rows=rows[:page_size],row_pages=pages,page_size=page_size,total_rows=len(rows))
            entry['record_pages']=len(pages)
        if entry['id'] in monitor['series']:
            payload['series'] = monitor['series'][entry['id']]
        write_json(base / entry['json_url'], payload)
        groups_content=json_bytes(grouped)
        if prior.get('groups_url') and (base/prior['groups_url']).read_bytes()==groups_content:entry['groups_url']=prior['groups_url']
        else:
            (base/entry['groups_url']).parent.mkdir(parents=True,exist_ok=True);(base/entry['groups_url']).write_bytes(groups_content)
        # Metadata must reflect reused immutable paths too.
        write_json(base / entry['json_url'],payload)
        analytics.append(dict(entry,**summary))
        datasets.append(entry)
    for source in [raw / 'FRED_Download_Inventory.csv', raw / 'External sources/External_Download_Inventory.csv', raw / 'README.txt']:
        shutil.copyfile(source, dated / source.name)
    monitor.update(datasetCount=len(datasets),externalCount=len(datasets)-len(inventory))
    write_json(dated / 'monitor.json', monitor)
    catalog = dict(schema_version=1, snapshot=snapshot, archive_version=version, checked_at=monitor.get('checkedAt'), refresh=monitor.get('refreshSummary'), status='Saved snapshot; observation dates vary by series',
                   dataset_count=len(datasets), fred_count=len(inventory), datasets=datasets,
                   monitor_url=f'{version}/monitor.json', archive_url=f'{version}/raw-data.zip',
                   fred_inventory_url=f'{version}/FRED_Download_Inventory.csv',
                   external_inventory_url=f'{version}/External_Download_Inventory.csv', notes_url=f'{version}/README.txt',
                   analytics_url=f'{version}/analytics/index.json',record_count=sum(e['rows'] for e in datasets))
    write_json(dated/'analytics/index.json',dict(schema_version=1,snapshot=snapshot,archive_version=version,
               dataset_count=len(datasets),record_count=catalog['record_count'],datasets=analytics))
    write_json(dated / 'catalog.json', catalog)
    write_json(base / 'catalog.json', catalog)
    write_bundle(base,catalog)
    if views: write_views(snapshot)
    print(f'Packaged {len(datasets)} datasets, {sum(d["rows"] for d in datasets):,} rows; snapshot {version}')
    return catalog


def write_views(snapshot):
    views = ROOT / 'site/fred'
    views.mkdir(exist_ok=True)
    for name, filename in [('desk', 'market-desk.html'), ('observatory', 'risk-observatory.html')]:
        page = (TEMPLATE / (name + '.html')).read_text(encoding='utf-8')
        css = (TEMPLATE / (name + '.css')).read_text(encoding='utf-8') + '\n' + (TEMPLATE / 'shared.css').read_text(encoding='utf-8')
        if name == 'desk':
            css += '\n' + (TEMPLATE / 'desk-compact.css').read_text(encoding='utf-8')
        css += '\n.fred-hub-links{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:7px 22px;background:#e8eeeb;border-bottom:1px solid #d6e0dc;font:12px/1.5 system-ui;color:#284652}.fred-hub-links a{color:inherit}.fred-load-error{padding:30px;max-width:760px;margin:20px auto;background:#fbecdf;color:#6b4029;border:1px solid #ceab88;border-radius:8px}'
        engine = (TEMPLATE / 'engine.js').read_text(encoding='utf-8')
        engine = engine.replace("const DATA=JSON.parse(document.getElementById('dataset').textContent), S=DATA.series;", 'const S=DATA.series;')
        hosted = "(async()=>{try{const catalog=await FredArchive.catalog();if(catalog.schema_version!==1||!catalog.monitor_url||catalog.monitor_url.includes('..'))throw Error('Invalid archive catalogue');const response=await fetch(FredArchive.resolve(catalog.monitor_url));if(!response.ok)throw Error('Data HTTP '+response.status);const DATA=await response.json();if(DATA.snapshot!==catalog.snapshot||DATA.fredIds.length!==catalog.fred_count)throw Error('Unexpected archive snapshot');\n" + engine + "\n}catch(error){const note=document.createElement('p');note.className='fred-load-error';note.setAttribute('role','alert');note.textContent='The FRED snapshot could not load. Reload this page or open the Data archive. '+error.message;document.body.prepend(note);}})();"
        page = page.replace('<!--STYLES-->', '<style>' + css + '</style>').replace('<!--DATA-->', '').replace('<!--ENGINE-->', '<script>' + hosted + '</script>')
        page = page.replace('01-market-desk.html', 'market-desk.html').replace('02-risk-observatory.html', 'risk-observatory.html')
        page = page.replace('Level deviation', 'Metric deviation').replace('Latest level</option>', 'Latest metric</option>')
        page = page.replace('Underlying units retained', 'Source units & labelled transforms').replace('underlying units retained', 'source units & labelled transforms').replace('Native frequencies · Original units', 'Native frequencies · Labelled transforms')
        page = page.replace('LOCAL RESEARCH PREVIEW', 'FRED OBSERVATORY').replace('Local research preview', 'FRED Observatory')
        start = page.index('>', page.index('<body')) + 1
        page = page[:start] + '<nav class="fred-hub-links" aria-label="FRED navigation"><a href="../desk.html">← Market Intel</a><a href="index.html">FRED Observatory</a><a href="market-desk.html">Market Desk</a><a href="risk-observatory.html">Risk Observatory</a><a href="data.html">All datasets &amp; records · σ</a></nav>' + page[start:]
        page = page.replace('</head>', '<script src="data-client.js"></script><script defer src="snapshot.js"></script></head>')
        page = page.replace('16 NOV 2026', '<span data-fred-date>Loading…</span>').replace('16 Nov 2026', '<span data-fred-date>Loading…</span>')
        page = '\n'.join(line if line.strip() else '' for line in page.split('\n'))
        (views / filename).write_text(page, encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--raw-dir', required=True, type=Path)
    parser.add_argument('--monitor-json', required=True, type=Path)
    args = parser.parse_args()
    build(args.raw_dir, args.monitor_json)
