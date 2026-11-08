/* The tree and every destination work without JavaScript. Enhancement adds only
   filtering and disclosure controls; no navigation or browser storage is changed. */
(() => {
  'use strict';
  const tree = document.querySelector('.family-tree');
  if (!tree) return;
  const input = document.getElementById('map-search');
  const clear = document.getElementById('clear-search');
  const status = document.getElementById('map-status');
  const empty = document.getElementById('no-results');
  const disclosures = Array.from(tree.querySelectorAll('details'));
  const initial = disclosures.map(node => node.open);
  const nodes = Array.from(tree.querySelectorAll('.map-node'));
  const families = Array.from(tree.querySelectorAll('.family-branch'));
  const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
  const ownText = new Map(nodes.map(node => [node, normalize(node.querySelector(':scope > .map-link').textContent)]));
  let beforeSearch = null;
  function restore(states) { disclosures.forEach((node, i) => { node.open = states[i]; }); }
  function visibleAll() {
    nodes.forEach(node => { node.hidden = false; });
    families.forEach(node => { node.hidden = false; });
  }
  function alignBranches() {
    families.filter(node => !node.hidden).forEach((node, i) => node.classList.toggle('right-branch', i % 2 === 1));
  }
  function search() {
    const query = normalize(input.value);
    clear.hidden = !input.value;
    if (!query) {
      visibleAll();
      alignBranches();
      if (beforeSearch) restore(beforeSearch);
      beforeSearch = null;
      empty.hidden = true;
      status.textContent = `${nodes.length} destinations across ${families.length} branches. Open a branch or follow a page card.`;
      return;
    }
    if (!beforeSearch) beforeSearch = disclosures.map(node => node.open);
    const words = query.split(' ');
    let matches = 0;
    families.forEach(family => {
      const label = normalize(family.querySelector('.branch-title').textContent);
      family.querySelectorAll('.map-node').forEach(node => {
        let text = label + ' ' + ownText.get(node);
        let parent = node.parentElement.closest('.map-node');
        while (parent) { text += ' ' + ownText.get(parent); parent = parent.parentElement.closest('.map-node'); }
        const matched = words.every(word => text.includes(word));
        node.hidden = !matched;
        if (matched) matches++;
      });
      // Reveal ancestor paths even when only a descendant matches the query.
      Array.from(family.querySelectorAll('.map-node')).reverse().forEach(node => {
        if (node.querySelector('.map-node:not([hidden])')) node.hidden = false;
      });
      family.hidden = !family.querySelector('.map-node:not([hidden])');
      if (!family.hidden) family.querySelectorAll('details').forEach(node => { node.open = true; });
    });
    alignBranches();
    const count = families.filter(node => !node.hidden).length;
    empty.hidden = matches !== 0;
    status.textContent = `${matches} matching destination${matches === 1 ? '' : 's'} in ${count} branch${count === 1 ? '' : 'es'}. Parent paths stay visible.`;
  }
  function reset(states) {
    input.value = '';
    beforeSearch = null;
    restore(states);
    search();
  }
  input.addEventListener('input', search);
  input.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); input.value = ''; search(); } });
  clear.addEventListener('click', () => { input.value = ''; search(); input.focus(); });
  document.getElementById('expand-all').addEventListener('click', () => reset(disclosures.map(() => true)));
  document.getElementById('collapse-all').addEventListener('click', () => reset(disclosures.map(() => false)));
  document.getElementById('reset-map').addEventListener('click', () => reset(initial));
  document.querySelector('.map-controls').hidden = false;
  search();
  // Printing expands the visible hierarchy temporarily, then restores the view.
  let beforePrint = null;
  addEventListener('beforeprint', () => { beforePrint = disclosures.map(node => node.open); disclosures.forEach(node => { node.open = true; }); });
  addEventListener('afterprint', () => { if (beforePrint) restore(beforePrint); beforePrint = null; });
})();
