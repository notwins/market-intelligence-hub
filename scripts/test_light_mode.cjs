const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const site=path.resolve(__dirname,'../site');let callback;const root={dataset:{theme:'dark'},style:{}};
const links=[{href:'https://hub.test/watchlist.css?v=old'},{href:'https://external.test/source.css'}];
vm.runInNewContext(fs.readFileSync(path.join(site,'light-mode.js'),'utf8'),{URL,location:{href:'https://hub.test/v4.html',origin:'https://hub.test'},document:{documentElement:root,querySelectorAll:()=>links},MutationObserver:class{constructor(fn){callback=fn}observe(){}}});
assert(links[0].href.includes('light-policy=20261115.1'));assert.equal(links[1].href,'https://external.test/source.css');
assert.equal(root.dataset.theme,'light');assert.equal(root.style.colorScheme,'light');root.dataset.theme='dark';callback();assert.equal(root.dataset.theme,'light','cached or script-requested dark mode is reset');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)])}
const automatic=walk(site).filter(p=>/\.(css|html)$/.test(p)).filter(p=>/@media\s*\(prefers-color-scheme:\s*dark\)/.test(fs.readFileSync(p,'utf8')));assert.deepEqual(automatic,[],'no automatic dark media remains');
const v3=JSON.parse(fs.readFileSync(path.join(site,'data/colour-templates-v3.json'),'utf8'));assert.equal(v3.themes.find(t=>t.id==='08').tokens.secondaryInk,'#635E72');assert(fs.readFileSync(path.join(site,'report-style-preview.html'),'utf8').includes('--accent:#635E72'));
console.log('PASS light-only initial state, cached/script dark requests, no automatic dark media, exact V3 muted lavender');
