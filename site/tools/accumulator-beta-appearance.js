(() => {
  'use strict';
  const toolbar = document.querySelector('.beta-display');
  const styles = Array.from(toolbar.querySelectorAll('[data-beta-style]'));
  const panels = Array.from(document.querySelectorAll('main > .panel, #sim > .panel'));
  panels.forEach(panel => panel.setAttribute('data-beta-panel', ''));

  toolbar.addEventListener('click', event => {
    const selected = event.target.closest('button[data-beta-style]');
    if (!selected) return;
    document.body.dataset.betaStyle = selected.dataset.betaStyle;
    styles.forEach(button => button.setAttribute('aria-pressed', String(button === selected)));
  });

  const motion = matchMedia('(prefers-reduced-motion: no-preference)');
  let pending = false;
  function updateFade() {
    pending = false;
    const edge = toolbar.getBoundingClientRect().height;
    for (const panel of panels) {
      const bottom = panel.getBoundingClientRect().bottom;
      panel.classList.toggle('beta-leaving', motion.matches && bottom > 0 && bottom < edge + 72);
    }
  }
  function requestFade() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(updateFade);
  }
  window.addEventListener('scroll', requestFade, {passive: true});
  window.addEventListener('resize', requestFade);
  motion.addEventListener('change', requestFade);
})();
