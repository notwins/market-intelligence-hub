/* Standalone infinite-canvas explorer. No packages, remote execution or credentials. */
(function(){'use strict';
const $=id=>document.getElementById(id),E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const graph=JSON.parse($('atlas-data').textContent),byId=new Map(graph.nodes.map(n=>[n.id,n])),colours={page:'#315D7D',section:'#315D7D',group:'#007190',automation:'#635E72',process:'#635E72',data:'#386D59',source:'#805E32',module:'#635E72',software:'#315D7D',note:'#805E32'},icons={page:'▦',section:'↳',group:'◈',automation:'◷',process:'✧',data:'▤',source:'◎',module:'⌘',software:'⌘',note:'✎'};
const overview=['group:providers','job:daily','job:hourly','job:content-build','job:sgs','job:prices','job:hub-build','data:research-feed.json','data:hourly-news.json','data:sgs-daily-snapshot.json','data:prices','data:history-fed.json','data:bos','page:desk.html','page:v4.html','app:pages-content','app:codex','app:github'];
const storageKey='mih-atlas-v1-'+graph.audience;let saved={};try{saved=JSON.parse(localStorage.getItem(storageKey)||'{}');}catch{}
const state={view:'overview',expanded:null,selected:null,trace:null,impact:false,positions:saved.positions||{},notes:Array.isArray(saved.notes)?saved.notes:[],x:35,y:35,z:1,font:Number(saved.font)||100,light:true,shown:[],layout:new Map(),bounds:{w:1300,h:800},comparison:null,list:false};
let acceptedResearchFeed=null,refreshingResearch=false;
const detailHistory=[], emptyDetails=$('detail-content').innerHTML;
let detailOrigin=null, arranging=false;
const sgt=value=>{const date=new Date(value);return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Singapore',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date)+' SGT':'not recorded';};
function updateRefreshStatus(failed=false){const checked=graph.coverage.feed_checked_at;$('refresh-status').textContent=failed?'Report check failed '+sgt(graph.coverage.feed_attempted_at)+'. '+(checked?'Keeping links checked '+sgt(checked)+'.':'The website snapshot is retained.'):checked?graph.coverage.independent_reports+' report links checked '+sgt(checked)+'.':'Report links are checked on opening online.';}
function toast(t){$('toast').textContent=t;$('toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('show'),4500);}
function persist(){try{localStorage.setItem(storageKey,JSON.stringify({positions:state.positions,notes:state.notes,font:state.font,light:state.light}));}catch{}}
function safeURL(s){try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
function children(id){if(id==='group:history')return graph.nodes.filter(n=>n.type==='section'&&n.group==='history'&&!n.id.startsWith('company:'));return graph.nodes.filter(n=>n.parent===id);}
function countGroup(group){return graph.nodes.filter(n=>n.group===group&&n.type!=='group').length;}
function collect(id,direction){const result=new Set([id]),queue=[id];while(queue.length){const at=queue.shift();for(const e of graph.edges){if(!['data','renders','reference'].includes(e.kind)||e.kind==='reference'&&!$('layer-reference').checked)continue;const target=direction==='up'?e.target:e.source,next=direction==='up'?e.source:e.target;if(target===at&&!result.has(next)){result.add(next);queue.push(next);}}}return result;}
function niceType(n){return ({automation:'automation / configured',process:'source task replies',section:'V4 subsection',group:'district',module:'browser module'})[n.type]||n.type;}
function storePositionsKey(){return state.view+':'+(state.expanded||'root');}
function shownNodes(){
 if(state.trace&&state.selected){const ids=collect(state.selected,state.trace);return graph.nodes.filter(n=>ids.has(n.id));}
 if(state.view==='overview')return overview.map(id=>byId.get(id)).filter(Boolean);
 if(state.view==='pages'){
  if(state.expanded){const parent=byId.get(state.expanded);return [parent,...children(state.expanded)].filter(Boolean);}
  return graph.nodes.filter(n=>n.type==='group'&&['site','research','history','tools','archive','legal'].includes(n.group));
 }
 if(state.view==='flows')return graph.nodes.filter(n=>['source','automation','process','data'].includes(n.type)||['page:desk.html','page:v4.html','route:hourly','route:earnings','route:history/beta4-shares','app:pages-content'].includes(n.id)||$('layer-reference').checked&&n.type==='module');
 return graph.nodes.filter(n=>n.type==='software'&&n.type!=='group');
}
function representative(id,shown){if(shown.has(id))return id;let n=byId.get(id),guard=0;while(n&&guard++<6){if(n.parent&&shown.has(n.parent))return n.parent;n=byId.get(n.parent);}const initial=byId.get(id);if(initial&&shown.has('group:'+initial.group))return 'group:'+initial.group;return null;}
function enabledEdge(e){return e.kind==='navigation'?$('layer-navigation').checked:e.kind==='reference'||e.kind==='renders'?$('layer-reference').checked:e.kind==='contains'?true:$('layer-data').checked;}
function visibleEdges(){const shown=new Set(state.shown.map(n=>n.id)),out=new Map();for(const e of graph.edges){if(!enabledEdge(e))continue;const source=representative(e.source,shown),target=representative(e.target,shown);if(!source||!target||source===target)continue;const key=source+'|'+target+'|'+e.kind;if(!out.has(key))out.set(key,{...e,source,target});}return [...out.values()];}
function placement(nodes){
 const groups=new Map(),overviewMode=state.view==='overview'&&!state.trace;
 if(overviewMode){for(const n of nodes){const c=n.type==='group'&&n.group==='providers'?0:n.type==='automation'||n.type==='process'?1:n.type==='data'?2:n.id==='app:codex'||n.id==='app:github'?0:3;if(!groups.has(c))groups.set(c,[]);groups.get(c).push(n);}}
 else if(state.view==='pages'&&!state.trace){nodes.forEach((n,i)=>{const c=state.expanded?i%3:i%3;if(!groups.has(c))groups.set(c,[]);groups.get(c).push(n);});}
 else for(const n of nodes){const c=n.type==='source'?0:['automation','process'].includes(n.type)?1:n.type==='data'?2:n.type==='module'?3:4;if(!groups.has(c))groups.set(c,[]);groups.get(c).push(n);}
 const positions=new Map();let maxX=0,maxY=0;const baseY=65;
 for(const [c,list]of groups)list.forEach((n,i)=>{const own=state.positions[storePositionsKey()]?.[n.id],p=own||{x:50+c*290,y:baseY+i*145};positions.set(n.id,p);maxX=Math.max(maxX,p.x+245);maxY=Math.max(maxY,p.y+130);});
 for(const n of state.notes.filter(n=>n.view===state.view)){const p=n.position||{x:70,y:70};positions.set(n.id,p);maxX=Math.max(maxX,p.x+245);maxY=Math.max(maxY,p.y+160);}
 state.layout=positions;state.bounds={w:Math.max(400,maxX+40),h:Math.max(300,maxY+35)};
 return overviewMode?['ORIGINAL SOURCES / APPS','PUBLISHERS & JOBS','FEEDS & DATASETS','PUBLIC SURFACES']:null;
}
function nodeHTML(n){const p=state.layout.get(n.id),count=n.type==='group'?countGroup(n.group):children(n.id).length,badge=n.type==='group'?count+' NODES':count?count+' CHILDREN':n.origin==='content'?'INDEPENDENT':'',caption=n.type==='group'?'View district details':n.schedule||n.path||n.status||n.url?.replace(/^https:\/\//,'')||'';return `<button type="button" class="map-node ${E(n.type)}${n.id===state.selected?' selected':''}" data-node="${E(n.id)}" aria-label="${E(n.title+' · '+niceType(n))}" style="left:${p.x}px;top:${p.y}px;--node-colour:${colours[n.type]||colours.group}"><span class="node-meta"><span>${icons[n.type]||'◈'} ${E(niceType(n))}</span><span>${E(badge)}</span></span><strong>${E(n.title)}</strong><span class="node-caption">${E(caption)}</span></button>`;}
function drawEdges(){const labels=$('layer-labels').checked,impact=state.impact&&state.selected?collect(state.selected,'down'):null,trace=state.trace&&state.selected?collect(state.selected,state.trace):null;let html='';for(const e of visibleEdges()){const a=state.layout.get(e.source),b=state.layout.get(e.target);if(!a||!b)continue;const reverse=b.x<a.x,sx=a.x+(reverse?0:225),sy=a.y+52,tx=b.x+(reverse?225:0),ty=b.y+52,dx=Math.max(70,Math.abs(tx-sx)*.5),d=`M ${sx} ${sy} C ${sx+(reverse?-dx:dx)} ${sy},${tx+(reverse?dx:-dx)} ${ty},${tx} ${ty}`,cls=impact?.has(e.source)&&impact.has(e.target)?' impact':trace?.has(e.source)&&trace.has(e.target)?' active':'';html+=`<path class="edge ${E(e.kind)}${cls}" d="${d}" marker-end="url(#arrow)"><title>${E(e.label+(e.confidence==='candidate'?' · inferred reference':''))}</title></path>`;if(labels)html+=`<text class="edge-label" x="${(sx+tx)/2}" y="${(sy+ty)/2-5}" text-anchor="middle">${E(e.label)}</text>`;}$('edge-paths').innerHTML=html;}
function updateTransform(){const s=$('scene');s.style.transform=`translate(${state.x}px,${state.y}px) scale(${state.z})`;$('zoom-value').textContent=Math.round(state.z*100)+'%';updateMiniViewport();}
function pan(dx,dy){
 const view=$('viewport'), margin=72;
 state.x=Math.max(margin-state.bounds.w*state.z,Math.min(view.clientWidth-margin,state.x+dx));
 state.y=Math.max(margin-state.bounds.h*state.z,Math.min(view.clientHeight-margin,state.y+dy));
 updateTransform();
}
function zoom(z,cx=$('viewport').clientWidth/2,cy=$('viewport').clientHeight/2){z=Math.max(.13,Math.min(2.8,z));const ratio=z/state.z;state.x=cx-(cx-state.x)*ratio;state.y=cy-(cy-state.y)*ratio;state.z=z;updateTransform();}
function fit(){const v=$('viewport'),b=state.bounds;state.z=Math.max(.13,Math.min(1.06,(v.clientWidth-65)/b.w,(v.clientHeight-95)/b.h));state.x=(v.clientWidth-b.w*state.z)/2;state.y=(v.clientHeight-b.h*state.z)/2+15;updateTransform();}
function drawMini(){
 const b=state.bounds,sx=240/b.w,sy=120/b.h;
 $('minimap').innerHTML=state.shown.map(n=>{
  const p=state.layout.get(n.id);
  return p?`<rect x="${p.x*sx}" y="${p.y*sy}" width="${225*sx}" height="${95*sy}" rx="2" fill="${colours[n.type]||colours.group}" opacity="${n.id===state.selected?1:.5}"/>`:'';
 }).join('')+'<rect id="minimap-frame" fill="none" stroke="#087b78" stroke-width="1"/>';
 updateMiniViewport();
}
function updateMiniViewport(){
 const frame=$('minimap-frame');
 if(!frame)return;
 const b=state.bounds,v=$('viewport'),sx=240/b.w,sy=120/b.h;
 frame.setAttribute('x',-state.x/state.z*sx);
 frame.setAttribute('y',-state.y/state.z*sy);
 frame.setAttribute('width',v.clientWidth/state.z*sx);
 frame.setAttribute('height',v.clientHeight/state.z*sy);
}
function listHTML(){return graph.nodes.filter(n=>n.type!=='module'||$('layer-reference').checked).filter(n=>!$('map-search').value||[n.title,n.type,n.description,n.path].join(' ').toLowerCase().includes($('map-search').value.toLowerCase())).map(n=>`<button class="list-node" data-select="${E(n.id)}"><strong>${icons[n.type]||'◈'} ${E(n.title)}</strong><small>${E(niceType(n))} · ${E(n.group)}${n.path?' · '+E(n.path):''}</small></button>`).join('');}
function render(shouldFit=true){
 const special=['changes','software'].includes(state.view);$('canvas-wrap').hidden=special;$('special-panel').hidden=!special;document.querySelectorAll('#views button').forEach(b=>b.classList.toggle('active',b.dataset.view===state.view));
 const copy={overview:['A LIVING BLUEPRINT','One system. Two independent publishing lanes.','Select a card to trace its inputs and what depends on it.'],pages:['THE WEBSITE HIERARCHY','Pages, subpages and every district.','Select a district or page to see its sections without leaving the map.'],flows:['FOLLOW THE INFORMATION','From original source to the screen.','Solid lines show reviewed dependencies. Turn on implementation references for filename-based candidates.'],changes:['A DATED RECORD','How the system changes over time.','Actual UI repository revisions, plus comparison of an imported map snapshot.'],software:['THE TOOLBOX','What runs this site. What can map it.','The existing site remains HTML / CSS / JavaScript on GitHub Pages. The atlas needs no plug-in.']}[state.view];$('view-kicker').textContent=copy[0];$('view-title').textContent=state.expanded&&byId.get(state.expanded)?byId.get(state.expanded).title:copy[1];$('view-description').textContent=state.trace?'Tracing '+(state.trace==='up'?'inputs upstream':'consumers downstream')+' of '+byId.get(state.selected)?.title:copy[2];
 if(special){renderSpecial();return;}
 state.shown=shownNodes();const lanes=placement(state.shown);$('nodes').innerHTML=(lanes?lanes.map((label,i)=>`<div class="lane-label" style="left:${50+i*290}px;top:20px">${E(label)}</div>`).join(''):'')+state.shown.map(nodeHTML).join('')+state.notes.filter(n=>n.view===state.view).map(n=>nodeHTML({...n,type:'note'})).join('');drawEdges();$('canvas-count').textContent=state.shown.length+' visible / '+graph.nodes.length+' mapped nodes';$('list-panel').hidden=!state.list;if(state.list)$('list-panel').innerHTML=listHTML();if(shouldFit){fit();const readable=matchMedia('(max-width:750px)').matches?.82:.65;if(state.z<readable){state.z=readable;state.x=20;state.y=50;updateTransform();}}else updateTransform();applyHighlight();
}
function applyHighlight(){const impacted=state.impact&&state.selected?collect(state.selected,'down'):null;document.querySelectorAll('[data-node]').forEach(el=>{const id=el.dataset.node;el.classList.toggle('selected',id===state.selected);el.classList.toggle('impact',!!impacted?.has(id));el.classList.toggle('dim',!!impacted&&!impacted.has(id));});drawMini();}
function detailList(items,direction){return items.length?items.slice(0,35).map(e=>{const id=direction==='in'?e.source:e.target,n=byId.get(id);return n?`<button data-select="${E(id)}">${E(n.title)}<small>${E(e.label)}${e.confidence==='candidate'?' · candidate reference':''}</small></button>`:'';}).join(''):'<p class="fine">No mapped '+(direction==='in'?'inputs':'consumers')+' in the selected relationship layers. This does not prove no external dependency exists.</p>';}
function detailPosition(){
 return {scroll:$('inspector').scrollTop,opened:Array.from($('detail-content').querySelectorAll('details'),item=>item.open)};
}
function restoreDetailPosition(position){
 $('detail-content').querySelectorAll('details').forEach((item,index)=>{item.open=Boolean(position.opened[index]);});
 $('inspector').scrollTop=position.scroll;
}
function inspect(id,keepScroll=false){
 const position=keepScroll?detailPosition():null;
 state.selected=id;const note=state.notes.find(n=>n.id===id),n=byId.get(id)||note;if(!n)return;
 const input=graph.edges.filter(e=>e.target===id&&enabledEdge(e)&&e.kind!=='contains'),output=graph.edges.filter(e=>e.source===id&&enabledEdge(e)&&e.kind!=='contains'),kids=children(id),url=safeURL(n.url);let html=`<span class="detail-type">${E(niceType(n))}</span><h2>${E(n.title)}</h2><p>${E(n.description||'Your local note overlay.')}</p>`;
 if(n.status)html+=`<span class="status-pill">${E(n.status)}</span>`;
 if(kids.length){
  const links=kids.map(child=>`<button type="button" data-select="${E(child.id)}">${E(child.title)}<small>${E(niceType(child))}</small></button>`).join('');
  html+=`<details class="detail-section" ${n.type==='group'?'open':''}><summary>${n.type==='group'?'Inside this district':'Subpages and sections'} · ${kids.length}</summary>${links}</details>`;
 }
 if(!note)html+=`<button class="detail-open" data-show-on-map="${E(id)}">${kids.length?'Show this group on the map':'Find on map'}</button>`;
 if(!note)html+=`<div class="trace-buttons"><button data-trace="up" class="${state.trace==='up'?'active':''}">← Upstream</button><button data-trace="down" class="${state.trace==='down'?'active':''}">Downstream →</button></div><button id="simulate" style="width:100%;font-size:10px;${state.impact?'border-color:#805E32;color:#805E32':''}">${state.impact?'Clear unavailable simulation':'Simulate unavailable · local only'}</button>${state.impact?'<p class="fine">Amber highlights show mapped downstream dependence. Retained data may remain visible; no live source or task has been changed.</p>':''}`;
 if(n.schedule)html+=`<div class="detail-section"><h3>${n.schedule_basis?'Declared cadence':'Configured cadence'}</h3><p>${E(n.schedule)}</p><p class="fine">${E(n.schedule_basis||'Public workflow or reviewed deployment configuration')}. This is not evidence of a completed source report. Scheduled jobs may start late.</p></div>`;
 if(n.owner)html+=`<details class="detail-section"><summary>Owner schedule configuration</summary>${Object.entries(n.owner).map(([k,v])=>`<code>${E(k)}: ${E(v??'Not stored')}</code>`).join('')}</details>`;
 if(n.dates&&Object.keys(n.dates).length)html+=`<details class="detail-section"><summary>Dates retained in source</summary>${Object.entries(n.dates).map(([k,v])=>`<code>${E(k)}: ${E(v??'Unavailable')}</code>`).join('')}<p class="fine">These are file fields, not a current health check.</p></details>`;
 if(!note)html+=`<details class="detail-section"><summary>Inputs · ${input.length}</summary>${detailList(input,'in')}</details><details class="detail-section"><summary>Connections · ${output.length}</summary>${detailList(output,'out')}</details>`;
 if(n.evidence?.length)html+=`<details class="detail-section"><summary>Mapping evidence</summary>${n.evidence.map(p=>`<code>${E(p)}</code>`).join('')}<p class="fine">Source file / reviewed mapping. Optional dashed references require runtime verification.</p></details>`;
 if(url)html+=`<a class="detail-original" href="${E(url)}" target="_blank" rel="noopener noreferrer">Open original ${n.type==='page'||n.type==='section'?'page':'source'} <span class="fine">(new tab)</span></a>`;
 if(note)html+=`<button data-delete-note="${E(id)}" style="margin-top:20px">Remove local note</button>`;
 $('detail-content').innerHTML=html;
 $('inspector').classList.add('open');
 $('close-inspector').hidden=false;
 $('details-back').hidden=detailHistory.length===0;
 if(position)restoreDetailPosition(position);
 else $('inspector').scrollTop=0;
 applyHighlight();drawEdges();
}
function closeControls(){document.querySelector('.atlas-sidebar').classList.remove('controls-open');$('layers-menu').setAttribute('aria-expanded','false');}
function openDetails(id,origin){
 if(!byId.has(id)&&!state.notes.some(n=>n.id===id))return;
 const inspector=$('inspector');
 if(!inspector.classList.contains('open')){
  detailHistory.length=0;
  detailOrigin=origin;
 }else if(state.selected&&state.selected!==id){
  detailHistory.push({id:state.selected,...detailPosition()});
 }
 const rerender=Boolean(state.trace);
 state.impact=false;state.trace=null;
 closeControls();
 if(rerender)render(false);
 inspect(id);
 inspector.focus({preventScroll:true});
}
function closeDetails(restoreFocus=true){
 const inspector=$('inspector');
 if(!inspector.classList.contains('open'))return false;
 inspector.classList.remove('open');
 $('detail-content').innerHTML=emptyDetails;
 $('details-back').hidden=true;
 $('close-inspector').hidden=true;
 detailHistory.length=0;
 if(restoreFocus){
  const target=detailOrigin?.isConnected&&detailOrigin.getClientRects().length?detailOrigin:$('viewport');
  target.focus({preventScroll:true});
 }
 detailOrigin=null;
 return true;
}
function showOnMap(id){
 const n=byId.get(id);
 if(!n)return;
 const oldView=state.view,oldGroup=state.expanded;
 if(n.type==='group'||children(id).length&&(n.type==='page'||n.type==='section')){
  state.view='pages';state.expanded=id;
 }else if(!state.layout.has(id)||$('canvas-wrap').hidden){
  if(n.type==='page'||n.type==='section'){state.view='pages';state.expanded=n.parent;}
  else{
   state.view='flows';state.expanded=null;
   if(n.type==='module')$('layer-reference').checked=true;
   if(n.type==='software')state.trace='down';
  }
 }
 const changed=state.view!==oldView||state.expanded!==oldGroup;
 if(changed||!state.layout.has(id))render();
 const position=state.layout.get(id);
 closeDetails(false);
 if(position){
  const view=$('viewport');
  state.x=view.clientWidth/2-(position.x+112)*state.z;
  state.y=view.clientHeight/2-(position.y+48)*state.z;
  updateTransform();
 }
 $('viewport').focus({preventScroll:true});
}
function renderSpecial(){
 if(state.view==='changes'){
  const d=state.comparison;let html=`<section class="special-card"><h3>Snapshot comparison</h3><p>Load a previously exported JSON board to compare architecture. The comparison checks stable node IDs, node titles, types, schedules, URLs and evidence, plus relationship identities. Layout moves and note edits do not count as architecture changes.</p><button id="compare-upload">Load earlier snapshot →</button>${d?`<p><strong>${d.added.length} added · ${d.removed.length} removed · ${d.changed.length} changed nodes</strong><br>${d.edgesAdded} connections added · ${d.edgesRemoved} removed</p><p>Earlier snapshot: ${E(d.date)}</p>${['added','removed','changed'].map(k=>`<h4>${E(k)}</h4><ul>${d[k].slice(0,50).map(n=>`<li>${E(n.title||n.id)}</li>`).join('')||'<li>None</li>'}</ul>`).join('')}`:'<p class="fine">No earlier snapshot has been loaded. The atlas does not invent a before/after history.</p>'}</section><section class="special-card"><h3>Source commits</h3><p class="fine">Actual repository commits at snapshot time. A commit is not proof of a successful deployment or a completed source report.</p>`;
  html+=graph.revisions.map(r=>`<article class="revision"><time>${E(r.date.slice(0,10))}<br>${E(r.date.slice(11,16))}</time><div><strong>${E(r.title)}</strong><a href="${E(safeURL(r.url)||'#')}" target="_blank" rel="noopener noreferrer">Inspect revision ${E(r.sha)} ↗</a></div></article>`).join('');html+='</section>';$('special-panel').innerHTML=html;return;
 }
 const options=[['BUILT FOR YOUR SITE','This System Atlas','Self-contained HTML, SVG and JavaScript. Works offline, opens without an add-on, and reads a generated architecture snapshot. Local notes, pan/zoom, overlays, dependency tracing and JSON comparison are built in.',''],['BEST CUSTOM APP FOUNDATION','React Flow','A good next step for a larger Freeform-style editor: draggable custom nodes, connections, zoom, pan, minimap and graph interactions. MIT-licensed core. You still need a repository / schedule inventory to supply accurate dependencies.','https://reactflow.dev/'],['READY-MADE SYSTEM MAP','Kumu','An existing system-mapping product with interactive connections, rich node profiles, focus views and website embedding. Suitable if you prefer managing the map in a separate application.','https://www.kumu.io/markets/system-mapping'],['FAMILIAR BLUEPRINT EDITOR','draw.io / diagrams.net','Useful for manually edited hierarchies and engineering diagrams, with layers and interactive HTML embedding. Keeping it aligned with source code still requires an inventory or update process.','https://www.drawio.com/docs/manual/export/embed-html/'],['FREEFORM-STYLE WHITEBOARD','tldraw','An infinite-canvas SDK for a more freehand board experience. Its SDK requires an appropriate production license; do not assume the SDK is unrestricted open source.','https://tldraw.dev/faq']];
 $('special-panel').innerHTML=`<section class="special-card"><h3>Your current application stack</h3><p>Browser: HTML, CSS, JavaScript and SVG. Market-data and publication tooling: Python and Node.js. Delivery: GitHub Actions and two independent GitHub Pages artifacts. Configured owner publishers/importers: Codex local scheduling. Some supplied financial datasets are imported separately into the data branch.</p><p><strong>No GitHub add-on is required for this atlas.</strong> Git records changes; it does not discover source-task dependencies on its own. The map needs source-backed node and connection data.</p><h3>Automatic blueprint updates</h3><p><strong>No additional scheduled task is needed.</strong> ${E(graph.refresh?.architecture?.summary||'The map regenerates with each Hub build')}. Existing scheduled jobs may start late; a configured trigger does not prove a successful deployment.</p><p>Website snapshot: ${E(sgt(graph.built_at))}. Reload this page after a Hub release to see the new structure. Independent research links refresh when this map opens online or when you use the button below.</p><p class="fine">Private automation schedules and replies are not rechecked by this public build. Review their declared mappings when those tasks change. Report links come from validated public feed metadata; the map does not verify destination report bytes. Offline exports remain dated snapshots.</p><button id="refresh-content">Refresh report links</button></section><div class="option-grid">${options.map(([tag,title,desc,url])=>`<section class="special-card"><span class="option-tag">${tag}</span><h3>${title}</h3><p>${desc}</p>${url?`<a href="${url}" target="_blank" rel="noopener noreferrer">Official product documentation ↗</a>`:''}</section>`).join('')}</div>`;
}
function download(value,name,type='application/json'){const b=new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)],{type}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
function compare(previous){const current=new Map(graph.nodes.map(n=>[n.id,n])),old=new Map(previous.nodes.map(n=>[n.id,n])),sig=n=>JSON.stringify([n.title,n.type,n.schedule,n.parent,n.url,n.path,n.description,n.status,n.confidence,n.evidence]),edgeSig=e=>e.source+'|'+e.target+'|'+e.kind,ce=new Set(graph.edges.map(edgeSig)),oe=new Set((previous.edges||[]).map(edgeSig));state.comparison={date:previous.built_at||'Not recorded',added:graph.nodes.filter(n=>!old.has(n.id)),removed:previous.nodes.filter(n=>!current.has(n.id)),changed:graph.nodes.filter(n=>old.has(n.id)&&sig(n)!==sig(old.get(n.id))),edgesAdded:[...ce].filter(e=>!oe.has(e)).length,edgesRemoved:[...oe].filter(e=>!ce.has(e)).length};}
async function refreshContent(quiet=false){
 if(refreshingResearch)return;
 const base='https://notwins.github.io/market-intelligence-content/';refreshingResearch=true;graph.coverage.feed_attempted_at=new Date().toISOString();$('refresh-reports').disabled=true;
 if(!quiet)toast('Checking the independent public research feed…');
 try{
  const response=await fetch(base+'data/research-feed.json',{cache:'no-store'});if(!response.ok)throw Error('Feed unavailable');
  const candidate=window.ResearchFeed.retain(acceptedResearchFeed,await response.json());
  if(candidate.records.some(record=>record.delivery_base))throw Error('Unexpected remote delivery override');
  const additions=[],relationships=[];
  for(const record of candidate.records){
   const id='content:'+record.id,url=base+record.full_report_url;
   additions.push({id,title:record.title,type:'page',group:'research',parent:'group:research',url,description:'Feed-indexed research destination. The feed declares a complete report; this map does not fetch or verify the report bytes. Source cutoff: '+record.cutoff_sgt+'. Feed verification: '+record.verified_at_sgt+'.',dates:{cutoff_sgt:record.cutoff_sgt,verified_at_sgt:record.verified_at_sgt},evidence:['Independent public feed: validated schema 1, immutable edition identity and declared asset manifest'],origin:'content'});
   relationships.push({source:'data:research-feed.json',target:id,kind:'data',label:'indexes full-report destination',confidence:'source',evidence:'Validated public feed metadata; destination bytes not checked by map'},{source:'group:research',target:id,kind:'contains',label:'contains independent report',confidence:'source'});
  }
  const previousIds=new Set(graph.nodes.filter(n=>n.id.startsWith('content:')).map(n=>n.id));
  const nextNodes=graph.nodes.filter(n=>!previousIds.has(n.id)).concat(additions),nextEdges=graph.edges.filter(e=>!previousIds.has(e.source)&&!previousIds.has(e.target)).concat(relationships);
  graph.nodes=nextNodes;graph.edges=nextEdges;byId.clear();for(const node of nextNodes)byId.set(node.id,node);acceptedResearchFeed=candidate;
  graph.coverage.independent_reports=additions.length;graph.coverage.feed_checked_at=new Date().toISOString();graph.coverage.feed_revision=candidate.revision;
  updateRefreshStatus();$('source-revision').textContent='SOURCE '+(graph.revision||'unavailable').slice(0,8)+' · '+graph.edges.length+' relationships';
  if(!quiet)toast('Research links refreshed: '+additions.length+' destinations. Website structure remains the dated Hub snapshot.');
  if(state.view==='software')renderSpecial();else render(false);if(state.selected&&$('inspector').classList.contains('open'))inspect(state.selected,true);
 }catch{updateRefreshStatus(true);if(!quiet)toast('Research feed unavailable or invalid. Existing links and the last successful check are retained.');}
 finally{refreshingResearch=false;$('refresh-reports').disabled=false;}
}
// Drag anywhere to pan. Moving individual cards is an explicit layout mode.
const viewport=$('viewport'),pointers=new Map();
$('close-inspector').hidden=true;
let drag=null,pinch=null;
const midpoint=([a,b])=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.hypot(a.x-b.x,a.y-b.y)});
viewport.addEventListener('pointerdown',event=>{
 if(event.button!==0||pointers.size>=2)return;
 pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
 viewport.setPointerCapture(event.pointerId);
 viewport.classList.add('grabbing');
 if(pointers.size===2){
  const center=midpoint([...pointers.values()]),bounds=viewport.getBoundingClientRect();
  pinch={distance:center.distance,z:state.z,x:(center.x-bounds.left-state.x)/state.z,y:(center.y-bounds.top-state.y)/state.z};
  return;
 }
 const card=event.target.closest('[data-node]'),id=card?.dataset.node;
 drag={card,id,position:arranging&&id?state.layout.get(id):null,
  startX:event.clientX,startY:event.clientY,lastX:event.clientX,lastY:event.clientY,moved:false};
});
viewport.addEventListener('pointermove',event=>{
 if(!pointers.has(event.pointerId))return;
 pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
 if(pointers.size===2&&pinch){
  const center=midpoint([...pointers.values()]),bounds=viewport.getBoundingClientRect();
  state.z=Math.max(.13,Math.min(2.8,pinch.z*center.distance/Math.max(1,pinch.distance)));
  state.x=center.x-bounds.left-pinch.x*state.z;
  state.y=center.y-bounds.top-pinch.y*state.z;
  updateTransform();
  return;
 }
 if(!drag)return;
 const dx=event.clientX-drag.startX,dy=event.clientY-drag.startY;
 if(!drag.moved&&Math.hypot(dx,dy)<5)return;
 drag.moved=true;
 if(drag.position){
  const place={x:Math.max(0,drag.position.x+dx/state.z),y:Math.max(0,drag.position.y+dy/state.z)};
  state.layout.set(drag.id,place);
  drag.card.style.left=place.x+'px';drag.card.style.top=place.y+'px';
  const note=state.notes.find(n=>n.id===drag.id);
  if(note)note.position=place;
  else{
   state.positions[storePositionsKey()]??={};
   state.positions[storePositionsKey()][drag.id]=place;
  }
  drawEdges();drawMini();
 }else{
  pan(event.clientX-drag.lastX,event.clientY-drag.lastY);
  drag.lastX=event.clientX;drag.lastY=event.clientY;
 }
});
function finishPointer(event){
 if(!pointers.delete(event.pointerId))return;
 const lastDrag=drag,wasPinch=Boolean(pinch);
 if(lastDrag?.moved&&lastDrag.position){placement(state.shown);persist();drawEdges();drawMini();}
 pinch=null;
 if(pointers.size){
  const remaining=pointers.values().next().value;
  drag={startX:remaining.x,startY:remaining.y,lastX:remaining.x,lastY:remaining.y,moved:true};
  return;
 }
 drag=null;
 viewport.classList.remove('grabbing');
 if(event.type==='pointerup'&&!wasPinch&&lastDrag?.id&&!lastDrag.moved)openDetails(lastDrag.id,lastDrag.card);
}
for(const type of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(type,finishPointer);
viewport.addEventListener('wheel',event=>{
 event.preventDefault();
 const unit=event.deltaMode===1?18:event.deltaMode===2?viewport.clientHeight:1;
 const dx=event.deltaX*unit,dy=event.deltaY*unit;
 if(event.ctrlKey||event.metaKey){
  const bounds=viewport.getBoundingClientRect();
  zoom(state.z*Math.exp(-Math.max(-150,Math.min(150,dy))*.0025),event.clientX-bounds.left,event.clientY-bounds.top);
 }else if(event.shiftKey&&!dx)pan(-dy,0);
 else pan(-dx,-dy);
},{passive:false});
document.addEventListener('click',event=>{
 const button=event.target.closest('button');
 if(!button)return;
 if(button.dataset.select){openDetails(button.dataset.select,button);return;}
 if(button.dataset.showOnMap){showOnMap(button.dataset.showOnMap);return;}
 if(button.dataset.trace){
  state.trace=button.dataset.trace;state.impact=false;
  if(['changes','software'].includes(state.view))state.view='flows';
  render();inspect(state.selected);return;
 }
 if(button.dataset.deleteNote){
  state.notes=state.notes.filter(n=>n.id!==button.dataset.deleteNote);
  closeDetails();state.selected=null;persist();render();return;
 }
 if(button.closest('#views')){
  closeDetails(false);closeControls();
  state.view=button.dataset.view;state.expanded=null;state.trace=null;state.impact=false;
  render();return;
 }
 if(button.id==='simulate'){state.trace='down';state.impact=!state.impact;state.view='flows';render();inspect(state.selected);}
 if(button.id==='compare-upload')$('import-board').click();
 if(button.id==='refresh-content')refreshContent();
});
$('nodes').addEventListener('click',event=>{
 if(event.detail!==0)return;
 const card=event.target.closest('[data-node]');
 if(card)openDetails(card.dataset.node,card);
});
$('zoom-in').onclick=()=>zoom(state.z*1.25);
$('zoom-out').onclick=()=>zoom(state.z/1.25);
$('fit').onclick=fit;
$('mini-wrap').onclick=event=>{
 if(!event.detail){fit();return;}
 const box=$('minimap').getBoundingClientRect();
 const x=Math.max(0,Math.min(1,(event.clientX-box.left)/box.width));
 const y=Math.max(0,Math.min(1,(event.clientY-box.top)/box.height));
 state.x=viewport.clientWidth/2-x*state.bounds.w*state.z;
 state.y=viewport.clientHeight/2-y*state.bounds.h*state.z;
 updateTransform();
};
$('arrange-map').onclick=()=>{
 arranging=!arranging;
 viewport.classList.toggle('arranging',arranging);
 $('arrange-map').setAttribute('aria-pressed',String(arranging));
};
$('details-back').onclick=()=>{
 const previous=detailHistory.pop();
 if(previous){inspect(previous.id);restoreDetailPosition(previous);$('inspector').focus({preventScroll:true});}
};
$('show-list').onclick=()=>{state.list=!state.list;$('show-list').setAttribute('aria-pressed',String(state.list));$('list-panel').hidden=!state.list;if(state.list)$('list-panel').innerHTML=listHTML();};
$('reset-layout').onclick=()=>{delete state.positions[storePositionsKey()];state.expanded=null;state.trace=null;state.impact=false;persist();render();};
$('layers-menu').onclick=()=>{const open=document.querySelector('.atlas-sidebar').classList.toggle('controls-open');$('layers-menu').setAttribute('aria-expanded',String(open));};
$('refresh-reports').onclick=()=>refreshContent();
$('close-inspector').onclick=()=>closeDetails();
for(const id of ['navigation','data','reference','labels'])$('layer-'+id).onchange=()=>{if(id==='reference')render(false);else drawEdges();if(state.selected&&$('inspector').classList.contains('open'))inspect(state.selected,true);};$('layer-grid').onchange=()=>$('viewport').classList.toggle('no-grid',!$('layer-grid').checked);
$('font-size').oninput=e=>{state.font=Number(e.target.value);$('font-output').textContent=state.font+'%';document.documentElement.style.setProperty('--font-scale',state.font/100);persist();};
function theme(){state.light=true;document.documentElement.classList.add('light');document.documentElement.style.colorScheme='light';drawMini();}
$('help-button').onclick=()=>$('help').showModal();$('close-help').onclick=()=>$('help').close();$('add-note').onclick=()=>{$('note-text').value='';$('note-dialog').showModal();$('note-text').focus();};$('cancel-note').onclick=()=>$('note-dialog').close();$('save-note').onclick=()=>{const text=$('note-text').value.trim();if(!text)return;const v=$('viewport'),p={x:Math.max(20,(v.clientWidth/2-state.x)/state.z),y:Math.max(40,(v.clientHeight/2-state.y)/state.z)};state.notes.push({id:'note:'+Date.now(),title:text,type:'note',view:['changes','software'].includes(state.view)?'overview':state.view,position:p});if(['changes','software'].includes(state.view))state.view='overview';$('note-dialog').close();persist();render(false);toast('Note saved locally. Export your board for a portable backup.');};
$('export-board').onclick=()=>{download({...graph,board:{notes:state.notes,positions:state.positions,font:state.font,light:state.light}},'market-intel-'+graph.audience+'-blueprint-'+new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Singapore',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())+'.json');toast('Board exported. Local notes are included in the file you chose to save.');};
$('import-board').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>10e6)throw Error();const old=JSON.parse(await f.text());if(old.schema_version!==1||!Array.isArray(old.nodes)||!Array.isArray(old.edges)||old.nodes.length>15000)throw Error();compare(old);if(old.board){const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.y>=0&&p.x<50000&&p.y<50000;state.notes=Array.isArray(old.board.notes)?old.board.notes.filter(n=>typeof n.id==='string'&&n.id.startsWith('note:')&&typeof n.title==='string'&&n.title.length<=2000&&finite(n.position)).slice(0,100).map(n=>({id:n.id,title:n.title,type:'note',view:['overview','pages','flows'].includes(n.view)?n.view:'overview',position:n.position})):[];const pos={};for(const [view,entries]of Object.entries(old.board.positions||{}).slice(0,300)){if(!entries||typeof entries!=='object')continue;pos[view]={};for(const [id,p]of Object.entries(entries).slice(0,3000))if(byId.has(id)&&finite(p))pos[view][id]={x:p.x,y:p.y};}state.positions=pos;persist();}state.view='changes';state.trace=null;render();toast('Snapshot comparison ready. No website or schedule was modified.');}catch{toast('This file is not a supported blueprint snapshot. The current board is unchanged.');}e.target.value='';};
$('map-search').oninput=()=>{const q=$('map-search').value.trim().toLowerCase();$('search-results').innerHTML=q?graph.nodes.filter(n=>[n.title,n.description,n.path,n.schedule].join(' ').toLowerCase().includes(q)).slice(0,25).map(n=>`<button data-select="${E(n.id)}">${E(n.title)}<small>${E(n.type)} · ${E(n.group)}</small></button>`).join('')||'<p class="fine">No matching node. Try a broader term.</p>':'';if(state.list)$('list-panel').innerHTML=listHTML();};
document.addEventListener('keydown',event=>{
 if(document.querySelector('dialog[open]'))return;
 if(event.key==='Escape'){
  if(closeDetails())return;
  if(state.trace||state.impact){state.trace=null;state.impact=false;render(false);}
  return;
 }
 if(/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)||event.ctrlKey||event.metaKey||event.altKey)return;
 if(event.key==='/'){event.preventDefault();$('map-search').focus();return;}
 if(!viewport.contains(event.target))return;
 if(event.key==='+'||event.key==='='){event.preventDefault();zoom(state.z*1.2);}
 if(event.key==='-'){event.preventDefault();zoom(state.z/1.2);}
 if(event.key==='Home'){event.preventDefault();fit();}
 const steps={ArrowLeft:[65,0],ArrowRight:[-65,0],ArrowUp:[0,65],ArrowDown:[0,-65]};
 if(Object.hasOwn(steps,event.key)){event.preventDefault();pan(...steps[event.key]);}
});
new ResizeObserver(()=>{if(viewport.clientWidth&&viewport.clientHeight)updateMiniViewport();}).observe(viewport);
document.querySelectorAll('#views button').forEach(button=>{const label=button.querySelector('span')?.textContent;if(label){button.setAttribute('aria-label',label);button.title=label;}});
$('snapshot-status').textContent=graph.coverage.html_pages+' pages · '+graph.coverage.v4_routes+' views · Built '+sgt(graph.built_at);if(graph.refresh?.architecture)$('refresh-guide').textContent='Website structure: '+graph.refresh.architecture.summary+'. The map is rebuilt by the existing Hub publishing process; open the latest page after a release. Research links are checked on opening online or with Refresh report links. Private automation schedules are not inspected by the public build.';$('audience').textContent=graph.audience==='owner'?'PRIVATE OWNER BLUEPRINT':'PUBLIC BLUEPRINT';$('source-revision').textContent='SOURCE '+(graph.revision||'unavailable').slice(0,8)+' · '+graph.edges.length+' relationships';$('font-size').value=state.font;$('font-output').textContent=state.font+'%';document.documentElement.style.setProperty('--font-scale',state.font/100);theme();render();updateRefreshStatus();if(location.protocol==='https:'||location.protocol==='http:')refreshContent(true);
})();
