const assert=require('node:assert/strict'),fs=require('node:fs'),R=require('../site/reuters-read-up.js');
const r={id:'read-up-'+'a'.repeat(24),revision:1,kind:'reuters-read-up',published_at:'2026-11-14T08:00:00+08:00',title:'Capacity and funding',takeaway:'Demand and funding connect.',happened:'Selected reporting describes a plan. [S1]',matters:'Our interpretation: cash timing matters. [S1]',watch:'Our watch points: check receipts. [S1]',sources:[{id:'S1',title:'Selected source',original_url:'https://www.reuters.com/business/capacity-2026-11-14/',accessed_url:'https://www.reuters.com/business/capacity-2026-11-14/'}],primary:[]};r.word_count=['title','takeaway','happened','matters','watch'].map(k=>r[k]).join(' ').match(/[\p{L}\p{N}_’'-]+/gu).length;
const index={schema_version:1,entries:[r]},copy=x=>JSON.parse(JSON.stringify(x));
assert.equal(R.validate(index),index);assert.match(R.href(r),/read-ups\/read-up-[a-f0-9]{24}\/r1\.html$/);
for(const value of [{...r,title:null},{...r,demo:true},{...r,word_count:0},{...r,notes:'private'},{...r,happened:'No citation'}])assert.throws(()=>R.validate({schema_version:1,entries:[value]}));
const bad=copy(index);bad.entries[0].sources[0].original_url='javascript:alert(1)';assert.throws(()=>R.validate(bad));
(async()=>{
 let payload=index;const client=R.client(async()=>({ok:true,json:async()=>payload}));await client.refresh();payload=bad;await assert.rejects(client.refresh());assert.deepEqual(client.last(),index);payload={schema_version:1,entries:[]};await assert.rejects(client.refresh());assert.deepEqual(client.last(),index);
 let resolve;const racing=R.client(()=>new Promise(r=>{resolve=r;}));const old=racing.refresh();const oldResolve=resolve;const newer=racing.refresh();resolve({ok:true,json:async()=>index});await newer;oldResolve({ok:true,json:async()=>({schema_version:1,entries:[]})});assert.equal((await old).stale,true);assert.deepEqual(racing.last(),index);
 const page=fs.readFileSync('site/market-understanding/index.html','utf8');assert.equal((page.match(/id="reuters-read-up"/g)||[]).length,1);assert.ok(page.includes('data-read-up-refresh'));assert.ok(!page.includes('owner/read-up'));
 console.log('Read-up reader: schema, unsafe links, failed refresh, stale response, one section and private boundary passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
