const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'../site'),read=f=>fs.readFileSync(path.join(root,f),'utf8');let count=0;
function test(name,fn){fn();count++;console.log('PASS '+name);}
const html=read('v4.html');
test('V4 retains mobile navigation and shared V3 engines',()=>{assert.ok(html.includes('mobile-navigation.js'));for(const file of ['v3.css','v3-display.css','v3-source-engine.js','v3-core.js','v3-i18n.js'])assert.ok(html.includes(file),file);});
test('all V4 inline and external application scripts parse',()=>{for(const f of ['v4-tools.js','v4-display.js','version-switch.js','v4-layout.js'])new vm.Script(read(f));for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);});
test('navigation creates distinct history entries, preserves search and restores without pushing',()=>{
 const log=[],location={pathname:'/v4.html',search:'?test=1',hash:'#overview'},state={view:'overview'},tabs={history:'yield',master:'explore'};
 const ctx={document:{querySelector:()=>null},S:state,location,history:{pushState:(_,__,url)=>{log.push(['push',url]);location.hash=url.slice(url.indexOf('#'));},replaceState:(_,__,url)=>{log.push(['replace',url]);location.hash=url.slice(url.indexOf('#'));}},MarketV3:{applyRoute:(v,t)=>{if(t&&Object.hasOwn(tabs,v))tabs[v]=t;},routeSuffix:v=>tabs[v]?'/'+tabs[v]:''},$:()=>({close(){}}),render(){},window:{scrollTo(){}}};
 vm.createContext(ctx);vm.runInContext(html.slice(html.indexOf('const viewNames='),html.indexOf('\nfunction openReport')),ctx);
 vm.runInContext("navigate('history/fx');navigate('history/fx');navigate('credit');navigate('history/fx',{fromHistory:true});",ctx);
 assert.equal(log.length,2);assert.equal(log[0][1],'/v4.html?test=1#history/fx');assert.equal(state.view,'history');
 vm.runInContext("navigate('unknown',{replace:true})",ctx);assert.equal(state.view,'overview');assert.equal(log.at(-1)[0],'replace');
});
test('V4 preferences are independent and sanitize extreme text/card values',()=>{
 const ctx={window:{},document:{documentElement:{style:{setProperty(){}},dataset:{}},readyState:'loading',addEventListener(){}},localStorage:{getItem:k=>k==='market-hub-display-v4'?JSON.stringify({scale:8,cardScale:.01,columns:'invalid'}):null},requestAnimationFrame(){},cancelAnimationFrame(){}};
 vm.createContext(ctx);vm.runInContext(read('v4-display.js'),ctx);assert.equal(ctx.document.documentElement.dataset.displayColumns,'auto');
 let values={};ctx.document.documentElement.style.setProperty=(k,v)=>values[k]=v;vm.runInContext(read('v4-display.js'),ctx);assert.equal(values['--text-scale'],2);assert.equal(values['--card-scale'],.5);
});
require('./test_legacy_retirement.cjs');
test('credit desk excludes non-financial word senses without deleting source rows',()=>{
 const code=html.slice(html.indexOf('function isCredit('),html.indexOf('\nfunction dealCard('));const ctx={};vm.createContext(ctx);vm.runInContext(code,ctx);
 for(const title of ["Norris says Antonelli deserves more credit for 'insane job' this season",'Britain to make lifetime retirement income the default for private pensions','Pension funds change their default options'])assert.equal(ctx.isCredit({title,category:'Fixed income'}),false,title);
 for(const title of ['Borrower defaults on sovereign debt','New Africa credit rating agency in talks with 15 sovereign borrowers','Apollo launches European credit platform','Default option for pensions shifts into government bonds','Bank deserves more credit for refinancing debt','Credit spreads widen','Sovereign bond sale'])assert.equal(ctx.isCredit({title,category:'Markets'}),true,title);
 assert.equal(ctx.isCredit({title:'A verified fixed income update',category:'Fixed income'}),true);
 const rows=JSON.parse(read('data/news.json')).items,before=JSON.stringify(rows);rows.filter(ctx.isCredit);assert.equal(JSON.stringify(rows),before);assert.equal(rows.length,JSON.parse(before).length);
});
console.log(`${count} V4 behavior checks passed.`);

require('./test_ust_curves.cjs');

require('./test_bond_watchlist.cjs');

require('./test_dynamic_cards.cjs');

require("./test_grouping_pivot.cjs");
