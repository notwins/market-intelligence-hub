/* Keep the compact company banner available while the site navigation is tucked away. */
(() => {
  'use strict';
  const nav = document.querySelector('.filings-page > .hub-primary');
  if (!nav) return;
  const root = document.documentElement;
  const quiet = 160;
  const inputKeys = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']);
  let previousY = Math.max(0, window.scrollY);
  let lastScroll = -Infinity, lastWheel = -Infinity, wheelDirection = 0;
  let inputTime = -Infinity, inputId = 0, gesture = 0, direction = 0;
  let touch = false, upwardGestures = 0, countedGesture = -1, downwardDistance = 0;

  function reveal() {
    root.classList.remove('beta3-nav-hidden');
    upwardGestures = 0;
    downwardDistance = 0;
  }
  function newInput(time) {
    inputId = ++gesture;
    inputTime = time;
  }
  function hasOpenNavigation() {
    return nav.contains(document.activeElement) || nav.querySelector('[aria-expanded="true"]') ||
      document.querySelector('.hub-sections-menu[open]');
  }

  window.addEventListener('wheel', event => {
    if (event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    const time = performance.now(), sign = Math.sign(event.deltaY);
    // A mouse wheel sends separate detents. Smooth scrolling and its momentum form one gesture.
    const detent = event.deltaMode !== 0 || Math.abs(event.deltaY) >= 100 && event.deltaY % 100 === 0;
    if (detent || sign !== wheelDirection || time - lastWheel > quiet || inputTime !== lastWheel) newInput(time);
    else inputTime = time;
    wheelDirection = sign;
    lastWheel = time;
  }, {passive:true});
  window.addEventListener('touchstart', () => {
    touch = true;
    newInput(performance.now());
  }, {passive:true});
  for (const name of ['touchend','touchcancel']) window.addEventListener(name, event => {
    touch = event.touches.length > 0;
    inputTime = performance.now();
  }, {passive:true});
  window.addEventListener('keydown', event => {
    if (!inputKeys.has(event.key) || event.defaultPrevented ||
      event.target.closest('input, select, textarea, button, [contenteditable]')) return;
    const time = performance.now();
    if (event.repeat) inputTime = time;
    else newInput(time);
  });
  nav.addEventListener('focusin', reveal);

  let activeGesture = 0;
  window.addEventListener('scroll', () => {
    const y = Math.max(0, window.scrollY), delta = y - previousY;
    if (y <= 4) reveal();
    if (Math.abs(delta) < 3 && y > 4) return;
    previousY = y;
    const time = performance.now(), sign = Math.sign(delta);
    if (touch || time - inputTime <= quiet) activeGesture = inputId;
    else if (sign !== direction || time - lastScroll > quiet) activeGesture = ++gesture;
    direction = sign;
    lastScroll = time;
    if (y <= 4) return;
    if (sign > 0) {
      upwardGestures = 0;
      if (hasOpenNavigation()) {
        reveal();
        return;
      }
      downwardDistance += delta;
      if (downwardDistance >= 20 && y > nav.offsetHeight) root.classList.add('beta3-nav-hidden');
    } else {
      downwardDistance = 0;
      if (!root.classList.contains('beta3-nav-hidden') || countedGesture === activeGesture) return;
      countedGesture = activeGesture;
      if (++upwardGestures >= 3) reveal();
    }
  }, {passive:true});
})();

