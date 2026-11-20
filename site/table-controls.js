/* Progressive table display controls. Width and order preferences are browser-local. */
(function(root){
 'use strict';
 const missing=/^(?:|[—–-]|n\/?a|unavailable|null|not available)$/i;
 const collator=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
 function scalar(raw){
  const text=String(raw??'').replace(/\u2212/g,'-').replace(/\u00a0/g,' ').trim();
  if(missing.test(text))return null;
  const match=text.match(/^([+-]?)(?:(US\$|S\$|A\$|C\$|NT\$|\$|USD|SGD|CHF|EUR|GBP)\s*)?([+-]?)(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\.\d+)\s*(%|bp|bps|years?|yrs?|months?|x)?$/i);
  if(!match||match[1]&&match[3])return undefined;
  const value=Number((match[1]||match[3])+match[4].replace(/,/g,''));
  return Number.isFinite(value)?{value,unit:(match[2]||'')+(match[5]||'').toLowerCase(),text}:undefined;
 }
 function dateValue(text){
  if(!/^\d{4}-\d{2}(?:-\d{2})?$/.test(text)&&!/^\d{1,2}[ -][A-Za-z]{3}[ -]\d{4}$/.test(text))return null;
  const n=Date.parse(text.length===7?text+'-01':text);return Number.isFinite(n)?n:null;
 }
 function profile(values,header={}){
  const nonmissing=values.filter(v=>!missing.test(v.trim())),parsed=nonmissing.map(scalar),units=new Set(parsed.filter(Boolean).map(x=>x.unit));
  const identifier=/\b(isin|cusip|identifier|security code|source row|moa)\b/i.test(header.label||'');
  const numeric=!identifier&&header.kind!=='mixed'&&nonmissing.length>0&&parsed.every(Boolean)&&units.size===1;
  const unit=header.unit||[...units][0]||'';
  const percent=numeric&&header.kind==='signed-change'&&unit==='%'&&parsed.every(x=>x.unit===''||x.unit==='%');
  return {change:numeric&&header.kind==='signed-change',type:numeric?'number':nonmissing.length&&nonmissing.every(x=>dateValue(x)!==null)?'date':'text',unit,numeric,percent};
 }
 function compare(a,b,type,descending=false){
  const missingA=missing.test(a.trim()),missingB=missing.test(b.trim());
  if(missingA||missingB)return missingA===missingB?0:missingA?1:-1;
  const x=type==='number'?scalar(a)?.value:type==='date'?dateValue(a):a;
  const y=type==='number'?scalar(b)?.value:type==='date'?dateValue(b):b;
  const result=type==='text'?collator.compare(x,y):(x??0)-(y??0);return descending?-result:result;
 }
 function heatBand(value,min,max){return !Number.isFinite(value)?null:max===min?2:Math.min(4,Math.max(0,Math.floor((value-min)/(max-min)*5)));}
 if(typeof module!=='undefined'&&module.exports){module.exports={scalar,profile,compare,heatBand};return;}
 const doc=root.document;if(!doc||root.MarketTableControls)return;
 const states=new WeakMap(),live=new Set(),pending=new Set();let observer,frame=0,dialog,active,trigger,serial=0;
 const sourceCells=new WeakMap(),minWidth=96,maxWidth=960;
 const observation={childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['hidden','data-table-controls']};
 const own=node=>node?.nodeType===1&&(node.matches('[data-tc-ui]')||node.closest('[data-tc-ui]'));
 function ingest(records){for(const record of records){if(own(record.target))continue;const table=record.target.nodeType===1?record.target.closest('table'):record.target.parentElement?.closest('table');if(table)pending.add(table);if(record.type==='attributes'&&record.attributeName==='data-table-controls')record.target.querySelectorAll('table').forEach(t=>pending.add(t));for(const node of record.addedNodes||[]){if(node.nodeType!==1||own(node))continue;if(node.matches('table'))pending.add(node);node.querySelectorAll('table').forEach(t=>pending.add(t));}}if(records.length)schedule();}
 function mutate(fn){if(observer){ingest(observer.takeRecords());observer.disconnect();}try{return fn();}finally{observer?.observe(doc.body,observation);}}
 function schedule(){if(!frame)frame=root.requestAnimationFrame(()=>{frame=0;mutate(()=>{for(const state of live)if(!state.table.isConnected){live.delete(state);state.status.remove();}if(active&&(!active.state.table.isConnected||!trigger?.isConnected))close();const tables=[...pending];pending.clear();tables.forEach(mount);});});}
 function sourceText(cell){if(!cell)return '';return (cell.dataset.tcValue??cell.querySelector('[data-tc-original]')?.textContent??cell.textContent).replace(/\s+/g,' ').trim();}
 function cells(row){
  const prior=sourceCells.get(row);
  if(prior&&prior.length===row.cells.length&&prior.every(cell=>cell.parentElement===row))return prior;
  sourceCells.delete(row);
  return [...row.cells];
 }
 function at(row,index){return sourceCells.get(row)?.[index]??row.cells[index];}
 function columnLabel(cell){
  const clone=cell.cloneNode(true);clone.querySelectorAll('[data-tc-ui]').forEach(node=>node.remove());
  return clone.textContent.replace(/\s+/g,' ').trim()||'Column '+(cell.cellIndex+1);
 }
 function layoutFor(state){
  const {table,model}=state;
  if(!table.tHead||table.tHead.rows.length!==1||model.columns.length!==model.count||model.count<2
    ||table.querySelector('colgroup:not([data-tc-ui])')||model.merged)return null;
  const header=table.tHead.rows[0],rows=[...table.rows],columns=cells(header);
  const entries=rows.map(row=>[row,cells(row)]);
  if(!entries.every(([,items])=>items.length===model.count&&items.every(cell=>cell.colSpan===1&&cell.rowSpan===1)
    ||items.length===1&&items[0].colSpan===model.count&&items[0].rowSpan===1))return null;
  const labels=columns.map(cell=>cell.dataset.tcKey||columnLabel(cell));
  if(new Set(labels).size!==labels.length)return null;
  const owner=table.parentElement.closest('[id]');
  // An ambiguous anonymous table can still be customised for the current view.
  const identity=table.dataset.tcLayout||table.id||(owner?.id&&owner.querySelectorAll('table').length===1?owner.id:'');
  const key=identity?'mih:table-layout:1:'+JSON.stringify([root.location.pathname,identity,labels]):'';
  let saved;
  if(state.layout?.key===key&&state.layout.labels.every((label,index)=>label===labels[index])&&state.layout.labels.length===labels.length)saved=state.layout;
  else if(key)try{saved=JSON.parse(root.localStorage.getItem(key));}catch{}
  const indices=columns.map((_,index)=>index);
  // Keep the existing row identifier at the leading edge when it is a row heading.
  const pinned=table.dataset.tcPinFirst!==undefined||model.rows.some(row=>at(row,0)?.tagName==='TH');
  let order=saved?.order;
  if(!Array.isArray(order)||order.length!==indices.length||new Set(order).size!==indices.length
    ||!order.every(index=>indices.includes(index))||(pinned&&order[0]!==0))order=indices;
  const widths=Array.isArray(saved?.widths)?indices.map(index=>{
    const width=saved.widths[index];return Number.isFinite(width)&&width>=minWidth&&width<=maxWidth?width:null;
  }):indices.map(()=>null);
  for(const [row,items]of entries)if(items.length===indices.length)sourceCells.set(row,items);
  return {key,labels,order,widths,pinned,rows:entries.filter(([,items])=>items.length===indices.length)};
 }
 function drawLayout(state){
  const {table,layout}=state;
  let group=table.querySelector(':scope > colgroup[data-tc-ui]');
  if(!layout){group?.remove();table.style.removeProperty('--tc-width');table.removeAttribute('data-tc-sized');return;}
  for(const [row,items]of layout.rows){
   let previous=null;
   for(const index of layout.order){
    const cell=items[index],next=previous?previous.nextElementSibling:row.firstElementChild;
    if(cell!==next)row.insertBefore(cell,next);
    previous=cell;
   }
  }
  const sized=layout.widths.some(Number.isFinite);
  table.toggleAttribute('data-tc-sized',sized);
  if(!sized){group?.remove();table.style.removeProperty('--tc-width');return;}
  const beforeGroup=table.tHead;
  if(!group){group=doc.createElement('colgroup');group.dataset.tcUi='';table.insertBefore(group,beforeGroup);}
  const width=layout.order.map(index=>layout.widths[index]||minWidth);
  if(group.children.length!==width.length)group.replaceChildren(...width.map(()=>doc.createElement('col')));
  width.forEach((value,index)=>{group.children[index].style.width=value+'px';});
  table.style.setProperty('--tc-width',width.reduce((sum,value)=>sum+value,0)+'px');
 }
 function saveLayout(state){
  const {key,order,widths}=state.layout;
  if(key)try{root.localStorage.setItem(key,JSON.stringify({order,widths}));}catch{}
 }
 function resizeColumn(state,index,value){
  const {layout}=state;
  if(!layout.widths.some(Number.isFinite))layout.widths=layout.widths.map((_,i)=>Math.max(minWidth,
    Math.min(maxWidth,Math.round(state.configs.get(i).header.getBoundingClientRect().width))));
  layout.widths[index]=Math.max(minWidth,Math.min(maxWidth,Math.round(value)));
  drawLayout(state);
 }
 function addResizeHandle(state,index,cell){
  if(cell.querySelector('[data-tc-grip]'))return;
  if(root.getComputedStyle(cell).position==='static')cell.classList.add('tc-grip-anchor');
  const grip=doc.createElement('span');grip.dataset.tcUi='';grip.dataset.tcGrip='';grip.setAttribute('aria-hidden','true');
  grip.title='Drag to resize column';cell.append(grip);
  grip.addEventListener('pointerdown',event=>{
   if(event.button!==0||!state.layout)return;
   event.preventDefault();event.stopPropagation();
   const start=event.clientX,width=cell.getBoundingClientRect().width;
   grip.setPointerCapture(event.pointerId);
   const move=next=>{if(Math.abs(next.clientX-start)>2)mutate(()=>resizeColumn(state,index,width+next.clientX-start));};
   grip.addEventListener('pointermove',move);
   grip.addEventListener('lostpointercapture',()=>{grip.removeEventListener('pointermove',move);if(state.layout)saveLayout(state);},{once:true});
  });
 }
 function dataRow(row,count){return cells(row).length===count&&cells(row).every(cell=>cell.colSpan===1&&cell.rowSpan===1)&&!row.matches('[data-table-static],.ust-group-row')&&!/^\s*(?:grand )?total\s*$/i.test(cells(row)[0]?.textContent||'');}
 function model(table){
  const header=table.tHead;if(!header)return null;
  const rows=[...header.rows],grid=[],columns=[];
  for(let y=0;y<rows.length;y++){grid[y]??=[];let x=0;for(const cell of cells(rows[y])){while(grid[y][x])x++;for(let dy=0;dy<cell.rowSpan;dy++){grid[y+dy]??=[];for(let dx=0;dx<cell.colSpan;dx++)grid[y+dy][x+dx]=cell;}x+=cell.colSpan;}}
  const leaf=grid[grid.length-1]||[];leaf.forEach((cell,index)=>{if(cell?.tagName==='TH'&&cell.colSpan===1&&!cell.hasAttribute('data-tc-skip'))columns.push({cell,index});});
  return {count:leaf.length,columns,rows:[...table.tBodies].flatMap(body=>[...body.rows]),merged:[...table.tBodies].some(body=>[...body.rows].some(row=>cells(row).some(c=>c.rowSpan>1)))};
 }
 // Article comparisons are reading aids, not spreadsheet workspaces. Count all
 // loaded rows (including hidden ones), so filtering never removes its own menu.
 function smallArticleTable(table,structure){
  return table.dataset.tableControls!=='on'&&table.closest('article, .sr-report-body, [data-research-article]')&&structure.rows.filter(row=>dataRow(row,structure.count)).length<=8;
 }
 function unmount(table){
  const state=states.get(table);if(!state)return;
  if(active?.state===state){close();active=null;trigger=null;}
  state.rows=state.rows.filter(row=>dataRow(row,state.model.count));
  state.sort=null;state.restoreOrder=true;state.focus=null;
  for(const config of state.configs.values())Object.assign(config,{filter:'',heat:false,bold:false,font:'original',percent:false});
  apply(state,false);
  if(state.layout){state.layout.order=state.layout.labels.map((_,index)=>index);state.layout.widths=[];drawLayout(state);}
  table.querySelectorAll('[data-tc-button],[data-tc-grip]').forEach(control=>control.remove());
  table.querySelectorAll('.tc-filtered,.tc-heat,.tc-focus,[data-tc-font],[data-tc-band]').forEach(node=>{node.classList.remove('tc-filtered','tc-heat','tc-focus');delete node.dataset.tcFont;delete node.dataset.tcBand;delete node.dataset.tcScale;});
  table.querySelectorAll('[data-tc-original]').forEach(original=>{original.parentElement.querySelector('[data-tc-formatted]')?.remove();while(original.firstChild)original.before(original.firstChild);original.remove();});
  table.classList.remove('tc-table');state.status.remove();live.delete(state);states.delete(table);
 }
 function mount(table){
  if(!table.isConnected)return;
  const structure=model(table);
  if(table.closest('[data-table-controls="off"], [role="presentation"]')||!structure?.columns.length||smallArticleTable(table,structure)){unmount(table);return;}
  let state=states.get(table);
  if(!state){const status=doc.createElement('p');status.className='tc-status';status.dataset.tcUi='';status.setAttribute('role','status');status.setAttribute('aria-live','polite');table.after(status);state={table,status,configs:new Map(),order:new WeakMap(),next:0,sort:null,focus:null,restoreOrder:false};states.set(table,state);live.add(state);table.classList.add('tc-table');}
  const indices=new Set(structure.columns.map(c=>c.index));for(const index of state.configs.keys())if(!indices.has(index))state.configs.delete(index);if(state.sort&&!indices.has(state.sort.index))state.sort=null;if(!indices.has(state.focus))state.focus=null;
  state.model=structure;state.rows=structure.rows.filter(row=>dataRow(row,structure.count));
  const layout=layoutFor(state);
  if(!layout&&state.layout){state.layout.order=state.layout.labels.map((_,index)=>index);state.layout.widths=[];drawLayout(state);}
  state.layout=layout;
  state.fixedRows=structure.merged||table.hasAttribute('data-tc-fixed-rows');
  state.rows.forEach(row=>{if(!state.order.has(row))state.order.set(row,state.next++);});
  for(const {cell,index} of structure.columns){
   let button=[...cell.children].find(c=>c.hasAttribute('data-tc-button'));
   if(!button){button=doc.createElement('button');button.type='button';button.className='tc-column-button';button.dataset.tcUi='';button.dataset.tcButton='';button.innerHTML='<svg class="tc-triangle" viewBox="0 0 12 8" aria-hidden="true" focusable="false"><path d="M1.5 1.5h9L6 6.5z"/></svg>';button.setAttribute('aria-haspopup','dialog');button.addEventListener('click',event=>{event.stopPropagation();open(state,index,button);});button.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();event.stopPropagation();open(state,index,button);}});cell.append(button);}
   if(layout)addResizeHandle(state,index,cell);else cell.querySelector('[data-tc-grip]')?.remove();
   const label=columnLabel(cell);
   button.setAttribute('aria-label','Column options: '+label);button.title='Column options: '+label;
   const previous=state.configs.get(index)||{filter:'',heat:cell.hasAttribute('data-tc-default-heat'),font:'original',percent:false};
   const values=state.rows.map(row=>sourceText(at(row,index))),info=profile(values,{label,kind:cell.dataset.tableKind,unit:cell.dataset.tableUnit});
   state.configs.set(index,{...previous,label,header:cell,button,info,originalSort:previous.header===cell?previous.originalSort:cell.getAttribute('aria-sort')});
  }
  if(state.fixedRows){state.sort=null;for(const config of state.configs.values())config.filter='';}
  drawLayout(state);
  const scroll=table.parentElement;if(scroll&&/(auto|scroll)/.test(root.getComputedStyle(scroll).overflowX)&&!scroll.hasAttribute('tabindex')){scroll.tabIndex=0;if(!scroll.hasAttribute('role'))scroll.setAttribute('role','region');if(!scroll.hasAttribute('aria-label'))scroll.setAttribute('aria-label',(table.caption?.textContent.trim()||'Data table')+'; scroll horizontally');}
  apply(state,Boolean(state.status.textContent));
  if(active?.state===state){if(!state.configs.has(active.index))close();else sync();}
 }
 function apply(state,announce=true){
  const {table,rows}=state;
  for(const [index,config]of state.configs){
   const values=rows.map(row=>scalar(sourceText(at(row,index)))?.value).filter(Number.isFinite),min=values.length?Math.min(...values):0,max=values.length?Math.max(...values):0;
   config.range={min,max};const heat=config.heat&&config.info.numeric;if(!config.info.percent)config.percent=false;
   config.button.dataset.active=String(!!(config.filter||heat||config.bold||config.font!=='original'||config.percent||state.focus===index||state.sort?.index===index));
   for(const row of rows){const cell=at(row,index);const raw=sourceText(cell),value=scalar(raw)?.value;
    cell.classList.toggle('tc-bold',!!config.bold);
    cell.classList.toggle('tc-heat',heat&&Number.isFinite(value));cell.classList.toggle('tc-focus',state.focus===index);
    if(heat&&Number.isFinite(value)){const bound=Math.max(Math.abs(min),Math.abs(max));cell.dataset.tcBand=String(heatBand(value,config.info.change?-bound:min,config.info.change?bound:max));cell.dataset.tcScale=config.info.change?'change':'level';}else{delete cell.dataset.tcBand;delete cell.dataset.tcScale;}
    if(config.font==='original')delete cell.dataset.tcFont;else cell.dataset.tcFont=config.font;
    let original=cell.querySelector('[data-tc-original]'),formatted=cell.querySelector('[data-tc-formatted]');
    // Only explicitly typed, plain scalar percentage changes may be reformatted.
    const plain=original||[...cell.childNodes].every(n=>n.nodeType===3);
    if(config.percent&&Number.isFinite(value)&&plain){if(!original){original=doc.createElement('span');original.dataset.tcOriginal='';while(cell.firstChild)original.append(cell.firstChild);cell.append(original);formatted=doc.createElement('span');formatted.dataset.tcFormatted='';cell.append(formatted);}original.hidden=true;formatted.textContent=(value>0?'+':'')+raw.replace(/^[+]/,'').replace(/%$/,'')+'%';}
    else if(original){original.hidden=false;formatted?.remove();while(original.firstChild)cell.insertBefore(original.firstChild,original);original.remove();}
   }
   config.header.classList.toggle('tc-focus',state.focus===index);
   if(state.sort?.index===index)config.header.setAttribute('aria-sort',state.sort.descending?'descending':'ascending');else if(config.header.hasAttribute('data-tc-own-sort')){if(config.originalSort)config.header.setAttribute('aria-sort',config.originalSort);else config.header.removeAttribute('aria-sort');delete config.header.dataset.tcOwnSort;}
   if(state.sort?.index===index)config.header.dataset.tcOwnSort='';
  }
  for(const row of rows){const filtered=[...state.configs].some(([index,c])=>c.filter&&!sourceText(at(row,index)).toLocaleLowerCase().includes(c.filter.toLocaleLowerCase()));row.classList.toggle('tc-filtered',filtered);}
  // Never move spanning rows or totals, or reorder across row groups.
  if(!state.fixedRows&&(state.sort||state.restoreOrder)){const dataRows=new Set(rows);for(const body of table.tBodies){let segment=[];const flush=()=>{if(segment.length){const anchor=segment[segment.length-1].nextSibling;segment.sort((a,b)=>state.sort?(compare(sourceText(at(a,state.sort.index)),sourceText(at(b,state.sort.index)),state.configs.get(state.sort.index).info.type,state.sort.descending)||state.order.get(a)-state.order.get(b)):state.order.get(a)-state.order.get(b));const fragment=doc.createDocumentFragment();segment.forEach(row=>fragment.append(row));body.insertBefore(fragment,anchor);segment=[];}};for(const row of [...body.rows]){if(dataRows.has(row))segment.push(row);else flush();}flush();}state.restoreOrder=false;}
  if(announce){const matching=rows.filter(r=>!r.classList.contains('tc-filtered')&&!r.hidden).length;state.status.textContent=matching+' of '+rows.length+' loaded data rows match. Changes apply to this rendered table only.';}
 }
 function createDialog(){
  dialog=doc.createElement('dialog');dialog.id='tc-dialog';dialog.className='tc-dialog';dialog.dataset.tcUi='';dialog.setAttribute('aria-labelledby','tc-title');
  dialog.innerHTML='<form method="dialog"><header><h2 id="tc-title">Column options</h2><button value="close" aria-label="Close column options">✕</button></header></form>'
   + '<div id="tc-layout" class="tc-layout" role="group" aria-label="Column layout"><div class="tc-layout-actions"><button type="button" data-tc-move="-1">Move left</button><button type="button" data-tc-move="1">Move right</button>'
   + '<label>Width (px)<input type="number" id="tc-width" min="96" max="960" step="1"></label></div><p id="tc-layout-note" class="tc-hint" role="status"></p></div>'
   + '<p class="tc-hint">Sort and filter apply to loaded rows within their existing groups. Source values and totals stay as published.</p>'
   + '<div class="tc-sort"><button type="button" data-tc-sort="asc">Sort ascending ↑</button><button type="button" data-tc-sort="desc">Sort descending ↓</button><button type="button" data-tc-sort="none">Original row order</button></div>'
   + '<p id="tc-structure" class="tc-hint"></p><label>Filter this column<input id="tc-filter" type="search" maxlength="300" autocomplete="off" placeholder="Contains text…"></label>'
   + '<label class="tc-check"><input id="tc-heat" type="checkbox">Apply heat scale</label><p id="tc-heat-note" class="tc-hint"></p>'
   + '<label class="tc-check"><input id="tc-bold" type="checkbox">Bold this column</label>'
   + '<label>Apply font color<select id="tc-font"><option value="original">Original colors</option><option value="blue">Blue</option><option value="purple">Purple</option><option value="teal">Teal</option></select></label>'
   + '<label class="tc-check"><input id="tc-focus" type="checkbox">Focus this column</label><label class="tc-check" id="tc-percent-label" hidden><input id="tc-percent" type="checkbox">Signed percent display (+ / −)</label>'
   + '<footer><button type="button" id="tc-reset">Reset this column</button><button type="button" id="tc-reset-table">Reset table controls</button><button type="button" id="tc-done">Done</button></footer>';
  doc.body.append(dialog);dialog.addEventListener('close',()=>{active=null;trigger?.focus({preventScroll:true});trigger=null;});
  dialog.addEventListener('click',event=>{const button=event.target.closest('button');if(!active||!button)return;const {state,index}=active,config=state.configs.get(index);
   if(button.hasAttribute('data-tc-move')){
    const {order}=state.layout,from=order.indexOf(index),to=from+Number(button.dataset.tcMove);
    [order[from],order[to]]=[order[to],order[from]];
    mutate(()=>drawLayout(state));saveLayout(state);sync();
    if(button.disabled)dialog.querySelector('#tc-width').focus();
    return;
   }
   if(button.hasAttribute('data-tc-sort')){const direction=button.dataset.tcSort;state.restoreOrder=direction==='none';state.sort=direction==='none'?null:{index,descending:direction==='desc'};}
   else if(button.id==='tc-reset'){Object.assign(config,{filter:'',heat:config.header.hasAttribute('data-tc-default-heat'),bold:false,font:'original',percent:false});if(state.sort?.index===index){state.sort=null;state.restoreOrder=true;}if(state.focus===index)state.focus=null;}
   else if(button.id==='tc-reset-table'){
    state.sort=null;state.restoreOrder=true;state.focus=null;
    for(const c of state.configs.values())Object.assign(c,{filter:'',heat:c.header.hasAttribute('data-tc-default-heat'),bold:false,font:'original',percent:false});
    if(state.layout){
     state.layout.order=state.layout.labels.map((_,i)=>i);
     state.layout.widths=state.layout.order.map(()=>null);
     mutate(()=>drawLayout(state));saveLayout(state);
    }
   }
   else if(button.id==='tc-done'){close();return;}else return;
   mutate(()=>{apply(state);sync();});
  });
  dialog.addEventListener('input',event=>{if(!active||event.target.id!=='tc-filter')return;const {state,index}=active;state.configs.get(index).filter=event.target.value;mutate(()=>apply(state));});
  dialog.addEventListener('change',event=>{if(!active)return;const {state,index}=active,config=state.configs.get(index),target=event.target;
   if(target.id==='tc-width'){
    if(state.layout&&Number.isFinite(target.valueAsNumber)){mutate(()=>resizeColumn(state,index,target.valueAsNumber));saveLayout(state);}
    sync();return;
   }
   if(target.id==='tc-heat')config.heat=target.checked;else if(target.id==='tc-bold')config.bold=target.checked;else if(target.id==='tc-font')config.font=target.value;else if(target.id==='tc-focus')state.focus=target.checked?index:null;else if(target.id==='tc-percent')config.percent=target.checked;else return;
   mutate(()=>{apply(state);sync();});
  });
 }
 function sync(){if(!active)return;const {state,index}=active,config=state.configs.get(index),query=id=>dialog.querySelector('#'+id);query('tc-title').textContent=config.label+' · column options';
  const {layout}=state;
  query('tc-layout').hidden=!layout;
  if(layout){
   const position=layout.order.indexOf(index),first=layout.pinned?1:0;
   dialog.querySelector('[data-tc-move="-1"]').disabled=position<=first;
   dialog.querySelector('[data-tc-move="1"]').disabled=position<first||position===layout.order.length-1;
   query('tc-width').value=layout.widths[index]||Math.round(config.header.getBoundingClientRect().width)||minWidth;
   query('tc-layout-note').textContent='Column '+(position+1)+' of '+layout.order.length+'. '
    +(layout.pinned&&index===0?'Identifier stays first. ':'')
    +(layout.key?'Order and widths are saved in this browser.':'Layout applies to this view.');
  }
  query('tc-filter').value=config.filter;query('tc-filter').disabled=state.fixedRows;
  dialog.querySelectorAll('[data-tc-sort]').forEach(button=>{button.disabled=state.fixedRows;button.setAttribute('aria-pressed',String(button.dataset.tcSort==='none'?!state.sort:state.sort?.index===index&&state.sort.descending===(button.dataset.tcSort==='desc')));});
  query('tc-structure').textContent=state.fixedRows?'This table keeps its source row structure.':'';
  query('tc-heat').checked=config.heat&&config.info.numeric;query('tc-heat').disabled=!config.info.numeric;
  query('tc-bold').checked=!!config.bold;
  const bound=Math.max(Math.abs(config.range.min),Math.abs(config.range.max));query('tc-heat-note').textContent=config.info.numeric?(config.info.change?'Purple (negative) ← 0 → Blue (positive). Symmetric range: '+(-bound)+' to '+bound:'Low → high. Blue intensity shows magnitude. Range: '+config.range.min+' to '+config.range.max)+(config.info.unit?' '+config.info.unit:'')+'. Range uses all loaded rows before column filters. Colors do not show investment merit. Missing values are uncolored.':'Heat scale needs single numeric values with consistent units. Mixed text, identifiers and missing-only columns are not scaled.';
  query('tc-font').value=config.font;query('tc-focus').checked=state.focus===index;query('tc-percent-label').hidden=!config.info.percent;query('tc-percent').checked=config.percent;
 }
 function open(state,index,button){if(!dialog?.isConnected)createDialog();trigger=button;active={state,index};mutate(()=>{mount(state.table);sync();});if(!active||states.get(state.table)!==state)return;if(!dialog.open)dialog.showModal();dialog.querySelector('#tc-layout:not([hidden]) button:not([disabled]),#tc-layout:not([hidden]) input,[data-tc-sort="asc"]:not([disabled]),#tc-font')?.focus();}
 function close(){if(dialog?.open)dialog.close();}
 function refresh(scope=doc){mutate(()=>{if(scope.matches?.('table'))mount(scope);scope.querySelectorAll('table').forEach(mount);});}
 function start(){refresh();observer=new MutationObserver(ingest);observer.observe(doc.body,observation);}
 root.MarketTableControls={refresh};
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(typeof window!=='undefined'?window:globalThis);
