# PiP Plus

A Chrome extension that floats a video in an always-on-top window, with a **minimize** button that shrinks it to a small bar while it keeps playing.

## Install

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose this folder.

## Use

- Click the toolbar icon, or press **⌥⇧V** (Alt+Shift+V), to float the main video on the page. Press it again to close.
- In the floating window: play/pause (Space), back/forward 10s (← →), seek, mute, **minimize** (M), back to tab.
- Minimize shrinks the window to a small bar in the bottom-right corner of the screen; restore puts it back where it was.
- Videos inside iframes fall back to Chrome's built-in Picture-in-Picture (no minimize).

Needs Chrome 130+ (Document Picture-in-Picture API with `preferInitialWindowPlacement`).
