'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'../site/legal');
const script=fs.readFileSync(path.join(root,'editorial-colours.js'),'utf8');
(async()=>{
  for(const mode of ['success','denied','unavailable']){
    let listener,copied='';
    const source=fs.readFileSync(path.join(root,'research-prompt.txt'),'utf8');
    const button={disabled:false,addEventListener:(event,fn)=>{assert.equal(event,'click');listener=fn;}};
    const status={textContent:''},panel={open:false};
    const document={getElementById:id=>({'copy-research-prompt':button,'prompt-copy-status':status,'research-prompt-source':{textContent:JSON.stringify(source)}}[id]),querySelector:()=>panel};
    const navigator=mode==='unavailable'?{}:{clipboard:{writeText:async text=>{if(mode==='denied')throw Error('Denied');copied=text;}}};
    vm.runInNewContext(script,{document,navigator});
    await listener();await listener();
    assert.equal(button.disabled,false);
    if(mode==='success'){assert.equal(copied,source);assert.match(status.textContent,/copied/);}
    else{assert.match(status.textContent,/Download as text/);assert.equal(panel.open,true);}
  }
  vm.runInNewContext(script,{document:{getElementById:()=>null}});
  console.log('PASS exact prompt copy, repeated clicks, denied/unavailable clipboard, visible fallback and absent controls.');
})().catch(error=>{console.error(error);process.exit(1);});
