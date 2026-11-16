"""Retain actual S&P 500 index closes; no ETF proxy or incomplete US sessions."""
import argparse, calendar, csv, datetime as dt, hashlib, io, json, math
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

SOURCE='https://finance.yahoo.com/quote/%5EGSPC/history/'
UTC=dt.timezone.utc

def month_before(day, months):
    index=day.year*12+day.month-1-months
    year,month=divmod(index,12);month+=1
    return dt.date(year,month,min(day.day,calendar.monthrange(year,month)[1]))

def parse_chart(data, now):
    result=data['chart']['result'][0]
    if result['meta']['symbol']!='^GSPC':raise ValueError('Wrong index identity')
    timestamps=result.get('timestamp',[]);closes=result['indicators']['quote'][0]['close']
    if len(timestamps)!=len(closes):raise ValueError('Mismatched price arrays')
    result_points={}
    for timestamp,value in zip(timestamps,closes):
        if value is None:continue
        if isinstance(value,bool) or not isinstance(value,(float,int)) or not math.isfinite(value) or value<=0:raise ValueError('Invalid index close')
        date=dt.datetime.fromtimestamp(timestamp,UTC).astimezone(ZoneInfo('America/New_York')).date()
        # Retain only sessions whose regular close has passed. A daily bar's
        # opening timestamp is not its observation/quotation time.
        cutoff=dt.datetime.combine(date,dt.time(16),ZoneInfo('America/New_York'))
        if date.weekday()<5 and cutoff<=now:result_points[date.isoformat()]=float(value)
    if not result_points:raise ValueError('No completed sessions returned')
    return sorted(result_points.items())

def update(root, now=None):
    now=now or dt.datetime.now(UTC);today=now.astimezone(ZoneInfo('America/New_York')).date()
    root=Path(root);root.mkdir(parents=True,exist_ok=True);target=root/'history.json'
    old=json.loads(target.read_text(encoding='utf-8')) if target.exists() else None
    start=month_before(today,3) if old else dt.date(today.year-20,1,1)
    query=urlencode({'period1':int(dt.datetime.combine(start,dt.time(),UTC).timestamp()),'period2':int(now.timestamp()),'interval':'1d','events':'history'})
    url='https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?'+query
    with urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=60) as response:raw=response.read()
    incoming=parse_chart(json.loads(raw),now)
    values=dict(old['points']) if old else {};values.update(incoming);points=sorted(values.items())
    result={'schema_version':1,'id':'SPX','symbol':'^GSPC','name':'S&P 500 price index','currency':'USD','unit':'Index points','frequency':'Daily, completed regular session','basis':'Price index close; excludes reinvested dividends, fees and investor FX','source':'Yahoo Finance / S&P index quote','source_url':SOURCE,'retrieved_at':now.isoformat(),'first_date':points[0][0],'last_date':points[-1][0],'overlap_start':start.isoformat(),'points':points,'raw_sha256':hashlib.sha256(raw).hexdigest()}
    stamp=now.strftime('%Y%m%dT%H%M%S%fZ');archive=root/'archive'/stamp;archive.mkdir(parents=True,exist_ok=False)
    (archive/'source.json').write_bytes(raw)
    text=json.dumps(result,ensure_ascii=False,allow_nan=False,separators=(',',':'))+'\n'
    (archive/'history.json').write_text(text,encoding='utf-8')
    (root/'history.json').write_text(text,encoding='utf-8')
    with (root/'history.csv').open('w',encoding='utf-8',newline='') as stream:
        writer=csv.writer(stream);writer.writerow(['observation_date','SPX_close']);writer.writerows(points)
    print(json.dumps({'rows':len(points),'first':points[0][0],'last':points[-1][0],'incoming':len(incoming),'archive':str(archive)}))
    return result

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--root',default='site/data/spx');args=parser.parse_args();update(args.root)
