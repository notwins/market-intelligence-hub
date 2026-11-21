(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BondCashflowModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Separate, pure scenario model. Does not read or change PortfolioApp or storage.
  // Dates, EOM scheduling and the final-period simple discount convention follow
  // the inspected Portfolio V7.4.30 bond-pricing.js. Dirty NAV is deliberate here.
  const VERSION = '1.0.0',
    DAY = 86400000;
  const copy = (x) => JSON.parse(JSON.stringify(x));
  const number = (x) =>
    x === null || x === undefined || x === '' ? NaN : Number(x);
  function date(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s))
      throw Error('Enter a valid date.');
    const d = new Date(s + 'T00:00:00Z');
    if (!Number.isFinite(+d) || d.toISOString().slice(0, 10) !== s)
      throw Error('Enter a valid date.');
    return d;
  }
  const iso = (d) => d.toISOString().slice(0, 10);
  function shift(d, months) {
    const t = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1)
    );
    const end = new Date(
      Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)
    ).getUTCDate();
    const prevEnd = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)
    ).getUTCDate();
    t.setUTCDate(
      d.getUTCDate() === prevEnd ? end : Math.min(d.getUTCDate(), end)
    );
    return t;
  }
  function addYears(s, y) {
    const d = date(s),
      whole = Math.floor(y),
      f = y - whole;
    const anchor = (k) =>
      new Date(
        Date.UTC(
          d.getUTCFullYear() + k,
          d.getUTCMonth(),
          Math.min(
            d.getUTCDate(),
            new Date(
              Date.UTC(d.getUTCFullYear() + k, d.getUTCMonth() + 1, 0)
            ).getUTCDate()
          )
        )
      );
    const a = anchor(whole),
      b = anchor(whole + 1);
    return iso(new Date(+a + Math.round(((b - a) / DAY) * f) * DAY));
  }
  function days360(a, b) {
    let d1 = a.getUTCDate(),
      d2 = b.getUTCDate();
    const lastFeb = (d) =>
      d.getUTCMonth() === 1 &&
      d.getUTCDate() ===
        new Date(Date.UTC(d.getUTCFullYear(), 2, 0)).getUTCDate();
    if (lastFeb(a) && lastFeb(b)) d2 = 30;
    if (lastFeb(a)) d1 = 30;
    if (d1 === 31) d1 = 30;
    if (d2 === 31 && d1 >= 30) d2 = 30;
    return (
      360 * (b.getUTCFullYear() - a.getUTCFullYear()) +
      30 * (b.getUTCMonth() - a.getUTCMonth()) +
      d2 -
      d1
    );
  }
  function schedule(b, settlement) {
    const s = date(settlement),
      m = date(b.maturity),
      f = number(b.frequency);
    if (![1, 2, 4].includes(f))
      throw Error('Coupon frequency must be 1, 2 or 4.');
    if (m <= s)
      return {
        dates: [],
        previous: null,
        next: null,
        elapsed: 0,
        remaining: 0
      };
    if ((m - s) / DAY > 150 * 366)
      throw Error('Maturity must be within 150 years.');
    const dates = [];
    let previous;
    for (let k = 0; k < 1000; k++) {
      const d = shift(m, (-k * 12) / f);
      if (d <= s) {
        previous = d;
        break;
      }
      dates.push(iso(d));
    }
    if (!previous) throw Error('Coupon schedule exceeds supported length.');
    dates.reverse();
    const next = date(dates[0]);
    const elapsed =
      b.dayCount === '30/360'
        ? days360(previous, s) / (360 / f)
        : (s - previous) / (next - previous);
    return {
      dates,
      previous: iso(previous),
      next: dates[0],
      elapsed,
      remaining: 1 - elapsed
    };
  }
  function price(b, at, yieldPct) {
    const y = number(yieldPct),
      c = number(b.coupon),
      f = number(b.frequency);
    if (!Number.isFinite(y) || y < 0 || y > 100)
      throw Error('Model yield must be between 0% and 100%.');
    if (!Number.isFinite(c) || c < 0 || c > 100)
      throw Error('Coupon must be between 0% and 100%.');
    if (date(at) >= date(b.maturity)) return { clean: 0, dirty: 0, accrued: 0 };
    const s = schedule(b, at),
      payment = c / f,
      q = y / 100 / f,
      accrued = payment * s.elapsed;
    let dirty = 0;
    if (s.dates.length === 1) dirty = (100 + payment) / (1 + q * s.remaining);
    else
      s.dates.forEach((_, i) => {
        dirty +=
          (payment + (i === s.dates.length - 1 ? 100 : 0)) /
          Math.pow(1 + q, i + s.remaining);
      });
    return { clean: dirty - accrued, dirty, accrued };
  }
  function implied(b, at, dirty) {
    let lo = 0,
      hi = 100;
    if (
      !(dirty > 0) ||
      dirty > price(b, at, lo).dirty + 1e-8 ||
      dirty < price(b, at, hi).dirty - 1e-8
    )
      throw Error(
        'Purchase price is outside the supported 0-100% yield range.'
      );
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (price(b, at, mid).dirty > dirty) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }
  function validate(input) {
    const x = input || {},
      b = x.bond || {},
      errors = [];
    const range = (v, lo, hi, label, strict = false) => {
      const n = number(v);
      if (!Number.isFinite(n) || (strict ? n <= lo : n < lo) || n > hi)
        errors.push(label);
    };
    range(x.budget, 0, 1e12, 'Enter the available SGD cash.', true);
    range(x.fx, 0, 1e6, 'Enter SGD per one unit of bond currency.', true);
    range(
      x.cleanPrice,
      0,
      1000,
      'Enter a clean purchase price per 100 face value.',
      true
    );
    range(
      x.fees,
      0,
      1e12,
      'Enter total upfront fees in SGD (zero is allowed).'
    );
    if (number(x.fees) >= number(x.budget))
      errors.push('Fees must be less than the cash budget.');
    range(b.coupon, 0, 100, 'Enter the annual coupon rate.');
    if (![1, 2, 4].includes(number(b.frequency)))
      errors.push('Choose a supported coupon frequency.');
    if (!['ACT/ACT', '30/360'].includes(b.dayCount))
      errors.push('Choose an accrual basis.');
    if (!['fixed', 'callable-proxy'].includes(b.structure))
      errors.push(
        'This structure is not supported. Confirm a regular fixed coupon or explicitly select a conditional no-call model.'
      );
    if (!/^[A-Z]{3}$/.test(b.currency || ''))
      errors.push('Enter a three-letter bond currency.');
    if (b.currency === 'SGD' && number(x.fx) !== 1)
      errors.push('An SGD bond must use an FX rate of 1.');
    try {
      if (date(x.settlement) >= date(b.maturity))
        errors.push('Maturity must be after the settlement date.');
      if ((date(b.maturity) - date(x.settlement)) / DAY > 150 * 366)
        errors.push('Maturity must be within 150 years.');
    } catch (e) {
      errors.push('Enter valid settlement and maturity dates.');
    }
    if (
      x.accruedOverride !== null &&
      x.accruedOverride !== undefined &&
      x.accruedOverride !== ''
    )
      range(
        x.accruedOverride,
        0,
        100,
        'Accrued interest per 100 must be non-negative.'
      );
    if (x.lotMode !== 'fractional') {
      range(
        b.minimum,
        0,
        1e12,
        'Enter the minimum face value, or use an illustrative fractional holding.',
        true
      );
      range(b.increment, 0, 1e12, 'Enter the face-value increment.', true);
    }
    if (!['gradual', 'immediate'].includes(x.path))
      errors.push('Choose the scenario path.');
    range(x.yieldStep, 0, 20, 'Yield grid step must be positive.', true);
    range(
      x.fxStep,
      0,
      30,
      'FX grid step must be above zero and at most 30%.',
      true
    );
    for (const k of ['up', 'down']) {
      range(x[k]?.yieldBps, -5000, 5000, 'Enter valid scenario yield shifts.');
      range(x[k]?.fxPct, -90, 500, 'Enter valid scenario FX changes.');
    }
    return [...new Set(errors)];
  }
  function prepare(input) {
    const errors = validate(input);
    if (errors.length) throw Error(errors.join(' '));
    const x = copy(input),
      b = x.bond;
    ['budget', 'fx', 'cleanPrice', 'fees', 'yieldStep', 'fxStep'].forEach(
      (k) => (x[k] = number(x[k]))
    );
    ['coupon', 'frequency'].forEach((k) => (b[k] = number(b[k])));
    ['minimum', 'increment'].forEach(
      (k) => (b[k] = Number.isFinite(number(b[k])) ? number(b[k]) : null)
    );
    const modelAccrued = price(b, x.settlement, 0).accrued;
    const accrued =
        x.accruedOverride === null ||
        x.accruedOverride === undefined ||
        x.accruedOverride === ''
          ? modelAccrued
          : number(x.accruedOverride),
      dirty = x.cleanPrice + accrued;
    const capacity = ((x.budget - x.fees) / x.fx / dirty) * 100;
    const nominal =
      x.lotMode === 'fractional'
        ? capacity
        : capacity + 1e-8 < b.minimum
          ? 0
          : b.minimum +
            Math.floor((capacity - b.minimum + 1e-8) / b.increment) *
              b.increment;
    const minimumCost =
      b.minimum === null ? null : x.fees + ((b.minimum * dirty) / 100) * x.fx;
    if (!(nominal > 0))
      throw Error(
        'Budget is below the minimum denomination. Minimum required: SGD ' +
          minimumCost.toFixed(2) +
          '. Adjust the budget or explicitly use an illustrative fractional holding.'
      );
    const cashUsed = ((nominal * dirty) / 100) * x.fx + x.fees,
      residual = Math.max(0, x.budget - cashUsed),
      y0 = implied(b, x.settlement, dirty);
    if (y0 - 3 * x.yieldStep < 0 || y0 + 3 * x.yieldStep > 100)
      throw Error(
        'The heat-map yield range crosses the supported 0-100% bounds. Reduce the yield step.'
      );
    const targets = [
      {
        key: 'up',
        label: 'A - Upside',
        yield: y0 + number(x.up.yieldBps) / 100,
        fx: x.fx * (1 + number(x.up.fxPct) / 100),
        color: '#14766c',
        dash: false
      },
      {
        key: 'base',
        label: 'B - No change',
        yield: y0,
        fx: x.fx,
        color: '#375d97',
        dash: false
      },
      {
        key: 'down',
        label: 'C - Downside',
        yield: y0 + number(x.down.yieldBps) / 100,
        fx: x.fx * (1 + number(x.down.fxPct) / 100),
        color: '#af5938',
        dash: true
      }
    ];
    for (const t of targets)
      if (t.yield < 0 || t.yield > 100 || !(t.fx > 0))
        throw Error(
          'A scenario target is outside the supported yield or FX range.'
        );
    if (b.currency === 'SGD') targets.forEach((t) => (t.fx = 1));
    const payments = schedule(b, x.settlement).dates.map((d) => ({
      date: d,
      couponNative: (nominal * b.coupon) / 100 / b.frequency,
      principalNative: d === b.maturity ? nominal : 0
    }));
    return {
      x,
      b,
      accrued,
      dirty,
      capacity,
      nominal,
      cashUsed,
      residual,
      y0,
      minimumCost,
      targets,
      payments,
      finalDate: addYears(x.settlement, 10),
      warnings: [
        ...(b.structure === 'callable-proxy'
          ? [
              'Conditional no-call illustration. Issuer call, make-whole, default and recovery are not modelled.'
            ]
          : []),
        ...(x.lotMode === 'fractional'
          ? [
              'Fractional illustration: the holding may not meet dealing minimums or increments.'
            ]
          : []),
        'Model day count: ' +
          b.dayCount +
          '. Confirm accrual, settlement and dealing conventions with the dealer.'
      ]
    };
  }
  function factor(p, d) {
    return p.x.path === 'immediate'
      ? d > p.x.settlement
        ? 1
        : 0
      : Math.max(
          0,
          Math.min(
            1,
            (date(d) - date(p.x.settlement)) /
              (date(p.finalDate) - date(p.x.settlement))
          )
        );
  }
  function levels(p, target, d) {
    const f = factor(p, d);
    return {
      yield: p.y0 + (target.yield - p.y0) * f,
      fx: p.b.currency === 'SGD' ? 1 : p.x.fx + (target.fx - p.x.fx) * f
    };
  }
  function project(p, years, target = p.targets[1]) {
    const at = addYears(p.x.settlement, years),
      level = levels(p, target, at);
    let cumulativeCF = 0,
      principalCash = 0,
      annualCF = 0;
    const prev = addYears(p.x.settlement, Math.max(0, years - 1)),
      ledger = [];
    for (const e of p.payments) {
      if (e.date > at) break;
      const fx = levels(p, target, e.date).fx,
        couponSGD = e.couponNative * fx,
        principalSGD = e.principalNative * fx;
      cumulativeCF += couponSGD;
      principalCash += principalSGD;
      if (e.date > prev) annualCF += couponSGD;
      ledger.push({ ...e, fx, couponSGD, principalSGD });
    }
    const px =
      years === 0
        ? { clean: p.x.cleanPrice, dirty: p.dirty, accrued: p.accrued }
        : price(p.b, at, level.yield);
    const bondNAV = ((p.nominal * px.dirty) / 100) * level.fx,
      cleanNAV = ((p.nominal * px.clean) / 100) * level.fx,
      accruedNAV = ((p.nominal * px.accrued) / 100) * level.fx,
      nav = bondNAV + p.residual + principalCash,
      total = nav + cumulativeCF;
    return {
      years,
      date: at,
      yield: level.yield,
      fx: level.fx,
      cleanPrice: px.clean,
      dirtyPrice: px.dirty,
      cleanNAV,
      accruedNAV,
      bondNAV,
      residual: p.residual,
      principalCash,
      annualCF,
      cumulativeCF,
      nav,
      total,
      gain: total - p.x.budget,
      returnPct: (total / p.x.budget - 1) * 100,
      ledger
    };
  }
  function run(input) {
    const p = prepare(input),
      series = p.targets.map((target) => ({
        ...target,
        rows: Array.from({ length: 11 }, (_, i) => project(p, i, target))
      }));
    return { version: VERSION, prepared: p, series };
  }
  function matrix(p, year) {
    const yields = Array.from(
        { length: 7 },
        (_, i) => p.y0 + (i - 3) * p.x.yieldStep
      ),
      fxs =
        p.b.currency === 'SGD'
          ? [1]
          : Array.from(
              { length: 7 },
              (_, i) => p.x.fx * (1 + ((3 - i) * p.x.fxStep) / 100)
            );
    return {
      yields,
      fxs,
      cells: fxs.map((fx) =>
        yields.map((yieldPct) => project(p, year, { yield: yieldPct, fx }))
      ),
      baseline: project(p, year)
    };
  }
  function toCSV(result) {
    const header = [
      'Scenario',
      'Year',
      'Date',
      'Yield_pct',
      'SGD_per_bond_currency',
      'Clean_price',
      'Dirty_price',
      'Annual_coupons_SGD',
      'Cumulative_coupons_SGD',
      'Clean_bond_NAV_SGD',
      'Accrued_NAV_SGD',
      'Residual_SGD',
      'Redeemed_principal_SGD',
      'NAV_SGD',
      'Total_SGD',
      'Gain_SGD'
    ];
    const rows = result.series.flatMap((s) =>
      s.rows.map((r) => [
        s.label,
        r.years,
        r.date,
        r.yield,
        r.fx,
        r.cleanPrice,
        r.dirtyPrice,
        r.annualCF,
        r.cumulativeCF,
        r.cleanNAV,
        r.accruedNAV,
        r.residual,
        r.principalCash,
        r.nav,
        r.total,
        r.gain
      ])
    );
    const esc = (v) => '"' + String(v).replace(/"/g, '""') + '"';
    return [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
  }
  return {
    VERSION,
    DAY,
    date,
    iso,
    shift,
    addYears,
    days360,
    schedule,
    price,
    implied,
    validate,
    prepare,
    factor,
    levels,
    project,
    run,
    matrix,
    toCSV
  };
});
