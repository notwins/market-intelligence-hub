(()=>{'use strict';const root=document.querySelector('.market-understanding');if(!root)return;const chapters=[...root.querySelectorAll('.mu-chapter[data-topic]')],filters=[...root.querySelectorAll('[data-filter]')],search=root.querySelector('#mu-search'),count=root.querySelector('#mu-result-count'),empty=root.querySelector('.mu-no-results');let topic='All topics';function apply(){const q=search.value.trim().toLowerCase();let n=0;chapters.forEach(c=>{const show=(topic==='All topics'||c.dataset.topic===topic)&&(!q||c.textContent.toLowerCase().includes(q));c.hidden=!show;if(show)n++;});count.textContent=n+' of '+chapters.length+' chapters';empty.hidden=n!==0;}filters.forEach(b=>b.addEventListener('click',()=>{topic=b.dataset.filter;filters.forEach(x=>x.setAttribute('aria-pressed',String(x===b)));apply();}));search.addEventListener('input',apply);const print=root.querySelector('#mu-print');if(print)print.addEventListener('click',()=>window.print());const expand=root.querySelector('#mu-expand');expand.addEventListener('click',()=>{const list=[...root.querySelectorAll('.mu-explanation')],open=!list.every(x=>x.open);list.forEach(x=>x.open=open);expand.textContent=open?'Collapse explanations':'Expand all explanations';});root.querySelectorAll('a[href^="#mu-"]').forEach(a=>a.addEventListener('click',()=>{const target=root.querySelector(a.getAttribute('href'));if(target&&target.hidden){topic='All topics';search.value='';filters.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===topic)));apply();}}));})();

// Load the shared header from the reader script so the archived HTML stays byte-for-byte intact.
(() => {
  'use strict';
  const scriptURL = document.currentScript?.src;
  if (!scriptURL || document.documentElement.classList.contains('hub-primary-ready')) return;
  const base = new URL('../', scriptURL);
  const version = '?v=20261127.menu-art1';
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = new URL('Primary Navigation - Type CSS - 16-Nov-16.06.css' + version, base);
  const script = document.createElement('script');
  script.src = new URL('Primary Navigation - Type JS - 16-Nov-16.06.js' + version, base);
  document.head.append(style, script);
})();
