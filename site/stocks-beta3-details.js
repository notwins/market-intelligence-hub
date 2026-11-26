/* Annual filing comparisons and detailed statement table groups. */
(function(root){
  'use strict';
  const D=root.FilingNotes,G=root.FilingGeography,F=Number.isFinite;
  const palette=['#196a60','#4976a1','#c18a46','#80669c','#577b54','#a35f69','#3c818d','#96844a','#617387','#9f745e','#6b679a','#9b9864'];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $=id=>document.getElementById(id);
  const keyFor=(kind,row)=>'mix-'+kind+'-'+row.type+'-'+row.name.toLowerCase();
  const geographyModes=['grouped','grouped-detail'];
  const geoMode=()=>$('geo-filter').value;
  const grouped=()=>geographyModes.includes(geoMode());
  const geoRows=views=>G.rows(views,geoMode()==='grouped-detail');
  const geoKey=row=>'geo-'+(row.depth===0?'summary-':row.depth===1?'sub-':'market-')+row.id;
  function reportedRows(views,kind) {
    return D.mixRows(views,kind).filter(row=>kind!=='geography'||geoMode()==='all'||row.type===geoMode());
  }
  function focusKeys(c){
    const out=[];
    for(const kind of Object.keys(D.kinds)){
      if(kind==='geography'&&grouped()){
        const rows=geoRows(c.notes);
        out.push(...rows.filter(r=>r.depth===0||(r.depth===1&&Number.isFinite(r.cells[0]?.n))).map(geoKey));
      }else{
        out.push(...reportedRows(c.notes,kind).filter(r=>r.cells[0]?.n>0).slice(0,2).map(r=>keyFor(kind,r)));
      }
    }
    return out;
  }
  function groups(c,h) {
    const {row,text,show,amount,pct,times,best,fmtDate,period}=h, views=c.notes;
    const sections=[];
    function financial(group,title,keys){
      const records=keys.map(k=>{
        const vals=views.map(v=>v.v[k]);
        if(!show('note-'+k)||!vals.some(F))return '';
        const fmt=D.percentages.has(k)?pct:D.times.has(k)?times:amount;
        const sameBusiness=c.companies.every(co=>co.model===c.companies[0].model);
        const rank=group==='solvency'&&sameBusiness&&['equityAssets','netAssetsRatio','debtAssets','currentRatio','interestCover','cashFlowAssets','debtCoverage','cet1','totalCapitalRatio'].includes(k);
        const format=(v,i)=>{const scope=views[i].facts[k]?.basis;return F(v)&&scope?{main:fmt(v,i),tip:scope}:fmt(v,i);};
        return row('note-'+k,D.labels[k],vals,format,rank?best(vals,D.lower.has(k),D.times.has(k)?2:1):[]);
      });
      if(records.some(Boolean))sections.push([group,title,records]);
    }
    function valueMix(cell,style,i){
      if(!cell)return '—';
      if(style==='share')return {main:pct(cell.p),tip:cell.label};
      return {main:amount(cell.n,i),sub:style==='both'&&F(cell.p)?pct(cell.p):'',tip:cell.label};
    }
    const mixMode=$('mix-units').value;
    for(const [kind,title] of Object.entries(D.kinds)){
      const distributions=views.map(v=>v.geo[kind]);if(!distributions.some(Boolean))continue;
      const records=kind==='geography'&&grouped()?
        geoRows(views).filter(r=>show(geoKey(r))).map(r=>row(geoKey(r),r.name,r.cells,(cell,i)=>valueMix(cell,mixMode,i))):
        reportedRows(views,kind).filter(r=>show(keyFor(kind,r))).map(r=>row(keyFor(kind,r),r.name,r.cells,(cell,i)=>valueMix(cell,mixMode,i)));
      if(records.length){
        const sum=distributions.map(d=>d?d.total:null);
        sections.push([kind,title,[row('scope-'+kind,'Disclosed revenue base',sum,amount,[],false),...records]]);
      }
    }
    if(period==='latest'){
      const latest=views.map(v=>v.current);
      const records=['cash','cashIncludingRestricted','shortInvestments','cashShort','currentAssets','currentLiabilities','assets','liabilities'].map(k=>{
        const vals=latest.map(o=>{const v=o?.fields||{};return k==='cashShort'&&!F(v[k])&&F(v.cash)&&F(v.shortInvestments)?v.cash+v.shortInvestments:v[k];});
        if(!show('recent-'+k)||!vals.some(F))return '';
        return row('recent-'+k,D.labels[k],vals,(v,i)=>amount(v,i,latest[i]?.end||h.currentEnd(i)));
      });
      if(show('recent-disclosedCash')&&views.some(v=>v.latestCash)){
        records.unshift(text('cash-observation-date','Cash observation date',i=>views[i].latestCash?.end?fmtDate(views[i].latestCash.end):views[i].latestCash?.label),
          row('recent-disclosedCash','Latest disclosed cash balance',views.map(v=>v.latestCash),(o,i)=>o?{main:amount(o.value,i,o.end||h.currentEnd(i)),sub:o.basis==='Cash-flow closing balance'?'Cash flow':'Balance sheet',tip:o.basis}:'—'));
      }
      if(records.some(Boolean))sections.push(['recent','Latest reported balance sheet',[text('recent-period','Balance sheet date',i=>latest[i]?.end?fmtDate(latest[i].end):latest[i]?.label),...records]]);
    }
    financial('liquids','Annual cash, investments and Treasuries',D.rows.liquids);
    financial('composition','Assets by type',D.rows.assets);
    financial('obligations','Liabilities by type',D.rows.liabilities);
    financial('leases','Lease assets and liabilities',D.rows.leases);
    for(const [kind,title] of Object.entries(D.families)){
      const schedules=views.map(v=>v.sch[kind]);if(!schedules.some(Boolean))continue;
      const records=D.maturityRows(views,kind).filter(r=>show('due-'+kind+'-'+r.key)).map(r=>
        row('due-'+kind+'-'+r.key,r.name,r.cells,(cell,i)=>valueMix(cell,mixMode,i)));
      const totalKey='due-'+kind+'-total',totals=schedules.map(s=>s?.total);
      if(show(totalKey)&&totals.some(F))records.push(row(totalKey,'Total scheduled payments',totals,amount));
      if(records.length)sections.push(['schedule-'+kind,title,[text('asof-'+kind,'Schedule as of',i=>schedules[i]?fmtDate(views[i].year.end):null),...records]]);
    }
    financial('solvency','Solvency and funding ratios',D.rows.solvency);
    const summary=D.ranking(views), group=sections.find(s=>s[0]==='solvency');
    if(group&&summary.scores.some(F)){
      const leaders=summary.ranks.flatMap((r,i)=>r?.rank===1?[i]:[]);
      if(show('solvency-score'))group[2].unshift(row('solvency-score','Solvency score / 100',summary.scores,n=>F(n)?n.toFixed(0):'—',leaders));
      if(show('solvency-rank'))group[2].unshift(row('solvency-rank','Solvency rank',summary.ranks.map(r=>r?.rank),n=>F(n)?'#'+n:'—',leaders));
    }
    return sections;
  }
  const annualFields={
    score:['Score / 100','score'],netAssetsRatio:['Net assets / assets','percent'],netAssetsUsd:['Net assets','usd'],
    assetsUsd:['Total assets','usd'],revenueUsd:['Revenue','usd'],cashUsd:['Cash','usd'],debtUsd:['Debt','usd'],
    debtAssets:['Debt / assets','percent'],equityAssets:['Owners’ equity / assets','percent'],
    cashFlowUsd:['Operating cash flow','usd'],cashFlowAssets:['Operating cash flow / assets','percent'],
    currentRatio:['Current ratio','multiple'],interestCover:['Interest cover','multiple'],
    debtCoverage:['Cash flow / debt','percent'],cet1:['CET1','percent'],totalCapitalRatio:['Total capital ratio','percent']
  };
  const cashColor='#177969';
  function filingView(view,h){
    return {...view,usdRate:h.rate(view.company.currency,view.year?.end)};
  }
  function usd(value,rate){return F(value)&&F(rate)?value*rate:null;}
  function percent(value,pct){return '<span class="filing-percent">'+esc(pct(value))+'</span>';}
  function usdLabel(h){return 'USD '+(h.unit==='bn'?'bn':'mn');}
  function usdAmount(value,h){
    return F(value)?(value<0?'−$':'$')+h.amount(Math.abs(value)):'—';
  }
  function companyMark(view,h){
    const name=view.company.name;
    return '<span class="annual-company">'+h.logo(view.id,name)+'<span><strong>'+esc(name)+'</strong><small>'+
      (view.year?esc(h.fmtDate(view.year.end)):'Annual period unavailable')+'</small></span></span>';
  }
  function renderRanking(c,h,views=c.notes.map(view=>filingView(view,h))){
    const rank=D.ranking(views);
    const rows=views.map((view,i)=>({
      view,i,rank:rank.ranks[i]?.rank,
      values:{...view.v,...h.scale(view.v,view.usdRate),score:rank.scores[i]}
    }));
    const keys=Object.keys(annualFields).filter(k=>!['cet1','totalCapitalRatio'].includes(k)||rows.some(r=>F(r.values[k])));
    const {key,ascending}=keys.includes(h.sort.key)?h.sort:{key:'score',ascending:false};
    const sortable=row=>F(row.values[key]);
    rows.sort((a,b)=>Number(sortable(b))-Number(sortable(a))||
      (sortable(a)&&sortable(b)?(a.values[key]-b.values[key])*(ascending?1:-1):0)||a.i-b.i);
    const scale=Math.max(0,...rows.map(r=>Math.abs(r.values.netAssetsUsd||0)));
    $('ranking-caption').textContent=c.companies.length+' companies · '+usdLabel(h)+' · '+D.groupLabels[rank.model]+' score based on '+rank.common.length+(rank.common.length===1?' shared measure':' shared measures');
    const headers=keys.map(k=>{
      const [label,style]=annualFields[k],isSort=key===k;
      return '<th scope="col" class="annual-metric annual-'+style+'"'+(isSort?' aria-sort="'+(ascending?'ascending':'descending')+'"':'')+'>'+
        '<button type="button" data-annual-sort="'+k+'" data-ascending="'+D.lower.has(k)+'" aria-label="Sort by '+esc(label)+'">'+
        esc(label)+(isSort?'<span aria-hidden="true">'+(ascending?'▲':'▼')+'</span>':'')+'</button></th>';
    }).join('');
    const body=rows.map(r=>{
      const leader=r.rank===1,focus=r.i===0;
      const cells=keys.map(k=>{
        const v=r.values[k], style=annualFields[k][1];
        const formatted=style==='usd'?esc(usdAmount(v,h)):style==='percent'?percent(v,h.pct):
          style==='multiple'?esc(h.times(v)):F(v)?esc(v.toFixed(0)):'—';
        const scaleBar=k==='netAssetsUsd'&&F(v)?'<span class="annual-bar" aria-hidden="true"><i style="--bar:'+Math.abs(v)/(scale||1)*100+'%;--bar-color:'+(v<0?'#a35f69':cashColor)+'"></i></span>':'';
        const score=k==='score'&&r.rank?'<small class="annual-rank">#'+r.rank+'</small>':'';
        return '<td class="annual-'+style+(k==='netAssetsUsd'?' annual-emphasis':'')+'">'+formatted+score+scaleBar+'</td>';
      }).join('');
      return '<tr data-annual-id="'+esc(r.view.id)+'" class="'+(focus?'annual-focus ':'')+(leader?'annual-leader':'')+'"><th scope="row">'+companyMark(r.view,h)+'</th>'+cells+'</tr>';
    }).join('');
    $('rank-diagram').innerHTML='<table class="annual-matrix annual-rank-table"><caption class="sr-only">Annual solvency measures and scale in '+usdLabel(h)+'. Each heading sorts its column.</caption>'+
      '<thead><tr><th scope="col">Company / FY end</th>'+headers+'</tr></thead><tbody>'+body+'</tbody></table>';
  }
  function revenueCard(view,kind,h,color){
    const disclosure=view.geo[kind];
    const heading=companyMark(view,h);
    const klass='panel annual-mix-card'+(view.focus?' annual-focus':'');
    if(!disclosure)return '<article data-annual-id="'+esc(view.id)+'" class="'+klass+'">'+heading+
      '<p class="annual-empty">No comparable breakdown reported.</p></article>';
    const rate=view.usdRate;
    const groupedGeography=kind==='geography'&&grouped();
    const items=groupedGeography?geoRows([view]).map(r=>({
      label:r.name,id:r.id,depth:r.depth,value:r.cells[0]?.n,p:r.cells[0]?.p,source:r.cells[0]?.label
    })):disclosure.items.filter(item=>kind!=='geography'||geoMode()==='all'||item.type===geoMode())
      .slice().sort((a,b)=>b.value-a.value).map(item=>({...item,p:D.division(item.value,disclosure.total,100)}));
    const positive=items.filter(item=>item.value>0&&(!groupedGeography||item.depth===0));
    const sum=positive.reduce((total,item)=>total+item.value,0);
    const segment=positive.map(it=>'<i title="'+esc(it.label+' · '+h.pct(it.p))+'" style="width:'+
      (it.value/sum*100)+'%;background:'+color(it)+'"></i>').join('');
    const body=items.map(item=>'<tr'+(groupedGeography?' class="annual-geo-'+item.depth+'"':'')+'><th scope="row">'+
      (!groupedGeography||item.depth===0?'<span class="annual-dot" style="--dot:'+color(item)+'" aria-hidden="true"></span>':'')+
      esc(item.label)+'</th><td'+(item.source?' title="'+esc(item.source)+'"':'')+'>'+esc(usdAmount(usd(item.value,rate),h))+
      '</td><td>'+percent(item.p,h.pct)+'</td></tr>').join('');
    return '<article data-annual-id="'+esc(view.id)+'" class="'+klass+'">'+heading+
      '<p class="annual-mix-total"><strong>'+esc(usdAmount(usd(disclosure.total,rate),h))+'</strong><span>disclosed revenue</span></p>'+
      (sum?'<div class="mix-strip" aria-hidden="true">'+segment+'</div>':'')+
      '<table class="annual-mix-table"><caption class="sr-only">'+esc(view.company.name)+' · '+esc(D.kinds[kind])+'</caption>'+
      '<thead><tr><th scope="col">'+(groupedGeography?'Geographic group':'Reported breakdown')+'</th><th scope="col">'+usdLabel(h)+'</th><th scope="col">Share</th></tr></thead><tbody>'+body+'</tbody></table>'+
      (F(rate)?'':'<p class="annual-empty">USD conversion unavailable.</p>')+'</article>';
  }
  function renderRevenue(views,h){
    const categories=Object.entries(D.kinds).filter(([k])=>views.some(v=>v.geo[k]));
    $('revenue-diagram').innerHTML=categories.length?categories.map(([k,title])=>{
      const count=views.filter(v=>v.geo[k]).length;
      const label=item=>item.type+'|'+D.canonical(item.label,item.type).toLowerCase();
      const labels=D.mixRows(views,k).map(item=>label({label:item.name,type:item.type}));
      const colors=new Map(labels.map((name,index)=>[name,palette[index%palette.length]]));
      const geoColors={usa:palette[0],apac:palette[1],other:palette[2]};
      const color=item=>geoColors[item.id]||colors.get(label(item))||palette[0];
      return '<section class="annual-breakdown" aria-labelledby="annual-mix-'+k+'"><header class="annual-breakdown-head">'+
        '<h4 id="annual-mix-'+k+'">'+esc(title)+'</h4><span>'+count+'/'+views.length+' companies · '+usdLabel(h)+'</span></header>'+
        '<div class="annual-mix-grid">'+views.map(v=>revenueCard(v,k,h,color)).join('')+'</div></section>';
    }).join(''):'<p class="annual-empty">No comparable revenue breakdowns are available for this annual period.</p>';
  }
  function renderMaturities(views,h){
    const families=Object.entries(D.families).filter(([k])=>views.some(v=>v.sch[k]));
    $('maturity-diagram').innerHTML=families.length?families.map(([k,title])=>{
      const counts=views.filter(v=>v.sch[k]).length;
      const headers=views.map(view=>'<th scope="col" data-annual-id="'+esc(view.id)+'">'+companyMark(view,h)+'</th>').join('');
      const periods=D.maturityRows(views,k);
      const totals=views.map(v=>v.sch[k]?{n:v.sch[k].total}:null);
      const rows=totals.some(cell=>F(cell?.n))?[...periods,{name:'Total scheduled payments',cells:totals}]:periods;
      const body=rows.map(({name,cells})=>{
        const amounts=cells.map((cell,i)=>usd(cell?.n,views[i].usdRate));
        const max=Math.max(0,...amounts.filter(F).map(Math.abs));
        return '<tr><th scope="row">'+esc(name)+'</th>'+amounts.map((amount,i)=>{
          const bar=F(amount)&&max?'<span class="annual-bar" aria-hidden="true"><i style="--bar:'+Math.abs(amount)/max*100+
            '%;--bar-color:'+(amount<0?'#a35f69':cashColor)+'"></i></span>':'';
          return '<td'+(i===0?' class="annual-focus"':'')+(cells[i]?.label?' title="'+esc(cells[i].label)+'"':'')+'>'+esc(usdAmount(amount,h))+bar+'</td>';
        }).join('')+'</tr>';
      }).join('');
      return '<article class="panel annual-panel annual-schedule" aria-labelledby="annual-schedule-'+k+'">'+
        '<header class="annual-breakdown-head"><h4 id="annual-schedule-'+k+'">'+esc(title)+'</h4><span>'+counts+'/'+views.length+' companies · '+usdLabel(h)+'</span></header>'+
        '<div class="horizontal annual-scroll" role="region" aria-label="'+esc(title)+'" tabindex="0"><table class="annual-matrix annual-maturity-table">'+
        '<thead><tr><th scope="col">Payment window</th>'+headers+'</tr></thead><tbody>'+body+'</tbody></table></div></article>';
    }).join(''):'<p class="annual-empty">No maturity schedules are available for this annual period.</p>';
  }
  function renderCharts(c,h){
    const views=c.notes.map((view,i)=>({...filingView(view,h),focus:i===0}));
    renderRanking(c,h,views);
    renderRevenue(views,h);
    renderMaturities(views,h);
  }

  function sourceList(c,i,data,link,fmtDate){
    const v=c.notes[i],url=s=>typeof s==='number'?data.sources[s]:s;
    const refs=[];
    const item=(label,r)=>{if(!r||r.source==null)return;
      refs.push('<li><b>'+esc(label)+'</b> · '+link(url(r.source),r.ref||'Source document')+(r.basis?' · '+esc(r.basis):'')+'</li>');};
    for(const [k,g] of Object.entries(v.geo))item(D.kinds[k],g);
    for(const [k,g] of Object.entries(v.sch))item(D.families[k],g);
    for(const [k,r] of Object.entries(v.facts))if(D.labels[k])item(D.labels[k],r);
    const l=v.current;if(l&&c.periodLatest){item('Latest balance sheet'+(l.end?' · '+fmtDate(l.end):' · '+l.label),{source:l.source,ref:l.basis,basis:l.filed?'Filed '+fmtDate(l.filed):''});
      if(l.additionalSource!=null)item('Supplementary quarterly rows',{source:l.additionalSource,ref:'Morningstar quarterly financials',basis:(l.additionalKeys||[]).map(k=>D.labels[k]||k).join(', ')});}
    if(v.latestCash&&c.periodLatest)item('Dated cash disclosure',{source:v.latestCash.source,ref:v.latestCash.basis,basis:v.latestCash.end?fmtDate(v.latestCash.end):v.latestCash.label});
    const mark=data.issuers?.[v.id]?.logoSource;
    if(mark!=null)refs.push('<li><b>Company logo</b> · '+link(url(mark),v.company.name)+'</li>');
    return refs.length?'<details class="filing-note-refs"><summary>Revenue, balance sheet and maturity references</summary><ul>'+refs.join('')+'</ul></details>':'';
  }
  root.FilingNotesView={focusKeys,groups,renderRanking,renderCharts,sourceList};
})(window);
