/* Filing-note analysis. Monetary inputs are in millions of the issuer's reporting currency. */
(function (root) {
  'use strict';
  const finite=Number.isFinite;
  const labels={
    cash:'Cash and cash equivalents',cashIncludingRestricted:'Cash and equivalents including restricted amounts',cashShort:'Cash and short-term investments',shortInvestments:'Short-term investments',longInvestments:'Long-term investments',
    restrictedCash:'Restricted cash and equivalents',treasuries:'U.S. Treasury securities held',governmentDebtSecurities:'Government debt securities held',
    totalInvestments:'Total investments',centralBankCash:'Balances with central banks',assets:'Total assets',currentAssets:'Current assets',
    receivables:'Current receivables',inventory:'Inventories',ppe:'Property, plant and equipment',goodwill:'Goodwill',intangiblesTotal:'Net intangible assets',
    intangiblesExGoodwill:'Intangible assets excluding goodwill',noncurrentAssets:'Non-current assets',investmentProperty:'Investment property',
    loans:'Loans and advances',investmentsTotal:'Total investments',otherCurrentAssets:'Other current assets',liabilities:'Total liabilities',currentLiabilities:'Current liabilities',
    noncurrentLiabilities:'Non-current liabilities',accountsPayable:'Accounts payable',payablesAccrued:'Current payables and accrued expenses',
    contractCurrent:'Current contract liabilities',contractLong:'Non-current contract liabilities',taxPayable:'Current taxes payable',deferredTaxLiabs:'Deferred tax liabilities',
    totalDeposits:'Total deposits',customerDeposits:'Customer deposits',debtCurrent:'Current borrowings',currentLongDebt:'Current portion of long-term debt',
    debtNoncurrent:'Non-current borrowings',totalDebt:'Total interest-bearing debt',interestExpense:'Annual interest expense',
    leasesTotal:'Total recognized lease liabilities',opLeaseCurrent:'Current operating lease liabilities',opLeaseNoncurrent:'Non-current operating lease liabilities',
    opLeaseTotal:'Total operating lease liabilities',finLeaseCurrent:'Current finance lease liabilities',finLeaseNoncurrent:'Non-current finance lease liabilities',
    finLeaseTotal:'Total finance lease liabilities',leaseROU:'Right-of-use assets',cashAssets:'Cash / total assets',liquidAssets:'Cash and short-term investments / assets',
    treasuryAssets:'U.S. Treasury holdings / assets',debtAssets:'Interest-bearing debt / assets',liabAssets:'Liabilities / assets',netAssetsRatio:'Net assets / total assets',equityAssets:'Owners’ equity / assets',
    leaseLiabilities:'Lease liabilities / total liabilities',cashDebt:'Cash / total debt',interestCover:'Operating profit / interest expense',
    cashFlowAssets:'Operating cash flow / assets',debtCoverage:'Operating cash flow / debt',currentRatio:'Current assets / current liabilities',
    firstDebtDue:'Debt payments within the first fiscal year',dueCash:'Cash / first-year debt payments',shortDebtShare:'First-year debt payments / schedule total',cashCurrent:'Cash / current liabilities',
    cet1:'Common equity Tier 1 ratio',totalCapitalRatio:'Total regulatory capital ratio',loanDeposit:'Loans / customer deposits',
    operatingCashFlow:'Operating cash flow',equity:'Equity attributable to owners'
  };
  const times=new Set(['interestCover','currentRatio','dueCash']);
  const percentages=new Set(['cashAssets','liquidAssets','treasuryAssets','debtAssets','liabAssets','netAssetsRatio','equityAssets','leaseLiabilities','cashDebt','cashFlowAssets','debtCoverage','shortDebtShare','cashCurrent','cet1','totalCapitalRatio','loanDeposit']);
  const rows={
    liquids:['cash','cashIncludingRestricted','shortInvestments','cashShort','restrictedCash','treasuries','governmentDebtSecurities','longInvestments','centralBankCash','cashAssets','liquidAssets','treasuryAssets'],
    assets:['currentAssets','receivables','inventory','otherCurrentAssets','ppe','goodwill','intangiblesExGoodwill','intangiblesTotal','investmentsTotal','investmentProperty','loans','noncurrentAssets','assets'],
    liabilities:['accountsPayable','payablesAccrued','contractCurrent','taxPayable','currentLongDebt','debtCurrent','currentLiabilities','debtNoncurrent','contractLong','deferredTaxLiabs','noncurrentLiabilities','totalDebt','totalDeposits','customerDeposits','liabilities'],
    leases:['opLeaseCurrent','opLeaseNoncurrent','opLeaseTotal','finLeaseCurrent','finLeaseNoncurrent','finLeaseTotal','leasesTotal','leaseROU','leaseLiabilities'],
    solvency:['equityAssets','netAssetsRatio','liabAssets','debtAssets','cashDebt','cashCurrent','currentRatio','debtCoverage','cashFlowAssets','interestExpense','interestCover','firstDebtDue','shortDebtShare','dueCash','cet1','totalCapitalRatio','loanDeposit']
  };
  const lower=new Set(['liabAssets','debtAssets','shortDebtShare']);
  const families={debt:'Debt maturities',operatingLease:'Operating lease payments',financeLease:'Finance lease payments',allLeases:'Combined lease payments'};
  const kinds={geography:'Revenue by country and region',segments:'Revenue by business segment',products:'Revenue by product or service'};
  const buckets={y1:'First fiscal year',y2:'Second fiscal year',y3:'Third fiscal year',y4:'Fourth fiscal year',y5:'Fifth fiscal year',after:'Thereafter'};
  const standard=['y1','y2','y3','y4','y5','after'];
  const groupLabels={operating:'Operating companies',bank:'Banks',insurer:'Insurers',reit:'REITs',broker:'Brokers', 'asset-manager':'Asset managers'};
  const division=(a,b,scale=1)=>finite(a)&&finite(b)&&b>0?scale*a/b:null;
  const total=(a,b)=>finite(a)&&finite(b)?a+b:null;
  function yearView(data,id,company,year) {
    const entry=data.issuers?.[id]||{}, notes=entry.years?.[year?.end]||{}, v={...year?.values}, facts=notes.facts||{};
    for(const [k,rec] of Object.entries(facts))if(finite(rec.value))v[k]=rec.value;
    if(!finite(v.cashShort))v.cashShort=total(v.cash,v.shortInvestments);
    if(!finite(v.leasesTotal))v.leasesTotal=total(v.opLeaseTotal,v.finLeaseTotal);
    const sch=Object.fromEntries((notes.schedules||[]).map(s=>[s.kind,s]));
    const one=sch.debt?.firstYear??sch.debt?.items.find(item=>item.bucket==='y1')?.value;
    const pct=(a,b)=>division(a,b,100);
    const operating=['operating','reit'].includes(company.model);
    Object.assign(v,{
      cashAssets:pct(v.cash,v.assets),liquidAssets:pct(v.cashShort,v.assets),treasuryAssets:pct(v.treasuries,v.assets),
      debtAssets:pct(v.totalDebt,v.assets),liabAssets:pct(v.liabilities,v.assets),equityAssets:pct(v.equity,v.assets),netAssetsRatio:finite(v.liabilities)?pct(v.assets-v.liabilities,v.assets):null,
      leaseLiabilities:pct(v.leasesTotal,v.liabilities),cashDebt:operating?pct(v.cash,v.totalDebt):null,
      cashCurrent:operating?pct(v.cash,v.currentLiabilities):null,currentRatio:operating?division(v.currentAssets,v.currentLiabilities):null,
      debtCoverage:operating?pct(v.operatingCashFlow,v.totalDebt):null,cashFlowAssets:pct(v.operatingCashFlow,v.assets),
      interestCover:operating?division(v.operatingIncome,v.interestExpense):null,dueCash:operating?division(v.cash,one):null,
      firstDebtDue:one,shortDebtShare:pct(one,sch.debt?.total),loanDeposit:company.model==='bank'?pct(v.loans,v.customerDeposits):null
    });
    const current=entry.latestBalance, geo=Object.fromEntries((notes.revenue||[]).map(s=>[s.kind,s]));
    return {v,facts,sch,geo,current,latestCash:entry.latestCash,year,company,id};
  }
  // Fractional ranks give equal observations equal standing. Compare like business models.
  function standings(values,digits=2,asc=false) {
    const nums=values.map(x=>finite(x)?Number(x.toFixed(digits)):null), available=nums.filter(finite);
    return nums.map(n=>{
      if(!finite(n)||available.length<2)return null;
      const better=available.filter(o=>asc?o<n:o>n).length,same=available.filter(o=>o===n).length;
      return {rank:better+1,score:100*(available.length-better-1-(same-1)/2)/(available.length-1)};
    });
  }
  function ranking(views,metric='score') {
    const model=views[0]?.company.model, eligible=views.map(v=>v.company.model===model);
    const criteria=model==='bank'?['equityAssets','cet1','totalCapitalRatio']:
      ['insurer','broker','asset-manager'].includes(model)?['equityAssets','cashFlowAssets']:['equityAssets','cashFlowAssets','debtAssets','currentRatio','interestCover'];
    const cohort=eligible.filter(Boolean).length;
    const shared=key=>cohort>=2&&views.every((v,i)=>!eligible[i]||finite(v.v[key]));
    const common=criteria.map(k=>k==='equityAssets'&&!shared(k)?'netAssetsRatio':k).filter(shared);
    const columns=common.map(k=>standings(views.map((v,i)=>eligible[i]?v.v[k]:null),times.has(k)?2:1,lower.has(k)));
    const scores=views.map((v,i)=>eligible[i]&&common.length>=2?columns.reduce((s,col)=>s+col[i].score,0)/common.length:null);
    const vals=metric==='score'?scores:views.map((v,i)=>eligible[i]?v.v[metric]:null);
    const ordered=standings(vals,metric==='score'||percentages.has(metric)?1:2,lower.has(metric));
    return {scores,values:vals,ranks:ordered,common,eligible,cohort,model};
  }
  function canonical(label,type) {
    const clean=label.trim().replace(/\s+/g,' '), aliases={'u.s.':'United States','u.s':'United States','us':'United States','usa':'United States','united states of america':'United States','u.k.':'United Kingdom','uk':'United Kingdom','prc':'China','people’s republic of china':'China'};
    return type==='country'?(aliases[clean.toLowerCase()]||clean):clean;
  }
  function mixRows(views,kind) {
    const map=new Map();
    views.forEach((v,i)=>{
      const d=v.geo[kind];if(!d)return;
      d.items.forEach(it=>{
        const name=canonical(it.label,it.type),key=it.type+'|'+name.toLowerCase();
        if(!map.has(key))map.set(key,{name,type:it.type,cells:Array(views.length).fill(null)});
        const r=map.get(key);
        if(r.cells[i])return;
        r.cells[i]={n:it.value,p:division(it.value,d.total,100),label:it.label};
      });
    });
    const weight=r=>Math.max(...r.cells.map(x=>x?.p??-Infinity));
    return [...map.values()].sort((a,b)=>(b.cells[0]?.p??-Infinity)-(a.cells[0]?.p??-Infinity)||weight(b)-weight(a)||a.name.localeCompare(b.name));
  }
  function maturityRows(views,kind) {
    const out=new Map();
    views.forEach((v,i)=>{const d=v.sch[kind];if(!d)return;
      for(const p of d.items){
        const key=p.bucket||p.label,name=buckets[p.bucket]||p.label;
        if(!out.has(key))out.set(key,{key,name,cells:Array(views.length).fill(null)});
        out.get(key).cells[i]={n:p.value,p:division(p.value,d.total,100),label:p.label};
      }});
    const order=k=>{const x=standard.indexOf(k);return x<0?99:x;};
    return [...out.values()].sort((a,b)=>order(a.key)-order(b.key));
  }
  const api={labels,times,percentages,rows,lower,families,kinds,buckets,groupLabels,division,yearView,standings,ranking,mixRows,maturityRows};
  root.FilingNotes=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
