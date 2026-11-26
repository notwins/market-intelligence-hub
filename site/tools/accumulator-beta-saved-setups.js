(() => {
  'use strict';
  const prefix = 'mih:accumulator-beta2:1:';
  const byId = id => document.getElementById(id);
  function read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(prefix + key)) ?? fallback;
    } catch {
      return fallback;
    }
  }
  function write(key, value) {
    try {
      localStorage.setItem(prefix + key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
  window.AccumulatorBetaStorage = {read, write};

  document.addEventListener('DOMContentLoaded', () => {
    const opener = byId('beta-setups-open');
    const dialog = byId('beta-setups');
    const form = byId('beta-setup-form');
    const description = byId('beta-setup-description');
    const list = byId('beta-setup-list');
    const status = byId('beta-setup-status');
    const saveButton = byId('beta-setup-save');
    const versionOf = byId('beta-setup-version-of');
    const separate = byId('beta-setup-separate');
    let loaded;
    const {price, money, quote} = window.AccumulatorFormat;
    const dateLabel = new Intl.DateTimeFormat('en-SG', {
      dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Singapore'
    });
    const entries = saved => Array.isArray(saved) ? saved.filter(record => typeof record?.id === 'string' &&
        typeof record.description === 'string' && typeof record.date === 'string' &&
        Number.isFinite(Date.parse(record.date)) && record.setup?.quote && Number.isFinite(record.setup.payment)) : [];
    let database;
    function openHistory() {
      if (!database) database = new Promise(resolve => {
        try {
          const request = indexedDB.open(prefix + 'history', 1);
          request.onupgradeneeded = () => request.result.createObjectStore('library');
          request.onsuccess = () => resolve(request.result);
          request.onerror = request.onblocked = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
      return database;
    }
    const titleOf = record => record.description || record.setup.quote.product + ' · ' + record.setup.quote.months + 'M';
    const familyOf = record => record.familyId || record.id;
    const versionOfRecord = record => Number.isSafeInteger(record.version) && record.version >= 1 ? record.version : 1;
    function familyTitleOf(records, familyId) {
      const original = records.find(record => record.id === familyId);
      if (original) return titleOf(original);
      return records.find(record => record.familyTitle)?.familyTitle ||
        records.find(record => record.parentId === familyId)?.parentTitle ||
        (records.length ? titleOf(records.at(-1)) : '');
    }
    const part = (tag, value, className) => {
      const node = document.createElement(tag);
      node.textContent = value;
      if (className) node.className = className;
      return node;
    };
    function action(label, handler) {
      const button = part('button', label);
      button.type = 'button';
      button.addEventListener('click', handler);
      return button;
    }
    async function history(update) {
      const db = await openHistory();
      try {
        if (!db) {
          const saved = entries(read('setups', []));
          if (!update) return saved;
          const {records, result} = update(saved);
          return write('setups', records) ? result : null;
        }
        return await new Promise(resolve => {
          const transaction = db.transaction('library', update ? 'readwrite' : 'readonly');
          const store = transaction.objectStore('library');
          const request = store.get('setups');
          let result, legacy;
          request.onsuccess = () => {
            try {
              if (request.result === undefined) {
                try { legacy = localStorage.getItem(prefix + 'setups'); } catch {}
              }
              const saved = entries(request.result ?? read('setups', []));
              if (!update) {
                result = saved;
                return;
              }
              const change = update(saved);
              store.put(change.records, 'setups');
              result = change.result;
            } catch {
              transaction.abort();
            }
          };
          transaction.oncomplete = () => {
            if (update) {
              try {
                if (legacy && localStorage.getItem(prefix + 'setups') === legacy) localStorage.removeItem(prefix + 'setups');
              } catch {}
              write('history-updated', Date.now() + '-' + Math.random());
            }
            resolve(result);
          };
          transaction.onabort = () => resolve(null);
        });
      } catch {
        return null;
      }
    }
    async function saveRecord(snapshot, name, parent, feedback = status) {
      const record = await history(saved => {
        const date = new Date().toISOString();
        const id = crypto.randomUUID?.() || date + '-' + Math.random().toString(36).slice(2);
        const copy = {id, date, description: name.trim(), ...snapshot};
        if (parent) {
          const familyId = familyOf(parent);
          const family = saved.filter(item => familyOf(item) === familyId);
          const latest = family.reduce((highest, item) => Math.max(highest, versionOfRecord(item)), versionOfRecord(parent));
          Object.assign(copy, {familyId, version: latest + 1, parentId: parent.id, parentTitle: titleOf(parent),
            familyTitle: familyTitleOf(family, familyId) || titleOf(parent)});
        }
        return {records:[copy, ...saved], result:copy};
      });
      if (!record) {
        feedback.textContent = 'This browser could not save the setup. Check that site storage is available.';
        return null;
      }
      await showList(record.id);
      status.textContent = parent ? 'Version ' + record.version + ' saved in this browser.' : 'Saved in this browser.';
      return record;
    }
    function showWorkingSetup() {
      saveButton.textContent = loaded ? 'Save new version' : 'Save current setup';
      versionOf.textContent = loaded ? 'Based on ' + titleOf(loaded) + ' · Version ' + versionOfRecord(loaded) : '';
      versionOf.hidden = separate.hidden = !loaded;
    }
    function recordCard(record, grouped, latest = false) {
      const {setup, date} = record;
      const card = document.createElement('article');
      const title = titleOf(record);
      const time = part('time', dateLabel.format(new Date(date)) + ' SGT');
      time.dateTime = date;
      const details = part('p',
        setup.quote.product + ' · ' + setup.quote.months + 'M · ' + quote(setup.quote.strike) + ' strike · ' +
        quote(setup.quote.ko) + ' KO · ' + setup.quote.minimum + 'M guarantee');
      const amounts = part('dl', '', 'beta-setup-amounts');
      for (const [label, amount] of [['Amount invested',setup.payment], ['Target budget',setup.capital], ['Starting price',setup.spot]]) {
        const item = document.createElement('div');
        item.append(part('dt', label), part('dd', label !== 'Starting price' && Number.isInteger(amount) ? money(amount) : price(amount)));
        amounts.append(item);
      }
      const path = part('p', setup.pathLabel || '');
      const parameters = document.createElement('details');
      parameters.append(part('summary', 'Saved parameters'));
      if (setup.quote.asOf) parameters.append(part('p', 'Quote date · ' + setup.quote.asOf));
      if (Array.isArray(setup.ratios)) {
        parameters.append(part('p', 'Monthly closes · ' + setup.ratios.slice(0,setup.quote.months)
          .map((ratio,index) => 'M' + (index+1) + ' ' + price(setup.spot * ratio / 100)).join(' · ')));
      }
      if (setup.dailyOverride) parameters.append(part('p',
        'Daily override · Day ' + setup.dailyOverride.day + ' at ' + price(setup.dailyOverride.price)));
      const selectedSales = Array.isArray(setup.deliveries) ? setup.deliveries.filter(item => item?.[1]?.sell) : [];
      if (selectedSales.length) parameters.append(part('p', 'Delivery sales · ' + selectedSales
        .map(([month,choice]) => 'M' + month + ' at ' + price(choice.enteredPrice ? Number(choice.enteredPrice) : NaN)).join(' · ')));
      const actions = part('div', '', 'beta-setup-actions');
      const load = action('Load setup', () => {
        try {
          const aliases = window.AccumulatorBetaScenario.restore(setup);
          window.AccumulatorBetaAppearance.restore(record.style);
          window.AccumulatorBetaTable.restoreLayouts(record.layouts, aliases);
          loaded = record;
          description.value = record.description;
          dialog.close();
          byId('beta-setup-loaded').textContent = 'Loaded ' + title + '.';
        } catch {
          status.textContent = 'This setup could not be restored. Your saved copy is still available.';
        }
      });
      load.setAttribute('aria-label', 'Load setup ' + title + ', ' + time.textContent);
      load.dataset.setupId = record.id;
      const edit = action('Edit description', () => {
        const editor = part('form', '', 'beta-setup-description-edit');
        const input = document.createElement('textarea');
        input.rows = 2;
        input.maxLength = description.maxLength;
        input.value = record.description;
        const label = part('label', 'Description');
        label.append(input);
        const buttons = part('div', '', 'beta-setup-actions');
        const save = part('button', 'Save new version', 'primary');
        save.type = 'submit';
        const cancel = action('Cancel edit', () => {
          editor.remove();
          actions.hidden = false;
          edit.focus();
        });
        const feedback = part('p', '', 'small');
        feedback.setAttribute('role', 'status');
        buttons.append(save, cancel);
        editor.append(label, buttons, feedback);
        editor.addEventListener('submit', async event => {
          event.preventDefault();
          save.disabled = true;
          await saveRecord({setup, style: record.style, layouts: record.layouts}, input.value, record, feedback);
          save.disabled = false;
        });
        actions.hidden = true;
        actions.after(editor);
        input.focus();
      });
      edit.setAttribute('aria-label', 'Edit description for ' + title + ', ' + time.textContent);
      const remove = action('Remove', () => {
        const confirm = action('Confirm remove', async () => {
          confirm.disabled = true;
          const removed = await history(saved => ({records:saved.filter(item => item.id !== record.id),result:true}));
          if (!removed) {
            status.textContent = 'This browser could not update saved setups.';
            confirm.disabled = false;
            return;
          }
          await showList();
          status.textContent = 'Removed ' + title + '.';
          form.querySelector('button').focus();
        });
        const cancel = action('Cancel', () => {
          actions.replaceChildren(load, edit, remove);
          remove.focus();
        });
        actions.replaceChildren(confirm, cancel);
        confirm.focus();
      });
      remove.setAttribute('aria-label', 'Remove saved setup ' + title + ', ' + time.textContent);
      actions.append(load, edit, remove);
      card.append(part(grouped ? 'h4' : 'h3', title), time);
      if (grouped) {
        const lineage = record.parentTitle ? ' · Based on ' + record.parentTitle : '';
        const label = (latest ? 'Latest · ' : '') + 'Version ' + versionOfRecord(record);
        card.append(part('p', label + lineage, latest ? 'beta-setup-latest-label' : ''));
      }
      card.append(details, amounts, path, parameters, actions);
      return card;
    }

    let listRequest = 0;
    async function showList(focusId) {
      const request = ++listRequest;
      const saved = await history();
      if (request !== listRequest) return;
      if (!saved) {
        status.textContent = 'This browser could not open saved setups.';
        return;
      }
      const expanded = new Set(Array.from(list.querySelectorAll('.beta-setup-older[open]'),
        node => node.parentElement.dataset.setupFamily));
      const families = new Map();
      for (const record of saved) {
        const key = familyOf(record);
        if (!families.has(key)) families.set(key, []);
        families.get(key).push(record);
      }
      list.replaceChildren(...Array.from(families, ([key, records]) => {
        const [latest, ...older] = records.sort((a,b) =>
          versionOfRecord(b) - versionOfRecord(a) || Date.parse(b.date) - Date.parse(a.date));
        if (!older.length && !latest.familyId) return recordCard(latest, false);

        const group = part('section', '', 'beta-setup-family');
        group.dataset.setupFamily = key;
        group.append(part('h3', familyTitleOf(records, key)), recordCard(latest, true, true));
        if (older.length) {
          const details = part('details', '', 'beta-setup-older');
          details.open = expanded.has(key);
          const stack = part('div', '', 'beta-setup-version-stack');
          stack.append(...older.map(record => recordCard(record, true)));
          details.append(part('summary', 'Older versions (' + older.length + ')'), stack);
          group.append(details);
        }
        return group;
      }));
      if (!saved.length) list.append(part('p', 'No saved setups yet.'));
      if (focusId) {
        const button = [...list.querySelectorAll('[data-setup-id]')].find(item => item.dataset.setupId === focusId);
        const details = button?.closest('.beta-setup-older');
        if (details) details.open = true;
        button?.focus();
      }
    }

    opener.addEventListener('click', () => {
      status.textContent = '';
      byId('beta-setup-loaded').textContent = '';
      const current = window.AccumulatorBetaScenario.capture();
      saveButton.disabled = !current;
      byId('beta-setup-current').textContent = current
        ? 'Current payment ' + money(current.payment)
        : 'Enter a valid starting price and budget to save the current setup.';
      showWorkingSetup();
      showList();
      dialog.showModal();
    });
    byId('beta-setups-close').addEventListener('click', () => dialog.close());
    separate.addEventListener('click', () => {
      if (description.value === loaded?.description) description.value = '';
      loaded = null;
      showWorkingSetup();
      description.focus();
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const setup = window.AccumulatorBetaScenario.capture();
      if (!setup) return;
      const style = window.AccumulatorBetaAppearance.current();
      const layouts = window.AccumulatorBetaTable.captureLayouts();
      const parent = loaded;
      const name = description.value;
      saveButton.disabled = true;
      const record = await saveRecord({setup, style, layouts}, name, parent);
      saveButton.disabled = false;
      if (!record) return;
      if (parent && loaded === parent) {
        loaded = record;
        showWorkingSetup();
      } else if (!parent && description.value === name) description.value = '';
    });
    window.addEventListener('storage', event => {
      if (dialog.open && !list.querySelector('.beta-setup-description-edit') &&
        (event.key === prefix + 'setups' || event.key === prefix + 'history-updated' || event.key === null)) showList();
    });
  });
})();
