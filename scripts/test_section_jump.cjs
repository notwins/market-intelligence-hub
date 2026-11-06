const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const {indexAt, visible} = require('../site/section-jump.js');
let checks = 0;
function test(name, run) {run(); checks++; console.log('PASS ' + name);}
test('empty, first, middle and last heading positions', () => {
  assert.equal(indexAt([], 90), -1); assert.equal(indexAt([160, 400, 900], 90), 0);
  assert.equal(indexAt([-140, 80, 580], 90), 1); assert.equal(indexAt([-840, -620, -120], 90), 2);
});
test('equal-height card headings preserve the chosen target without skipping a row', () => {
  assert.equal(indexAt([-200, 90, 93, 350], 90), 1);
  assert.equal(indexAt([-200, 90, 93, 350], 90, 2), 2);
  assert.equal(indexAt([-450, -160, -157, 90], 90, 2), 3);
});
const win = {getComputedStyle:n=>n.style || {display:'block',visibility:'visible'}};
function node(parent=null, attrs={}) {return {isConnected:true,hidden:false,parentElement:parent,tagName:'DIV',style:{display:'block',visibility:'visible'},hasAttribute:k=>k in attrs,getAttribute:k=>attrs[k] || null,getClientRects:()=>[{}]};}
test('detached, display-none, hidden, aria-hidden, inert and visibility-hidden targets are excluded', () => {
  const target=node(); assert.equal(visible(target,win),true); target.isConnected=false; assert.equal(visible(target,win),false);
  target.isConnected=true; target.getClientRects=()=>[]; assert.equal(visible(target,win),false);
  for(const setup of [n=>n.hidden=true,n=>n.style.display='none',n=>n.style.visibility='hidden',n=>n.style.visibility='collapse']) {
    const parent=node();setup(parent);assert.equal(visible(node(parent),win),false);
  }
  for(const attrs of [{'aria-hidden':'true'},{inert:''}]) assert.equal(visible(node(node(null,attrs)),win),false);
});
test('closed disclosure content is skipped and reappears on opening', () => {
  const details=node();details.tagName='DETAILS';details.open=false;details.querySelector=()=>({contains:()=>false});
  const heading=node(details);assert.equal(visible(heading,win),false);details.open=true;assert.equal(visible(heading,win),true);
});
test('script is buildless, state-free and never creates route/hash/history entries',()=>{
  const code=fs.readFileSync(path.join(__dirname,'../site/section-jump.js'),'utf8'); new vm.Script(code);
  assert(!/localStorage|sessionStorage|pushState|replaceState|location\s*[.=]/.test(code));
  for(const text of ['MutationObserver','ResizeObserver','hashchange','popstate','market-display-change',"addEventListener('toggle'",'prefers-reduced-motion','preventScroll: true','scrollTo({ top','aria-live="polite"',"setAttribute('aria-label', 'Subsection navigation')"]) assert(code.includes(text),text);
  assert(code.includes('refreshFrame'));assert(code.includes('positionFrame'));
});
test('compact controls retain touch sizing, keyboard focus, print hiding and bottom-navigation clearance',()=>{
  const css=fs.readFileSync(path.join(__dirname,'../site/section-jump.css'),'utf8');
  for(const text of ['min-height:44px','min-width:44px','focus-visible','@media print','--section-jump-bottom','safe-area-inset-bottom','[hidden]','forced-colors','var(--text-scale,1)']) assert(css.includes(text),text);
});
console.log(`${checks} subsection-jump checks passed.`);
