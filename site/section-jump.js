/* Shared in-page subsection navigation. Does not write routes, history or saved data. */
(function (root) {
  'use strict';
  function indexAt(tops, offset, anchor = -1) {
    if (!tops.length) return -1;
    let index = 0;
    for (let i = 0; i < tops.length; i++) {
      if (tops[i] <= offset + 12 && (i === 0 || Math.abs(tops[i] - tops[index]) > 8)) index = i;
    }
    // Keep the chosen heading when cards share a row, and at the document's end.
    if (anchor >= 0 && anchor < tops.length && Math.abs(tops[anchor] - tops[index]) <= 8) return anchor;
    return index;
  }
  function visible(node, win) {
    if (!node || !node.isConnected || !node.getClientRects().length) return false;
    for (let parent = node; parent; parent = parent.parentElement) {
      if (parent.hidden || parent.hasAttribute('inert') || parent.getAttribute('aria-hidden') === 'true') return false;
      const style = win.getComputedStyle(parent);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
      if (parent.tagName === 'DETAILS' && !parent.open && !parent.querySelector('summary')?.contains(node)) return false;
    }
    return true;
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = { indexAt, visible }; return; }
  const doc = root.document;
  if (!doc) return;
  function start() {
    if (doc.getElementById('section-jump')) return;
    const bar = doc.createElement('nav');
    bar.id = 'section-jump'; bar.hidden = true;
    bar.setAttribute('aria-label', 'Subsection navigation');
    bar.innerHTML = '<div class="section-jump-toolbar"><button type="button" id="section-jump-toggle" aria-label="Choose subsection" title="Choose subsection" aria-expanded="false" aria-controls="section-jump-panel"><span aria-hidden="true">☰</span></button><span class="section-jump-divider" aria-hidden="true"></span><button type="button" class="section-jump-prev" aria-label="Previous subsection" title="Previous subsection"><span aria-hidden="true">↑</span></button><button type="button" class="section-jump-next" aria-label="Next subsection" title="Next subsection"><span aria-hidden="true">↓</span></button></div><div id="section-jump-panel" hidden><div class="section-jump-heading">On this page <button type="button" class="section-jump-close" aria-label="Close sections">×</button></div><div class="section-jump-controls"><button type="button" class="section-jump-prev" aria-label="Previous subsection" title="Previous subsection">↑</button><label class="section-jump-label" for="section-jump-select">Jump to subsection</label><select id="section-jump-select" aria-label="Jump to subsection"></select><span class="section-jump-progress" aria-hidden="true"></span><button type="button" class="section-jump-next" aria-label="Next subsection" title="Next subsection">↓</button></div><ol class="section-jump-list" aria-label="Page sections"></ol></div><span class="section-jump-status" role="status" aria-live="polite" aria-atomic="true"></span>';
    const spacer = doc.createElement('div'); spacer.className = 'section-jump-spacer'; spacer.hidden = true; spacer.setAttribute('aria-hidden', 'true');
    doc.body.append(bar, spacer);
    const previous = [...bar.querySelectorAll('.section-jump-prev')], next = [...bar.querySelectorAll('.section-jump-next')];
    const picker = bar.querySelector('select'), status = bar.querySelector('.section-jump-status');
    const toggle = bar.querySelector('#section-jump-toggle'), panel = bar.querySelector('#section-jump-panel');
    const list = bar.querySelector('.section-jump-list'), toolbar = bar.querySelector('.section-jump-toolbar');
    const progress = bar.querySelector('.section-jump-progress'), rail = doc.querySelector('aside.rail');
    let docked = false, expanded = false;
    function setExpanded(value, restoreFocus = false) {
      expanded = !docked && value;
      toggle.setAttribute('aria-expanded', String(expanded));
      panel.hidden = !docked && !expanded;
      if (restoreFocus && !docked) toggle.focus({ preventScroll: true });
      if (expanded) {
        const selected = list.querySelector('[aria-current="location"]');
        if (selected) list.scrollTop = Math.max(0, selected.offsetTop - list.offsetTop - list.clientHeight / 2);
      }
    }
    function layout() {
      const shouldDock = !!rail && visible(rail, root);
      if (shouldDock !== docked) {
        const hadFocus = bar.contains(doc.activeElement);
        docked = shouldDock;
        if (docked) rail.insertBefore(bar, rail.querySelector('.rail-foot'));
        else doc.body.insertBefore(bar, spacer);
        bar.classList.toggle('section-jump-docked', docked);
        setExpanded(false);
        if (hadFocus) (docked ? picker : toggle).focus({ preventScroll: true });
      }
    }
    let targets = [], current = -1, anchor = null, pending = null, offset = 16, refreshFrame = 0, positionFrame = 0, settle = 0;
    function offsets() {
      layout();
      offset = 16;
      doc.querySelectorAll('header,nav,[data-section-jump-offset]').forEach(node => {
        if (node === bar || bar.contains(node) || !visible(node, root)) return;
        const rect = node.getBoundingClientRect(), position = root.getComputedStyle(node).position;
        if (['sticky', 'fixed'].includes(position) && rect.top <= 1 && rect.bottom > 0 && rect.width > root.innerWidth / 2) offset = Math.max(offset, rect.bottom + 16);
      });
      let bottom = 0;
      doc.querySelectorAll('.bottom-nav').forEach(node => {
        if (!visible(node, root)) return;
        const rect = node.getBoundingClientRect();
        if (root.getComputedStyle(node).position === 'fixed' && rect.top > root.innerHeight / 2) bottom = Math.max(bottom, root.innerHeight - rect.top);
      });
      // The measured nav already includes its safe-area padding. Never add it twice.
      bar.style.setProperty('--section-jump-bottom', bottom ? bottom + 'px' : 'env(safe-area-inset-bottom,0px)');
      bar.style.setProperty('--section-jump-available', Math.max(120, root.innerHeight - bottom - toolbar.getBoundingClientRect().height - 40) + 'px');
      bar.style.setProperty('--section-jump-panel-width', Math.min(350, doc.documentElement.clientWidth - 24) + 'px');
      // Keep this as the last body child so even subsequently inserted legal links clear the pill.
      if (spacer !== doc.body.lastElementChild) doc.body.append(spacer);
      spacer.style.height = docked ? '0px' : (bottom + toolbar.getBoundingClientRect().height + 28) + 'px';
    }
    function position() {
      positionFrame = 0;
      if (!targets.length || bar.hidden) return;
      const anchored = targets.findIndex(item => item.node === (pending || anchor));
      const tops = targets.map(item => item.node.getBoundingClientRect().top);
      const atEnd = root.scrollY > 0 && root.scrollY + root.innerHeight >= doc.documentElement.scrollHeight - 2;
      const chosenVisibleAtEnd = atEnd && anchored !== -1 && tops[anchored] >= offset - 12 && tops[anchored] < root.innerHeight - bar.getBoundingClientRect().height;
      current = (pending || chosenVisibleAtEnd) && anchored !== -1 ? anchored : indexAt(tops, offset, anchored);
      picker.value = String(current);
      progress.textContent = 'Section ' + (current + 1) + ' of ' + targets.length;
      picker.title = targets[current]?.label || 'Jump to subsection';
      list.querySelectorAll('button').forEach((button, i) => {
        if (i === current) button.setAttribute('aria-current', 'location');
        else button.removeAttribute('aria-current');
      });
      const before = targets[current - 1]?.label, after = targets[current + 1]?.label;
      previous.forEach(button => {
        button.disabled = current <= 0;
        button.title = before ? 'Previous subsection: ' + before : 'At the first subsection';
        button.setAttribute('aria-label', button.title);
      });
      next.forEach(button => {
        button.disabled = current >= targets.length - 1;
        button.title = after ? 'Next subsection: ' + after : 'At the last subsection';
        button.setAttribute('aria-label', button.title);
      });
    }
    function refresh() {
      const scope = doc.querySelector('main') || doc.body;
      const nodes = [...scope.querySelectorAll('h1,h2,h3,[data-section-jump]')].filter(node => !node.closest('nav,aside,dialog,footer,#site-catalogue,[data-section-jump-ignore]') && visible(node, root));
      // Sort by vertical reading position, retaining DOM order for cards on a row.
      const updated = nodes.map((node, order) => ({ node, order, top: node.getBoundingClientRect().top, label: (node.getAttribute('data-section-jump') || node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim() })).filter(item => item.label);
      updated.sort((a, b) => Math.abs(a.top - b.top) < 8 ? a.order - b.order : a.top - b.top);
      const changed = updated.length !== targets.length || updated.some((item, i) => item.node !== targets[i]?.node || item.label !== targets[i]?.label);
      targets = updated;
      if (!targets.some(item => item.node === pending)) pending = null;
      if (!targets.some(item => item.node === anchor)) anchor = null;
      // A title alone is not a subsection. Empty/filter-only views stay uncluttered.
      bar.hidden = spacer.hidden = targets.length < 2 || !!doc.querySelector('dialog[open]');
      if (bar.hidden) setExpanded(false);
      if (changed) {
        const options = targets.map((item, i) => {
          const option = doc.createElement('option'); option.value = String(i);
          option.textContent = (item.node.tagName === 'H3' ? '↳ ' : '') + item.label; return option;
        });
        picker.replaceChildren(...options);
        list.replaceChildren(...targets.map((item, i) => {
          const row = doc.createElement('li'), button = doc.createElement('button');
          button.type = 'button'; button.textContent = item.label;
          if (item.node.tagName === 'H3') button.className = 'section-jump-nested';
          button.addEventListener('click', () => jump(i, true));
          row.append(button); return row;
        }));
      }
      offsets(); position();
    }
    function schedule() { if (!refreshFrame) refreshFrame = root.requestAnimationFrame(() => { refreshFrame = 0; refresh(); }); }
    function finish() { pending = null; position(); }
    function jump(index, focusHeading) {
      refresh();
      const target = targets[index];
      if (!target || bar.hidden) return;
      anchor = pending = target.node; current = index;
      if (!docked) setExpanded(false, expanded && !focusHeading);
      if (focusHeading) {
        if (!target.node.hasAttribute('tabindex')) target.node.setAttribute('tabindex', '-1');
        target.node.focus({ preventScroll: true });
      }
      const top = Math.max(0, root.scrollY + target.node.getBoundingClientRect().top - offset);
      const reduced = root.matchMedia('(prefers-reduced-motion: reduce)').matches;
      root.scrollTo({ top, behavior: reduced ? 'instant' : 'smooth' });
      status.textContent = 'Subsection ' + (index + 1) + ' of ' + targets.length + ': ' + target.label;
      position(); root.clearTimeout(settle); settle = root.setTimeout(finish, 900);
    }
    toggle.addEventListener('click', () => setExpanded(!expanded));
    bar.querySelector('.section-jump-close').addEventListener('click', () => setExpanded(false, true));
    doc.addEventListener('keydown', event => {
      if (event.key === 'Escape' && expanded) { event.preventDefault(); setExpanded(false, true); }
    });
    doc.addEventListener('pointerdown', event => {
      if (expanded && !bar.contains(event.target)) setExpanded(false);
    });
    doc.addEventListener('focusin', event => {
      if (expanded && !bar.contains(event.target)) setExpanded(false);
    });
    previous.forEach(button => button.addEventListener('click', () => jump(current - 1, false)));
    next.forEach(button => button.addEventListener('click', () => jump(current + 1, false)));
    picker.addEventListener('change', () => jump(Number(picker.value), true));
    root.addEventListener('scroll', () => {
      if (!positionFrame) positionFrame = root.requestAnimationFrame(position);
      if (pending) { root.clearTimeout(settle); settle = root.setTimeout(finish, 160); }
    }, { passive: true });
    root.addEventListener('resize', schedule); root.addEventListener('hashchange', () => { setExpanded(false); schedule(); }); root.addEventListener('popstate', () => { setExpanded(false); schedule(); });
    root.addEventListener('market-display-change', schedule);
    doc.addEventListener('toggle', schedule, true); doc.addEventListener('load', schedule, true);
    new MutationObserver(records => {
      if (records.some(record => !bar.contains(record.target) && record.target !== spacer)) schedule();
    }).observe(doc.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'open', 'class', 'style', 'aria-hidden', 'inert'] });
    if (root.ResizeObserver) {
      const observer = new root.ResizeObserver(schedule);
      observer.observe(doc.querySelector('main') || doc.body);
      doc.querySelectorAll('.bottom-nav,.topbar').forEach(node => observer.observe(node));
    }
    root.visualViewport?.addEventListener('resize', schedule);
    refresh();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})(typeof window === 'undefined' ? globalThis : window);
