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
    function showList(focusId) {
      const saved = entries();
      list.replaceChildren(...saved.map(record => {
        const {setup, date} = record;
        const card = document.createElement('article');
        const title = record.description || setup.quote.product + ' · ' + setup.quote.months + 'M';
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
            dialog.close();
            byId('beta-setup-loaded').textContent = 'Loaded ' + title + '.';
          } catch {
            status.textContent = 'This setup could not be restored. Your saved copy is still available.';
          }
        });
        load.setAttribute('aria-label', 'Load setup ' + title + ', ' + time.textContent);
        load.dataset.setupId = record.id;
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
            actions.replaceChildren(load, remove);
            remove.focus();
          });
          actions.replaceChildren(confirm, cancel);
          confirm.focus();
        });
        remove.setAttribute('aria-label', 'Remove saved setup ' + title + ', ' + time.textContent);
        actions.append(load, remove);
        card.append(part('h3', title), time, details, amounts, path, parameters, actions);
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
      form.querySelector('button').disabled = !current;
      byId('beta-setup-current').textContent = current
        ? 'Current payment ' + money(current.payment)
        : 'Enter a valid starting price and budget to save the current setup.';
      showList();
      dialog.showModal();
    });
    byId('beta-setups-close').addEventListener('click', () => dialog.close());
    form.addEventListener('submit', event => {
      event.preventDefault();
      const setup = window.AccumulatorBetaScenario.capture();
      if (!setup) return;
      const date = new Date().toISOString();
      const id = crypto.randomUUID?.() || date + '-' + Math.random().toString(36).slice(2);
      const name = description.value.trim();
      const style = window.AccumulatorBetaAppearance.current();
      const layouts = window.AccumulatorBetaTable.captureLayouts();
      const record = {id, date, description: name, setup, style, layouts};
      if (!write('setups', [record, ...entries()])) {
        status.textContent = 'This browser could not save the setup. Check that site storage is available.';
        return;
      }
      description.value = '';
      showList(id);
      status.textContent = 'Saved in this browser.';
    });
    window.addEventListener('storage', event => {
      if (dialog.open && (event.key === prefix + 'setups' || event.key === null)) showList();
    });
  });
})();
