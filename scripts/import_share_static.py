"""Read cached Excel company facts. Never recalculate, execute links or alter the workbook."""
import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import re
import xml.etree.ElementTree as ET
import zipfile

MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
RICH = 'http://schemas.microsoft.com/office/spreadsheetml/2017/richdata'
# An exchange-qualified BOS code must agree with Excel's resolved listing.
MARKETS = {
 'US': (['XNYS','XNAS','BATS','OTCM'], ['USD'], ''),
 'HK': (['XHKG'], ['HKD'], '.HK'), 'AU': (['XASX'], ['AUD'], '.AX'),
 'IJ': (['XIDX'], ['IDR'], '.JK'), 'LN': (['XLON'], ['GBP','GBp','GBX','USD','EUR'], '.L'),
 'SW': (['XSWX'], ['CHF','USD','EUR'], '.SW'), 'FP': (['XPAR'], ['EUR'], '.PA'),
 'FH': (['XHEL'], ['EUR'], '.HE'), 'SS': (['XSTO'], ['SEK'], '.ST'),
 'NO': (['XOSL'], ['NOK'], '.OL'), 'GY': (['XETR','XFRA'], ['EUR'], '.DE'),
 'NA': (['XAMS'], ['EUR'], '.AS'), 'SP': (['XSES'], ['SGD','USD'], '.SI'),
 'JP': (['XTKS'], ['JPY'], '.T'), 'CN': (['XTSE','XTSX'], ['CAD'], '.TO'),
}
EXCHANGES = {'New York Stock Exchange':'XNYS','Nasdaq Stock Market':'XNAS',
 'CBOE BZX Exchange':'BATS','OTC Markets':'OTCM','Hong Kong Stock Exchange':'XHKG',
 'Australian Securities Exchange':'XASX','Indonesia Stock Exchange':'XIDX',
 'London Stock Exchange':'XLON','SIX Swiss Exchange':'XSWX','Euronext Paris':'XPAR',
 'NASDAQ Helsinki':'XHEL','NASDAQ Stockholm':'XSTO','Oslo Bors Asa':'XOSL'}
HEADERS = ['TICKER BOS','Companies.','Price','Currency','Description','Employees','Exchange',
 'Headquarters','Price2','[Shares outstanding]','[Ticker symbol]','[Year incorporated]','Market Cap']

def clean(value):
    value = str(value or '').strip()
    return None if not value or value.startswith('#') else value

def number(value, integer=False):
    try:
        n = float(value)
        if not math.isfinite(n) or n < 0 or integer and not n.is_integer(): return None
        return int(n) if integer else n
    except (TypeError, ValueError): return None

def code(value, market):
    v = str(value or '').strip().upper().replace('/', '.')
    return str(int(v)) if market=='HK' and v.isdigit() else v

def extract(path):
    with zipfile.ZipFile(path) as z:
        if sum(x.file_size for x in z.infolist()) > 80000000: raise ValueError('Workbook too large')
        ns = {'m': MAIN}
        strings = [''.join(x.itertext()) for x in ET.fromstring(z.read('xl/sharedStrings.xml'))]
        workbook = ET.fromstring(z.read('xl/workbook.xml'))
        sheets = workbook.findall('m:sheets/m:sheet', ns)
        if len(sheets)!=1: raise ValueError('Expected one source worksheet')
        sheet = sheets[0].get('name')
        relationships = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        rid = sheets[0].get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
        target = next(x.get('Target') for x in relationships if x.get('Id')==rid)
        target = target.lstrip('/') if target.startswith('/') else 'xl/'+target
        root = ET.fromstring(z.read(target))
        structures = list(ET.fromstring(z.read('xl/richData/rdrichvaluestructure.xml')))
        values = list(ET.fromstring(z.read('xl/richData/rdrichvalue.xml')))
        meta = ET.fromstring(z.read('xl/metadata.xml'))
        future = list(meta.find(f'{{{MAIN}}}futureMetadata[@name="XLRICHVALUE"]'))
        value_meta = list(meta.find(f'{{{MAIN}}}valueMetadata'))
        types = list(meta.find(f'{{{MAIN}}}metadataTypes'))
        def rich(index):
            value = values[index]
            return dict(zip([k.get('n') for k in structures[int(value.get('s'))]], [v.text for v in value]))
        rows = []
        for row in root.findall('m:sheetData/m:row', ns):
            result = {'row': int(row.get('r'))}
            for cell in row:
                col = re.sub(r'\d', '', cell.get('r'))
                v = cell.find('m:v', ns)
                v = v.text if v is not None else None
                if cell.get('t')=='s' and v is not None: v = strings[int(v)]
                if cell.get('t')=='inlineStr': v = ''.join(cell.find('m:is', ns).itertext())
                result[col] = v
                if col=='B' and cell.get('vm'):
                    records = value_meta[int(cell.get('vm'))-1]
                    rc = next(x for x in records if types[int(x.get('t'))-1].get('name')=='XLRICHVALUE')
                    idx = int(future[int(rc.get('v'))].find(f'.//{{{RICH}}}rvb').get('i'))
                    value = rich(idx)
                    if '%cvi' in value: value = rich(int(value['%cvi']))
                    result['rich'] = value
            rows.append(result)
        if [rows[0].get(c) for c in 'ABCDEFGHIJKLM'] != HEADERS: raise ValueError('Unexpected source columns')
        return sheet, rows[1:]

def convert(row):
    bos = clean(row.get('A'))
    if not bos: return None, 'blank_row'
    if not re.fullmatch(r'[-A-Z0-9./ ]+ [A-Z]{2}', bos): return None, 'invalid_bos_ticker'
    symbol, market = bos.rsplit(' ',1)
    ticker, exchange, currency = (clean(row.get(k)) for k in ['K','G','D'])
    if not all([ticker, exchange, currency]): return None, 'missing_or_error_listing'
    rich = row.get('rich', {})
    mic = clean(rich.get('ExchangeID')) or EXCHANGES.get(exchange)
    if market not in MARKETS: return None, 'unsupported_market'
    mics, currencies, suffix = MARKETS[market]
    if mic not in mics or currency not in currencies: return None, 'exchange_or_currency_mismatch'
    if code(symbol,market)!=code(ticker,market): return None, 'ticker_mismatch'
    if rich and (code(rich.get('Ticker symbol'),market)!=code(ticker,market) or rich.get('Currency')!=currency): return None, 'linked_entity_mismatch'
    if EXCHANGES.get(exchange) and EXCHANGES[exchange]!=mic: return None, 'exchange_mismatch'
    canonical = code(ticker,market)
    if mic=='XTSX': suffix = '.V'
    if mic=='XFRA': suffix = '.F'
    yahoo = (canonical.zfill(4) if market=='HK' else canonical)+suffix
    aliases = {bos, yahoo, mic+':'+ticker.upper()}
    if market=='US':
        aliases.update([ticker.upper(),canonical+' US'])
        if mic=='XNAS': aliases.add(canonical+' UQ')
        if mic=='XNYS': aliases.add(canonical+' UN')
    if market=='HK': aliases.update([canonical+' HK',canonical.zfill(4)+' HK',canonical+'.HK'])
    name = clean(rich.get('Name')) or clean(row.get('B'))
    year = number(row.get('L'),True)
    if year is not None and not 1000 <= year <= 2026: year = None
    record = {'id':bos,'bbTicker':bos,'ticker':ticker,'market':market,'exchangeMic':mic,'exchange':exchange,
      'currency':currency,'publicTicker':yahoo,'aliases':sorted(aliases),'name':name,'description':clean(row.get('E')),
      'industry':clean(rich.get('Industry')),'instrumentType':clean(rich.get('Instrument type')) or 'Stock',
      'employees':number(row.get('F'),True),'headquarters':clean(row.get('H')),
      'sharesOutstanding':number(row.get('J'),True),'yearIncorporated':year,'sourceRow':row['row'],
      'cachedFinancials':{'price':number(row.get('C')),'price2':number(row.get('I')),
        'priceCurrency':currency,'marketCap':number(row.get('M')),'marketCapCurrency':None,'asOf':None}}
    return record, None

def build(path, imported_on):
    sheet, rows = extract(path)
    accepted, rejected = [], []
    for row in rows:
        record, reason = convert(row)
        if record: accepted.append(record)
        else: rejected.append({'row':row['row'],'ticker':row.get('A'),'reason':reason,
          'resolvedTicker':row.get('K'),'resolvedExchange':row.get('G')})
    counts = Counter(r['id'] for r in accepted)
    duplicates = {k for k,v in counts.items() if v>1}
    for r in accepted:
        if r['id'] in duplicates: rejected.append({'row':r['sourceRow'],'ticker':r['id'],'reason':'duplicate_identity'})
    accepted = sorted([r for r in accepted if r['id'] not in duplicates],key=lambda r:r['id'])
    alias_owners = {}
    for r in accepted:
        for a in r['aliases']: alias_owners.setdefault(a,set()).add(r['id'])
    ambiguous = sorted(a for a,v in alias_owners.items() if len(v)>1)
    for r in accepted: r['aliases'] = [a for a in r['aliases'] if a not in ambiguous]
    reasons = dict(sorted(Counter(r['reason'] for r in rejected).items()))
    result = {'schemaVersion':1,'sourceId':'excel-shares-static','sourceFile':path.name,
      'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'sourceSheet':sheet,'importedOn':imported_on,
      'asOf':None,'provider':'Excel linked stock data · Refinitiv (workbook attribution)',
      'basis':'Saved workbook values; static-field observation dates were not supplied. No live refresh.',
      'financialBasis':'Cached price and market cap are retained separately and never supply current quotes, valuations or sorting. Market-cap currency and share class basis are unconfirmed.',
      'records':accepted,'validation':{'sourceRows':len(rows),'tickerRows':sum(bool(clean(r.get('A'))) for r in rows),
        'accepted':len(accepted),'excluded':len(rejected),'reasons':reasons,'ambiguousAliases':len(ambiguous)}}
    audit = {'summary':result['validation'],'sourceSha256':result['sourceSha256'],'excludedRows':rejected,'ambiguousAliases':ambiguous}
    return result,audit

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--input',type=Path,required=True);ap.add_argument('--output',type=Path,required=True);ap.add_argument('--audit',type=Path,required=True);ap.add_argument('--imported-on',required=True);a=ap.parse_args()
    data,audit=build(a.input,a.imported_on)
    for path,value in [(a.output,data),(a.audit,audit)]:
        path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(json.dumps(data['validation']))
