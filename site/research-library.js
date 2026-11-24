/* Research library navigation and reading links. */
(()=>{'use strict';
const root=document.querySelector('.market-understanding');
if(!root||root.dataset.libraryReady)return;
const latest=document.getElementById('main-published-research'),library=document.getElementById('my-research');
if(!latest||!library)return;
root.dataset.libraryReady='true';
const original=Array.from(root.children);
const entry=document.createElement('header');entry.className='library-entry';
entry.innerHTML='<nav aria-label="Where we are"><a href="../desk.html">Home</a><span aria-hidden="true"> / </span><span aria-current="page">Research Explained</span><a class="library-map" href="../site-map.html" data-site-map>Site map</a></nav><h1>Research Explained</h1><p>Read the latest reports, find a past write-up, or learn the basics.</p><div class="library-choices"><a href="#main-published-research"><b>Latest reports <span aria-hidden="true">→</span></b><span>Full reports and matching Quick reads</span></a><a href="#my-research"><b>My blog write-ups <span aria-hidden="true">→</span></b><span>Search past editions by topic or date</span></a><a href="../external-sources.html"><b>Official papers <span aria-hidden="true">→</span></b><span>Open the original source documents</span></a></div>';
root.prepend(entry);entry.after(latest);
function group(id,title,description,nodes){
 const section=document.createElement('details');section.className='library-group';section.id=id;
 const summary=document.createElement('summary');const label=document.createElement('strong');label.textContent=title;const sub=document.createElement('span');sub.textContent=description;summary.append(label,sub);section.append(summary);
 nodes.filter(Boolean).forEach(node=>section.append(node));root.append(section);return section;
}
group('library-all','My blog write-ups — all editions','Search by company, topic or report date. Includes briefs and earlier versions.',[library]);
group('library-news','Reuters briefs','Short reads with links to the original news.',[document.getElementById('reuters-read-up')]);
const olderIds=['full-market-research-20261106','diversification-simple-20261106','research-added-20261106','research-readings','published-research'];
group('library-older','Browse earlier report cards','Older reports, explanations and downloads.',olderIds.map(id=>document.getElementById(id)));
group('library-basics','Market basics','Dated teaching guide: bonds, currencies, shares and portfolio risk.',original.filter(node=>node.matches('.mu-hero,.mu-shortcuts,.mu-summary,.mu-toolbar,.mu-layout')));
const heading=document.getElementById('main-research-title');if(heading)heading.textContent='Latest reports';
const libraryHeading=document.getElementById('my-research-title');if(libraryHeading)libraryHeading.textContent='My blog write-ups';
const next=document.createElement('p');next.className='library-next';next.innerHTML='Looking for an older report? <a href="#my-research">Search all editions →</a>';latest.append(next);
// Open all enclosing disclosures before fragment navigation, including repeated clicks.
function reveal(hash,focus=false){
 let id;try{id=decodeURIComponent(hash.slice(1));}catch{return;}
 const target=document.getElementById(id);if(!target)return;
 for(let node=target;node&&node!==root;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;
 if(focus){const focusTarget=target.tagName==='DETAILS'?target.querySelector('summary'):target;if(!focusTarget.hasAttribute('tabindex'))focusTarget.setAttribute('tabindex','-1');focusTarget.focus({preventScroll:true});target.scrollIntoView({block:'start'});}
}
document.addEventListener('click',event=>{
 const anchor=event.target.closest('a[href]');if(!anchor||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 const url=new URL(anchor.href,location.href);if(url.origin===location.origin&&url.pathname===location.pathname&&url.search===location.search&&url.hash)reveal(url.hash,true);
});
window.addEventListener('hashchange',()=>reveal(location.hash,true));
reveal(location.hash,Boolean(location.hash));

// Read category-labelled editions from the validated independent feed. The
// existing video review stays here without copying new report data into the UI.
const thoughts=document.createElement('section');
thoughts.className='mu-writeups';
thoughts.id='my-thoughts';
thoughts.hidden=true;
thoughts.setAttribute('aria-labelledby','my-thoughts-title');
thoughts.innerHTML=`
  <div class="mu-writeups-heading"><div><h2 id="my-thoughts-title">My thoughts</h2></div></div>
  <div class="mu-writeups-grid" data-thoughts-feed hidden></div>
  <div class="mu-writeups-grid" data-thoughts-legacy></div>`;
latest.after(thoughts);
const thoughtsFeed=thoughts.querySelector('[data-thoughts-feed]');
const thoughtsLegacy=thoughts.querySelector('[data-thoughts-legacy]');
function renderThoughts(feed){
 const reader=window.ResearchFeed;if(!reader?.thoughts)return;
 try{reader.validate(feed);}catch{return;}
 const records=reader.thoughts(feed.records);
 thoughtsFeed.innerHTML=reader.cards(records,feed.tags,'../');
 thoughtsFeed.hidden=!records.length;
 thoughts.hidden=!records.length&&!thoughtsLegacy.children.length;
 if(!thoughts.hidden&&location.hash==='#my-thoughts')reveal(location.hash,true);
}
window.addEventListener('mih-research-feed-updated',event=>renderThoughts(event.detail));
renderThoughts(window.MIH_RESEARCH_FEED);

function addNvidiaReading() {
 const link=window.NvdaArticle.link('NVDA');
 thoughtsLegacy.innerHTML=`
   <article class="mu-writeup">
    <p class="mu-eyebrow"><time datetime="2026-11-18">18 Nov 2026</time> · Video review</p>
    <h3>The risk inside the jacket</h3>
    <p>A personal reading of Patrick Boyle’s Nvidia episode, covering disclosure, chip export controls, succession and financing.</p>
    ${link}
   </article>`;
 thoughts.hidden=false;
 root.querySelector('[data-main-research="research-nvda-2026-11-05"]')?.insertAdjacentHTML('beforeend',link);
 if(location.hash==='#my-thoughts')reveal(location.hash,true);
}

import('./nvda-article.js?v=20261121').then(addNvidiaReading).catch(error=>console.error('Could not load Nvidia reading link',error));

// Print the complete dated material, then restore the reader's choices.
let printState=[];window.addEventListener('beforeprint',()=>{printState=Array.from(root.querySelectorAll('details.library-group')).map(node=>[node,node.open]);printState.forEach(([node])=>node.open=true);});window.addEventListener('afterprint',()=>printState.forEach(([node,open])=>node.open=open));
})();
