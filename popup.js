import { launch } from './launch.js';

const err = document.getElementById('err');

for (const button of document.querySelectorAll('button[data-mode]')) {
  button.addEventListener('click', async () => {
    err.textContent = '';
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    try {
      await launch(button.dataset.mode, tab);
      window.close();
    } catch (e) {
      err.textContent = /Cannot access|chrome:\/\//.test(e.message)
        ? 'Chrome doesn’t allow extensions on this page.'
        : e.message;
    }
  });
}
