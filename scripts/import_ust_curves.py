"""Import official annual Treasury daily par-yield CSVs; never fill missing data."""
import argparse,csv,hashlib,io,json,math
from datetime import date,datetime,timezone
from pathlib import Path
BASE='https://home.treasury.gov/resource-center/data-chart-center/interest-rates/'
SOURCE_URL=BASE+'TextView?type=daily_treasury_yield_curve'
LABELS=['1M','3M','6M','1Y','2Y','3Y','5Y','7Y','10Y','20Y','30Y']
COLUMNS=['1 Mo','3 Mo','6 Mo','1 Yr','2 Yr','3 Yr','5 Yr','7 Yr','10 Yr','20 Yr','30 Yr']
YEARS=[1/12,.25,.5,1,2,3,5,7,10,20,30]
def annual_url(year):
    return BASE+f'daily-treasury-rates.csv/{year}/all?type=daily_treasury_yield_curve&field_tdr_date_value={year}&page&_format=csv'
def parse_csv(raw,year,today):
    reader=csv.DictReader(io.StringIO(raw.decode('utf-8-sig')))
    if not reader.fieldnames or 'Date' not in reader.fieldnames or not all(c in reader.fieldnames for c in ['2 Yr','5 Yr','10 Yr']):
        raise ValueError('Unexpected Treasury CSV columns')
    found={};empty=0
    for row in reader:
        if None in row or any(v is None for v in row.values()):raise ValueError('Invalid row width')
        day=datetime.strptime(row['Date'],'%m/%d/%Y').date()
        if day.year!=year or day>today or day.isoformat() in found:raise ValueError('Wrong year, future, or duplicate date')
        values=[]
        for col in COLUMNS:
            value=row.get(col,'').strip()
            if value in ('','N/A','NA','ND','.'):values.append(None)
            else:
                number=float(value)
                if not math.isfinite(number) or not -5<=number<=30:raise ValueError('Invalid Treasury yield')
                values.append(number)
        found[day.isoformat()]=values
    rows=[]
    for day,values in sorted(found.items()):
        if all(v is None for v in values):empty+=1
        else:rows.append({'date':day,'values':values})
    if not rows:raise ValueError('No observations')
    return rows,empty

def build(rawdir,presets,today):
    observations=[];sources=[];excluded=0
    for path in sorted(Path(rawdir).glob('*.csv')):
        year=int(path.stem);raw=path.read_bytes();rows,empty=parse_csv(raw,year,today);excluded+=empty;observations+=rows
        sources.append({'year':year,'source_url':annual_url(year),'raw_sha256':hashlib.sha256(raw).hexdigest(),'raw_bytes':len(raw),'retrieved_at':datetime.fromtimestamp(path.stat().st_mtime,timezone.utc).isoformat()})
    if not sources:raise ValueError('No source files')
    if len({r['date'] for r in observations})!=len(observations):raise ValueError('Duplicate observation')
    available={r['date'] for r in observations};events=[]
    for p in presets:
        if p['date'] not in available:raise ValueError('Event observation absent')
        events.append({'date':p['date'],'event_date':p.get('eventDate',p['date']),'label':p['label'],'significance':p['significance'],'source_url':p['sourceUrl']})
    return {'schema_version':1,'frequency':'daily','source':'U.S. Department of the Treasury, Daily Treasury Par Yield Curve Rates','source_url':SOURCE_URL,
        'basis':'Daily constant-maturity Treasury par yields, percent per annum. Exact-date provider observations, not monthly averages.',
        'retrieved_at':max(x['retrieved_at'] for x in sources),'raw_sources':sources,
        'missing_value_policy':'Absent maturities and provider blanks remain null; all-null rows are excluded. No interpolation, forward filling, or substitution of dates.',
        'all_null_rows_excluded':excluded,'availability_source_url':SOURCE_URL,
        'availability_note':'1M begins July 2001. 20Y is unavailable before October 1993 in this archive. 30Y is unavailable February 18, 2002 through February 8, 2006. Treasury changed its curve methodology December 6, 2021; earlier published values remain official.',
        'tenors':[{'id':l,'label':l,'years':y,'source_url':SOURCE_URL} for l,y in zip(LABELS,YEARS)],'observations':observations,'events':events}
def write_dataset(result, output):
    """Keep a small preview/manifest and lossless year-sized observation files."""
    output=Path(output);history=output.parent/'ust-curves-history';history.mkdir(parents=True,exist_ok=True)
    encode=lambda value: (json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False)+'\n').encode()
    grouped={}
    for row in result['observations']:
        grouped.setdefault(int(row['date'][:4]),[]).append(row)
    files=[]
    for year,rows in sorted(grouped.items()):
        relative=f'ust-curves-history/{year}.json'
        payload=encode({'schema_version':1,'year':year,'observations':rows})
        (output.parent/relative).write_bytes(payload)
        files.append({'year':year,'path':relative,'count':len(rows),'sha256':hashlib.sha256(payload).hexdigest()})
    selected={event['date'] for event in result['events']}
    selected.add(result['observations'][-1]['date'])
    manifest=dict(result)
    manifest['history_files']=files
    manifest['observation_count']=len(result['observations'])
    manifest['observation_range']={'start':result['observations'][0]['date'],'end':result['observations'][-1]['date']}
    manifest['observations']=[row for row in result['observations'] if row['date'] in selected]
    output.write_bytes(encode(manifest))
    return manifest

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('rawdir');p.add_argument('--presets',required=True);p.add_argument('--output',required=True);a=p.parse_args()
    result=build(a.rawdir,json.loads(Path(a.presets).read_text()),datetime.now(timezone.utc).date())
    write_dataset(result,a.output)
    print(len(result['observations']),result['observations'][0]['date'],result['observations'][-1]['date'])
