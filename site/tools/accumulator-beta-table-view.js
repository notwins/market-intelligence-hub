(() => {
  'use strict';
  const minWidth = 88;
  const maxWidth = 640;
  const byId = id => document.getElementById(id);

  window.AccumulatorBetaTable = {
    heat(value, payment) {
      if (!Number.isFinite(value)) return '';
      const ratio = Math.abs(value) / payment;
      const band = ratio >= .20 ? 3 : ratio >= .05 ? 2 : 1;
      return ' data-beta-heat="' + (value === 0 ? 'flat' : (value < 0 ? 'loss-' : 'gain-') + band) + '"';
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const dialog = byId('beta-columns');
    const picker = byId('beta-column-picker');
    const width = byId('beta-column-width');
    const hidden = byId('beta-column-hide');
    const emphasis = byId('beta-column-emphasis');
    const left = byId('beta-column-left');
    const right = byId('beta-column-right');
    const storage = window.AccumulatorBetaStorage;
    const tables = new Map();
    let current;
    let invoker;

    function restoreLayout(state, layout, aliases) {
      const remap = key => state.id.startsWith('cmp-') ? aliases?.get(key) || key : key;
      const columns = Array.isArray(layout?.columns) ? layout.columns : [];
      state.settings = new Map(columns.filter(item => Array.isArray(item) && typeof item[0] === 'string' && item[1])
        .map(([key, config]) => [remap(key), {
          hidden: key !== '0' && config.hidden === true,
          emphasis: config.emphasis === true,
          width: Number.isInteger(config.width) && config.width >= minWidth && config.width <= maxWidth ? config.width : undefined
        }]));
      const order = Array.isArray(layout?.order) ? layout.order : [];
      state.preferredOrder = [...new Set(order.map(remap).filter(key => state.settings.has(key)))];
    }

    function layoutOf(state) {
      return {
        order: state.preferredOrder.slice(),
        columns: Array.from(state.settings, ([key, {hidden, emphasis, width}]) => [key, {hidden, emphasis, width}])
      };
    }

    function saveLayout(state) {
      if (!storage.write('table:' + state.id, layoutOf(state))) {
        byId('beta-setup-loaded').textContent = 'This browser could not remember the column layout.';
      }
    }

    Object.assign(window.AccumulatorBetaTable, {
      captureLayouts: () => Object.fromEntries(Array.from(tables, ([id, state]) => [id, layoutOf(state)])),
      restoreLayouts(layouts, aliases) {
        for (const [id, state] of tables) {
          restoreLayout(state, layouts?.[id], aliases);
          state.refresh();
          saveLayout(state);
        }
      }
    });

    function syncDialog(updateFields = true) {
      const {state, key} = current;
      const config = state.settings.get(key);
      picker.replaceChildren(...state.order.map(id => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = state.labels.get(id) + (state.settings.get(id).hidden ? ' (hidden)' : '');
        return option;
      }));
      picker.value = key;
      if (updateFields) {
        width.value = config.width ?? '';
        hidden.checked = config.hidden;
        emphasis.checked = config.emphasis;
      }
      const visible = state.order.filter(id => !state.settings.get(id).hidden);
      const index = visible.indexOf(key);
      hidden.disabled = key === state.pinned;
      left.disabled = index <= 1;
      right.disabled = index < 1 || index === visible.length - 1;
    }

    function open(state, key, button) {
      current = {state, key};
      invoker = button;
      syncDialog();
      dialog.showModal();
      picker.focus();
    }

    function mount(id, table) {
      const saved = new WeakMap();
      const state = {id, table, labels: new Map(), order: [], pinned: ''};
      restoreLayout(state, storage.read('table:' + id, null));
      tables.set(id, state);
      const colgroup = document.createElement('colgroup');
      const observer = new MutationObserver(refresh);

      function refresh() {
        observer.disconnect();
        const head = table.tHead?.rows[0];
        if (head?.cells.length > 1) {
          const original = Array.from(head.cells);
          original.forEach((cell, index) => {
            const key = cell.dataset.betaSlot || cell.dataset.betaColumn || String(index);
            if (!state.settings.has(key)) state.settings.set(key, {hidden:false, emphasis:false});
            if (cell.hasAttribute('data-beta-slot')) return;
            cell.dataset.betaSlot = key;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'beta-column-heading';
            button.setAttribute('aria-haspopup', 'dialog');
            const parts = Array.from(cell.childNodes).filter(node => !node.matches?.('a'));
            button.append(...parts);
            const label = parts.filter(node => !node.matches?.('small'))
              .map(node => node.textContent).join(' ').replace(/\s+/g, ' ').trim();
            button.title = 'Column options';
            button.addEventListener('click', () => open(state, key, button));
            state.labels.set(key, label);
            cell.prepend(button);
          });
          if (!saved.has(head)) saved.set(head, original);
          const headers = saved.get(head);
          const keys = headers.map(cell => cell.dataset.betaSlot);
          state.pinned = keys[0];
          for (const key of keys) {
            if (!state.preferredOrder.includes(key)) state.preferredOrder.push(key);
          }
          state.order = [state.pinned, ...state.preferredOrder.filter(key => key !== state.pinned && keys.includes(key))];
          const visible = state.order.filter(key => !state.settings.get(key).hidden);
          const indices = state.order.map(key => keys.indexOf(key));

          for (const row of table.rows) {
            if (row.classList.contains('cmp-section-row')) {
              row.cells[0].colSpan = visible.length;
              continue;
            }
            if (row.cells.length !== headers.length) continue;
            if (!saved.has(row)) saved.set(row, Array.from(row.cells));
            const sources = saved.get(row);
            indices.forEach((index, position) => {
              const cell = sources[index];
              const config = state.settings.get(keys[index]);
              cell.classList.toggle('beta-column-hidden', config.hidden);
              cell.classList.toggle('beta-column-emphasis', config.emphasis);
              if (row.cells[position] !== cell) row.insertBefore(cell, row.cells[position]);
            });
          }
          const sized = visible.some(key => state.settings.get(key).width);
          table.classList.toggle('beta-table-sized', sized);
          if (sized) {
            const sizes = visible.map(key => {
              const config = state.settings.get(key);
              if (!config.measured) {
                const cell = headers[keys.indexOf(key)];
                config.measured = Math.max(minWidth, Math.ceil(cell.getBoundingClientRect().width));
              }
              return config.width ?? config.measured;
            });
            colgroup.replaceChildren(...sizes.map(size => {
              const col = document.createElement('col');
              col.style.width = size + 'px';
              return col;
            }));
            table.prepend(colgroup);
            table.style.setProperty('--beta-table-width', sizes.reduce((sum, size) => sum + size, 0) + 'px');
          } else {
            colgroup.remove();
            table.style.removeProperty('--beta-table-width');
          }
        } else {
          state.order = [];
        }
        observer.observe(table, {childList:true, subtree:true});
        if (current?.state === state && dialog.open) {
          if (state.order.includes(current.key)) syncDialog(false);
          else dialog.close();
        }
      }

      state.refresh = refresh;
      refresh();
    }

    document.querySelectorAll('#overviewRows, #movements, #cmp-grid, #cmp-detail')
      .forEach(node => mount(node.id, node.closest('table')));

    picker.addEventListener('change', () => {
      current.key = picker.value;
      syncDialog();
    });
    dialog.querySelector('form').addEventListener('submit', event => {
      event.preventDefault();
      const {state, key} = current;
      const config = state.settings.get(key);
      config.hidden = !hidden.disabled && hidden.checked;
      config.emphasis = emphasis.checked;
      config.width = width.value ? Math.min(maxWidth, Math.max(minWidth, width.valueAsNumber)) : undefined;
      state.refresh();
      saveLayout(state);
      dialog.close();
    });
    for (const [button, step] of [[left, -1], [right, 1]]) {
      button.addEventListener('click', () => {
        const {state, key} = current;
        const visible = state.order.filter(id => !state.settings.get(id).hidden);
        const from = state.preferredOrder.indexOf(key);
        const to = state.preferredOrder.indexOf(visible[visible.indexOf(key) + step]);
        [state.preferredOrder[from], state.preferredOrder[to]] = [state.preferredOrder[to], state.preferredOrder[from]];
        state.refresh();
        saveLayout(state);
      });
    }
    byId('beta-column-reset').addEventListener('click', () => {
      const {state} = current;
      restoreLayout(state, null);
      state.refresh();
      saveLayout(state);
      syncDialog();
    });
    byId('beta-column-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
      const {state, key} = current;
      const trigger = Array.from(state.table.tHead?.rows[0]?.cells ?? [])
        .find(cell => cell.dataset.betaSlot === key && !cell.classList.contains('beta-column-hidden'))
        ?.querySelector('button');
      const fallback = state.table.tHead?.querySelector('th:not(.beta-column-hidden) .beta-column-heading');
      (trigger || (invoker?.isConnected && !invoker.closest('.beta-column-hidden') ? invoker : fallback))?.focus();
      current = null;
      invoker = null;
    });
  });
})();
