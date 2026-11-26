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

  function category(label, allLabels) {
    if (lookup.has(label)) return lookup.get(label);
    if (/\b(eliminations?|hedging|reconciliation)\b/.test(label)) return 'adjustments';
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
    function row(id, name, depth, itemLists, parent) {
      return {
        id, name, depth, parent,
        cells: itemLists.map((entries, index) => {
          if (!entries?.length) return null;
          const n = entries.reduce((sum, item) => sum + item.value, 0);
          const total = views[index].geo.geography.total;
          return { n, p: total > 0 ? 100 * n / total : null, label: entries.map(item => item.label).join(' · ') };
        })
      };
    }
    const result = [];
    for (const { id, name, children } of groups) {
      const leaves = children.length ? children.map(([key]) => key) : [id];
      result.push(row(id, name, 0, partitions.map(group => leaves.flatMap(key => group.get(key) || []))));
      for (const [key, title] of children) {
        const lists = partitions.map(group => group.get(key) || []);
        if (!lists.some(list => list.length)) continue;
        result.push(row(key, title, 1, lists, id));
        if (!details || key === 'japan') continue;
        const markets = new Map();
        for (const item of lists.flat()) {
          const label = normalize(item.market);
          if (!markets.has(label)) markets.set(label, item.market);
        }
        if (markets.size === 1 && [...markets.values()][0] === title) continue;
        for (const [normalized, market] of [...markets].sort((a, b) => a[1].localeCompare(b[1]))) {
          const entries = lists.map(list => list.filter(item => normalize(item.market) === normalized));
          result.push(row(key + '-' + normalized.replace(/ /g, '-'), market, 2, entries, key));
        }
      }
    }
    return result;
  }

  const api = { rows };
  root.FilingGeography = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);

