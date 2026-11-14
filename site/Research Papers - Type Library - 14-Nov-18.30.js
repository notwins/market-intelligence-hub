(function(root){
  'use strict';
  const DATA='data/Research Papers - Type Catalogue - 14-Nov-18.30.json';
  const initial={query:'',publisher:'',collection:'',type:'Research papers & reports',sort:'publisher',page:1};
  const state={...initial};
  const safeURL=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};
  function select(rows,s){
    const words=s.query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter(r=>(!s.type||r.type===s.type)&&(!s.publisher||r.publisher===s.publisher)&&(!s.collection||r.collections.includes(s.collection))&&words.every(w=>[r.title,r.publisher,r.type,r.url,...r.references.map(x=>x.title)].join(' ').toLocaleLowerCase().includes(w))).sort((a,b)=>s.sort==='cited'?(b.last_cited.localeCompare(a.last_cited)||a.title.localeCompare(b.title)):s.sort==='title'?a.title.localeCompare(b.title):a.publisher.localeCompare(b.publisher)||a.title.localeCompare(b.title));
  }
  const csvCell=s=>'"'+(/^[=+@\-\t\r]/.test(String(s))?"'":'')+String(s).replace(/"/g,'""')+'"';
  const csv=rows=>'\ufeff'+[['Title','Publisher','Source type','Publication date (saved)','Last cited edition','Collections','Original URL','Cited in','Access limits'],...rows.map(r=>[r.title,r.publisher,r.type,r.publication_date,r.last_cited,r.collections.join('; '),r.url,r.references.map(x=>x.title+(x.date?' ['+x.date+']':'')).join('; '),r.access])].map(r=>r.map(csvCell).join(',')).join('\r\n');
  const api={select,safeURL,csv};if(typeof module!=='undefined'&&module.exports)module.exports=api;if(typeof document==='undefined')return;
  root.ResearchPapers=api;
  const base=new URL('.',document.currentScript.src);
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const style=el('style');style.textContent=`.rp-library{padding:clamp(18px,3vw,34px);border-top:4px solid var(--purple,#6658d9);margin-bottom:28px}.rp-library h2{font-size:clamp(25px,3vw,36px)}.rp-stats{display:flex;gap:12px;flex-wrap:wrap;margin:18px 0}.rp-stat{padding:10px 16px;border:1px solid var(--line,#ddd);border-radius:10px}.rp-stat b{font-size:24px;display:block}.rp-controls{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:20px 0}.rp-controls label{font-size:13px;font-weight:600;display:flex;flex-direction:column;gap:5px}.rp-controls input,.rp-controls select{width:100%;min-width:0;padding:10px;border:1px solid var(--line,#ddd);border-radius:8px;background:var(--card,#fff);color:var(--ink,#182339);min-height:44px}.rp-query{grid-column:span 2}.rp-actions,.rp-pager{display:flex;gap:12px;flex-wrap:wrap;align-items:center}.rp-actions button,.rp-pager button{padding:9px 14px;min-height:44px;border-radius:8px;border:1px solid var(--line,#ddd);background:var(--card,#fff);color:var(--ink,#182339)}.rp-count{margin:16px 0;font-weight:600}.rp-results{list-style:none;padding:0;margin:0}.rp-item{padding:20px 0;border-top:1px solid var(--line,#ddd);overflow-wrap:anywhere}.rp-item h3{font-size:19px;margin:7px 0}.rp-meta{font-size:12px;color:var(--muted,#647188)}.rp-type{display:inline-block;margin-left:8px;padding:2px 7px;border-radius:5px;background:#edf0fb;color:#3e4580}.rp-item details{margin:9px 0;font-size:13px}.rp-item summary{cursor:pointer;min-height:32px}.rp-item ul{padding-left:20px}.rp-original{display:inline-block;min-height:36px;padding-top:5px}.rp-pager{margin-top:20px}.rp-pager button:disabled{opacity:.45;cursor:default}.rp-coverage{margin-top:16px;font-size:13px}.rp-coverage p{max-width:85ch}.rp-empty{padding:24px 0}@media(max-width:650px){.rp-controls{grid-template-columns:1fr 1fr}.rp-query{grid-column:1/-1}.rp-library{padding:18px 14px}.rp-stat{flex:1}.rp-controls label{font-size:12px}}@media(max-width:380px){.rp-controls{grid-template-columns:1fr}.rp-query{grid-column:auto}}`;
  document.head.append(style);
  let promise;
  function load(){return promise||(promise=fetch(new URL(DATA,base)).then(r=>{if(!r.ok)throw Error('Catalogue unavailable');return r.json();}).then(d=>{if(d.schema_version!==1||!Array.isArray(d.records))throw Error('Catalogue format unavailable');return d;}).catch(e=>{promise=null;throw e;}));}
  async function mount(){
    const host=document.getElementById('research-papers-catalogue');if(!host||host.dataset.mounted)return;host.dataset.mounted='true';
    const body=host.querySelector('[data-rp-body]');
    try{
      const data=await load();if(!host.isConnected)return;
      body.replaceChildren();
      const stats=el('div',undefined,'rp-stats');
      for(const [n,label] of [[data.records.filter(r=>r.type==='Research papers & reports').length,'paper & report links'],[data.records.length,'total source links'],[data.records.filter(r=>r.collections.includes('Daily / Friday bond debrief')).length,'bond-debrief sources']]){const x=el('div',undefined,'rp-stat');x.append(el('b',n.toLocaleString()),el('span',label));stats.append(x);}body.append(stats);
      const controls=el('div',undefined,'rp-controls');
      const query=el('input');query.type='search';query.placeholder='Paper, topic, institution or research title';query.value=state.query;
      function control(input,label,key){const l=el('label',label,key==='query'?'rp-query':'');input.id='rp-'+key;l.htmlFor=input.id;l.append(input);controls.append(l);input.addEventListener(key==='query'?'input':'change',()=>{state[key]=input.value;state.page=1;render();});return input;}
      control(query,'Search titles, topics and citations','query');
      function dropdown(label,key,values,all){const input=el('select');for(const [value,name] of [[ '',all],...values.map(x=>Array.isArray(x)?x:[x,x])]){const option=el('option',name);option.value=value;input.append(option);}input.value=state[key];return control(input,label,key);}
      const type=dropdown('Source type','type',['Research papers & reports','Official releases & filings','Data & statistics','News & commentary','Reference pages & other'],'All source types');
      const collection=dropdown('Used in','collection',['Own research','Daily / Friday bond debrief'],'Both collections');
      const publisher=dropdown('Publisher','publisher',[...new Set(data.records.map(r=>r.publisher))].sort(),'All publishers');
      const sort=dropdown('Sort','sort',[['publisher','Publisher A–Z'],['title','Title A–Z'],['cited','Latest cited edition']],'Default order');body.append(controls);
      const actions=el('div',undefined,'rp-actions');const reset=el('button','Reset filters');reset.type='button';reset.onclick=()=>{Object.assign(state,initial);query.value='';publisher.value='';collection.value='';type.value=initial.type;sort.value=initial.sort;render();};
      const all=el('button','Show all source types');all.type='button';all.onclick=()=>{state.type='';type.value='';state.page=1;render();};
      const download=el('button','Download filtered list · CSV');download.type='button';download.onclick=()=>{const url=URL.createObjectURL(new Blob([csv(select(data.records,state))],{type:'text/csv;charset=utf-8;'}));const a=el('a');a.href=url;a.download='Research Papers - Type Catalogue - 14-Nov-18.30.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};actions.append(all,reset,download);body.append(actions);
      const count=el('p','','rp-count');count.setAttribute('role','status');count.setAttribute('aria-live','polite');const results=el('ol',undefined,'rp-results');body.append(count,results);
      const pager=el('div',undefined,'rp-pager'),prev=el('button','← Previous'),next=el('button','Next →'),pageLabel=el('span');prev.type=next.type='button';prev.onclick=()=>{state.page--;render();host.scrollIntoView({block:'start'});};next.onclick=()=>{state.page++;render();host.scrollIntoView({block:'start'});};pager.append(prev,pageLabel,next);body.append(pager);
      const coverage=el('details',undefined,'rp-coverage');coverage.append(el('summary','Coverage, dates and access limits'));for(const t of [data.coverage,data.date_note,data.rights_note,'Collated 14 November 2026. Source types are catalogue labels based on saved titles and URLs; they do not certify peer review or full-text access. The same URL is combined across citations; different editions, PDF and landing-page URLs remain separate.'])coverage.append(el('p',t));body.append(coverage);
      function render(){
        const chosen=select(data.records,state);const pages=Math.max(1,Math.ceil(chosen.length/25));state.page=Math.min(Math.max(1,state.page),pages);results.replaceChildren();
        count.textContent=chosen.length.toLocaleString()+(chosen.length===1?' source matches':' sources match')+(chosen.length?' · showing '+((state.page-1)*25+1)+'–'+Math.min(state.page*25,chosen.length):'');
        if(!chosen.length)results.append(el('li','No matches. Try a broader search or show all source types.','rp-empty'));
        for(const r of chosen.slice((state.page-1)*25,state.page*25)){
          const item=el('li',undefined,'rp-item'),meta=el('div',r.publisher,'rp-meta');meta.append(el('span',r.type,'rp-type'));item.append(meta,el('h3',r.title));
          item.append(el('div',(r.publication_date?'Publication / edition: '+r.publication_date:'Publication date not recorded')+(r.last_cited?' · Last cited edition: '+r.last_cited:''),'rp-meta'));
          const a=el('a','Open original source ↗','rp-original');const url=safeURL(r.url);if(url){a.href=url;a.target='_blank';a.rel='noopener noreferrer';item.append(a);}const details=el('details');details.append(el('summary','Cited in '+r.references.length+' saved references · details & access'));const refs=el('ul');
          for(const ref of r.references){const li=el('li');const label=ref.title+(ref.date?' · '+ref.date:'')+' — '+ref.collection;if(ref.path&&/^(research\/|market-understanding\/|v4\.html|archive\.html)/.test(ref.path)&&!ref.path.includes('..')){const link=el('a',label);link.href=new URL(ref.path,base).href;li.append(link);}else li.textContent=label;li.append(el('small',' · '+ref.evidence));refs.append(li);}details.append(refs,el('p',r.access));if(r.saved_access_note)details.append(el('p','Earlier source note: '+r.saved_access_note));item.append(details);results.append(item);
        }
        pageLabel.textContent='Page '+state.page+' of '+pages;prev.disabled=state.page===1;next.disabled=state.page===pages;
      }render();
    }catch(e){body.textContent='The catalogue could not load. ';const retry=el('button','Retry');retry.type='button';retry.onclick=()=>{delete host.dataset.mounted;mount();};body.append(retry);}
  }
  const view=document.getElementById('view');if(view)new MutationObserver(mount).observe(view,{childList:true});mount();
})(typeof window==='undefined'?globalThis:window);
