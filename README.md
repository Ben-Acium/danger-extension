# Danger Extension

**DEMO ONLY — not for distribution.**

A Chrome (Manifest V3) extension that loads the *entire* internal permission
risk catalog — Critical, High, Medium, and Standard — and wires each
permission to a real, live call against your own browser. It exists so you
can see exactly what a given permission puts within reach, without taking
anyone's word for it.

Nothing in this extension calls out to a network endpoint. Every panel reads
local browser state on demand, only when you click a button, on your own
machine. A few permissions (ChromeOS device APIs, enterprise-managed APIs,
platform-app-only APIs) are marked as unavailable outside a managed ChromeOS
environment instead of faking a result.

## Why this exists

Reviewing extension permission requests usually means reading a name like
`debugger` or `nativeMessaging` and trusting a description of what it can
do. This project inverts that: install it, grant the permissions, and click
through the catalog to see the actual capability each one unlocks in a real
browser session. It's a teaching/reference tool for grading extension risk,
not a browser extension meant for general use.

## Structure

- `manifest.json` — Manifest V3 config declaring the full permission catalog
  and a locked-down CSP for the extension pages.
- `background.js` — service worker wiring for permission-backed calls.
- `dashboard.html` / `dashboard.css` / `dashboard.js` — the inspector UI:
  a searchable catalog of permissions, each opening a panel that exercises
  that permission live.
- `offscreen.html` / `offscreen.js` — offscreen document used where an API
  requires one (e.g. audio/clipboard operations unavailable to a service
  worker directly).

## Running it locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this directory.
4. Open the extension's dashboard from the toolbar icon and grant the
   permission prompts as needed to explore each panel.

## Scope and warnings

- This extension intentionally requests `<all_urls>` host permissions and a
  large set of high-risk permissions (e.g. `debugger`, `webRequest`,
  `nativeMessaging`, `management`, `cookies`). That is the point of the
  demo — do not adapt this manifest for a real, shipped extension.
- Do not publish this to the Chrome Web Store or distribute the packed
  extension to end users.
- See [SECURITY.md](SECURITY.md) for responsible use and disclosure notes.

## License

MIT — see [LICENSE](LICENSE).
