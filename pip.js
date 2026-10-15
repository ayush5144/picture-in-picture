// Injected into the page (isolated world). Exposes window.__pipPlus.
(() => {
  if (window.__pipPlus) return;

  const MINI_H = 40;       // inner height of the minimized bar
  const MINI_MAX_W = 340;
  const THUMB_W = 72;      // video thumbnail width while minimized

  const ICONS = {
    play:     ['M6 4l14 8-14 8z', true],
    pause:    ['M6 4h4v16H6zM14 4h4v16h-4z', true],
    back:     ['M1 4v6h6M3.51 15a9 9 0 1 0 2.13-9.36L1 10'],
    fwd:      ['M23 4v6h-6M20.49 15a9 9 0 1 1-2.12-9.36L23 10'],
    vol:      ['M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07'],
    muted:    ['M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6'],
    minimize: ['M5 18h14'],
    restore:  ['M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7'],
    toTab:    ['M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3'],
    close:    ['M18 6L6 18M6 6l12 12'],
  };

  const CSS = `
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    html, body { margin: 0; height: 100%; overflow: hidden; background: #000; color: #f2f2f2;
      font: 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; user-select: none; }
    #stage { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: #000; }
    #stage video { width: 100% !important; height: 100% !important; max-width: none !important; max-height: none !important;
      object-fit: contain; position: static !important; inset: auto !important; transform: none !important; margin: 0 !important; }
    #msg { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 16px;
      text-align: center; line-height: 1.4; opacity: .8; pointer-events: none; }
    #msg:empty { display: none; }
    .row { position: absolute; left: 0; right: 0; display: flex; align-items: center; gap: 2px; padding: 0 6px; }
    #bar { bottom: 0; height: 44px; background: linear-gradient(transparent, rgba(0,0,0,.8)); opacity: 0; transition: opacity .15s; }
    body.active #bar, body.paused #bar { opacity: 1; }
    #mini { display: none; top: 0; bottom: 0; background: #1c1c1e; }
    body.min #bar { display: none; }
    body.min #mini { display: flex; }
    body.min.video #stage { right: auto; width: ${THUMB_W}px; }
    body.min.video #mini { left: ${THUMB_W}px; }
    body.min.tab #stage { display: none; }
    button { all: unset; flex: none; width: 30px; height: 30px; display: grid; place-items: center;
      border-radius: 6px; cursor: pointer; color: inherit; }
    button:hover { background: rgba(255,255,255,.16); }
    button svg { width: 16px; height: 16px; }
    input[type=range] { flex: 1; min-width: 30px; margin: 0 6px; accent-color: #fff; }
    .time { flex: none; font-variant-numeric: tabular-nums; opacity: .85; padding: 0 4px; }
    .title { flex: 1; min-width: 0; padding: 0 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: .9; }
    body.tab #stage { cursor: pointer; }
  `;

  // ---------- DOM helpers (no innerHTML: some sites enforce Trusted Types) ----------

  function el(doc, tag, props = {}, ...kids) {
    const node = doc.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') node.className = v; else node[k] = v;
    }
    node.append(...kids);
    return node;
  }

  function svg(doc, name) {
    const [d, filled] = ICONS[name];
    const NS = 'http://www.w3.org/2000/svg';
    const s = doc.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', filled ? 'currentColor' : 'none');
    s.setAttribute('stroke', filled ? 'none' : 'currentColor');
    s.setAttribute('stroke-width', '2');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    const p = doc.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    s.append(p);
    return s;
  }

  function button(doc, iconName, title, onClick) {
    const b = el(doc, 'button', { title });
    b.append(svg(doc, iconName));
    b.addEventListener('click', e => { e.stopPropagation(); onClick(); });
    b.setIcon = name => b.replaceChildren(svg(doc, name));
    return b;
  }

  const fmt = s => {
    if (!isFinite(s)) return '--:--';
    s = Math.floor(s);
    const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, sec = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
  };

  // In-page toast; with onClick it becomes a button (used when Chrome wants a real click).
  function notice(text, onClick) {
    document.getElementById('__pipplus_notice')?.remove();
    const host = document.createElement('div');
    host.id = '__pipplus_notice';
    Object.assign(host.style, { position: 'fixed', right: '16px', bottom: '16px', zIndex: '2147483647' });
    const root = host.attachShadow({ mode: 'closed' });
    const b = document.createElement(onClick ? 'button' : 'div');
    b.textContent = text;
    Object.assign(b.style, {
      font: '13px -apple-system, BlinkMacSystemFont, sans-serif', padding: '10px 14px', borderRadius: '8px',
      border: 'none', background: '#1c1c1e', color: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,.35)',
      cursor: onClick ? 'pointer' : 'default',
    });
    if (onClick) b.addEventListener('click', () => { host.remove(); onClick(); });
    root.append(b);
    document.documentElement.append(host);
    setTimeout(() => host.remove(), onClick ? 10000 : 4000);
  }

  // ---------- Window plumbing ----------

  function closeExisting() {
    if (window === top && window.documentPictureInPicture?.window) {
      documentPictureInPicture.window.close();
      return true;
    }
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture();
      return true;
    }
    return false;
  }

  async function requestWindow(width, height, retry) {
    try {
      return await documentPictureInPicture.requestWindow({ width, height });
    } catch (e) {
      if (e.name === 'NotAllowedError') notice('▶ Click to open floating window', retry);
      else notice('PiP Plus: ' + e.message);
      return null;
    }
  }

  // Shared chrome for both modes: stylesheet, rows, auto-hiding bar, minimize/restore.
  function shell(pip, mode, { onMinimize, onRestore } = {}) {
    const doc = pip.document;
    const sheet = new pip.CSSStyleSheet();
    sheet.replaceSync(CSS);
    doc.adoptedStyleSheets = [sheet];
    doc.title = document.title;
    doc.body.classList.add(mode);

    const stage = el(doc, 'div', { id: 'stage' });
    const msg = el(doc, 'div', { id: 'msg' });
    const bar = el(doc, 'div', { id: 'bar', class: 'row' });
    const mini = el(doc, 'div', { id: 'mini', class: 'row' });
    doc.body.append(stage, msg, bar, mini);

    let hideTimer;
    const poke = () => {
      doc.body.classList.add('active');
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => doc.body.classList.remove('active'), 2000);
    };
    doc.addEventListener('mousemove', poke);
    poke();

    let saved = null;
    const isMin = () => doc.body.classList.contains('min');

    const minimize = () => {
      if (isMin()) return;
      saved = { w: pip.outerWidth, h: pip.outerHeight };
      const frameH = pip.outerHeight - pip.innerHeight;
      doc.body.classList.add('min');
      try { pip.resizeTo(Math.min(saved.w, MINI_MAX_W), MINI_H + frameH); } catch {}
      onMinimize?.();
    };

    const restore = () => {
      if (!isMin()) return;
      doc.body.classList.remove('min');
      if (saved) try { pip.resizeTo(saved.w, saved.h); } catch {}
      onRestore?.();
    };

    const toggleMin = () => (isMin() ? restore() : minimize());
    mini.addEventListener('dblclick', restore);

    const titles = [];
    const title = () => {
      const t = el(doc, 'div', { class: 'title', textContent: document.title });
      titles.push(t);
      return t;
    };
    const titleTimer = setInterval(() => {
      doc.title = document.title;
      for (const t of titles) t.textContent = document.title;
    }, 2000);
    pip.addEventListener('pagehide', () => clearInterval(titleTimer));

    const focusTab = () => chrome.runtime.sendMessage({ type: 'focusTab' });

    return { doc, stage, msg, bar, mini, minimize, restore, toggleMin, isMin, title, focusTab };
  }

  // ---------- Video mode ----------

  function pickVideo() {
    let best = null, bestScore = 0;
    for (const v of document.querySelectorAll('video')) {
      const r = v.getBoundingClientRect();
      const area = r.width * r.height;
      if (!area || v.readyState === 0) continue;
      const score = area * (v.paused ? 1 : 10);
      if (score > bestScore) { best = v; bestScore = score; }
    }
    return best;
  }

  function score() {
    if (window === top && window.documentPictureInPicture?.window) return 1e15; // so a 2nd press closes it
    if (document.pictureInPictureElement) return 1e15;
    const v = pickVideo();
    if (!v) return 0;
    const r = v.getBoundingClientRect();
    return r.width * r.height * (v.paused ? 1 : 10);
  }

  function nativePip(video) {
    video.requestPictureInPicture().catch(e => {
      if (e.name === 'NotAllowedError') notice('▶ Click to open floating window', () => video.requestPictureInPicture());
      else notice('PiP Plus: ' + e.message);
    });
  }

  async function openVideo() {
    if (closeExisting()) return;
    const video = pickVideo();
    if (!video) return notice('PiP Plus: no video found on this page');

    // Document PiP only works from the top frame; videos in iframes fall back to Chrome's native PiP.
    if (window !== top || !window.documentPictureInPicture) return nativePip(video);

    const ratio = video.videoWidth ? video.videoHeight / video.videoWidth : 9 / 16;
    const pip = await requestWindow(480, Math.round(480 * ratio), openVideo);
    if (!pip) return;

    const ui = shell(pip, 'video');
    const { doc } = ui;
    const ac = new AbortController();
    const on = (t, ev, fn) => t.addEventListener(ev, fn, { signal: ac.signal });

    // Move the real <video> into the window (same decoder, no re-encoding), leave a placeholder.
    const placeholder = document.createElement('div');
    placeholder.style.cssText = video.style.cssText;
    placeholder.style.background = '#000';
    const savedControls = video.controls;
    video.replaceWith(placeholder);
    video.controls = false;
    ui.stage.append(video);

    const togglePlay = () => (video.paused ? video.play() : video.pause());
    const skip = s => { video.currentTime = Math.max(0, Math.min(video.duration || Infinity, video.currentTime + s)); };

    const play = button(doc, 'pause', 'Play/Pause (Space)', togglePlay);
    const miniPlay = button(doc, 'pause', 'Play/Pause', togglePlay);
    const mute = button(doc, 'vol', 'Mute', () => { video.muted = !video.muted; });
    const seek = el(doc, 'input', { type: 'range', min: 0, max: 1000, value: 0 });
    const time = el(doc, 'div', { class: 'time' });
    let seeking = false;
    seek.addEventListener('input', () => { seeking = true; if (video.duration) video.currentTime = seek.value / 1000 * video.duration; });
    seek.addEventListener('change', () => { seeking = false; });

    const backToTab = () => { pip.close(); ui.focusTab(); };

    ui.bar.append(
      play,
      button(doc, 'back', 'Back 10s (←)', () => skip(-10)),
      button(doc, 'fwd', 'Forward 10s (→)', () => skip(10)),
      seek, time, mute,
      button(doc, 'minimize', 'Minimize (M)', ui.minimize),
      button(doc, 'toTab', 'Back to tab', backToTab),
    );
    ui.mini.append(
      miniPlay, ui.title(),
      button(doc, 'restore', 'Restore (M)', ui.restore),
      button(doc, 'close', 'Close', () => pip.close()),
    );

    const sync = () => {
      const icon = video.paused ? 'play' : 'pause';
      play.setIcon(icon); miniPlay.setIcon(icon);
      doc.body.classList.toggle('paused', video.paused);
      mute.setIcon(video.muted ? 'muted' : 'vol');
    };
    const tick = () => {
      if (!seeking && video.duration) seek.value = video.currentTime / video.duration * 1000;
      time.textContent = `${fmt(video.currentTime)} / ${fmt(video.duration)}`;
    };
    for (const ev of ['play', 'pause', 'volumechange']) on(video, ev, sync);
    on(video, 'timeupdate', tick);
    sync(); tick();

    on(ui.stage, 'click', () => (ui.isMin() ? ui.restore() : togglePlay()));
    on(doc, 'keydown', e => {
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'ArrowLeft') skip(-10);
      else if (e.key === 'ArrowRight') skip(10);
      else if (e.key === 'm') ui.toggleMin();
    });

    on(pip, 'pagehide', () => {
      ac.abort();
      video.controls = savedControls;
      if (placeholder.isConnected) placeholder.replaceWith(video);
    });
  }

  // ---------- Whole-tab mode (live tab capture, view-only) ----------

  async function captureTab() {
    const res = await chrome.runtime.sendMessage({ type: 'streamId' });
    if (!res || res.error) throw new Error(res?.error || 'Could not start tab capture');
    return navigator.mediaDevices.getUserMedia({
      audio: false, // leave the tab's own audio alone
      video: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: res.id,
          maxWidth: 1920, maxHeight: 1080, maxFrameRate: 30,
        },
      },
    });
  }

  async function openTab() {
    if (closeExisting()) return;
    if (window !== top) return;
    if (!window.documentPictureInPicture) return notice('PiP Plus needs Chrome 116 or newer');

    const pip = await requestWindow(480, Math.round(480 * innerHeight / innerWidth), openTab);
    if (!pip) return;

    let stream = null;
    const stop = () => { stream?.getTracks().forEach(t => t.stop()); stream = null; };

    const ui = shell(pip, 'tab', {
      // Minimized = capture fully stopped, so it costs nothing while tucked away.
      onMinimize: stop,
      onRestore: () => start(),
    });
    const { doc } = ui;
    const video = el(doc, 'video', { autoplay: true, muted: true, playsInline: true });
    ui.stage.append(video);

    async function start() {
      ui.msg.textContent = 'Starting…';
      try {
        stop();
        stream = await captureTab();
        if (ui.isMin() || pip.closed) return stop();
        video.srcObject = stream;
        ui.msg.textContent = '';
      } catch (e) {
        ui.msg.textContent = 'Couldn’t capture this tab: ' + e.message;
      }
    }

    ui.bar.append(
      ui.title(),
      button(doc, 'minimize', 'Minimize (M)', ui.minimize),
      button(doc, 'toTab', 'Go to tab', ui.focusTab),
    );
    ui.mini.append(
      ui.title(),
      button(doc, 'restore', 'Restore (M)', ui.restore),
      button(doc, 'close', 'Close', () => pip.close()),
    );

    ui.stage.addEventListener('click', ui.focusTab);
    doc.addEventListener('keydown', e => { if (e.key === 'm') ui.toggleMin(); });
    pip.addEventListener('pagehide', stop);

    start();
  }

  window.__pipPlus = { score, openVideo, openTab };
})();
