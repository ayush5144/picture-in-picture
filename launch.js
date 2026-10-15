// Shared by the popup and the keyboard-shortcut handler.
export async function launch(mode, tab) {
  const tabId = tab.id;

  if (mode === 'tab') {
    await inject({ tabId });
    await chrome.scripting.executeScript({ target: { tabId }, func: () => { window.__pipPlus.openTab(); } });
    return;
  }

  // Video mode: find the best video across frames (iframes may be inaccessible under activeTab).
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
