(() => {
  'use strict';
  const button = document.getElementById('copy-research-prompt');
  const status = document.getElementById('prompt-copy-status');
  const source = document.getElementById('research-prompt-source');
  if (!button || !status || !source) return;
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const text = JSON.parse(source.textContent);
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      status.textContent = 'Full research prompt copied.';
    } catch (_) {
      status.textContent = 'Copy is unavailable here. Use Download as text, or select the prompt below.';
      const panel = document.querySelector('.research-prompt-panel');
      if (panel) panel.open = true;
    } finally {
      button.disabled = false;
    }
  });
})();
