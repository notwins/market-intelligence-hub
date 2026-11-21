(function (root, factory) {
  const api = factory(
    typeof module === 'object' && module.exports
      ? require('./model.js')
      : root.BondCashflowModel
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BondStudioReport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (M) {
  'use strict';
  const C = {
    navy: '#173348',
    ink: '#203e50',
    muted: '#526a79',
    line: '#d6e1e5',
    pale: '#f0f5f5',
    teal: '#14766c',
    blue: '#375d97',
    rust: '#af5938',
    white: '#ffffff'
  };
  const esc = (s) =>
    String(s ?? '').replace(
      /[&<>"']/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        })[c]
    );
  const fmt = (v, d = 0) =>
    Number(v).toLocaleString('en-SG', {
      minimumFractionDigits: d,
      maximumFractionDigits: d
    });
  const cash = (v) => 'S$' + fmt(v),
    k = (v) => 'S$' + fmt(v / 1000, 1) + 'k',
    pct = (v) => fmt(v, 2) + '%',
    sgn = (v) => (v >= 0 ? '+' : '') + fmt(v, 1) + '%';
  class Page {
    constructor(title) {
      this.title = title;
      this.commands = [];
    }
    text(x, y, text, size = 9, color = C.ink, bold = false, align = 'left') {
      this.commands.push({
        type: 'text',
        x,
        y,
        text: String(text),
        size,
        color,
        bold,
        align
      });
    }
    rect(x, y, w, h, fill = C.white, stroke = null, width = 0.2, tooltip = '') {
      this.commands.push({
        type: 'rect',
        x,
        y,
        w,
        h,
        fill,
        stroke,
        width,
        tooltip
      });
    }
    line(x1, y1, x2, y2, color = C.line, width = 0.3, dash = false) {
      this.commands.push({ type: 'line', x1, y1, x2, y2, color, width, dash });
    }
    path(points, color, width = 0.6, dash = false) {
      if (points.length > 1)
        this.commands.push({ type: 'path', points, color, width, dash });
    }
    wrap(x, y, text, w, size = 8, color = C.muted, lineH = 4) {
      const max = Math.max(10, Math.floor(w / (size * 0.17)));
      let line = '',
        n = 0;
      for (const word of String(text).split(/\s+/)) {
        if ((line + ' ' + word).trim().length > max && line) {
          this.text(x, y + n * lineH, line, size, color);
          n++;
          line = word;
        } else line += (line ? ' ' : '') + word;
      }
      if (line) {
        this.text(x, y + n * lineH, line, size, color);
        n++;
      }
      return y + n * lineH;
    }
  }
  function crop(s, n = 90) {
    s = String(s);
    return s.length > n ? s.slice(0, n - 3) + '...' : s;
  }
  function mix(a, b, t) {
    return (
      '#' +
      [1, 3, 5]
        .map((i) =>
          Math.round(
            parseInt(a.slice(i, i + 2), 16) * (1 - t) +
              parseInt(b.slice(i, i + 2), 16) * t
          )
            .toString(16)
            .padStart(2, '0')
        )
        .join('')
    );
  }
  function tone(delta) {
    return delta < 0
      ? mix('#fff9f2', '#e5a475', Math.min(1, -delta / 40))
      : mix('#f3f8f6', '#78b8a8', Math.min(1, delta / 40));
  }
  function capitalSummary(p) {
    return {
      sgd: p.x.budget,
      currency: p.b.currency,
      equivalent: p.x.budget / p.x.fx,
      maturityValue: p.nominal,
      maturity: p.b.maturity
    };
  }
  function signedCash(v) {
    return (v < 0 ? '-' : '+') + cash(Math.abs(v));
  }
  function signedK(v) {
    return (v < 0 ? '-' : '+') + k(Math.abs(v));
  }
  function header(page, p, eyebrow, title, generated) {
    const cap = capitalSummary(p);
    page.rect(0, 0, 297, 7, C.navy);
    page.text(12, 14, eyebrow.toUpperCase(), 8, C.teal, true);
    page.text(
      285,
      14,
      'BOND CASHFLOW STUDIO  /  NO LOANS',
      7.4,
      C.muted,
      false,
      'right'
    );
    page.text(12, 23, title, 18, C.navy, true);
    page.text(
      12,
      30,
      crop(p.b.name, 90) +
        '  |  ' +
        (p.b.isin || 'Custom bond') +
        '  |  Purchase ' +
        p.x.settlement,
      8,
      C.muted
    );
    const cards = [
      {
        x: 12,
        w: 86,
        label: 'Maturity value (face amount)',
        value: cap.currency + ' ' + fmt(cap.maturityValue),
        note: 'Principal on ' + cap.maturity + '; assumes repayment',
        fill: '#eef3f5',
        color: C.navy
      },
      {
        x: 102,
        w: 87,
        label: 'Capital cash - ' + cap.currency + ' equivalent',
        value: cap.currency + ' ' + fmt(cap.equivalent),
        note:
          'At purchase FX: SGD ' +
          fmt(p.x.fx, 4) +
          ' for ' +
          cap.currency +
          ' 1',
        fill: '#e8f2ed',
        color: C.navy
      },
      {
        x: 193,
        w: 92,
        label: 'CAPITAL CASH - STARTING AMOUNT',
        value: 'SGD ' + fmt(cap.sgd),
        note: 'Your starting cash, before any upfront fees',
        fill: C.navy,
        color: C.white
      }
    ];
    cards.forEach((c) => {
      page.rect(c.x, 34, c.w, 19, c.fill);
      page.text(c.x + 4, 38.5, c.label, 7, c.color, true);
      page.text(c.x + 4, 45, c.value, 14, c.color, true);
      page.text(c.x + 4, 50, c.note, 6.6, c.color);
    });
    page.text(
      12,
      58,
      'Bought at ' +
        fmt(p.x.cleanPrice, 3) +
        ' per 100 of maturity value  |  Starting bond yield ' +
        pct(p.y0) +
        '  |  Interest rate ' +
        pct(p.b.coupon) +
        ' per year',
      7.6,
      C.ink,
      true
    );
    page.text(
      12,
      63,
      p.x.example
        ? 'ILLUSTRATIVE EXAMPLE - purchase price and FX are assumptions, not dealing quotes.'
        : crop(
            'Price: ' +
              (p.x.priceSource || 'User entered') +
              ' | FX: ' +
              (p.x.fxSource || 'User entered'),
            140
          ),
      7,
      C.rust
    );
    page.generated = generated;
  }
  function footer(page, p, index, total) {
    page.line(12, 197, 285, 197);
    page.text(
      12,
      202,
      'Illustration | Assumes all payments and no early repayment | Income not reinvested | ' +
        p.b.dayCount +
        ' | ' +
        page.generated,
      6.7,
      C.muted
    );
    page.text(
      285,
      202,
      String(index).padStart(2, '0') + ' / ' + total,
      8,
      C.ink,
      true,
      'right'
    );
  }
  // Display-only transpose. Engine matrix remains [FX index][yield index].
  // FX runs low to high across columns; the fixed coupon has only one row.
  function heatView(p, year) {
    const m = M.matrix(p, year),
      columns = m.fxs.map((fx, i) => ({ fx, sourceIndex: i })).reverse();
    return {
      columns,
      baseline: m.baseline,
      cashflow: columns.map((c) => ({
        fx: c.fx,
        value: m.cells[c.sourceIndex][3].cumulativeCF
      })),
      rows: m.yields.map((yieldTarget, j) => ({
        yieldTarget,
        appliedYield: m.cells[0][j].yield,
        price: m.cells[0][j].cleanPrice,
        repaid: m.cells[0][j].date >= p.b.maturity,
        cells: columns.map((c) => {
          const r = m.cells[c.sourceIndex][j];
          return { ...r, capitalPnl: r.nav - p.x.budget };
        })
      }))
    };
  }
  function fxHeading(p) {
    return (
      'FX: SGD for ' +
      p.b.currency +
      ' 1' +
      (p.x.path === 'gradual' ? ' - Year 10 targets' : '')
    );
  }
  function cashflowStrip(page, p, v, x, y, w) {
    const lw = 30,
      cw = (w - lw) / v.columns.length;
    page.text(x, y + 4, 'Cashflow received', 11, C.navy, true);
    page.text(
      x,
      y + 9,
      'Interest paid to you, added up to this year.',
      7.4,
      C.muted
    );
    page.text(x + w, y + 14, fxHeading(p), 6.9, C.muted, false, 'right');
    page.text(x, y + 27, 'Received', 7.4, C.ink, true);
    v.columns.forEach((c, i) => {
      const xx = x + lw + i * cw,
        value = v.cashflow[i].value,
        central = Math.abs(c.fx - p.x.fx) < 1e-8,
        delta = v.baseline.cumulativeCF
          ? 100 * (value / v.baseline.cumulativeCF - 1)
          : 0;
      page.text(xx + cw / 2, y + 18, fmt(c.fx, 3), 7.2, C.ink, true, 'center');
      page.rect(
        xx + 0.25,
        y + 21,
        cw - 0.5,
        9,
        tone(delta),
        central ? C.navy : C.white,
        central ? 0.65 : 0.15,
        'FX ' + fmt(c.fx, 4) + '; cashflow received ' + cash(value)
      );
      page.text(xx + cw / 2, y + 27, k(value), 8, C.ink, central, 'center');
    });
    page.text(
      x,
      y + 34,
      'Fixed interest in ' +
        p.b.currency +
        '; only its SGD value changes with the exchange rate.',
      6.9,
      C.muted
    );
  }
  function capitalMap(page, p, v, x, y, w) {
    const yieldW = 13,
      priceW = 17,
      lw = yieldW + priceW,
      cw = (w - lw) / v.columns.length,
      top = y + 26,
      rh = 7;
    page.text(x, y + 4, 'Capital remaining (NAV)', 11, C.navy, true);
    page.text(
      x,
      y + 9,
      'Your capital value and profit/loss, excluding cashflow.',
      7.4,
      C.muted
    );
    page.text(
      x,
      y + 14,
      'Top: capital value. Small line: profit/loss vs your starting cash.',
      6.9,
      C.muted
    );
    page.text(x + yieldW / 2, y + 19, 'Yield', 6.7, C.muted, true, 'center');
    page.text(x + yieldW / 2, y + 23, '%', 6.7, C.muted, true, 'center');
    page.text(
      x + yieldW + priceW / 2,
      y + 19,
      'Bond',
      6.7,
      C.muted,
      true,
      'center'
    );
    page.text(
      x + yieldW + priceW / 2,
      y + 23,
      'price*',
      6.7,
      C.muted,
      true,
      'center'
    );
    page.text(x + w, y + 19, fxHeading(p), 6.9, C.muted, false, 'right');
    v.columns.forEach((c, i) =>
      page.text(
        x + lw + (i + 0.5) * cw,
        y + 23,
        fmt(c.fx, 3),
        7.2,
        C.ink,
        true,
        'center'
      )
    );
    v.rows.forEach((row, j) => {
      const yy = top + j * rh;
      page.rect(x + yieldW, yy, priceW, rh, '#edf2f5');
      page.text(
        x + yieldW / 2,
        yy + 4.5,
        fmt(row.yieldTarget, 2),
        7.2,
        C.ink,
        true,
        'center'
      );
      page.text(
        x + yieldW + priceW / 2,
        yy + 4.5,
        row.repaid ? 'Repaid' : fmt(row.price, 2),
        7.2,
        C.navy,
        true,
        'center'
      );
      row.cells.forEach((r, i) => {
        const xx = x + lw + i * cw,
          central = j === 3 && Math.abs(v.columns[i].fx - p.x.fx) < 1e-8;
        page.rect(
          xx + 0.25,
          yy + 0.2,
          cw - 0.5,
          rh - 0.4,
          tone((100 * r.capitalPnl) / p.x.budget),
          central ? C.navy : C.white,
          central ? 0.65 : 0.15,
          'Capital value ' +
            cash(r.nav) +
            '; capital profit/loss ' +
            signedCash(r.capitalPnl) +
            '; bond price ' +
            fmt(r.cleanPrice, 3) +
            ' per 100'
        );
        page.text(
          xx + cw / 2,
          yy + 2.8,
          k(r.nav),
          7.3,
          C.ink,
          central,
          'center'
        );
        page.text(
          xx + cw / 2,
          yy + 5.7,
          signedK(r.capitalPnl),
          6.4,
          r.capitalPnl < 0 ? C.rust : C.teal,
          false,
          'center'
        );
      });
    });
  }
  function totalMap(page, p, v, x, y, w) {
    const lw = 14,
      cw = (w - lw) / v.columns.length,
      top = y + 29,
      rh = 12;
    page.text(x, y + 4, 'Cashflow + capital value', 11.5, C.navy, true);
    page.text(
      x,
      y + 9,
      'All your money, including interest received.',
      7.4,
      C.muted
    );
    page.text(
      x,
      y + 14,
      'Top: total value. Below: gain/loss in SGD.',
      6.9,
      C.muted
    );
    page.text(x + w, y + 20, fxHeading(p), 6.8, C.muted, false, 'right');
    page.text(x + lw / 2, y + 25, 'Yield %', 6.7, C.muted, true, 'center');
    v.columns.forEach((c, i) =>
      page.text(
        x + lw + (i + 0.5) * cw,
        y + 25,
        fmt(c.fx, 3),
        7.2,
        C.ink,
        true,
        'center'
      )
    );
    v.rows.forEach((row, j) => {
      const yy = top + j * rh;
      page.text(
        x + lw / 2,
        yy + rh / 2 + 1,
        fmt(row.yieldTarget, 2),
        7.2,
        C.ink,
        true,
        'center'
      );
      row.cells.forEach((r, i) => {
        const xx = x + lw + i * cw,
          central = j === 3 && Math.abs(v.columns[i].fx - p.x.fx) < 1e-8;
        page.rect(
          xx + 0.25,
          yy + 0.25,
          cw - 0.5,
          rh - 0.5,
          tone(r.returnPct),
          central ? C.navy : C.white,
          central ? 0.65 : 0.15,
          'Cashflow plus capital ' +
            cash(r.total) +
            '; total gain/loss ' +
            signedCash(r.gain)
        );
        page.text(
          xx + cw / 2,
          yy + rh / 2 - 1,
          k(r.total),
          7.8,
          C.ink,
          central,
          'center'
        );
        page.text(
          xx + cw / 2,
          yy + rh / 2 + 3,
          signedK(r.gain),
          6.5,
          r.gain < 0 ? C.rust : C.teal,
          false,
          'center'
        );
      });
    });
  }
  function heatPage(p, year, generated) {
    const v = heatView(p, year),
      b = v.baseline,
      page = new Page(
        'Year ' + year + ' - interest received and capital remaining'
      );
    header(
      page,
      p,
      'Year ' + String(year).padStart(2, '0') + ' / ' + b.date,
      'Your income and capital, side by side',
      generated
    );
    cashflowStrip(page, p, v, 12, 68, 142);
    capitalMap(page, p, v, 12, 106, 142);
    totalMap(page, p, v, 162, 68, 123);
    page.line(158, 69, 158, 182);
    page.text(
      12,
      188,
      'NO CHANGE:  interest received ' +
        cash(b.cumulativeCF) +
        '  +  capital ' +
        cash(b.nav) +
        '  =  ' +
        cash(b.total),
      8.5,
      C.navy,
      true
    );
    page.text(
      12,
      193,
      (p.x.path === 'gradual'
        ? 'Yield/FX are Year 10 targets. '
        : 'Yield/FX change after purchase. ') +
        '*Bond price per 100 at Year ' +
        year +
        '; unpaid interest is extra. Outlined = no change; amber = lower, teal = higher.',
      6.7,
      C.muted
    );
    return page;
  }
  function legend(page, series, x, y) {
    series.forEach((s, i) => {
      page.line(x + i * 56, y, x + i * 56 + 9, y, s.color, 0.8, s.dash);
      page.text(x + i * 56 + 12, y + 1, s.label, 8, C.ink);
    });
  }
  function chart(page, series, key, x, y, w, h, title, budget) {
    page.text(x, y + 4, title, 11, C.navy, true);
    const xx = x + 18,
      yy = y + 11,
      ww = w - 23,
      hh = h - 23,
      values = series.flatMap((s) => s.rows.map((r) => r[key])),
      lo =
        key === 'cumulativeCF'
          ? 0
          : Math.max(0, Math.min(...values, budget || Infinity) * 0.85),
      hi = Math.max(...values, budget || 0) * 1.1 || 1,
      xf = (t) => xx + (ww * t) / 10,
      yf = (v) => yy + hh - ((v - lo) / (hi - lo)) * hh;
    for (let i = 0; i <= 4; i++) {
      const v = lo + ((hi - lo) * i) / 4;
      page.line(xx, yf(v), xx + ww, yf(v), C.line, 0.2);
      page.text(
        xx - 2,
        yf(v) + 1,
        fmt(v / 1000, 0) + 'k',
        6.7,
        C.muted,
        false,
        'right'
      );
    }
    for (const v of [0, 2, 4, 6, 8, 10])
      page.text(xf(v), yy + hh + 5, String(v), 7, C.muted, false, 'center');
    page.text(
      xx + ww,
      yy + hh + 10,
      'Years from purchase',
      6.7,
      C.muted,
      false,
      'right'
    );
    if (budget && budget >= lo && budget <= hi) {
      page.line(xx, yf(budget), xx + ww, yf(budget), C.muted, 0.3, true);
      page.text(
        xx + ww - 1,
        yf(budget) + 3,
        'Original cash',
        6.4,
        C.muted,
        false,
        'right'
      );
    }
    series.forEach((s) =>
      page.path(
        s.rows.map((r) => [xf(r.years), yf(r[key])]),
        s.color,
        0.8,
        s.dash
      )
    );
    page.text(x + 1, y + 10, 'SGD', 6.8, C.muted);
  }
  function chartPage(r, generated) {
    const p = r.prepared,
      page = new Page('Ten-year scenario paths');
    header(
      page,
      p,
      'Ten-year view',
      'Income accumulates while market value moves',
      generated
    );
    legend(page, r.series, 12, 69);
    chart(
      page,
      r.series,
      'cumulativeCF',
      12,
      76,
      142,
      45,
      'Interest received',
      null
    );
    chart(
      page,
      r.series,
      'nav',
      12,
      128,
      142,
      55,
      'Capital value - excluding cashflow',
      p.x.budget
    );
    chart(
      page,
      r.series,
      'total',
      162,
      76,
      123,
      107,
      'Interest + capital value',
      p.x.budget
    );
    page.line(158, 76, 158, 182);
    page.text(
      12,
      189,
      'YEAR 10  ' +
        r.series
          .map((s) => s.label + ': ' + cash(s.rows[10].total))
          .join('   /   '),
      9,
      C.navy,
      true
    );
    page.text(
      12,
      194,
      'A/C are user-defined scenarios, not statistical best/worst bounds. No change holds yield and FX fixed; the bond price can still change over time.',
      7,
      C.muted
    );
    return page;
  }
  const eventStyles = [
    {
      id: 'trade2018',
      short: 'Tariffs',
      detail: '06 Jul 2018: US tariffs',
      color: '#9b4d26'
    },
    {
      id: 'qe2020',
      short: 'Fed buying',
      detail: '23 Mar 2020: Fed asset purchases',
      color: '#78509b'
    },
    {
      id: 'hikes2022',
      short: 'Rate rises',
      detail: '16 Mar 2022: Fed rate increase',
      color: '#286995'
    }
  ];
  function historyChart(page, p, ref, key, title, x, y, w, h, start, color) {
    const rows = ref.history.filter(
        (r) => r.date >= start && r.date <= p.x.settlement
      ),
      last = [...rows].reverse().find((r) => Number.isFinite(r[key]));
    page.text(x, y + 4, title, 10, color, true);
    if (!last) {
      page.text(
        x,
        y + 18,
        'No supplied observations for this range.',
        9,
        C.rust
      );
      return;
    }
    const isFX = key === 'fx',
      base = isFX && p.b.currency === 'USD' ? p.x.fx : last[key],
      forecast = p.targets.map((s) => ({
        color: s.color,
        values: [
          { date: p.x.settlement, v: base },
          ...Array.from({ length: 10 }, (_, i) => {
            const d = M.addYears(p.x.settlement, i + 1),
              f = M.factor(p, d);
            return {
              date: d,
              v: isFX
                ? p.b.currency === 'USD'
                  ? p.x.fx + (s.fx - p.x.fx) * f
                  : last[key]
                : base + (s.yield - p.y0) * f
            };
          })
        ]
      }));
    const vals = [
        ...rows.map((r) => r[key]).filter(Number.isFinite),
        ...forecast.flatMap((s) => s.values.map((v) => v.v))
      ],
      min = Math.min(...vals),
      max = Math.max(...vals),
      span = max - min || 1,
      lo = min - span * 0.12,
      hi = max + span * 0.12,
      xx = x + 13,
      yy = y + 20,
      ww = w - 17,
      hh = h - 33,
      startN = +M.date(start),
      cutN = +M.date(p.x.settlement),
      endN = +M.date(p.finalDate),
      historyW = ww * 0.8,
      cutX = xx + historyW;
    // Historical years have one scale. The ten future years use a narrower scale,
    // clearly labelled in the chart; both sections share the same vertical scale.
    const xf = (d) => {
        const n = +M.date(d);
        return n <= cutN
          ? xx + ((n - startN) / Math.max(1, cutN - startN)) * historyW
          : cutX + ((n - cutN) / (endN - cutN)) * (ww - historyW);
      },
      yf = (v) => yy + hh - ((v - lo) / (hi - lo)) * hh;
    page.rect(cutX, yy, ww - historyW, hh, '#f1f4f7');
    for (let i = 0; i < 4; i++) {
      const v = lo + ((hi - lo) * i) / 3;
      page.line(xx, yf(v), xx + ww, yf(v), C.line, 0.2);
      page.text(
        xx - 2,
        yf(v) + 1,
        fmt(v, isFX ? 2 : 1) + (isFX ? '' : '%'),
        6.6,
        color,
        false,
        'right'
      );
    }
    let segment = [];
    rows.forEach((row) => {
      if (Number.isFinite(row[key])) segment.push([xf(row.date), yf(row[key])]);
      else {
        page.path(segment, color, 0.5);
        segment = [];
      }
    });
    page.path(segment, color, 0.5);
    // No synthetic observations or bridge are drawn across missing historical data.
    forecast.forEach((s) =>
      page.path(
        s.values.map((v) => [xf(v.date), yf(v.v)]),
        s.color,
        0.6,
        true
      )
    );
    page.line(cutX, yy, cutX, yy + hh, C.muted, 0.3, true);
    page.text(
      cutX + (ww - historyW) / 2,
      y + 10,
      'FUTURE',
      6.5,
      C.muted,
      true,
      'center'
    );
    page.text(
      cutX + (ww - historyW) / 2,
      y + 14,
      '10 years, compressed',
      5.9,
      C.muted,
      false,
      'center'
    );
    const firstY = Number(start.slice(0, 4)),
      lastY = Number(p.finalDate.slice(0, 4));
    for (let yr = Math.ceil(firstY / 5) * 5; yr <= lastY; yr += 5) {
      const date = yr + '-01-01',
        px = xf(date);
      page.text(px, yy + hh + 4, String(yr), 6.5, C.muted, false, 'center');
    }
    eventStyles.forEach((style, i) => {
      const e = ref.events.find((e) => e.id === style.id);
      if (!e || e.date < start || e.date > p.x.settlement) return;
      const ex = xf(e.date),
        labelY = y + 8 + i * 4;
      page.line(ex, labelY + 1.3, ex, yy + hh, style.color, 0.2, true);
      page.text(
        Math.min(ex, cutX - 2),
        labelY,
        style.short,
        6.5,
        style.color,
        true,
        'right'
      );
    });
    page.text(
      x,
      y + h - 1,
      'Last data: ' +
        last.date +
        ' | ' +
        fmt(last[key], isFX ? 4 : 2) +
        (isFX ? ' SGD per USD' : '%') +
        ' | monthly observations',
      6.6,
      C.muted
    );
  }
  function appendixPage(p, ref, generated) {
    const page = new Page('Appendix - historical FX and Treasury yields');
    header(
      page,
      p,
      'Appendix / dated evidence',
      'Put future scenarios beside market history',
      generated
    );
    const years = Number(p.x.historyYears) || 99,
      start =
        years === 99
          ? ref.historyFrom
          : [ref.historyFrom, M.addYears(p.x.settlement, -years)].sort().pop();
    historyChart(
      page,
      p,
      ref,
      'fx',
      'USD/SGD exchange rate',
      12,
      68,
      132,
      52,
      start,
      '#286995'
    );
    historyChart(
      page,
      p,
      ref,
      'y10',
      '10-year US Treasury yield',
      153,
      68,
      132,
      52,
      start,
      '#78509b'
    );
    historyChart(
      page,
      p,
      ref,
      'y20',
      '20-year US Treasury yield',
      12,
      124,
      132,
      52,
      start,
      '#14766c'
    );
    historyChart(
      page,
      p,
      ref,
      'y30',
      '30-year US Treasury yield',
      153,
      124,
      132,
      52,
      start,
      '#9b4d26'
    );
    eventStyles.forEach((e, i) =>
      page.text(12 + i * 91, 181, e.detail, 7.1, e.color, true)
    );
    page.text(12, 186, 'Solid = history. Dashed = scenarios:', 7, C.ink);
    p.targets.forEach((s, i) => {
      const x = 93 + i * 54;
      page.line(x, 185, x + 7, 185, s.color, 0.6, true);
      page.text(x + 9, 186, s.label, 7, s.color, true);
    });
    page.text(
      12,
      191,
      'Future time is compressed to 20% of each chart. Missing observations remain gaps; purchase assumptions begin at the vertical divider.',
      6.9,
      C.muted
    );
    page.text(
      12,
      195,
      'Treasury paths provide context, not forecasts for the selected bond. Events mark dates, not proof of cause. ' +
        (p.b.currency === 'USD'
          ? 'FX starts at your purchase assumption.'
          : 'USD/SGD future paths stay flat for a non-USD bond.'),
      6.5,
      C.muted
    );
    return page;
  }
  function comparison(result, leftYear, rightYear, generated) {
    const p = result.prepared,
      years = [leftYear, rightYear].map(Number);
    if (years.some((y) => !Number.isInteger(y) || y < 1 || y > 10))
      throw Error('Choose years from 1 to 10.');
    const page = new Page('Compare Year ' + years[0] + ' and Year ' + years[1]);
    header(
      page,
      p,
      'Two years / same assumptions',
      'See what changes between two years',
      generated
    );
    const views = years.map((y) => heatView(p, y));
    views.forEach((v, i) => {
      const x = i ? 153 : 12,
        w = 132,
        b = v.baseline;
      page.rect(x, 67, w, 8, i ? '#e8edf7' : '#e5f0eb');
      page.text(
        x + 3,
        72.5,
        'YEAR ' + years[i] + '  /  ' + b.date,
        10,
        i ? C.blue : C.teal,
        true
      );
      cashflowStrip(page, p, v, x, 76, w);
      capitalMap(page, p, v, x, 113, w);
      page.text(
        x,
        192,
        'No change: interest + capital = ' + cash(b.total),
        8.5,
        i ? C.blue : C.teal,
        true
      );
    });
    page.line(148.5, 68, 148.5, 193);
    page.text(
      12,
      195.5,
      '*Bond prices are per 100, before unpaid interest. ' +
        (p.x.path === 'gradual'
          ? 'Yield/FX labels are Year 10 targets; each year follows the selected path.'
          : 'Yield/FX change immediately after purchase.'),
      6,
      C.muted
    );
    footer(page, p, 1, 1);
    return { pages: [page], width: 297, height: 210, result };
  }
  function sourcesPage(p, ref, generated) {
    const page = new Page('Assumptions, definitions and sources');
    header(
      page,
      p,
      'Model notes / source register',
      'What is included in the numbers',
      generated
    );
    let y = 69;
    const left = [
      [
        'Your starting cash',
        'The SGD amount is your original cash budget. Its USD (or other currency) equivalent uses the purchase exchange rate, before fees. This is different from the amount actually spent on bonds.'
      ],
      [
        'Cashflow means interest received',
        'Fixed bond interest does not change when market yields change. The SGD amount can change with the exchange rate on each payment date. Received interest is kept as cash and earns no further interest.'
      ],
      [
        'Capital value and profit/loss',
        'Capital remaining (NAV) is the bond value, unpaid interest and any unspent or repaid principal. It excludes interest already received. Capital profit/loss = this value minus your starting SGD cash. Total adds the received interest back once.'
      ],
      [
        'How the scenarios change over time',
        p.x.path === 'gradual'
          ? 'Yield and FX move linearly from purchase to Year 10. Each heat-map cell and each chart uses that same path.'
          : 'Yield and FX move immediately after purchase and then stay constant. Year 0 is the recorded purchase, before the shock.'
      ],
      [
        'Bond price and maturity value',
        'Bond price is quoted per 100 of principal, before unpaid interest. The face amount is the principal due at maturity, assuming repayment; it excludes interest. This ' +
          p.b.dayCount +
          ' model assumes every payment is made and the issuer does not repay early. Special call/default outcomes are not modelled.'
      ]
    ];
    for (const [h, t] of left) {
      page.text(12, y, h, 10, C.navy, true);
      y = page.wrap(12, y + 5, t, 128, 8, C.muted, 4) + 5;
    }
    let z = 69;
    page.text(153, z, 'Assumed market outcomes', 10, C.navy, true);
    z += 6;
    p.targets.forEach((s) => {
      page.text(
        153,
        z,
        s.label + '  |  Bond yield ' + pct(s.yield) + '  |  FX ' + fmt(s.fx, 4),
        8.2,
        s.color,
        true
      );
      z += 5;
    });
    z =
      page.wrap(
        153,
        z + 2,
        'A and C are illustrative endpoints. Downside is not a guaranteed minimum; losses can be worse. Constant yield is not a constant-price assumption.',
        132,
        8,
        C.muted,
        4
      ) + 4;
    page.text(153, z, 'Dated references', 10, C.navy, true);
    z += 5;
    z =
      page.wrap(
        153,
        z,
        ref.historySource +
          '; ' +
          ref.historyFrom +
          ' to ' +
          ref.historyTo +
          '. Reused as supplied, not independently revalidated point by point.',
        132,
        7.5,
        C.muted,
        3.8
      ) + 3;
    const sources = [
      ...(p.b.isin === 'US87973RAW07'
        ? [
            [
              'Bond identity / minimum',
              'temasek.com.sg/en/our-financials/temasek-bonds/temasek-financial-i-bonds'
            ],
            [
              'Callable / increment',
              'boerse-stuttgart.de - ISIN US87973RAW07 (make-whole; USD 1,000 step)'
            ]
          ]
        : []),
      [
        'Series definitions',
        'fred.stlouisfed.org/series/EXSIUS | GS10 | GS20 | GS30'
      ],
      [
        'Dated events',
        'ustr.gov - 2018 Section 301 tariff announcement; federalreserve.gov/newsevents/pressreleases/monetary20200323a.htm and monetary20220316a.htm'
      ]
    ];
    for (const [h, t] of sources) {
      page.text(153, z, h, 8, C.ink, true);
      z = page.wrap(153, z + 4, t, 132, 7.2, C.muted, 3.6) + 3;
    }
    page.text(
      153,
      z,
      'Full source links are available in the Studio.',
      7.2,
      C.muted
    );
    page.text(
      12,
      190,
      'Sizing: ' +
        p.x.lotMode +
        ' | Minimum ' +
        (p.b.minimum === null ? 'unconfirmed' : fmt(p.b.minimum)) +
        ' ' +
        p.b.currency +
        ' | Increment ' +
        (p.b.increment === null ? 'unconfirmed' : fmt(p.b.increment)) +
        ' | Unspent ' +
        cash(p.residual) +
        ' | Fees ' +
        cash(p.x.fees),
      7.5,
      C.ink,
      true
    );
    return page;
  }
  function tablePage(r, generated) {
    const p = r.prepared,
      page = new Page('Year-by-year cashflow, NAV and total');
    header(
      page,
      p,
      'Final table / exact model, rounded display',
      'Compare the same cash budget across all three paths',
      generated
    );
    page.text(
      12,
      70,
      'Spent on bonds including fees: ' +
        cash(p.cashUsed) +
        ' | Cash left over: ' +
        cash(p.residual),
      8.4,
      C.navy,
      true
    );
    const x = 12,
      y = 76,
      yearW = 12,
      groupW = 87,
      widths = [14, 23, 24, 26],
      rowH = 8;
    page.rect(x, y, yearW, 15, C.navy);
    page.text(x + 6, y + 10, 'Year', 8, C.white, true, 'center');
    r.series.forEach((s, j) => {
      const gx = x + yearW + j * groupW;
      page.rect(gx, y, groupW, 7, s.color);
      page.text(gx + groupW / 2, y + 4.8, s.label, 9, C.white, true, 'center');
      let xx = gx;
      ['Yield %', 'Interest', 'Capital', 'TOTAL'].forEach((label, i) => {
        page.rect(xx, y + 7, widths[i], 8, '#e8eff2');
        page.text(
          xx + widths[i] / 2,
          y + 12,
          label,
          7.5,
          C.navy,
          true,
          'center'
        );
        xx += widths[i];
      });
    });
    for (let yr = 0; yr <= 10; yr++) {
      const yy = y + 15 + yr * rowH;
      page.rect(x, yy, 273, rowH, yr % 2 ? '#f0f5f5' : C.white);
      page.text(x + 6, yy + 5.6, String(yr), 9, C.ink, true, 'center');
      r.series.forEach((s, j) => {
        const row = s.rows[yr],
          vals = [
            fmt(row.yield, 2),
            fmt(row.cumulativeCF),
            fmt(row.nav),
            fmt(row.total)
          ];
        let xx = x + yearW + j * groupW;
        vals.forEach((v, i) => {
          if (i === 3)
            page.rect(
              xx + 0.2,
              yy + 0.2,
              widths[i] - 0.4,
              rowH - 0.4,
              tone(row.returnPct)
            );
          page.text(
            xx + widths[i] - 2,
            yy + 5.6,
            v,
            i ? 7.5 : 7.2,
            C.ink,
            i === 3,
            'right'
          );
          xx += widths[i];
        });
      });
    }
    for (let j = 0; j <= 3; j++)
      page.line(
        x + yearW + j * groupW,
        y,
        x + yearW + j * groupW,
        y + 15 + 11 * rowH,
        C.line,
        0.3
      );
    page.text(
      12,
      182,
      'All amounts are SGD. Interest = all payments received so far. Capital = remaining value, excluding received interest; it is not profit alone.',
      7.5,
      C.muted
    );
    page.text(
      12,
      187,
      'Capital profit/loss = the Capital figure minus your starting cash. Total = Capital + Interest. Year 0 is before any interest is received.',
      7.5,
      C.muted
    );
    page.text(
      12,
      192,
      'Yield is the bond yield applied at each year. Annual interest payments and detailed amounts are available in Export values.',
      7.5,
      C.muted
    );
    return page;
  }
  function build(result, ref, generated) {
    const p = result.prepared,
      pages = [];
    for (let i = 1; i <= 10; i++) pages.push(heatPage(p, i, generated));
    pages.push(
      chartPage(result, generated),
      appendixPage(p, ref, generated),
      sourcesPage(p, ref, generated),
      tablePage(result, generated)
    );
    pages.forEach((pg, i) => footer(pg, p, i + 1, pages.length));
    return { pages, width: 297, height: 210, result };
  }
  function svg(page) {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 297 210" role="img" aria-label="' +
      esc(page.title) +
      '"><title>' +
      esc(page.title) +
      '</title><rect width="297" height="210" fill="white"/>' +
      page.commands
        .map((c) => {
          if (c.type === 'text')
            return (
              '<text x="' +
              c.x +
              '" y="' +
              c.y +
              '" fill="' +
              c.color +
              '" font-family="Arial,Helvetica,sans-serif" font-size="' +
              (c.size * 25.4) / 72 +
              '" font-weight="' +
              (c.bold ? 700 : 400) +
              '" text-anchor="' +
              { left: 'start', right: 'end', center: 'middle' }[c.align] +
              '">' +
              esc(c.text) +
              '</text>'
            );
          if (c.type === 'rect')
            return (
              '<rect x="' +
              c.x +
              '" y="' +
              c.y +
              '" width="' +
              c.w +
              '" height="' +
              c.h +
              '" fill="' +
              (c.fill || 'none') +
              '" stroke="' +
              (c.stroke || 'none') +
              '" stroke-width="' +
              c.width +
              '">' +
              (c.tooltip ? '<title>' + esc(c.tooltip) + '</title>' : '') +
              '</rect>'
            );
          if (c.type === 'line')
            return (
              '<line x1="' +
              c.x1 +
              '" y1="' +
              c.y1 +
              '" x2="' +
              c.x2 +
              '" y2="' +
              c.y2 +
              '" stroke="' +
              c.color +
              '" stroke-width="' +
              c.width +
              '" ' +
              (c.dash ? 'stroke-dasharray="1.5 1"' : '') +
              '/>'
            );
          return (
            '<path d="' +
            c.points
              .map(([x, y], i) => (i ? 'L' : 'M') + x + ' ' + y)
              .join(' ') +
            '" fill="none" stroke="' +
            c.color +
            '" stroke-width="' +
            c.width +
            '" ' +
            (c.dash ? 'stroke-dasharray="1.6 1"' : '') +
            '/>'
          );
        })
        .join('') +
      '</svg>'
    );
  }
  function pdf(report, JsPDF) {
    const out = new JsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: true,
      putOnlyUsedFonts: true
    });
    out.setProperties({
      title: 'Bond Cashflow Studio - conditional illustration',
      subject: 'Cash purchase, no loans; scenario analysis',
      creator: 'Bond Cashflow Studio 1.2'
    });
    const rgb = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
    report.pages.forEach((page, i) => {
      if (i) out.addPage('a4', 'landscape');
      page.commands.forEach((c) => {
        if (c.type === 'text') {
          out.setFont('helvetica', c.bold ? 'bold' : 'normal');
          out.setFontSize(c.size);
          out.setTextColor(...rgb(c.color));
          out.text(c.text, c.x, c.y, { align: c.align });
        } else if (c.type === 'rect') {
          if (c.fill) out.setFillColor(...rgb(c.fill));
          if (c.stroke) {
            out.setDrawColor(...rgb(c.stroke));
            out.setLineWidth(c.width);
          }
          out.rect(c.x, c.y, c.w, c.h, c.fill ? (c.stroke ? 'FD' : 'F') : 'S');
        } else {
          out.setDrawColor(...rgb(c.color));
          out.setLineWidth(c.width);
          out.setLineDashPattern(c.dash ? [1.5, 1] : [], 0);
          if (c.type === 'line') out.line(c.x1, c.y1, c.x2, c.y2);
          else
            for (let j = 1; j < c.points.length; j++)
              out.line(...c.points[j - 1], ...c.points[j]);
          out.setLineDashPattern([], 0);
        }
      });
    });
    return out;
  }
  return {
    build,
    comparison,
    svg,
    pdf,
    fmt,
    cash,
    signedCash,
    capitalSummary,
    heatView,
    tone,
    Page
  };
});
