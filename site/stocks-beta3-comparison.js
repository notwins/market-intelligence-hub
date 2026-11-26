/* Peer identities, period alignment and market multiples for the filing comparison. */
(function(root) {
  'use strict';
  const MAX_PEERS=10, DEFAULT_PEERS=5;
  const unique=items=>[...new Set(items)];
  const valid=Number.isFinite;
  const norm=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  function prepare(data,extra) {
    Object.assign(data.companies,extra.companies||{});
    for(const [id,s] of Object.entries(extra.filing||{})) {
      const c=data.companies[id]; if(!c||c.currency!==s.currency)continue;
      for(const supplied of s.years||[]) {
        const y=c.years.find(a=>a.end===supplied.end);
        if(y){Object.assign(y.values,supplied.values);Object.assign(y.refs,supplied.refs);if(supplied.knownBy)y.knownBy=supplied.knownBy;}
      }
      if(s.notes)c.notes={...c.notes,...s.notes};
    }
    data.expansion=extra;
    const names=new Map(),symbols=new Map();
    function add(map,text,id) {
      const k=norm(text);if(!k)return;
      if(!map.has(k))map.set(k,id);else if(map.get(k)!==id)map.set(k,null);
    }
    for(const [id,c] of Object.entries(data.companies)){
      add(names,c.name,id);add(symbols,c.ticker,id);add(symbols,c.ticker.split(' ')[0],id);add(symbols,id,id);
    }
    for(const l of data.listings){add(names,l.name,l.id);add(symbols,l.ticker,l.id);}
    for(const [n,id] of Object.entries(extra.aliases?.names||{}))add(names,n,id);
    for(const [s,id] of Object.entries(extra.aliases?.symbols||{}))add(symbols,s,id);
    for(const ambiguous of extra.aliases?.ambiguousSymbols||[])symbols.set(norm(ambiguous),null);
    data.identities={names,symbols};
    return data;
  }
  function reportMembers(data,report,id) {
    if(!report)return [];
    const tk=report.columns?.findIndex(k=>k.toLowerCase().trim()==='ticker')??-1;
    const rows=report.rows?.length?report.rows.map(row=>({name:row[0],symbol:tk>=0?row[tk+1]:null,row})):
      (report.names||[]).map(name=>({name}));
    return rows.map(item=>{
      const alias=data.expansion?.aliases?.names?.[item.name];
      const known=alias || data.identities.names.get(norm(item.name));
      const symbol=data.identities.symbols.get(norm(item.symbol));
      const issuer=known || (!data.identities.names.has(norm(item.name)) ? symbol : null);
      return {...item,id:issuer&&data.companies[issuer]?issuer:null,subject:issuer===id||item.name===report.subject};
    });
  }
  function candidates(data,id,bos=[]) {
    const out=new Map(),c=data.companies[id];
    const groups=data.expansion?.peerGroups||{}, selected=groups.companies?.[id]?.groups||[];
    function add(values,reason) {
      for(const other of values||[]) if(other!==id&&data.companies[other]&&!out.has(other))out.set(other,reason);
    }
    add(bos,'BOS report peer');add(c?.peers,'Industry peer');
    for(const g of selected)add(groups.groups[g]?.members,'Industry peer');
    add(data.expansion?.connections?.[id], 'Related industry');
    for(const g of unique(selected.flatMap(k=>groups.groups[k]?.related||[])))add(groups.groups[g]?.members,'Related industry');
    return out;
  }
  function count(value) {
    const n=Number(value);
    return Number.isInteger(n)&&n>=5&&n<=MAX_PEERS?n:DEFAULT_PEERS;
  }
  function select(data,id,size=DEFAULT_PEERS,bos=[]) {
    return Array.from(candidates(data,id,bos).keys()).slice(0,count(size));
  }
  const marketLabels={quotePrice:'Share price',cap:'Equity market value',ev:'Enterprise value',peTTM:'P/E · trailing 12 months',peFY:'P/E · filed fiscal year',forwardPE:'P/E · consensus forward',evEbitda:'EV / EBITDA · filed fiscal year',proxyEvEbitda:'EV proxy / EBITDA · filed fiscal year',evEbit:'EV / operating profit · filed fiscal year',priceBook:'Price / book · filed fiscal year',priceSales:'Price / sales · filed fiscal year',earningsYield:'Earnings yield · filed fiscal year'};
  const quarterLabels={qRevenue:'Revenue / total income',qGrowth:'Revenue growth year on year',qOperatingMargin:'Operating margin',qNetMargin:'Net margin to owners',ttmRevenue:'Trailing 12-month revenue',ttmNetCommon:'Trailing 12-month common earnings'};
  const coreMarketLabels={peTTMLatest:"P/E · trailing 12 months",priceSalesTTM:"Price / sales · trailing 12 months",priceBookLatest:"Price / common book · latest quarter",evEbitdaTTM:"EV / EBITDA · trailing 12 months",proxyEvEbitdaTTM:"EV proxy / EBITDA · trailing 12 months",evEbitTTM:"EV / operating profit · trailing 12 months"};
  const multiples=new Set([...Object.keys(coreMarketLabels),'peTTM','peFY','forwardPE','evEbitda','proxyEvEbitda','evEbit','priceBook','priceSales']);
  function quotient(n,d) {return valid(n)&&valid(d)&&d>0 ? n/d : null;}
  function quarterView(record,year,latest) {
    if(!record)return {values:{}};
    const list=record.quarters||[];
    const observation=latest?list.at(-1):list.find(q=>q.period==='Q4 '+year?.end.slice(0,4));
    if(!observation)return {values:{}};
    const [quarter,fy]=observation.period.split(' ');
    const prev=list.find(q=>q.period===quarter+' '+(Number(fy)-1));
    const v=observation.values, ttm=latest?record.ttm:{}, scale=(n,d)=>{const x=quotient(n,d);return x===null?null:100*x;};
    const growth=valid(v.revenue)&&valid(prev?.values.revenue)?scale(v.revenue-prev.values.revenue,prev.values.revenue):null;
    return {period:observation.period,currency:record.currency,asOf:record.asOf,source:record.source,values:{qRevenue:v.revenue,qGrowth:growth,qOperatingMargin:scale(v.operatingIncome,v.revenue),qNetMargin:scale(v.netIncome,v.revenue),ttmRevenue:ttm?.revenue,ttmNetCommon:ttm?.netCommon}};
  }
  function valueView(data,id,ticker,year,period,core,{alignedQuarter=false,useLatestMarket=false}={}) {
    const c=data.companies[id],latest=alignedQuarter?useLatestMarket:period==='latest',x=data.expansion||{};
    const q=alignedQuarter?{values:{}}:quarterView(x.quarters?.[ticker]||x.quarters?.[c.ticker],year,latest);
    if(core){
      const {period,currency,ended,asOf,source,kind,values}=core;
      Object.assign(q,{period,currency,ended,asOf,source,sourceLabel:kind});
      q.values={qRevenue:values.revenue,qGrowth:values.revenueGrowth,qOperatingMargin:values.operatingMargin,
        qNetMargin:values.netMargin,ttmRevenue:values.ttmRevenue,ttmNetCommon:values.ttmNetCommon};
    }
    const interim=!alignedQuarter&&latest&&!q.source?x.interim?.[id]:null;
    if(interim&&interim.currency===c.currency){
      Object.assign(q,{asOf:interim.filed,ended:interim.ended,source:interim.source,sourceLabel:'SEC interim filing',currency:interim.currency});
      q.values.ttmRevenue=interim.values.revenue;
      q.values.ttmNetCommon=interim.values.netCommon;
    }
    const book=x.market?.[ticker]||x.market?.[c.ticker]||x.market?.[id];
    const m=latest?book?.latest:alignedQuarter?null:book?.history?.[year?.end];
    const values={...q.values}, nm=new Set(), inputs=year?.values||{};
    if(!m)return {values,nm,q,m:null};
    const cap=m.cap,capital=valid(cap)&&cap>0 && m.currency===c.currency?cap:null;
    const commonCapital=m.includesPreferred?null:capital;
    const knownBy=year?.knownBy||(year?.end===c.period?c.filed:null);
    const asFiled=Boolean(year&&knownBy&&m.date>=knownBy);
    values.cap=m.currency===c.currency?cap:null;
    values.quotePrice=m.quotePrice; values.forwardPE=m.forwardPE>0?m.forwardPE:null;
    function multiple(k,n,d){
      if(!valid(n)||!valid(d))return;
      if(n<=0||d<=0){nm.add(k);return;}
      values[k]=n/d;
    }
    if(latest && q.asOf && m.date>=q.asOf && q.currency===m.currency){
      if(!core||core.ttm){
        multiple('peTTM',commonCapital,q.values.ttmNetCommon);
        multiple('peTTMLatest',commonCapital,q.values.ttmNetCommon);
      }
      if(core){
        const balance=core.reportBalance, trailing=core.ttm?.values||{};
        const preferred=m.includesPreferred?0:balance.preferredEquity;
        const book=valid(balance.bookCommon)?balance.bookCommon:valid(balance.equity)&&valid(preferred)?balance.equity-preferred:null;
        multiple('priceBookLatest',commonCapital,book);
        multiple('priceSalesTTM',capital,trailing.revenue);
        if(c.model==='operating'&&[capital,balance.totalDebt,balance.cash].every(valid)){
          const proxy=capital+balance.totalDebt-balance.cash;
          multiple('proxyEvEbitdaTTM',proxy,trailing.ebitda);
          if([preferred,balance.noncontrollingInterest].every(valid)){
            const enterprise=proxy+preferred+balance.noncontrollingInterest;
            multiple('evEbitdaTTM',enterprise,trailing.ebitda);
            multiple('evEbitTTM',enterprise,trailing.operatingIncome);
          }
        }
      }
    }
    if(asFiled) {
      const common=valid(inputs.netCommon)?inputs.netCommon:null;
      multiple('peFY',commonCapital,common);
      if(!valid(values.peFY)&&!nm.has('peFY')&&m.priceBasisOK&&m.quoteCurrency===c.currency){
        const eps=m.epsEnd===year.end&&valid(m.priceEps)?m.priceEps:inputs.dilutedEps;
        multiple('peFY',m.quotePrice,eps);
      }
      if(valid(values.peFY))values.earningsYield=100/values.peFY;
      const commonEquity=valid(inputs.bookCommon)?inputs.bookCommon:
        valid(inputs.equity)&&valid(inputs.preferredEquity)?inputs.equity-inputs.preferredEquity:null;
      multiple('priceBook',commonCapital,commonEquity);multiple('priceSales',capital,inputs.revenue);
      if(c.model==='operating') {
        let enterprise=valid(m.enterprise)&&m.currency===c.currency?m.enterprise:null;
        const preferred=m.includesPreferred?0:inputs.preferredEquity;
        if(enterprise===null && [capital,inputs.totalDebt,inputs.cash,preferred,inputs.noncontrollingInterest].every(valid))
          enterprise=capital+inputs.totalDebt+preferred+inputs.noncontrollingInterest-inputs.cash;
        values.ev=enterprise;
        multiple('evEbitda',enterprise,inputs.ebitda);multiple('evEbit',enterprise,inputs.operatingIncome);
        if([capital,inputs.totalDebt,inputs.cash].every(valid))multiple('proxyEvEbitda',capital+inputs.totalDebt-inputs.cash,inputs.ebitda);
      }
    }
    return {values,nm,q,m};
  }
  const api={MAX_PEERS,DEFAULT_PEERS,prepare,reportMembers,candidates,count,select,marketLabels,coreMarketLabels,quarterLabels,multiples,quarterView,valueView,quotient};
  root.SharesComparison=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);

