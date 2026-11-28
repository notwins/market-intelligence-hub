'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GldPlayPaths = factory();
})(typeof window === 'undefined' ? globalThis : window, function () {
  const calendar = [
    [5, 'Week 1'], [21, 'Month 1'], [63, 'Month 3'], [126, 'Month 6'],
    [189, 'Month 9'], [252, 'Year 1'], [504, 'Year 2'], [756, 'Year 3'],
    [1260, 'Year 5'], [1764, 'Year 7'], [2520, 'Year 10']
  ];
  const definitions = [
    {
      id: 'rebound', label: 'Fast rebound',
      description: 'The opening rally takes GLD 22% higher in a month. An early upper KO can leave cash on the sidelines as GLD continues higher.',
      returns: [8, 22, 28, 19, 30, 38, 24, 45, 53, 63, 82]
    },
    {
      id: 'recovery', label: 'Selloff then recovery',
      description: 'GLD falls 27% by month three and returns to its starting price after one year. The early purchases and the later recovery can have very different effects on each contract.',
      returns: [-5, -12, -27, -20, -8, 0, 8, 22, 38, 50, 68]
    },
    {
      id: 'bear', label: 'Prolonged bear market',
      description: 'GLD stays below its starting price, loses half its value in year one and continues falling. The first accumulator can run to maturity while acquired shares lose value.',
      returns: [-3, -9, -19, -35, -44, -50, -60, -62, -65, -68, -70]
    },
    {
      id: 'whipsaw', label: 'Whipsaw and late rally',
      description: 'Early rallies fade. GLD falls 22% by month six, then rallies to 24% above entry by month nine. A late KO depends on the barrier and the remaining tenor.',
      returns: [4, -13, 3, -22, 24, 11, 0, 25, 33, 41, 55]
    },
    {
      id: 'sideways', label: 'Sideways with dips',
      description: 'GLD dips 6% at month three and finishes year one 1% higher. Compare the cost of waiting for an entry with purchases already committed at the strike.',
      returns: [-2.5, 1.5, -6, 3, -4, 1, 3, -3, 2, -2, 2]
    }
  ];
  const plays = definitions.map(({id, label, description}) => ({id, label, description}));

  function number(value, label) {
    if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '' || !Number.isFinite(Number(value))) {
      throw Error('Enter a finite number for ' + label + '.');
    }
    return Number(value);
  }

  function definition(id) {
    const play = definitions.find(item => item.id === id);
    if (!play) throw Error('Choose one of the five GLD paths.');
    return play;
  }

  function waypoints(id, years) {
    const play = definition(id);
    const horizon = Number(years);
    if (![1, 3, 5, 10].includes(horizon)) throw Error('Choose a horizon of 1, 3, 5 or 10 years.');
    return calendar.filter(([day]) => day <= 252 * horizon).map(([day, label], index) => ({
      day, label, returnPct: play.returns[index]
    }));
  }

  function build({id, spot, years, xauSpot, overrides = {}}) {
    const play = definition(id);
    const start = number(spot, 'the starting GLD price');
    if (start < 0.01) throw Error('The starting GLD share price must be at least one cent.');
    const gold = xauSpot == null || xauSpot === '' ? null : number(xauSpot, 'the starting XAU/USD price per ounce');
    if (gold !== null && gold <= 0) throw Error('The starting XAU/USD price per ounce must be positive.');
    if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) throw Error('Enter checkpoint returns by fixing day.');
    for (const key of Object.keys(overrides)) {
      if (!calendar.some(([day]) => String(day) === key)) throw Error('Unknown GLD checkpoint day ' + key + '.');
    }
    const checkpoints = [{day: 0, label: 'Entry', returnPct: 0, price: start, xau: gold}];
    const prices = [start];
    let edited = false;
    for (const point of waypoints(id, years)) {
      const pct = Object.hasOwn(overrides, point.day) ? number(overrides[point.day], point.label + ' return') : point.returnPct;
      if (pct !== point.returnPct) edited = true;
      if (pct < -100) throw Error(point.label + ' return cannot be below −100%.');
      const previous = checkpoints[checkpoints.length - 1];
      if (previous.returnPct === -100 && pct !== -100) throw Error('After GLD reaches zero, every later checkpoint must have a −100% return.');
      const factor = 1 + pct / 100;
      const price = start * factor, xau = gold === null ? null : gold * factor;
      if (!Number.isFinite(price) || (xau !== null && !Number.isFinite(xau))) throw Error('The checkpoint price is too large.');
      // All quotes share this daily close. Interpolation is linear in price,
      // and the final fixing of each segment uses the exact checkpoint.
      const length = point.day - previous.day;
      for (let step = 1; step < length; step++) {
        prices.push(previous.price + (price - previous.price) * (step / length));
      }
      prices.push(price);
      checkpoints.push({day: point.day, label: point.label, returnPct: pct, price, xau});
    }
    const description = edited ? 'Your edited returns set the GLD checkpoints. Daily closes move in a straight line between them.' : play.description;
    return {id: play.id, label: play.label, description, prices, checkpoints};
  }

  return {plays, waypoints, build};
});
