/* Navigation-only enhancement. No datasets or scheduled feeds are modified. */
(()=>{'use strict';
 const routes=['overview','earnings','credit','hourly','policy','headlines','research','master','history','ust','reports','directory','feeds'];
 if(document.querySelector('.rail [data-view="tools"]'))routes.push('tools');
 if(document.querySelector('.rail [data-view="watchlist"]'))routes.splice(1,0,'watchlist','calls');
 const names={calls:['Calls & Full Reports','观点与完整报告','觀點與完整報告'],watchlist:['Bonds & shares watchlist','债券与股票观察','債券與股票觀察'],policy:['Central Banks / US Admin','央行与美国政府','央行與美國政府'],overview:['Daily Briefing','每日简报','每日簡報'],earnings:['US Earnings','美国财报','美國財報'],credit:['Bonds & Credit','债券与信贷','債券與信貸'],hourly:['Hourly News','每小时新闻','每小時新聞'],headlines:['Reuters Coverage','路透报道','路透報導'],research:['Research Papers','研究报告','研究報告'],master:['Master','证券主档','證券主檔'],history:['History','历史数据','歷史數據'],ust:['UST','美国国债','美國國債'],reports:['Scheduled Reports','定期报告','定期報告'],directory:['Research Directory','研究目录','研究目錄'],feeds:['Data & Uploads','数据与上传','資料與上傳'],tools:['Tools & Simulators','工具与模拟器','工具與模擬器']};
 const next=document.createElement('button');next.className='section-next';next.type='button';
 const prefix=document.createElement('span');prefix.className='section-next-prefix';
 const destination=document.createElement('span');destination.className='section-next-name';
 const arrow=document.createElement('span');arrow.className='section-next-arrow';arrow.textContent='→';arrow.setAttribute('aria-hidden','true');
 next.append(prefix,destination,arrow);document.querySelector('.topbar>div:first-child').append(next);
 function update(){const lang=document.documentElement.lang,idx=lang==='zh-Hans'?1:lang==='zh-Hant'?2:0;const active=document.querySelector('.rail [data-view].active')?.dataset.view||location.hash.slice(1).split('/')[0]||'overview';const target=routes[(Math.max(0,routes.indexOf(active))+1)%routes.length];next.dataset.view=target;prefix.textContent=['Next:','下一节：','下一節：'][idx];destination.textContent=names[target]?.[idx]||target;const title=document.querySelector('.topbar b');if(title)title.textContent=names[active]?.[idx]||active;document.querySelectorAll('.bottom-nav [data-view]').forEach(b=>{const icon=b.querySelector('span')?.textContent||'';b.replaceChildren(Object.assign(document.createElement('span'),{textContent:icon}),document.createTextNode(names[b.dataset.view]?.[idx]||b.dataset.view));});}
 // Watch active route only: handles V3 replaceState as well as V4 Back/Forward.
 new MutationObserver(update).observe(document.querySelector('.rail nav'),{attributes:true,subtree:true,attributeFilter:['class']});
 window.addEventListener('hashchange',update);document.getElementById('language')?.addEventListener('change',()=>queueMicrotask(update));update();
})();
/* Mirror the existing subsection controls; original route state and handlers stay authoritative. */
(()=>{'use strict';
 const bar=document.querySelector('.topbar'),view=document.getElementById('view');
 if(!bar||!view)return;
 const tabs=document.createElement('nav');tabs.className='top-subsections';tabs.setAttribute('aria-label','Subsections');tabs.hidden=true;
 bar.insertBefore(tabs,bar.querySelector('.top-controls'));
 let signature='',frame=0;
 function sync(){frame=0;const source=view.querySelector('.subnav');
  const next=source?source.innerHTML+'|'+source.getAttribute('aria-label'):'';
  view.querySelectorAll('.subnav').forEach(n=>n.classList.toggle('subnav-in-topbar',n===source));
  if(next===signature)return;signature=next;
  const focused=tabs.contains(document.activeElement)?document.activeElement?.dataset.tab:null;
  tabs.replaceChildren();tabs.hidden=!source;bar.classList.toggle('has-top-subsections',!!source);
  view.querySelectorAll('.subnav').forEach(n=>n.classList.toggle('subnav-in-topbar',n===source));
  if(!source)return;
  tabs.setAttribute('aria-label',(source.getAttribute('aria-label')||'Section')+' subsections');
  for(const child of source.children)tabs.append(child.cloneNode(true));
  const active=tabs.querySelector('.active');
  if(active){const left=active.offsetLeft-tabs.offsetLeft;if(left<tabs.scrollLeft||left+active.offsetWidth>tabs.scrollLeft+tabs.clientWidth)tabs.scrollLeft=Math.max(0,left-16);}
  if(focused)tabs.querySelector('[data-tab="'+CSS.escape(focused)+'"]')?.focus({preventScroll:true});
 }
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(sync);};
 new MutationObserver(schedule).observe(view,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-pressed']});
 window.addEventListener('hashchange',schedule);window.addEventListener('market-display-change',schedule);sync();
})();

/* Written hierarchy labels accompany the standard's semantic colour swatches. */
(()=>{'use strict';
 const menu=document.querySelector('#more .more-grid');if(!menu)return;
 const themes={stocks:['#233840','#E7F1F5','#F1F7FA','#D9E6EB'],bonds:['#26382F','#E7F1EA','#F1F7F3','#D8E5DC'],macro:['#302D3C','#EBE6F3','#F5F2FA','#E2DAEA'],research:['#182822','#EAF0EC','#F2F6F4','#DCE6E0']};
 const themeFor=route=>/^(?:watchlist|calls|earnings|master|history\/si)/.test(route)?'stocks':/^(?:credit|ust|history\/(?:yield|curves))/.test(route)?'bonds':/^(?:policy|history)/.test(route)?'macro':'research';
 function label(node){if(node.querySelector('.nav-level'))return;const route=node.dataset.view||'';const sub=route.includes('/');node.dataset.navLevel=sub?'subsection':'main';
  const span=document.createElement('small');span.className='nav-level';span.textContent=sub?'Subsection':'Main section';node.append(span);
  const colours=themes[themeFor(route)];node.style.setProperty('--menu-ink',colours[0]);node.style.setProperty('--menu-bg',colours[sub?2:1]);node.style.setProperty('--menu-border',colours[3]);
 }
 menu.querySelectorAll(':scope > button,:scope > a').forEach(label);
 new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)if(n.nodeType===1&&n.matches('button,a'))label(n);}).observe(menu,{childList:true});
})();
