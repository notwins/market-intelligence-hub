/* Migrate the retired dashboard preference without touching research stores. */
(() => {
  'use strict';
  try {
    if (['v1','v3'].includes(localStorage.getItem('market-hub-version'))) localStorage.setItem('market-hub-version','v4');
  } catch {}
})();
