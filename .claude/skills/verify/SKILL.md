---
name: verify
description: Build, serve and drive the Interview Browser app headlessly to verify changes end-to-end on Windows.
---

# Verifying Interview Browser

Zero-dependency static site. Build + serve in one step:

```powershell
node scripts/serve.js 8123        # runs build.js first, then serves dist/ on :8123
```

Quick HTTP smoke test: `Invoke-WebRequest http://localhost:8123/manifest.json` — the manifest must list every material under `content/` (groups = `@`-prefixed folders, material subfolders = versions, newest first, direct file = "aktuális").

## Driving the UI (headless Edge + CDP)

No Playwright installed. Use headless Edge with CDP; Node 22 has a built-in WebSocket client, so a plain Node script can drive it:

```powershell
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu `
  --remote-debugging-port=9333 --hide-scrollbars --user-data-dir=$env:TEMP\edge-cdp about:blank
```

Then connect: `GET http://127.0.0.1:9333/json/list` → `new WebSocket(page.webSocketDebuggerUrl)` → send `Page.enable`, `Runtime.enable`, and `Emulation.setDeviceMetricsOverride {width:390, height:844, deviceScaleFactor:2, mobile:true}` for a real mobile viewport. Use `Runtime.evaluate` (returnByValue) to click/measure and `Page.captureScreenshot` for evidence. A reusable driver from the first verification session lived in the session scratchpad as `cdp-driver.js` — recreate from this recipe if gone.

Gotchas:
- Hash navigation (`#/...`) is same-document: `Page.loadEventFired` never fires — don't wait on it, just sleep ~500ms after `Page.navigate`.
- Plain `msedge --screenshot=...` (without CDP) ignores `--window-size` when an instance already runs on the same user-data-dir; screenshots come out cropped at the wrong layout width. Use the CDP emulation override instead — it is the reliable path.
- The search input keeps its value across hash navigations (intended); clear it before asserting list contents.

Flows worth driving: root list → group drill-down (`#/%40frontend`) → material viewer (version select, "aktuális" default) → switch to the PDF version (must load `vendor/pdfjs/web/viewer.html?file=...`) → back button → search filter → deep link with `?v=` after a full `Page.reload` → unknown path falls back to root.
