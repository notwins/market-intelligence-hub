/* Occasional site tools live inside Settings. Owner access retains its server gate. */
(()=>{'use strict';
const settings={public_url:'https://notwins.github.io/market-intelligence-hub/blueprint.html',owner_url:'https://market-intelligence-blueprint-winston.winstonnggw.chatgpt.site/'};
if(window.HubBlueprintAccess){window.HubBlueprintAccess.refresh();return;}
const make=owner=>{const a=document.createElement('a');a.href=owner?settings.owner_url:settings.public_url;a.target='_blank';a.rel='noopener noreferrer';a.dataset.blueprintLink=owner?'owner':'public';a.textContent=owner?'Owner Blueprint':'Blueprint';if(owner)a.title='Private owner blueprint · password required';return a;};
let queued=false,customDialog,opener;
function links(host){if(host.querySelector('[data-blueprint-settings]'))return;const section=document.createElement('section');section.dataset.blueprintSettings='';section.className='display-section bp-settings-links';const heading=document.createElement('h3');heading.textContent='Site tools';section.append(heading,make(false),make(true));host.append(section);}
function open(button){opener=button;document.querySelector('#hub-sections[open]')?.close();customDialog.showModal();customDialog.querySelector('button').focus();}
function refresh(){
 if(!document.body)return;
 // Remove the old header, map-footer and footer shortcuts, including late additions.
 document.querySelectorAll('.bp-access-shortcuts,.bp-runtime-footer,.atlas-footer>.bp-access-link').forEach(n=>n.remove());
 document.querySelectorAll('header a.hub-blueprint-link,.top-controls a.hub-blueprint-link,.hub-map-foot a.hub-blueprint-link').forEach(n=>n.remove());
 const existing=document.getElementById('display-settings');
 if(existing){document.querySelectorAll('[data-site-settings-open],.mih-blueprint-nav').forEach(n=>n.remove());if(customDialog){if(customDialog.open)customDialog.close();customDialog.remove();customDialog=null;}if(existing.querySelector('.display-heading'))links(existing);return;}
 const menu=document.querySelector('#hub-sections .more-grid,#more .more-grid');if(!menu)return;
 document.querySelectorAll('.mih-blueprint-nav').forEach(n=>n.remove());
 if(!customDialog){customDialog=document.createElement('dialog');customDialog.id='hub-site-settings';customDialog.setAttribute('aria-labelledby','hub-site-settings-title');customDialog.innerHTML='<header><h2 id="hub-site-settings-title">Settings</h2><button type="button" aria-label="Close settings">×</button></header>';links(customDialog);customDialog.querySelector('button').onclick=()=>customDialog.close();customDialog.addEventListener('close',()=>opener?.isConnected&&opener.focus({preventScroll:true}));document.body.append(customDialog);}
 document.querySelectorAll('[data-site-settings-open]').forEach(n=>{if(n.parentElement!==menu)n.remove();});
 if(!menu.querySelector('[data-site-settings-open]')){const button=document.createElement('button');button.type='button';button.dataset.siteSettingsOpen='';button.textContent='Settings';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls',customDialog.id);button.onclick=()=>open(button);menu.append(button);}
}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;refresh();});}
const style=document.createElement('style');style.id='mih-blueprint-access-style';style.textContent='.bp-settings-links a{display:flex;align-items:center;min-height:44px;padding:8px 12px;margin:6px 0;border:1px solid #d9e3e7;border-radius:8px;color:#243e4a;background:#f2f6f7;text-decoration:none;font:600 14px/1.4 system-ui}.bp-settings-links a:focus-visible,[data-site-settings-open]:focus-visible{outline:3px solid #6655bd;outline-offset:2px}.bp-settings-links h3{font-size:16px}#hub-site-settings{box-sizing:border-box;width:min(440px,calc(100vw - 24px));max-height:85dvh;overflow:auto;padding:20px;border:1px solid #d9e3e7;border-radius:14px;background:#fff;color:#182b36}#hub-site-settings::backdrop{background:#182b3666}#hub-site-settings header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0}#hub-site-settings h2{margin:0;font:700 20px/1.3 system-ui}#hub-site-settings button{min-width:44px;min-height:44px;font-size:24px}[data-site-settings-open]{min-height:44px;padding:8px 12px;border:1px solid #d9e3e7;border-radius:8px;background:#f2f6f7;color:#243e4a;font:600 14px/1.3 system-ui;cursor:pointer}';document.head.append(style);
window.HubBlueprintAccess={refresh};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});else refresh();
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
})();
