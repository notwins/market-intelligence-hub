/* Shared public navigation. Only login URLs are public; owner data stays behind its server gate. */
(()=>{'use strict';
const settings={public_url:'https://notwins.github.io/market-intelligence-hub/blueprint.html',owner_url:'https://market-intelligence-blueprint-winston.winstonnggw.chatgpt.site/'};
if(window.HubBlueprintAccess){window.HubBlueprintAccess.refresh();return;}
const make=(owner=false,compact=false)=>{const a=document.createElement('a');a.href=owner?settings.owner_url:settings.public_url;a.target='_blank';a.rel='noopener noreferrer';a.className='bp-access-link'+(owner?' bp-owner':'');a.dataset.blueprintLink=owner?'owner':'public';a.setAttribute('aria-label',owner?'Open private owner blueprint · password required':'Open public System Atlas');a.title=owner?'Private owner blueprint · password required':'Public System Atlas';const icon=document.createElement('span');icon.setAttribute('aria-hidden','true');icon.textContent=owner?'🔒':'◈';const label=document.createElement('span');label.className=compact?'bp-label':'';label.textContent=owner?'Owner blueprint':'System Atlas';a.append(icon,label);return a;};
let queued=false;
function refresh(){
 if(!document.body)return;
 for(const anchor of document.querySelectorAll('[data-site-map],a[href="site-map.html"],a[href$="/site-map.html"]')){
  if(anchor.dataset.blueprintExpanded||!anchor.parentElement||anchor.closest('footer,dialog,#site-tree,.family-tree'))continue;
  if(!anchor.closest('header,.topbar,.mast,.top-controls,.mast-actions'))continue;
  const links=[...anchor.parentElement.querySelectorAll('a[href]')],existing=links.find(a=>{try{return new URL(a.href,location.href).pathname.endsWith('/blueprint.html');}catch{return false;}}),hasOwner=links.some(a=>a.href===settings.owner_url);
  const group=document.createElement('span');group.className='bp-access-shortcuts';group.setAttribute('role','group');group.setAttribute('aria-label','Blueprint shortcuts');if(!existing)group.append(make(false,true));if(!hasOwner)group.append(make(true,true));if(group.childNodes.length)(existing||anchor).insertAdjacentElement('afterend',group);anchor.dataset.blueprintExpanded='true';
 }
 const atlasFooter=document.querySelector('.atlas-footer');
 if(atlasFooter&&!atlasFooter.querySelector('[data-blueprint-link="owner"]'))atlasFooter.append(make(true));
 if(!document.querySelector('[data-blueprint-footer],.mih-legal-footer,.atlas-footer')){
  const footer=document.createElement('footer');footer.className='bp-runtime-footer';footer.dataset.blueprintFooter='true';const nav=document.createElement('nav');nav.setAttribute('aria-label','Blueprint navigation');nav.append(make(),make(true));footer.append(nav);document.body.append(footer);
 }
}
function schedule(){if(queued)return;queued=true;(window.requestAnimationFrame||window.setTimeout)(()=>{queued=false;refresh();});}
const style=document.createElement('style');style.id='mih-blueprint-access-style';style.textContent='.bp-access-shortcuts{display:inline-flex;gap:6px;align-items:center;vertical-align:middle;margin-left:6px;flex-shrink:0}.bp-access-link{display:inline-flex!important;align-items:center;justify-content:center;gap:5px;border:1px solid #aecfd2;border-radius:7px;background:#e7f3f4;color:#086b76!important;padding:8px 10px;min-height:36px;font:650 12px/1.25 "Segoe UI",system-ui,sans-serif;text-decoration:none!important;white-space:nowrap}.bp-access-link.bp-owner{background:#f7f1e5;border-color:#d5c49e;color:#715b2b!important}.bp-access-link:hover{filter:brightness(.96)}.bp-access-link:focus-visible{outline:3px solid #2563eb;outline-offset:3px}.bp-access-link>span:first-child{font-size:16px}.bp-runtime-footer{clear:both;margin:32px 0 0;padding:18px 16px;border-top:1px solid #cbd5e1;background:#f8fafc}.bp-runtime-footer nav{display:flex;flex-wrap:wrap;justify-content:center;gap:12px}.mih-blueprint-nav{margin-top:12px}.atlas-footer>.bp-access-link{font-size:8px;min-height:20px;padding:2px 7px;margin-left:0}.atlas-footer>.bp-access-link>span:first-child{font-size:11px}@media(max-width:700px){.bp-access-shortcuts{gap:3px;margin-left:3px}.bp-access-shortcuts .bp-label{display:none}.bp-access-shortcuts .bp-access-link{width:30px;min-height:36px;padding:4px}.top-controls:has(.bp-access-shortcuts){gap:4px;flex-wrap:wrap}.atlas-footer>.bp-access-link{font-size:7px;padding:2px 5px}.atlas-footer>.bp-access-link>span:last-child{display:none}}';document.head.append(style);
window.HubBlueprintAccess={refresh};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});else refresh();
if(window.MutationObserver){const observer=new MutationObserver(schedule);observer.observe(document.documentElement,{childList:true,subtree:true});window.setTimeout(()=>observer.disconnect(),15000);}
})();
