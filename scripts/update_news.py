"""Fetch Reuters-attributed headline metadata; never infer financial figures."""
import hashlib
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

SGT = timezone(timedelta(hours=8))
ROOT = Path(__file__).resolve().parents[1] / 'site/data'
QUERY = 'site:reuters.com (earnings OR markets OR bonds OR stocks) when:7d'
FEED = 'https://news.google.com/rss/search?' + urllib.parse.urlencode({'q': QUERY, 'hl':'en-US','gl':'US','ceid':'US:en'})

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
        aliases = {'MSFT':['Microsoft'],'GOOGL':['Alphabet','Google'],'AMZN':['Amazon'],'AAPL':['Apple'],'NVDA':['Nvidia'],'META':['Meta Platforms'],'TSLA':['Tesla']}
        tickers = [ticker for ticker,names in aliases.items() if ticker in stocks and any(re.search(r'\b'+re.escape(n)+r'\b',title,re.I) for n in names)]
        ident = hashlib.sha256(url.encode()).hexdigest()[:20]
        category = 'Earnings' if re.search(r'earnings|profit|quarter|revenue',title,re.I) else 'Fixed income' if re.search(r'\bbond|yield|credit|debt',title,re.I) else 'Markets'
        items[ident] = {'id':ident,'title':title,'published_at':published.astimezone(timezone.utc).isoformat(),'category':category,'tickers':tickers,'url':url,'link_type':'google_news' if parsed.hostname=='news.google.com' else 'direct','publisher':'Reuters','publisher_url':source.get('url'),'verification':'publisher metadata in Google News RSS; article body not reproduced'}
    return sorted(items.values(),key=lambda x:x['published_at'],reverse=True)[:80]

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
    try:
        for attempt in range(3):
            try:
                request = urllib.request.Request(FEED,headers={'User-Agent':'MarketIntelligenceHub/1.0 (headline metadata reader)'})
                with urllib.request.urlopen(request,timeout=25) as response:
                    if response.status != 200: raise ValueError('Feed request failed')
                    raw = response.read(2_000_001)
                if len(raw)>2_000_000: raise ValueError('Feed exceeds size limit')
                stocks = {x['ticker'] for x in read_json(ROOT/'securities.json',{})['stocks']}
                items = parse_feed(raw,now,stocks)
                persist(items,now)
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
