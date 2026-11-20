/* Compact SI controls. Filtering never rewrites source records or estimates missing terms. */
(function(root){'use strict';
 const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const singapore=['DBSM','OCBC','UOBH','STEL','SGXL'];
 const identities={DBSM:['DBS','D05.SI'],OCBC:['OCBC','O39.SI'],UOBH:['UOB','U11.SI'],STEL:['Singtel','Z74.SI'],SGXL:['SGX','S68.SI'],STEG:['ST Engineering','S63.SI'],SIAL:['Singapore Airlines','C6L.SI'],SKHY:['SK Hynix','000660.KS']};
 const aliases={'D05.SI':'DBSM',DBS:'DBSM','O39.SI':'OCBC','U11.SI':'UOBH',UOB:'UOBH','Z74.SI':'STEL','S68.SI':'SGXL','S63.SI':'STEG','C6L.SI':'SIAL','000660.KS':'SKHY'};
 const canonical=s=>aliases[s]||s;
 function create({rows,stepDown,company}){
  const blank=()=>({shares:['','','',''],joins:['AND','AND','AND'],tenor:'',couponMin:'',couponMax:'',includeUnknown:false,strikeMin:'',strikeMax:'',kiMin:'',kiMax:'',koMin:'',koMax:'',stepMin:'',stepMax:''});
  let state=blank(),picker=null,pickerNode=null;
  const wide=root.matchMedia?.('(min-width:761px)');
  wide?.addEventListener?.('change',e=>{const el=root.document?.getElementById('si-optional-terms');if(el)el.open=e.matches;});
  const symbol=code=>identities[code]?.[1]||code;
  const name=code=>identities[code]?.[0]||root.CompanyLogos?.resolve?.(symbol(code),root.CompanyLogos?.data||{companies:[],aliases:{}})?.name||company(code).name;
  function logo(code){
   const item=root.CompanyLogos?.data&&root.CompanyLogos.resolve(symbol(code),root.CompanyLogos.data);
   return item?`<img class="si-tiny-logo" src="assets/company-logos/${E(item.file)}" alt="" width="20" height="20" loading="lazy">`:`<span class="si-logo-placeholder" aria-hidden="true">${E(code.slice(0,2)||'·')}</span>`;
  }
  function groups(){
   const counts=new Map();for(const r of rows())for(const raw of new Set(r.shares)){const s=canonical(raw);counts.set(s,(counts.get(s)||0)+1);}
   const preferred=[...counts].filter(([s])=>!singapore.includes(s)&&!['STEG','SIAL','SATS'].includes(s)).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,20).map(([s])=>s);
   const pinned=new Set([...preferred,...singapore]);
   return [['Top 20 · most used in SI',preferred],['Singapore · 5 quick choices',singapore],['Others',[...counts.keys()].filter(s=>!pinned.has(s)).sort((a,b)=>name(a).localeCompare(name(b),'en'))]];
  }
  function clauses(){
   const result=[];state.shares.forEach((share,index)=>{if(!share)return;const join=index?state.joins[index-1]:'AND';if(!result.length||join==='OR')result.push([share]);else result.at(-1).push(share);});return result;
  }
  function expression(){return clauses().map(group=>group.length>1?'('+group.join(' AND ')+')':group[0]).join(' OR ');}
  const ranges=[['coupon','Coupon p.a.'],['strike','Strike'],['ki','KI'],['ko','KO'],['step','KO step-down']];
  function issue(){for(const [key,label]of ranges){const a=state[key+'Min'],b=state[key+'Max'];if([a,b].some(v=>v!==''&&(!Number.isFinite(Number(v))||Number(v)<0)))return label+': enter a number of zero or more.';if(a!==''&&b!==''&&Number(a)>Number(b))return label+': minimum must not exceed maximum.';}return '';}
  function within(value,key){const min=state[key+'Min'],max=state[key+'Max'];return min===''&&max===''||Number.isFinite(value)&&(min===''||value>=Number(min))&&(max===''||value<=Number(max));}
  function matches(r){
   if(issue())return false;
   const groups=clauses(),basket=r.shares.map(canonical);
   if(groups.length&&!groups.some(group=>group.every(s=>basket.includes(s))))return false;
   if(state.tenor&&r.tenor_source_value!==Number(state.tenor))return false;
   if((state.couponMin!==''||state.couponMax!=='')&&r.coupon_basis!=='per_annum'&&!state.includeUnknown)return false;
   return within(r.coupon_pct,'coupon')&&within(r.strike_pct,'strike')&&within(r.ki_pct,'ki')&&within(r.ko_pct,'ko')&&within(stepDown(r.reference),'step');
  }
  const keys={'si-tenor':'tenor','si-coupon-min':'couponMin','si-coupon-max':'couponMax','si-include-unconfirmed':'includeUnknown','si-strike-min':'strikeMin','si-strike-max':'strikeMax','si-ki-min':'kiMin','si-ki-max':'kiMax','si-ko-min':'koMin','si-ko-max':'koMax','si-step-min':'stepMin','si-step-max':'stepMax'};
  function handle(target){
   const id=target.id||'',share=/^si-share-([1-4])$/.exec(id),join=/^si-join-([2-4])$/.exec(id);
   if(share){state.shares[Number(share[1])-1]=canonical(target.value);return true;}
   if(join){state.joins[Number(join[1])-2]=target.value==='OR'?'OR':'AND';return true;}
   if(keys[id]){state[keys[id]]=id==='si-include-unconfirmed'?target.checked:target.value;return true;}
   return false;
  }
  function range(key,label,unit='%'){
   return `<div class="si-range" role="group" aria-label="${E(label)} range"><span>${E(label)} <small>${unit}</small></span>${['Min','Max'].map(edge=>`<label class="si-bound"><span class="sr-only">${E(label)} ${edge.toLowerCase()}</span><input id="si-${key}-${edge.toLowerCase()}" type="number" min="0" step="any" inputmode="decimal" placeholder="${edge}" value="${E(state[key+edge])}" aria-describedby="si-filter-error"></label>`).join('')}</div>`;
  }
  function shareRow(index){
   const value=state.shares[index];
   return `<div class="si-share-filter"><span class="si-share-label">Share ${index+1}</span>${index?`<label class="si-join"><span class="sr-only">Share ${index+1} join</span><select id="si-join-${index+1}">${['AND','OR'].map(j=>`<option ${state.joins[index-1]===j?'selected':''}>${j}</option>`).join('')}</select></label>`:'<span class="si-join-spacer"></span>'}<div class="share-picker si-share-select"><div class="share-picker-field"><input id="si-share-${index+1}" value="${E(value)}" role="combobox" aria-label="Share ${index+1}" aria-autocomplete="list" aria-expanded="false" aria-controls="si-filter-options-${index+1}" autocomplete="off" maxlength="30" placeholder="Any share"><button type="button" aria-label="Show share ${index+1} suggestions" aria-controls="si-filter-options-${index+1}" tabindex="-1"><span aria-hidden="true"></span></button></div><div id="si-filter-options-${index+1}" class="share-picker-list" role="listbox" aria-label="Share ${index+1} suggestions" hidden></div></div><span id="si-share-price-${index+1}" class="si-filter-price"></span></div>`;
  }
  function render({currency,query,reviewOnly}){
   return `<section class="si-quick" aria-label="SI quick filter"><div class="si-quick-heading"><strong>Quick filter</strong><span id="si-quick-count" role="status"></span><button type="button" data-si-reset>Reset filters</button></div><div class="si-quick-top"><label>Currency<select id="si-currency">${['All',...new Set(rows().map(r=>r.currency))].sort((a,b)=>a==='All'?-1:b==='All'?1:a.localeCompare(b)).map(c=>`<option value="${c}" ${currency===c?'selected':''}>${c==='All'?'All currencies':c}</option>`).join('')}</select></label><label>Tenor<select id="si-tenor"><option value="">Any · 1–11</option>${Array.from({length:11},(_,i)=>i+1).map(n=>`<option value="${n}" ${state.tenor===String(n)?'selected':''}>${n}</option>`).join('')}</select></label>${range('coupon','Coupon p.a.','%')}</div><div class="si-quick-grid"><div id="si-quick-shares" class="si-quick-shares">${state.shares.map((_,i)=>shareRow(i)).join('')}</div><details id="si-optional-terms" class="si-quick-optional" ${wide?.matches===false?'':'open'}><summary>Optional terms · min / max</summary><div class="si-quick-terms">${range('strike','Strike')}${range('ki','KI')}${range('ko','KO')}${range('step','KO step-down')}</div></details></div><div class="si-quick-bottom"><label class="si-search"><span class="sr-only">Find shares, date or reference</span><input id="si-query" type="search" placeholder="Search date, reference or company" value="${E(query)}"></label><label><input id="si-review-only" type="checkbox" ${reviewOnly?'checked':''}> Review only</label><label><input id="si-include-unconfirmed" type="checkbox" ${state.includeUnknown?'checked':''}> Include unconfirmed coupon basis</label></div><p class="si-filter-note">Tenor: source number. Coupon: rounded %, p.a. labels where supplied. Missing step-downs are excluded when filtered. <span id="si-share-expression">${E(expression())}</span></p><p id="si-filter-error" class="si-filter-error" role="status">${E(issue())}</p></section>`;
  }
  function price(code){
   if(!code)return '';
   const p=root.MarketPrices,q=p?.currentQuote(symbol(code)),item=p?.resolve(symbol(code))||root.BOSEquity?.itemFor(symbol(code));
   if(!q||!Number.isFinite(q.close)||!['bos','yahoo'].includes(q.sourceId))return '<small>Price unavailable</small>';
   const ccy=q.currency||item?.currency||'',source=q.sourceId==='bos'?'BOS':'Yahoo';
   return `<span title="${E(q.sourceLabel||source)} · ${E(q.date||'Date unavailable')}">${E(ccy)} ${q.close.toLocaleString('en-US',{maximumFractionDigits:2})}<small>${source} · ${E(q.date||'Date unavailable')}</small></span>`;
  }
  function sync(count){
   const doc=root.document;if(!doc)return;
   const set=(id,html)=>{const el=doc.getElementById(id);if(el)el.innerHTML=html;};
   set('si-filter-error',E(issue()));set('si-share-expression',expression()?'Basket: '+E(expression()):'');
   const tally=doc.getElementById('si-quick-count');if(tally&&count!==undefined)tally.textContent=count+' / '+rows().length+' records';
   const node=doc.getElementById('si-quick-shares');
   if(root.SISharePicker&&node&&node!==pickerNode){picker?.close();picker=root.SISharePicker.mount(node,{escape:E,logoBase:'assets/company-logos/',allowCustom:false});pickerNode=node;}
   if(picker){
    const choices=groups().map(([label,codes])=>({label,entries:codes.map(code=>({ticker:code,name:name(code),search:(code+' '+name(code)).toUpperCase(),logo:root.CompanyLogos?.data&&root.CompanyLogos.resolve(symbol(code),root.CompanyLogos.data)?.file}))}));
    picker.update([{label:'Selection',entries:[{ticker:'',name:'Any share',search:'ANY CLEAR'}]},...choices]);
   }
   state.shares.forEach((code,i)=>set('si-share-price-'+(i+1),price(code)));
   for(const [key]of ranges)for(const edge of ['min','max']){const el=doc.getElementById('si-'+key+'-'+edge);if(el)el.setAttribute?.('aria-invalid',issue()?'true':'false');}
  }
  function reset(){picker?.close();state=blank();for(const [id,key]of Object.entries(keys)){const el=root.document?.getElementById(id);if(el){if(key==='includeUnknown')el.checked=false;else el.value='';}}for(let i=1;i<=4;i++){const el=root.document?.getElementById('si-share-'+i);if(el)el.value='';if(i>1){const join=root.document?.getElementById('si-join-'+i);if(join)join.value='AND';}}}
  return {matches,handle,render,sync,reset,logo,groups,expression,issue};
 }
 const api={create,canonical};root.SIQuickFilters=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
