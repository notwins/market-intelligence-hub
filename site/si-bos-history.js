/* This library is imported from a local file. It has no network client. */
(function(root){'use strict';
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&
 Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const positive=value=>Number.isFinite(value)&&value>0;
const calls={B:'Buy',H:'Hold',S:'Sell'};
const listingKey=(ticker,currency)=>{
 const id=typeof ticker==='string'?ticker.trim().toUpperCase().replace(/^0+(\d+ HK)$/,'$1'):'';
 return /^[A-Z0-9./-]{1,16} [A-Z]{2}$/.test(id)&&typeof currency==='string'&&/^[A-Za-z]{3}$/.test(currency)?id+'|'+currency:'';
};
const invalid=()=>Error('Choose a valid private BOS history file.');
function parse(text){
 if(typeof text!=='string'||text.length>16000000)throw invalid();
 const data=JSON.parse(text.replace(/^\uFEFF/,''));
 if(data?.version!==1||data.kind!=='si-bos-monthly-history'||!Array.isArray(data.listings)||
    !data.listings.length||data.listings.length>10000)throw invalid();
 const listings=new Map();
 let count=0;
 for(const entry of data.listings){
  if(!Array.isArray(entry)||entry.length!==3)throw invalid();
  const [ticker,currency,rows]=entry,key=listingKey(ticker,currency);
  if(!key||listings.has(key)||!Array.isArray(rows)||!rows.length||rows.length>2000)throw invalid();
  let prior='';
  const parsed=rows.map(tuple=>{
   if(!Array.isArray(tuple)||tuple.length!==5)throw invalid();
   const [day,call,value,referenceDay,close]=tuple;
   if(!date(day)||day<=prior||!Object.hasOwn(calls,call)||value!==null&&!positive(value)||
      (referenceDay!==null||close!==null)&&(!date(referenceDay)||referenceDay>day||!positive(close)))throw invalid();
   prior=day;
   return {date:day,rating:calls[call],value,reference:referenceDay===null?null:{date:referenceDay,value:close}};
  });
  count+=parsed.length;
  if(count>400000)throw invalid();
  listings.set(key,parsed);
 }
 return {listings,count};
}
function connect(mode,operation){
 return new Promise((resolve,reject)=>{
  if(!root.indexedDB){reject(Error('Browser storage is unavailable.'));return;}
  const request=root.indexedDB.open('market-si-beta2-bos-history',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('archive');
  request.onerror=()=>reject(request.error);
  request.onblocked=()=>reject(Error('Close the other SI tab to use browser storage.'));
  request.onsuccess=()=>{
   const db=request.result;
   try{
    const tx=db.transaction('archive',mode),work=operation(tx.objectStore('archive'));
    tx.oncomplete=()=>{db.close();resolve(work.result);};
    tx.onabort=()=>{db.close();reject(tx.error||Error('Browser storage was interrupted.'));};
   }catch(error){db.close();reject(error);}
  };
 });
}
const api={listingKey,parse,read:()=>connect('readonly',store=>store.get('current')),
 save:raw=>connect('readwrite',store=>store.put(raw,'current')),
 clear:()=>connect('readwrite',store=>store.delete('current'))};
root.SIBosHistory=api;
if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
