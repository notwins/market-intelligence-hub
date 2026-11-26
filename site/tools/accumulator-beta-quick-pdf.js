(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const modal = byId('beta-quick-pdf');
  const form = modal.querySelector('form');
  const whole = byId('beta-quick-all');
  const list = byId('beta-quick-sections');
  const status = byId('beta-quick-status');
  const open = byId('beta-quick-open');
  const close = byId('beta-quick-close');
  const download = byId('beta-quick-download');
  const selection = new Map();
  let sections = [];
  let busy = false;

  const skip = 'script, style, [hidden], [aria-hidden="true"], dialog, nav, .report-actions, .heading > a, .quote-actions a, .cmp-tools a, [data-cmp-plot]';
  const inline = /^(A|ABBR|B|BR|BUTTON|CODE|EM|I|INPUT|OUTPUT|SELECT|SMALL|SPAN|STRONG|SUB|SUP|TIME)$/;
  const tidy = value => value.replace(/\s+/g, ' ').trim();
  const visible = node => !node.matches(skip) && getComputedStyle(node).display !== 'none';

  function controlValue(node) {
    if (node.tagName === 'SELECT') {
      return Array.from(node.selectedOptions, option => tidy(option.textContent)).join(', ');
    }
    if (node.type === 'checkbox' || node.type === 'radio') return node.checked ? 'Yes' : 'No';
    return node.value || '';
  }

  function textOf(node, table = false) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE || !visible(node)) return '';
    if (node.tagName === 'BR') return ' ';
    if (node.tagName === 'IMG') return node.alt;
    if (node.tagName === 'SELECT' || node.tagName === 'INPUT') return ' ' + controlValue(node) + ' ';
    if (node.tagName === 'BUTTON' && !table && !node.classList.contains('cmp-picked')) return '';
    const text = Array.from(node.childNodes, child => textOf(child, table)).join('');
    const selected = table && node.tagName === 'BUTTON' && node.getAttribute('aria-pressed') === 'true';
    return selected ? text + ' [selected]' : text + (node.matches('small, li') ? ' ' : '');
  }

  function currentStyle() {
    return document.querySelector('.beta-styles [aria-pressed="true"]').textContent.trim();
  }

  function updateSelection() {
    const inputs = Array.from(list.querySelectorAll('input'));
    const count = inputs.filter(input => input.checked).length;
    whole.checked = count === inputs.length && count > 0;
    whole.indeterminate = count > 0 && count < inputs.length;
    download.disabled = busy || count === 0;
  }

  open.disabled = false;
  open.addEventListener('click', () => {
    sections = Array.from(document.querySelectorAll('[data-beta-panel]'))
      .filter(panel => !panel.closest('[hidden]') && visible(panel))
      .map(panel => {
        const heading = panel.querySelector('h2, .walkthrough > summary');
        const title = panel.id === 'accumulator-guide' ? 'Step-by-step guide' :
          tidy(heading?.textContent || panel.getAttribute('aria-label') || '');
        return {panel, heading, title, key: panel.id || panel.getAttribute('aria-labelledby')};
      }).filter(section => section.title);
    list.replaceChildren(...sections.map(({title, key}) => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = key;
      input.checked = selection.get(key) ?? true;
      label.append(input, title);
      return label;
    }));
    byId('beta-quick-style').textContent = currentStyle();
    status.textContent = '';
    updateSelection();
    modal.showModal();
  });

  modal.addEventListener('change', event => {
    if (event.target === whole) {
      list.querySelectorAll('input').forEach(input => { input.checked = whole.checked; });
    }
    list.querySelectorAll('input').forEach(input => selection.set(input.value, input.checked));
    status.textContent = '';
    updateSelection();
  });
  close.addEventListener('click', () => modal.close());
  modal.addEventListener('cancel', event => { if (busy) event.preventDefault(); });

  function snapshotSvg(source) {
    const bounds = source.getBoundingClientRect();
    const viewBox = source.viewBox.baseVal;
    const width = viewBox.width || Number(source.getAttribute('width')) || bounds.width;
    const height = viewBox.height || Number(source.getAttribute('height')) || bounds.height;
    const copy = source.cloneNode(true);
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    copy.setAttribute('width', width);
    copy.setAttribute('height', height);
    copy.setAttribute('viewBox', viewBox.width ? source.getAttribute('viewBox') : `0 0 ${width} ${height}`);
    copy.removeAttribute('style');
    const parts = copy.querySelectorAll('*');
    source.querySelectorAll('*').forEach((original, index) => {
      const style = getComputedStyle(original);
      for (const property of ['fill', 'stroke', 'font-family', 'font-size', 'font-weight']) {
        parts[index].style.setProperty(property, style.getPropertyValue(property));
      }
    });
    return {copy, width, height};
  }

  function chartBlocks(frame) {
    const axis = frame.querySelector('.axis svg');
    const plot = frame.querySelector('#plot svg, #overviewPlot svg');
    if (!axis || !plot) return [];
    const left = snapshotSvg(axis);
    const chart = snapshotSvg(plot);
    const sliceCount = Math.ceil(chart.width / 1450);
    const step = chart.width / sliceCount;
    return Array.from({length: sliceCount}, (_, index) => {
      const start = Math.max(0, Math.floor(index * step) - 20);
      const end = Math.min(chart.width, Math.ceil((index + 1) * step) + 20);
      const width = left.width + end - start;
      chart.copy.setAttribute('x', left.width);
      chart.copy.setAttribute('width', end - start);
      chart.copy.setAttribute('viewBox', `${start} 0 ${end - start} ${chart.height}`);
      return {kind: 'image', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${chart.height}">${left.copy.outerHTML}${chart.copy.outerHTML}</svg>`,
        label: sliceCount > 1 ? `Price chart • part ${index + 1} of ${sliceCount}` : ''};
    });
  }

  function snapshotTable(table) {
    const rows = Array.from(table.rows).filter(visible).map(row => ({
      header: row.parentElement.tagName === 'THEAD',
      cells: Array.from(row.cells).filter(visible).map(cell => {
        const style = getComputedStyle(cell);
        return {
          text: tidy(textOf(cell, true)), span: cell.colSpan,
          align: style.textAlign === 'center' ? 'center' : style.textAlign === 'right' ? 'right' : 'left',
          background: Array.from(style.backgroundColor.match(/\d+(?:\.\d+)?/g) || [], Number),
          tone: cell.matches('.negative, .cmp-worst') || cell.querySelector('.negative') ? 'negative' :
            cell.matches('.positive, .refund-cell, .cmp-refund, .cmp-best') || cell.querySelector('.positive') ? 'positive' : 'ink'
        };
      })
    })).filter(row => row.cells.length);
    return {kind: 'table', label: table.getAttribute('aria-label') || table.closest('.tableScroll')?.getAttribute('aria-label'), rows};
  }

  function collect(section) {
    const content = [];
    const pushText = (text, kind = 'text', logo) => {
      if (text) content.push({kind, text, logo});
    };
    function visit(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        pushText(tidy(node.textContent));
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE || !visible(node)) return;
      const tag = node.tagName.toUpperCase();
      if (node.classList.contains('chartFrame')) {
        content.push(...chartBlocks(node));
        return;
      }
      if (tag === 'TABLE') {
        content.push(snapshotTable(node));
        return;
      }
      if (tag === 'SVG' || tag === 'CANVAS' || tag === 'IMG') {
        if (tag === 'SVG') content.push({kind: 'image', svg: snapshotSvg(node).copy.outerHTML, label: node.getAttribute('aria-label')});
        if (tag === 'CANVAS' && node.width && node.height) content.push({kind: 'image', url: node.toDataURL(), label: node.getAttribute('aria-label')});
        if (tag === 'IMG' && node.currentSrc) content.push({kind: 'image', url: node.currentSrc, label: node.alt});
        return;
      }
      if (tag === 'DETAILS') {
        for (const child of node.children) {
          if (node.open || child.tagName === 'SUMMARY') visit(child);
        }
        return;
      }
      if (node === section.heading) return;
      if (tag === 'LABEL') {
        const control = node.control;
        if (control?.disabled && !control.value) return;
        const name = tidy(Array.from(node.childNodes, child =>
          child === control ? '' : textOf(child)).join(''));
        pushText(control ? [name, controlValue(control)].filter(Boolean).join('  |  ') : name, 'value');
        return;
      }
      if (/^H[2-6]$/.test(tag) || tag === 'SUMMARY' || tag === 'LEGEND') {
        const logo = node.id === 'snTitle' ? 'JPM' : node.id === 'siTitle' ? 'O39.SI' : undefined;
        pushText(tidy(textOf(node)), 'heading', logo);
        return;
      }
      if (inline.test(tag)) {
        pushText(tidy(textOf(node)));
        return;
      }
      if (node.matches('.legend, .nv-chart-key, .termstrip, .nvda-valuation-summary, #cmp-basket')) {
        pushText(Array.from(node.children).map(child => tidy(textOf(child))).filter(Boolean).join('  /  '), 'value');
        return;
      }
      // Keep inline text together while retaining the visible order of nested tables and figures.
      let run = '';
      function flush() {
        pushText(tidy(run), tag === 'DT' || tag === 'DD' ? 'value' : 'text');
        run = '';
      }
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE || inline.test(child.tagName || '')) {
          const value = textOf(child);
          run += child.tagName === 'SMALL' ? ' ' + value : value;
        } else {
          flush();
          visit(child);
        }
      }
      flush();
    }
    visit(section.panel);
    return {...section, content};
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
  }

  async function rasterize(block) {
    const url = block.svg ? URL.createObjectURL(new Blob([block.svg], {type: 'image/svg+xml;charset=utf-8'})) : block.url;
    try {
      const image = await loadImage(url);
      const canvas = document.createElement('canvas');
      const scale = Math.min(block.svg ? 2 : 1, 2200 / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      return {data: canvas.toDataURL('image/png'), ratio: canvas.width / canvas.height};
    } finally {
      if (block.svg) URL.revokeObjectURL(url);
    }
  }

  function themeColours() {
    const style = getComputedStyle(document.body);
    const tokens = {
      ink: '--ink', muted: '--muted', line: '--line', accent: '--teal', soft: '--soft',
      panel: '--beta-panel', hero: '--beta-hero', positive: '--beta-positive', negative: '--beta-negative'
    };
    return Object.fromEntries(Object.entries(tokens).map(([key, token]) => [key, style.getPropertyValue(token).trim()]));
  }

  // jsPDF's built-in Latin fonts retain selectable text and keep the download small.
  const printText = value => value
    .replace(/[\u2010-\u2015\u2212]/g, '-').replace(/\u2009|\u202f/g, ' ')
    .replace(/\u2192/g, ' to ').replace(/\u2191/g, '+').replace(/\u2193/g, '-')
    .replace(/\u2265/g, '>=').replace(/\u2264/g, '<=')
    .replace(/\u2713/g, '[selected]').replace(/\u25b2/g, '+').replace(/\u25bc/g, '-');

  async function createPdf(style, colour, snapshot) {
    if (!window.jspdf?.jsPDF) throw new Error('The PDF library could not load. Reload the page and try again.');
    const doc = new window.jspdf.jsPDF({format: 'a4', unit: 'mm', compress: true, putOnlyUsedFonts: true});
    const margin = 13;
    const pageWidth = doc.internal.pageSize.getWidth();
    const bottom = doc.internal.pageSize.getHeight() - 15;
    const width = pageWidth - 2 * margin;
    const stamp = new Intl.DateTimeFormat('en-SG', {
      dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Singapore'
    }).format(new Date()) + ' SGT';
    const logos = Object.fromEntries(await Promise.all(['NVDA', 'JPM', 'O39.SI'].map(async name =>
      [name, await rasterize({url: '../assets/company-logos/' + name + '.webp'}).catch(() => null)])));
    const images = new Map(await Promise.all(snapshot.flatMap(section => section.content).filter(block => block.kind === 'image')
      .map(async block => [block, await rasterize(block).catch(() => null)])));
    const missedFigures = Array.from(images.values()).filter(image => !image).length;
    let y = 0;

    function logo(name, x, top, size) {
      const image = logos[name];
      if (!image) return;
      doc.saveGraphicsState();
      doc.setGState(new doc.GState({opacity: .15}));
      doc.addImage(image.data, 'PNG', x, top, size * Math.min(1, image.ratio), size / Math.max(1, image.ratio), name);
      doc.restoreGraphicsState();
    }

    function font(size, tone = 'ink', kind = 'normal', family = 'helvetica') {
      doc.setFont(family, kind);
      doc.setFontSize(size);
      doc.setTextColor(colour[tone]);
    }

    function page(first = false) {
      if (!first) doc.addPage();
      doc.setFillColor(colour.hero);
      doc.rect(0, 0, pageWidth, first ? 39 : 15, 'F');
      doc.setFillColor(colour.accent);
      doc.rect(0, 0, pageWidth, 2.2, 'F');
      logo('NVDA', pageWidth - margin - (first ? 26 : 9), 3, first ? 26 : 9);
      font(first ? 23 : 11, 'ink', 'bold', 'times');
      doc.text('NVDA Accumulator Beta 2', margin, first ? 19 : 10);
      if (first) {
        font(9, 'muted');
        doc.text('Quick PDF  /  ' + style + ' colour style  /  ' + stamp, margin, 29);
      }
      y = first ? 46 : 22;
    }

    function room(height) {
      if (y + height > bottom) page();
    }

    function paragraph(text, size = 9.5, tone = 'ink', kind = 'normal', family = 'helvetica') {
      font(size, tone, kind, family);
      const lines = doc.splitTextToSize(printText(text), width);
      const spacing = size * .43;
      if (lines.length * spacing < 36) room(lines.length * spacing + 2);
      for (const line of lines) {
        room(spacing);
        font(size, tone, kind, family);
        doc.text(line, margin, y + size * .32);
        y += spacing;
      }
      y += 1.4;
    }

    function heading(block) {
      room(17);
      if (block.logo) logo(block.logo, pageWidth - margin - 12, y - 1, 12);
      paragraph(block.text, 12, 'accent', 'bold', 'times');
    }

    function drawTable(block) {
      if (!block.rows.length) return;
      const columns = Math.max(...block.rows.map(row => row.cells.reduce((count, cell) => count + cell.span, 0)));
      const fontSize = columns > 10 ? 7.2 : columns > 7 ? 8 : 8.7;
      const pad = columns > 10 ? 1.05 : 1.65;
      const firstWidth = columns > 3 ? width / columns * (columns > 10 ? 1.3 : 1.45) : width / columns;
      const remaining = columns > 1 ? (width - firstWidth) / (columns - 1) : 0;
      const layout = block.rows.map(row => {
        const merged = row.cells.length === 1 && columns > 1;
        let index = 0;
        const cells = row.cells.map(cell => {
          const cellWidth = index === 0 ? firstWidth + remaining * (cell.span - 1) : remaining * cell.span;
          index += cell.span;
          font(fontSize, cell.tone, row.header || merged ? 'bold' : 'normal');
          return {...cell, width: cellWidth, lines: doc.splitTextToSize(printText(cell.text), cellWidth - 2 * pad)};
        });
        return {...row, cells, merged, height: Math.max(1, ...cells.map(cell => cell.lines.length)) * fontSize * .42 + 2 * pad};
      });
      const headers = layout.filter(row => row.header);
      const body = layout.filter(row => !row.header);
      const headerHeight = headers.reduce((sum, row) => sum + row.height, 0);
      room(headerHeight + (body[0]?.height || 0) + (block.label ? 7 : 2));
      if (block.label) paragraph(block.label, 9, 'muted', 'bold');
      function drawRow(row, index) {
        let x = margin;
        row.cells.forEach(cell => {
          const [r, g, b, a = 1] = cell.background;
          if (row.header || row.merged) doc.setFillColor(colour.soft);
          else if (a > 0 && r !== undefined && (r < 250 || g < 250 || b < 250)) doc.setFillColor(r, g, b);
          else doc.setFillColor(index % 2 ? colour.panel : '#ffffff');
          doc.setDrawColor(colour.line);
          doc.setLineWidth(.15);
          doc.rect(x, y, cell.width, row.height, 'FD');
          font(fontSize, cell.tone, row.header || row.merged ? 'bold' : 'normal');
          const offset = cell.align === 'right' ? cell.width - pad : cell.align === 'center' ? cell.width / 2 : pad;
          doc.text(cell.lines, x + offset, y + pad + fontSize * .29, {align: cell.align});
          x += cell.width;
        });
        y += row.height;
      }
      headers.forEach(drawRow);
      body.forEach((row, index) => {
        const groupHeight = row.merged ? body[index + 1]?.height || 0 : 0;
        if (y + row.height + groupHeight > bottom) {
          page();
          headers.forEach(drawRow);
        }
        drawRow(row, index);
      });
      y += 3.4;
    }

    page(true);
    snapshot.forEach(({title, content}) => {
      room(26);
      doc.setDrawColor(colour.accent);
      doc.setLineWidth(.35);
      doc.line(margin, y, pageWidth - margin, y);
      y += 2.4;
      paragraph(title, 17, 'ink', 'bold', 'times');
      for (const block of content) {
        if (block.kind === 'table') drawTable(block);
        else if (block.kind === 'heading') heading(block);
        else if (block.kind === 'image') {
          const image = images.get(block);
          if (!image) {
            paragraph((block.label || 'Figure') + ' (image unavailable)', 8.5, 'muted');
            continue;
          }
          const imageHeight = Math.min(105, width / image.ratio);
          room(imageHeight + (block.label ? 9 : 4));
          if (block.label) paragraph(block.label, 8.5, 'muted');
          doc.addImage(image.data, 'PNG', margin, y, imageHeight * image.ratio, imageHeight);
          y += imageHeight + 3.5;
        } else paragraph(block.text, 9.5, 'ink', block.kind === 'value' ? 'bold' : 'normal');
      }
      y += 4;
    });

    const pages = doc.getNumberOfPages();
    for (let number = 1; number <= pages; number++) {
      doc.setPage(number);
      doc.setDrawColor(colour.line);
      doc.line(margin, bottom + 4, pageWidth - margin, bottom + 4);
      font(8, 'muted');
      doc.text(`Market Intelligence Hub  /  ${style}`, margin, bottom + 9);
      doc.text(`${number} / ${pages}`, pageWidth - margin, bottom + 9, {align: 'right'});
    }
    doc.setProperties({title: 'NVDA Accumulator Beta 2 - Quick PDF', subject: style + ' page style'});
    doc.save('NVDA-Accumulator-Beta-2-' + style + '.pdf');
    return missedFigures;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const chosen = sections.filter(section => selection.get(section.key) ?? true);
    if (busy || !chosen.length) return;
    busy = true;
    form.querySelector('fieldset').disabled = true;
    close.disabled = true;
    updateSelection();
    status.textContent = 'Preparing PDF…';
    try {
      const style = currentStyle();
      const colours = themeColours();
      const snapshot = chosen.map(collect);
      const missed = await createPdf(style, colours, snapshot);
      status.textContent = missed ? 'PDF downloaded. Some figures were unavailable.' : 'PDF downloaded.';
    } catch (error) {
      status.textContent = error instanceof Error && error.message.startsWith('The PDF library') ?
        error.message : 'The PDF could not be created. Please try again.';
    } finally {
      busy = false;
      form.querySelector('fieldset').disabled = false;
      close.disabled = false;
      updateSelection();
    }
  });
})();
