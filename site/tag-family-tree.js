/* Family-tree view of the existing atlas, never a second taxonomy. */
(function () {
  'use strict';
  const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize = value => String(value).normalize('NFKC').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
  const count = nodes => nodes.reduce((total, node) => total + 1 + count(node.children || []), 0);
  const flatten = nodes => nodes.flatMap(node => [node, ...flatten(node.children || [])]);
  const icons = {
    'coverage-collections':'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',
    'topics-themes':'M4 5h9l7 7-8 8-8-8z M8 9h.01',
    'country-region':'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M3 12h18 M12 3c-5 5-5 13 0 18 M12 3c5 5 5 13 0 18',
    'institutions':'M3 9l9-6 9 6z M5 10v9 M10 10v9 M14 10v9 M19 10v9 M3 21h18',
    'sector-industry':'M3 21V10l6 4V8l6 4V3h4v18z M6 18h2 M12 18h2 M17 18h1',
    'companies-share-tickers':'M4 21V4h11v17 M15 10h5v11 M7 8h1 M11 8h1 M7 12h1 M11 12h1 M7 16h1 M11 16h1 M2 21h20',
    'people-public-figures':'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-2a8 6 0 0 1 16 0v2',
    'asset-classes-instruments':'M8 7V4h8v3 M3 7h18v14H3z M3 12h18 M10 12v3h4v-3',
    'event-type':'M5 5h14v16H5z M8 3v4 M16 3v4 M5 10h14 M9 14h2 M14 14h2 M9 18h2',
    'risk-transmission':'M3 12h4l3-8 4 16 3-8h4',
    'story-status-freshness':'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 7v5l4 2',
    'historical-events-proposed-cause-tree':'M4 4v16h16 M4 15h5v-5h5v-4h6 M7 3v3 M13 3v3',
    'historical-record-structure':'M6 3h9l4 4v14H6z M14 3v5h5 M9 12h7 M9 16h7',
    'story-detail-learning':'M12 6c-3-3-6-3-9-2v15c3-1 6-1 9 2 3-3 6-3 9-2V4c-3-1-6-1-9 2z M12 6v15',
    root:'M9 3h6v5H9z M3 16h6v5H3z M15 16h6v5h-6z M12 8v4 M6 16v-4h12v4'
  };
  const icon = key => '<span class="family-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="'+(icons[key] || icons.root)+'"/></svg></span>';
  const tints = ['#eef5ff','#f7f0ff','#eefaf4','#fff8e7','#fff0f3','#ebfafd','#f6f3fa','#fbf4ee'];
  const luminance = hex => hex.slice(1).match(/../g).map(x => parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
  const contrast = (a,b) => (Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
  function canonicalIndex(tags) {
    const names = new Map(), aliases = new Map();
    for (const tag of tags) {
      const key=normalize(tag.label); names.set(key,[...(names.get(key)||[]),tag]);
      for (const alias of new Set((tag.aliases||[]).map(normalize))) aliases.set(alias,[...(aliases.get(alias)||[]),tag]);
    }
    return {names,aliases};
  }
  function resolveTag(node,index) {
    const key=normalize(node.label);
    // These exact aliases explicitly require disambiguation in the master.
    if (key==='boc'||key==='de') return null;
    const exact=index.names.get(key)||[]; if(exact.length===1)return exact[0];
    const aliases=index.aliases.get(key)||[];
    if (aliases.length!==1) return null;
    // Short company tickers are meaningful only inside the company/security branch.
    if (aliases[0].matchingRule==='ticker' && key.length<=5 && !node.id.startsWith('companies-share-tickers--')) return null;
    return aliases[0];
  }
  function nodeStyle(node,root,index,rootIndex) {
    const tag=resolveTag(node,index);
    if(tag) return {ink:tag.light,bg:tag.lightChip,canonical:tag.id,name:tag.colourName};
    const ink=root.color||'#334155',tint=tints[rootIndex%tints.length];
    return {ink,bg:contrast(ink,tint)>=4.5?tint:'#ffffff',canonical:null,name:'Existing atlas branch colour'};
  }
  function searchTree(nodes,query) {
    const terms=normalize(query).split(' ').filter(Boolean);
    return nodes.flatMap(node=>{
      const hit=terms.every(term=>normalize(node.label+' '+(node.description||'')).includes(term));
      const children=searchTree(node.children||[],query);
      return hit?[node]:children.length?[{...node,children}]:[];
    });
  }
  const api={normalize,count,flatten,canonicalIndex,resolveTag,nodeStyle,contrast,searchTree,escape};
  if (typeof module!=='undefined'&&module.exports) module.exports=api;
  if (typeof document==='undefined')return;
  const host=document.getElementById('family-diagram'); if(!host)return;
  const source=JSON.parse(document.getElementById('taxonomy').textContent);
  const ids=new Set(flatten(source).map(node=>node.id));
  const query=document.getElementById('family-search');
  const status=document.getElementById('family-count');
  let index=canonicalIndex([]),opened=new Set(),expand=false;
  const remember=()=>{for(const element of host.querySelectorAll('details[data-family-id]')){if(element.open)opened.add(element.dataset.familyId);else opened.delete(element.dataset.familyId);}};
  function drawNode(node,root,rootIndex) {
    const style=nodeStyle(node,root,index,rootIndex);
    const color='style="--node-ink:'+escape(style.ink)+';--node-bg:'+escape(style.bg)+'"';
    const provenance=style.canonical?' data-canonical-id="'+escape(style.canonical)+'"':'';
    const title=escape(style.canonical?style.name+' · V1.2 Merged canonical colour':style.name+' · proposed catalogue label');
    const label=icon(root.id)+'<span class="family-name">'+escape(node.label);
    const jump='<a class="family-jump" href="#'+escape(node.id)+'">Open '+escape(node.label)+' in atlas →</a>';
    if (!(node.children||[]).length) return '<li class="family-item"><a class="family-leaf" '+color+provenance+' href="#'+escape(node.id)+'" title="'+title+'">'+label+'</span></a></li>';
    const isOpen=expand||!!query.value.trim()||opened.has(node.id);
    return '<li class="family-item"><details data-family-id="'+escape(node.id)+'"'+(isOpen?' open':'')+'><summary '+color+provenance+' title="'+title+'">'+label+'<small>'+count(node.children)+' tags &amp; subgroups</small></span></summary><div class="family-children">'+jump+'<ul>'+node.children.map(child=>drawNode(child,root,rootIndex)).join('')+'</ul></div></details></li>';
  }
  function renderFamily() {
    const matches=searchTree(source,query.value),visible=count(matches),total=count(source);
    host.innerHTML='<div class="family-root">'+icon('root')+'<div><strong>All atlas taggings</strong><small>'+source.length+' branches · '+total+' tags &amp; groups</small></div></div>'+(matches.length?'<ul class="family-families">'+matches.map(root=>drawNode(root,root,source.findIndex(item=>item.id===root.id))).join('')+'</ul>':'<p class="family-empty">No matching branch. Try a shorter label or choose Back to overview.</p>');
    status.textContent=query.value.trim()?visible+' matching tags and groups, including their parent branches.':total+' tags and groups connected. Open a box to follow its children; linked labels open the detailed atlas.';
  }
  function navigateAtlas(id,scroll=true) {
    if(!ids.has(id))return false;
    const catalogueQuery=document.getElementById('q');
    if(catalogueQuery.value){catalogueQuery.value='';render();}
    const target=document.getElementById(id); if(!target)return false;
    let parent=target.parentElement;while(parent){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement;}
    const detail=Array.from(target.children).find(child=>child.tagName==='DETAILS');if(detail)detail.open=true;
    if(scroll){target.scrollIntoView({block:'start',behavior:'auto'});target.focus({preventScroll:true});}
    return true;
  }
  function followHash(){let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}navigateAtlas(id);}
  host.addEventListener('click',event=>{const link=event.target.closest('a[href^="#"]');if(!link)return;const id=link.getAttribute('href').slice(1);if(!ids.has(id))return;event.preventDefault();if(location.hash!=='#'+id)history.pushState(null,'','#'+id);navigateAtlas(id);});
  query.addEventListener('input',()=>{remember();expand=false;renderFamily();});
  document.getElementById('family-expand').addEventListener('click',()=>{remember();expand=true;renderFamily();});
  document.getElementById('family-overview').addEventListener('click',()=>{opened.clear();expand=false;query.value='';renderFamily();query.focus();});
  window.addEventListener('hashchange',followHash);
  window.addEventListener('popstate',()=>{if(!location.hash){document.getElementById('family-map').scrollIntoView({block:'start'});return;}followHash();});
  renderFamily();followHash();
  fetch('data/colour-templates-v3.json').then(response=>{if(!response.ok)throw new Error('Colour reference unavailable');return response.json();}).then(data=>{
    if(data.semanticVersion!=='1.2 Merged'||!Array.isArray(data.tags)||data.tags.length!==437)throw new Error('Unverified semantic version');
    for(const tag of data.tags)if(!/^#[0-9a-f]{6}$/i.test(tag.light)||!/^#[0-9a-f]{6}$/i.test(tag.lightChip))throw new Error('Invalid colour pair');
    remember();index=canonicalIndex(data.tags);renderFamily();
    const mapped=flatten(source).filter(node=>resolveTag(node,index)).length;
    document.getElementById('family-colour-note').innerHTML='<strong>Colour key:</strong> '+mapped+' labels match the verified V1.2 Merged standard and use its exact font/backdrop pairs. Other proposed labels keep their existing atlas branch colours. Icons repeat the branch identity; colour never means buy, sell, performance or risk level.';
  }).catch(()=>{document.getElementById('family-colour-note').textContent='The verified semantic colour reference could not load. The tree remains usable with existing atlas branch colours; reload to retry. Colours identify labels, not market direction.';});
})();
