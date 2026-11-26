/* Open only verified full credit editions selected by the existing daily shelf. */
(function(root){
'use strict';
const HUB='https://notwins.github.io/market-intelligence-hub/';
function reportURL(value){
  if(typeof value!=='string'||!value)return '';
  try{
    const u=new URL(value,HUB);
    if(u.origin!=='https://notwins.github.io'||u.username||u.password||u.search||u.hash||!/^\/market-intelligence-(?:hub|content)\/research\/bond-credit-full-[a-z0-9]+(?:-[a-z0-9]+)*\/(?:index\.html)?$/.test(u.pathname))return '';
    return u.href;
  }catch{return '';}
}
function install(doc){
  const grid=doc.getElementById('daily-cards');
  if(!grid||doc.getElementById('mih-credit-popup'))return false;
  const dialog=doc.createElement('dialog');
  if(typeof dialog.showModal!=='function')return false;
  dialog.id='mih-credit-popup';dialog.setAttribute('aria-labelledby','mih-credit-popup-title');
  dialog.innerHTML='<header class="credit-popup-head"><div><p class="credit-popup-kicker">MARKET INTEL · COMPLETE EDITION</p><h2 id="mih-credit-popup-title">Global Markets &amp; Credit Research</h2><p id="mih-credit-popup-cutoff"></p></div><div class="credit-popup-actions"><a class="credit-popup-direct" target="_blank" rel="noopener noreferrer">Open full page ↗</a><button type="button" data-credit-reset>Reload</button><button type="button" data-credit-close aria-label="Close research dashboard" autofocus>Close ×</button></div></header><iframe title="Complete dated research dashboard" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer"></iframe>';
  doc.body.append(dialog);
  const frame=dialog.querySelector('iframe'),close=dialog.querySelector('[data-credit-close]'),direct=dialog.querySelector('.credit-popup-direct');
  let opener=null,current='';
  grid.addEventListener('click',event=>{
    if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||dialog.open)return;
    const card=event.target.closest('.report-card');if(!card||!grid.contains(card))return;
    const link=card.querySelector('a.credit-dashboard-link');if(!link)return;
    const interactive=event.target.closest('a,button,input,select,textarea,label,summary');
    if(interactive&&interactive!==link)return;
    if(!interactive&&String(root.getSelection?.()||''))return;
    const url=reportURL(link.getAttribute('href'));if(!url)return;
    dialog.querySelector('h2').textContent=card.querySelector('h3')?.textContent||'Global Markets & Credit Research';
    dialog.querySelector('#mih-credit-popup-cutoff').textContent='Research cutoff · '+(link.dataset.cutoff||'See edition')+' · Not live market quotes';
    direct.href=url;current=url;opener=link;
    try{dialog.showModal();}catch{return;}
    event.preventDefault();frame.src=url;close.focus();
  });
  close.addEventListener('click',()=>dialog.close());
  dialog.querySelector('[data-credit-reset]').addEventListener('click',()=>{if(current)frame.src=current;});
  dialog.addEventListener('close',()=>{frame.removeAttribute('src');current='';(opener?.isConnected?opener:grid.querySelector('a.credit-dashboard-link'))?.focus();opener=null;});
  return true;
}
if(typeof module!=='undefined'&&module.exports)module.exports={reportURL,install};
if(root.document)install(root.document);
})(typeof window!=='undefined'?window:globalThis);
