/* Presentation-only reflow of the immutable study's existing SVG coordinates. */
(() => {
  'use strict';
  const mounted = new WeakMap();
  function xMap(value, width) { return 50 + (value - 58) * (width - 68) / 826; }
  function fit(svg, width) {
    const sx = (width - 68) / 826, dx = 50 - 58 * sx;
    svg.setAttribute('viewBox', `0 0 ${width} 350`);
    svg.style.cssText = 'display:block;min-width:0;width:100%;height:350px;max-width:100%';
    svg.querySelectorAll('path').forEach(p => { p.setAttribute('transform', `matrix(${sx} 0 0 1 ${dx} 0)`); p.setAttribute('vector-effect', 'non-scaling-stroke'); });
    svg.querySelectorAll('line,circle,text').forEach(n => {
      for (const a of ['x', 'x1', 'x2', 'cx']) if (n.hasAttribute(a)) n.setAttribute(a, xMap(Number(n.getAttribute(a)), width));
      if (n.tagName.toLowerCase() === 'text') {
        n.style.fontSize = '11px';
        const y = Number(n.getAttribute('y'));
        if (y === 313 && !['-12', '-6', '0', '+6', '+12'].includes(n.textContent)) n.setAttribute('visibility', 'hidden');
        if (y === 341) n.textContent = 'Months before / after event';
        if (y === 20) { n.setAttribute('x', width / 2); n.setAttribute('text-anchor', 'middle'); }
      }
    });
  }
  function mount(frame) {
    if (mounted.has(frame)) { mounted.get(frame)(); return; }
    let doc; try { doc = frame.contentDocument; if (!doc?.querySelector('.share-panel')) return; } catch { return; }
    const originals = new WeakMap(); let queued = false, expanded;
    const style = doc.createElement('style');
    style.textContent = '.hub-chart-tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:8px 0;font-size:12px}.hub-chart-tools button{min-height:44px;padding:8px 12px;cursor:pointer;border:1px solid #aabcc4;border-radius:7px;background:#f2f7f8;color:#203e4a}.hub-chart-value{font-size:12px;line-height:1.5;min-height:1.5em}.hub-scroll-hint{font-size:12px;color:#425f6c;margin:8px 0}.chart-scroll{max-width:100%;min-width:0}@media(max-width:760px){.share-panel{min-width:0}.legend{max-height:110px;overflow:auto}.shares-table th:first-child{width:130px!important;min-width:130px!important;max-width:130px!important}}';
    doc.head.append(style);
    function show(original, opener) {
      expanded?.remove(); expanded = document.createElement('dialog'); expanded.className = 'hub-chart-expanded';
      expanded.style.cssText = 'position:fixed;inset:12px;margin:auto;box-sizing:border-box;width:min(1100px,calc(100vw - 24px));max-height:90dvh;overflow:auto;padding:16px;border:1px solid #afc3ca;border-radius:14px;background:white;color:#203e4a';
      expanded.innerHTML = '<header style="display:flex;align-items:center;justify-content:space-between;gap:12px"><h2 style="font-size:18px">Event chart detail</h2><button type="button" style="min-width:44px;min-height:44px">Close ×</button></header><p>Swipe left or right for the full-size chart. Exact observations remain in the table below the overview.</p><div tabindex="0" role="region" aria-label="Full-size chart; scroll horizontally" style="overflow:auto;max-width:100%"></div>';
      const copy = original.cloneNode(true); copy.style.cssText = 'display:block;width:930px;min-width:930px;height:350px';
      expanded.querySelector('[role=region]').append(copy); document.body.append(expanded);
      expanded.querySelector('button').onclick = () => expanded.close();
      expanded.addEventListener('close', () => opener.isConnected && opener.focus({preventScroll:true})); expanded.showModal();
    }
    function refresh() {
      queued = false;
      if (!frame.isConnected) { observer.disconnect(); resize.disconnect(); expanded?.remove(); return; }
      doc.querySelectorAll('.chart-scroll > svg.chart').forEach(svg => {
        let saved = originals.get(svg);
        const width = Math.max(240, Math.floor(svg.parentElement.clientWidth));
        if (!saved) {
          const original = svg.cloneNode(true), sourceNodes = svg.querySelectorAll('*'), copies = original.querySelectorAll('*');
          sourceNodes.forEach((n, i) => { const c = doc.defaultView.getComputedStyle(n); for (const prop of ['fill','stroke','stroke-width','font-size','font-family']) copies[i].style.setProperty(prop, c.getPropertyValue(prop)); });
          saved = {original, width:0}; originals.set(svg, saved);
          const tools = doc.createElement('div'); tools.className = 'hub-chart-tools';
          const button = doc.createElement('button'); button.type = 'button'; button.textContent = 'Expand chart'; button.onclick = () => show(original, button);
          const note = doc.createElement('span'); note.textContent = 'Full timeline · tap a point for its value'; tools.append(button, note);
          svg.parentElement.before(tools);
          const status = doc.createElement('p'); status.className = 'hub-chart-value'; status.setAttribute('aria-live','polite'); svg.parentElement.after(status);
          svg.addEventListener('click', e => {
            const points = [...svg.querySelectorAll('circle')], matrix = svg.getScreenCTM(); if (!matrix) return;
            let best, distance = 25;
            for (const point of points) { const p = new DOMPoint(Number(point.getAttribute('cx')), Number(point.getAttribute('cy'))).matrixTransform(matrix), d = Math.hypot(p.x-e.clientX,p.y-e.clientY); if (d<distance) {best=point;distance=d;} }
            status.textContent = best?.querySelector('title')?.textContent || 'Tap nearer a point, or use the exact values in the table below.';
          });
        }
        if (saved.width === width) return;
        saved.width = width; svg.innerHTML = saved.original.innerHTML;
        if (width < 760) fit(svg, width);
        else { svg.setAttribute('viewBox','0 0 930 350'); svg.style.cssText = 'min-width:0;width:100%;height:auto'; }
        svg.parentElement.setAttribute('aria-label','Full event timeline; exact observations in the following table');
      });
      doc.querySelectorAll('.share-panel .scroll').forEach(el => {
        const anchor = el.parentElement.classList.contains('hub-event-layout') ? el.parentElement : el;
        if (anchor.previousElementSibling?.classList.contains('hub-scroll-hint')) return;
        const hint = doc.createElement('p'); hint.className='hub-scroll-hint'; hint.textContent='Data table · swipe left / right for all months. Company names stay visible.'; anchor.before(hint);
      });
    }
    function schedule() { if (!queued) { queued=true; requestAnimationFrame(refresh); } }
    const observer = new MutationObserver(schedule); observer.observe(doc.querySelector('main') || doc.body,{childList:true,subtree:true});
    const resize = new ResizeObserver(schedule); resize.observe(frame); mounted.set(frame, schedule); refresh();
  }
  window.MobileStudyCharts = {mount, xMap};
})();
