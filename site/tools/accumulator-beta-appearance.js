(() => {
  'use strict';
  const toolbar = document.querySelector('.beta-display');
  const styles = Array.from(toolbar.querySelectorAll('[data-beta-style]'));
  const storage = window.AccumulatorBetaStorage;
  const panels = Array.from(document.querySelectorAll('main > .panel, #sim > .panel'));
  panels.forEach(panel => panel.setAttribute('data-beta-panel', ''));

  function setStyle(name, save) {
    const selected = styles.find(button => button.dataset.betaStyle === name);
    if (!selected) return;
    document.body.dataset.betaStyle = name;
    styles.forEach(button => button.setAttribute('aria-pressed', String(button === selected)));
    if (save && !storage.write('style', name)) {
      document.getElementById('beta-setup-loaded').textContent = 'This browser could not remember the colour style.';
    }
  }
  window.AccumulatorBetaAppearance = {
    current: () => document.body.dataset.betaStyle || 'harbour',
    restore: name => setStyle(name, true)
  };
  setStyle(storage.read('style', 'harbour'), false);
  toolbar.addEventListener('click', event => {
    const selected = event.target.closest('button[data-beta-style]');
    if (selected) setStyle(selected.dataset.betaStyle, true);
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
