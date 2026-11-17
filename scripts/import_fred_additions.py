"""Import the owner's verified additional CSVs without changing any prior snapshot."""
import argparse
import copy
import csv
import datetime as dt
import hashlib
import io
import json
import re
import shutil
import zipfile
from pathlib import Path
from build_fred_observatory import ROOT,build,read_csv,write_json,write_views,write_bundle

SGT=dt.timezone(dt.timedelta(hours=8))
GROWTH=set('PCEPI CES0500000003 RRSFS PCEC96 DSPIC96 BUSLOANS CSUSHPINSA DCOILWTICO BAMLCC0A0CMTRIV BAMLHYH0A0HYM2TRIV SP500 DJIA NASDAQCOM NASDAQ100 NASDAQXNDX NASDAQBANK CPATAX BOPTEXP BOPTIMP IR IQ OPHNFB ULCNFB IIPUSASSQ IIPUSLIAQ GFDEBTN FYGFDPUN FDHBFRBN FDHBPIN TREAST MTSR133FMS MTSO133FMS FYOINT'.split())
NAMES={'VIXCLS':'VIX volatility','T5YIFR':'5Y forward inflation compensation','PCEPI':'Headline PCE prices','CCSA':'Continuing jobless claims',
 'JTSJOL':'Job openings','CES0500000003':'Average hourly earnings','RRSFS':'Real retail sales','PCEC96':'Real consumption',
 'DSPIC96':'Real disposable income','PSAVERT':'Personal saving rate','BUSLOANS':'Commercial & industrial loans','CSUSHPINSA':'US national home prices',
 'DCOILWTICO':'WTI crude oil','USREC':'US recession indicator','BAA10Y':'Baa less 10Y Treasury','BAMLC0A0CMEY':'IG corporate yield',
 'BAMLH0A0HYM2EY':'HY corporate yield','BAMLC0A4CBBBEY':'BBB corporate yield','BAMLH0A1HYBBEY':'BB corporate yield',
 'BAMLCC0A0CMTRIV':'IG bond total return','BAMLHYH0A0HYM2TRIV':'HY bond total return','BAMLEMCBPIEY':'EM corporate yield',
 'BAMLEMCBPIOAS':'EM corporate OAS','T5YIE':'5Y breakeven inflation','DCPF3M':'Financial commercial paper · 3M',
 'DCPN3M':'Nonfinancial commercial paper · 3M','SP500':'S&P 500','DJIA':'Dow Jones Industrial Average','NASDAQCOM':'Nasdaq Composite',
 'NASDAQ100':'Nasdaq-100','NASDAQXNDX':'Nasdaq-100 total return','NASDAQBANK':'Nasdaq Bank','VXVCLS':'3M equity volatility',
 'CPATAX':'Corporate profits after tax','BOPTEXP':'Goods & services exports','BOPTIMP':'Goods & services imports','BOPGSTB':'Goods & services trade balance',
 'IEABC':'Current-account balance','IR':'Import prices','IQ':'Export prices','TCU':'Capacity utilisation','OPHNFB':'Labour productivity',
 'ULCNFB':'Unit labour costs','ISRATIO':'Inventories / sales','IIPUSNETIQ':'Net international investment position','IIPUSASSQ':'US external financial assets',
 'IIPUSLIAQ':'US external financial liabilities','GFDEBTN':'Gross federal debt','FYGFDPUN':'Federal debt held by public','FDHBFRBN':'Federal debt held by Fed',
 'FDHBPIN':'Federal debt held by private investors','TREAST':'Fed Treasury securities','MTSR133FMS':'Federal receipts','MTSO133FMS':'Federal outlays',
 'MTSDS133FMS':'Federal surplus / deficit','FYOINT':'Federal interest outlays'}

def save_csv(path,fields,rows):
    path.parent.mkdir(parents=True,exist_ok=True)
    with path.open('w',encoding='utf-8-sig',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore');writer.writeheader();writer.writerows(rows)

def import_additions(raw,work):
    raw,work=Path(raw).resolve(),Path(work).resolve()
    if work.exists():raise ValueError('Import workspace must be new')
    base=ROOT/'site/data/fred';old_bytes=(base/'catalog.json').read_bytes();old=json.loads(old_bytes)
    monitor=json.loads((base/old['monitor_url']).read_text(encoding='utf-8'))
    now=dt.datetime.now(SGT);version=now.strftime('%Y-%m-%dT%H%M%S%f')
    additions=read_csv(raw/'Additional_Download_Inventory.csv')[1]
    prior={e['id']:e for e in old['datasets']}
    assert not ({r['dataset_id'] for r in additions}&set(prior)), 'Some requested additions already exist; reconcile rather than overwrite'
    staged=work/'raw';(staged/'External sources').mkdir(parents=True)
    for entry in old['datasets']:
        src=base/entry['csv_url'];assert hashlib.sha256(src.read_bytes()).hexdigest()==entry['sha256']
        shutil.copyfile(src,staged/('' if entry['provider']=='FRED' else 'External sources')/entry['filename'])
    ffields,frows=read_csv(base/old['fred_inventory_url'])
    efields,erows=read_csv(base/old['external_inventory_url'])
    ffields=list(dict.fromkeys(ffields+['notes']));efields=list(dict.fromkeys(efields+['dataset_id','retrieved_at','sha256']))
    registry=[]
    for row in additions:
        source=raw/row['filename'];assert hashlib.sha256(source.read_bytes()).hexdigest()==row['sha256'],row['dataset_id']
        sid=row['dataset_id'];is_fred='/' not in row['filename']
        shutil.copyfile(source,staged/row['filename'])
        if is_fred:
            meta={**row,'series_id':sid}
            checkpoint=raw/'_download_support/additional_20261116/fred_results'/(sid+'.json')
            if checkpoint.exists():meta.update(json.loads(checkpoint.read_text(encoding='utf-8')))
            frows.append(meta)
            fields,records=read_csv(source)
            name=NAMES.get(sid,re.sub(r'\s*\('+re.escape(sid)+r'\)$','',row['title']))
            if sid.startswith('DGS'):name='Treasury '+sid[3:]
            if sid.startswith('DFII'):name='Real Treasury '+sid[4:]+'Y'
            for code,country in [('DE','Germany'),('GB','UK'),('JP','Japan'),('CH','Switzerland')]:
                if sid=='IRLTLT01'+code+'M156N':name=country+' government 10Y'
            points=[[r['observation_date'],float(r[sid]) if r[sid] not in ('','.') else None] for r in records]
            monitor['series'][sid]=dict(id=sid,name=name,group=row['category'],title=row['title'],unit=row['units'],frequency=row['frequency'],
              adjustment=row['seasonal_adjustment'],source=row['source_url'],updated=(meta.get('source_updated_date','')+' '+meta.get('source_updated_time','')).strip(),
              retrieved=row['retrieved_at'],heatTransform='year_change' if sid=='IIPUSNETIQ' else 'yoy' if sid in GROWTH else 'level',points=points)
            monitor['fredIds'].append(sid)
        else:
            provider='Federal Reserve' if sid.startswith('FED_') else 'US Census Bureau' if sid.startswith('CENSUS_') else 'US Treasury'
            group='Trade' if sid.startswith('CENSUS_') else 'Treasury ownership' if sid.startswith(('FED_','TREASURY_OFS')) else 'Federal debt'
            registry.append(dict(id=sid,filename=source.name,provider=provider,title=row['title'],group=group,unit=row['units'],frequency=row['frequency'],source_url=row['source_url'],notes=row['notes'],refresh_type=sid))
            erows.append(dict(dataset_id=sid,dataset=row['title'],filename=source.name,status='downloaded',first_observation=row['first_observation'],last_observation=row['last_observation'],rows=row['rows'],units=row['units'],frequency=row['frequency'],source_url=row['source_url'],notes=row['notes'],retrieved_at=row['retrieved_at'],sha256=row['sha256']))
        monitor.setdefault('sourceMetadata',{})[sid]=dict(retrieved_at=row['retrieved_at'],refresh_status='saved')
    save_csv(staged/'FRED_Download_Inventory.csv',ffields,frows)
    save_csv(staged/'External sources/External_Download_Inventory.csv',efields,erows)
    write_json(ROOT/'scripts/fred-observatory/extra-datasets.json',registry)
    old_note=(base/old['notes_url']).read_text(encoding='utf-8-sig')
    new_note=(raw/'Additional_Data_README.txt').read_text(encoding='utf-8-sig').replace('Local download only. No site deployment or schedule changes were made. New additions are not yet connected to the existing monthly site-refresh collection.','Published in the shared Market Intel archive. The existing monthly three-month overlap refresh now covers the complete collection.')
    (staged/'README.txt').write_text('MARKET INTEL - SHARED MACRO DATA ARCHIVE\n155 data CSVs. Published local-source import; source observation dates and successful retrieval times vary. The existing monthly refresh runs on the first at 08:00 Singapore and merges a three-month overlap without truncating history. Source failures retain verified prior data.\n\n'+new_note+'\n\nORIGINAL COLLECTION NOTES\n'+old_note,encoding='utf-8')
    monitor.update(snapshot=now.date().isoformat(),archiveVersion=version,checkedAt=now.isoformat())
    summary=dict(kind='local_import',status='imported',checked_count=0,failed_count=0,imported_count=len(additions),added=sum(int(r['rows']) for r in additions),revised=0,matched=0,overlap_months=3,overlap_start=(now.date()-dt.timedelta(days=92)).isoformat())
    monitor['refreshSummary']=summary
    packed=work/'monitor.json';write_json(packed,monitor)
    catalog=build(staged,packed,views=False)
    dated=base/version
    report=dict(schema_version=1,archive_version=version,checked_at=now.isoformat(),previous_archive=old['archive_version'],previous_catalog_sha256=hashlib.sha256(old_bytes).hexdigest(),**summary,
      datasets=[dict(id=e['id'],status='preserved' if e['id'] in prior else 'imported',added=0 if e['id'] in prior else e['rows'],revised=0,unchanged=e['rows'] if e['id'] in prior else 0) for e in catalog['datasets']])
    write_json(dated/'refresh-report.json',report);write_json(dated/'revisions.json',[])
    catalog.update(refresh_report_url=version+'/refresh-report.json',revisions_url=version+'/revisions.json',status='Verified local-source import; complete collection scheduled for monthly overlap refresh')
    write_json(dated/'catalog.json',catalog);write_json(base/'catalog.json',catalog)
    write_bundle(base,catalog,['refresh-report.json','revisions.json'])
    # This is a UI release as well as a data import; regenerate both current monitors.
    write_views(catalog['snapshot'])
    write_json(work/'import-report.json',report)
    print(json.dumps({k:catalog[k] for k in ['archive_version','dataset_count','fred_count','record_count']},indent=2))
    return catalog

if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--raw-dir',required=True,type=Path);ap.add_argument('--work-dir',required=True,type=Path);args=ap.parse_args();import_additions(args.raw_dir,args.work_dir)
