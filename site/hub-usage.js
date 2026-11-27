/* In-page usage totals. Event data is limited to a metric category and a public label. */
(() => {
  'use strict';
  const hub = '/market-intelligence-hub/';
  if (location.origin !== 'https://notwins.github.io' || !location.pathname.startsWith(hub)
      || window.top !== window.self) return;
  const page = location.pathname.slice(hub.length).replace(/\/$/, '/index.html');
  const preference = 'mih-usage-disabled';
  const privateSignal = () => navigator.globalPrivacyControl || navigator.doNotTrack === '1' || window.doNotTrack === '1';
  if (!/^[a-z0-9][a-z0-9./-]{1,125}$/.test(page) || !page.endsWith('.html')
      || page === 'index.html' || /(?:^|\/)(?:data|legal)\//.test(page)
      || /(?:preview|backup|connect)\.html$/.test(page)) return;
  const service = 'https://market-intelligence-blueprint-winston.winstonnggw.chatgpt.site/analytics/event';
  function record(category, metric) {
    if (privateSignal() || document.prerendering) return;
    try {
      if (localStorage.getItem(preference) === '1') return;
      fetch(service, {
        method: 'POST', body: JSON.stringify([category, metric]), keepalive: true,
        credentials: 'omit', referrerPolicy: 'no-referrer'
      }).catch(() => {});
    } catch { /* Browser privacy or network settings may prevent counting. */ }
  }

  const tabs = new Set([
    'calls','credit','earnings','feeds','headlines','history','history/beta2-shares','history/beta4-shares',
    'history/curves','history/fx','history/shares','history/si','history/spx','history/yield','hourly',
    'master','master/explore','master/pivot','master/review','master/screens','master/watchlists',
    'overview','policy','reports','research','tools','ust','watchlist'
  ]);
  const deskTabs = {briefing:'read', markets:'markets', 'full-history':'full-history'};
  let lastTab;
  function countTab() {
    let selected;
    if (page === 'desk.html') {
      const key = document.querySelector('.modebar [role="tab"][aria-selected="true"]')?.dataset.mode;
      if (Object.hasOwn(deskTabs, key)) selected = 'desk/' + deskTabs[key];
    } else if (page === 'bond-cashflow.html') {
      const sheet = document.querySelector('[role="tab"][data-page][aria-selected="true"]')?.dataset.page;
      if (/^(?:[0-9]|1[0-4])$/.test(sheet)) selected = 'cashflow/sheet-'+sheet;
    } else if (page === 'v4.html') {
      const key = location.hash.slice(1) || 'overview';
      if (tabs.has(key)) selected = 'workspace/' + key;
    }
    if (selected && selected !== lastTab) {
      lastTab = selected;
      record('tab', selected);
    }
  }

  const publicReport = (
    /^\/(?:market-intelligence-hub|market-intelligence-content)\/(?:research|read-ups)\/([a-z0-9-]{3,95})(?:\/(?:index\.html)?|\.html)?$/
  );
  const publicReportType = {
    news:'daily/news', bonds:'daily/bonds', credit:'daily/bonds', earnings:'daily/earnings',
    economy:'daily/economy', 'hourly-briefing':'daily/hourly-briefing'
  };
  const interactiveTool = (
    page.startsWith('tools/') || ['bond-cashflow.html','si-beta2.html','historical-fred.html',
      'cross-market-history.html','cross-market-history-beta2.html','fred/cross-market-replay.html',
      'fred/risk-observatory.html','fred/signal-review.html'].includes(page)
  );
  const editsModel = (
    /^(?:tools\/(?:accumulator(?:-beta|-3d|-capital|-si-flow)?|cpf-life-ra|xau-fcn|gld-accumulator|mortgage)|bond-cashflow)\.html$/
  );
  let lastToolAction = 0;
  function toolAction(action) {
    // A submit button can produce both click and submit. Count one action per activation.
    const stamp = Date.now();
    if (stamp - lastToolAction < 180) return;
    lastToolAction = stamp;
    record('tool', page.replace(/^tools\//, '').replace(/\.html$/, '').replaceAll('/', '-') + '/' + action);
  }
  function bindActions() {
    document.addEventListener('click', event => {
      if (!event.isTrusted || !(event.target instanceof Element)) return;
      const link = event.target.closest('a[href]');
      if (link) {
        const url = new URL(link.dataset.researchSource || link.href);
        const report = url.origin === location.origin && publicReport.exec(url.pathname);
        if (report) record('report', 'research/' + report[1]);
        if (link.hasAttribute('download')) toolAction('download');
        else if (url.origin === location.origin && url.pathname.startsWith(hub + 'data/') && /\.csv$/i.test(url.pathname)) toolAction('download');
      }
      const button = event.target.closest('button');
      if (!button || button.type === 'submit') return;
      if (interactiveTool && button.matches('#download, #download-pdf, #comparePdf, [data-export], [data-download]')) toolAction('download');
      if (interactiveTool && button.matches('[data-compare], [data-scenario], [data-chart-mode], #compareTab')) toolAction('change-control');
    });
    if (interactiveTool) {
      document.addEventListener('submit', event => {
        if (event.submitter?.matches('#beta-quick-download')) toolAction('download');
        else if (editsModel && event.target instanceof HTMLFormElement && event.target.querySelector('input[type="number"]')) toolAction('calculate');
      });
      document.addEventListener('change', event => {
        if (!event.isTrusted || !(event.target instanceof Element)) return;
        if (editsModel && event.target.matches('input[type="number"], input[type="range"], select')) {
          toolAction('change-control');
        } else if (event.target.matches('select.tenor, #compareLeft, #compareRight, [data-compare], [data-chart-series]')) {
          toolAction('change-control');
        }
      });
    }
    document.addEventListener('hub-report-open', event => {
      if (page === 'desk.html' && Object.hasOwn(publicReportType, event.detail)) {
        record('report', publicReportType[event.detail]);
      }
    });
  }

  function start() {
    record('page', page);
    countTab();
    addEventListener('hashchange', countTab);
    const tablist = page === 'desk.html' ? document.querySelector('.modebar [role="tablist"]')
      : page === 'bond-cashflow.html' ? document.querySelector('[role="tablist"]') : null;
    if (tablist) {
      new MutationObserver(countTab).observe(tablist, {
        subtree: true, attributes: true, attributeFilter: ['aria-selected']
      });
    }
    bindActions();
  }
  if (document.prerendering) document.addEventListener('prerenderingchange', start, {once:true});
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
