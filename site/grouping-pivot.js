/* Count-only grouping explorer. Full-source adapters, no mutation or financial aggregation. */
(function(root){
 'use strict';
 const MISSING='Not supplied',ALL='__all__',OTHER='__other__';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const collator=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
 const present=v=>v!==null&&v!==undefined&&v!=='';
 const number=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
 const fmt=v=>v!==0&&Math.abs(v)<1e-7?v.toExponential(5):new Intl.NumberFormat('en',{maximumFractionDigits:12}).format(v);
 function eligible(rows,columns){return rows>50&&columns>5;}
 function nice(n){if(!(n>0))return 1;const p=10**Math.floor(Math.log10(n)),f=n/p;return(f<=1?1:f<=2?2:f<=5?5:10)*p;}
 function ranges(values,unit=''){
  const ns=values.map(number).filter(v=>v!==null);if(!ns.length)return[];
  const min=ns.reduce((a,b)=>Math.min(a,b),Infinity),max=ns.reduce((a,b)=>Math.max(a,b),-Infinity);if(min===max)return[{key:'n0',label:fmt(min)+unit,low:min,high:max,last:true}];
  const step=nice((max/6)-(min/6)),start=Math.floor(min/step)*step,end=Math.ceil(max/step)*step,count=Math.max(1,Math.round(end/step-start/step));
  if(!Number.isFinite(start)||!Number.isFinite(end)||!Number.isFinite(count)||count>20)return[{key:'n0',label:fmt(min)+' to '+fmt(max)+unit,low:min,high:max,last:true}];
  return Array.from({length:count},(_,i)=>{const low=start+i*step,high=i===count-1?Math.max(max,start+(i+1)*step):start+(i+1)*step;return{key:'n'+i,label:fmt(low)+' to '+(i===count-1?'':'< ')+fmt(high)+unit,low,high,last:i===count-1};});
 }
 function order(a,b){const priority=x=>x==='SGD'?0:x==='AUD'?1:2;return priority(a)-priority(b)||collator.compare(a,b);}
 function dimension(field,source,limit=20){
  const get=field.value||((row)=>row[field.key]);
  if(field.type==='number'){
   const groups=ranges(source.map(get),field.unit||'');
   const classify=row=>{const v=number(get(row));return v===null?'missing':groups.find(g=>v>=g.low&&(g.last?v<=g.high:v<g.high))?.key||'missing';};
   if(source.some(row=>classify(row)==='missing'))groups.push({key:'missing',label:MISSING});
   return{...field,groups,classify};
  }
  const missingKey=Symbol('missing');
  const normal=row=>{const v=get(row);if(!present(v))return missingKey;if(field.type==='year'){const s=String(v);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s.slice(0,4):missingKey;}return String(v);};
  const counts=new Map();source.forEach(row=>{const v=normal(row);counts.set(v,(counts.get(v)||0)+1);});
  let labels=[...counts.keys()].filter(x=>x!==missingKey).sort(order),kept=new Set(labels);
  if(labels.length>limit){const top=labels.slice().sort((a,b)=>counts.get(b)-counts.get(a)||order(a,b)).slice(0,limit-1);kept=new Set(top);labels=top.sort(order);}
  const keys=new Map(labels.map((v,i)=>[v,'c'+i])),groups=labels.map(v=>({key:keys.get(v),label:v===MISSING?v+' (source label)':v}));
  if(kept.size<counts.size-(counts.has(missingKey)?1:0))groups.push({key:OTHER,label:'Other ('+([...counts.keys()].filter(v=>v!==missingKey&&!kept.has(v)).length)+' groups)'});
  if(counts.has(missingKey))groups.push({key:'missing',label:MISSING});
  return{...field,groups,classify:row=>{const v=normal(row);return v===missingKey?'missing':keys.get(v)||OTHER;}};
 }
 function countMatrix(rows,y,x){
  const counts=new Map(),rowTotals=new Map(),columnTotals=new Map();
  for(const row of rows){const a=y.classify(row),b=x?x.classify(row):ALL,key=JSON.stringify([a,b]);counts.set(key,(counts.get(key)||0)+1);rowTotals.set(a,(rowTotals.get(a)||0)+1);columnTotals.set(b,(columnTotals.get(b)||0)+1);}
  return{counts,rowTotals,columnTotals,total:rows.length};
 }
 function matches(row,filters,dimensions){return filters.every(f=>dimensions.get(f.field)?.classify(row)===f.group);}
 function cloneState(s){return{filters:s.filters.map(f=>({...f})),y:s.y,x:s.x,page:s.page,drilled:s.drilled};}
 const api={eligible,ranges,dimension,countMatrix,matches};
 if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}
 const doc=root.document;if(!doc||root.GroupingPivot)return;
 const states=new Map();let serial=0;
 function mount(target,config){
  if(typeof target==='string')target=doc.getElementById(target);if(!target)return;
  const source=config.sourceRows||config.rows||[];if(!eligible(source.length,config.columnCount)){target.replaceChildren();target.hidden=true;return;}
  target.hidden=false;const scope=config.rows||source,signature=String(config.version||'')+'|'+scope.map(config.rowId||((r,i)=>i)).sort().join('\x1f');
  let state=states.get(config.key);const changed=state&&state.signature!==signature;
  if(!state||changed){state={signature,filters:[],y:config.defaultY||config.fields[0].key,x:config.defaultX||config.fields[1]?.key||ALL,page:1,drilled:false,undo:[],open:!!config.open};states.set(config.key,state);}
  if(config.open)state.open=true;state.config=config;state.scope=scope;state.target=target;state.changed=changed;state.dimensions=new Map(config.fields.map(f=>[f.key,dimension(f,source,14)]));
  target.classList.add('gp-root');target.dataset.pivotUi='';target.dataset.tableControls='off';state.id=state.id||'gp-'+(++serial);render(state);
 }
 function options(state,value){return state.config.fields.map(f=>'<option value="'+esc(f.key)+'" '+(value===f.key?'selected':'')+'>'+esc(f.label)+(f.type==='number'?' · ranges':f.type==='year'?' · year':'')+'</option>').join('');}
 function snapshot(state){state.undo.push(cloneState(state));if(state.undo.length>30)state.undo.shift();}
 function suggestions(state){const used=new Set(state.filters.map(f=>f.field));const fields=state.config.fields.filter(f=>!used.has(f.key)&&state.dimensions.get(f.key).groups.length>1);return fields.length?fields:state.config.fields;}
 function rowsFor(state){return state.scope.filter(row=>matches(row,state.filters,state.dimensions));}
 function matrix(state,rows,yKey,xKey,original=false){
  const y=state.dimensions.get(yKey)||state.dimensions.values().next().value,x=xKey===ALL?null:state.dimensions.get(xKey),m=countMatrix(rows,y,x);
  const ys=y.groups.filter(g=>m.rowTotals.get(g.key)),xs=x?x.groups.filter(g=>m.columnTotals.get(g.key)):[{key:ALL,label:'Records'}];
  const cell=(value,yg,xg,total=false)=>value?'<button type="button" data-gp-cell data-y="'+esc(yg??'')+'" data-x="'+esc(xg??'')+'" data-y-field="'+esc(y.key)+'" data-x-field="'+esc(x?.key||ALL)+'" data-original="'+original+'" aria-label="'+esc((total?'Total, ':'')+(yg===undefined?'All '+y.label:y.groups.find(g=>g.key===yg)?.label)+', '+(xg===undefined?'all columns':xs.find(g=>g.key===xg)?.label)+': '+value+' source records')+'">'+value.toLocaleString('en')+'</button>':'';
  return'<div class="gp-scroll" tabindex="0" role="region" aria-label="'+(original?'Original master':'Working')+' grouping table; scroll horizontally"><table data-table-controls="off"><caption>'+esc(y.label)+' × '+esc(x?.label||'Record count')+' · source-record counts</caption><thead><tr><th scope="col">'+esc(y.label)+'</th>'+xs.map(g=>'<th scope="col">'+labelHTML(x,g.label)+'</th>').join('')+'<th scope="col">Total</th></tr></thead><tbody>'+ys.map(g=>'<tr><th scope="row">'+labelHTML(y,g.label)+'</th>'+xs.map(h=>'<td>'+cell(m.counts.get(JSON.stringify([g.key,h.key]))||0,g.key,h.key)+'</td>').join('')+'<td class="gp-total">'+cell(m.rowTotals.get(g.key),g.key,undefined,true)+'</td></tr>').join('')+'</tbody><tfoot><tr><th scope="row">Total</th>'+xs.map(h=>'<td>'+cell(m.columnTotals.get(h.key),undefined,h.key,true)+'</td>').join('')+'<td>'+cell(m.total,undefined,undefined,true)+'</td></tr></tfoot></table></div>';
 }
 function detail(state,rows){
  const columns=state.config.detailFields||state.config.fields.slice(0,6),pages=Math.max(1,Math.ceil(rows.length/30));state.page=Math.min(state.page,pages);const start=(state.page-1)*30,view=rows.slice(start,start+30);
  return'<section class="gp-matches" aria-label="Matching source records"><h4>Matching records <span>'+rows.length.toLocaleString('en')+'</span></h4><div class="gp-scroll" tabindex="0" role="region" aria-label="Matching source records; scroll horizontally"><table data-table-controls="off"><thead><tr>'+columns.map(f=>'<th scope="col">'+esc(f.label)+'</th>').join('')+'</tr></thead><tbody>'+view.map(row=>'<tr>'+columns.map(f=>{const v=(f.value||((r)=>r[f.key]))(row);return'<td>'+labelHTML(f,present(v)?typeof v==='number'?fmt(v):v:'—')+'</td>';}).join('')+'</tr>').join('')+'</tbody></table></div><div class="gp-pages"><button type="button" data-gp-page="-1" '+(state.page===1?'disabled':'')+'>Previous</button><span>'+ (rows.length?start+1:0)+'–'+Math.min(start+30,rows.length)+' of '+rows.length.toLocaleString('en')+'</span><button type="button" data-gp-page="1" '+(state.page===pages?'disabled':'')+'>Next</button></div></section>';
 }
 function labelHTML(field,value){
  if(!field?.segments)return esc(value);
  const parts=field.segments(value);if(!Array.isArray(parts))return esc(value);
  return parts.map(part=>{const colour=/^#[0-9a-f]{6}$/i.test(part.light||'')&&/^#[0-9a-f]{6}$/i.test(part.dark||'');return '<span'+(colour?' class="gp-semantic" style="--gp-label:'+part.light+';--gp-label-dark:'+part.dark+'"':'')+(part.title?' title="'+esc(part.title)+'"':'')+'>'+esc(part.text)+'</span>';}).join(' ');
 }
 function render(state,focusAction){
  const {target,config}=state,rows=rowsFor(state),active=state.filters.length||state.drilled||state.y!==config.defaultY||state.x!==config.defaultX;
  const crumbs=state.filters.map((f,i)=>'<button type="button" data-gp-crumb="'+i+'">'+esc(state.dimensions.get(f.field)?.label)+': '+esc(f.label)+' <span aria-hidden="true">×</span></button>').join('');
  target.innerHTML='<details class="gp-explorer" '+(state.open?'open':'')+'><summary>▦ Pivot explorer <span>'+esc(config.label)+' · '+state.scope.length.toLocaleString('en')+' records</span></summary><div class="gp-content"><p class="gp-note">Count source records, not portfolio value. Click any non-empty cell or total to narrow the records. The original grouping stays above.</p>'+(config.note?'<p class="gp-note">'+esc(config.note)+'</p>':'')+(state.changed?'<p role="status">Source or page filters changed. The explorer has reset to the new scope.</p>':'')+'<h4>Original master grouping</h4>'+matrix(state,state.scope,config.defaultY,config.defaultX,true)+'<div class="gp-trail" aria-label="Current grouping filters"><button type="button" data-gp-reset>All '+state.scope.length.toLocaleString('en')+'</button>'+crumbs+'</div><div class="gp-actions"><strong>Level '+state.filters.length+'</strong><button type="button" data-gp-undo '+(!state.undo.length?'disabled':'')+'>Undo</button><button type="button" data-gp-reset '+(!active?'disabled':'')+'>Reset</button><button type="button" data-gp-groups>Change groups</button></div><div class="gp-group-editor" hidden><label>Rows (Y)<select data-gp-y>'+options(state,state.y)+'</select></label><label>Columns (X)<select data-gp-x><option value="'+ALL+'" '+(state.x===ALL?'selected':'')+'>Record count</option>'+options(state,state.x)+'</select></label><button type="button" data-gp-swap>Swap</button><button type="button" data-gp-apply>Apply</button><button type="button" data-gp-cancel>Cancel</button><p class="gp-note">Numeric buckets use the full source range and stay fixed while drilling. Unreported values remain separate. Only record counts are aggregated.</p></div>'+(active?'<h4>Working grouping <span>'+rows.length.toLocaleString('en')+' records</span></h4>'+matrix(state,rows,state.y,state.x):'')+'<p class="gp-suggestions">Next groups: '+suggestions(state).slice(0,3).map(f=>esc(f.label)).join(' · ')+'</p><p class="gp-status" role="status" aria-live="polite">'+rows.length.toLocaleString('en')+' matching source records. Blank count cells mean zero; “Not supplied” means missing data.</p>'+detail(state,rows)+'</div></details>';
  target.querySelector('details').addEventListener('toggle',event=>{if(event.target.isConnected)state.open=event.target.open;});
  target.querySelectorAll('[data-gp-cell]').forEach(button=>button.addEventListener('click',()=>{
   snapshot(state);if(button.dataset.original==='true')state.filters=[];
   const pairs=[[button.dataset.yField,button.dataset.y],[button.dataset.xField,button.dataset.x]];
   for(const [field,group]of pairs){if(!group||field===ALL)continue;const d=state.dimensions.get(field),label=d.groups.find(g=>g.key===group)?.label;if(label!==undefined){state.filters=state.filters.filter(f=>f.field!==field);state.filters.push({field,group,label});}}
   const next=suggestions(state);state.y=next[0].key;state.x=next[1]?.key||ALL;state.page=1;state.drilled=true;state.open=true;render(state,'[data-gp-groups]');
  }));
  target.querySelectorAll('[data-gp-reset]').forEach(b=>b.addEventListener('click',()=>{snapshot(state);state.filters=[];state.y=config.defaultY;state.x=config.defaultX;state.page=1;state.drilled=false;render(state,'[data-gp-groups]');}));
  target.querySelector('[data-gp-undo]').addEventListener('click',()=>{const prior=state.undo.pop();if(prior){Object.assign(state,prior);render(state,'[data-gp-groups]');}});
  target.querySelectorAll('[data-gp-crumb]').forEach(b=>b.addEventListener('click',()=>{snapshot(state);state.filters=state.filters.slice(0,Number(b.dataset.gpCrumb));state.page=1;render(state,'[data-gp-groups]');}));
  const editor=target.querySelector('.gp-group-editor'),y=editor.querySelector('[data-gp-y]'),x=editor.querySelector('[data-gp-x]');
  target.querySelector('[data-gp-groups]').addEventListener('click',()=>{y.value=state.y;x.value=state.x;editor.hidden=false;y.focus();});
  editor.querySelector('[data-gp-cancel]').addEventListener('click',()=>{y.value=state.y;x.value=state.x;editor.hidden=true;target.querySelector('[data-gp-groups]').focus();});
  editor.querySelector('[data-gp-swap]').addEventListener('click',()=>{if(x.value===ALL)return;const old=y.value;y.value=x.value;x.value=old;});
  editor.addEventListener('keydown',event=>{if(event.key==='Escape'){y.value=state.y;x.value=state.x;editor.hidden=true;target.querySelector('[data-gp-groups]').focus();}});
  editor.querySelector('[data-gp-apply]').addEventListener('click',()=>{snapshot(state);state.y=y.value;state.x=x.value===y.value?ALL:x.value;state.page=1;state.drilled=true;render(state,'[data-gp-groups]');});
  target.querySelectorAll('[data-gp-page]').forEach(b=>b.addEventListener('click',()=>{state.page+=Number(b.dataset.gpPage);render(state,'.gp-matches h4');}));
  if(focusAction){const focus=target.querySelector(focusAction);if(focus){if(!focus.hasAttribute('tabindex')&&focus.tagName==='H4')focus.tabIndex=-1;focus.focus({preventScroll:true});}}
 }
 root.GroupingPivot={...api,mount};
})(typeof window!=='undefined'?window:globalThis);
