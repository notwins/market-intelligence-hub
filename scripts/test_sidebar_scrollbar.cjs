const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'../site'),css=fs.readFileSync(path.join(root,'v4-navigation.css'),'utf8'),html=fs.readFileSync(path.join(root,'v4.html'),'utf8');
assert.match(html,/v4-navigation\.css\?v=20261105\.scrollbar1/,'Fresh CSS must bypass the previous cached navigation stylesheet');
const sidebar=css.slice(css.indexOf('/* Keep the side-menu scrollbar'));
assert.match(sidebar,/scrollbar-color:var\(--rail-scroll-thumb\) var\(--rail-scroll-track\)/);
assert.match(sidebar,/--rail-scroll-track:var\(--nav,#102c44\)/,'Track follows the existing dark side-menu palette');
assert.match(sidebar,/\.rail nav::-webkit-scrollbar-thumb\{/,'Safari fallback');
assert.match(sidebar,/@media\(forced-colors:active\)[\s\S]*scrollbar-color:auto/,'Respect the user’s high-contrast scrollbar');
assert.doesNotMatch(sidebar,/scrollbar-width:\s*(none|thin)|overflow(?:-y)?:\s*hidden|forced-color-adjust:\s*none/,'Do not hide scrolling or override accessibility');
for(const selector of sidebar.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{/g)){
  if(selector[1].trim().startsWith('@'))continue;
  for(const part of selector[1].split(','))assert.ok(part.includes('.rail nav'),'Scrollbar rules must affect the side menu only: '+part);
}
function luminance(hex){const values=hex.replace('#','').match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return values.reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);}
function contrast(a,b){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
for(const [palette,track,thumb,hover] of [
  ['ocean','#102c44','#63afc4','#95d8e8'],
  ['forest','#15392c','#83b59c','#afe1c5'],
  ['plum','#34223f','#ba9acd','#dfbdf2'],
  ['sand','#3a3024','#c1a574','#e4c99a']
]){
  const block=palette==='ocean'?sidebar.match(/\.rail nav\{([^}]+)\}/)[1]:sidebar.match(new RegExp('html\\[data-display-palette='+palette+'\\] \\.rail nav\\{([^}]+)\\}'))[1];
  assert.ok(block.includes('--rail-scroll-thumb:'+thumb));assert.ok(block.includes('--rail-scroll-thumb-hover:'+hover));
  assert.ok(contrast(thumb,track)>=3,palette+' thumb contrast');assert.ok(contrast(hover,track)>=3,palette+' hover contrast');
}
console.log('PASS side-menu-only colors, four palette contrast checks, native sizing, Safari fallback, forced-color support and cache refresh');
