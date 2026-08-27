# Permission Catalog

All permissions declared in [`manifest.json`](manifest.json) and demonstrated live in the
dashboard (`dashboard.js`), grouped by risk tier as tagged in the catalog. The extension also
requests `<all_urls>` host permissions, which is what lets several of these (e.g. `cookies`,
`webRequest`) skip any per-site prompt.

78 permissions across 4 tiers, plus 2 bonus panels that demonstrate a second, stealthier use of
an already-listed permission (see [Same permission, two demos](#same-permission-two-demos)).

## Critical

| Permission | What the panel demonstrates |
|---|---|
| `cookies` | Every cookie in the browser, for every domain — including session/auth cookies (masked by default). |
| `debugger` | Attaches Chrome DevTools Protocol to a real tab: full-page screenshot, arbitrary JS evaluation in page context, live `localStorage` keys — bypassing content-script isolation and page CSP. |
| `webRequest` | Every outgoing request while a tab stays open, including request header names, registered with `<all_urls>`. |

## High

| Permission | What the panel demonstrates |
|---|---|
| `browsingData` | Reads the current "clear browsing data" configuration (read-only demo; the same API can permanently delete history, cookies, cache, passwords, etc.). |
| `contentSettings` | Per-site browser settings (cookies, JS, images, popups, location, notifications) for any URL. |
| `declarativeNetRequest` | Rules the extension has installed to block/redirect/modify network requests. |
| `declarativeNetRequestWithHostAccess` | Same rule engine, plus visibility into exactly which requests on a tab matched a rule. |
| `declarativeNetRequestFeedback` | Live feed of every request a rule has matched, via `onRuleMatchedDebug`. |

## Medium

| Permission | What the panel demonstrates |
|---|---|
| `bookmarks` | Your entire bookmark tree — every folder, title, and URL ever saved. |
| `clipboardWrite` | Writes to the system clipboard silently, with no extra prompt. |
| `downloads` | Every downloaded file: filename, source URL, local path, size, state. |
| `downloads.open` | Could launch a downloaded file with its OS default handler (not actually triggered — would execute a real file). |
| `downloads.ui` | Controls the downloads shelf/bubble UI, including hiding it entirely. |
| `fileSystemProvider` | Mounts a virtual filesystem into the ChromeOS Files app (ChromeOS only). |
| `geolocation` | Precise device location: latitude, longitude, altitude, heading, speed, accuracy. |
| `management` | Every other installed extension, including its granted permissions and host permissions. |
| `nativeMessaging` | Attempts to connect to a native host app via Chrome's Native Messaging protocol. |
| `processes` | Lists every OS process backing the browser, with memory/CPU usage per process. |
| `storage` | The extension's own local/sync/session storage. |
| `system.memory` | Total and available system RAM. |
| `system.storage` | Every storage device/volume attached to the machine, type and capacity. |
| `topSites` | Most-visited sites, as shown on the new-tab page. |
| `ttsEngine` | Registers the extension as a text-to-speech voice provider for other apps' speech. |
| `webNavigation` | Every top-level page navigation across every tab, with transition type. |

## Standard

| Permission | What the panel demonstrates |
|---|---|
| `accessibilityFeatures.modify` | Reads system accessibility settings (spoken feedback, high contrast, sticky keys, etc.); can also change them (not exercised). |
| `accessibilityFeatures.read` | Same accessibility settings, read-only permission variant. |
| `activeTab` | Injects a script into the current tab: page title, meta tags, form field types, link count, cookie reachability. |
| `alarms` | Schedules periodic background work independent of any open page. |
| `audio` | Lists and controls system audio input/output devices (ChromeOS only). |
| `background` | Legacy "keep running after windows close" permission — mostly inert under Manifest V3. |
| `certificateProvider` | Supplies client certificates for smart-card style authentication (ChromeOS managed only). |
| `clipboardRead` | Reads whatever is currently on the system clipboard, on demand. |
| `contextMenus` | Adds a right-click menu item that hands the extension page/link/image URL and selected text. |
| `declarativeContent` | Reacts to page content (e.g. a password field present) and changes the extension's icon, with no content script or host permission needed. |
| `dns` | Resolves any hostname to an IP address directly from the browser's resolver. |
| `desktopCapture` | Opens Chrome's screen/window/tab picker, then captures a live video frame of the selection. |
| `documentScan` | Drives an attached physical document scanner (ChromeOS only). |
| `enterprise.deviceAttributes` | Reads managed-device identifiers (asset ID, location, directory device ID) on an enrolled ChromeOS device. |
| `enterprise.hardwarePlatform` | Manufacturer and model of the physical machine. |
| `enterprise.networkingAttributes` | Device network config — MAC address, IP, gateway (ChromeOS managed only). |
| `enterprise.platformKeys` | Manages device-wide client certificates for enterprise auth (ChromeOS managed only). |
| `favicon` | Fetches any site's favicon from Chrome's internal favicon cache — no host permission, no network request. |
| `fileBrowserHandler` | Adds custom actions to the ChromeOS Files app file picker. |
| `fontSettings` | Reads (and can change) the browser's default fonts and sizes. |
| `gcm` | Registers for and receives push messages via Google Cloud Messaging/Firebase. |
| `history` | Full browsing history: URL, title, visit count, last visit time. |
| `identity` | The signed-in Chrome profile's account ID. |
| `identity.email` | Same as `identity`, plus the account's email address. |
| `idle` | Whether the system is active, idle, or locked, updated live. |
| `loginState` | ChromeOS login/session state (locked, in-session, login-screen). |
| `notifications` | Fires an OS-level notification. |
| `offscreen` | Gives the background service worker access to DOM-only APIs (e.g. clipboard) without a visible page. |
| `pageCapture` | Saves the entire active tab as one MHTML snapshot (HTML, CSS, images), bypassing normal host-permission scoping. |
| `platformKeys` | Uses client certificates installed on the machine for authentication (not invoked — would open a real cert picker). |
| `power` | Can keep the system/display awake indefinitely, overriding power settings. |
| `printerProvider` | Acts as a printer driver, seeing every print job's content (ChromeOS only). |
| `printing` | Lists configured printers and can submit print jobs directly (ChromeOS only). |
| `printingMetrics` | Print job history for the device, including document titles (ChromeOS only). |
| `privacy` | Reads (and can change) privacy/security toggles — third-party cookies, network prediction, WebRTC IP handling, autofill, password saving. |
| `proxy` | Reads the browser's proxy configuration (read-only demo; the same API can silently reroute all traffic). |
| `readingList` | Everything saved to the browser's reading list. |
| `runtime` | Baseline permission every extension has — its own manifest and identity. |
| `scripting` | Injects a script into every open tab matching its host permissions, not just the active one, with no per-tab click required. |
| `search` | Triggers a search with the default search engine, opening a new tab. |
| `sessions` | Every recently closed tab and window, with enough info to restore them. |
| `sidePanel` | Opens and controls a persistent side panel next to any page. |
| `system.cpu` | CPU model, architecture, and core count. |
| `system.display` | Every monitor attached to the machine — resolution, position, layout. |
| `tabCapture` | Captures a live video frame from a tab's rendered content. |
| `tabGroups` | Every tab group created — title, color, member tabs. |
| `tabs` | Lists every open tab across all windows: URL, title, favicon, audio/pinned state. |
| `tts` | Speaks arbitrary text out loud through the speakers, unprompted. |
| `unlimitedStorage` | Removes the quota cap on the extension's local storage/IndexedDB. |
| `vpnProvider` | Implements a full VPN client, seeing and routing all network traffic (ChromeOS only). |
| `wallpaper` | Sets the ChromeOS desktop wallpaper (kiosk/managed only, deprecated). |
| `webAuthenticationProxy` | Can intercept every WebAuthn/passkey request before the OS sees it (not attached — would hijack real passkey flows). |
| `webRequestBlocking` | In Manifest V2 let synchronous blocking of every request; Manifest V3 restricts it to policy-managed extensions. |

## Same permission, two demos

Two extra panels reuse an already-listed permission to make a point about risk tagging, rather
than adding a new permission:

- **`debugger`: Network capture** — attaches CDP and pulls full request/response bodies (headers,
  tokens, JSON payloads) for everything a tab loads, and shows Chrome's unhidable "is debugging
  this browser" banner while doing it.
- **`scripting`: Invisible network capture** — achieves the same request/response capture by
  monkey-patching `fetch`/`XMLHttpRequest` in the page, using only the `scripting` permission
  (tagged Standard, not Critical) and with **zero** on-screen indicator.

## Host permissions

- `<all_urls>` — grants the above APIs access to every site with no per-site prompt.

## Source

Generated from the live catalog in [`dashboard.js`](dashboard.js) and the declarations in
[`manifest.json`](manifest.json).
