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
    const entries = () => {
      const saved = read('setups', []);
      return Array.isArray(saved) ? saved.filter(record => typeof record?.id === 'string' &&
        typeof record.description === 'string' && typeof record.date === 'string' &&
        Number.isFinite(Date.parse(record.date)) && record.setup?.quote && Number.isFinite(record.setup.payment)) : [];
    };
    const titleOf = record => record.description || record.setup.quote.product + ' · ' + record.setup.quote.months + 'M';
    const versionOfRecord = record => Number.isSafeInteger(record.version) && record.version >= 1 ? record.version : 1;
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
    function saveRecord(snapshot, name, parent, feedback = status) {
      const saved = entries();
      const date = new Date().toISOString();
      const id = crypto.randomUUID?.() || date + '-' + Math.random().toString(36).slice(2);
      const record = {id, date, description: name.trim(), ...snapshot};
      if (parent) {
        const familyId = parent.familyId || parent.id;
        const latest = saved.reduce((highest, item) => (item.familyId || item.id) === familyId
          ? Math.max(highest, versionOfRecord(item)) : highest, versionOfRecord(parent));
        Object.assign(record, {familyId, version: latest + 1, parentId: parent.id, parentTitle: titleOf(parent)});
      }
      if (!write('setups', [record, ...saved])) {
        feedback.textContent = 'This browser could not save the setup. Check that site storage is available.';
        return null;
      }
      showList(record.id);
      status.textContent = parent ? 'Version ' + record.version + ' saved in this browser.' : 'Saved in this browser.';
      return record;
    }
    function showWorkingSetup() {
      saveButton.textContent = loaded ? 'Save new version' : 'Save current setup';
      versionOf.textContent = loaded ? 'Based on ' + titleOf(loaded) + ' · Version ' + versionOfRecord(loaded) : '';
      versionOf.hidden = separate.hidden = !loaded;
    }
    function showList(focusId) {
      const saved = entries();
      const families = new Set(saved.map(record => record.familyId).filter(Boolean));
      list.replaceChildren(...saved.map(record => {
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
          editor.addEventListener('submit', event => {
            event.preventDefault();
            saveRecord({setup, style: record.style, layouts: record.layouts}, input.value, record, feedback);
          });
          actions.hidden = true;
          actions.after(editor);
          input.focus();
        });
        edit.setAttribute('aria-label', 'Edit description for ' + title + ', ' + time.textContent);
        const remove = action('Remove', () => {
          const confirm = action('Confirm remove', () => {
            if (!write('setups', entries().filter(item => item.id !== record.id))) {
              status.textContent = 'This browser could not update saved setups.';
              return;
            }
            showList();
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
        card.append(part('h3', title), time);
        if (record.familyId || families.has(record.id)) {
          const lineage = record.parentTitle ? ' · Based on ' + record.parentTitle : '';
          card.append(part('p', 'Version ' + versionOfRecord(record) + lineage));
        }
        card.append(details, amounts, path, parameters, actions);
        return card;
      }));
      if (!saved.length) list.append(part('p', 'No saved setups yet.'));
      if (focusId) [...list.querySelectorAll('[data-setup-id]')]
        .find(button => button.dataset.setupId === focusId)?.focus();
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
    form.addEventListener('submit', event => {
      event.preventDefault();
      const setup = window.AccumulatorBetaScenario.capture();
      if (!setup) return;
      const style = window.AccumulatorBetaAppearance.current();
      const layouts = window.AccumulatorBetaTable.captureLayouts();
      const record = saveRecord({setup, style, layouts}, description.value, loaded);
      if (!record) return;
      if (loaded) {
        loaded = record;
        showWorkingSetup();
      } else description.value = '';
    });
    window.addEventListener('storage', event => {
      if (dialog.open && !list.querySelector('.beta-setup-description-edit') &&
        (event.key === prefix + 'setups' || event.key === null)) showList();
    });
  });
})();
