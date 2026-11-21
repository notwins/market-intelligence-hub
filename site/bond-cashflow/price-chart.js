window.BondPriceChart = (() => {
  'use strict';
  const get = (id) => document.getElementById(id);
  const canvas = get('pricePlot'),
    slider = get('pointDate'),
    select = get('priceRange');
  const fmt = new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3
  });
  const dateLabel = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  });
  let bond,
    history = [],
    visible = [],
    dateRows = [],
    lines = [],
    position;
  function draw() {
    if (!visible.length) return;
    const cursor = Number(slider.value),
      last = visible.length - 1;
    const days =
      (Date.parse(visible[last].date) - Date.parse(visible[0].date)) / 86400000;
    position = StocksBeta2Charts.drawPlot(canvas, lines, dateRows, {
      from: 0,
      to: last,
      cursor,
      axis: days < 55 ? 'days' : days < 1461 ? 'quarter' : 'year'
    });
    const point = visible[cursor],
      date = dateLabel.format(new Date(point.date));
    get('pointValue').textContent = fmt.format(point.value);
    get('pointBasis').textContent = point.model
      ? 'Estimated clean price'
      : 'Observed bid price';
    get('pointSource').textContent =
      date +
      ' · ' +
      point.source +
      (point.model && bond.issueDate && point.date < bond.issueDate
        ? ' · Before issuance'
        : '');
    slider.setAttribute(
      'aria-valuetext',
      date +
        ', ' +
        get('pointBasis').textContent +
        ' ' +
        fmt.format(point.value)
    );
  }

  function range() {
    const end = history.at(-1)?.date;
    const start =
      end && select.value !== 'all'
        ? DailyBondPrices.offsetMonth(
            new Date(end + 'T00:00:00Z'),
            -Number(select.value)
          )
            .toISOString()
            .slice(0, 10)
        : '';
    visible = history.filter((p) => p.date >= start);
    select.disabled = !history.length;
    canvas.hidden = get('plotTools').hidden = !visible.length;
    get('chartEmpty').hidden = !!visible.length;
    get('modelNote').hidden = !visible.some((p) => p.model);
    if (!visible.length) {
      get('pointValue').textContent = '—';
      get('pointBasis').textContent = 'Price per 100 face value';
      get('pointSource').textContent = '';
      get('chartEmpty').textContent = bond
        ? 'Market Intel has no dated prices for this bond.'
        : 'Choose a Market Intel bond to view its price history.';
      return;
    }
    dateRows = visible.map((p) => [p.date, p.date, p.date]);
    const points = visible.map((p, index) => ({
      index,
      quote: p.date,
      value: p.value,
      model: p.model
    }));
    const observed = points.filter((p) => !p.model),
      estimates = points.filter((p) => p.model);
    get('observedKey').hidden = !observed.length;
    get('modelKey').hidden = !estimates.length;
    lines = [
      { color: '#11716f', points: observed, maxGapDays: 45 },
      { color: '#835495', points: estimates, dash: [5, 3], maxGapDays: 45 }
    ].filter((l) => l.points.length);
    slider.max = String(visible.length - 1);
    slider.disabled = visible.length === 1;
    slider.value = slider.max;
    draw();
  }

  function show(next, curves) {
    if (bond === next && history.length) return;
    bond = next;
    get('historyBond').textContent = bond
      ? bond.name + ' · ' + bond.currency + ' per 100 face value'
      : 'Price per 100 face value';
    const model =
      bond?.isTreasury && curves.length
        ? BondsBetaData.reconstructedPrices(bond, curves, DailyBondPrices)
        : null;
    history = [...(model?.points || [])]
      .map(([date, p]) => ({
        date,
        value: p.price,
        source: 'FRED Treasury curve',
        model: true
      }))
      .concat(bond?.bids || []);
    select.value = 'all';
    range();
  }

  select.addEventListener('change', range);
  slider.addEventListener('input', draw);
  function inspect(event) {
    if (
      !position ||
      !visible.length ||
      (event.type === 'pointermove' && event.pointerType === 'touch')
    )
      return;
    const x = event.clientX - canvas.getBoundingClientRect().left;
    let nearest = 0;
    visible.forEach((_, i) => {
      if (
        Math.abs(position.forIndex(i) - x) <
        Math.abs(position.forIndex(nearest) - x)
      )
        nearest = i;
    });
    if (+slider.value !== nearest) {
      slider.value = nearest;
      draw();
    }
  }
  canvas.addEventListener('pointermove', inspect);
  canvas.addEventListener('click', inspect);
  new ResizeObserver(draw).observe(canvas.parentElement);
  return { show };
})();
