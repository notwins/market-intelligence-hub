'use strict';

importScripts('bonds-beta-data.js?v=20261122.performance1');

BondsBetaData.loadFredCurves().then(
  curves => self.postMessage({ curves }),
  () => self.postMessage({ error: 'FRED history unavailable' })
);
