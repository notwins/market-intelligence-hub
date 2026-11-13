/* Pure, bounded Boolean search. No eval, network requests or private storage. */
(function(root){
'use strict';
const companies=[['Google','Alphabet','GOOG','GOOGL'],['Microsoft','MSFT'],['Amazon','AMZN'],['Nvidia','NVDA'],['Apple','AAPL'],['Meta','Meta Platforms','META'],['Tesla','TSLA'],['Berkshire Hathaway','Berkshire','BRK.B','BRK-B'],['AMD','Advanced Micro Devices'],['Broadcom','AVGO'],['Micron','Micron Technology','MU'],['TSMC','Taiwan Semiconductor','Taiwan Semiconductor Manufacturing','TSM']];
const canonical=value=>{const v=String(value).trim().toLowerCase();return companies.find(a=>a.some(x=>x.toLowerCase()===v))?.[0]||String(value).trim();};
const variants=value=>companies.find(a=>a.some(x=>x.toLowerCase()===String(value).toLowerCase()))||[String(value)];
const escapeRE=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function contains(text,term,phrase=false){
 const list=phrase?[term]:variants(term);
 return list.some(t=>{if(!t)return false;return new RegExp('(^|[^\\p{L}\\p{N}_])'+escapeRE(t)+'(?=$|[^\\p{L}\\p{N}_])','iu').test(text);});
}
const cache=new WeakMap();
function record(entry){
 if(cache.has(entry))return cache.get(entry);
 const text=[entry.title||'',entry.text||''].join(' '), tags=new Map();
 for(const t of entry.tags||[]){if(typeof t==='string'&&t.trim())tags.set(canonical(t).toLowerCase(),canonical(t));}
 // Company chips describe explicit saved-text mentions, not inferred exposure.
 for(const names of companies)if(contains(text,names[0]))tags.set(names[0].toLowerCase(),names[0]);
 const value={text,tags:[...tags.values()].sort((a,b)=>a.localeCompare(b))};cache.set(entry,value);return value;
}
function tokenize(query){
 const input=String(query||'').replace(/[“”]/g,'"');
 if(input.length>2000)throw Error('Keep the rule under 2,000 characters.');
 const tokens=[];let i=0;
 while(i<input.length){
  if(/\s/.test(input[i])){i++;continue;}
  const at=i;
  if('()'.includes(input[i])){tokens.push({type:input[i++],at});continue;}
  let field='any';const prefix=/^(tag|text):/i.exec(input.slice(i));
  if(prefix){field=prefix[1].toLowerCase();i+=prefix[0].length;while(/\s/.test(input[i]||'')&&i<input.length)i++;}
  let value='',phrase=false;
  if(input[i]==='"'){
   phrase=true;i++;let closed=false;
   while(i<input.length){if(input[i]==='\\'&&['"','\\'].includes(input[i+1])){value+=input[i+1];i+=2;}else if(input[i]==='"'){i++;closed=true;break;}else value+=input[i++];}
   if(!closed)throw Error('Close the quoted phrase with another quotation mark.');
  }else{while(i<input.length&&!/[\s()"]/.test(input[i]))value+=input[i++];}
  if(!value.trim())throw Error('Add a word or quoted phrase'+(field==='any'?'':' after '+field+':')+'.');
  const upper=value.toUpperCase();tokens.push({type:field==='any'&&!phrase&&['AND','OR','NOT'].includes(upper)?upper:'term',value,field,phrase,at});
  if(tokens.length>200)throw Error('Use fewer than 200 search terms and operators.');
 }
 return tokens;
}
function parse(query){
 const tokens=tokenize(query);let i=0,depth=0;
 const terms=[];
 function primary(){
  const t=tokens[i];if(!t)throw Error('Add a term after the operator.');
  if(t.type==='('){i++;if(++depth>30)throw Error('Use fewer nested groups.');const node=or();if(tokens[i]?.type!==')')throw Error('Close the group with a right parenthesis: ).');i++;depth--;return node;}
  if(t.type!=='term')throw Error(t.type===')'?'Add a term before the closing parenthesis.':'Add a term before '+t.type+'.');
  i++;terms.push(t);return t;
 }
 function not(){if(tokens[i]?.type==='NOT'){i++;if(++depth>30)throw Error('Use fewer nested operators.');const node={type:'NOT',right:not()};depth--;return node;}return primary();}
 function and(){let node=not();while(i<tokens.length&&tokens[i].type!=='OR'&&tokens[i].type!==')'){if(tokens[i].type==='AND')i++;node={type:'AND',left:node,right:not()};}return node;}
 function or(){let node=and();while(tokens[i]?.type==='OR'){i++;node={type:'OR',left:node,right:and()};}return node;}
 const tree=tokens.length?or():null;if(i<tokens.length)throw Error('Remove the extra closing parenthesis.');return {tree,terms};
}
function match(node,entry){
 if(!node)return true;
 if(node.type==='AND')return match(node.left,entry)&&match(node.right,entry);
 if(node.type==='OR')return match(node.left,entry)||match(node.right,entry);
 if(node.type==='NOT')return !match(node.right,entry);
 const data=record(entry),tag=data.tags.some(t=>canonical(t).toLowerCase()===canonical(node.value).toLowerCase());
 return node.field==='tag'?tag:contains(data.text,node.value,node.phrase)||(node.field==='any'&&tag);
}
const articleKinds=new Set(['Headline','Hourly story','Hourly edition','Report','Research edition','Research library','Earnings card','Watchlist research','Public diary','External research PDF']);
function isArticle(entry){return articleKinds.has(entry.kind)||(entry.kind==='Page'&&/^(research\/|data\/watchlist\/reports\/)/.test(entry.href||''));}
// Content priority is only a relevance tie-breaker, never a match or score boost.
const securityKinds=new Set(['Security master','Stock directory','Bond directory','UST reference']);
const researchKinds=new Set(['Report','Research edition','Research library','White Papers & Research Papers','Watchlist research','Public diary','External research PDF']);
function exactSecurity(entry,query){
 if(!securityKinds.has(entry.kind))return false;
 const q=String(query||'').trim().toLowerCase();
 if(!q||!/^[a-z0-9][a-z0-9.:-]*$/i.test(q))return false;
 // Use explicit identifiers or the catalogue's ticker-first title convention.
 const identifiers=[entry.ticker,entry.symbol,entry.isin,String(entry.title||'').split(/\s+[·|–—]\s+/)[0]];
 return identifiers.some(value=>typeof value==='string'&&value.trim().toLowerCase()===q);
}
function relevancePriority(entry,query){
 if(!String(query||'').trim())return 1;
 if(exactSecurity(entry,query))return -1;
 if(researchKinds.has(entry.kind)||(entry.kind==='Page'&&/^(research\/|data\/watchlist\/reports\/)/.test(entry.href||'')))return 0;
 return securityKinds.has(entry.kind)?2:1;
}
function search(entries,query,kind='',scope='all'){
 const parsed=parse(query);
 return entries.filter(e=>(!kind||e.kind===kind)&&(scope!=='articles'||isArticle(e))&&match(parsed.tree,e)).map(e=>({e,score:parsed.terms.reduce((n,t)=>n+(contains(e.title||'',t.value,t.phrase)?5:0),0)})).sort((a,b)=>b.score-a.score||relevancePriority(a.e,query)-relevancePriority(b.e,query)||String(b.e.date||'').localeCompare(String(a.e.date||''))||String(a.e.title).localeCompare(String(b.e.title))).map(x=>x.e);
}
function quote(value){return '"'+String(value).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';}
function appendTag(query,tag,operator='AND'){const term='tag:'+quote(canonical(tag));return query.trim()?'('+query.trim()+') '+(operator==='OR'?'OR':'AND')+' '+term:term;}
const api={parse,search,match,record,canonical,contains,appendTag,isArticle,relevancePriority,exactSecurity};root.MarketSearchQuery=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
