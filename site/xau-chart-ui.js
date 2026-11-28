'use strict';
(() => {
  const ns = 'http://www.w3.org/2000/svg';
  const paths = {
    bars:'M3 12h18l-2-5H5z M2 20h10l-1.5-5h-7z M13 20h9l-1.5-5h-6z',
    trend:'M3 3v18h18 M6 15l5-5 4 3 5-6',
    lab:'M4 19h16 M8 15h.1 M11 10h.1 M15 14h.1 M19 7h.1 M5 8h.1',
    table:'M3 5h18v14H3z M3 10h18 M3 14h18 M9 5v14 M15 5v14',
    clock:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z M12 6v6l4 2',
    globe:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z M2 12h20 M12 2c-6 6-6 14 0 20 6-6 6-14 0-20Z',
    bank:'M2 9 12 3l10 6z M3 21h18 M6 11v7 M12 11v7 M18 11v7',
    pick:'M3 21 16 8 M8 5c6-3 11 2 13 7-5-3-9-5-13-7Z',
    route:'M4 6h6l4 6h6 M4 18h6l4-6 M18 10l2 2-2 2 M4 4v4 M4 16v4',
    book:'M12 6c-3-3-7-3-10-2v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-3-1-7-1-10 2v15',
    file:'M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h6',
    dollar:'M12 2v20 M17 7h-7a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6H7',
    rates:'M4 19 20 5 M8 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z M20 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
    zoom:'M3 7V3h4 M17 3h4v4 M21 17v4h-4 M7 21H3v-4 M8 12h8 M12 8v8',
    reset:'M4 11a8 8 0 1 1 2 7 M4 5v6h6',
    pin:'M9 3h6l-1 5 3 4v2H7v-2l3-4-1-5Z M12 14v7'
  };

  function svg(tag, attrs) {
    const node = document.createElementNS(ns, tag);
    for (const [key,value] of Object.entries(attrs)) node.setAttribute(key,value);
    return node;
  }

  function icon(name) {
    const mark = svg('svg',{viewBox:'0 0 24 24',class:'xau-icon','aria-hidden':'true',focusable:'false'});
    mark.append(svg('path',{d:paths[name] ?? paths.trend}));
    return mark;
  }
  const addIcon = (node,name) => { if (node && !node.querySelector('.xau-icon')) node.prepend(icon(name)); };

  const sections = {
    overview:'bars',compare:'trend', 'monthly-lab':'lab',library:'table',regimes:'clock',
    china:'globe',holdings:'bank',mining:'pick',strategy:'route',papers:'book',sources:'file'
  };

  function decorate() {
    for (const a of document.querySelectorAll('.gold-jump a[href^="#"]')) addIcon(a,sections[a.hash.slice(1)]);
    for (const heading of document.querySelectorAll('.gold-section .section-heading .chapter')) {
      addIcon(heading,sections[heading.closest('.gold-section').id]);
    }
    for (const item of document.querySelectorAll('[data-xau-icon]')) addIcon(item,item.dataset.xauIcon);
  }

  function viewport(toolbar, read, apply) {
    const zoom = toolbar.querySelector('[data-chart-zoom]');
    const reset = toolbar.querySelector('[data-chart-reset]');
    const hint = toolbar.querySelector('[data-chart-hint]');
    let armed = false, original, graph;
    function refresh() {
      zoom.disabled = !graph;
      zoom.setAttribute('aria-pressed',String(armed));
      reset.disabled = !original;
      hint.textContent = armed ? 'Drag to zoom. With the keyboard, use Shift and arrow keys, then Enter.' :
        'Hover to read values. Tap or click to pin.';
      graph?.arm(armed);
    }
    zoom.addEventListener('click',() => {
      armed = !armed;
      refresh();
      if (armed) graph?.figure.focus({preventScroll:true});
    });
    reset.addEventListener('click',() => {
      if (!original) return;
      const dates = original;
      original = undefined;
      armed = false;
      apply(dates);
      refresh();
      zoom.focus();
    });
    addIcon(zoom,'zoom');addIcon(reset,'reset');
    refresh();
    return {
      bind(next) { graph = next?.count > 1 ? next : undefined; if (!graph) armed = false; refresh(); },
      select(start,end) {
        original ??= read();
        armed = false;
        apply([start.slice(0,7),end.slice(0,7)]);
        refresh();
        zoom.focus({preventScroll:true});
      },
      clear() { armed = false; original = undefined; refresh(); }
    };
  }

  function connect(figure, config, output, live) {
    const {data, position, content, onInspect, onRange, bounds, nearest} = config;
    const {left,right,top,bottom} = bounds;
    const brush = svg('rect',{class:'xau-brush',y:top,height:bottom-top,visibility:'hidden','pointer-events':'none'});
    const line = svg('line',{class:'xau-crosshair',y1:top,y2:bottom,visibility:'hidden','pointer-events':'none'});
    const dots = svg('g',{'aria-hidden':'true','pointer-events':'none'});
    figure.append(brush,line,dots);
    figure.classList.add('xau-graph');
    figure.setAttribute('tabindex','0');
    figure.setAttribute('role','group');
    figure.setAttribute('aria-label',figure.getAttribute('aria-label') + '. Use arrow keys to inspect observations.');
    let active = -1, pinned = false, rangeMode = false, start, dragId;

    function paint(index, announce = false) {
      if (index < 0 || index >= data.length) return;
      active = index;
      const {x, points} = position(data[index]);
      line.setAttribute('x1',x);line.setAttribute('x2',x);
      line.setAttribute('visibility',nearest ? 'hidden':'visible');
      dots.replaceChildren(...points.map(({x:pointX = x,y,tone}) => svg('circle',{
        cx:pointX,cy:y,r:4.5,class:'xau-point xau-point--'+tone
      })));
      const {date, values} = content(data[index]);
      const heading = document.createElement('strong');
      heading.textContent = date;
      output.replaceChildren(heading,...values.flatMap(({label,value,tone}) => {
        const span = document.createElement('span');
        span.className = 'xau-value xau-value--'+tone;
        span.textContent = label + ' ' + value;
        return [document.createTextNode(' '),span];
      }));
      output.dataset.pinned = String(pinned);
      output.hidden = false;
      if (pinned) {
        const mark = icon('pin');
        output.append(mark);
        output.title = 'Pinned observation. Press Escape or tap the same point to release.';
      } else {
        output.removeAttribute('title');
      }
      if (announce) live.textContent = [date,...values.map(v=>v.label+' '+v.value),...(pinned?['Pinned']:[])].join(' · ');
    }

    function choose(index, announce) {
      if (index < 0) return;
      paint(index, announce);
      onInspect?.(data[index],index);
    }

    function hit(event) {
      if (!data.length) return -1;
      const transform = figure.getScreenCTM();
      if (!transform) return -1;
      const p = new DOMPoint(event.clientX,event.clientY).matrixTransform(transform.inverse());
      if (nearest) return nearest(p,data);
      const x = Math.max(left,Math.min(right,p.x));
      let low = 0, high = data.length-1;
      while (high-low>1) {
        const mid = Math.floor((low+high)/2);
        if (position(data[mid]).x < x) low = mid; else high = mid;
      }
      return Math.abs(position(data[low]).x-x) <= Math.abs(position(data[high]).x-x) ? low : high;
    }

    function showBrush(index) {
      if (start == null) return;
      const [a,b] = [position(data[start]).x,position(data[index]).x].sort((x,y)=>x-y);
      brush.setAttribute('x',a);brush.setAttribute('width',Math.max(1,b-a));brush.setAttribute('visibility','visible');
    }
    function clearDrag() { start = undefined; dragId = undefined; brush.setAttribute('visibility','hidden'); }
    function zoom(index) {
      const first = start;
      clearDrag();
      if (first == null || index === first) return;
      const ordered = [first,index].sort((a,b)=>a-b);
      onRange?.(data[ordered[0]],data[ordered[1]]);
    }

    figure.addEventListener('pointermove',event=>{
      if ((!rangeMode && pinned) || (event.pointerType !== 'mouse' && dragId !== event.pointerId)) return;
      const index = hit(event);
      if (index >= 0) { choose(index); showBrush(index); }
    });
    figure.addEventListener('pointerdown',event=>{
      if (!rangeMode || event.button !== 0) return;
      const index = hit(event);
      if (index < 0) return;
      start = index;dragId = event.pointerId;
      figure.setPointerCapture(dragId);
      showBrush(index);
    });
    figure.addEventListener('pointerup',event=>{
      if (event.button !== 0) return;
      const index = hit(event);
      if (index < 0) return;
      if (rangeMode) { zoom(index); return; }
      pinned = !(pinned && active === index);
      choose(index,true);
    });
    figure.addEventListener('pointercancel',clearDrag);
    figure.addEventListener('keydown',event=>{
      const {key} = event;
      if (key === 'Escape') {
        pinned = false;clearDrag();if (active >= 0) paint(active,true);
        return;
      }
      const delta = {ArrowLeft:-1,ArrowRight:1,ArrowDown:-1,ArrowUp:1,PageUp:-12,PageDown:12}[key];
      if (!delta && !['Home','End','Enter',' '].includes(key)) return;
      event.preventDefault();
      const last = data.length - 1;
      const previous = active < 0 ? last : active;
      if (key === 'Enter' || key === ' ') {
        if (rangeMode && start != null) { zoom(previous); return; }
        pinned = !pinned;choose(previous,true);
        return;
      }
      if (rangeMode && event.shiftKey) start ??= previous;
      const next = key === 'Home' ? 0 : key === 'End' ? last : Math.min(last,Math.max(0,previous+delta));
      choose(next,true);showBrush(next);
    });
    return {
      figure, count:data.length,
      arm(enabled) {
        rangeMode = enabled;
        if (!enabled) clearDrag();
        figure.classList.toggle('xau-graph--zoom',enabled);
      },
      set(index) { if (index !== active) pinned = false; paint(index); }
    };
  }

  const observers = new WeakMap();
  function clear(container) {
    observers.get(container)?.disconnect();
    observers.delete(container);
  }

  function draw(container, render, config, suppliedOutput) {
    clear(container);
    const output = suppliedOutput ?? document.createElement('output');
    output.classList.add('xau-chart-readout');
    output.setAttribute('aria-live','off');
    const live = document.createElement('span');
    live.className = 'xau-visually-hidden';
    live.setAttribute('role','status');
    if (!suppliedOutput) output.hidden = true;
    let width, control, index, armed = false;
    const redraw = () => {
      const current = Math.max(270,Math.round(container.clientWidth || 350));
      if (current === width) return;
      width = current;
      const hadFocus = document.activeElement === control?.figure;
      const frame = render(width);
      container.replaceChildren(frame.figure,live);
      if (!suppliedOutput) container.append(output);
      control = connect(frame.figure,{...frame,...config,onInspect(value,i) {
        index = i;config.onInspect?.(value,i);
      }},output,live);
      control.arm(armed);
      if (index != null) control.set(index);
      if (hadFocus) control.figure.focus({preventScroll:true});
    };
    redraw();
    const observer = new ResizeObserver(redraw);
    observer.observe(container);
    observers.set(container,observer);
    return {
      get figure() { return control.figure; },
      get count() { return control.count; },
      arm(enabled) { armed = enabled;control.arm(enabled); },
      set(i) { index = i;control.set(i); }
    };
  }

  window.XauChartUi = {icon,addIcon,decorate,viewport,draw,clear};
})();
