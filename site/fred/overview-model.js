/* Display categories and ordering; original archive metadata stays authoritative. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FredOverview=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const finite=value=>typeof value==='number'&&Number.isFinite(value);
  const groups={
    'Annual federal interest outlays':'Treasury & government debt','Federal debt':'Treasury & government debt',
    'Federal debt and Federal Reserve':'Treasury & government debt','Fiscal':'Treasury & government debt',
    'Global government yields':'Treasury & government debt','Monthly government finances':'Treasury & government debt',
    'Nominal Treasury curve local history':'Treasury & government debt','Treasury ownership':'Treasury & government debt',
    'Rates':'Treasury & government debt','Real yields and funding':'Treasury & government debt',
    'Credit':'Credit & bonds','Corporate bonds and total returns':'Credit & bonds',
    'Equities and profits':'Equities','FX':'Currencies','Growth':'Economy & jobs',
    'Inflation':'Inflation','Liquidity':'Liquidity & funding','Loans':'Banks & lending',
    'CRE':'Property & housing','Trade':'Trade & external accounts','Economy and trade':'Trade & external accounts',
    'International investment position':'Trade & external accounts','Common market and economy':'Economy & jobs'
  };
  const overrides={};
  for(const [group,ids] of Object.entries({
    'Inflation':'PCEPI T5YIFR T5YIE T10YIE',
    'Credit & bonds':'BAA10Y DCPF3M DCPN3M',
    'Banks & lending':'BUSLOANS',
    'Property & housing':'HOUST PERMIT CSUSHPINSA MORTGAGE30US',
    'Liquidity & funding':'EFFR SOFR',
    'Economy & jobs':'ISRATIO OPHNFB TCU ULCNFB',
    'Equities':'VIXCLS','Commodities':'DCOILWTICO'
  }))for(const id of ids.split(' '))overrides[id]=group;
  function mainGroup(entry){return overrides[entry.id]||groups[entry.group]||entry.group||'Other';}
  function key(item,sort){const e=item.entry,r=item.latest;return sort==='extreme'?(finite(r.z)?Math.abs(r.z):null):({name:e.name||e.title,group:mainGroup(e),latest:r.raw,date:r.date,rows:e.rows,z:r.z}[sort]);}
  function compareValues(a,b,direction){
    const missing=v=>v===null||v===undefined||v===''||(typeof v==='number'&&!finite(v));
    if(missing(a)||missing(b))return Number(missing(a))-Number(missing(b));
    return direction*(typeof a==='number'&&typeof b==='number'?a-b:String(a).localeCompare(String(b)));
  }
  function order(items,{sort='group',direction=1,grouped=true}={}){
    return items.slice().sort((a,b)=>{
      const groupDifference=mainGroup(a.entry).localeCompare(mainGroup(b.entry));
      if(grouped&&groupDifference)return groupDifference*(sort==='group'?direction:1);
      return compareValues(key(a,sort),key(b,sort),direction)||String(a.entry.name||a.entry.title||a.entry.id).localeCompare(String(b.entry.name||b.entry.title||b.entry.id))||a.entry.id.localeCompare(b.entry.id);
    });
  }
  function partition(items){
    const result=[];
    for(const item of items){const name=mainGroup(item.entry);let group=result.find(g=>g.name===name);if(!group){group={name,items:[]};result.push(group);}group.items.push(item);}
    return result;
  }
  function guides(row){
    if(!row||!Number.isInteger(row.n)||row.n<12||!finite(row.mean)||!finite(row.sd)||row.sd<=0)return null;
    const values={mean:row.mean,lower1:row.mean-row.sd,upper1:row.mean+row.sd,lower2:row.mean-2*row.sd,upper2:row.mean+2*row.sd};
    return Object.values(values).every(finite)?values:null;
  }
  return Object.freeze({mainGroup,order,partition,guides});
});
