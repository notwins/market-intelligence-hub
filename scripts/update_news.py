"""Fetch Reuters-attributed headline metadata; never infer financial figures."""
import hashlib
import csv
import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

SGT = timezone(timedelta(hours=8))
ROOT = Path(__file__).resolve().parents[1] / 'site/data'
QUERY = 'site:reuters.com (earnings OR markets OR bonds OR stocks) when:7d'
FEED = 'https://news.google.com/rss/search?' + urllib.parse.urlencode({'q': QUERY, 'hl':'en-US','gl':'US','ceid':'US:en'})
QUERIES = [QUERY, 'site:reuters.com (bonds OR credit OR debt OR refinancing OR delinquencies OR defaults OR loans) when:7d', 'site:reuters.com (earnings OR quarterly OR guidance) when:3d', 'site:reuters.com (US election OR midterms OR polls) when:3d']

def read_json(path, default):
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else default

def write_json(path, value):
    path.parent.mkdir(parents=True,exist_ok=True)
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    os.replace(temp,path)

def parse_feed(raw, now, stocks):
    tree = ET.fromstring(raw)
    if tree.tag != 'rss' or tree.find('channel') is None:
        raise ValueError('Response is not an RSS news feed')
    items = {}
    for entry in tree.findall('./channel/item'):
        source = entry.find('source')
        if source is None or (source.text or '').strip().casefold() != 'reuters':
            continue
        publisher = urllib.parse.urlparse(source.get('url',''))
        if publisher.scheme != 'https' or not (publisher.hostname == 'reuters.com' or (publisher.hostname or '').endswith('.reuters.com')):
            continue
        url = (entry.findtext('link') or '').strip()
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme != 'https' or parsed.hostname not in ('news.google.com','www.reuters.com','reuters.com'):
            continue
        title = re.sub(r'\s+-\s+Reuters\s*$','',(entry.findtext('title') or '').strip())
        if not title or len(title)>400 or '<' in title or '>' in title:
            continue
        try:
            published = parsedate_to_datetime(entry.findtext('pubDate') or '')
            if published.tzinfo is None: continue
            if published > now+timedelta(minutes=5) or published < now-timedelta(days=7): continue
        except (ValueError,TypeError,OverflowError):
            continue
        # Exact company names only; never infer ambiguous short ticker strings.
        aliases = {'MSFT':['Microsoft'],'GOOGL':['Alphabet','Google'],'AMZN':['Amazon'],'AAPL':['Apple'],'NVDA':['Nvidia'],'META':['Meta Platforms'],'TSLA':['Tesla'],'INTC':['Intel'],'LLY':['Eli Lilly'],'MA':['Mastercard'],'CAT':['Caterpillar'],'LIN':['Linde'],'XOM':['Exxon','ExxonMobil'],'MRK':['Merck'],'BMY':['Bristol Myers'],'LNG':['Cheniere'],'FDX':['FedEx'],'UPS':['UPS'],'OWL':['Blue Owl'],'ORCL':['Oracle']}
        tickers = [ticker for ticker,names in aliases.items() if ticker in stocks and any(re.search(r'\b'+re.escape(n)+r'\b',title,re.I) for n in names)]
        ident = hashlib.sha256(url.encode()).hexdigest()[:20]
        category = 'Fixed income' if re.search(r'\bbond|yield|credit|debt|refinanc|delinquen|default|\bloan|borrowing|financing',title,re.I) else 'Earnings' if re.search(r'earnings|profit|quarter|revenue|guidance|cash burn|cloud growth',title,re.I) else 'Elections' if re.search(r'election|midterm|\bpoll',title,re.I) else 'Markets'
        items[ident] = {'id':ident,'title':title,'published_at':published.astimezone(timezone.utc).isoformat(),'category':category,'tickers':tickers,'url':url,'link_type':'google_news' if parsed.hostname=='news.google.com' else 'direct','publisher':'Reuters','publisher_url':source.get('url'),'verification':'publisher metadata in Google News RSS; article body not reproduced'}
    return sorted(items.values(),key=lambda x:x['published_at'],reverse=True)[:80]

def parse_treasury_csv(raw, now):
    series = ['DGS2','DGS5','DGS10','DGS30']
    rows = []
    for row in csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))):
        date = row.get('observation_date') or row.get('DATE')
        try:
            observed = datetime.strptime(date,'%Y-%m-%d').replace(tzinfo=timezone.utc)
            values = [float(row[key]) for key in series]
            if observed.date()>now.date() or any(not 0<=value<=25 for value in values): continue
            rows.append({'date':date,'values':values})
        except (ValueError,TypeError,KeyError): continue
    if not rows: raise ValueError('No valid Treasury observations')
    rows.sort(key=lambda row:row['date'])
    rows=rows[-30:]
    return {'status':'ok','as_of':rows[-1]['date'],'labels':['2Y','5Y','10Y','30Y'],'values':rows[-1]['values'],'history':rows,'source':'Federal Reserve H.15, retrieved via FRED','source_url':'https://fred.stlouisfed.org/series/DGS10','checked_at':now.astimezone(SGT).isoformat(timespec='seconds')}

def fetch_bytes(url):
    request=urllib.request.Request(url,headers={'User-Agent':'MarketIntelligenceHub/2.0 (public research metadata)'})
    with urllib.request.urlopen(request,timeout=25) as response:
        if response.status!=200: raise ValueError('Source request failed')
        raw=response.read(2_000_001)
    if len(raw)>2_000_000: raise ValueError('Source exceeds size limit')
    return raw

def refresh_treasury(now):
    try:
        raw=fetch_bytes('https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS2,DGS5,DGS10,DGS30&cosd='+ (now-timedelta(days=60)).date().isoformat())
        write_json(ROOT/'market.json',parse_treasury_csv(raw,now))
    except Exception as error:
        previous=read_json(ROOT/'market.json',{})
        previous.update(status='error',last_attempt=now.astimezone(SGT).isoformat(timespec='seconds'),message='Treasury refresh failed; last verified observations retained.')
        write_json(ROOT/'market.json',previous)
        print(f'Treasury refresh: {type(error).__name__}; previous data retained.',file=sys.stderr)

def persist(items, now, root=ROOT):
    stamp = now.astimezone(SGT).isoformat(timespec='seconds')
    if not items: raise ValueError('No recent Reuters-attributed items passed validation')
    news = {'generated_at':stamp,'status':'ok','discovery_method':'Google News RSS with exact Reuters publisher name and Reuters source domain. Headlines only; no generated earnings, price, yield or forecast figures.','items':items}
    date = now.astimezone(SGT).date().isoformat()
    archive = root / f'archive/{date}.json'
    # The first successful edition for a Singapore date is immutable.
    if not archive.exists(): write_json(archive,news)
    stored = read_json(archive,{})
    index = read_json(root/'archive-index.json',{'days':[]})
    if not any(day['date']==date for day in index['days']):
        index['days'].append({'date':date,'count':len(stored.get('items',[])),'path':f'data/archive/{date}.json','type':'First successful daily headline snapshot'})
    index['days'].sort(key=lambda day:day['date'],reverse=True)
    index['updated_at'] = stamp
    write_json(root/'archive-index.json',index)
    write_json(root/'news.json',news)
    write_json(root/'status.json',{'status':'ok','last_attempt':stamp,'last_success':stamp,'message':f'Feed check succeeded; {len(items)} Reuters-attributed headlines loaded.','run_url':run_url()})

def run_url():
    repo, run = os.environ.get('GITHUB_REPOSITORY'), os.environ.get('GITHUB_RUN_ID')
    return f'https://github.com/{repo}/actions/runs/{run}' if repo and run else None

def main():
    now = datetime.now(timezone.utc)
    refresh_treasury(now)
    try:
        for attempt in range(3):
            try:
                stocks = {x['ticker'] for x in read_json(ROOT/'securities.json',{})['stocks']}
                merged={}
                failures=[]
                successful=0
                with ThreadPoolExecutor(max_workers=4) as pool:
                    futures={pool.submit(fetch_bytes,'https://news.google.com/rss/search?'+urllib.parse.urlencode({'q':query,'hl':'en-US','gl':'US','ceid':'US:en'})):query for query in QUERIES}
                    for future in as_completed(futures):
                        try:
                            parsed=parse_feed(future.result(),now,stocks)
                            if parsed: successful+=1
                            for item in parsed: merged[item['id']]=item
                        except Exception as error: failures.append(type(error).__name__)
                if successful==0: raise ValueError('All Reuters discovery feeds failed validation')
                if failures:
                    for item in read_json(ROOT/'news.json',{}).get('items',[]):
                        try:
                            if now-timedelta(days=7)<=datetime.fromisoformat(item['published_at'])<=now: merged.setdefault(item['id'],item)
                        except (ValueError,KeyError,TypeError): pass
                items=sorted(merged.values(),key=lambda item:item['published_at'],reverse=True)[:240]
                persist(items,now)
                if failures:
                    status=read_json(ROOT/'status.json',{})
                    status.update(status='partial',message=f'{len(items)} headlines available; {len(failures)} discovery feeds failed. Previous recent headlines retained where available.')
                    write_json(ROOT/'status.json',status)
                print(f'Validated {len(items)} Reuters-attributed headlines; stored Singapore-date archive.')
                return 0
            except Exception:
                if attempt==2: raise
                time.sleep(3*(attempt+1))
    except Exception as error:
        previous = read_json(ROOT/'status.json',{})
        stamp = datetime.now(SGT).isoformat(timespec='seconds')
        write_json(ROOT/'status.json',{'status':'error','last_attempt':stamp,'last_success':previous.get('last_success'),'message':'Feed update failed; previous successful headlines and archives retained.','run_url':run_url()})
        print(f'Update failed: {type(error).__name__}: {error}',file=sys.stderr)
        return 1

if __name__=='__main__': sys.exit(main())
