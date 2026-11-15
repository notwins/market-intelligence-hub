/* Navigation only: move existing nodes, retaining report URLs, IDs and handlers. */
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
// Print the complete dated material, then restore the reader's choices.
let printState=[];window.addEventListener('beforeprint',()=>{printState=Array.from(root.querySelectorAll('details.library-group')).map(node=>[node,node.open]);printState.forEach(([node])=>node.open=true);});window.addEventListener('afterprint',()=>printState.forEach(([node,open])=>node.open=open));
})();
