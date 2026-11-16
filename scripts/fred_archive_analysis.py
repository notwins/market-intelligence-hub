"""Comparable series for the all-dataset view; raw rows remain untouched."""
import hashlib
import json
import math
from collections import defaultdict

MISSING = {'', '.', 'null', 'ND', 'NA', 'N/A', 'n.a.', '-', '*', '(*)'}
OFS_FIELDS = ['total_public_debt_usd_billions','fed_and_government_accounts_usd_billions','total_privately_held_usd_billions',
 'depository_institutions_usd_billions','us_savings_bonds_usd_billions','private_pension_funds_usd_billions',
 'state_local_pension_funds_usd_billions','insurance_companies_usd_billions','mutual_funds_usd_billions',
 'state_local_governments_usd_billions','foreign_international_usd_billions','other_investors_usd_billions']

def number(value):
    if value is None or str(value) in MISSING:return None
    try:
        value=float(value)
        return value if math.isfinite(value) else None
    except (ValueError,TypeError):return None

def metric(field,label,unit,transform='level'):
    return dict(field=field,label=label,unit=unit,transform=transform)

def specification(entry, series=None):
    sid=entry['id'];spec=dict(date='observation_date',dimensions=[],metrics=[],default={})
    if entry['provider']=='FRED':
        spec['metrics']=[metric(sid,entry['name'],entry['unit'],(series or {}).get('heatTransform','level'))]
    elif sid.startswith('NY_'):
        spec['metrics']=[metric('value','Balances 90+ days delinquent','Percent')]
    elif sid=='AUCTION':
        spec.update(date='competitiveAuctionCloseDate',metrics=[metric('bidToCoverRatio','10Y auction bid-to-cover','Times'),metric('highYield','Auction high yield','Percent'),metric('interestRate','Coupon','Percent')])
    elif sid=='TIC':
        spec.update(dimensions=['country_or_aggregate'],default={'country_or_aggregate':'Grand Total'},metrics=[metric('holdings_usd_billions','Treasury holdings','USD billions','yoy')])
    elif sid.startswith('FED_TREASURY_'):
        code='FL893061105.Q' if sid.endswith('STOCKS') else 'FU893061105.Q' if sid.endswith('NSA') else 'FA893061105.Q'
        spec.update(dimensions=['series_code'],default={'series_code':code},metrics=[metric('value','Treasury securities','USD millions','yoy' if sid.endswith('STOCKS') else 'level')])
    elif sid=='CENSUS_GOODS_TRADE_COUNTRIES':
        spec.update(dimensions=['country_code','country_or_area'],default={'country_code':'5590'},metrics=[
          metric('balance_usd_millions','Goods trade balance','USD millions'),metric('exports_usd_millions','Goods exports','USD millions','yoy'),metric('imports_usd_millions','Goods imports','USD millions','yoy')])
    elif sid=='TREASURY_DEBT_PENNY':
        spec.update(date='record_date',metrics=[metric('tot_pub_debt_out_amt','Gross federal debt','USD','yoy'),metric('debt_held_public_amt','Debt held by the public','USD','yoy'),metric('intragov_hold_amt','Intragovernmental holdings','USD','yoy')])
    elif sid=='TREASURY_MSPD_SUMMARY':
        spec.update(date='record_date',dimensions=['security_type_desc','security_class_desc'],default={'security_type_desc':'Total Public Debt Outstanding'},metrics=[
          metric('total_mil_amt','Total debt outstanding','USD millions','yoy'),metric('debt_held_public_mil_amt','Debt held by the public','USD millions','yoy'),metric('intragov_hold_mil_amt','Intragovernmental holdings','USD millions','yoy')])
    elif sid=='TREASURY_MSPD_MARKET':
        spec.update(date='record_date',dimensions=['security_class1_desc','security_class2_desc','series_cd','issue_date','maturity_date','interest_rate_pct'],default={'security_class1_desc':'Total Marketable'},metrics=[metric('outstanding_amt','Outstanding amount','USD millions','yoy'),metric('yield_pct','Issue yield','Percent'),metric('interest_rate_pct','Coupon','Percent')])
    elif sid=='TREASURY_MSPD_NONMARKET':
        spec.update(date='record_date',dimensions=['security_class1_desc','security_class2_desc','security_class3_desc','maturity_date'],default={'security_class1_desc':'Total Nonmarketable'},metrics=[metric('current_month_outstanding_amt','Outstanding amount','USD millions','yoy')])
    elif sid=='TREASURY_OFS2_20Y_ARCHIVE':
        spec['metrics']=[metric(f,f.replace('_usd_billions','').replace('_',' ').capitalize(),'USD billions','yoy') for f in OFS_FIELDS]
    elif sid=='TREASURY_OFS2_PUBLICATIONS':
        spec.update(dimensions=['securities_owner'],default={'securities_owner':'Total Public Debt'},metrics=[metric('usable_securities_bil_amt','Estimated Treasury holdings','USD billions','yoy')],publication='record_date')
    else:raise ValueError('No comparable-series definition for '+sid)
    return spec

def prepare(entry, columns, rows, series=None):
    spec=specification(entry,series)
    if any(m['field'] not in columns for m in spec['metrics']):raise ValueError('Missing analytical field '+entry['id'])
    by_group=defaultdict(list)
    for index,row in enumerate(rows):
        dims=tuple(row[k] for k in spec['dimensions']);by_group[dims].append((index,row))
    groups=[];default=None
    for dims,records in by_group.items():
        dimension_values=dict(zip(spec['dimensions'],dims))
        key=hashlib.sha256(json.dumps(dims,ensure_ascii=False).encode()).hexdigest()[:16]
        label=' · '.join(v for v in dims if v not in ('null','_','')) or entry['name']
        if entry['id'].startswith('FED_'):label=records[-1][1]['description']+' · '+dims[0]
        label=label[:700]
        dates=defaultdict(list)
        for index,row in records:dates[row[spec['date']][:10]].append((index,row))
        ambiguous=not spec.get('publication') and any(len(v)>1 for v in dates.values())
        selected=[]
        for date,items in sorted(dates.items()):
            if spec.get('publication'):items.sort(key=lambda pair:pair[1][spec['publication']])
            selected.append((date,*items[-1]))
        points={m['field']:[[date,number(row[m['field']])] for date,index,row in selected] for m in spec['metrics']}
        group=dict(key=key,label=label,dimensions=dimension_values,points=points,
                   record_indices=[i for date,i,row in selected],records=len(records))
        if ambiguous:
            group.update(sigma_unavailable=True,note='Multiple indistinguishable source rows share a date. No combined value or sigma is inferred.')
            group['points']={m['field']:[] for m in spec['metrics']}
        groups.append(group)
        if all(dimension_values.get(k)==v for k,v in spec['default'].items()) and default is None:default=group
    if default is None:raise ValueError('Default comparison group unavailable: '+entry['id'])
    groups.sort(key=lambda g:(g['key']!=default['key'],g['label'].casefold()))
    index=dict(dataset_id=entry['id'],metrics=spec['metrics'],default_field=spec['metrics'][0]['field'],
               default_group=default['key'],date_field=spec['date'],groups=groups)
    summary=dict(metrics=spec['metrics'],default_field=index['default_field'],default_group=default['key'],
                 series_count=len(groups),default_series=dict(key=default['key'],label=default['label'],points=default['points'][index['default_field']]))
    if default.get('sigma_unavailable'):summary['sigma_unavailable']=True
    if entry['id']=='TREASURY_DEBT_PENNY':summary['quality_dates']=['2011-02-01','2025-08-04']
    return index,summary

def representative(entry,index):
    group=index['groups'][0];m=index['metrics'][0]
    return dict(id=entry['id'],name=entry['name']+' · '+group['label'] if group['label']!=entry['name'] else entry['name'],
      title=entry['title'],group=entry['group'],unit=m['unit'],frequency=entry['frequency'],adjustment=entry.get('adjustment','As published'),
      source=entry['source_url'],updated=entry.get('source_updated','See source'),retrieved=entry['retrieved_at'],heatTransform=m['transform'],points=group['points'][m['field']])
