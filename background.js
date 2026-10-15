import { launch } from './launch.js';

chrome.commands.onCommand.addListener((command, tab) => {
  launch(command === 'tab-pip' ? 'tab' : 'video', tab).catch(e => console.warn('PiP Plus:', e.message));
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tab = sender.tab;
  if (!tab) return;

  if (msg.type === 'streamId') {
    chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id, consumerTabId: tab.id }, id => {
      const err = chrome.runtime.lastError;
      sendResponse(err ? { error: err.message } : { id });
    });
    return true;
  }

  if (msg.type === 'focusTab') {
    chrome.tabs.update(tab.id, { active: true });
    chrome.windows.update(tab.windowId, { focused: true });
  }
});
