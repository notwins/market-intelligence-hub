'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('../site/content-source.js'),R=require('../site/research-feed.js');
const tag={label:'Bonds',text:'#166534',background:'#F0FDF4',dark_text:'#86EFAC',dark_background:'#052E16'};
const record=(name,hash)=>({id:name+'-2026-11-14',title:name,summary:'Complete synthetic research',category:'Credit',tags:['bond'],kind:'complete-report',cutoff_sgt:'2026-11-14T08:00:00+08:00',verified_at_sgt:'2026-11-14T09:00:00+08:00',full_report_url:`research/${name}-2026-11-14/index.html`,full_report_sha256:hash.repeat(64),assets:{'index.html':hash.repeat(64)},quick_read:null});
const feed=records=>({schema_version:1,generation:records.length,revision:'c'.repeat(64),verified_at_sgt:records.length?records[0].verified_at_sgt:null,records,tags:{bond:tag}});
const local=feed([record('legacy','a')]),remote=feed([record('bond-credit-full','b')]),combined=D.mergeResearch(local,remote);
assert.equal(combined.records.length,2);const card=R.cards(combined.records,combined.tags,'../');
assert(card.includes(D.CONTENT+remote.records[0].full_report_url));assert(card.includes('../'+local.records[0].full_report_url));assert(!card.includes('Quick read'));
assert.equal(R.selected(combined.records,'bond-credit-full',combined.tags).length,1);
assert.throws(()=>D.mergeResearch(local,local));assert.throws(()=>D.mergeResearch(local,feed([]),combined));
assert.throws(()=>D.mergeResearch(local,feed([{...remote.records[0],delivery_base:'https://evil.invalid/'}])));
const context={window:{}};vm.runInNewContext(fs.readFileSync('site/v4-tools.js','utf8').split('/* full-report-destinations:start */')[1].split('/* full-report-destinations:end */')[0],context);
context.window.HubFullReportEditions.setRegistry(D.registry({entries:[]},combined));
assert.equal(context.window.HubFullReportEditions.select('credit')[0].full_edition.document,D.CONTENT+remote.records[0].full_report_url);
const row={id:'content-new',kind:'Research edition',title:'New full research',text:'complete research',href:D.CONTENT+remote.records[0].full_report_url,date:'2026-11-14',tags:['Bonds']};row.location={href:row.href};
assert.equal(D.mergeSearch([],{schema_version:1,entries:[row]}).length,1);assert.throws(()=>D.mergeSearch([],{schema_version:1,entries:[{...row,href:'https://evil.invalid/'}]}));
const edition={id:'one',stories:[],limitations:['Source unavailable'],coverage:'unavailable',cutoff:'2026-11-14T08:00:00+08:00',window_start:'2026-11-14T04:00:00+08:00',report_at:'2026-11-14T08:01:00+08:00'};
const news={schema_version:1,editions:[edition],last_complete_cutoff:null};
assert.deepEqual(D.mergeHourly(news,news),news);assert.throws(()=>D.mergeHourly(news,{...news,editions:[{...edition,coverage:'complete'}]}));
(async()=>{
 let broken=false;const client=D.client(async url=>{if(broken)throw Error('Offline');return {ok:true,json:async()=>url.includes('hourly')?news:url.includes('site-search')?{schema_version:1,entries:[row]}:remote};});
 await client.research(local);await client.hourly(news);await client.search([]);broken=true;
 await assert.rejects(()=>client.research(local));const retained=await client.hourly(news);assert(retained.delivery_error);assert.equal(retained.editions[0].cutoff,edition.cutoff);assert.equal((await client.search([]))[0].href,row.href);
 // A UI rollback uses the same independent feed; no report bytes are in its deployment.
 assert.equal(D.mergeResearch(local,remote).records.length,combined.records.length);
 for(const page of ['v4.html','v2.html','search.html','market-understanding/index.html'])assert(fs.readFileSync('site/'+page,'utf8').includes('content-source.js'));
 console.log('PASS independent reports, full-edition destinations, search, missing brief, unsafe/removed editions, failed refresh retention and rollback contract');
})().catch(e=>{console.error(e);process.exitCode=1;});
