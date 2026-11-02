/* Version links only. V3 display and data behavior are preserved. */
(()=>{'use strict';
const current=/v4\.html$/.test(location.pathname)?'v4':'v3';
function install(){const box=document.querySelector('#display-settings');if(!box||box.querySelector('[data-version-switch]'))return;
 const language=document.querySelector('#language')?.value||'en',zh=language!=='en',traditional=language==='zh-Hant';
 const title=zh?(traditional?'儀表板版本':'仪表板版本'):'Dashboard version';
 const section=document.createElement('section');section.className='display-section';section.dataset.versionSwitch='';
 section.innerHTML='<h3>'+title+'</h3><label class="display-field"><span>'+title+'</span><select aria-label="'+title+'" id="dashboard-version"><option value="v3">V3 · '+(zh?'原版':'Original')+'</option><option value="v4">V4 · '+(zh?'鸟瞰布局':'Bird’s-eye layout')+'</option></select></label><p class="display-help">'+(zh?'V3 保留原有布局。选择 V4 查看新布局。':'V3 keeps its original layout. Select V4 for the new layout. Your choice is remembered on this browser.')+'</p>';
 const intro=box.querySelector('.display-intro');intro?intro.after(section):box.append(section);
 const select=section.querySelector('select');select.value=current;
 select.addEventListener('change',()=>{const version=select.value;if(!['v3','v4'].includes(version))return;try{localStorage.setItem('market-hub-version',version);}catch{}location.assign(version+'.html'+location.hash.split('/')[0]);});
}
function ready(){new MutationObserver(install).observe(document.body,{childList:true,subtree:true});install();}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',ready,{once:true}):ready();
})();
