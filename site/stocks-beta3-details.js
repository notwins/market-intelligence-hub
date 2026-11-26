/* Grouped filing tables and the three peer-disclosure charts. */
(function(root){
  'use strict';
  const D=root.FilingNotes,F=Number.isFinite;
  const palette=['#196a60','#4976a1','#c18a46','#80669c','#577b54','#a35f69','#3c818d','#96844a','#617387','#9f745e','#6b679a','#9b9864'];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $=id=>document.getElementById(id);
  const keyFor=(kind,row)=>'mix-'+kind+'-'+row.type+'-'+row.name.toLowerCase();
  const flags={country:'Country / market',region:'Region',other:'Other / reconciliation',segment:'Business segment',product:'Product / service'};
  function focusKeys(c){
    const out=[];
    for(const kind of Object.keys(D.kinds)){
      for(const row of D.mixRows(c.notes,kind).filter(x=>x.cells[0]?.n>0).slice(0,2))out.push(keyFor(kind,row));
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
      if(style==='share')return pct(cell.p);
      return {main:amount(cell.n,i),sub:style==='both'&&F(cell.p)?pct(cell.p):'',tip:cell.label};
    }
    const mixMode=$('mix-units').value;
    for(const [kind,title] of Object.entries(D.kinds)){
      const distributions=views.map(v=>v.geo[kind]);if(!distributions.some(Boolean))continue;
      const records=D.mixRows(views,kind).filter(r=>(kind!=='geography'||$('geo-filter').value==='all'||r.type===$('geo-filter').value)&&show(keyFor(kind,r))).map(r=>
        row(keyFor(kind,r),r.name,r.cells,(cell,i)=>valueMix(cell,mixMode,i)));
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
  function chartControls(c,state,opt){
    const index=c.ids.indexOf(state.diagramCompany);if(index<0)state.diagramCompany=c.ids[0];
    $('diagram-company').innerHTML=c.companies.map((co,i)=>opt(c.ids[i],co.name)).join('');$('diagram-company').value=state.diagramCompany;
    const v=c.notes[c.ids.indexOf(state.diagramCompany)];
    function setup(id,map,available){
      const e=$(id),old=e.value;const keys=Object.keys(map).filter(k=>available(k));
      e.innerHTML=keys.map(k=>opt(k,map[k])).join('');e.disabled=!keys.length;
      if(keys.includes(old))e.value=old;
    }
    setup('distribution-kind',D.kinds,k=>v.geo[k]);
    setup('schedule-kind',D.families,k=>v.sch[k]);
    const model=c.companies[0].model;
    const measures=['equityAssets','netAssetsRatio','cashFlowAssets','currentRatio','debtAssets','interestCover','debtCoverage','cet1','totalCapitalRatio'];
    const ranks={score:'Overall solvency score',...Object.fromEntries(measures.map(k=>[k,D.labels[k]]))};
    setup('ranking-metric',ranks,k=>k==='score'||c.notes.filter(q=>q.company.model===model&&F(q.v[k])).length>=2);
  }
  function renderCharts(c,state,h){
    const {pct,times,amount,fmtDate,logo}=h;
    const metric=$('ranking-metric').value||'score',rank=D.ranking(c.notes,metric);
    const rows=c.ids.map((id,i)=>({id,i,entry:rank.ranks[i],v:rank.values[i]})).filter(r=>rank.eligible[r.i])
      .sort((a,b)=>(a.entry?.rank??999)-(b.entry?.rank??999)||a.i-b.i);
    const metricValue=v=>!F(v)?'—':metric==='score'?v.toFixed(0):D.times.has(metric)?times(v):pct(v);
    $('ranking-caption').textContent=D.groupLabels[rank.model]+' · '+rank.cohort+' in this comparison'+(metric==='score'?' · '+rank.common.length+' shared measures':'');
    $('ranking-method').textContent=metric==='score'&&rank.common.length<2?'An overall score needs two shared measures and two comparable companies.':'';
    const valid=rows.map(r=>r.v).filter(F),min=Math.min(0,...valid),max=Math.max(0,...valid);
    $('rank-diagram').innerHTML=rows.map(r=>{
      const size=F(r.v)?(metric==='score'?r.v:max===min?0:Math.abs(r.v)/(max-min)*100):0;
      const pos=metric==='score'?0:max===min?0:(Math.min(r.v||0,0)-min)/(max-min)*100;
      return '<li class="'+(r.entry?.rank===1?'rank-leader':'')+'"><span class="rank-number">'+(r.entry?'#'+r.entry.rank:'—')+'</span>'+logo(r.id,c.companies[r.i].name)+'<div class="rank-copy"><b>'+esc(c.companies[r.i].name)+'</b><span class="rank-track"><i style="inset-inline-start:'+pos+'%;width:'+Math.min(100,size)+'%;background:'+palette[r.i%palette.length]+'"></i></span></div><strong>'+esc(metricValue(r.v))+(metric==='score'&&F(r.v)?'<small> / 100</small>':'')+'</strong></li>';
    }).join('');
    const i=c.ids.indexOf(state.diagramCompany),view=c.notes[i];
    const geo=view.geo[$('distribution-kind').value],payment=view.sch[$('schedule-kind').value];
    if(geo){
      const items=geo.items.slice().sort((a,b)=>b.value-a.value);
      const positives=items.filter(r=>r.value>0),sum=positives.reduce((s,r)=>s+r.value,0);
      const strip=positives.map((it,j)=>'<i title="'+esc(it.label+' · '+pct(D.division(it.value,geo.total,100)))+'" style="width:'+(100*it.value/sum)+'%;background:'+palette[j%palette.length]+'"></i>').join('');
      $('revenue-diagram').innerHTML='<div class="mix-total"><strong>'+esc(amount(geo.total,i,view.year.end))+'</strong><span>'+esc(fmtDate(view.year.end))+'</span></div><div class="mix-strip" aria-hidden="true">'+strip+'</div><ul class="diagram-list">'+items.map((it,j)=>'<li><i style="background:'+palette[j%palette.length]+'"></i><span>'+esc(it.label)+'</span><b>'+esc(amount(it.value,i,view.year.end))+'</b><strong>'+esc(pct(D.division(it.value,geo.total,100)))+'</strong></li>').join('')+'</ul>';
    }else $('revenue-diagram').innerHTML='<p class="diagram-empty">A revenue breakdown is unavailable for this company and period.</p>';
    if(payment){
      const max=Math.max(1,...payment.items.map(o=>Math.abs(o.value)));
      const label='USD · as of '+fmtDate(view.year.end);
      const when=o=>{
        const base=Number(view.year.end.slice(0,4));
        if(/^y[1-5]$/.test(o.bucket)&&!(/\b(?:19|20)\d\d\b/.test(o.label)))return o.label+' · FY '+(base+Number(o.bucket[1]));
        return o.label;
      };
      const list=payment.items.map((o,j)=>'<li><div><span>'+esc(when(o))+'</span><b>'+esc(amount(o.value,i,view.year.end))+'</b></div><span class="ladder-track"><i style="width:'+100*Math.abs(o.value)/max+'%;background:'+palette[o.value<0?5:j===0?2:0]+'"></i></span></li>').join('');
      $('maturity-diagram').innerHTML='<p class="diagram-dateline">'+esc(label)+'</p><ol class="ladder-chart">'+list+'</ol>';
    }else $('maturity-diagram').innerHTML='<p class="diagram-empty">A maturity schedule is unavailable for this company and period.</p>';
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
  root.FilingNotesView={focusKeys,groups,chartControls,renderCharts,sourceList};
})(window);
