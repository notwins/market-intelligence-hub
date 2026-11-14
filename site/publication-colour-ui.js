/* Optional display enrichment for existing card containers. One observer; no dialogs. */
(function(root){'use strict';
if(!root.document||root.__mihPublicationColours)return;root.__mihPublicationColours=true;
const doc=root.document,C=root.PublicationColour,source=doc.currentScript?.src;
if(!C||!source)return;
const selector='article.mu-writeup,article.hourly-story,article.report-card,article.archive-card,article.news-card';
let catalogue,observer,scheduled=false;
const fingerprints=new WeakMap();
function enhance(card){
 const tags=C.index(catalogue),heading=card.querySelector('h2,h3'),paragraphs=[...card.children].filter(n=>n.tagName==='P'&&!n.matches('.mu-eyebrow,.meta,.fine'));
 if(card.matches('.hourly-story'))paragraphs.unshift(...card.querySelectorAll(':scope > .brief-fact > p'));
 if(!heading)return;
 const text=[heading.textContent,...paragraphs.map(n=>n.textContent)].join(' '),row=card.querySelector('.mu-card-tags,[data-mih-auto-row],:scope.hourly-story > .tags');
 if(row&&card.matches('.hourly-story'))row.classList.add('mu-card-tags');
 const existing=[...(row?.querySelectorAll('.mu-card-tag')||[])];
 const labels=new Map(Object.values(tags).map(t=>[t.label.toLowerCase(),t.id]));
 const values=key=>{try{const v=JSON.parse(card.dataset[key]||'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string'):[];}catch{return [];}};
 const symbols=values('mihTickers'),explicit=values('mihTags').map(v=>tags[v]?v:labels.get(v.toLowerCase()));
 const known=[...new Set([...existing.map(n=>n.dataset.mihTag||labels.get(n.textContent.trim().toLowerCase())),...explicit,...symbols.map(v=>catalogue.explicit_company_tokens?.[v])].filter(id=>id&&tags[id]))];
 const fingerprint=JSON.stringify([text,known,!!row,card.querySelectorAll('.mih-colour-term').length]);
 if(fingerprints.get(card)===fingerprint)return;
 const ids=C.infer(text,catalogue,known);
 if(ids.length){card.dataset.mihPrimaryTag=ids[0];card.style.setProperty('--mih-card-accent',tags[ids[0]][card.matches('.daily-grid > .report-card:first-child')?'dark_text':'text']);}
 // Upgrade existing approved chips in place; never add another tag row.
 for(const node of existing){
  const id=node.dataset.mihTag||labels.get(node.textContent.trim().toLowerCase());
  if(!id||!tags[id])continue;
  if(node.tagName==='A'){
   node.classList.add('mih-colour-chip');node.dataset.mihTag=id;
   for(const [property,key] of [['--tag-text','text'],['--tag-bg','background'],['--tag-dark-text','dark_text'],['--tag-dark-bg','dark_background']])node.style.setProperty(property,tags[id][key]);
   if(!node.getAttribute('href'))node.href=C.searchHref(tags[id]);continue;
  }
  const template=doc.createElement('template');template.innerHTML=C.chip(id,tags[id]);node.replaceWith(template.content.firstElementChild);
 }
 if(ids.length&&!row){
  const n=doc.createElement('div');n.className='mu-card-tags mih-colour-tags';n.dataset.mihAutoRow='1';n.innerHTML=C.chips(ids,tags);
  const badge=card.matches('.news-card')?card.querySelector(':scope > .tag'):null;
  if(badge){const unknown=symbols.filter(v=>!catalogue.explicit_company_tokens?.[v]);if(unknown.length){const plain=doc.createElement('span');plain.className='tag';plain.textContent=unknown.join(' · ');n.append(plain);}badge.replaceWith(n);}else heading.insertAdjacentElement('afterend',n);
 }
 if(row){
  const present=new Set([...row.querySelectorAll('.mu-card-tag')].map(n=>n.dataset.mihTag||labels.get(n.textContent.trim().toLowerCase())).filter(Boolean));
  for(const id of ids){if(present.size>=5)break;if(!present.has(id)){row.insertAdjacentHTML('beforeend',C.chip(id,tags[id]));present.add(id);}}
 }
 // A plain summary is safe to enrich. Existing links/formatting remain untouched.
 const budget=Math.max(0,3-card.querySelectorAll('.mih-colour-term,[data-mih-semantic]').length);
 if(budget){const p=paragraphs.find(n=>n.childElementCount===0);if(p)p.innerHTML=C.highlighted(p.textContent,ids,catalogue,budget);}
 fingerprints.set(card,JSON.stringify([text,ids,!!card.querySelector('.mu-card-tags,[data-mih-auto-row]'),card.querySelectorAll('.mih-colour-term').length]));
}
function scan(){scheduled=false;observer?.disconnect();try{doc.querySelectorAll(selector).forEach(enhance);}finally{observer?.observe(doc.body,{childList:true,subtree:true});}}
function schedule(){if(!scheduled){scheduled=true;root.requestAnimationFrame(scan);}}
async function start(){
 try{
  const response=await root.fetch(new URL('data/publication-colour-catalogue.json',source));if(!response.ok)return;
  catalogue=await response.json();C.index(catalogue);
  observer=new MutationObserver(schedule);scan();
 }catch{/* Optional enhancement cannot hide reports or break their direct links. */}
}
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(typeof window!=='undefined'?window:globalThis);
