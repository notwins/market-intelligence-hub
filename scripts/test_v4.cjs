const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'../site'),read=f=>fs.readFileSync(path.join(root,f),'utf8');let count=0;
function test(name,fn){fn();count++;console.log('PASS '+name);}
const html=read('v4.html');
test('V3 has requested mobile navigation and retains backup',()=>{assert.ok(read('v3.html').includes('mobile-navigation.js'));assert.ok(read('v3-backup.html').includes('data-view="master"'));});
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
test('entry defaults to V4 and respects explicit V3 preference',()=>{const script=read('index.html').match(/<script>([\s\S]*?)<\/script>/)[1];for(const preferred of [null,'v3','v4']){let destination;const ctx={URLSearchParams,location:{search:'',hash:'#history',replace:v=>destination=v},document:{getElementById:()=>({})},localStorage:{getItem:()=>preferred}};vm.runInNewContext(script,ctx);assert.ok(destination.startsWith(preferred==='v3'?'v3.html':'v4.html'));} });
console.log(`${count} V4 behavior checks passed.`);

require('./test_ust_curves.cjs');
