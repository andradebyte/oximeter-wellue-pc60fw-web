# PC-60FW Oximeter via Web Bluetooth

PWA (Vite + React + [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)) that connects to the
Wellue/Viatom **PC-60FW** oximeter using the Web Bluetooth API — no need for the ViHealth app.
Installable on the home screen and with a service worker for offline use (the BLE connection
still requires the browser to stay open).

## Structure

```
index.html                            SPA shell (#root)
src/main.jsx                          React bootstrap
src/App.jsx                           screen composition (home ↔ detail)
src/components/Toolbar.jsx            connect/disconnect buttons + status
src/components/Vitals.jsx             vitals cards (clickable → detail screen)
src/components/MetricDetail.jsx       detail screen: description, numbers and chart
src/components/TimeSeriesChart.jsx    line chart (canvas) with pan and tooltip
src/components/Wave.jsx               waveform panel (same live chart as the detail screen)
src/components/DeviceMeta.jsx         device name + battery
src/components/ConnectionStats.jsx    connection history summary (home)
src/components/ConnectionHistory.jsx  detail screen: connection/drop timeline
src/components/Log.jsx                log with auto-scroll
src/components/UnsupportedWarning.jsx warning for browsers without Web Bluetooth
src/hooks/useOximeter.js              hook that exposes the oximeter as React state
src/lib/oximeter.js                   BLE connection + protocol parsing (no React)
src/lib/connectionStats.js            connection stats recording/derivation (no React)
src/lib/metrics.js                    metric metadata (description, color, Y axis)
src/style.css                         styles
public/                               PWA icons
vite.config.js                        Vite config (React + PWA/manifest)
```

The BLE code (`lib/oximeter.js`) doesn't depend on React — the integration happens in
`hooks/useOximeter.js`. Waveform samples (~30 Hz) don't go through React state: they
accumulate in a mutable ref and the UI re-renders at most ~3x/s. The home screen shows
the same live chart (`TimeSeriesChart`) as the waveform detail screen.

## Detail screens

Clicking a card on the home screen (SpO₂, Pulse, Perfusion) or the plethysmographic
waveform panel opens the metric's screen, with:

- a description of what the data means, with an example;
- current value + history of raw readings (number, unit and arrival time);
- measured cadence (how often readings are arriving, in seconds);
- live line chart: the X axis grows with each reading and, once the history exceeds
  the visible window, you can **drag** the chart to browse the past
  ("Back to live" returns to live tracking). Hovering shows the exact value.

The history keeps up to 1 h of readings (~3600 points per metric) and only lives in
memory — reloading the page resets it.

## Connection history

A dedicated panel on the home screen ("Connection history") tracks the actual BLE
link (not the "waiting for reconnection" UI): it shows whether it's currently
connected or disconnected and for how long, the total accumulated connected and
disconnected time, and the number of drops. Clicking it opens the full timeline,
with each session (connected at X, disconnected at Y, lasted Z) and each
disconnection gap, most recent first — with a button to clear the history.

Unlike the readings history, this data is saved in the browser's `localStorage`
(`src/lib/connectionStats.js`), so it survives page reloads.

The waveform is a special case: ~30 samples/s arrive, so its history (last
~5 min) lives outside React state (mutable ref) and the screen re-renders at most
~3x/s; the chart uses a more stretched time scale (90 px/s) and timestamps
show milliseconds.

## Demo mode

Without the oximeter on hand, open with `?demo` in the URL (e.g.
`http://localhost:3000/?demo`) to see numbers, waveform and charts with simulated
data. `?view=spo2|pulse|pi|wave` opens directly on a metric's screen (combinable:
`/?demo&view=wave`).

## How to run

```bash
npm install
npm run dev        # http://localhost:3000
```

Dev mode already registers the service worker (`devOptions.enabled`), so you can
test PWA behavior without building.

Production build:

```bash
npm run build      # generates dist/ with sw.js + manifest
npm run preview    # serves the build at http://localhost:4173
```

### With Docker

```bash
docker compose up -d --build
```

The Dockerfile builds the Vite app and serves `dist/` with nginx at **http://localhost:8080**.

> Web Bluetooth only works in a secure context: `localhost` is fine, but the network IP
> (e.g. `http://192.168.0.10:8080`) is **not** — to access from another device see the
> mobile section below.

## How to test

1. Serve the page (`npm run dev`) and open it in **Chrome** or **Edge**.
2. Put your finger on the oximeter — it turns on and starts advertising via BLE.
3. Click **Connect oximeter** and select `PC-60F_SN...` in the popup.

> The computer needs Bluetooth 4.0+ (BLE). Opening via `file://` no longer works
> (the app now uses ES modules) — and Chrome also doesn't persist Bluetooth
> permissions in that mode.

### On Android

Web Bluetooth requires HTTPS or `localhost`. `npm run dev` already listens on the
network (`server.host: true`); access it from Chrome on your phone using the PC's IP
(e.g. `http://192.168.0.10:3000`) — since it's not localhost, enable the flag
`chrome://flags/#unsafely-treat-insecure-origin-as-secure` with that URL **for testing
only**, or publish to any HTTPS host (GitHub Pages, Vercel, Netlify) and test
directly. Over HTTPS you'll also get the option to **install** the PWA on the home
screen.

### iOS

❌ Safari and other regular iOS browsers don't support Web Bluetooth.

✅ There's a workaround: install [**Bluefy**](https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055)
(a browser dedicated to Web Bluetooth, available on the App Store) and open
the page from it — Web Bluetooth then works normally, no native app needed.

Without Bluefy, the only alternative is a native/hybrid app (e.g. Capacitor +
`@capacitor-community/bluetooth-le`).

## Protocol details

- BLE service: Nordic UART (`6e400001-b5a3-f393-e0a9-e50e24dcca9e`)
- Notifications on `6e400003-...`
- Frames start with `AA 55`:
  - `AA 55 0F 08 01 …` → SpO₂ (byte 5), pulse (byte 6), PI×10 (byte 8)
  - `AA 55 0F .. 02 …` → plethysmographic waveform sample (byte 5)
  - `AA 55 F0 03 03 …` → battery level 0–3 (byte 5)
- Unrecognized frames show up in hex in the page log — useful for mapping the rest
  of the protocol.

## Tips

- ViHealth **cannot** be connected at the same time (BLE only allows 1 connection at a time).
- The oximeter turns off by itself when you remove your finger — the connection drop is normal.

## Automatic reconnection

- **Within the same session:** after authorizing the oximeter once, the page enters
  "waiting" mode when it turns off and reconnects on its own (retries every 3 s) as
  soon as you put your finger back on. The **Disconnect** button ends this mode.
- **Across sessions:** when reopening the page, it uses `navigator.bluetooth.getDevices()`
  to recover the already-authorized device and reconnect **without a popup**. If this
  doesn't happen in your Chrome, enable the flag
  `chrome://flags/#enable-web-bluetooth-new-permissions-backend` (disabled by default
  in older versions).

## Credits / references

- Protocol mapped by the community: [anaesthetics.app/blog](https://anaesthetics.app/blog/posts/2020/bluetooth/)
  and [ESPHome + PC-60FW (Home Assistant Community)](https://community.home-assistant.io/t/esphome-config-to-read-from-pc-60fw-bluetooth-pulse-oximeter-and-display-locally/884140)

> ⚠️ Educational/personal use. Not a device validated for clinical use by third parties.

## Use by LLMs / AI agents

This repository is free and open for use by LLMs, AI coding agents, and
automated tools — feel free to read, index, reuse, fork, or build on top of
this code without asking for permission.

The UI copy (buttons, labels, log messages) is in Portuguese, but that's
just presentation text — what actually matters is the implementation: the
Web Bluetooth connection logic, the PC-60FW protocol parsing, the
reconnection strategy, and the canvas-based charting. All of that is
plain, framework-agnostic JavaScript/React and can be understood, adapted,
and reused by anyone, regardless of language. See `PROTOCOL.md` for a full
(English) breakdown of the BLE protocol if you're integrating with the
device directly.
