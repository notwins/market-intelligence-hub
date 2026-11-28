/* Shared GLD play icons and the first accumulator's observation diagram. */
(function (root) {
  'use strict';
  const svgNS = 'http://www.w3.org/2000/svg';
  const outlines = {
    entry: 'M3 12h12m-4-4 4 4-4 4M15 4h5v16h-5',
    acc: 'm3 12 9-5 9 5-9 5-9-5zm0 5 9 5 9-5M12 1v4m-2-2 2 2 2-2',
    observation: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12zm13 0a3 3 0 1 0-6 0 3 3 0 0 0 6 0z',
    upko: 'M3 6h18M5 18l5-5 3 2 6-7m-5 0h5v5',
    maturity: 'M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1zm2-2v4m10-4v4M4 9h16m-12 5 3 3 5-5',
    hold: 'M3 13h3v7H3zm3 1 4-3h3c2 0 2 3 0 3h-2m2 0 4-1 3-2c2-1 3 1 1 3l-6 5H9l-3-1M14 7a3 3 0 1 0-6 0 3 3 0 0 0 6 0z',
    buy: 'M3 20h18M6 16l5-5 3 2 6-7M4 5h6M7 2v6',
    decu: 'M3 16v-3a9 9 0 0 1 18 0v3h-2M12 5V2m0 9v9m-3-3 3 3 3-3',
    roll: 'M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5m-4 8a8 8 0 0 0 14 3l3-3m0 5v-5h-5',
    wait: 'M5 3h14M5 21h14M7 4c0 5 2 5 5 8-3 3-5 3-5 8m10-16c0 5-2 5-5 8 3 3 5 3 5 8',
    staged: 'M3 20h18M4 17v-4h5v-4h5V5h5m-3-3 3 3-3 3',
    chart: 'M4 3v17h17M7 15l4-5 4 2 5-7',
    history: 'M4 10a8 8 0 1 1 1 7M4 5v5h5m3-3v6l4 2',
    edit: 'M4 14h5m-5 5h9M6 9h7m1 2 5-6 2 2-5 6-3 1 1-3z',
    rebound: 'M3 19l6-7 3 2 8-10m-5 0h5v5',
    recovery: 'M3 6l5 10 3 2 4-3 6-11m-5 1 5-1v5',
    bear: 'M3 5l5 3 3-1 4 7 5 4m-1-5 1 5-5 1',
    whipsaw: 'M2 16l5-9 4 10 4-9 3 3 4-7',
    sideways: 'M2 11l3-3 4 7 4-7 4 6 5-4',
    decision: 'M6 21v-5l9-9m-4 0h5v5M6 16V5m-3 3 3-3 3 3',
    price: 'M3 18h18M5 13l4-4 4 2 7-7m-4 0h4v4'
  };
  const aliases = {
    accumulator: 'acc', fixing: 'observation', daily: 'observation', ko: 'upko', knockout: 'upko',
    mat: 'maturity', stock: 'hold', outright: 'buy', spot: 'buy', spotadd: 'buy', add: 'buy',
    covered: 'decu', covereddecu: 'decu', decumulator: 'decu', rollover: 'roll', cash: 'wait',
    stage: 'staged', priceedit: 'edit', prices: 'edit', cases: 'decision', range: 'sideways'
  };
  const usd = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'});
  const shortUSD = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1});
  const money = value => usd.format(value);

  function svg(tag, attributes, text) {
    const node = document.createElementNS(svgNS, tag);
    for (const [name, value] of Object.entries(attributes || {})) node.setAttribute(name, value);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function html(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function icon(name, label) {
    const key = String(name || '').toLowerCase().replace(/[^a-z]/g, '');
    const shape = outlines[aliases[key] || key] || outlines.chart;
    const image = svg('svg', {class: 'gld-icon', viewBox: '0 0 24 24', width: '1.15em', height: '1.15em',
      fill: 'none', stroke: 'currentColor', 'stroke-width': 1.65, 'stroke-linecap': 'round',
      'stroke-linejoin': 'round', focusable: 'false'});
    if (label) {
      image.setAttribute('role', 'img');
      image.setAttribute('aria-label', label);
    } else image.setAttribute('aria-hidden', 'true');
    image.append(svg('path', {d: shape}));
    return image;
  }

  function rule({strike, ko, price, day, exit, opened}) {
    if (opened === false) return 'The account could not fund this first accumulator. The levels show the quoted terms.';
    if (day === 0) return 'The entry close sets the strike and upper KO. The first daily observation follows entry.';
    if (Number.isInteger(day) && Number.isInteger(exit?.day) && day >= exit.day) {
      if (day > exit.day) return 'The first accumulator ended at fixing ' + exit.day + ' by ' +
        (exit.type === 'ko' ? 'knock-out' : 'maturity') + '. This close marks the GLD price after that contract ended.';
      if (exit.type === 'ko') return 'The upper KO ends ordinary purchases at this fixing. ' +
        (Number.isInteger(exit.guaranteeTopUp) ? (exit.guaranteeTopUp ? 'The guarantee adds ' + exit.guaranteeTopUp.toLocaleString('en-US') + ' shares at the buy strike.' :
          'No guarantee top-up is due.') : 'Any remaining guaranteed shares are delivered at the buy strike.');
    }
    const prefix = day === exit?.day && exit?.type === 'maturity' ? 'At the maturity fixing, ' : 'At a live fixing, ';
    if (price >= ko) return prefix + 'a close at or above the upper KO stops ordinary purchases. Any remaining guarantee is settled.';
    const difference = Math.round((price - strike) * 100) / 100;
    if (!difference) return prefix + 'the daily lot is bought at the market close, equal to the strike.';
    return prefix + 'the daily lot is bought at ' + money(strike) + ', ' + money(Math.abs(difference)) +
      (difference > 0 ? ' below' : ' above') + ' the market close per share.';
  }

  function barriers(input) {
    const figure = html('figure', 'gld-barriers');
    figure.append(html('figcaption', 'gld-barrier-title', 'First accumulator · fixing versus buy strike'));
    const valid = input && ['spot','strike','ko','price'].every(key => typeof input[key] === 'number' && Number.isFinite(input[key]) && input[key] >= 0);
    if (!valid || input.spot <= 0 || input.strike <= 0 || input.ko < input.strike) {
      figure.append(html('p', 'gld-barrier-rule', 'Enter valid first-accumulator levels and a GLD fixing to see the comparison.'));
      return figure;
    }
    // Round on the same basis as the funded GLD engine before testing equality.
    const penny = n => Math.round((n + Number.EPSILON * Math.abs(n)) * 100) / 100;
    const spot = penny(input.spot), strike = penny(input.strike), ko = penny(input.ko), price = penny(input.price);
    const cashColor = '#096457', koColor = '#964819', entryColor = '#566370', currentColor = '#234a79';
    const lowTerm = Math.min(spot, strike), highTerm = Math.max(spot, ko);
    const span = Math.max(highTerm - lowTerm, spot * .08, .04);
    let low = Math.max(0, lowTerm - span * .3), high = highTerm + span * .38;
    if (price < low && price >= low - span) low = Math.max(0, price - span * .1);
    if (price > high && price <= high + span) high = price + span * .1;
    const left = 14, right = 386, markerY = 116, zero = 66;
    const x = n => left + (right - left) * (Math.max(low, Math.min(high, n)) - low) / (high - low);
    const slope = 38 / Math.max(strike - low, ko - strike, .01);
    const y = n => zero - (n - strike) * slope;
    const xs = x(strike), xk = x(ko), xp = x(price);
    const chart = svg('svg', {class: 'gld-barrier-plot', viewBox: '0 0 400 144', width: '100%', role: 'img',
      'aria-label': 'Ordinary purchase at a live fixing. Below the upper knock-out each share is bought at the strike. The line shows the fixing less strike per share. At and above knock-out, ordinary buying stops.'});
    const line = (x1,y1,x2,y2,attrs) => svg('line',{x1,y1,x2,y2,...attrs});
    const point = (cx,cy,r,fill,stroke) => svg('circle',{cx,cy,r,fill,stroke,'stroke-width':1.6});
    const caption = (xPos,yPos,text,anchor='start') => svg('text',{x:xPos,y:yPos,'text-anchor':anchor,
      'font-family':'inherit','font-size':11,fill:'#435359'},text);
    chart.append(svg('rect', {x:left,y:20,width:xs-left,height:82,fill:'#f3eae4'}),
      svg('rect', {x:xs,y:20,width:Math.max(0,xk-xs),height:82,fill:'#e6f2eb'}),
      svg('rect', {x:xk,y:20,width:right-xk,height:82,fill:'#f3eee1'}));
    chart.append(line(left,zero,right,zero,{stroke:'#abb6aa','stroke-dasharray':'3 3'}),
      line(x(spot),20,x(spot),103,{stroke:entryColor,'stroke-width':1.2,'stroke-dasharray':'3 3'}),
      line(xk,20,xk,103,{stroke:koColor,'stroke-width':1.6,'stroke-dasharray':'5 3'}),
      line(left,y(low),xs,zero,{stroke:'#98502e','stroke-width':3}),
      line(xs,zero,xk,y(ko),{stroke:cashColor,'stroke-width':3}),
      point(xs,zero,3.4,'white',cashColor), point(xk,y(ko),3.8,'white',koColor));
    chart.append(caption(4,zero+3,'0'));
    if (xs-left > 68) chart.append(caption((left+xs)/2,33,'Below strike','middle'));
    if (right-xk > 60) chart.append(caption((xk+right)/2,33,'Upper KO','middle'));
    // Symbols occupy separate vertical lanes when strike, spot and KO are adjacent.
    chart.append(svg('path',{d:'M '+x(spot)+' 12 l -4 -6 h 8 Z',fill:entryColor}),
      line(left,markerY,right,markerY,{stroke:'#a0aaa3','stroke-width':1.3}));
    const off = price < low ? -1 : price > high ? 1 : 0;
    if (off) {
      const direction = off * 7;
      chart.append(svg('path',{d:'M '+(xp-direction)+' '+(markerY-5)+' L '+xp+' '+markerY+' L '+(xp-direction)+' '+(markerY+5),
        fill:'none',stroke:currentColor,'stroke-width':2.5,'stroke-linecap':'round','stroke-linejoin':'round'}));
    } else {
      chart.append(line(xp,105,xp,markerY,{stroke:currentColor,'stroke-width':1.4}),
        svg('path',{d:'M '+xp+' '+(markerY-5)+' l 5 5 -5 5 -5 -5 Z',fill:currentColor}));
      const live = input.opened !== false && input.day !== 0 &&
        !(Number.isInteger(input.exit?.day) && Number.isInteger(input.day) && input.day > input.exit.day);
      if (live && price < ko) chart.append(point(xp,y(price),4.2,currentColor,'white'));
    }
    const axisPrice = n => n >= 100000 ? shortUSD.format(n) : money(n);
    chart.append(caption(left,137,axisPrice(low)), caption(right,137,axisPrice(high),'end'));
    figure.append(chart, html('p','gld-barrier-range',
      'The sloping line shows the GLD close minus the strike for one ordinary share bought at a live fixing. The open end marks the KO. The blue marker shows the selected close.'));
    const levels = html('dl','gld-barrier-levels');
    for (const [key, label, value, color] of [['spot','Entry spot',spot,entryColor],['strike','Buy strike',strike,cashColor],
      ['ko','Upper KO',ko,koColor],['price','Selected fixing',price,currentColor]]) {
      const item = html('div','gld-barrier-level gld-level-'+key);
      const mark = svg('svg',{viewBox:'0 0 12 12',width:'.8em',height:'.8em','aria-hidden':'true',focusable:'false'});
      if (key === 'spot') mark.append(svg('path',{d:'M 1 2 h 10 l -5 8 Z',fill:color}));
      else if (key === 'price') mark.append(svg('path',{d:'M 6 1 l 5 5 -5 5 -5 -5 Z',fill:color}));
      else mark.append(point(6,6,4,'white',color));
      const term = html('dt');
      term.append(mark, document.createTextNode(' '+label));
      item.append(term,html('dd','',money(value)));
      levels.append(item);
    }
    figure.append(levels, html('p','gld-barrier-rule',rule({...input,price,strike,ko})));
    if (off) figure.append(html('p','gld-barrier-range','The selected fixing is ' + (off < 0 ? 'below' : 'above') +
      ' the plotted range. The arrow points toward its actual price of ' + money(price) + '.'));
    return figure;
  }

  root.GldPlayVisuals = Object.freeze({icon, barriers});
})(globalThis);
