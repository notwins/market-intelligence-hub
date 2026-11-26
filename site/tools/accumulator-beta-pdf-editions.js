(() => {
  'use strict';
  const fmt = window.AccumulatorFormat;
  const iso = value => new Date(value + 'T00:00:00Z');
  const date = value => Number.isFinite(iso(value).getTime()) ?
    new Intl.DateTimeFormat('en-GB', {day:'numeric', month:'short', year:'numeric', timeZone:'UTC'}).format(iso(value)) : 'Unavailable';
  const month = value => new Intl.DateTimeFormat('en-GB', {month:'short', year:'2-digit', timeZone:'UTC'}).format(new Date(value));
  const riskText = 'Purchases at strike can produce losses when NVDA falls. A knock-out ends further purchases, subject to the guarantee. Issuer default can cause a total loss.';

  function history(market, years = 3) {
    const latest = market.latest?.[0];
    const cutoff = iso(latest);
    if (!Number.isFinite(cutoff.getTime())) return [];
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - years);
    const first = cutoff.toISOString().slice(0, 10);
    const seen = new Map([...market.ordered, market.latest]);
    return Array.from(seen).filter(([day, price]) => day >= first && day <= latest && Number.isFinite(price) && price > 0)
      .sort(([left], [right]) => left.localeCompare(right));
  }

  function writer({doc, colour, stamp, logo, printText}) {
    const left = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const width = pageWidth - 2 * left;
    let rendered = false;

    const format = (size, tone, weight = 'normal', family = 'helvetica') => {
      doc.setFont(family, weight);
      doc.setFontSize(size);
      doc.setTextColor(colour[tone]);
    };
    const write = (value, x, y, {size = 10, tone = 'ink', align = 'left', weight = 'normal', family = 'helvetica', span} = {}) => {
      if (value === null || value === undefined) return;
      const line = printText(String(value));
      format(size, tone, weight, family);
      if (span && doc.getTextWidth(line) > span) doc.setFontSize(size * span / doc.getTextWidth(line));
      doc.text(line, x, y, {align});
    };
    const line = (tone, x, y, end, bottom = y, thickness = .25) => {
      doc.setDrawColor(colour[tone]);
      doc.setLineWidth(thickness);
      doc.line(x, y, end, bottom);
    };
    const fill = (tone, x, y, span, height, radius = 0) => {
      doc.setFillColor(colour[tone]);
      if (radius) doc.roundedRect(x, y, span, height, radius, radius, 'F');
      else doc.rect(x, y, span, height, 'F');
    };
    const paragraph = (value, y, {x = left, span = width, size = 10, tone = 'muted', weight = 'normal'} = {}) => {
      if (!value) return y;
      format(size, tone, weight);
      const lines = doc.splitTextToSize(printText(value), span);
      doc.text(lines, x, y, {lineHeightFactor:1.25});
      return y + lines.length * size * .45;
    };
    const heading = (value, y) => write(value, left, y, {size:17, family:'times', weight:'bold', span:width});
    const source = (label, url, y, x = left) => {
      write(label, x, y, {size:8.3, tone:'secondary', weight:'bold', span:width - (x - left)});
      if (url) doc.link(x, y - 3, doc.getTextWidth(printText(label)), 4, {url});
    };

    function page(kicker, title, subtitle) {
      if (rendered) doc.addPage();
      rendered = true;
      fill('accent', 0, 0, pageWidth * .52, 2.2);
      fill('secondary', pageWidth * .52, 0, pageWidth * .26, 2.2);
      fill('tertiary', pageWidth * .78, 0, pageWidth * .22, 2.2);
      fill('hero', 0, 2.2, pageWidth, 38);
      fill('secondaryLight', pageWidth - 47, 2.2, 47, 38);
      logo('NVDA', pageWidth - 40, 5, 27);
      write(kicker, left, 11, {size:8, tone:'accent', weight:'bold'});
      write(title, left, 25, {size:29, family:'times', weight:'bold', span:width - 34});
      write(subtitle || stamp, left, 34, {size:8.7, tone:'muted', span:width - 34});
    }

    function cards(items, y, {height = 27, size = 21} = {}) {
      const gap = 3;
      const cardWidth = (width - gap * (items.length - 1)) / items.length;
      const backgrounds = ['soft', 'secondaryLight', 'tertiaryLight'];
      const tones = ['accent', 'secondary', 'tertiary'];
      items.forEach(({label, value, note, tone}, i) => {
        const x = left + i * (cardWidth + gap);
        fill(backgrounds[i % 3], x, y, cardWidth, height, 2);
        write(label, x + 4, y + 6, {size:8.2, tone:'muted', weight:'bold', span:cardWidth - 8});
        write(value, x + 4, y + 17.8, {size, tone:tone || tones[i % 3], family:'times', weight:'bold', span:cardWidth - 8});
        if (note) write(note, x + 4, y + height - 3.2, {size:8.1, tone:'muted', span:cardWidth - 8});
      });
    }

    function table(y, columns, rows, options = {}) {
      const {rowHeight = 9.4, size = 9.4, x = left, shade = 'soft'} = options;
      const span = columns.reduce((sum, column) => sum + column.width, 0);
      function row(values, top, header, index) {
        if (header || index % 2 === 0) fill(header ? shade : 'panel', x, top, span, rowHeight);
        let cellX = x;
        values.forEach((entry, i) => {
          const {width:cellWidth,align = 'left'} = columns[i];
          const cell = typeof entry === 'object' && entry !== null ? entry : {text:entry};
          const position = align === 'right' ? cellX + cellWidth - 3 : cellX + 3;
          const tone = header ? 'accent' : cell.tone || 'ink';
          write(cell.text ?? 'Unavailable', position, top + rowHeight * .67,
            {size:header ? size - .65 : size, tone, align, weight:header || i === 0 || cell.bold ? 'bold' : 'normal', span:cellWidth - 6});
          if (!header && cell.url) doc.link(cellX + 2, top + 1, cellWidth - 4, rowHeight - 2, {url:cell.url});
          cellX += cellWidth;
        });
        if (!header) line('line', x, top + rowHeight, x + span, top + rowHeight, .14);
      }
      row(columns.map(column => column.label), y, true, 0);
      rows.forEach((values, index) => row(values, y + (index + 1) * rowHeight, false, index));
      return y + (rows.length + 1) * rowHeight;
    }

    function chart(series, y, height, {axis = value => fmt.money(value), dateAxis = month, zero = false} = {}) {
      const valid = series.map(item => ({...item, values:item.values.map(([day, value]) => [Date.parse(day), value])
        .filter(([x, v]) => Number.isFinite(x) && Number.isFinite(v)).sort((a,b) => a[0]-b[0])})).filter(item=>item.values.length>=2);
      fill('panel', left, y, width, height, 2);
      if (!valid.length) {
        write('Insufficient sourced observations for this chart.', left + 5, y + 10, {tone:'muted'});
        return false;
      }
      const entries = valid.flatMap(item => item.values);
      const earliest = Math.min(...entries.map(([day]) => day));
      const latest = Math.max(...entries.map(([day]) => day));
      const min = Math.min(...entries.map(([,value]) => value), ...(zero ? [0] : []));
      const max = Math.max(...entries.map(([,value]) => value));
      const cushion = Math.max(.1, (max - min) * .09);
      const floor = min >= 0 ? Math.max(0, min - cushion) : min - cushion;
      const ceiling = max + cushion;
      const startX = left + 21;
      const endX = left + width - 7;
      const plotTop = y + 4;
      const plotBottom = y + height - (valid.length > 1 ? 16 : 9);
      const x = day => startX + (endX - startX) * (day - earliest) / Math.max(1, latest - earliest);
      const vertical = value => plotTop + (plotBottom - plotTop) * (ceiling - value) / (ceiling - floor);
      for (let i = 0; i < 4; i++) {
        const value = floor + (ceiling - floor) * i / 3;
        const px = vertical(value);
        line('line', startX, px, endX);
        write(axis(value), startX - 3, px + .8, {size:8, tone:'muted', align:'right', span:17});
      }
      [0, 1/3, 2/3, 1].forEach(fraction => {
        const day = earliest + (latest - earliest) * fraction;
        write(dateAxis(day), x(day), plotBottom + 5, {size:8, tone:'muted', align:'center'});
      });
      valid.forEach(({tone, values}) => {
        const [firstDay, firstValue] = values[0];
        const moves = values.slice(1).map(([day, value], index) =>
          [x(day) - x(values[index][0]), vertical(value) - vertical(values[index][1])]);
        doc.setDrawColor(colour[tone]);
        doc.setLineWidth(.62);
        doc.lines(moves, x(firstDay), vertical(firstValue), [1, 1], 'S');
      });
      if (valid.length > 1) {
        valid.forEach(({label,tone}, index) => {
          const slot = width / valid.length;
          const start = left + 3 + index * slot;
          line(tone, start, y + height - 3.6, start + 6, y + height - 3.6, .7);
          write(label, start + 8, y + height - 2.6, {size:8, tone:'muted', span:slot - 12});
        });
      }
      return true;
    }

    function note(label, content, y, height = 22, tone = 'tertiary') {
      fill(tone + 'Light', left, y, width, height, 2);
      fill(tone, left, y, 1, height);
      write(label, left + 4, y + 6, {size:9.4, weight:'bold', tone, span:width - 8});
      paragraph(content, y + 11, {x:left + 4, span:width - 8, size:9.1, tone:'ink'});
    }

    return {page, heading, write, paragraph, cards, table, chart, note, source, left, width, stamp};
  }

  function client(w, live, market) {
    const {quote, spot, simulation, scenarioResults} = live;
    const gap = Math.round((spot - simulation.strike) * 100) / 100;
    const discount = fmt.quote(Math.abs(gap) / spot * 100);
    w.page('CLIENT ONE-PAGER  /  INDICATIVE STRUCTURE', 'NVDA accumulator',
      quote.product + '  /  ' + quote.months + ' months  /  ' + quote.minimum + '-month guarantee  /  Quote ' + date(quote.asOf));
    w.cards([
      {label:gap >= 0 ? 'ENTRY DISCOUNT' : 'ENTRY PREMIUM',value:discount,
        note:fmt.price(simulation.strike) + ' strike vs ' + fmt.price(spot) + ' starting price'},
      {label:'UPFRONT CASH REQUIRED',value:fmt.money(simulation.payment),note:'USD  /  ' + fmt.shares(simulation.maximum) + ' shares per month'}
    ], 47, {height:33, size:27});
    w.write('Daily knock-out  ' + fmt.price(simulation.ko), w.left, 89, {size:10.5, weight:'bold', tone:'tertiary'});
    w.heading('Three possible outcomes', 103);
    const order = ['fall', 'recover', 'rally'];
    const outcomes = [...scenarioResults].sort((a,b) => order.indexOf(a.s.id) - order.indexOf(b.s.id));
    const columns = [{label:'Illustration',width:64},{label:'NVDA at exit',width:34,align:'right'},
      {label:'Gross P&L',width:44,align:'right'},{label:'Return',width:w.width - 142,align:'right'}];
    w.table(109, columns, outcomes.map(({s,m}) => {
      const {exit} = m;
      const tone = exit.profit < 0 ? 'negative' : 'positive';
      return [s.id === 'rally' ? (m.koDay ? 'Rally / KO day ' + m.koDay : 'Rally to maturity') : s.name,
        fmt.price(exit.price), {text:fmt.returnMoney(exit.profit),tone,bold:true}, {text:fmt.signedRate(exit.rate),tone,bold:true}];
    }), {rowHeight:11,size:11});
    w.paragraph('Gross illustrations on upfront cash, assuming disposal at the modelled exit price.', 160, {size:8.8});
    const points = history(market);
    w.heading('NVDA price history  /  3 years', 173);
    w.chart([{tone:'accent',values:points}], 180, 60);
    const range = points.length > 1 ? date(points[0][0]) + ' to ' + date(points.at(-1)[0]) : 'History unavailable';
    w.paragraph(range + '  /  Split-adjusted USD closes  /  ' + (market.source || 'Hub history'), 244, {size:8});
    w.note('Capital at risk', riskText, 253, 22);
  }

  window.AccumulatorPdfEditions = {writer, client, history, date, riskText};
})();
