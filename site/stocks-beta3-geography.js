/* Roll up the non-overlapping geographic lines in each annual disclosure. */
(function (root) {
  'use strict';

  const groups = [
    { id: 'usa', name: 'USA', children: [] },
    { id: 'apac', name: 'APAC', children: [
      ['china', 'China / Hong Kong'], ['japan', 'Japan'], ['rest-asia', 'Rest of Asia & Pacific'],
      ['apac-unsplit', 'APAC without a country split']
    ] },
    { id: 'other', name: 'EMEA / LATAM / Others', children: [
      ['emea', 'EMEA'], ['latam', 'LATAM & Caribbean'], ['other-americas', 'Canada & other Americas'],
      ['americas-unsplit', 'Americas (USA not split)'], ['unallocated', 'Other / unallocated'],
      ['adjustments', 'Filing adjustments']
    ] }
  ];
  const knownMarkets = {
    usa: ['united states', 'united states of america', 'united sates', 'us', 'usa', 'us customers',
      'us operations', 'united states country of domicile', 'united states and its territories',
      'united states including puerto rico'],
    china: ['china', 'prc', 'peoples republic of china', 'hong kong', 'macao', 'macau',
      'mainland china', 'chinas mainland', 'chinese mainland', 'domestic china',
      'china hong kong', 'china includes hong kong', 'china including hong kong',
      'mainland china excluding hong kong'],
    japan: ['japan'],
    'rest-asia': ['australia', 'new zealand', 'oceania', 'australia new zealand', 'australia and new zealand',
      'new zealand and pacific islands', 'papua new guinea', 'australia and oceania', 'south west pacific',
      'taiwan', 'korea', 'south korea', 'republic of korea', 'singapore', 'india', 'indonesia',
      'malaysia', 'philippines', 'thailand', 'vietnam', 'south east asia', 'southeast asia',
      'south and southeast asia', 'other far east asean countries'],
    emea: ['algeria', 'angola', 'austria', 'belgium', 'belgium luxembourg', 'bulgaria', 'denmark', 'egypt',
      'finland', 'finland and scandinavia', 'france', 'france b', 'germany', 'great britain', 'greece',
      'iberia a', 'iceland', 'ireland', 'israel', 'italy', 'morocco', 'mozambique', 'netherlands', 'nigeria',
      'norway', 'poland', 'portugal', 'russia', 'saudi arabia', 'south africa', 'spain', 'sweden',
      'switzerland', 'the netherlands', 'turkiye', 'united arab emirates', 'united kingdom', 'uk',
      'uk the groups country of domicile', 'united kingdom and ireland'],
    latam: ['argentina', 'brazil', 'caribbean', 'cayman islands', 'chile', 'colombia', 'ecuador', 'guyana',
      'mexico', 'domestic mexico us', 'peru', 'suriname', 'mexico central america and caribbean'],
    'other-americas': ['canada', 'americas excluding us', 'americas outside the us',
      'americas except united states and brazil', 'other americas excluding us and canada',
      'north america excluding us and canada', 'western hemisphere excluding us',
      'latin america and canada', 'latin america canada and the caribbean', 'other primarily canada and latin america'],
    'americas-unsplit': ['america', 'americas', 'the americas', 'north america', 'domestic canada',
      'united states and canada', 'united states and canada ucan', 'us and canada', 'us canada', 'usand canada']
  };
  const lookup = new Map(Object.entries(knownMarkets).flatMap(([key, labels]) => labels.map(label => [label, key])));
  const anchoredMarkets = {
    '600519-CH': { domestic: 'China' },
    'TPB-US': { domestic: 'United States' },
    'URBN-US': { 'domestic operations': 'United States' },
    'HMC-US': { 'country of domicile': 'Japan' }
  };
  const displayNames = {
    'republic of korea': 'South Korea', 'south korea': 'South Korea', korea: 'South Korea',
    'the netherlands': 'Netherlands', 'great britain': 'United Kingdom', uk: 'United Kingdom',
    'uk the groups country of domicile': 'United Kingdom'
  };
  const normalize = label => label.normalize('NFKD').toLowerCase()
    .replace(/[\u0300-\u036f.'’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

  const isRounding = label => /^(?:rounding difference|rounding adjustment|rounding)$/.test(normalize(label));

  function category(label, allLabels) {
    if (lookup.has(label)) return lookup.get(label);
    if (isRounding(label)||/\b(eliminations?|hedging|reconciliation)\b/.test(label)) return 'adjustments';
    // Keep regions that span more than one top-level group intact.
    if ((/\basia\b|\bapac\b|\boceania\b|\baustralia\b/.test(label) &&
        /\bafrica\b|\bmiddle east\b|\beurope\b|\blatin america\b|\bworld\b|\band other\b/.test(label)) ||
        /^(emeai|eucan|sapmena)\b/.test(label) || /^latin america .* and other$/.test(label)) return 'unallocated';
    if (/^other (north america|americas)\b|^rest of (north america|americas|north and south america)\b/.test(label)) {
      return 'other-americas';
    }
    if (/^(caribbean|central america|south america|other south america|latin america)\b/.test(label)) return 'latam';
    if (/\b(europe|emea|european|africa|middle east)\b/.test(label)) return 'emea';
    if (/^(greater china|rest of greater china|china including hong kong and taiwan|hong kong macao and taiwan)$/.test(label)) return 'apac-unsplit';
    if (/\bchina\b/.test(label) && /^(central|east|north|northeastern|south|western) china$/.test(label)) return 'china';
    if (/^(other|rest of) (asia|asian|apj)\b/.test(label) || /^asia (pacific )?(except|excl|excluding|other than)\b/.test(label)) {
      const chinaExcluded = label.includes('china') || allLabels.includes('china');
      const japanExcluded = label.includes('japan') || allLabels.includes('japan');
      return chinaExcluded && japanExcluded ? 'rest-asia' : 'apac-unsplit';
    }
    if (/\b(asia|apac|oceania|australia|pacific)\b/.test(label)) return 'apac-unsplit';
    return 'unallocated';
  }

  const isoDay = /^\d{4}-\d{2}-\d{2}$/;
  const daysBetween = (a, b) => (Date.parse(a) - Date.parse(b)) / 86400000;
  const groupOf = (date, reports) => reports[date]?.revenue?.find(group => group.kind === 'geography');
  function sameBasis(current, base) {
    const a=current.comparisonBasis, b=base.comparisonBasis;
    if(a&&b)return a===b;
    // A generic caption does not establish that independent filings use the same allocation method.
    const stated=normalize(current.basis||'');
    return stated===normalize(base.basis||'')&&/customer|shipment|shipping|billing|headquarters|destination|resident|geographical attribution/.test(stated);
  }

  function prior(reports, end, disclosure, growthBasis) {
    if(!disclosure||!isoDay.test(end||''))return null;
    const mode=growthBasis==='qoq'?'qoq':'yoy';
    const [min,max,target]=mode==='qoq'?[75,108,91]:[350,380,365];
    const candidates=Object.keys(reports).filter(date=>{
      const days=daysBetween(end,date);
      return isoDay.test(date)&&days>=min&&days<=max;
    }).sort((a,b)=>Math.abs(daysBetween(end,a)-target)-Math.abs(daysBetween(end,b)-target));
    for(const date of candidates){
      const group=groupOf(date,reports);
      if(!group)continue;
      const tiedToCurrent=group.comparableTo?.includes(end)||Boolean(group.source&&group.source===disclosure.source);
      if(tiedToCurrent||sameBasis(disclosure,group))return {end:date,disclosure:group};
    }
    return null;
  }

  function scopeKey(label){
    const key=normalize(label);
    if(knownMarkets.usa.slice(0,8).includes(key))return 'united states';
    if(['china includes hong kong','china including hong kong','china hong kong'].includes(key))return 'china including hong kong';
    if(['republic of korea','korea','south korea'].includes(key))return 'south korea';
    if(['emea','europe middle east africa','europe middle east and africa','europe the middle east and africa','europe the middle east and africa emea','europe middle east and africa emea'].includes(key))return 'emea';
    if(['asia pacific','asia pacific apac','apac'].includes(key))return 'asia pacific';
    return key;
  }

  function change(view, items, earlier) {
    if(!view.geographyBase)return null;
    const real = entries => (entries||[]).filter(item=>!isRounding(item.label));
    items=real(items);
    earlier=real(earlier);
    if(!items.length||items.length!==earlier.length)return null;
    const signature = entries => entries.map(item => scopeKey(item.label)).sort().join('|');
    if(signature(items)!==signature(earlier))return null;
    const sum = entries => entries.reduce((total, item) => total + item.value, 0);
    if(![...items,...earlier].every(item=>Number.isFinite(item.value)))return null;
    const base=sum(earlier);
    if(base<=0)return null;
    return {value:100*(sum(items)-base)/base,end:view.geographyBase.end,source:view.geographyBase.disclosure.source};
  }

  function reportedChange(view,label){
    const current=view.geo.geography?.items?.filter(item=>item.label===label);
    if(current?.length!==1)return null;
    const previous=view.geographyBase?.disclosure.items.filter(item=>scopeKey(item.label)===scopeKey(label));
    return change(view,current,previous);
  }

  function mergeData(base, extra) {
    if(extra?.version!==1)return base;
    const issuers={...base?.issuers};
    for(const [id,reports] of Object.entries(extra.issuers||{})){
      const merged={...issuers[id]};
      for(const [date,report] of Object.entries(reports)){
        const old=merged[date];
        const revenue=new Map((old?.revenue||[]).map(group=>[group.kind,group]));
        for(const group of report.revenue||[])revenue.set(group.kind,group);
        merged[date]={...old,...report,revenue:[...revenue.values()]};
      }
      issuers[id]=merged;
    }
    return {...extra,...base,issuers};
  }

  function partition(view) {
    const entries = view.geo.geography?.items || [];
    const markets = entries.map(item => anchoredMarkets[view.id]?.[normalize(item.label)] || item.label);
    const keys = markets.map(normalize);
    const known = keys.map(key => lookup.get(key));
    const items = new Map();
    entries.forEach((item, index) => {
      if (!Number.isFinite(item.value)) return;
      const key = category(keys[index], known);
      const group = items.get(key) || [];
      group.push({ ...item, market: displayNames[keys[index]] || markets[index] });
      items.set(key, group);
    });
    return items;
  }

  function rows(views, details = false) {
    const partitions = views.map(partition);
    const bases = views.map(view => view.geographyBase?
      partition({id:view.id,geo:{geography:view.geographyBase.disclosure}}):new Map());
    function row(id, name, depth, itemLists, priorLists, parent) {
      return {
        id, name, depth, parent,
        cells: itemLists.map((entries, index) => {
          if (!entries?.length) return null;
          const n = entries.reduce((sum, item) => sum + item.value, 0);
          const total = views[index].geo.geography.total;
          return { n, p: total > 0 ? 100 * n / total : null, label: entries.map(item => item.label).join(' · '),
            change:change(views[index],entries,priorLists[index]) };
        })
      };
    }
    const result = [];
    for (const { id, name, children } of groups) {
      const leaves = children.length ? children.map(([key]) => key) : [id];
      const getLeaves = group => leaves.flatMap(key => group.get(key) || []);
      result.push(row(id, name, 0, partitions.map(getLeaves), bases.map(getLeaves)));
      for (const [key, title] of children) {
        const lists = partitions.map(group => group.get(key) || []);
        if (!lists.some(list => list.length)) continue;
        const priorLists = bases.map(group => group.get(key) || []);
        result.push(row(key, title, 1, lists, priorLists, id));
        if (!details || key === 'japan') continue;
        const markets = new Map();
        for (const item of lists.flat()) {
          const label = normalize(item.market);
          if (!markets.has(label)) markets.set(label, item.market);
        }
        if (markets.size === 1 && [...markets.values()][0] === title) continue;
        for (const [normalized, market] of [...markets].sort((a, b) => a[1].localeCompare(b[1]))) {
          const getMarket = list => list.filter(item => normalize(item.market) === normalized);
          result.push(row(key + '-' + normalized.replace(/ /g, '-'), market, 2, lists.map(getMarket), priorLists.map(getMarket), key));
        }
      }
    }
    return result;
  }

  const api = { rows, prior, reportedChange, mergeData, normalize };
  root.FilingGeography = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);

