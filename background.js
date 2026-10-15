// Toolbar click or Alt+Shift+V floats the main video on the page; pressing again closes it.
async function launch(tab) {
  const tabId = tab.id;
  // Find the best video across frames (iframes may be inaccessible under activeTab).
  let target = { tabId, allFrames: true };
  try { await inject(target); } catch { target = { tabId }; await inject(target); }
  const probes = await chrome.scripting.executeScript({ target, func: () => window.__pipPlus.score() });
  const best = probes.filter(p => p.result > 0).sort((a, b) => b.result - a.result)[0];
  if (!best) throw new Error('No video found on this page.');
  await chrome.scripting.executeScript({
    target: { tabId, frameIds: [best.frameId] },
    func: () => { window.__pipPlus.openVideo(); },
  });
}

function inject(target) {
  return chrome.scripting.executeScript({ target, files: ['pip.js'] });
}

const run = tab => launch(tab).catch(e => console.warn('PiP Plus:', e.message));

chrome.action.onClicked.addListener(run);
chrome.commands.onCommand.addListener((command, tab) => { if (command === 'video-pip') run(tab); });

chrome.runtime.onMessage.addListener((msg, sender) => {
  const tab = sender.tab;
  if (tab && msg.type === 'focusTab') {
    chrome.tabs.update(tab.id, { active: true });
    chrome.windows.update(tab.windowId, { focused: true });
  }
});
