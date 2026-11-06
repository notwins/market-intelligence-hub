/* Progressive table display controls. Source files, application data and saved state are untouched. */
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
  const numeric=!identifier&&nonmissing.length>0&&parsed.every(Boolean)&&units.size===1;
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
 const observation={childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['hidden','data-table-controls']};
 const own=node=>node?.nodeType===1&&(node.matches('[data-tc-ui]')||node.closest('[data-tc-ui]'));
 function ingest(records){for(const record of records){if(own(record.target))continue;const table=record.target.nodeType===1?record.target.closest('table'):record.target.parentElement?.closest('table');if(table)pending.add(table);if(record.type==='attributes'&&record.attributeName==='data-table-controls')record.target.querySelectorAll('table').forEach(t=>pending.add(t));for(const node of record.addedNodes||[]){if(node.nodeType!==1||own(node))continue;if(node.matches('table'))pending.add(node);node.querySelectorAll('table').forEach(t=>pending.add(t));}}if(records.length)schedule();}
 function mutate(fn){if(observer){ingest(observer.takeRecords());observer.disconnect();}try{return fn();}finally{observer?.observe(doc.body,observation);}}
 function schedule(){if(!frame)frame=root.requestAnimationFrame(()=>{frame=0;mutate(()=>{for(const state of live)if(!state.table.isConnected){live.delete(state);state.status.remove();}if(active&&(!active.state.table.isConnected||!trigger?.isConnected))close();const tables=[...pending];pending.clear();tables.forEach(mount);});});}
 function sourceText(cell){if(!cell)return '';return (cell.dataset.tcValue??cell.querySelector('[data-tc-original]')?.textContent??cell.textContent).replace(/\s+/g,' ').trim();}
 function cells(row){return [...row.cells].filter(cell=>cell.closest('table')===row.closest('table'));}
 function dataRow(row,count){return cells(row).length===count&&cells(row).every(cell=>cell.colSpan===1&&cell.rowSpan===1)&&!row.matches('[data-table-static],.ust-group-row')&&!/^\s*(?:grand )?total\s*$/i.test(cells(row)[0]?.textContent||'');}
 function model(table){
  const header=table.tHead;if(!header)return null;
  const rows=[...header.rows],grid=[],columns=[];
  for(let y=0;y<rows.length;y++){grid[y]??=[];let x=0;for(const cell of cells(rows[y])){while(grid[y][x])x++;for(let dy=0;dy<cell.rowSpan;dy++){grid[y+dy]??=[];for(let dx=0;dx<cell.colSpan;dx++)grid[y+dy][x+dx]=cell;}x+=cell.colSpan;}}
  const leaf=grid[grid.length-1]||[];leaf.forEach((cell,index)=>{if(cell?.tagName==='TH'&&cell.colSpan===1)columns.push({cell,index});});
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
  for(const config of state.configs.values())Object.assign(config,{filter:'',heat:false,font:'original',percent:false});
  apply(state,false);
  table.querySelectorAll('[data-tc-button]').forEach(button=>button.remove());
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
  state.rows.forEach(row=>{if(!state.order.has(row))state.order.set(row,state.next++);});
  for(const {cell,index} of structure.columns){
   let button=[...cell.children].find(c=>c.hasAttribute('data-tc-button'));
   if(!button){button=doc.createElement('button');button.type='button';button.className='tc-column-button';button.dataset.tcUi='';button.dataset.tcButton='';button.innerHTML='<svg class="tc-triangle" viewBox="0 0 12 8" aria-hidden="true" focusable="false"><path d="M1.5 1.5h9L6 6.5z"/></svg>';button.setAttribute('aria-haspopup','dialog');button.addEventListener('click',event=>{event.stopPropagation();open(state,index,button);});button.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();event.stopPropagation();open(state,index,button);}});cell.append(button);}
   const clone=cell.cloneNode(true);clone.querySelectorAll('[data-tc-ui]').forEach(n=>n.remove());const label=clone.textContent.replace(/\s+/g,' ').trim()||'Column '+(index+1);
   button.setAttribute('aria-label','Column options: '+label);button.title='Sort, filter and display '+label;
   const previous=state.configs.get(index)||{filter:'',heat:false,font:'original',percent:false};
   const values=state.rows.map(row=>sourceText(row.cells[index])),info=profile(values,{label,kind:cell.dataset.tableKind,unit:cell.dataset.tableUnit});
   state.configs.set(index,{...previous,label,header:cell,button,info,originalSort:previous.header===cell?previous.originalSort:cell.getAttribute('aria-sort')});
  }
  if(structure.merged){state.sort=null;for(const config of state.configs.values())config.filter='';}
  const scroll=table.parentElement;if(scroll&&/(auto|scroll)/.test(root.getComputedStyle(scroll).overflowX)&&!scroll.hasAttribute('tabindex')){scroll.tabIndex=0;if(!scroll.hasAttribute('role'))scroll.setAttribute('role','region');if(!scroll.hasAttribute('aria-label'))scroll.setAttribute('aria-label',(table.caption?.textContent.trim()||'Data table')+'; scroll horizontally');}
  apply(state,Boolean(state.status.textContent));
  if(active?.state===state){if(!state.configs.has(active.index))close();else sync();}
 }
 function apply(state,announce=true){
  const {table,rows,model}=state;
  for(const [index,config]of state.configs){
   const values=rows.map(row=>scalar(sourceText(row.cells[index]))?.value).filter(Number.isFinite),min=values.length?Math.min(...values):0,max=values.length?Math.max(...values):0;
   config.range={min,max};if(!config.info.numeric)config.heat=false;if(!config.info.percent)config.percent=false;
   config.button.dataset.active=String(!!(config.filter||config.heat||config.font!=='original'||config.percent||state.focus===index||state.sort?.index===index));
   for(const row of rows){const cell=row.cells[index];const raw=sourceText(cell),value=scalar(raw)?.value;
    cell.classList.toggle('tc-heat',config.heat&&Number.isFinite(value));cell.classList.toggle('tc-focus',state.focus===index);
    if(config.heat&&Number.isFinite(value)){const bound=Math.max(Math.abs(min),Math.abs(max));cell.dataset.tcBand=String(heatBand(value,config.info.change?-bound:min,config.info.change?bound:max));cell.dataset.tcScale=config.info.change?'change':'level';}else{delete cell.dataset.tcBand;delete cell.dataset.tcScale;}
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
  for(const row of rows){const filtered=[...state.configs].some(([index,c])=>c.filter&&!sourceText(row.cells[index]).toLocaleLowerCase().includes(c.filter.toLocaleLowerCase()));row.classList.toggle('tc-filtered',filtered);}
  // Never move spanning rows or totals, or reorder across row groups.
  if(!model.merged&&(state.sort||state.restoreOrder)){const dataRows=new Set(rows);for(const body of table.tBodies){let segment=[];const flush=()=>{if(segment.length){const anchor=segment[segment.length-1].nextSibling;segment.sort((a,b)=>state.sort?(compare(sourceText(a.cells[state.sort.index]),sourceText(b.cells[state.sort.index]),state.configs.get(state.sort.index).info.type,state.sort.descending)||state.order.get(a)-state.order.get(b)):state.order.get(a)-state.order.get(b));const fragment=doc.createDocumentFragment();segment.forEach(row=>fragment.append(row));body.insertBefore(fragment,anchor);segment=[];}};for(const row of [...body.rows]){if(dataRows.has(row))segment.push(row);else flush();}flush();}state.restoreOrder=false;}
  if(announce){const matching=rows.filter(r=>!r.classList.contains('tc-filtered')&&!r.hidden).length;state.status.textContent=matching+' of '+rows.length+' loaded data rows match. Changes apply to this rendered table only.';}
 }
 function createDialog(){
  dialog=doc.createElement('dialog');dialog.id='tc-dialog';dialog.className='tc-dialog';dialog.dataset.tcUi='';dialog.setAttribute('aria-labelledby','tc-title');
  dialog.innerHTML='<form method="dialog"><header><h2 id="tc-title">Column options</h2><button value="close" aria-label="Close column options">✕</button></header></form><p class="tc-hint">Sort and filter affect loaded rows in this table, within existing groups. Use the original table controls to search other pages. Source values and totals stay unchanged; totals are not recalculated after filtering. Display choices reset when a table is replaced.</p><div class="tc-sort"><button type="button" data-tc-sort="asc">Sort ascending ↑</button><button type="button" data-tc-sort="desc">Sort descending ↓</button><button type="button" data-tc-sort="none">Original order</button></div><p id="tc-structure" class="tc-hint"></p><label>Filter this column<input id="tc-filter" type="search" maxlength="300" autocomplete="off" placeholder="Contains text…"></label><label class="tc-check"><input id="tc-heat" type="checkbox">Apply heat scale</label><p id="tc-heat-note" class="tc-hint"></p><label>Apply font color<select id="tc-font"><option value="original">Original colors</option><option value="blue">Blue</option><option value="purple">Purple</option><option value="teal">Teal</option></select></label><p class="tc-hint">Font colors are display choices, not gain/loss signals.</p><label class="tc-check"><input id="tc-focus" type="checkbox">Focus this column</label><label class="tc-check" id="tc-percent-label" hidden><input id="tc-percent" type="checkbox">Signed percent display (+ / −)</label><p class="tc-hint">Percent display is available only for explicitly identified percentage changes. It never converts yields, basis points, prices or counts.</p><footer><button type="button" id="tc-reset">Reset this column</button><button type="button" id="tc-reset-table">Reset table controls</button><button type="button" id="tc-done">Done</button></footer>';
  doc.body.append(dialog);dialog.addEventListener('close',()=>{active=null;trigger?.focus({preventScroll:true});trigger=null;});
  dialog.addEventListener('click',event=>{const button=event.target.closest('button');if(!active||!button)return;const {state,index}=active,config=state.configs.get(index);
   if(button.hasAttribute('data-tc-sort')){const direction=button.dataset.tcSort;state.restoreOrder=direction==='none';state.sort=direction==='none'?null:{index,descending:direction==='desc'};}
   else if(button.id==='tc-reset'){Object.assign(config,{filter:'',heat:false,font:'original',percent:false});if(state.sort?.index===index){state.sort=null;state.restoreOrder=true;}if(state.focus===index)state.focus=null;}
   else if(button.id==='tc-reset-table'){state.sort=null;state.restoreOrder=true;state.focus=null;for(const c of state.configs.values())Object.assign(c,{filter:'',heat:false,font:'original',percent:false});}
   else if(button.id==='tc-done'){close();return;}else return;
   mutate(()=>{apply(state);sync();});
  });
  dialog.addEventListener('input',event=>{if(!active||event.target.id!=='tc-filter')return;const {state,index}=active;state.configs.get(index).filter=event.target.value;mutate(()=>apply(state));});
  dialog.addEventListener('change',event=>{if(!active)return;const {state,index}=active,config=state.configs.get(index),target=event.target;
   if(target.id==='tc-heat')config.heat=target.checked;else if(target.id==='tc-font')config.font=target.value;else if(target.id==='tc-focus')state.focus=target.checked?index:null;else if(target.id==='tc-percent')config.percent=target.checked;else return;
   mutate(()=>{apply(state);sync();});
  });
 }
 function sync(){if(!active)return;const {state,index}=active,config=state.configs.get(index),query=id=>dialog.querySelector('#'+id);query('tc-title').textContent=config.label+' · column options';
  query('tc-filter').value=config.filter;query('tc-filter').disabled=state.model.merged;
  dialog.querySelectorAll('[data-tc-sort]').forEach(button=>{button.disabled=state.model.merged;button.setAttribute('aria-pressed',String(button.dataset.tcSort==='none'?!state.sort:state.sort?.index===index&&state.sort.descending===(button.dataset.tcSort==='desc')));});
  query('tc-structure').textContent=state.model.merged?'Sorting and filtering are unavailable because body cells span rows. Their relationships are preserved.':'';
  query('tc-heat').checked=config.heat;query('tc-heat').disabled=!config.info.numeric;
  const bound=Math.max(Math.abs(config.range.min),Math.abs(config.range.max));query('tc-heat-note').textContent=config.info.numeric?(config.info.change?'Purple (negative) ← 0 → Blue (positive). Symmetric range: '+(-bound)+' to '+bound:'Low → high. Blue intensity shows magnitude. Range: '+config.range.min+' to '+config.range.max)+(config.info.unit?' '+config.info.unit:'')+'. Range uses all loaded rows before column filters. Colors do not show investment merit. Missing values are uncolored.':'Heat scale needs single numeric values with consistent units. Mixed text, identifiers and missing-only columns are not scaled.';
  query('tc-font').value=config.font;query('tc-focus').checked=state.focus===index;query('tc-percent-label').hidden=!config.info.percent;query('tc-percent').checked=config.percent;
 }
 function open(state,index,button){if(!dialog?.isConnected)createDialog();trigger=button;active={state,index};mutate(()=>{mount(state.table);sync();});if(!active||states.get(state.table)!==state)return;if(!dialog.open)dialog.showModal();dialog.querySelector('[data-tc-sort="asc"]:not([disabled]),#tc-font')?.focus();}
 function close(){if(dialog?.open)dialog.close();}
 function refresh(scope=doc){mutate(()=>{if(scope.matches?.('table'))mount(scope);scope.querySelectorAll('table').forEach(mount);});}
 function start(){refresh();observer=new MutationObserver(ingest);observer.observe(doc.body,observation);}
 root.MarketTableControls={refresh};
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(typeof window!=='undefined'?window:globalThis);
