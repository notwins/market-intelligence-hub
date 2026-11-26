(function(root){
'use strict';

const benchmarkFunds=[
 ['SPY','State Street SPDR S&P 500 ETF Trust'],['QQQ','Invesco QQQ Trust']
];
const sectorFunds=[
 ['XLB','Materials Select Sector SPDR Fund'],['XLC','Communication Services Select Sector SPDR Fund'],
 ['XLE','Energy Select Sector SPDR Fund'],['XLF','Financial Select Sector SPDR Fund'],
 ['XLI','Industrial Select Sector SPDR Fund'],['XLK','Technology Select Sector SPDR Fund'],
 ['XLP','Consumer Staples Select Sector SPDR Fund'],['XLRE','Real Estate Select Sector SPDR Fund'],
 ['XLU','Utilities Select Sector SPDR Fund'],['XLV','Health Care Select Sector SPDR Fund'],
 ['XLY','Consumer Discretionary Select Sector SPDR Fund'],['SMH','VanEck Semiconductor ETF']
];

function groups({instruments,profiles,watchlist,resolve,marketCap,symbol,logos}){
 const entries=new Map();
 function add(rawTicker,name,aliases,item,profile){
  const ticker=symbol(item?.ticker||rawTicker);
  if(!/^[A-Z0-9][A-Z0-9.^ /-]{0,29}$/.test(ticker))return null;
  const existing=entries.get(ticker);
  const keys=[ticker,rawTicker,...aliases];
  const entry=existing||{ticker,name:item?.name||name||ticker,aliases:new Set(),item,profile};
  for(const key of keys.filter(Boolean))entry.aliases.add(key);
  if(profile&&!entry.profile)entry.profile=profile;
  entries.set(ticker,entry);
  return entry;
 }
 for(const item of instruments)add(item.ticker,item.name,item.aliases||[],item,null);
 for(const profile of profiles){
  const item=resolve(profile.publicTicker);
  add(profile.publicTicker,profile.name,[profile.bbTicker,...(profile.aliases||[])],item,profile);
 }
 const pinned=new Set();
 function pin(rows){
  return rows.flatMap(([ticker,name])=>{
   const entry=add(ticker,name,[],resolve(ticker),null);
   if(!entry||pinned.has(entry.ticker))return [];
   pinned.add(entry.ticker);
   return [entry];
  });
 }
 const priority=pin(watchlist.map(({ticker,name})=>[ticker,name]));
 const funds=pin([...benchmarkFunds,...sectorFunds]);
 const isShare=entry=>entry.item?.asset_type==='equity'||entry.profile?.instrumentType==='Stock';
 const rest=[...entries.values()].filter(entry=>!pinned.has(entry.ticker));
 const compareTicker=(a,b)=>a.ticker.localeCompare(b.ticker,'en',{numeric:true});
 const shares=rest.filter(isShare).map(entry=>({...entry,cap:marketCap(entry.item,entry.profile)}))
  .sort((a,b)=>(b.cap||0)-(a.cap||0)||compareTicker(a,b));
 const other=rest.filter(entry=>!isShare(entry)).sort(compareTicker);
 return [['My watchlist',priority],['Index and sector ETFs',funds],['Shares by market cap',shares],['Other listings',other]]
  .map(([label,entries])=>({label,entries:entries.map(entry=>{
   const keys=[...entry.aliases];
   return {
    ticker:entry.ticker,name:entry.name,aliases:keys,
    search:[entry.name,...keys].join(' ').toUpperCase(),
    logo:keys.map(key=>logos.get(key)).find(Boolean)
   };
  })}));
}

function mount(container,{escape:E,logoBase,allowCustom=true}){
 let rows=[],active=null,options=[],selected=-1,query='',selecting=false;
 const controls=[];
 function identity(ticker){return rows.flatMap(group=>group.entries).find(row=>row.ticker===ticker||row.aliases?.includes(ticker));}
 function decorate(control){
  const value=control.input.value,row=identity(value);
  control.selection.hidden=!value;
  control.wrapper.toggleAttribute('data-picker-selected',!!value);
  control.selection.innerHTML=value?`<span class="share-picker-icon" aria-hidden="true">${E(value.slice(0,2))}${row?.logo?`<img src="${E(logoBase+row.logo)}" width="24" height="24" alt="">`:''}</span><span class="share-picker-identity"><span>${E(row?.name||value)}</span><strong>${E(row?.ticker||value)}</strong></span>`:'';
 }
 function sync(){for(const control of controls){if(active===control)continue;control.committed=control.input.value;decorate(control);}}
 function close(){
  if(!active)return;
  if(!allowCustom)active.input.value=active.committed;
  active.input.setAttribute('aria-expanded','false');
  active.input.removeAttribute('aria-activedescendant');
  active.list.hidden=true;
  decorate(active);
  active=null;
 }
 function highlight(index,scroll=false){
  options[selected]?.setAttribute('aria-selected','false');
  selected=index;
  const option=options[index];
  if(!option){
   active.input.removeAttribute('aria-activedescendant');
   return;
  }
  option.setAttribute('aria-selected','true');
  active.input.setAttribute('aria-activedescendant',option.id);
  if(scroll)option.scrollIntoView({block:'nearest'});
 }
 function draw(){
  if(!active)return;
  const previous=options[selected]?.dataset.shareOption;
  let index=0;
  const html=rows.map(({label,entries})=>{
   const matches=entries.filter(row=>row.search.includes(query));
   if(!matches.length)return '';
   return `<div role="group" aria-label="${E(label)}"><div class="share-picker-group" aria-hidden="true">${E(label)}</div>
    ${matches.map(({ticker,name,logo,meta})=>`<div class="share-picker-option" role="option" id="${active.list.id}-${index++}" data-share-option="${E(ticker)}" aria-label="${E(name)}${ticker?' ('+E(ticker)+')':''}" aria-selected="false">
     <span class="share-picker-icon" aria-hidden="true">${E(ticker.slice(0,2))}${logo?`<img src="${E(logoBase+logo)}" width="24" height="24" alt="" loading="lazy">`:''}</span>
     <span class="share-picker-identity"><span>${E(name)}</span><strong>${E(ticker)}</strong></span>${meta?'<small class="share-option-meta">'+E(meta)+'</small>':''}
    </div>`).join('')}
   </div>`;
  }).join('');
  active.list.innerHTML=html||'<p class="share-picker-empty" role="status">'+
   (allowCustom?'No match. You can enter the ticker manually.':'No exact listing matches this search.')+'</p>';
  options=[...active.list.querySelectorAll('[data-share-option]')];
  selected=-1;
  highlight(options.findIndex(option=>option.dataset.shareOption===previous));
 }
 function fitList(){
  if(!active)return;
  const field=active.input.getBoundingClientRect();
  const viewportTop=root.visualViewport?.offsetTop||0;
  const viewportHeight=root.visualViewport?.height||root.innerHeight;
  const viewportLeft=root.visualViewport?.offsetLeft||0,viewportWidth=root.visualViewport?.width||root.innerWidth;
  const width=Math.min(Math.max(field.width,320),viewportWidth-24);
  const left=Math.max(viewportLeft+12,Math.min(field.left,viewportLeft+viewportWidth-width-12));
  active.list.style.width=width+'px';
  active.list.style.insetInlineStart=(left-field.left)+'px';
  active.list.style.insetInlineEnd='auto';
  const above=field.top-viewportTop-12,below=viewportTop+viewportHeight-field.bottom-12;
  const up=below<180&&above>below;
  active.list.dataset.placement=up?'above':'below';
  active.list.style.setProperty('--picker-height',Math.max(80,up?above:below)+'px');
 }
 function open(control,filter=''){
  if(active!==control){
   close();
   active=control;
   active.list.scrollTop=0;
   options=[];
   selected=-1;
  }
  query=filter.trim().toUpperCase();
  control.input.setAttribute('aria-expanded','true');
  control.list.hidden=false;
  fitList();
  draw();
 }
 function select(option){
  const control=active,{input}=control;
  const ticker=option.dataset.shareOption;
  close();
  input.focus();
  if(input.value===ticker)return;
  input.value=ticker;
  control.committed=ticker;
  decorate(control);
  // Notify the form without reopening the menu for a programmatic selection.
  selecting=true;
  try{input.dispatchEvent(new Event('change',{bubbles:true}));}finally{selecting=false;}
 }
 for(const wrapper of container.querySelectorAll('.share-picker')){
  const selection=root.document.createElement('span');selection.className='share-picker-selection';selection.setAttribute('aria-hidden','true');
  wrapper.querySelector('.share-picker-field').append(selection);
  const control={wrapper,selection,input:wrapper.querySelector('input'),list:wrapper.querySelector('[role=listbox]')};
  control.committed=control.input.value;controls.push(control);
  const {input,list}=control,button=wrapper.querySelector('button');
  input.addEventListener('click',()=>{if(active!==control)open(control);});
  input.addEventListener('input',event=>{if(!allowCustom)event.stopPropagation();open(control,input.value);});
  input.addEventListener('change',event=>{
   if(!allowCustom&&!selecting){input.value=control.committed;event.stopPropagation();}
   else control.committed=input.value;
   decorate(control);
  });
  input.addEventListener('keydown',event=>{
   if(event.isComposing)return;
   const key=event.key;
   if(key==='ArrowDown'||key==='ArrowUp'){
    event.preventDefault();
    if(active!==control)open(control);
    if(options.length)highlight(selected<0?(key==='ArrowDown'?0:options.length-1):
     Math.max(0,Math.min(options.length-1,selected+(key==='ArrowDown'?1:-1))),true);
   }else if(active===control&&key==='Enter'&&selected>=0){
    event.preventDefault();
    select(options[selected]);
   }else if(active===control&&(key==='Escape'||key==='Tab')){
    if(key==='Escape')event.preventDefault();
    close();
   }
  });
  button.addEventListener('click',()=>{
   if(active===control){close();return;}
   input.focus();
   open(control);
  });
  list.addEventListener('mousedown',event=>event.preventDefault());
  list.addEventListener('click',event=>{
   const option=event.target.closest('[data-share-option]');
   if(option&&active===control)select(option);
  });
  list.addEventListener('error',event=>{if(event.target.tagName==='IMG')event.target.remove();},true);
  selection.addEventListener('error',event=>{if(event.target.tagName==='IMG')event.target.remove();},true);
  wrapper.addEventListener('focusout',event=>{
   if(active===control&&event.relatedTarget&&!wrapper.contains(event.relatedTarget))close();
  });
 }
 root.document.addEventListener('click',event=>{
  if(active&&!active.input.closest('.share-picker').contains(event.target))close();
 });
 root.addEventListener('scroll',fitList,{passive:true});
 root.addEventListener('resize',fitList);
 root.visualViewport?.addEventListener('resize',fitList);
 return {close,sync,update(data){rows=data;sync();draw();}};
}

const api={groups,mount};
root.SISharePicker=api;
if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
