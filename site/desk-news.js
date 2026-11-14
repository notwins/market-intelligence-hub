/* Dated hourly metadata only. Uses the established ContentDelivery reader. */
(function(root){'use strict';
const aliases={GOOGL:['Google','Alphabet'],META:['Meta','Meta Platforms'],BRK_B:['Berkshire','Berkshire Hathaway'],'BRK.B':['Berkshire','Berkshire Hathaway'],TSM:['TSMC','Taiwan Semiconductor'],NVDA:['Nvidia','NVIDIA']};
function safeURL(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!['chatgpt.com','chat.openai.com'].includes(u.hostname)&&!/[\\\x00-\x20]/.test(value)?u.href:'';}catch{return '';}}
const canonical=value=>{const url=safeURL(value);return url?url.split('#')[0]:'';};
function fromHourly(feed,watchlist){
 const rows=new Map(),names=watchlist.map(r=>({ticker:r.ticker,tokens:new Set([r.ticker,r.name,...(aliases[r.ticker]||[])].filter(Boolean).map(x=>x.toLowerCase()))}));
 for(const edition of feed?.editions||[])for(const story of edition.stories||[]){
  const topicTokens=new Set(String(story.topic||'').split('/').map(x=>x.trim().toLowerCase()).filter(Boolean));
  const explicit=Array.isArray(story.tickers)?story.tickers:[];
  const tickers=names.filter(r=>explicit.includes(r.ticker)||[...r.tokens].some(t=>topicTokens.has(t))).map(r=>r.ticker);
  const href=(story.source_urls||[]).map(safeURL).find(Boolean);
  if(!tickers.length||!href||typeof story.headline!=='string'||!story.story_id)continue;
  const source=(edition.sources||[]).find(s=>canonical(s.url)===canonical(href));
  const row={id:story.story_id,title:story.headline,href,published_at:source?.published_at||source?.published_date||null,
   edition_cutoff:edition.cutoff||null,tickers,source:'Reuters · saved hourly edition',
   match_basis:explicit.length?'Explicit company ticker or exact company topic label':'Exact company label in the saved topic field',
   coverage:edition.coverage||'Coverage not recorded',freshness:story.freshness||null,version:Number(story.version)||0};
  const previous=rows.get(story.story_id);
  if(!previous||row.version>previous.version)rows.set(story.story_id,row);
 }
 const seen=new Set();return [...rows.values()].sort((a,b)=>(Date.parse(b.published_at)||0)-(Date.parse(a.published_at)||0)||a.id.localeCompare(b.id)).filter(r=>{const key=canonical(r.href);if(seen.has(key))return false;seen.add(key);return true;});
}
async function load(local,watchlist){const feed=await root.ContentDelivery.hourly(local);return {news:fromHourly(feed,watchlist),delivery_error:feed.delivery_error===true,last_complete_cutoff:feed.last_complete_cutoff||null};}
const api={fromHourly,load};root.DeskNews=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
