/* Research library navigation and reading links. */
(()=>{'use strict';
const root=document.querySelector('.market-understanding');
if(!root||root.dataset.libraryReady)return;
const latest=document.getElementById('main-published-research'),library=document.getElementById('my-research');
if(!latest||!library)return;
root.dataset.libraryReady='true';
const original=Array.from(root.children);
const entry=document.createElement('header');entry.className='library-entry';
entry.innerHTML=`
  <nav class="library-breadcrumb" aria-label="Where we are"><a href="../desk.html">Home</a><span aria-hidden="true">/</span><span aria-current="page">My Blog</span><a class="library-map" href="../site-map.html" data-site-map>Site map</a></nav>
  <div class="ws-hero">
    <div class="ws-intro"><p class="ws-kicker">Research library</p><h1>Research Explained</h1><p class="ws-deck">Read the latest reports, find a past write-up, or learn the basics.</p>
    <nav class="ws-jumps" aria-label="Research collections"><a href="#my-thoughts">My thoughts</a><a href="#library-news">Reuters briefs</a><a href="#library-basics">Market basics</a></nav></div>
    <div class="ws-plate"><img src="../assets/desk/reading-journal.png" width="1280" height="610" alt=""></div>
  </div>
  <nav class="library-choices" aria-label="Research workspaces"><a href="#main-published-research"><b>Latest reports</b><span>Full reports and matching Quick reads</span></a><a href="#my-research"><b>My blog write-ups</b><span>Search past editions by topic or date</span></a><a href="../external-sources.html"><b>Official papers</b><span>Open the original source documents</span></a></nav>`;
root.prepend(entry);entry.after(latest);
import('./research-workspaces.js?v=3');
function group(id,title,description,nodes){
 const section=document.createElement('details');section.className='library-group';section.id=id;section.open=true;
 const summary=document.createElement('summary');const label=document.createElement('strong');label.textContent=title;const sub=document.createElement('span');sub.textContent=description;summary.append(label,sub);section.append(summary);
 nodes.filter(Boolean).forEach(node=>section.append(node));root.append(section);return section;
}
group('library-all','My blog write-ups — all editions','Search by company, topic or report date. Includes briefs and earlier versions.',[library]);
group('library-news','Reuters briefs','Short reads with links to the original news.',[document.getElementById('reuters-read-up')]);
const olderIds=['full-market-research-20261106','diversification-simple-20261106','research-added-20261106','research-readings','published-research'];
group('library-older','Browse earlier report cards','Older reports, explanations and downloads.',olderIds.map(id=>document.getElementById(id)));
group('library-basics','Market basics','Dated teaching guide: bonds, currencies, shares and portfolio risk.',original.filter(node=>node.matches('.mu-hero,.mu-shortcuts,.mu-summary,.mu-toolbar,.mu-layout')));
// Personal principles are an optional footer to My Blog, outside the report feed.
// A fresh visit starts closed; only the reader opens this native disclosure.
const tradingCode=document.createElement('details');
tradingCode.className='library-group library-trading-code';
tradingCode.id='my-trading-code';
tradingCode.innerHTML=`
  <summary><strong>My Trading Code</strong><span>Personal principles · Seven rules for every recommendation</span></summary>
  <section aria-label="Personal trading principles">
    <p class="trading-code-date"><time datetime="2026-11-27">27 November 2026</time> · Personal principles</p>
    <ol class="trading-code-rules">
      <li><h3>No trading for the sake of trading.</h3>
        <p>Every trade must have a clear investment reason and a useful role in the client’s portfolio.</p>
        <p>Boredom, sales targets and the need to appear active are never sufficient reasons.</p>
        <blockquote>Waiting is a valid decision. Every trade must earn its place.</blockquote>
      </li>
      <li><h3>Act fairly when I have conviction.</h3>
        <p>When the evidence supports my conviction, I bring the opportunity promptly to all suitable clients.</p>
        <p>I do not spread entries across different clients merely to hedge my own uncertainty or test whether my timing is right.</p>
        <p>Each client still decides independently. Allocation and execution must fit their existing exposure, liquidity and risk capacity. Any phased entry must serve that client’s interests.</p>
      </li>
      <li><h3>Never compromise my standards.</h3>
        <p>Revenue pressure, deadlines and a busy schedule must never lower the quality of my recommendations.</p>
        <p>Trade preparation, execution and monitoring receive protected time.</p>
        <p>If I cannot properly assess, explain and follow through on a trade, I postpone it.</p>
        <blockquote>My revenue needs and lack of time must never become the client’s risk.</blockquote>
      </li>
      <li><h3>Client benefit comes first.</h3>
        <p>Every recommendation must offer a credible benefit after fees, financing and FX costs, with the downside clearly understood.</p>
        <p>The value I aim to create for the client must justify the costs and risks they take. My remuneration must be transparent and proportionate.</p>
        <p>I must be willing to recommend the same trade even if it earns me nothing.</p>
      </li>
      <li><h3>Avoid panic and forced selling.</h3>
        <p>I size and fund positions so the client can withstand adverse moves within the agreed risk limits.</p>
        <p>A price fall triggers a review. It does not automatically require a sale.</p>
        <p>If the investment case fails, credit quality deteriorates materially, or the client’s risk capacity changes, I recommend reducing or exiting—even at a loss.</p>
        <blockquote>Protecting the remaining capital takes priority over defending my original call.</blockquote>
      </li>
      <li><h3>Never borrow to the limit.</h3>
        <p>Borrowing must leave a substantial margin buffer and accessible cash reserves.</p>
        <p>Before entry, assess falling asset prices, adverse FX moves, higher borrowing costs and reduced collateral lending values—including several happening together.</p>
        <p>Set a review and reduction trigger before the bank’s margin-call level. If the client cannot withstand the stress scenario, reduce the borrowing or do not proceed.</p>
      </li>
      <li><h3>No chasing recent highs.</h3>
        <p>My default is to avoid new purchases at the week’s, month’s or three-month high.</p>
        <p>An exception requires documented fundamental improvement and a valuation that still offers sufficient reward for the risk.</p>
        <p>Before making that exception, write down what changed, why the price is justified and what would invalidate the view.</p>
        <p>A fall from the high is also insufficient on its own to justify buying.</p>
      </li>
    </ol>
    <div class="trading-code-check"><h3>Before every recommendation</h3><p>Record the client’s benefit, the entry rationale, the position size, the downside, the funding buffer and the conditions for reducing or exiting.</p></div>
  </section>`;
root.append(tradingCode);
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
thoughts.hidden=false;
thoughts.setAttribute('aria-labelledby','my-thoughts-title');
thoughts.innerHTML=`
  <div class="mu-writeups-heading"><div><h2 id="my-thoughts-title">My thoughts</h2></div></div>
  <div class="mu-writeups-grid" data-thoughts-feed hidden></div>
  <div class="mu-writeups-grid" data-thoughts-snapshots>
    <article class="mu-writeup">
      <p class="mu-eyebrow"><time datetime="2026-11-28">28 Nov 2026</time> · Saved dashboard</p>
      <h3>NVIDIA Historical</h3>
      <p>Interactive snapshot of the financial charts, peer comparisons and valuation tools before the desktop layout update.</p>
      <p><a href="../nvda-history-snapshot-2026-11-28.html">Open saved NVIDIA dashboard →</a></p>
    </article>
  </div>
  <div class="mu-writeups-grid" data-thoughts-legacy></div>`;
latest.after(thoughts);
root.querySelectorAll('details.mu-explanation, details.mu-card-previous, #library-basics details').forEach(details=>{details.open=true;});
import('./research-editorial-gallery.js?v=3');
const thoughtsFeed=thoughts.querySelector('[data-thoughts-feed]');
const thoughtsLegacy=thoughts.querySelector('[data-thoughts-legacy]');
function renderThoughts(feed){
 const reader=window.ResearchFeed;if(!reader?.thoughts)return;
 try{reader.validate(feed);}catch{return;}
 const records=reader.thoughts(feed.records);
 thoughtsFeed.innerHTML=reader.cards(records,feed.tags,'../');
 thoughtsFeed.hidden=!records.length;
 if(!thoughts.hidden&&location.hash==='#my-thoughts')reveal(location.hash,true);
}
window.addEventListener('mih-research-feed-updated',event=>renderThoughts(event.detail));
renderThoughts(window.MIH_RESEARCH_FEED);
if(location.hash==="#my-thoughts")reveal(location.hash,true);

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
